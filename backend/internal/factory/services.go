// Package factory provides factory functions for creating services.
// This implements the Factory Pattern to centralize object creation
// and enables easy testing with mock implementations.
package factory

import (
	"database/sql"
	"time"

	"github.com/StarOne01/Medclara-backend.git/config"
	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/internal/interfaces"
	"github.com/StarOne01/Medclara-backend.git/internal/service"
)

// ServiceFactory creates service instances
// This is the central factory for all service creation
type ServiceFactory struct {
	dbConn  *sql.DB
	queries *db.Queries
	config  *config.Config
}

// NewServiceFactory creates a new service factory
func NewServiceFactory(dbConn *sql.DB, cfg *config.Config) *ServiceFactory {
	return &ServiceFactory{
		dbConn:  dbConn,
		queries: db.New(dbConn),
		config:  cfg,
	}
}

// =============================================================================
// SERVICE CREATION METHODS
// =============================================================================

// CreateNotesService creates a new NotesService instance
func (f *ServiceFactory) CreateNotesService() interfaces.NotesService {
	return service.NewNotesService(f.queries, f.dbConn)
}

// CreateRecordingService creates a new RecordingService instance
func (f *ServiceFactory) CreateRecordingService(aiService *service.VertexAIService) interfaces.RecordingService {
	return service.NewRecordingService(f.queries, f.dbConn, aiService)
}

// CreateSessionService creates a new ScribeSessionService instance
func (f *ServiceFactory) CreateSessionService() *service.ScribeSessionService {
	return service.NewScribeSessionService(f.dbConn)
}

// CreateAIService creates a new VertexAIService instance
func (f *ServiceFactory) CreateAIService() *service.VertexAIService {
	return service.NewVertexAIService(
		f.config.GCPProjectID,
		f.config.GCPLocation,
		f.config.VertexAIModel,
		f.config.VertexAIModelAdvanced,
		f.config.VertexAIAPIKey,
		f.queries,
	)
}

// CreateChunkedUploadService creates a new ChunkedUploadService instance
func (f *ServiceFactory) CreateChunkedUploadService(
	uploadDir string,
	aiService *service.VertexAIService,
) *service.ChunkedUploadService {
	return service.NewChunkedUploadService(uploadDir, aiService, f.dbConn)
}

// CreateRetentionService creates a new RetentionCleanupService instance
func (f *ServiceFactory) CreateRetentionService(
	retentionDays int,
	checkInterval time.Duration,
	enableDelete bool,
) *service.RetentionCleanupService {
	return service.NewRetentionCleanupService(
		f.dbConn,
		retentionDays,
		checkInterval,
		enableDelete,
	)
}

// =============================================================================
// CONVENIENCE METHODS FOR COMMON SERVICE COMBINATIONS
// =============================================================================

// AllServices holds all application services
type AllServices struct {
	Notes         interfaces.NotesService
	Recording     interfaces.RecordingService
	Session       *service.ScribeSessionService
	AI            *service.VertexAIService
	ChunkedUpload *service.ChunkedUploadService
	Retention     *service.RetentionCleanupService
}

// CreateAllServices creates all application services with proper dependency injection
func (f *ServiceFactory) CreateAllServices(uploadDir string, enableRetention bool) *AllServices {
	// Create AI service first (no dependencies)
	aiService := f.CreateAIService()

	// Create services that depend on AI service
	recordingService := f.CreateRecordingService(aiService)
	chunkedUploadService := f.CreateChunkedUploadService(uploadDir, aiService)

	// Create independent services
	notesService := f.CreateNotesService()
	sessionService := f.CreateSessionService()

	services := &AllServices{
		Notes:         notesService,
		Recording:     recordingService,
		Session:       sessionService,
		AI:            aiService,
		ChunkedUpload: chunkedUploadService,
	}

	// Optionally create retention service
	if enableRetention {
		services.Retention = f.CreateRetentionService(
			f.config.AudioRetentionDays,
			24*time.Hour,
			f.config.EnableRecordingDelete,
		)
	}

	return services
}

// =============================================================================
// TEST FACTORY (for creating mock services)
// =============================================================================

// TestServiceFactory creates services for testing
// Allows injection of mock dependencies
type TestServiceFactory struct {
	DBConn  *sql.DB
	Queries *db.Queries
}

// NewTestServiceFactory creates a test service factory
func NewTestServiceFactory(dbConn *sql.DB) *TestServiceFactory {
	return &TestServiceFactory{
		DBConn:  dbConn,
		Queries: db.New(dbConn),
	}
}

// CreateNotesService creates a notes service for testing
func (f *TestServiceFactory) CreateNotesService() interfaces.NotesService {
	return service.NewNotesService(f.Queries, f.DBConn)
}

// CreateSessionService creates a session service for testing
func (f *TestServiceFactory) CreateSessionService() *service.ScribeSessionService {
	return service.NewScribeSessionService(f.DBConn)
}
