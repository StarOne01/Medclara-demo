package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"github.com/StarOne01/Medclara-backend.git/controller"
)

// LocalizationRoutes handles localization-related routes
type LocalizationRoutes struct {
	dbConn *sql.DB
}

// NewLocalizationRoutes creates a new localization routes handler
func NewLocalizationRoutes(dbConn *sql.DB) *LocalizationRoutes {
	return &LocalizationRoutes{dbConn: dbConn}
}

// Register registers localization routes
func (r *LocalizationRoutes) Register(group *gin.RouterGroup) {
	group.GET("/error-messages", controller.GetErrorMessagesHandler(r.dbConn))
}

// WorkspaceRoutes handles workspace-related routes
type WorkspaceRoutes struct {
	dbConn *sql.DB
}

// NewWorkspaceRoutes creates a new workspace routes handler
func NewWorkspaceRoutes(dbConn *sql.DB) *WorkspaceRoutes {
	return &WorkspaceRoutes{dbConn: dbConn}
}

// Register registers workspace routes
func (r *WorkspaceRoutes) Register(group *gin.RouterGroup) {
	group.GET("/workspace/tabs", controller.GetConsoleTabsHandler(r.dbConn))
}

// EncounterRoutes handles encounter-related routes
type EncounterRoutes struct {
	dbConn *sql.DB
}

// NewEncounterRoutes creates a new encounter routes handler
func NewEncounterRoutes(dbConn *sql.DB) *EncounterRoutes {
	return &EncounterRoutes{dbConn: dbConn}
}

// Register registers encounter routes
func (r *EncounterRoutes) Register(group *gin.RouterGroup) {
	group.GET("/:encounterId/notes", controller.GetEncounterNotesHandler(r.dbConn))
}
