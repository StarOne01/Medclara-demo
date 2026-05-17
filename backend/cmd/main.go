package main

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/StarOne01/Medclara-backend.git/config"
	"github.com/StarOne01/Medclara-backend.git/controller"
	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/internal/service"
	"github.com/StarOne01/Medclara-backend.git/middlewares"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file
	godotenv.Load()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database connection pool (singleton - reused across all requests)
	dbConn, err := db.GetConnection(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize database queries
	queries := db.New(dbConn)

	// Initialize services
	vertexAIService := service.NewVertexAIService(
		cfg.GCPProjectID,
		cfg.GCPLocation,
		cfg.VertexAIModel,
		cfg.VertexAIModelAdvanced,
		cfg.VertexAIAPIKey,
		queries,
	)
	chunkedUploadService := service.NewChunkedUploadService("./uploads/chunked", vertexAIService, dbConn)

	// Set Gin mode based on environment
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Start retention cleanup service for HIPAA compliance (90-day deletion policy)
	// Runs every 24 hours to delete recordings older than 90 days
	// Set ENABLE_RECORDING_DELETE=false in .env to keep recordings for testing/iteration
	retentionService := service.NewRetentionCleanupService(dbConn, cfg.AudioRetentionDays, 24*time.Hour, cfg.EnableRecordingDelete)
	retentionService.Start()
	defer retentionService.Stop()

	r := gin.Default()

	// Configure max request body size for chunked uploads (512 MB)
	// Each chunk can be up to 512 KB, but we set this higher to handle form data overhead
	r.MaxMultipartMemory = 512 << 20 // 512 MB

	// Configure CORS middleware for frontend compatibility
	// Apply CORS FIRST before other middleware to ensure OPTIONS requests are handled immediately
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           86400, // Cache preflight responses for 24 hours
	}))

	// Add audit logging middleware (HIPAA compliance)
	r.Use(middlewares.AuditLoggingMiddleware())

	// Add rate limiting middleware (DDoS protection)
	// Increased to 300 requests per minute to support chunked uploads with retries
	// Each chunk upload is 1 request + potential retries, and multiple chunks can be in flight
	rateLimiter := middlewares.NewRateLimiter(300) // Increased from 100
	r.Use(rateLimiter.Middleware())

	// Utility endpoints
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Medclara Scribe Backend",
			"version": "1.0.0",
			"status":  "running",
		})
	})

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":   "ok",
			"database": checkDatabase(dbConn),
		})
	})

	// API routes
	api := r.Group("/api")
	{
		// Auth endpoints
		auth := api.Group("/auth")
		{
			auth.POST("/login", controller.LoginHandler)
			auth.POST("/logout", controller.LogoutHandler)
			auth.POST("/refresh", middlewares.AuthMiddleware(dbConn), controller.RefreshTokenHandler(dbConn))
			auth.GET("/me", middlewares.AuthMiddleware(dbConn), controller.GetUserHandler)
		}

		// Protected routes - require authentication
		protected := api.Group("")
		protected.Use(middlewares.AuthMiddleware(dbConn))
		{
			// Patient endpoints
			patients := protected.Group("/patients")
			{
				patients.GET("", controller.GetPatientsHandler(dbConn))
				patients.POST("", controller.CreatePatientHandler(dbConn))
				patients.GET("/:patientId", controller.GetPatientByIDHandler(dbConn))
				patients.GET("/:patientId/notes", controller.GetPatientNotesHandler(dbConn))
			}

			// Template endpoints
			templates := protected.Group("/templates")
			{
				templates.GET("", controller.GetTemplatesHandler(dbConn))
				// New comprehensive endpoints with sections
				templates.GET("/all", controller.GetTemplatesWithSectionsHandler(dbConn))
				templates.GET("/uuids", controller.GetTemplateUUIDsHandler(dbConn))
				// Special routes must come BEFORE parameterized routes
				templates.GET("/categories", controller.GetTemplateCategoriesHandler(dbConn))
				templates.GET("/key/:templateKey", controller.GetTemplateByKeyHandler(dbConn))
				templates.GET("/specialty/:specialty", controller.GetTemplatesBySpecialtyHandler(dbConn))
				templates.GET("/search", controller.SearchTemplatesHandler(dbConn))
				// Parameterized routes last
				templates.GET("/:templateId", controller.GetTemplateByIDHandler(dbConn))
				templates.POST("", controller.CreateTemplateHandler(dbConn))
				templates.PUT("/:templateId", controller.UpdateTemplateHandler(dbConn))
				templates.DELETE("/:templateId", controller.DeleteTemplateHandler(dbConn))
			}

			// Localization endpoints
			localization := protected.Group("/localization")
			{
				localization.GET("/error-messages", controller.GetErrorMessagesHandler(dbConn))
			}

			// Scribe workspace endpoints
			workspace := protected.Group("/scribe")
			{
				workspace.GET("/workspace/tabs", controller.GetConsoleTabsHandler(dbConn))
			}

			// Scribe sessions endpoints - NEW PRIMARY API for session-based scribe workflow
			sessions := protected.Group("/sessions")
			{
				// Create new session
				sessions.POST("", controller.CreateSessionHandler(dbConn))

				// List user's sessions
				sessions.GET("", controller.ListSessionsHandler(dbConn))

				// Get session with optional filters
				sessions.GET("/:sessionId", controller.GetSessionHandler(dbConn))

				// Get session with optional filters (same as above but with query params)
				sessions.GET("/:sessionId/with-filters", controller.GetSessionWithFiltersHandler(dbConn))

				// Update note section in session
				sessions.PATCH("/:sessionId/note-sections/:sectionKey", controller.UpdateSessionNoteSectionHandler(dbConn))

				// Bind patient to session
				sessions.POST("/:sessionId/patient", controller.BindPatientHandler(dbConn))
			}

			// Notes endpoints - NEW API supporting patient-first scribe workflow
			notes := protected.Group("/notes")
			{
				// Create note - supports both old (recording-based) and new (patient-first) formats
				notes.POST("", controller.CreateNoteHandler(dbConn))

				// List notes for patient (supports both query params and path params)
				notes.GET("", controller.GetPatientNotesHandler(dbConn))

				// Get/Update/Delete notes
				notes.GET("/:noteId", controller.GetNoteHandler(dbConn))
				notes.PUT("/:noteId", controller.UpdateNoteHandler(dbConn))
				notes.DELETE("/:noteId", controller.DeleteNoteHandler(dbConn))
				notes.PATCH("/:noteId/status", controller.UpdateNoteStatusHandler(dbConn))

				// Sign note
				notes.POST("/:noteId/sign", controller.SignNoteHandler(dbConn))

				// List notes for patient (path-based route)
				notes.GET("/patient/:patientId", controller.GetPatientNotesHandler(dbConn))

				// Search notes
				notes.GET("/patient/:patientId/search", controller.SearchNotesHandler(dbConn))

				// Get notes by recording
				notes.GET("/recording/:recordingId", controller.GetRecordingNotesHandler(dbConn))

				// Get notes by session (scribe_page_id) - required for frontend to find notes after recording processing
				notes.GET("/session/:sessionId", controller.GetSessionNotesHandler(dbConn))
			}

			// Encounters - get notes for encounter
			encounters := protected.Group("/encounters")
			{
				encounters.GET("/:encounterId/notes", controller.GetEncounterNotesHandler(dbConn))
			}

			// Recording endpoints
			recordings := protected.Group("/recordings")
			{
				// List all recordings - must come before parameterized routes
				recordings.GET("", controller.GetRecordingsHandler(dbConn))

				// Session-based routes - must come before ID-based routes
				recordings.GET("/session/:scribePageId", controller.GetRecordingsBySessionHandler(dbConn))

				// Chunked upload endpoints - must come before ID-based routes to avoid conflict
				chunked := recordings.Group("/chunked")
				{
					chunked.POST("/init", controller.InitChunkedUploadHandler(chunkedUploadService))
					chunked.POST("/upload", controller.UploadChunkHandler(chunkedUploadService))
					chunked.POST("/finalize", controller.FinalizeUploadHandler(chunkedUploadService))
					chunked.GET("/status/:sessionId", controller.GetUploadStatusHandler(chunkedUploadService))
					chunked.POST("/resume", controller.ResumeUploadHandler(chunkedUploadService))
				}

				// Whole audio upload endpoint - single file upload in one request
				recordings.POST("/whole", controller.UploadWholeAudioHandler(dbConn, cfg))

				// Specific ID-based routes - more specific routes MUST come before generic /:recordingId
				// CRITICAL: These must be registered before the catch-all /:recordingId route
				recordings.GET("/:recordingId/stream", controller.GetRecordingStreamHandler(dbConn))
				recordings.GET("/:recordingId/status", controller.GetRecordingStatusHandler(dbConn))
				recordings.GET("/:recordingId/segments", controller.GetRecordingTranscriptSegmentsHandler(dbConn))

				recordings.POST("/upload", controller.UploadRecordingHandler(dbConn, cfg))

				// Generic ID route - must come LAST to catch all remaining /recordingId routes
				recordings.GET("/:recordingId", controller.GetRecordingHandler(dbConn))
				recordings.DELETE("/:recordingId", controller.DeleteRecordingHandler(dbConn))
				recordings.PATCH("/:recordingId/link-patient", controller.LinkRecordingToPatientHandler(dbConn))
			}
		}
	}

	// Start server with custom HTTP configuration for large file uploads
	addr := cfg.ServerAddr
	if addr == "" {
		addr = ":8000"
	}
	log.Printf("Starting server on %s (Environment: %s)", addr, cfg.Environment)

	// Create HTTP server with increased timeouts for chunked uploads
	// ReadTimeout: 5 minutes - time to read the entire request including headers and body
	// WriteTimeout: 5 minutes - time to write the response
	// IdleTimeout: 2 minutes - time to wait for the next request
	server := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  5 * time.Minute,
		WriteTimeout: 5 * time.Minute,
		IdleTimeout:  2 * time.Minute,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// checkDatabase verifies the database connection
func checkDatabase(dbConn *sql.DB) string {
	if err := dbConn.Ping(); err != nil {
		return "disconnected"
	}
	return "connected"
}
