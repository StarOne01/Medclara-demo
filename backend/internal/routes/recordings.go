package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"github.com/StarOne01/Medclara-backend.git/config"
	"github.com/StarOne01/Medclara-backend.git/controller"
	"github.com/StarOne01/Medclara-backend.git/internal/service"
)

// RecordingRoutes handles recording-related routes
type RecordingRoutes struct {
	dbConn               *sql.DB
	config               *config.Config
	chunkedUploadService *service.ChunkedUploadService
}

// NewRecordingRoutes creates a new recording routes handler
func NewRecordingRoutes(
	dbConn *sql.DB,
	cfg *config.Config,
	chunkedUploadService *service.ChunkedUploadService,
) *RecordingRoutes {
	return &RecordingRoutes{
		dbConn:               dbConn,
		config:               cfg,
		chunkedUploadService: chunkedUploadService,
	}
}

// Register registers recording routes
// Note: Order matters - specific routes must come BEFORE parameterized routes
func (r *RecordingRoutes) Register(group *gin.RouterGroup) {
	// List all recordings
	group.GET("", controller.GetRecordingsHandler(r.dbConn))

	// Session-based routes
	group.GET("/session/:scribePageId", controller.GetRecordingsBySessionHandler(r.dbConn))

	// Chunked upload endpoints
	r.registerChunkedUploadRoutes(group)

	// Whole audio upload
	group.POST("/whole", controller.UploadWholeAudioHandler(r.dbConn, r.config))

	// Specific ID-based routes (before generic /:recordingId)
	group.GET("/:recordingId/stream", controller.GetRecordingStreamHandler(r.dbConn))
	group.GET("/:recordingId/status", controller.GetRecordingStatusHandler(r.dbConn))
	group.GET("/:recordingId/segments", controller.GetRecordingTranscriptSegmentsHandler(r.dbConn))

	group.POST("/upload", controller.UploadRecordingHandler(r.dbConn, r.config))

	// Generic ID routes (last)
	group.GET("/:recordingId", controller.GetRecordingHandler(r.dbConn))
	group.DELETE("/:recordingId", controller.DeleteRecordingHandler(r.dbConn))
	group.PATCH("/:recordingId/link-patient", controller.LinkRecordingToPatientHandler(r.dbConn))
}

// registerChunkedUploadRoutes registers chunked upload specific routes
func (r *RecordingRoutes) registerChunkedUploadRoutes(parent *gin.RouterGroup) {
	chunked := parent.Group("/chunked")
	{
		chunked.POST("/init", controller.InitChunkedUploadHandler(r.chunkedUploadService))
		chunked.POST("/upload", controller.UploadChunkHandler(r.chunkedUploadService))
		chunked.POST("/finalize", controller.FinalizeUploadHandler(r.chunkedUploadService))
		chunked.GET("/status/:sessionId", controller.GetUploadStatusHandler(r.chunkedUploadService))
		chunked.POST("/resume", controller.ResumeUploadHandler(r.chunkedUploadService))
	}
}
