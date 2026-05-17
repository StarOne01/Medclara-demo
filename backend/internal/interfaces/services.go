// Package interfaces defines contracts for all services in the application.
// This enables Dependency Inversion Principle (DIP) - depend on abstractions, not concretions.
// It also enables Interface Segregation Principle (ISP) - small, focused interfaces.
package interfaces

import (
	"context"
	"io"

	"github.com/google/uuid"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
)

// =============================================================================
// NOTES SERVICE INTERFACES
// =============================================================================

// NoteReader handles read operations for notes (Interface Segregation)
type NoteReader interface {
	GetNote(ctx context.Context, noteID string, organizationID uuid.UUID) (*models.Note, error)
	GetNotesByPatient(ctx context.Context, patientID string, organizationID uuid.UUID, limit, offset int32) ([]models.Note, int, error)
	GetNotesByRecording(ctx context.Context, recordingID string) ([]models.Note, error)
	GetNotesByScribePage(ctx context.Context, scribePageID string) ([]models.Note, error)
	SearchNotes(ctx context.Context, patientID, query string, limit, offset int32) ([]models.Note, int, error)
}

// NoteWriter handles write operations for notes (Interface Segregation)
type NoteWriter interface {
	CreateNote(ctx context.Context, patientID, createdBy string, organizationID uuid.UUID, req *models.CreateNoteRequest) (*models.Note, error)
	UpdateNote(ctx context.Context, noteID, updatedBy string, organizationID uuid.UUID, req *models.UpdateNoteRequest) (*models.Note, error)
	DeleteNote(ctx context.Context, noteID string, organizationID uuid.UUID) error
	UpdateNoteStatus(ctx context.Context, noteID, status string, organizationID uuid.UUID) (*models.Note, error)
	SignNote(ctx context.Context, noteID, signedBy string, organizationID uuid.UUID) (*models.Note, error)
}

// NotesService combines all note operations (for cases where full access is needed)
type NotesService interface {
	NoteReader
	NoteWriter
}

// =============================================================================
// RECORDING SERVICE INTERFACES
// =============================================================================

// RecordingReader handles read operations for recordings
type RecordingReader interface {
	GetRecording(ctx context.Context, recordingID string) (*models.Recording, error)
	GetRecordingsByEncounter(ctx context.Context, encounterID string, limit, offset int32) ([]models.Recording, int, error)
}

// RecordingWriter handles write operations for recordings
type RecordingWriter interface {
	CreateRecording(ctx context.Context, encounterID, userID, patientID, templateID string, audioURL string, durationSeconds int32) (*models.Recording, error)
	DeleteRecording(ctx context.Context, recordingID string) error
}

// RecordingProcessor handles audio processing operations
type RecordingProcessor interface {
	ProcessRecording(ctx context.Context, recordingID string, audioData io.Reader, mimeType string, templateKey string, patientContext *models.PatientData) error
}

// RecordingService combines all recording operations
type RecordingService interface {
	RecordingReader
	RecordingWriter
	RecordingProcessor
}

// =============================================================================
// AI PROCESSING INTERFACES
// =============================================================================

// AudioProcessor handles audio processing with AI
type AudioProcessor interface {
	ProcessAudioRecording(ctx context.Context, audioData io.Reader, mimeType string, templateKey string, patientContext *models.PatientData) (*models.AnalysisResult, error)
}

// AIService combines AI processing capabilities
// Note: Uses concrete service method signatures for compatibility
type AIService interface {
	AudioProcessor
	Close() error
}

// =============================================================================
// CHUNKED UPLOAD INTERFACES
// =============================================================================

// ChunkedUploadInitializer handles upload session initialization
type ChunkedUploadInitializer interface {
	InitializeUploadSession(ctx context.Context, templateID, patientID, encounterID, scribeSessionID, userID string) (*models.ChunkedUploadSession, error)
}

// ChunkedUploadHandler handles chunk operations
type ChunkedUploadHandler interface {
	UploadChunk(ctx context.Context, sessionID string, chunkIndex int32, totalChunks int32, isLastChunk bool, chunkData []byte) (*models.ChunkedUploadChunkResponse, error)
	GetUploadSession(ctx context.Context, sessionID string) (*models.ChunkedUploadSession, error)
	GetUploadStatus(ctx context.Context, sessionID string) (*models.ChunkedUploadStatusResponse, error)
}

// ChunkedUploadFinalizer handles upload finalization
type ChunkedUploadFinalizer interface {
	FinalizeUploadSession(ctx context.Context, sessionID string, totalSize *int64) (*models.ChunkedUploadFinalizeResponse, error)
	ResumeUploadSession(ctx context.Context, sessionID string) (*models.ChunkedUploadResumeResponse, error)
}

// ChunkedUploadService combines all chunked upload operations
type ChunkedUploadService interface {
	ChunkedUploadInitializer
	ChunkedUploadHandler
	ChunkedUploadFinalizer
}

// =============================================================================
// AUTHENTICATION INTERFACES
// =============================================================================

// TokenValidator validates authentication tokens
type TokenValidator interface {
	ValidateToken(tokenString string) (*models.Claims, error)
}

// UserAuthenticator handles user authentication
type UserAuthenticator interface {
	Authenticate(ctx context.Context, email, password string) (*models.User, string, error)
	RefreshToken(ctx context.Context, userID uuid.UUID) (string, error)
}

// =============================================================================
// REPOSITORY INTERFACES (Data Access Layer)
// =============================================================================

// UserRepository handles user data access
type UserRepository interface {
	GetUserByID(ctx context.Context, userID uuid.UUID) (*db.User, error)
	GetUserByEmail(ctx context.Context, email string) (*db.User, error)
}

// PatientRepository handles patient data access
type PatientRepository interface {
	GetPatientByID(ctx context.Context, patientID, organizationID uuid.UUID) (*db.Patient, error)
	ListPatients(ctx context.Context, organizationID uuid.UUID, limit, offset int32) ([]db.Patient, error)
	CreatePatient(ctx context.Context, params db.CreatePatientParams) (*db.Patient, error)
}

// TemplateRepository handles template data access
type TemplateRepository interface {
	GetTemplateByID(ctx context.Context, templateID uuid.UUID) (*db.Template, error)
	GetTemplateByKey(ctx context.Context, templateKey string) (*db.Template, error)
	ListTemplates(ctx context.Context, limit, offset int32) ([]db.Template, error)
}

// =============================================================================
// STREAM SERVICE INTERFACES
// =============================================================================

// RecordingStreamService handles SSE streaming for recording progress
type RecordingStreamService interface {
	ValidateRecordingAccess(ctx context.Context, recordingID uuid.UUID, userID *uuid.UUID) (*db.Recording, error)
	StreamRecordingProgress(recordingID string, w interface{}, r interface{}) error
}
