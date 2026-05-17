package middlewares

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implements token bucket algorithm for rate limiting
type RateLimiter struct {
	requestsPerMinute int
	tokens            map[string]float64
	lastRefillTime    map[string]time.Time
	mu                sync.RWMutex
	cleanupInterval   time.Duration
}

// NewRateLimiter creates a new rate limiter
// requestsPerMinute: max requests allowed per minute per user/IP
func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	rl := &RateLimiter{
		requestsPerMinute: requestsPerMinute,
		tokens:            make(map[string]float64),
		lastRefillTime:    make(map[string]time.Time),
		cleanupInterval:   5 * time.Minute,
	}

	// Start cleanup goroutine
	go rl.cleanup()

	return rl
}

// Middleware returns a Gin middleware that enforces rate limiting
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get unique identifier (user ID or IP)
		identifier := rl.getIdentifier(c)

		// Check if request is allowed
		if !rl.allow(identifier) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limit_exceeded",
				"message": fmt.Sprintf("Rate limit exceeded. Maximum %d requests per minute", rl.requestsPerMinute),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// allow checks if a request from identifier is allowed
func (rl *RateLimiter) allow(identifier string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// Initialize if first request
	if _, exists := rl.lastRefillTime[identifier]; !exists {
		rl.tokens[identifier] = float64(rl.requestsPerMinute)
		rl.lastRefillTime[identifier] = now
		rl.tokens[identifier]-- // Consume one token
		return true
	}

	// Refill tokens based on time elapsed
	lastRefill := rl.lastRefillTime[identifier]
	elapsed := now.Sub(lastRefill)
	tokensToAdd := float64(rl.requestsPerMinute) * (elapsed.Minutes())

	if tokensToAdd > 0 {
		rl.tokens[identifier] = min(
			float64(rl.requestsPerMinute),
			rl.tokens[identifier]+tokensToAdd,
		)
		rl.lastRefillTime[identifier] = now
	}

	// Check if tokens available
	if rl.tokens[identifier] >= 1.0 {
		rl.tokens[identifier]--
		return true
	}

	return false
}

// getIdentifier returns a unique identifier for the request (user or IP)
func (rl *RateLimiter) getIdentifier(c *gin.Context) string {
	// Prefer authenticated user ID
	if userID, exists := c.Get("userID"); exists {
		return "user:" + fmt.Sprint(userID)
	}

	// Fall back to client IP
	return "ip:" + c.ClientIP()
}

// cleanup periodically removes old entries
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()

		now := time.Now()
		cutoff := now.Add(-15 * time.Minute) // Remove entries not used for 15 minutes

		for identifier, lastRefill := range rl.lastRefillTime {
			if lastRefill.Before(cutoff) {
				delete(rl.tokens, identifier)
				delete(rl.lastRefillTime, identifier)
			}
		}

		rl.mu.Unlock()
	}
}

// min returns the minimum of two values
func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// GetStats returns current rate limiter statistics (for monitoring)
func (rl *RateLimiter) GetStats() map[string]interface{} {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	return map[string]interface{}{
		"active_identifiers":  len(rl.tokens),
		"requests_per_minute": rl.requestsPerMinute,
	}
}
