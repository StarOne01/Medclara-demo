package models

import (
	"encoding/json"
	"time"
)

// SSE (Server-Sent Events) related constants and types

// StreamEventType represents the type of SSE event
type StreamEventType string

const (
	// StreamEventConnected indicates a successful connection
	StreamEventConnected StreamEventType = "connected"

	// StreamEventProcessing indicates the recording is being processed
	StreamEventProcessing StreamEventType = "processing"

	// StreamEventCompleted indicates processing is complete
	StreamEventCompleted StreamEventType = "completed"

	// StreamEventFailed indicates processing failed
	StreamEventFailed StreamEventType = "failed"

	// StreamEventTimeout indicates the connection timed out
	StreamEventTimeout StreamEventType = "timeout"

	// StreamEventNotFound indicates the recording was not found
	StreamEventNotFound StreamEventType = "not_found"

	// StreamEventError indicates a server error
	StreamEventError StreamEventType = "error"
)

// RecordingStreamEvent is the base event structure sent via SSE
// This is what the client receives in event.data
type RecordingStreamEvent struct {
	Status      string    `json:"status"`             // "connected", "processing", "completed", "failed"
	Progress    int       `json:"progress,omitempty"` // 0-100, omitted if not applicable
	Message     string    `json:"message,omitempty"`  // Human-readable message
	RecordingID string    `json:"recordingId,omitempty"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`

	// Only present in completed events
	Transcription    string                 `json:"transcription,omitempty"`
	Analysis         map[string]interface{} `json:"analysis,omitempty"`
	ProcessingTimeMs int32                  `json:"processing_time_ms,omitempty"`

	// Only present in failed events
	Error string `json:"error,omitempty"`

	// Only present in error events
	ErrorCode string `json:"error_code,omitempty"`
}

// ProcessingStreamEvent represents an in-progress processing update
type ProcessingStreamEvent struct {
	Status      string    `json:"status"`
	Progress    int       `json:"progress"`
	Message     string    `json:"message"`
	RecordingID string    `json:"recordingId"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CompletedStreamEvent represents a successful processing completion
type CompletedStreamEvent struct {
	Status           string                 `json:"status"`
	RecordingID      string                 `json:"recordingId"`
	Transcription    string                 `json:"transcription"`
	Analysis         map[string]interface{} `json:"analysis"`
	ProcessingTimeMs int32                  `json:"processing_time_ms"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
}

// FailedStreamEvent represents a processing failure
type FailedStreamEvent struct {
	Status      string    `json:"status"`
	RecordingID string    `json:"recordingId"`
	Error       string    `json:"error"`
	Message     string    `json:"message,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ErrorStreamEvent represents an error that occurred
type ErrorStreamEvent struct {
	Status    string `json:"status"`
	Error     string `json:"error"`
	ErrorCode string `json:"error_code"`
	Message   string `json:"message,omitempty"`
}

// SSEProgressCalculator calculates progress based on elapsed time and processing status
type SSEProgressCalculator struct {
	startTime      time.Time
	estimatedTotal time.Duration
}

// NewSSEProgressCalculator creates a new progress calculator
// estimatedTotal is the expected time for processing (default 15 seconds for average)
func NewSSEProgressCalculator(startTime time.Time, estimatedTotal time.Duration) *SSEProgressCalculator {
	if estimatedTotal == 0 {
		estimatedTotal = 15 * time.Second
	}
	return &SSEProgressCalculator{
		startTime:      startTime,
		estimatedTotal: estimatedTotal,
	}
}

// CalculateProgress returns a progress percentage (0-95, capped to avoid showing 100% before completion)
func (c *SSEProgressCalculator) CalculateProgress() int {
	elapsed := time.Since(c.startTime)
	progress := int((elapsed.Seconds() / c.estimatedTotal.Seconds()) * 100)
	if progress > 95 {
		progress = 95
	}
	if progress < 0 {
		progress = 0
	}
	return progress
}

// ToJSON marshals the event to JSON
func (e *RecordingStreamEvent) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

// ToJSON marshals the event to JSON
func (e *ProcessingStreamEvent) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

// ToJSON marshals the event to JSON
func (e *CompletedStreamEvent) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

// ToJSON marshals the event to JSON
func (e *FailedStreamEvent) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}

// ToJSON marshals the event to JSON
func (e *ErrorStreamEvent) ToJSON() []byte {
	data, _ := json.Marshal(e)
	return data
}
