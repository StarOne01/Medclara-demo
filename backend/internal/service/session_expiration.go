package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
)

// SessionExpirationService handles automatic session cleanup and archival
// It runs as a background goroutine to manage session TTL (time-to-live)
type SessionExpirationService struct {
	db            *sql.DB
	ttlDays       int            // Time-to-live in days (default: 30)
	checkInterval time.Duration  // How often to run cleanup (default: 24 hours)
	done          chan bool      // Signal to stop the service
	wg            sync.WaitGroup // Wait group for graceful shutdown
	isRunning     bool           // Track if service is running
	mu            sync.Mutex     // Mutex for thread safety
}

// NewSessionExpirationService creates a new session expiration service
// ttlDays: Number of days before sessions expire (default: 30)
// checkInterval: How frequently to check for expired sessions (default: 24 hours)
func NewSessionExpirationService(db *sql.DB, ttlDays int, checkInterval time.Duration) *SessionExpirationService {
	if ttlDays <= 0 {
		ttlDays = 30 // Default to 30 days
	}

	if checkInterval <= 0 {
		checkInterval = 24 * time.Hour // Default to once per day
	}

	return &SessionExpirationService{
		db:            db,
		ttlDays:       ttlDays,
		checkInterval: checkInterval,
		done:          make(chan bool),
		isRunning:     false,
	}
}

// Start begins the background cleanup service
// Should be called once at application startup
func (s *SessionExpirationService) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		log.Println("Session expiration service is already running")
		return
	}

	s.isRunning = true
	s.wg.Add(1)

	go s.run()
	log.Printf("Session expiration service started (TTL: %d days, check interval: %v)", s.ttlDays, s.checkInterval)
}

// Stop gracefully stops the background service
// Should be called before application shutdown
func (s *SessionExpirationService) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return
	}

	s.isRunning = false
	close(s.done)
	s.wg.Wait()
	log.Println("Session expiration service stopped")
}

// run is the main background loop that periodically cleans up expired sessions
func (s *SessionExpirationService) run() {
	defer s.wg.Done()

	// Run cleanup immediately on start
	s.cleanup()

	// Set up ticker for periodic cleanup
	ticker := time.NewTicker(s.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.cleanup()

		case <-s.done:
			return
		}
	}
}

// cleanup performs the actual session expiration and archival
func (s *SessionExpirationService) cleanup() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	startTime := time.Now()

	// Count archived sessions
	archivedCount, err := s.archiveExpiredSessions(ctx)
	if err != nil {
		log.Printf("Error during session cleanup: %v", err)
		return
	}

	// Log statistics
	duration := time.Since(startTime)
	log.Printf("Session cleanup completed: archived %d sessions in %v", archivedCount, duration)

	// Log warning if cleanup took too long
	if duration > 10*time.Second {
		log.Printf("WARNING: Session cleanup took longer than expected: %v", duration)
	}
}

// archiveExpiredSessions finds and archives all expired sessions
// Returns the number of sessions archived, or error if operation fails
func (s *SessionExpirationService) archiveExpiredSessions(ctx context.Context) (int, error) {
	queries := db.New(s.db)

	// Fetch expired sessions (limit to prevent timeout on large datasets)
	expiredSessions, err := queries.GetExpiredSessions(ctx, 1000)
	if err != nil && err != sql.ErrNoRows {
		return 0, fmt.Errorf("failed to retrieve expired sessions: %w", err)
	}

	if len(expiredSessions) == 0 {
		return 0, nil
	}

	archivedCount := 0
	failedCount := 0

	for _, session := range expiredSessions {
		// Skip if already archived
		if session.Status == "archived" {
			continue
		}

		// Update session status to archived
		err := queries.UpdateScribeSessionStatus(ctx, db.UpdateScribeSessionStatusParams{
			SessionID: session.SessionID,
			Status:    "archived",
			UpdatedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
		})

		if err != nil {
			log.Printf("Failed to archive session %s: %v", session.SessionID, err)
			failedCount++
			continue
		}

		archivedCount++
	}

	if failedCount > 0 {
		log.Printf("Session archival: %d succeeded, %d failed", archivedCount, failedCount)
	}

	return archivedCount, nil
}

// GetExpiredSessionsCount returns the number of sessions ready for archival
// This is useful for monitoring and alerting
func (s *SessionExpirationService) GetExpiredSessionsCount(ctx context.Context) (int, error) {
	queries := db.New(s.db)

	sessions, err := queries.GetExpiredSessions(ctx, 10000)
	if err != nil && err != sql.ErrNoRows {
		return 0, fmt.Errorf("failed to count expired sessions: %w", err)
	}

	return len(sessions), nil
}

// ManualCleanup triggers an immediate cleanup (useful for admin operations)
func (s *SessionExpirationService) ManualCleanup(ctx context.Context) (int, error) {
	return s.archiveExpiredSessions(ctx)
}

// GetStatus returns the current status of the service
type ServiceStatus struct {
	IsRunning             bool
	TTLDays               int
	CheckInterval         time.Duration
	ExpiringSessionsCount int
	LastCleanup           *time.Time
	Error                 error
}

// Status returns detailed status information about the service
func (s *SessionExpirationService) Status(ctx context.Context) ServiceStatus {
	s.mu.Lock()
	defer s.mu.Unlock()

	status := ServiceStatus{
		IsRunning:     s.isRunning,
		TTLDays:       s.ttlDays,
		CheckInterval: s.checkInterval,
	}

	// Try to get count of expiring sessions
	count, err := s.GetExpiredSessionsCount(ctx)
	if err != nil {
		status.Error = err
	} else {
		status.ExpiringSessionsCount = count
	}

	return status
}

// SessionExpirationStats provides statistics about session expiration
type SessionExpirationStats struct {
	TotalSessions      int
	ArchivedSessions   int
	ActiveSessions     int
	ExpiringSoon       int // Sessions expiring within 7 days
	AlreadyExpired     int // Sessions past expiration date but not archived
	OldestActiveSesion *time.Time
	AverageSessionAge  time.Duration
}

// GetStatistics returns detailed statistics about session expiration
// Useful for monitoring and dashboards
func (s *SessionExpirationService) GetStatistics(ctx context.Context) (*SessionExpirationStats, error) {
	queries := db.New(s.db)

	// This would require additional database queries
	// For now, provide a simplified version
	stats := &SessionExpirationStats{
		TotalSessions:    0,
		ArchivedSessions: 0,
		ActiveSessions:   0,
		ExpiringSoon:     0,
		AlreadyExpired:   0,
	}

	// Get expired sessions count
	expiredSessions, err := queries.GetExpiredSessions(ctx, 100000)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to get statistics: %w", err)
	}

	stats.AlreadyExpired = len(expiredSessions)

	return stats, nil
}

// SessionCleanupConfig holds configuration for session cleanup
// Can be extended for more granular control
type SessionCleanupConfig struct {
	TTLDays        int           // Time-to-live in days
	CheckInterval  time.Duration // Cleanup check interval
	BatchSize      int           // Max sessions to process per cleanup run
	TimeoutSeconds int           // Timeout for cleanup operations
	Enabled        bool          // Whether cleanup is enabled
}

// NewSessionCleanupConfig creates a config with sensible defaults
func NewSessionCleanupConfig() SessionCleanupConfig {
	return SessionCleanupConfig{
		TTLDays:        30,
		CheckInterval:  24 * time.Hour,
		BatchSize:      1000,
		TimeoutSeconds: 30,
		Enabled:        true,
	}
}

// RecycleExpiredSessionsData provides detailed info about cleanup results
type RecycleExpiredSessionsData struct {
	ArchivedCount    int
	FailedCount      int
	DurationMs       int64
	ExpirationCutoff time.Time
	ProcessedAt      time.Time
}

// RecycleExpiredSessions is a high-level function that archives expired sessions
// and returns detailed results
func (s *SessionExpirationService) RecycleExpiredSessions(ctx context.Context) (*RecycleExpiredSessionsData, error) {
	startTime := time.Now()

	result := &RecycleExpiredSessionsData{
		ProcessedAt:      startTime,
		ExpirationCutoff: startTime,
	}

	archivedCount, err := s.archiveExpiredSessions(ctx)
	if err != nil {
		return result, err
	}

	result.ArchivedCount = archivedCount
	result.DurationMs = time.Since(startTime).Milliseconds()

	return result, nil
}
