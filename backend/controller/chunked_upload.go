package controller

import (
	"context"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/StarOne01/Medclara-backend.git/internal/service"
	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// InitChunkedUploadHandler initializes a chunked upload session
// POST /api/recordings/chunked/init
func InitChunkedUploadHandler(chunkedUploadService *service.ChunkedUploadService) gin.HandlerFunc {
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

		// Parse request body
		var req models.ChunkedUploadInitRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid request body",
			})
			return
		}

		// Validate required fields
		if req.TemplateID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Missing required templateId",
			})
			return
		}

		log.Printf("[ChunkedUpload] Controller received templateId: '%s'", req.TemplateID)

		ctx := c.Request.Context()

		// Initialize upload session
		session, err := chunkedUploadService.InitializeUploadSession(
			ctx,
			req.TemplateID,
			req.PatientID,
			req.EncounterID,
			req.ScribeSessionID,
			userID.String(),
		)
		if err != nil {
			log.Printf("[ChunkedUpload] Init error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "server_error",
				"message": "Failed to initialize upload session",
			})
			return
		}

		log.Printf("[ChunkedUpload] Session initialized: %s", session.SessionID)

		c.JSON(http.StatusOK, models.ChunkedUploadInitResponse{
			SessionID:      session.SessionID,
			RecordingID:    session.RecordingID,
			CreatedAt:      session.CreatedAt,
			ExpiresAt:      session.ExpiresAt,
			ExpectedChunks: 0,
		})
	}
}

// UploadChunkHandler processes a single audio chunk
// POST /api/recordings/chunked/upload
func UploadChunkHandler(chunkedUploadService *service.ChunkedUploadService) gin.HandlerFunc {
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
		_ = userIDStr.(uuid.UUID) // Verify it's a UUID

		// Get form fields
		sessionID := c.PostForm("sessionId")
		chunkIndexStr := c.PostForm("chunkIndex")
		totalChunksStr := c.PostForm("totalChunks")
		isLastChunkStr := c.PostForm("isLastChunk")

		// Validate required fields
		if sessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Missing sessionId",
			})
			return
		}

		if chunkIndexStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Missing chunkIndex",
			})
			return
		}

		// Parse numeric fields
		chunkIndex, err := strconv.ParseInt(chunkIndexStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid chunkIndex",
			})
			return
		}

		// totalChunks is optional - if not provided, get it from session or use 0
		var totalChunks int64 = 0
		if totalChunksStr != "" {
			var parseErr error
			totalChunks, parseErr = strconv.ParseInt(totalChunksStr, 10, 32)
			if parseErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_request",
					"message": "Invalid totalChunks",
				})
				return
			}
		}

		isLastChunk := isLastChunkStr == "true"

		// Get chunk file
		file, err := c.FormFile("chunk")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Missing chunk data",
			})
			return
		}

		// Read chunk data
		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Failed to read chunk",
			})
			return
		}
		defer src.Close()

		chunkData, err := io.ReadAll(src)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Failed to read chunk data",
			})
			return
		}

		ctx := c.Request.Context()

		// Upload chunk
		response, err := chunkedUploadService.UploadChunk(
			ctx,
			sessionID,
			int32(chunkIndex),
			int32(totalChunks),
			isLastChunk,
			chunkData,
		)
		if err != nil {
			errMsg := err.Error()
			log.Printf("[ChunkedUpload] Upload error: %v", err)

			// Determine HTTP status based on error
			statusCode := http.StatusBadRequest
			if errMsg == "session expired" {
				statusCode = http.StatusBadRequest
			} else if errMsg == "session not found" {
				statusCode = http.StatusBadRequest
			} else if len(chunkData) > service.DefaultMaxChunkSize {
				statusCode = http.StatusRequestEntityTooLarge
				c.JSON(statusCode, gin.H{
					"error":   "chunk_too_large",
					"message": errMsg,
				})
				return
			}

			// Check if it's an order error
			if len(errMsg) > 18 && errMsg[:18] == "chunk order invalid" {
				c.JSON(http.StatusUnprocessableEntity, gin.H{
					"error":   "chunk_order_invalid",
					"message": errMsg,
				})
				return
			}

			c.JSON(statusCode, gin.H{
				"error":   "invalid_chunk",
				"message": errMsg,
			})
			return
		}

		log.Printf("[ChunkedUpload] Chunk %d/%d received for session %s", chunkIndex, totalChunks, sessionID)

		c.JSON(http.StatusOK, response)
	}
}

// FinalizeUploadHandler finalizes the upload and starts processing
// POST /api/recordings/chunked/finalize
func FinalizeUploadHandler(chunkedUploadService *service.ChunkedUploadService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context
		_, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}

		// Parse request body
		var req models.ChunkedUploadFinalizeRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid request body",
			})
			return
		}

		if req.SessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Missing sessionId",
			})
			return
		}

		// Finalize upload - use a background context to avoid request timeout
		bgCtx := context.Background()
		response, err := chunkedUploadService.FinalizeUploadSession(bgCtx, req.SessionID, req.TotalSize)
		if err != nil {
			errMsg := err.Error()
			log.Printf("[ChunkedUpload] Finalize error: %v", err)

			// Determine HTTP status based on error
			statusCode := http.StatusBadRequest
			if errMsg == "session not found" {
				statusCode = http.StatusBadRequest
			} else if errMsg == "session already finalized" {
				statusCode = http.StatusConflict
				c.JSON(statusCode, gin.H{
					"error":   "session_already_finalized",
					"message": errMsg,
				})
				return
			} else if len(errMsg) > 17 && errMsg[:17] == "incomplete upload" {
				statusCode = http.StatusBadRequest
				c.JSON(statusCode, gin.H{
					"error":   "incomplete_upload",
					"message": errMsg,
				})
				return
			}

			c.JSON(statusCode, gin.H{
				"error":   "server_error",
				"message": errMsg,
			})
			return
		}

		log.Printf("[ChunkedUpload] Session finalized: %s, recording: %s", req.SessionID, response.ID)

		// Return response immediately - background processing started
		c.JSON(http.StatusOK, response)
	}
}

// GetUploadStatusHandler checks the status of an upload session
// GET /api/recordings/chunked/status/:sessionId
func GetUploadStatusHandler(chunkedUploadService *service.ChunkedUploadService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context
		_, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}

		sessionID := c.Param("sessionId")
		if sessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Missing sessionId parameter",
			})
			return
		}

		ctx := c.Request.Context()

		// Get status
		response, err := chunkedUploadService.GetUploadStatus(ctx, sessionID)
		if err != nil {
			errMsg := err.Error()
			log.Printf("[ChunkedUpload] Status error: %v", err)

			if errMsg == "session not found" {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Session not found",
				})
				return
			}

			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "server_error",
				"message": "Failed to get status",
			})
			return
		}

		c.JSON(http.StatusOK, response)
	}
}

// ResumeUploadHandler resumes an interrupted upload
// POST /api/recordings/chunked/resume
func ResumeUploadHandler(chunkedUploadService *service.ChunkedUploadService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context
		_, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}

		// Parse request body
		var req models.ChunkedUploadResumeRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid request body",
			})
			return
		}

		if req.SessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Missing sessionId",
			})
			return
		}

		ctx := c.Request.Context()

		// Resume upload
		response, err := chunkedUploadService.ResumeUploadSession(ctx, req.SessionID)
		if err != nil {
			errMsg := err.Error()
			log.Printf("[ChunkedUpload] Resume error: %v", err)

			if errMsg == "session not found" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_request",
					"message": "Session not found",
				})
				return
			}

			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "server_error",
				"message": "Failed to resume upload",
			})
			return
		}

		log.Printf("[ChunkedUpload] Session resumed: %s", req.SessionID)

		c.JSON(http.StatusOK, response)
	}
}
