// Package routes provides a modular route registration system.
// This implements the Single Responsibility Principle (SRP) by separating
// route registration from route handler logic.
// It also implements the Open/Closed Principle (OCP) by making routes
// extensible through the RouteGroup interface.
package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"github.com/StarOne01/Medclara-backend.git/config"
	"github.com/StarOne01/Medclara-backend.git/internal/service"
	"github.com/StarOne01/Medclara-backend.git/middlewares"
)

// RouteGroup represents a group of related routes
// This enables Open/Closed Principle - add new route groups without modifying existing code
type RouteGroup interface {
	// Register registers routes on the provided router group
	Register(group *gin.RouterGroup)
}

// RouteRegistrar handles registration of all application routes
type RouteRegistrar struct {
	dbConn               *sql.DB
	config               *config.Config
	chunkedUploadService *service.ChunkedUploadService
}

// NewRouteRegistrar creates a new route registrar
func NewRouteRegistrar(
	dbConn *sql.DB,
	cfg *config.Config,
	chunkedUploadService *service.ChunkedUploadService,
) *RouteRegistrar {
	return &RouteRegistrar{
		dbConn:               dbConn,
		config:               cfg,
		chunkedUploadService: chunkedUploadService,
	}
}

// RegisterAll registers all application routes on the provided engine
func (r *RouteRegistrar) RegisterAll(engine *gin.Engine) {
	// API routes group
	api := engine.Group("/api")

	// Register public routes (no auth required)
	r.registerAuthRoutes(api)

	// Register protected routes (auth required)
	protected := api.Group("")
	protected.Use(middlewares.AuthMiddleware(r.dbConn))
	{
		r.registerPatientRoutes(protected)
		r.registerTemplateRoutes(protected)
		r.registerLocalizationRoutes(protected)
		r.registerWorkspaceRoutes(protected)
		r.registerSessionRoutes(protected)
		r.registerNoteRoutes(protected)
		r.registerEncounterRoutes(protected)
		r.registerRecordingRoutes(protected)
	}
}

// =============================================================================
// ROUTE GROUP REGISTRATIONS
// =============================================================================

func (r *RouteRegistrar) registerAuthRoutes(api *gin.RouterGroup) {
	auth := NewAuthRoutes(r.dbConn)
	auth.Register(api.Group("/auth"))
}

func (r *RouteRegistrar) registerPatientRoutes(protected *gin.RouterGroup) {
	patients := NewPatientRoutes(r.dbConn)
	patients.Register(protected.Group("/patients"))
}

func (r *RouteRegistrar) registerTemplateRoutes(protected *gin.RouterGroup) {
	templates := NewTemplateRoutes(r.dbConn)
	templates.Register(protected.Group("/templates"))
}

func (r *RouteRegistrar) registerLocalizationRoutes(protected *gin.RouterGroup) {
	localization := NewLocalizationRoutes(r.dbConn)
	localization.Register(protected.Group("/localization"))
}

func (r *RouteRegistrar) registerWorkspaceRoutes(protected *gin.RouterGroup) {
	workspace := NewWorkspaceRoutes(r.dbConn)
	workspace.Register(protected.Group("/scribe"))
}

func (r *RouteRegistrar) registerSessionRoutes(protected *gin.RouterGroup) {
	sessions := NewSessionRoutes(r.dbConn)
	sessions.Register(protected.Group("/sessions"))
}

func (r *RouteRegistrar) registerNoteRoutes(protected *gin.RouterGroup) {
	notes := NewNoteRoutes(r.dbConn)
	notes.Register(protected.Group("/notes"))
}

func (r *RouteRegistrar) registerEncounterRoutes(protected *gin.RouterGroup) {
	encounters := NewEncounterRoutes(r.dbConn)
	encounters.Register(protected.Group("/encounters"))
}

func (r *RouteRegistrar) registerRecordingRoutes(protected *gin.RouterGroup) {
	recordings := NewRecordingRoutes(r.dbConn, r.config, r.chunkedUploadService)
	recordings.Register(protected.Group("/recordings"))
}
