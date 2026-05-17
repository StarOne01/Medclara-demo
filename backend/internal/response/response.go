// Package response provides standardized HTTP response utilities.
// This implements the Single Responsibility Principle (SRP) by centralizing
// response formatting logic.
package response

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// =============================================================================
// RESPONSE STRUCTURES
// =============================================================================

// APIResponse is the standard API response format
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *ErrorInfo  `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// ErrorInfo contains error details
type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Meta contains response metadata
type Meta struct {
	Total     int       `json:"total,omitempty"`
	Limit     int       `json:"limit,omitempty"`
	Offset    int       `json:"offset,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// PaginatedResponse is used for paginated list responses
type PaginatedResponse struct {
	Items  interface{} `json:"items"`
	Total  int         `json:"total"`
	Limit  int32       `json:"limit"`
	Offset int32       `json:"offset"`
}

// =============================================================================
// SUCCESS RESPONSES
// =============================================================================

// OK sends a 200 OK response with data
func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, data)
}

// Created sends a 201 Created response with data
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, data)
}

// NoContent sends a 204 No Content response
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// Paginated sends a paginated list response
func Paginated(c *gin.Context, items interface{}, total int, limit, offset int32) {
	c.JSON(http.StatusOK, PaginatedResponse{
		Items:  items,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// =============================================================================
// ERROR RESPONSES
// =============================================================================

// Error sends an error response with the given status code
func Error(c *gin.Context, statusCode int, code, message string) {
	c.JSON(statusCode, gin.H{
		"error":   code,
		"message": message,
	})
}

// BadRequest sends a 400 Bad Request response
func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, "invalid_request", message)
}

// Unauthorized sends a 401 Unauthorized response
func Unauthorized(c *gin.Context, message string) {
	if message == "" {
		message = "Authentication required"
	}
	Error(c, http.StatusUnauthorized, "unauthorized", message)
}

// Forbidden sends a 403 Forbidden response
func Forbidden(c *gin.Context, message string) {
	if message == "" {
		message = "Access denied"
	}
	Error(c, http.StatusForbidden, "forbidden", message)
}

// NotFound sends a 404 Not Found response
func NotFound(c *gin.Context, resource string) {
	Error(c, http.StatusNotFound, "not_found", resource+" not found")
}

// Conflict sends a 409 Conflict response
func Conflict(c *gin.Context, message string) {
	Error(c, http.StatusConflict, "conflict", message)
}

// Gone sends a 410 Gone response
func Gone(c *gin.Context, message string) {
	Error(c, http.StatusGone, "expired", message)
}

// TooLarge sends a 413 Request Entity Too Large response
func TooLarge(c *gin.Context, message string) {
	Error(c, http.StatusRequestEntityTooLarge, "file_too_large", message)
}

// InternalError sends a 500 Internal Server Error response
func InternalError(c *gin.Context, message string) {
	if message == "" {
		message = "An internal error occurred"
	}
	Error(c, http.StatusInternalServerError, "internal_error", message)
}

// DatabaseError sends a 500 error for database failures
func DatabaseError(c *gin.Context, operation string) {
	Error(c, http.StatusInternalServerError, "database_error", "Database error during "+operation)
}

// ProcessingError sends a 500 error for processing failures
func ProcessingError(c *gin.Context, operation string) {
	Error(c, http.StatusInternalServerError, "processing_failed", "Failed to "+operation)
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// FormatNullTime formats a sql.NullTime for JSON responses
func FormatNullTime(t sql.NullTime) interface{} {
	if t.Valid {
		return t.Time.Format(time.RFC3339)
	}
	return nil
}

// FormatNullString formats a sql.NullString for JSON responses
func FormatNullString(s sql.NullString) interface{} {
	if s.Valid {
		return s.String
	}
	return nil
}

// FormatNullInt32 formats a sql.NullInt32 for JSON responses
func FormatNullInt32(i sql.NullInt32) interface{} {
	if i.Valid {
		return i.Int32
	}
	return nil
}

// FormatNullBool formats a sql.NullBool for JSON responses
func FormatNullBool(b sql.NullBool) interface{} {
	if b.Valid {
		return b.Bool
	}
	return nil
}
