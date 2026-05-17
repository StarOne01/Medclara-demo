package controller

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/StarOne01/Medclara-backend.git/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateSessionHandler creates a new scribe session
// POST /api/sessions
func CreateSessionHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		var req struct {
			SessionID        string                 `json:"sessionId"` // Optional - will generate if not provided
			TemplateID       string                 `json:"templateId" binding:"required"`
			InitialPatientID *string                `json:"initialPatientId"`
			Metadata         map[string]interface{} `json:"metadata"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "templateId is required",
			})
			return
		}

		// Generate a unique session_id if not provided by frontend
		if req.SessionID == "" {
			req.SessionID = uuid.New().String()
		}

		// Parse template ID
		templateID, err := uuid.Parse(req.TemplateID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid templateId format",
			})
			return
		}

		// Parse initial patient ID if provided
		var initialPatientID *uuid.UUID
		if req.InitialPatientID != nil && *req.InitialPatientID != "" {
			pID, err := uuid.Parse(*req.InitialPatientID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_request",
					"message": "Invalid initialPatientId format",
				})
				return
			}
			initialPatientID = &pID
		}

		// Create session
		svc := service.NewScribeSessionService(dbConn)
		session, err := svc.CreateSession(c.Request.Context(), service.CreateSessionInput{
			SessionID:        req.SessionID,
			UserID:           userID,
			TemplateID:       templateID,
			InitialPatientID: initialPatientID,
			Metadata:         req.Metadata,
		})
		if err != nil {
			log.Printf("Error creating session: %v", err)
			fmt.Printf("%v\n", templateID)

			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"sessionId":  session.SessionID,
			"status":     session.Status,
			"createdAt":  formatNullTime(session.CreatedAt),
			"templateId": session.TemplateID.String(),
		})
	}
}

// GetSessionHandler retrieves comprehensive session data
// GET /api/sessions/{sessionId}
func GetSessionHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		sessionID := c.Param("sessionId")
		if sessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Session ID is required",
			})
			return
		}

		svc := service.NewScribeSessionService(dbConn)
		sessionData, err := svc.GetSessionData(c.Request.Context(), sessionID, userID)

		if err != nil {
			if err.Error() == "session not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": err.Error(),
				})
				return
			}
			if err.Error() == "access denied" {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "forbidden",
					"message": err.Error(),
				})
				return
			}
			log.Printf("Error retrieving session: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "server_error",
				"message": "Failed to retrieve session",
			})
			return
		}

		c.JSON(http.StatusOK, sessionData)
	}
}

// UpdateSessionNoteSectionHandler updates a note section within a session
// PATCH /api/sessions/{sessionId}/note-sections/{sectionKey}
func UpdateSessionNoteSectionHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		sessionID := c.Param("sessionId")
		sectionKey := c.Param("sectionKey")

		if sessionID == "" || sectionKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Session ID and section key are required",
			})
			return
		}

		var req struct {
			Content     string  `json:"content" binding:"required"`
			EncounterID *string `json:"encounterId"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Content is required",
			})
			return
		}

		svc := service.NewScribeSessionService(dbConn)
		result, err := svc.UpdateNoteSection(c.Request.Context(), service.UpdateNoteSectionInput{
			SessionID:   sessionID,
			SectionKey:  sectionKey,
			Content:     req.Content,
			EncounterID: req.EncounterID,
			UserID:      userID,
		})

		if err != nil {
			if err.Error() == "session not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": err.Error(),
				})
				return
			}
			if err.Error() == "access denied" {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "forbidden",
					"message": err.Error(),
				})
				return
			}
			log.Printf("Error updating note section: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

// BindPatientHandler binds a patient to a session
// POST /api/sessions/{sessionId}/patient
func BindPatientHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		sessionID := c.Param("sessionId")
		if sessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Session ID is required",
			})
			return
		}

		var req struct {
			PatientID   string  `json:"patientId" binding:"required"`
			EncounterID *string `json:"encounterId"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "patientId is required",
			})
			return
		}

		// Parse patient ID
		patientID, err := uuid.Parse(req.PatientID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid patientId format",
			})
			return
		}

		// Parse encounter ID if provided
		var encounterID *uuid.UUID
		if req.EncounterID != nil && *req.EncounterID != "" {
			eID, err := uuid.Parse(*req.EncounterID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_request",
					"message": "Invalid encounterId format",
				})
				return
			}
			encounterID = &eID
		}

		svc := service.NewScribeSessionService(dbConn)
		result, err := svc.BindPatient(c.Request.Context(), service.BindPatientInput{
			SessionID:   sessionID,
			PatientID:   patientID,
			EncounterID: encounterID,
			UserID:      userID,
		})

		if err != nil {
			if err.Error() == "session not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": err.Error(),
				})
				return
			}
			if err.Error() == "access denied" {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "forbidden",
					"message": err.Error(),
				})
				return
			}
			log.Printf("Error binding patient: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

// GetSessionWithFiltersHandler retrieves session data with optional filters
// GET /api/sessions/{sessionId}?patient_id=X&encounter_id=Y&include_metadata=true
func GetSessionWithFiltersHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		sessionID := c.Param("sessionId")
		if sessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Session ID is required",
			})
			return
		}

		// Get base session data
		svc := service.NewScribeSessionService(dbConn)
		sessionData, err := svc.GetSessionData(c.Request.Context(), sessionID, userID)

		if err != nil {
			if err.Error() == "session not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": err.Error(),
				})
				return
			}
			if err.Error() == "access denied" {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "forbidden",
					"message": err.Error(),
				})
				return
			}
			log.Printf("Error retrieving session: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "server_error",
				"message": "Failed to retrieve session",
			})
			return
		}

		// Apply optional filters
		if patientIDFilter := c.Query("patient_id"); patientIDFilter != "" {
			if patient, ok := sessionData["patient"].(map[string]interface{}); ok {
				if patient["id"] != patientIDFilter {
					// Session doesn't match filter
					c.JSON(http.StatusNotFound, gin.H{
						"error":   "not_found",
						"message": "Session does not match filter criteria",
					})
					return
				}
			} else {
				// No patient linked to session
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Session does not have patient linked",
				})
				return
			}
		}

		if encounterIDFilter := c.Query("encounter_id"); encounterIDFilter != "" {
			if encounter, ok := sessionData["encounter"].(map[string]interface{}); ok {
				if encounter["id"] != encounterIDFilter {
					// Session doesn't match filter
					c.JSON(http.StatusNotFound, gin.H{
						"error":   "not_found",
						"message": "Session does not match filter criteria",
					})
					return
				}
			} else {
				// No encounter linked to session
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Session does not have encounter linked",
				})
				return
			}
		}

		// Include metadata if requested
		includeMetadata := c.Query("include_metadata")
		if includeMetadata != "true" {
			// Remove metadata from response by default
			delete(sessionData, "metadata")
		}

		// Include full transcript if requested
		includeTranscript := c.Query("include_transcript")
		if includeTranscript != "true" {
			// Truncate or remove transcript
			if recordings, ok := sessionData["recordings"].([]map[string]interface{}); ok {
				for _, rec := range recordings {
					delete(rec, "transcription")
				}
			}
		}

		c.JSON(http.StatusOK, sessionData)
	}
}

// ListSessionsHandler lists all sessions for the authenticated user
// GET /api/sessions?limit=10&offset=0
func ListSessionsHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		// Get pagination params
		limit := int32(10)
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.ParseInt(limitStr, 10, 32); err == nil {
				limit = int32(l)
			}
		}

		offset := int32(0)
		if offsetStr := c.Query("offset"); offsetStr != "" {
			if o, err := strconv.ParseInt(offsetStr, 10, 32); err == nil {
				offset = int32(o)
			}
		}

		svc := service.NewScribeSessionService(dbConn)
		sessions, err := svc.ListUserSessions(c.Request.Context(), userID, limit, offset)

		if err != nil {
			log.Printf("Error listing sessions: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "server_error",
				"message": "Failed to list sessions",
			})
			return
		}

		// Format response
		var sessionsList []map[string]interface{}
		for _, session := range sessions {
			sessionsList = append(sessionsList, map[string]interface{}{
				"sessionId":   session.SessionID,
				"status":      session.Status,
				"patientId":   session.PatientID,
				"encounterId": session.EncounterID,
				"templateId":  session.TemplateID.String(),
				"createdAt":   formatNullTime(session.CreatedAt),
				"updatedAt":   formatNullTime(session.UpdatedAt),
				"expiresAt":   formatNullTime(session.ExpiresAt),
			})
		}

		c.JSON(http.StatusOK, gin.H{
			"sessions": sessionsList,
			"limit":    limit,
			"offset":   offset,
		})
	}
}
