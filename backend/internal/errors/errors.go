// Package errors provides standardized error types and handling for the application.
// This implements the Single Responsibility Principle (SRP) by centralizing
// error definition and handling logic.
package errors

import (
	"errors"
	"fmt"
	"net/http"
)

// =============================================================================
// ERROR TYPES
// =============================================================================

// AppError represents an application-level error with HTTP status and code
type AppError struct {
	// StatusCode is the HTTP status code
	StatusCode int `json:"-"`
	// Code is a machine-readable error code
	Code string `json:"error"`
	// Message is a human-readable error message
	Message string `json:"message"`
	// Err is the underlying error (not exposed in JSON)
	Err error `json:"-"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (%v)", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the underlying error for errors.Is/As support
func (e *AppError) Unwrap() error {
	return e.Err
}

// =============================================================================
// ERROR CONSTRUCTORS
// =============================================================================

// New creates a new AppError
func New(statusCode int, code, message string) *AppError {
	return &AppError{
		StatusCode: statusCode,
		Code:       code,
		Message:    message,
	}
}

// Wrap wraps an existing error with application context
func Wrap(err error, statusCode int, code, message string) *AppError {
	return &AppError{
		StatusCode: statusCode,
		Code:       code,
		Message:    message,
		Err:        err,
	}
}

// =============================================================================
// COMMON ERROR FACTORIES
// =============================================================================

// NotFound creates a 404 Not Found error
func NotFound(resource string) *AppError {
	return &AppError{
		StatusCode: http.StatusNotFound,
		Code:       "not_found",
		Message:    fmt.Sprintf("%s not found", resource),
	}
}

// NotFoundWithErr creates a 404 Not Found error with underlying error
func NotFoundWithErr(resource string, err error) *AppError {
	return &AppError{
		StatusCode: http.StatusNotFound,
		Code:       "not_found",
		Message:    fmt.Sprintf("%s not found", resource),
		Err:        err,
	}
}

// Unauthorized creates a 401 Unauthorized error
func Unauthorized(message string) *AppError {
	if message == "" {
		message = "Authentication required"
	}
	return &AppError{
		StatusCode: http.StatusUnauthorized,
		Code:       "unauthorized",
		Message:    message,
	}
}

// Forbidden creates a 403 Forbidden error
func Forbidden(message string) *AppError {
	if message == "" {
		message = "Access denied"
	}
	return &AppError{
		StatusCode: http.StatusForbidden,
		Code:       "forbidden",
		Message:    message,
	}
}

// BadRequest creates a 400 Bad Request error
func BadRequest(message string) *AppError {
	return &AppError{
		StatusCode: http.StatusBadRequest,
		Code:       "invalid_request",
		Message:    message,
	}
}

// ValidationError creates a 400 Bad Request error for validation failures
func ValidationError(field, message string) *AppError {
	return &AppError{
		StatusCode: http.StatusBadRequest,
		Code:       "validation_error",
		Message:    fmt.Sprintf("%s: %s", field, message),
	}
}

// InternalError creates a 500 Internal Server Error
func InternalError(message string, err error) *AppError {
	if message == "" {
		message = "An internal error occurred"
	}
	return &AppError{
		StatusCode: http.StatusInternalServerError,
		Code:       "internal_error",
		Message:    message,
		Err:        err,
	}
}

// DatabaseError creates a 500 error for database failures
func DatabaseError(operation string, err error) *AppError {
	return &AppError{
		StatusCode: http.StatusInternalServerError,
		Code:       "database_error",
		Message:    fmt.Sprintf("Database error during %s", operation),
		Err:        err,
	}
}

// ProcessingError creates a 500 error for processing failures
func ProcessingError(operation string, err error) *AppError {
	return &AppError{
		StatusCode: http.StatusInternalServerError,
		Code:       "processing_failed",
		Message:    fmt.Sprintf("Failed to %s", operation),
		Err:        err,
	}
}

// Conflict creates a 409 Conflict error
func Conflict(message string) *AppError {
	return &AppError{
		StatusCode: http.StatusConflict,
		Code:       "conflict",
		Message:    message,
	}
}

// TooLarge creates a 413 Request Entity Too Large error
func TooLarge(message string) *AppError {
	return &AppError{
		StatusCode: http.StatusRequestEntityTooLarge,
		Code:       "file_too_large",
		Message:    message,
	}
}

// Gone creates a 410 Gone error
func Gone(message string) *AppError {
	return &AppError{
		StatusCode: http.StatusGone,
		Code:       "expired",
		Message:    message,
	}
}

// =============================================================================
// ERROR CHECKING UTILITIES
// =============================================================================

// IsNotFound checks if an error is a not found error
func IsNotFound(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.StatusCode == http.StatusNotFound
	}
	return false
}

// IsUnauthorized checks if an error is an unauthorized error
func IsUnauthorized(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.StatusCode == http.StatusUnauthorized
	}
	return false
}

// IsForbidden checks if an error is a forbidden error
func IsForbidden(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.StatusCode == http.StatusForbidden
	}
	return false
}

// IsValidation checks if an error is a validation error
func IsValidation(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Code == "validation_error"
	}
	return false
}

// GetStatusCode returns the HTTP status code for an error
// Returns 500 for non-AppError types
func GetStatusCode(err error) int {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.StatusCode
	}
	return http.StatusInternalServerError
}

// ToResponse converts an error to a response map
func ToResponse(err error) (int, map[string]interface{}) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.StatusCode, map[string]interface{}{
			"error":   appErr.Code,
			"message": appErr.Message,
		}
	}

	// Default for non-AppError types
	return http.StatusInternalServerError, map[string]interface{}{
		"error":   "internal_error",
		"message": "An internal error occurred",
	}
}

// =============================================================================
// SENTINEL ERRORS (for errors.Is comparisons)
// =============================================================================

var (
	// ErrNotFound is a sentinel error for not found resources
	ErrNotFound = errors.New("resource not found")
	// ErrUnauthorized is a sentinel error for unauthorized access
	ErrUnauthorized = errors.New("unauthorized")
	// ErrForbidden is a sentinel error for forbidden access
	ErrForbidden = errors.New("forbidden")
	// ErrValidation is a sentinel error for validation failures
	ErrValidation = errors.New("validation error")
	// ErrConflict is a sentinel error for conflicts
	ErrConflict = errors.New("conflict")
	// ErrExpired is a sentinel error for expired resources
	ErrExpired = errors.New("resource expired")
)
