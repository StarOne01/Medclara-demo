package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"github.com/StarOne01/Medclara-backend.git/controller"
)

// SessionRoutes handles scribe session-related routes
type SessionRoutes struct {
	dbConn *sql.DB
}

// NewSessionRoutes creates a new session routes handler
func NewSessionRoutes(dbConn *sql.DB) *SessionRoutes {
	return &SessionRoutes{dbConn: dbConn}
}

// Register registers session routes
func (r *SessionRoutes) Register(group *gin.RouterGroup) {
	// Create new session
	group.POST("", controller.CreateSessionHandler(r.dbConn))

	// List user's sessions
	group.GET("", controller.ListSessionsHandler(r.dbConn))

	// Get session with optional filters
	group.GET("/:sessionId", controller.GetSessionHandler(r.dbConn))
	group.GET("/:sessionId/with-filters", controller.GetSessionWithFiltersHandler(r.dbConn))

	// Update note section in session
	group.PATCH("/:sessionId/note-sections/:sectionKey", controller.UpdateSessionNoteSectionHandler(r.dbConn))

	// Bind patient to session
	group.POST("/:sessionId/patient", controller.BindPatientHandler(r.dbConn))
}
