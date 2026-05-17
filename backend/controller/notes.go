package controller

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/internal/service"
	"github.com/StarOne01/Medclara-backend.git/models"
)

// CreateNoteHandler creates a new note attached to a patient
// POST /api/notes
func CreateNoteHandler(dbConn *sql.DB) gin.HandlerFunc {
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

		// Get user's organization from context
		orgIDVal, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}
		userOrgID := orgIDVal.(uuid.UUID)

		var req models.CreateNoteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": err.Error(),
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		note, err := notesService.CreateNote(ctx, req.PatientID, userID.String(), userOrgID, &req)
		if err != nil {
			log.Printf("Error creating note: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "create_failed",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, note)
	}
}

// GetNoteHandler retrieves a note by ID with organization validation
// GET /api/notes/{noteId}
// CRITICAL FIX: Validates organization_id to prevent cross-org note access
func GetNoteHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noteID := c.Param("noteId")
		if noteID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Note ID is required",
			})
			return
		}

		// Get user's organization from context (set by AuthMiddleware)
		orgIDVal, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}

		// The middleware sets organizationID as uuid.UUID, use it directly
		userOrgID := orgIDVal.(uuid.UUID)

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		// Pass organization ID for validation
		note, err := notesService.GetNote(ctx, noteID, userOrgID)
		if err != nil {
			if err.Error() == "note not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Note not found",
				})
			} else {
				log.Printf("Error retrieving note: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "retrieval_failed",
					"message": err.Error(),
				})
			}
			return
		}

		c.JSON(http.StatusOK, note)
	}
}

// UpdateNoteHandler updates an existing note
// PUT /api/notes/{noteId}
func UpdateNoteHandler(dbConn *sql.DB) gin.HandlerFunc {
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

		// Get user's organization from context
		orgIDVal, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}
		userOrgID, ok := orgIDVal.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "Invalid user organization ID",
			})
			return
		}

		noteID := c.Param("noteId")
		if noteID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Note ID is required",
			})
			return
		}

		var req models.UpdateNoteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": err.Error(),
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		note, err := notesService.UpdateNote(ctx, noteID, userID.String(), userOrgID, &req)
		if err != nil {
			if err.Error() == "note not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Note not found",
				})
			} else {
				log.Printf("Error updating note: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "update_failed",
					"message": err.Error(),
				})
			}
			return
		}

		c.JSON(http.StatusOK, note)
	}
}

// GetPatientNotesHandler retrieves all notes for a patient with org validation
// Supports both:
// - GET /api/notes/patient/{patientId}?limit={limit}&offset={offset}
// - GET /api/notes?patientId={patientId}&limit={limit}&offset={offset}
// CRITICAL FIX: Validates organization_id to prevent cross-org note access
func GetPatientNotesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Try to get patientId from path parameter first, then from query parameter
		patientID := c.Param("patientId")
		if patientID == "" {
			patientID = c.Query("patientId")
		}

		if patientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Patient ID is required (use path parameter or patientId query parameter)",
			})
			return
		}

		// Get user's organization from context
		orgIDVal, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}
		userOrgID := orgIDVal.(uuid.UUID)

		// Parse pagination parameters
		limit := int32(20)
		if l := c.Query("limit"); l != "" {
			if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
				limit = int32(parsedLimit)
			}
		}

		offset := int32(0)
		if o := c.Query("offset"); o != "" {
			if parsedOffset, err := strconv.Atoi(o); err == nil && parsedOffset >= 0 {
				offset = int32(parsedOffset)
			}
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		notes, total, err := notesService.GetNotesByPatient(ctx, patientID, userOrgID, limit, offset)
		if err != nil {
			log.Printf("Error retrieving notes: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "retrieval_failed",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"notes":  notes,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		})
	}
}

// GetSessionNotesHandler retrieves all notes for a scribe session
// GET /api/sessions/{sessionId}/notes or GET /api/notes?scribe_page_id={sessionId}
func GetSessionNotesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Try to get sessionId from path parameter first, then from query parameter
		sessionID := c.Param("sessionId")
		if sessionID == "" {
			sessionID = c.Query("scribe_page_id")
		}

		if sessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Session ID is required (use scribe_page_id query parameter)",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		// Get notes by scribe_page_id (already converted to model notes by service)
		notes, err := notesService.GetNotesByScribePage(ctx, sessionID)
		if err != nil {
			log.Printf("Error retrieving session notes: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "retrieval_failed",
				"message": err.Error(),
			})
			return
		}

		if notes == nil {
			notes = []models.Note{}
		}

		c.JSON(http.StatusOK, gin.H{
			"notes": notes,
			"total": len(notes),
			"count": len(notes),
		})
	}
}

// GetRecordingNotesHandler retrieves all notes for a recording
// GET /api/recordings/{recordingId}/notes
func GetRecordingNotesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		recordingID := c.Param("recordingId")
		if recordingID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording ID is required",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		notes, err := notesService.GetNotesByRecording(ctx, recordingID)
		if err != nil {
			log.Printf("Error retrieving notes: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "retrieval_failed",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"notes": notes,
			"count": len(notes),
		})
	}
}

// GetScribePageNotesHandler retrieves all notes for a scribe page
// GET /api/scribe-pages/{scribePageId}/notes
func GetScribePageNotesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		scribePageID := c.Param("scribePageId")
		if scribePageID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Scribe page ID is required",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		notes, err := notesService.GetNotesByScribePage(ctx, scribePageID)
		if err != nil {
			log.Printf("Error retrieving notes: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "retrieval_failed",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"notes": notes,
			"count": len(notes),
		})
	}
}

// SignNoteHandler signs a note with org validation
// POST /api/notes/{noteId}/sign
// CRITICAL FIX: Validates organization_id to prevent cross-org access
func SignNoteHandler(dbConn *sql.DB) gin.HandlerFunc {
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

		// Get user's organization from context
		orgIDVal, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}
		userOrgID := orgIDVal.(uuid.UUID)

		noteID := c.Param("noteId")
		if noteID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Note ID is required",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		note, err := notesService.SignNote(ctx, noteID, userID.String(), userOrgID)
		if err != nil {
			if err.Error() == "note not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Note not found",
				})
			} else {
				log.Printf("Error signing note: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "sign_failed",
					"message": err.Error(),
				})
			}
			return
		}

		c.JSON(http.StatusOK, note)
	}
}

// UpdateNoteStatusHandler updates the status of a note with org validation
// PATCH /api/notes/{noteId}/status
// CRITICAL FIX: Validates organization_id to prevent cross-org access
func UpdateNoteStatusHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noteID := c.Param("noteId")
		if noteID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Note ID is required",
			})
			return
		}

		// Get user's organization from context
		orgIDVal, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}
		userOrgID := orgIDVal.(uuid.UUID)

		var req struct {
			Status string `json:"status" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": err.Error(),
			})
			return
		}

		// Validate status
		validStatuses := map[string]bool{
			"draft":     true,
			"completed": true,
			"signed":    true,
			"archived":  true,
		}
		if !validStatuses[req.Status] {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_status",
				"message": "Status must be: draft, completed, signed, or archived",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		note, err := notesService.UpdateNoteStatus(ctx, noteID, req.Status, userOrgID)
		if err != nil {
			if err.Error() == "note not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Note not found",
				})
			} else {
				log.Printf("Error updating note status: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "update_failed",
					"message": err.Error(),
				})
			}
			return
		}

		c.JSON(http.StatusOK, note)
	}
}

// DeleteNoteHandler deletes a note with org validation
// DELETE /api/notes/{noteId}
// CRITICAL FIX: Validates organization_id to prevent cross-org access
func DeleteNoteHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		noteID := c.Param("noteId")
		if noteID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Note ID is required",
			})
			return
		}

		// Get user's organization from context
		orgIDVal, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}
		userOrgID := orgIDVal.(uuid.UUID)

		queries := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queries, dbConn)

		err := notesService.DeleteNote(ctx, noteID, userOrgID)
		if err != nil {
			if err.Error() == "note not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Note not found",
				})
			} else {
				log.Printf("Error deleting note: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "delete_failed",
					"message": err.Error(),
				})
			}
			return
		}

		c.Status(http.StatusNoContent)
	}
}

// SearchNotesHandler searches for notes
// GET /api/patients/{patientId}/notes/search?q={query}&limit={limit}&offset={offset}
func SearchNotesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		patientID := c.Param("patientId")
		query := c.Query("q")
		if patientID == "" || query == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Patient ID and search query are required",
			})
			return
		}

		// Parse pagination parameters
		limit := int32(20)
		if l := c.Query("limit"); l != "" {
			if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
				limit = int32(parsedLimit)
			}
		}

		offset := int32(0)
		if o := c.Query("offset"); o != "" {
			if parsedOffset, err := strconv.Atoi(o); err == nil && parsedOffset >= 0 {
				offset = int32(parsedOffset)
			}
		}

		queriesDB := db.New(dbConn)
		ctx := c.Request.Context()
		notesService := service.NewNotesService(queriesDB, dbConn)

		notes, total, err := notesService.SearchNotes(ctx, patientID, query, limit, offset)
		if err != nil {
			log.Printf("Error searching notes: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "search_failed",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"notes":  notes,
			"total":  total,
			"limit":  limit,
			"offset": offset,
			"query":  query,
		})
	}
}

// GetEncounterNotesHandler retrieves all clinical notes for an encounter
// GET /api/encounters/{encounterId}/notes
func GetEncounterNotesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		encounterIDStr := c.Param("encounterId")
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

		notes, err := queries.GetClinicalNotesByEncounter(ctx, encounterID)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve notes",
			})
			return
		}

		var response []gin.H
		for _, note := range notes {
			var noteSections map[string]interface{}
			if len(note.Content) > 0 {
				_ = json.Unmarshal([]byte(note.Content), &noteSections)
			}

			resp := gin.H{
				"id":          note.ID.String(),
				"template_id": note.TemplateID.String(),
				"sections":    noteSections,
				"status":      note.Status,
				"created_at":  formatNullTime(note.CreatedAt),
				"updated_at":  formatNullTime(note.UpdatedAt),
			}
			response = append(response, resp)
		}

		c.JSON(http.StatusOK, gin.H{
			"notes": response,
			"total": len(response),
		})
	}
}
