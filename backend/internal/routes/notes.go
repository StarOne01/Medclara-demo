package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"github.com/StarOne01/Medclara-backend.git/controller"
)

// NoteRoutes handles note-related routes
type NoteRoutes struct {
	dbConn *sql.DB
}

// NewNoteRoutes creates a new note routes handler
func NewNoteRoutes(dbConn *sql.DB) *NoteRoutes {
	return &NoteRoutes{dbConn: dbConn}
}

// Register registers note routes
func (r *NoteRoutes) Register(group *gin.RouterGroup) {
	// Create note
	group.POST("", controller.CreateNoteHandler(r.dbConn))

	// List notes for patient (query params)
	group.GET("", controller.GetPatientNotesHandler(r.dbConn))

	// Get/Update/Delete notes
	group.GET("/:noteId", controller.GetNoteHandler(r.dbConn))
	group.PUT("/:noteId", controller.UpdateNoteHandler(r.dbConn))
	group.DELETE("/:noteId", controller.DeleteNoteHandler(r.dbConn))
	group.PATCH("/:noteId/status", controller.UpdateNoteStatusHandler(r.dbConn))

	// Sign note
	group.POST("/:noteId/sign", controller.SignNoteHandler(r.dbConn))

	// List notes for patient (path-based)
	group.GET("/patient/:patientId", controller.GetPatientNotesHandler(r.dbConn))

	// Search notes
	group.GET("/patient/:patientId/search", controller.SearchNotesHandler(r.dbConn))

	// Get notes by recording
	group.GET("/recording/:recordingId", controller.GetRecordingNotesHandler(r.dbConn))

	// Get notes by session
	group.GET("/session/:sessionId", controller.GetSessionNotesHandler(r.dbConn))
}
