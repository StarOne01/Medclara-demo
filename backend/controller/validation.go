package controller

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// SessionIDValidator provides validation functions for scribe session identifiers
type SessionIDValidator struct {
	// Pattern for session ID format: scribe-{timestamp}-{random}
	pattern *regexp.Regexp
}

// NewSessionIDValidator creates a new session ID validator
func NewSessionIDValidator() *SessionIDValidator {
	// Pattern: scribe-{13-digit-timestamp}-{11-alphanumeric}
	pattern := regexp.MustCompile(`^scribe-\d{13}-[a-z0-9]{11}$`)
	return &SessionIDValidator{pattern: pattern}
}

// ValidateFormat checks if session ID matches the required format
// Format: scribe-{timestamp}-{random}
// Example: scribe-1729541234567-abc123def456
func (v *SessionIDValidator) ValidateFormat(sessionID string) error {
	if sessionID == "" {
		return fmt.Errorf("session_id cannot be empty")
	}

	if !v.pattern.MatchString(sessionID) {
		return fmt.Errorf("session_id must match pattern: scribe-{timestamp}-{random}")
	}

	return nil
}

// ValidateTimestamp extracts and validates the timestamp portion of the session ID
// Returns the timestamp as time.Time or error if invalid
func (v *SessionIDValidator) ValidateTimestamp(sessionID string) (time.Time, error) {
	if err := v.ValidateFormat(sessionID); err != nil {
		return time.Time{}, err
	}

	// Extract timestamp portion
	parts := strings.Split(sessionID, "-")
	if len(parts) != 3 {
		return time.Time{}, fmt.Errorf("invalid session_id format")
	}

	// Parse 13-digit millisecond timestamp
	timestampStr := parts[1]
	var timestampMs int64

	_, err := fmt.Sscanf(timestampStr, "%d", &timestampMs)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid timestamp in session_id: %w", err)
	}

	// Create timestamp
	timestamp := time.UnixMilli(timestampMs).UTC()

	// Validate timestamp is not in the future (within 5 second clock skew tolerance)
	now := time.Now().UTC()
	skewTolerance := 5 * time.Second

	if timestamp.After(now.Add(skewTolerance)) {
		return time.Time{}, fmt.Errorf("session_id timestamp is in the future")
	}

	// Validate timestamp is not too old (not older than 90 days)
	maxAge := 90 * 24 * time.Hour
	if now.Sub(timestamp) > maxAge {
		return time.Time{}, fmt.Errorf("session_id timestamp is too old (>90 days)")
	}

	return timestamp, nil
}

// ExtractTimestamp extracts the timestamp from a session ID without validation
func (v *SessionIDValidator) ExtractTimestamp(sessionID string) (int64, error) {
	parts := strings.Split(sessionID, "-")
	if len(parts) != 3 {
		return 0, fmt.Errorf("invalid session_id format")
	}

	var timestampMs int64
	_, err := fmt.Sscanf(parts[1], "%d", &timestampMs)
	if err != nil {
		return 0, fmt.Errorf("invalid timestamp: %w", err)
	}

	return timestampMs, nil
}

// ExtractRandom extracts the random portion of a session ID
func (v *SessionIDValidator) ExtractRandom(sessionID string) (string, error) {
	parts := strings.Split(sessionID, "-")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid session_id format")
	}

	randomPart := parts[2]
	if len(randomPart) != 11 {
		return "", fmt.Errorf("invalid random part length: expected 11, got %d", len(randomPart))
	}

	return randomPart, nil
}

// ValidateAndParse validates a session ID and returns extracted components
type SessionIDComponents struct {
	SessionID   string
	Timestamp   time.Time
	TimestampMs int64
	Random      string
}

// ParseAndValidate performs full validation and parsing of a session ID
func (v *SessionIDValidator) ParseAndValidate(sessionID string) (*SessionIDComponents, error) {
	// Check format
	if err := v.ValidateFormat(sessionID); err != nil {
		return nil, err
	}

	// Validate timestamp
	timestamp, err := v.ValidateTimestamp(sessionID)
	if err != nil {
		return nil, err
	}

	// Extract timestamp ms
	timestampMs, err := v.ExtractTimestamp(sessionID)
	if err != nil {
		return nil, err
	}

	// Extract random
	random, err := v.ExtractRandom(sessionID)
	if err != nil {
		return nil, err
	}

	return &SessionIDComponents{
		SessionID:   sessionID,
		Timestamp:   timestamp,
		TimestampMs: timestampMs,
		Random:      random,
	}, nil
}

// IsValid checks if a session ID is valid (convenience method)
func (v *SessionIDValidator) IsValid(sessionID string) bool {
	return v.ValidateFormat(sessionID) == nil
}

// ValidationError provides detailed validation error information
type ValidationError struct {
	Field   string
	Code    string
	Message string
	Details interface{}
}

// ValidateSessionIDRequest validates a session ID in the context of a request
// This is a higher-level validation that can be used in request handlers
func ValidateSessionIDRequest(sessionID string) *ValidationError {
	if sessionID == "" {
		return &ValidationError{
			Field:   "session_id",
			Code:    "required",
			Message: "session_id is required",
		}
	}

	validator := NewSessionIDValidator()

	if err := validator.ValidateFormat(sessionID); err != nil {
		return &ValidationError{
			Field:   "session_id",
			Code:    "invalid_format",
			Message: "session_id must match pattern: scribe-{timestamp}-{random}",
			Details: map[string]string{
				"example": "scribe-1729541234567-abc123def456",
				"format":  "scribe-{13-digit-ms-timestamp}-{11-alphanumeric}",
			},
		}
	}

	if _, err := validator.ValidateTimestamp(sessionID); err != nil {
		return &ValidationError{
			Field:   "session_id",
			Code:    "invalid_timestamp",
			Message: err.Error(),
		}
	}

	return nil
}
