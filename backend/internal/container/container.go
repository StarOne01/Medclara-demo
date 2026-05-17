// Package container provides dependency injection for the application.
// This implements Dependency Inversion Principle (DIP) by centralizing
// service creation and wiring dependencies through interfaces.
package container

import (
	"database/sql"
	"log"
	"time"

	"github.com/StarOne01/Medclara-backend.git/config"
	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/internal/interfaces"
	"github.com/StarOne01/Medclara-backend.git/internal/service"
)

// Container holds all application dependencies.
// This is the composition root where all dependencies are wired together.
// Using a container enables:
// - Centralized dependency management
// - Easy testing with mock implementations
// - Clear visibility of all service dependencies
type Container struct {
	// Configuration
	Config *config.Config

	// Database connection
	DBConn  *sql.DB
	Queries *db.Queries

	// Services (stored as interfaces for flexibility)
	notesService         interfaces.NotesService
	recordingService     interfaces.RecordingService
	chunkedUploadService interfaces.ChunkedUploadService

	// Concrete service references (for internal use)
	vertexAIService  *service.VertexAIService
	sessionService   *service.ScribeSessionService
	chunkedUploadSvc *service.ChunkedUploadService
	retentionService *service.RetentionCleanupService
}

// ContainerOptions allows customization of the container during creation
type ContainerOptions struct {
	// UploadDir specifies the directory for chunked uploads
	UploadDir string
	// DisableAI disables AI service initialization (for testing)
	DisableAI bool
}

// DefaultOptions returns default container options
func DefaultOptions() *ContainerOptions {
	return &ContainerOptions{
		UploadDir: "./uploads/chunked",
		DisableAI: false,
	}
}

// New creates a new dependency injection container with all services initialized.
// This is the composition root of the application.
func New(cfg *config.Config, dbConn *sql.DB, opts *ContainerOptions) (*Container, error) {
	if opts == nil {
		opts = DefaultOptions()
	}

	queries := db.New(dbConn)

	c := &Container{
		Config:  cfg,
		DBConn:  dbConn,
		Queries: queries,
	}

	// Initialize services in dependency order

	// 1. AI Service (no dependencies on other services)
	if !opts.DisableAI {
		c.vertexAIService = service.NewVertexAIService(
			cfg.GCPProjectID,
			cfg.GCPLocation,
			cfg.VertexAIModel,
			cfg.VertexAIModelAdvanced,
			cfg.VertexAIAPIKey,
			queries,
		)
	}

	// 2. Notes Service (depends on queries)
	c.notesService = service.NewNotesService(queries, dbConn)

	// 3. Scribe Session Service (depends on db)
	c.sessionService = service.NewScribeSessionService(dbConn)

	// 4. Recording Service (depends on queries, AI service)
	c.recordingService = service.NewRecordingService(queries, dbConn, c.vertexAIService)

	// 5. Chunked Upload Service (depends on AI service, db)
	c.chunkedUploadSvc = service.NewChunkedUploadService(
		opts.UploadDir,
		c.vertexAIService,
		dbConn,
	)
	c.chunkedUploadService = c.chunkedUploadSvc

	log.Printf("Container initialized with all services")

	return c, nil
}

// =============================================================================
// SERVICE ACCESSORS (return interfaces for dependency inversion)
// =============================================================================

// NotesService returns the notes service implementation
func (c *Container) NotesService() interfaces.NotesService {
	return c.notesService
}

// RecordingService returns the recording service implementation
func (c *Container) RecordingService() interfaces.RecordingService {
	return c.recordingService
}

// SessionService returns the scribe session service implementation
func (c *Container) SessionService() *service.ScribeSessionService {
	return c.sessionService
}

// ChunkedUploadService returns the chunked upload service implementation
func (c *Container) ChunkedUploadService() interfaces.ChunkedUploadService {
	return c.chunkedUploadService
}

// =============================================================================
// CONCRETE SERVICE ACCESSORS (for cases where concrete type is needed)
// =============================================================================

// VertexAIService returns the concrete Vertex AI service
func (c *Container) VertexAIService() *service.VertexAIService {
	return c.vertexAIService
}

// ChunkedUploadSvc returns the concrete chunked upload service
func (c *Container) ChunkedUploadSvc() *service.ChunkedUploadService {
	return c.chunkedUploadSvc
}

// =============================================================================
// LIFECYCLE MANAGEMENT
// =============================================================================

// StartBackgroundServices starts any background services (e.g., retention cleanup)
func (c *Container) StartBackgroundServices() {
	// Start retention cleanup service
	c.retentionService = service.NewRetentionCleanupService(
		c.DBConn,
		c.Config.AudioRetentionDays,
		24*time.Hour,
		c.Config.EnableRecordingDelete,
	)
	c.retentionService.Start()
	log.Printf("Background services started")
}

// Shutdown gracefully shuts down all services
func (c *Container) Shutdown() {
	log.Printf("Shutting down container services...")

	// Stop retention service
	if c.retentionService != nil {
		c.retentionService.Stop()
	}

	// Close AI service
	if c.vertexAIService != nil {
		c.vertexAIService.Close()
	}

	log.Printf("Container shutdown complete")
}

// =============================================================================
// FACTORY METHODS FOR CREATING NEW SERVICE INSTANCES
// =============================================================================

// NewNotesService creates a new notes service instance
// Useful for creating isolated instances in tests
func (c *Container) NewNotesService() interfaces.NotesService {
	return service.NewNotesService(c.Queries, c.DBConn)
}

// NewRecordingService creates a new recording service instance
func (c *Container) NewRecordingService() interfaces.RecordingService {
	return service.NewRecordingService(c.Queries, c.DBConn, c.vertexAIService)
}

// NewSessionService creates a new session service instance
func (c *Container) NewSessionService() *service.ScribeSessionService {
	return service.NewScribeSessionService(c.DBConn)
}
