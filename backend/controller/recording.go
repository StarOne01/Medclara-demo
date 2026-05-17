package controller

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/StarOne01/Medclara-backend.git/config"
	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/internal/service"
	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

var _ = bytes.NewReader // Import used for creating io.Reader

var allowedAudioFormats = map[string]bool{
	"audio/webm": true,
	"audio/mpeg": true,
	"audio/wav":  true,
	"audio/ogg":  true,
	"audio/flac": true,
	"audio/amr":  true,
}

// UploadRecordingHandler processes audio recordings and performs AI analysis
// POST /api/recordings/upload
func UploadRecordingHandler(dbConn *sql.DB, cfg interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context (set by auth middleware)
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		// Parse form data
		file, err := c.FormFile("audio")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Audio file is required",
			})
			return
		}

		templateIDStr := c.PostForm("templateId")
		if templateIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Template ID is required",
			})
			return
		}

		patientIDStr := c.PostForm("patientId")
		encounterIDStr := c.PostForm("encounterId")
		scribePageIDStr := c.PostForm("scribePageId") // NEW: Optional scribe session ID

		// Validate audio file
		if err := validateAudioFile(file); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_audio_format",
				"message": err.Error(),
			})
			return
		}

		// Verify template exists (accept both UUID and template key)
		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Get user's organization for org validation
		user, err := queries.GetUserByID(ctx, userID)
		if err != nil {
			log.Printf("Failed to retrieve user: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve user",
			})
			return
		}
		userOrgID := user.OrganizationID.UUID

		// Resolve template ID - accept both UUID and template key string formats
		resolver := NewTemplateIDResolver(dbConn)
		templateID, err := resolver.ResolveTemplateID(ctx, templateIDStr)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_template",
					"message": "Template not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to verify template",
			})
			return
		}

		// Fetch template details
		template, err := queries.GetTemplateByID(ctx, templateID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_template",
					"message": "Template not found",
				})
				return
			}
			log.Printf("Database error fetching template: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to fetch template details",
			})
			return
		}

		// Read audio file content
		src, err := file.Open()
		if err != nil {
			log.Printf("Failed to open file: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "processing_failed",
				"message": "Failed to process audio file",
			})
			return
		}
		defer src.Close()

		audioData, err := io.ReadAll(src)
		if err != nil {
			log.Printf("Failed to read file: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "processing_failed",
				"message": "Failed to read audio file",
			})
			return
		}

		// Parse optional IDs
		var encounterID uuid.NullUUID
		var patientID uuid.NullUUID

		if encounterIDStr != "" {
			parsedID, err := uuid.Parse(encounterIDStr)
			if err == nil {
				encounterID = uuid.NullUUID{UUID: parsedID, Valid: true}
			}
		}
		if patientIDStr != "" {
			parsedID, err := uuid.Parse(patientIDStr)
			if err == nil {
				patientID = uuid.NullUUID{UUID: parsedID, Valid: true}
			}
		}

		// Verify encounter and patient exist if provided
		if encounterID.Valid {
			_, err := queries.GetEncounterByID(ctx, db.GetEncounterByIDParams{
				ID:             encounterID.UUID,
				OrganizationID: userOrgID,
			})
			if err != nil {
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{
						"error":   "invalid_request",
						"message": "Encounter not found",
					})
					return
				}
				log.Printf("Database error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "database_error",
					"message": "Failed to verify encounter",
				})
				return
			}
		}

		if patientID.Valid {
			_, err := queries.GetPatientByID(ctx, db.GetPatientByIDParams{
				ID:             patientID.UUID,
				OrganizationID: userOrgID,
			})
			if err != nil {
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{
						"error":   "invalid_request",
						"message": "Patient not found",
					})
					return
				}
				log.Printf("Database error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "database_error",
					"message": "Failed to verify patient",
				})
				return
			}
		}

		// Create recording record
		recordingRecord, err := queries.CreateRecordingWithScribePage(ctx, db.CreateRecordingWithScribePageParams{
			EncounterID:          encounterID,
			UserID:               userID,
			PatientID:            patientID,
			TemplateID:           templateID,
			AudioFileUrl:         sql.NullString{String: file.Filename, Valid: true},
			AudioDurationSeconds: sql.NullInt32{}, // Will be calculated during processing
			Status:               "processing",
			ScribePageID:         sql.NullString{String: scribePageIDStr, Valid: scribePageIDStr != ""}, // NEW: Store scribe session ID
			IsLinked:             sql.NullBool{Bool: false, Valid: true},                                // Will be set to true when patient is linked
		})
		if err != nil {
			log.Printf("Failed to create recording: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "processing_failed",
				"message": "Failed to create recording",
			})
			return
		}

		// Start background processing
		// Use config if it's available, otherwise use defaults
		var appConfig *config.Config
		if configPtr, ok := cfg.(*config.Config); ok {
			appConfig = configPtr
		}

		go processAudioInBackground(
			dbConn,
			recordingRecord.ID,
			audioData,
			file.Header.Get("Content-Type"),
			template.TemplateKey,
			patientID,
			userID,
			appConfig,
		)

		// Return response with recording details
		c.JSON(http.StatusOK, gin.H{
			"id":         recordingRecord.ID.String(),
			"status":     "processing",
			"message":    "Recording received and queued for processing",
			"created_at": formatNullTime(recordingRecord.CreatedAt),
		})
	}
}

// GetRecordingHandler retrieves recording details and analysis
// GET /api/recordings/{recordingId}
func GetRecordingHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		recordingIDStr := c.Param("recordingId")
		if recordingIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording ID is required",
			})
			return
		}

		recordingID, err := uuid.Parse(recordingIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid recording ID format",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Get user's organization for org validation
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)
		user, err := queries.GetUserByID(ctx, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "database_error",
			})
			return
		}
		userOrgID := user.OrganizationID.UUID

		recording, err := queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
			ID:             recordingID,
			OrganizationID: uuid.NullUUID{UUID: userOrgID, Valid: true},
		})
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Recording not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve recording",
			})
			return
		}

		response := gin.H{
			"id":          recording.ID.String(),
			"status":      recording.Status,
			"template_id": recording.TemplateID.String(),
			"user_id":     recording.UserID.String(),
			"created_at":  formatNullTime(recording.CreatedAt),
			"updated_at":  formatNullTime(recording.UpdatedAt),
		}

		// Add optional fields if available
		if recording.PatientID.Valid {
			response["patient_id"] = recording.PatientID.UUID.String()
		}

		if recording.EncounterID.Valid {
			response["encounter_id"] = recording.EncounterID.UUID.String()
		}

		if recording.ScribePageID.Valid {
			response["scribe_page_id"] = recording.ScribePageID.String
		}

		response["is_linked"] = recording.IsLinked.Bool

		if recording.LinkedAt.Valid {
			response["linked_at"] = recording.LinkedAt.Time
		}

		if recording.AudioFileUrl.Valid {
			response["audio_file_url"] = recording.AudioFileUrl.String
		}

		if recording.AudioDurationSeconds.Valid {
			response["audio_duration_seconds"] = recording.AudioDurationSeconds.Int32
		}

		if recording.ProcessingTimeMs.Valid {
			response["processing_time_ms"] = recording.ProcessingTimeMs.Int32
		}

		// Include full transcription if available
		if recording.Transcription.Valid && recording.Transcription.String != "" {
			response["transcription"] = recording.Transcription.String
		}

		// Include full analysis with all extracted data
		if recording.Analysis.Valid && len(recording.Analysis.RawMessage) > 0 {
			var analysis interface{}
			if err := json.Unmarshal(recording.Analysis.RawMessage, &analysis); err == nil {
				response["analysis"] = analysis
			} else {
				log.Printf("Warning: Failed to parse analysis JSON: %v", err)
			}
		}

		// Include error message if processing failed
		if recording.ProcessingError.Valid && recording.ProcessingError.String != "" {
			response["processing_error"] = recording.ProcessingError.String
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetRecordingTranscriptSegmentsHandler retrieves transcript segments for a recording
// GET /api/recordings/{recordingId}/segments
func GetRecordingTranscriptSegmentsHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		recordingIDStr := c.Param("recordingId")
		if recordingIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording ID is required",
			})
			return
		}

		recordingID, err := uuid.Parse(recordingIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid recording ID format",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Get user's organization for org validation
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		userID := userIDStr.(uuid.UUID)
		user, err := queries.GetUserByID(ctx, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error"})
			return
		}
		userOrgID := user.OrganizationID.UUID

		// Verify recording exists
		recording, err := queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
			ID:             recordingID,
			OrganizationID: uuid.NullUUID{UUID: userOrgID, Valid: true},
		})
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Recording not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve recording",
			})
			return
		}

		// Get transcript segments
		segments, err := queries.GetTranscriptSegmentsByRecording(ctx, recordingID)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve transcript segments",
			})
			return
		}

		// Convert to response format
		var segmentResponses []gin.H
		for _, segment := range segments {
			item := gin.H{
				"id":   segment.ID.String(),
				"text": segment.Text,
			}

			if segment.Speaker.Valid {
				item["speaker"] = segment.Speaker.String
			}

			// Convert NUMERIC fields from string back to float for JSON
			if segment.StartTimeSeconds.Valid {
				if val, err := strconv.ParseFloat(segment.StartTimeSeconds.String, 64); err == nil {
					item["start_time_seconds"] = val
				}
			}

			if segment.EndTimeSeconds.Valid {
				if val, err := strconv.ParseFloat(segment.EndTimeSeconds.String, 64); err == nil {
					item["end_time_seconds"] = val
				}
			}

			if segment.Confidence.Valid {
				if val, err := strconv.ParseFloat(segment.Confidence.String, 64); err == nil {
					item["confidence"] = val
				}
			}

			item["created_at"] = formatNullTime(segment.CreatedAt)

			segmentResponses = append(segmentResponses, item)
		}

		c.JSON(http.StatusOK, gin.H{
			"recording_id": recording.ID.String(),
			"status":       recording.Status,
			"segments":     segmentResponses,
			"count":        len(segmentResponses),
		})
	}
}

// GetRecordingStatusHandler retrieves the processing status of a recording
// GET /api/recordings/{recordingId}/status
func GetRecordingStatusHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		recordingIDStr := c.Param("recordingId")
		if recordingIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording ID is required",
			})
			return
		}

		recordingID, err := uuid.Parse(recordingIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid recording ID format",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Get user's organization for org validation
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		userID := userIDStr.(uuid.UUID)
		user, err := queries.GetUserByID(ctx, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error"})
			return
		}
		userOrgID := user.OrganizationID.UUID

		recording, err := queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
			ID:             recordingID,
			OrganizationID: uuid.NullUUID{UUID: userOrgID, Valid: true},
		})
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Recording not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve recording status",
			})
			return
		}

		// Calculate progress based on status
		progress := 0
		switch recording.Status {
		case "processing":
			// Estimate progress based on time elapsed
			elapsed := time.Since(recording.CreatedAt.Time)
			// Assume processing takes ~10 seconds for average recording
			progress = int((elapsed.Seconds() / 10.0) * 100)
			if progress > 95 {
				progress = 95 // Don't show 100% until actually complete
			}
		case "completed":
			progress = 100
		case "failed":
			progress = 0
		}

		response := gin.H{
			"id":         recording.ID.String(),
			"status":     recording.Status,
			"progress":   progress,
			"created_at": formatNullTime(recording.CreatedAt),
			"updated_at": formatNullTime(recording.UpdatedAt),
		}

		// Add error message if failed
		if recording.ProcessingError.Valid {
			response["error_message"] = recording.ProcessingError.String
		}

		// Add processing time if completed
		if recording.ProcessingTimeMs.Valid {
			response["processing_time_ms"] = recording.ProcessingTimeMs.Int32
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetRecordingStreamHandler streams recording completion via Server-Sent Events (SSE)
// GET /api/recordings/:recordingId/stream
func GetRecordingStreamHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		recordingIDStr := c.Param("recordingId")
		if recordingIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording ID is required",
			})
			return
		}

		// Parse and validate recording ID
		recordingID, err := uuid.Parse(recordingIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid recording ID format",
			})
			return
		}

		// Get user's organization for access control
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		// Get user to access their organization
		queries := db.New(dbConn)
		ctx := c.Request.Context()
		user, err := queries.GetUserByID(ctx, userID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error":   "unauthorized",
					"message": "User not found",
				})
				return
			}
			log.Printf("Failed to retrieve user for SSE: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve user",
			})
			return
		}

		// Create SSE service with user's organization
		streamService := service.NewRecordingStreamServiceWithOrg(dbConn, user.OrganizationID.UUID)

		// Validate recording access
		_, err = streamService.ValidateRecordingAccess(ctx, recordingID, &userID)
		if err != nil {
			if err.Error() == "recording not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Recording not found",
				})
				return
			}
			if err.Error() == "recording expired" {
				c.JSON(http.StatusGone, gin.H{
					"error":   "expired",
					"message": "Recording has expired (older than 24 hours)",
				})
				return
			}
			if err.Error() == "unauthorized: user does not own this recording" {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error":   "unauthorized",
					"message": "Cannot stream recording created by another user",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "error",
				"message": err.Error(),
			})
			return
		}

		// Stream recording progress via SSE
		err = streamService.StreamRecordingProgress(recordingIDStr, c.Writer, c.Request)
		if err != nil {
			// Errors at this point are logged but not sent to client (streaming already started)
			log.Printf("[SSE] Stream error for recording %s: %v", recordingID, err)
		}
	}
}

// GetRecordingsHandler retrieves recordings for an encounter
// GET /api/recordings?encounterId={encounterId}
func GetRecordingsHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		encounterIDStr := c.Query("encounterId")
		if encounterIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Encounter ID is required",
			})
			return
		}

		encounterID, err := uuid.Parse(encounterIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid encounter ID format",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		recordings, err := queries.GetRecordingsByEncounter(ctx, db.GetRecordingsByEncounterParams{
			EncounterID: uuid.NullUUID{UUID: encounterID, Valid: true},
			Limit:       100,
			Offset:      0,
		})
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve recordings",
			})
			return
		}

		var response []gin.H
		for _, recording := range recordings {
			item := gin.H{
				"id":         recording.ID.String(),
				"status":     recording.Status,
				"created_at": formatNullTime(recording.CreatedAt),
			}
			response = append(response, item)
		}

		c.JSON(http.StatusOK, gin.H{
			"recordings": response,
		})
	}
}

// DeleteRecordingHandler deletes a recording
// DELETE /api/recordings/{recordingId}
func DeleteRecordingHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		recordingIDStr := c.Param("recordingId")
		if recordingIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording ID is required",
			})
			return
		}

		recordingID, err := uuid.Parse(recordingIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid recording ID format",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		err = queries.DeleteRecording(ctx, recordingID)
		if err != nil {
			log.Printf("Failed to delete recording: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "processing_failed",
				"message": "Failed to delete recording",
			})
			return
		}

		c.Status(http.StatusNoContent)
	}
}

// LinkRecordingToPatientHandler links an unlinked recording to a patient
// PATCH /api/recordings/{recordingId}/link-patient
func LinkRecordingToPatientHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		recordingIDStr := c.Param("recordingId")
		if recordingIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording ID is required",
			})
			return
		}

		recordingID, err := uuid.Parse(recordingIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid recording ID format",
			})
			return
		}

		var req struct {
			PatientID   string  `json:"patient_id" binding:"required"`
			EncounterID *string `json:"encounter_id"`
			NoteID      *string `json:"note_id"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Patient ID is required",
			})
			return
		}

		patientID, err := uuid.Parse(req.PatientID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid patient ID format",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Get user's organization for org validation
		user, err := queries.GetUserByID(ctx, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error"})
			return
		}
		userOrgID := user.OrganizationID.UUID

		// Verify recording exists and belongs to user
		recording, err := queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
			ID:             recordingID,
			OrganizationID: uuid.NullUUID{UUID: userOrgID, Valid: true},
		})
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Recording not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve recording",
			})
			return
		}

		// Verify user ownership
		if recording.UserID != userID {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Cannot link recording created by another user",
			})
			return
		}

		// Check if already linked
		if recording.IsLinked.Valid && recording.IsLinked.Bool {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording already linked to a patient",
			})
			return
		}

		// Verify patient exists
		_, err = queries.GetPatientByID(ctx, db.GetPatientByIDParams{
			ID:             patientID,
			OrganizationID: userOrgID,
		})
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_request",
					"message": "Patient not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to verify patient",
			})
			return
		}

		// Parse optional encounter ID
		var encounterID uuid.NullUUID
		if req.EncounterID != nil && *req.EncounterID != "" {
			if parsed, err := uuid.Parse(*req.EncounterID); err == nil {
				encounterID = uuid.NullUUID{UUID: parsed, Valid: true}

				// Verify encounter exists
				_, err := queries.GetEncounterByID(ctx, db.GetEncounterByIDParams{
					ID:             parsed,
					OrganizationID: userOrgID,
				})
				if err != nil {
					if err == sql.ErrNoRows {
						c.JSON(http.StatusBadRequest, gin.H{
							"error":   "invalid_request",
							"message": "Encounter not found",
						})
						return
					}
					log.Printf("Database error: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"error":   "database_error",
						"message": "Failed to verify encounter",
					})
					return
				}
			}
		}

		// Link recording to patient
		now := time.Now()
		err = queries.LinkRecordingToPatient(ctx, db.LinkRecordingToPatientParams{
			PatientID:   uuid.NullUUID{UUID: patientID, Valid: true},
			EncounterID: encounterID,
			LinkedAt:    sql.NullTime{Time: now, Valid: true},
			UpdatedAt:   sql.NullTime{Time: now, Valid: true},
			ID:          recordingID,
			UserID:      userID,
		})

		if err != nil {
			log.Printf("Failed to link recording: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "processing_failed",
				"message": "Failed to link recording",
			})
			return
		}

		// If note ID provided, update note's recording_id
		if req.NoteID != nil && *req.NoteID != "" {
			// This would require updating the note, which would be handled by notes controller
			// For now, just log it
			log.Printf("Note update requested for note %s with recording %s", *req.NoteID, recordingID)
		}

		// Fetch updated recording
		updatedRecording, err := queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
			ID:             recordingID,
			OrganizationID: uuid.NullUUID{UUID: userOrgID, Valid: true},
		})
		if err != nil {
			log.Printf("Failed to fetch updated recording: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to fetch updated recording",
			})
			return
		}

		response := gin.H{
			"id":         updatedRecording.ID.String(),
			"status":     updatedRecording.Status,
			"is_linked":  updatedRecording.IsLinked.Bool,
			"linked_at":  formatNullTime(updatedRecording.LinkedAt),
			"updated_at": formatNullTime(updatedRecording.UpdatedAt),
		}

		if updatedRecording.PatientID.Valid {
			response["patient_id"] = updatedRecording.PatientID.UUID.String()
		}

		if updatedRecording.EncounterID.Valid {
			response["encounter_id"] = updatedRecording.EncounterID.UUID.String()
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetRecordingsBySessionHandler retrieves all recordings for a scribe session
// GET /api/recordings/session/{scribePageId}
func GetRecordingsBySessionHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		scribePageID := c.Param("scribePageId")
		if scribePageID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Scribe page ID is required",
			})
			return
		}

		// Parse query parameters
		limit := 20
		offset := 0

		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}

		if offsetStr := c.Query("offset"); offsetStr != "" {
			if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
				offset = o
			}
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Get recordings for session (only user's own recordings)
		recordings, err := queries.GetRecordingsByScribeSession(ctx, db.GetRecordingsByScribeSessionParams{
			ScribePageID: sql.NullString{String: scribePageID, Valid: true},
			UserID:       userID,
			Limit:        int32(limit),
			Offset:       int32(offset),
		})

		if err != nil && err != sql.ErrNoRows {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve recordings",
			})
			return
		}

		// Count linked and unlinked recordings
		linkedCount := 0
		unlinkedCount := 0
		var recordingResponses []gin.H

		for _, rec := range recordings {
			item := gin.H{
				"id":         rec.ID.String(),
				"status":     rec.Status,
				"is_linked":  rec.IsLinked.Bool,
				"created_at": formatNullTime(rec.CreatedAt),
			}

			if rec.PatientID.Valid {
				item["patient_id"] = rec.PatientID.UUID.String()
			}

			if rec.LinkedAt.Valid {
				item["linked_at"] = rec.LinkedAt.Time
			}

			if rec.AudioDurationSeconds.Valid {
				item["audio_duration_seconds"] = rec.AudioDurationSeconds.Int32
			}

			if rec.Transcription.Valid && rec.Transcription.String != "" {
				item["transcription"] = rec.Transcription.String
			}

			if rec.IsLinked.Bool {
				linkedCount++
			} else {
				unlinkedCount++
			}

			recordingResponses = append(recordingResponses, item)
		}

		c.JSON(http.StatusOK, gin.H{
			"scribe_page_id": scribePageID,
			"recordings":     recordingResponses,
			"total":          len(recordingResponses),
			"linked_count":   linkedCount,
			"unlinked_count": unlinkedCount,
			"limit":          limit,
			"offset":         offset,
		})
	}
}

// Helper functions

// formatBytes converts bytes to human-readable format
func formatBytes(bytes int64) string {
	const (
		KB = 1024
		MB = 1024 * KB
		GB = 1024 * MB
	)

	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.1f GB", float64(bytes)/float64(GB))
	case bytes >= MB:
		return fmt.Sprintf("%.1f MB", float64(bytes)/float64(MB))
	case bytes >= KB:
		return fmt.Sprintf("%.1f KB", float64(bytes)/float64(KB))
	default:
		return fmt.Sprintf("%d bytes", bytes)
	}
}

func validateAudioFile(file *multipart.FileHeader) error {
	// Check file size - use actual config value
	const maxSize = 1 * 1024 * 1024 * 1024 // 1GB for whole uploads
	if file.Size > maxSize {
		maxSizeStr := formatBytes(maxSize)
		receivedStr := formatBytes(file.Size)
		return fmt.Errorf("audio file exceeds maximum size of %s (received %s)", maxSizeStr, receivedStr)
	}

	if file.Size < 1024 { // 1KB minimum
		return fmt.Errorf("audio file must be at least 1KB")
	}

	// Check MIME type
	contentType := file.Header.Get("Content-Type")
	if !allowedAudioFormats[contentType] {
		return fmt.Errorf("unsupported audio format. supported formats: webm, mp3, wav, ogg, flac, amr")
	}

	return nil
}

// processAudioInBackground handles async audio processing
// It performs transcription and analysis using Vertex AI
func processAudioInBackground(
	dbConn *sql.DB,
	recordingID uuid.UUID,
	audioData []byte,
	contentType string,
	templateKey string,
	patientID uuid.NullUUID,
	userID uuid.UUID,
	appConfig *config.Config,
) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic in processAudioInBackground for recording %s: %v", recordingID, r)
			markRecordingFailed(dbConn, recordingID, fmt.Sprintf("Processing panic: %v", r))
		}
	}()

	queries := db.New(dbConn)
	ctx := context.Background()
	startTime := time.Now()

	// Get user's organization first (needed for GetRecordingByID query)
	user, err := queries.GetUserByID(ctx, userID)
	if err != nil {
		log.Printf("Failed to fetch user org: %v", err)
		markRecordingFailed(dbConn, recordingID, "Failed to fetch user organization")
		return
	}
	userOrgID := user.OrganizationID.UUID

	// Verify recording exists and belongs to the user's organization
	_, err = queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
		ID:             recordingID,
		OrganizationID: user.OrganizationID,
	})
	if err != nil {
		log.Printf("Failed to fetch recording: %v", err)
		markRecordingFailed(dbConn, recordingID, "Failed to fetch recording context")
		return
	}

	// Fetch patient data for context (if available)
	var patientData *models.PatientData
	if patientID.Valid {
		patient, err := queries.GetPatientByID(ctx, db.GetPatientByIDParams{
			ID:             patientID.UUID,
			OrganizationID: userOrgID,
		})
		if err == nil {
			var gender *string
			if patient.Gender.Valid {
				gender = &patient.Gender.String
			}
			patientData = &models.PatientData{
				ID:        patient.ID.String(),
				FirstName: patient.FirstName,
				LastName:  patient.LastName,
				Gender:    gender,
			}
		}
	}

	// Create default patient data if not provided
	if patientData == nil {
		log.Printf("No patient data provided for recording %s, using defaults", recordingID)
		patientData = &models.PatientData{
			FirstName: "Unknown",
			LastName:  "Patient",
		}
	}

	// Create Vertex AI service
	// The service constructor handles credential validation in production mode
	vertexService := service.NewVertexAIService(
		appConfig.GCPProjectID,
		appConfig.GCPLocation,
		appConfig.VertexAIModel,
		appConfig.VertexAIModelAdvanced,
		appConfig.VertexAIAPIKey,
		queries,
	)

	if vertexService == nil {
		log.Printf("Failed to create Vertex AI service for recording %s", recordingID)
		markRecordingFailed(dbConn, recordingID, "Failed to initialize processing service")
		return
	}

	// Process audio with Vertex AI
	analysis, err := vertexService.ProcessAudioRecording(
		ctx,
		bytes.NewReader(audioData),
		contentType,
		templateKey,
		patientData,
	)

	if err != nil {
		log.Printf("Audio processing failed for recording %s: %v", recordingID, err)
		markRecordingFailed(dbConn, recordingID, fmt.Sprintf("Processing error: %v", err))
		return
	}

	// Check if analysis is nil
	if analysis == nil {
		log.Printf("Audio processing returned nil analysis for recording %s", recordingID)
		markRecordingFailed(dbConn, recordingID, "Processing returned empty analysis")
		return
	}

	// Validate analysis has required fields
	if analysis.ExtractedSections == nil {
		log.Printf("Analysis missing extracted sections for recording %s, initializing empty map", recordingID)
		analysis.ExtractedSections = make(map[string]models.ExtractionSection)
	}

	if analysis.Entities == nil {
		log.Printf("Analysis missing entities slice for recording %s, initializing empty slice", recordingID)
		analysis.Entities = []models.Entity{}
	}

	// Prepare analysis JSON
	analysisJSON, err := json.Marshal(analysis)
	if err != nil {
		log.Printf("Failed to marshal analysis for recording %s: %v", recordingID, err)
		markRecordingFailed(dbConn, recordingID, "Failed to marshal analysis results")
		return
	}

	// Extract full transcription from analysis
	var transcription string
	if analysis.Transcription != nil && analysis.Transcription.FullText != "" {
		transcription = analysis.Transcription.FullText
	} else {
		// Fallback: generate from extracted sections
		transcription = service.GenerateFullTranscription(analysis)
	}

	// Get total duration from analysis metadata
	totalDurationSeconds := int(analysis.TranscriptionMetadata.TotalDurationSeconds)
	if totalDurationSeconds == 0 {
		totalDurationSeconds = 300 // Default 5 minutes
	}

	// Generate transcript segments from analysis
	transcriptSegments := service.GenerateTranscriptSegments(analysis, totalDurationSeconds)

	// If we have speaker segments from the API, use those instead
	if analysis.Transcription != nil && len(analysis.Transcription.SpeakerSegments) > 0 {
		// Convert API speaker segments to model format
		for _, apiSegment := range analysis.Transcription.SpeakerSegments {
			transcriptSegments = append(transcriptSegments, models.TranscriptSegment{
				ID:               uuid.New().String(),
				RecordingID:      recordingID.String(),
				Speaker:          &apiSegment.Speaker,
				Text:             apiSegment.Text,
				StartTimeSeconds: func(t int) *float64 { f := float64(t); return &f }(apiSegment.StartTime),
				EndTimeSeconds:   func(t int) *float64 { f := float64(t); return &f }(apiSegment.EndTime),
				Confidence:       nil,
			})
		}
		// Sort by start time
		sort.Slice(transcriptSegments, func(i, j int) bool {
			if transcriptSegments[i].StartTimeSeconds == nil || transcriptSegments[j].StartTimeSeconds == nil {
				return false
			}
			return *transcriptSegments[i].StartTimeSeconds < *transcriptSegments[j].StartTimeSeconds
		})
	}

	// Calculate processing time
	processingTimeMs := int32(time.Since(startTime).Milliseconds())

	// Update recording with analysis and transcription
	recordingAnalysis := pqtype.NullRawMessage{RawMessage: analysisJSON, Valid: true}
	now := time.Now()

	err = queries.UpdateRecordingAnalysis(ctx, db.UpdateRecordingAnalysisParams{
		Transcription:    sql.NullString{String: transcription, Valid: transcription != ""},
		Analysis:         recordingAnalysis,
		Status:           "completed",
		ProcessingTimeMs: sql.NullInt32{Int32: processingTimeMs, Valid: true},
		UpdatedAt:        sql.NullTime{Time: now, Valid: true},
		ID:               recordingID,
	})

	if err != nil {
		log.Printf("Failed to update recording %s with analysis: %v", recordingID, err)
		markRecordingFailed(dbConn, recordingID, "Failed to update recording with results")
		return
	}

	// Store transcript segments in database
	segmentCount := 0
	for _, segment := range transcriptSegments {
		// Convert float64 pointers to sql.NullString for storage
		var startTimeStr, endTimeStr, confidenceStr sql.NullString

		if segment.StartTimeSeconds != nil {
			startTimeStr = sql.NullString{String: fmt.Sprintf("%.2f", *segment.StartTimeSeconds), Valid: true}
		}
		if segment.EndTimeSeconds != nil {
			endTimeStr = sql.NullString{String: fmt.Sprintf("%.2f", *segment.EndTimeSeconds), Valid: true}
		}
		if segment.Confidence != nil {
			confidenceStr = sql.NullString{String: fmt.Sprintf("%.2f", *segment.Confidence), Valid: true}
		}

		_, err := queries.CreateTranscriptSegment(ctx, db.CreateTranscriptSegmentParams{
			RecordingID:      recordingID,
			Speaker:          sql.NullString{String: getStringValue(segment.Speaker, ""), Valid: segment.Speaker != nil},
			Text:             segment.Text,
			StartTimeSeconds: startTimeStr,
			EndTimeSeconds:   endTimeStr,
			Confidence:       confidenceStr,
		})

		if err != nil {
			log.Printf("Failed to create transcript segment %d for recording %s: %v", segmentCount, recordingID, err)
		} else {
			segmentCount++
		}
	}

	log.Printf("Successfully processed recording %s: %d segments stored, processing time: %d ms",
		recordingID, segmentCount, processingTimeMs)

	// Extract session ID from the recording if available (for note creation)
	recordingData, err := queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
		ID:             recordingID,
		OrganizationID: user.OrganizationID,
	})
	if err == nil && recordingData.ScribePageID.Valid {
		// Create a note with the extracted sections for the session
		extractedSections := make(map[string]interface{})
		if analysis.ExtractedSections != nil {
			for key, section := range analysis.ExtractedSections {
				extractedSections[key] = section.Content
			}
		}

		// Convert extracted sections to JSON for note content
		noteContent, err := json.Marshal(extractedSections)
		if err != nil {
			noteContent = analysisJSON // Fallback to full analysis if conversion fails
		}

		// Create note with session info
		noteReq := &models.CreateNoteRequest{
			Title:        fmt.Sprintf("Recording %s", recordingID.String()[:8]),
			Content:      string(noteContent),
			NoteType:     func(s string) *string { return &s }("scribe"),
			Status:       func(s string) *string { return &s }("completed"),
			ScribePageID: func(s string) *string { return &s }(recordingData.ScribePageID.String),
			RecordingID:  func(s string) *string { return &s }(recordingID.String()),
		}

		notesService := service.NewNotesService(queries, dbConn)
		_, err = notesService.CreateNote(ctx, "", userID.String(), user.OrganizationID.UUID, noteReq)
		if err != nil {
			log.Printf("⚠️  Warning: Failed to create note for recording %s: %v", recordingID, err)
			// Don't fail the whole operation - the recording is already processed
		} else {
			log.Printf("✅ Note created successfully for recording %s with session %s", recordingID, recordingData.ScribePageID.String)
		}
	}
}

// Helper function to safely get string from pointer
func getStringValue(s *string, defaultVal string) string {
	if s == nil {
		return defaultVal
	}
	return *s
}

// UploadWholeAudioHandler processes a complete audio file in a single request
// POST /api/recordings/whole
func UploadWholeAudioHandler(dbConn *sql.DB, cfg interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context (set by auth middleware)
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		// Parse form data
		file, err := c.FormFile("audio")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Audio file is required",
			})
			return
		}

		templateIDStr := c.PostForm("templateId")
		if templateIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Template ID is required",
			})
			return
		}

		patientIDStr := c.PostForm("patientId")
		encounterIDStr := c.PostForm("encounterId")
		sessionIDStr := c.PostForm("sessionId")

		// Validate audio file
		if err := validateAudioFile(file); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_audio_format",
				"message": err.Error(),
			})
			return
		}

		// Check file size (max 1GB)
		const maxFileSize = 1 * 1024 * 1024 * 1024 // 1GB
		if file.Size > maxFileSize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error":   "file_too_large",
				"message": fmt.Sprintf("File exceeds maximum size of 1GB (received %d bytes)", file.Size),
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Get user's organization for org validation
		user, err := queries.GetUserByID(ctx, userID)
		if err != nil {
			log.Printf("Failed to retrieve user: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve user",
			})
			return
		}
		userOrgID := user.OrganizationID.UUID

		// Resolve template ID - accept both UUID and template key string formats
		resolver := NewTemplateIDResolver(dbConn)
		templateID, err := resolver.ResolveTemplateID(ctx, templateIDStr)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_template",
					"message": "Template not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to verify template",
			})
			return
		}

		// Fetch template details
		template, err := queries.GetTemplateByID(ctx, templateID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_template",
					"message": "Template not found",
				})
				return
			}
			log.Printf("Database error fetching template: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to fetch template details",
			})
			return
		}

		// Parse and validate optional IDs
		var encounterID uuid.NullUUID
		var patientID uuid.NullUUID

		if encounterIDStr != "" {
			parsedID, err := uuid.Parse(encounterIDStr)
			if err == nil {
				encounterID = uuid.NullUUID{UUID: parsedID, Valid: true}
			}
		}
		if patientIDStr != "" {
			parsedID, err := uuid.Parse(patientIDStr)
			if err == nil {
				patientID = uuid.NullUUID{UUID: parsedID, Valid: true}
			}
		}

		// Verify encounter and patient exist if provided
		if encounterID.Valid {
			_, err := queries.GetEncounterByID(ctx, db.GetEncounterByIDParams{
				ID:             encounterID.UUID,
				OrganizationID: userOrgID,
			})
			if err != nil {
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{
						"error":   "invalid_request",
						"message": "Encounter not found",
					})
					return
				}
				log.Printf("Database error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "database_error",
					"message": "Failed to verify encounter",
				})
				return
			}
		}

		if patientID.Valid {
			_, err := queries.GetPatientByID(ctx, db.GetPatientByIDParams{
				ID:             patientID.UUID,
				OrganizationID: userOrgID,
			})
			if err != nil {
				if err == sql.ErrNoRows {
					c.JSON(http.StatusBadRequest, gin.H{
						"error":   "invalid_request",
						"message": "Patient not found",
					})
					return
				}
				log.Printf("Database error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "database_error",
					"message": "Failed to verify patient",
				})
				return
			}
		}

		// Read audio file content
		src, err := file.Open()
		if err != nil {
			log.Printf("Failed to open file: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "processing_failed",
				"message": "Failed to process audio file",
			})
			return
		}
		defer src.Close()

		audioData, err := io.ReadAll(src)
		if err != nil {
			log.Printf("Failed to read file: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "processing_failed",
				"message": "Failed to read audio file",
			})
			return
		}

		// Create recording record
		recordingRecord, err := queries.CreateRecordingWithScribePage(ctx, db.CreateRecordingWithScribePageParams{
			EncounterID:          encounterID,
			UserID:               userID,
			PatientID:            patientID,
			TemplateID:           templateID,
			AudioFileUrl:         sql.NullString{String: file.Filename, Valid: true},
			AudioDurationSeconds: sql.NullInt32{},
			Status:               "processing",
			ScribePageID:         sql.NullString{String: sessionIDStr, Valid: sessionIDStr != ""},
			IsLinked:             sql.NullBool{Bool: false, Valid: true},
		})
		if err != nil {
			log.Printf("Failed to create recording: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "processing_failed",
				"message": "Failed to create recording",
			})
			return
		}

		// Start background processing
		var appConfig *config.Config
		if configPtr, ok := cfg.(*config.Config); ok {
			appConfig = configPtr
		}

		go processAudioInBackground(
			dbConn,
			recordingRecord.ID,
			audioData,
			file.Header.Get("Content-Type"),
			template.TemplateKey,
			patientID,
			userID,
			appConfig,
		)

		// Return response compatible with chunked upload response format
		c.JSON(http.StatusOK, gin.H{
			"id":          recordingRecord.ID.String(),
			"recordingId": recordingRecord.ID.String(),
			"status":      "processing",
			"templateId":  templateIDStr,
			"patientId": func() interface{} {
				if patientID.Valid {
					return patientID.UUID.String()
				}
				return nil
			}(),
			"sessionId": func() interface{} {
				if sessionIDStr != "" {
					return sessionIDStr
				}
				return nil
			}(),
			"encounterId": func() interface{} {
				if encounterID.Valid {
					return encounterID.UUID.String()
				}
				return nil
			}(),
			"audioSize":  file.Size,
			"uploadedAt": time.Now(),
		})
	}
}

// markRecordingFailed updates a recording record with error status
func markRecordingFailed(dbConn *sql.DB, recordingID uuid.UUID, errorMsg string) {
	queries := db.New(dbConn)
	ctx := context.Background()
	now := time.Now()

	// Use UpdateRecordingError which takes different parameters
	// First, let's check what parameters it expects by using UpdateRecordingStatus as fallback
	err := queries.UpdateRecordingStatus(ctx, db.UpdateRecordingStatusParams{
		Status:    "failed",
		UpdatedAt: sql.NullTime{Time: now, Valid: true},
		ID:        recordingID,
	})

	if err != nil {
		log.Printf("Failed to mark recording %s as failed: %v", recordingID, err)
	}
}
