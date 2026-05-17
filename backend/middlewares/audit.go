package middlewares

import (
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuditLogEntry represents an audit log entry for HIPAA compliance
type AuditLogEntry struct {
	Timestamp      time.Time
	RequestID      string
	UserID         string
	Method         string
	Path           string
	StatusCode     int
	ClientIP       string
	UserAgent      string
	ResponseTimeMs int64
	Action         string
	ResourceType   string
	ResourceID     string
	Details        string
}

// AuditLoggingMiddleware creates an audit logging middleware for HIPAA compliance
func AuditLoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Generate request ID for tracing
		requestID := uuid.New().String()
		c.Set("requestID", requestID)

		// Extract user information
		userID := ""
		if val, exists := c.Get("userID"); exists {
			userID = val.(uuid.UUID).String()
		}

		// Record start time
		startTime := time.Now()

		// Continue to next handler
		c.Next()

		// Calculate processing time
		endTime := time.Now()
		responseTimeMs := endTime.Sub(startTime).Milliseconds()

		// Determine action and resource from endpoint
		action, resourceType, resourceID := extractAuditInfo(c.Request.Method, c.Request.URL.Path, c)

		// Create audit log entry
		auditEntry := AuditLogEntry{
			Timestamp:      startTime,
			RequestID:      requestID,
			UserID:         userID,
			Method:         c.Request.Method,
			Path:           c.Request.URL.Path,
			StatusCode:     c.Writer.Status(),
			ClientIP:       c.ClientIP(),
			UserAgent:      c.Request.UserAgent(),
			ResponseTimeMs: responseTimeMs,
			Action:         action,
			ResourceType:   resourceType,
			ResourceID:     resourceID,
		}

		// Log to structured audit log
		logAuditEntry(auditEntry)
	}
}

// extractAuditInfo extracts action and resource information from the request
func extractAuditInfo(method, path string, c *gin.Context) (action, resourceType, resourceID string) {
	// Default values
	action = method
	resourceType = "unknown"
	resourceID = ""

	// Parse path to determine resource type and ID
	if len(path) > 1 {
		switch {
		case isAuthPath(path):
			resourceType = "authentication"
			if pathContains(path, "login") {
				action = "login"
			} else if pathContains(path, "logout") {
				action = "logout"
			} else if pathContains(path, "me") {
				action = "get_current_user"
			}

		case pathContains(path, "/api/templates"):
			resourceType = "template"
			if method == "POST" {
				action = "create"
			} else if method == "PUT" {
				action = "update"
			} else if method == "DELETE" {
				action = "delete"
			} else if method == "GET" {
				action = "retrieve"
			}
			resourceID = extractIDFromPath(path)

		case pathContains(path, "/api/recordings"):
			resourceType = "recording"
			if method == "POST" && pathContains(path, "upload") {
				action = "upload"
			} else if method == "GET" && pathContains(path, "status") {
				action = "get_status"
			} else if method == "GET" {
				action = "retrieve"
			} else if method == "DELETE" {
				action = "delete"
			}
			resourceID = extractIDFromPath(path)

		case pathContains(path, "/api/notes"):
			resourceType = "clinical_note"
			if method == "POST" {
				action = "create"
			} else if method == "GET" {
				action = "retrieve"
			} else if method == "PUT" {
				action = "update"
			}
			resourceID = extractIDFromPath(path)

		case pathContains(path, "/api/scribe-workspace"):
			resourceType = "scribe_workspace"
			if method == "PATCH" {
				action = "update_section"
			} else if method == "GET" {
				action = "retrieve"
			}

		case pathContains(path, "/api/patients"):
			resourceType = "patient"
			if method == "GET" {
				action = "retrieve"
			} else if method == "PUT" {
				action = "update"
			}
			resourceID = extractIDFromPath(path)
		}
	}

	return
}

// Helper functions
func isAuthPath(path string) bool {
	return pathContains(path, "/api/auth/")
}

func pathContains(path, substring string) bool {
	return len(path) >= len(substring) && (path == substring || path[:len(substring)] == substring || path[len(path)-len(substring):] == substring)
}

func extractIDFromPath(path string) string {
	// Simple extraction - split by / and get last part if it's a UUID-like string
	parts := len(path)
	if parts > 36 {
		potential := path[parts-36:]
		if isUUID(potential) {
			return potential
		}
	}
	return ""
}

func isUUID(s string) bool {
	// Simple UUID check (36 chars with hyphens)
	if len(s) != 36 {
		return false
	}
	// Check for UUID pattern (8-4-4-4-12)
	if s[8] != '-' || s[13] != '-' || s[18] != '-' || s[23] != '-' {
		return false
	}
	return true
}

// logAuditEntry logs audit entry in HIPAA-compliant format
func logAuditEntry(entry AuditLogEntry) {
	logLine := fmt.Sprintf(
		"[AUDIT] timestamp=%s request_id=%s user_id=%s action=%s resource_type=%s resource_id=%s method=%s path=%s status=%d client_ip=%s response_time_ms=%d",
		entry.Timestamp.Format(time.RFC3339Nano),
		entry.RequestID,
		entry.UserID,
		entry.Action,
		entry.ResourceType,
		entry.ResourceID,
		entry.Method,
		entry.Path,
		entry.StatusCode,
		entry.ClientIP,
		entry.ResponseTimeMs,
	)

	// Determine log level based on status code
	if entry.StatusCode >= 500 {
		log.Printf("ERROR: %s", logLine)
	} else if entry.StatusCode >= 400 {
		log.Printf("WARN: %s", logLine)
	} else {
		log.Printf("INFO: %s", logLine)
	}
}
