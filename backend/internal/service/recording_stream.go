package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/google/uuid"
)

// RecordingStreamService handles Server-Sent Events (SSE) for recording processing
type RecordingStreamService struct {
	queries        *db.Queries
	dbConn         *sql.DB
	organizationID uuid.UUID

	// Configuration
	pollInterval            time.Duration
	maxTimeout              time.Duration
	estimatedProcessingTime time.Duration
}

// NewRecordingStreamService creates a new SSE service
// DEPRECATED: Use NewRecordingStreamServiceWithOrg instead to ensure proper org-scoped queries
func NewRecordingStreamService(dbConn *sql.DB) *RecordingStreamService {
	return &RecordingStreamService{
		queries:                 db.New(dbConn),
		dbConn:                  dbConn,
		organizationID:          uuid.Nil, // Will cause queries to fail properly
		pollInterval:            500 * time.Millisecond,
		maxTimeout:              30 * time.Minute,
		estimatedProcessingTime: 15 * time.Second,
	}
}

// NewRecordingStreamServiceWithOrg creates a new SSE service with organization context
func NewRecordingStreamServiceWithOrg(dbConn *sql.DB, orgID uuid.UUID) *RecordingStreamService {
	return &RecordingStreamService{
		queries:                 db.New(dbConn),
		dbConn:                  dbConn,
		organizationID:          orgID,
		pollInterval:            500 * time.Millisecond,
		maxTimeout:              30 * time.Minute,
		estimatedProcessingTime: 15 * time.Second,
	}
}

// StreamRecordingProgress streams recording processing status via SSE
// This function is designed to be called from a Gin handler with ResponseWriter and Request
func (s *RecordingStreamService) StreamRecordingProgress(
	recordingIDStr string,
	writer http.ResponseWriter,
	req *http.Request,
) error {
	// Parse recording ID
	recordingID, err := uuid.Parse(recordingIDStr)
	if err != nil {
		return fmt.Errorf("invalid recording ID: %w", err)
	}

	// Check if recording exists
	ctx := req.Context()
	isValidOrg := s.organizationID != uuid.Nil
	recording, err := s.queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
		ID:             recordingID,
		OrganizationID: uuid.NullUUID{UUID: s.organizationID, Valid: isValidOrg},
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("recording not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Verify recording hasn't expired (check if older than 24 hours)
	if time.Since(recording.CreatedAt.Time) > 24*time.Hour {
		return fmt.Errorf("recording expired")
	}

	// Set SSE headers
	writer.Header().Set("Content-Type", "text/event-stream")
	writer.Header().Set("Cache-Control", "no-cache")
	writer.Header().Set("Connection", "keep-alive")
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	writer.Header().Set("X-Accel-Buffering", "no") // Disable buffering in nginx

	// Get HTTP flusher for streaming
	flusher, ok := writer.(http.Flusher)
	if !ok {
		return fmt.Errorf("HTTP streaming not supported")
	}

	// Send initial connection message
	s.sendSSEEvent(writer, flusher, models.RecordingStreamEvent{
		Status:      "connected",
		RecordingID: recordingIDStr,
		UpdatedAt:   time.Now(),
	})

	log.Printf("[SSE] Client connected for recording %s", recordingID)

	// Create progress calculator
	progressCalc := models.NewSSEProgressCalculator(
		recording.CreatedAt.Time,
		s.estimatedProcessingTime,
	)

	// Poll database for status updates
	ticker := time.NewTicker(s.pollInterval)
	defer ticker.Stop()

	timeout := time.After(s.maxTimeout)
	lastSentStatus := ""
	lastSentProgress := -1
	pollCount := 0

	for {
		select {
		case <-timeout:
			// Connection timeout - close gracefully
			log.Printf("[SSE] Timeout for recording %s", recordingID)
			s.sendSSEEvent(writer, flusher, models.RecordingStreamEvent{
				Status:      "timeout",
				Error:       "Processing timeout exceeded 30 minutes",
				RecordingID: recordingIDStr,
			})
			return fmt.Errorf("processing timeout")

		case <-ticker.C:
			pollCount++
			// Poll for status update
			recording, err := s.queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
				ID:             recordingID,
				OrganizationID: uuid.NullUUID{UUID: s.organizationID, Valid: isValidOrg},
			})
			if err != nil {
				if err == sql.ErrNoRows {
					log.Printf("[SSE] Recording not found: %s", recordingID)
					s.sendSSEEvent(writer, flusher, models.RecordingStreamEvent{
						Status:      "not_found",
						Error:       "Recording not found",
						RecordingID: recordingIDStr,
					})
					return fmt.Errorf("recording not found")
				}
				// Continue on transient errors
				log.Printf("[SSE] Poll #%d - Database error (continuing): %v", pollCount, err)
				continue
			}

			log.Printf("[SSE] Poll #%d - Recording %s status: %s", pollCount, recordingID, recording.Status)

			// Handle completion
			if recording.Status == "completed" {
				log.Printf("[SSE] ✅ Sent completion for recording %s (processing time: %dms)",
					recordingID, recording.ProcessingTimeMs.Int32)

				// Build completion event
				event := models.RecordingStreamEvent{
					Status:           "completed",
					RecordingID:      recordingIDStr,
					Progress:         100,
					ProcessingTimeMs: recording.ProcessingTimeMs.Int32,
					UpdatedAt:        recording.UpdatedAt.Time,
				}

				// Add transcription if available
				if recording.Transcription.Valid && recording.Transcription.String != "" {
					event.Transcription = recording.Transcription.String
				}

				// Parse analysis if available
				if recording.Analysis.Valid && len(recording.Analysis.RawMessage) > 0 {
					var analysis map[string]interface{}
					if err := json.Unmarshal(recording.Analysis.RawMessage, &analysis); err == nil {
						event.Analysis = analysis
					} else {
						log.Printf("[SSE] Warning: Failed to parse analysis JSON: %v", err)
					}
				}

				s.sendSSEEvent(writer, flusher, event)
				return nil
			}

			// Handle failure
			if recording.Status == "failed" {
				log.Printf("[SSE] Sent failure for recording %s: %s",
					recordingID, recording.ProcessingError.String)

				event := models.RecordingStreamEvent{
					Status:      "failed",
					RecordingID: recordingIDStr,
					UpdatedAt:   recording.UpdatedAt.Time,
				}

				if recording.ProcessingError.Valid {
					event.Error = recording.ProcessingError.String
				} else {
					event.Error = "Unknown processing error"
				}

				s.sendSSEEvent(writer, flusher, event)
				return fmt.Errorf("recording processing failed: %s", event.Error)
			}

			// Still processing - send progress update if status or progress changed
			if recording.Status == "processing" {
				progress := progressCalc.CalculateProgress()

				// Only send if progress changed or status changed
				if recording.Status != lastSentStatus || progress != lastSentProgress {
					lastSentStatus = recording.Status
					lastSentProgress = progress

					event := models.RecordingStreamEvent{
						Status:      "processing",
						Progress:    progress,
						RecordingID: recordingIDStr,
						Message:     getProgressMessage(progress),
						UpdatedAt:   recording.UpdatedAt.Time,
					}

					s.sendSSEEvent(writer, flusher, event)
				}
			}

		case <-ctx.Done():
			// Client disconnected
			log.Printf("[SSE] Client disconnected for recording %s", recordingID)
			return fmt.Errorf("client disconnected")
		}
	}
}

// sendSSEEvent writes an event to the HTTP response with proper SSE formatting
func (s *RecordingStreamService) sendSSEEvent(
	writer http.ResponseWriter,
	flusher http.Flusher,
	event interface{},
) error {
	// Marshal event to JSON
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[SSE] Failed to marshal event: %v", err)
		return err
	}

	// Write SSE formatted message
	// SSE format: data: {json}\n\n
	_, err = fmt.Fprintf(writer, "data: %s\n\n", string(data))
	if err != nil {
		log.Printf("[SSE] Failed to write event: %v", err)
		return err
	}

	// Flush to client
	flusher.Flush()
	return nil
}

// getProgressMessage returns a human-readable progress message
func getProgressMessage(progress int) string {
	switch {
	case progress < 10:
		return "Starting processing..."
	case progress < 30:
		return "Transcribing audio..."
	case progress < 60:
		return "Extracting clinical sections..."
	case progress < 85:
		return "Analyzing entities and relationships..."
	case progress < 100:
		return "Finalizing analysis..."
	default:
		return "Processing complete"
	}
}

// ValidateRecordingAccess checks if a recording exists and optionally verifies user ownership
func (s *RecordingStreamService) ValidateRecordingAccess(
	ctx context.Context,
	recordingID uuid.UUID,
	userID *uuid.UUID, // If nil, skip user ownership check
) (*db.GetRecordingByIDRow, error) {
	isValidOrg := s.organizationID != uuid.Nil
	recording, err := s.queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
		ID:             recordingID,
		OrganizationID: uuid.NullUUID{UUID: s.organizationID, Valid: isValidOrg},
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("recording not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Check user ownership if userID provided
	if userID != nil && recording.UserID != *userID {
		return nil, fmt.Errorf("unauthorized: user does not own this recording")
	}

	// Check if recording is expired (older than 24 hours)
	if time.Since(recording.CreatedAt.Time) > 24*time.Hour {
		return nil, fmt.Errorf("recording expired")
	}

	return &recording, nil
}

// SetPollInterval sets the polling interval for database checks
func (s *RecordingStreamService) SetPollInterval(interval time.Duration) {
	s.pollInterval = interval
}

// SetMaxTimeout sets the maximum timeout for streaming
func (s *RecordingStreamService) SetMaxTimeout(timeout time.Duration) {
	s.maxTimeout = timeout
}

// SetEstimatedProcessingTime sets the estimated processing time for progress calculation
func (s *RecordingStreamService) SetEstimatedProcessingTime(duration time.Duration) {
	s.estimatedProcessingTime = duration
}
