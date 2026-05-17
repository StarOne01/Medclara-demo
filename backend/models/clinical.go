package models

import (
	"encoding/json"
	"time"
)

// Patient represents a patient in the system
type Patient struct {
	ID                  string     `json:"id"`
	FirstName           string     `json:"first_name"`
	LastName            string     `json:"last_name"`
	DateOfBirth         *time.Time `json:"date_of_birth,omitempty"`
	Gender              *string    `json:"gender,omitempty"`
	Email               *string    `json:"email,omitempty"`
	Phone               *string    `json:"phone,omitempty"`
	MedicalRecordNumber *string    `json:"medical_record_number,omitempty"`
	OrganizationID      string     `json:"organization_id"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// CreatePatientRequest is the request payload for creating a patient
type CreatePatientRequest struct {
	FirstName           string     `json:"first_name" binding:"required"`
	LastName            string     `json:"last_name" binding:"required"`
	DateOfBirth         *time.Time `json:"date_of_birth"`
	Gender              *string    `json:"gender"`
	Email               *string    `json:"email"`
	Phone               *string    `json:"phone"`
	MedicalRecordNumber *string    `json:"medical_record_number"`
}

// Encounter represents a clinical encounter
type Encounter struct {
	ID            string     `json:"id"`
	PatientID     string     `json:"patient_id"`
	UserID        string     `json:"user_id"`
	EncounterType *string    `json:"encounter_type,omitempty"`
	Status        string     `json:"status"` // active, completed, cancelled
	Notes         *string    `json:"notes,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
}

// CreateEncounterRequest is the request payload for creating an encounter
type CreateEncounterRequest struct {
	PatientID     string  `json:"patient_id" binding:"required"`
	EncounterType *string `json:"encounter_type"`
	Notes         *string `json:"notes"`
}

// Template represents a clinical note template
// Now prompt-based: uses AI extraction instead of structured sections
type Template struct {
	ID                 string          `json:"id"`
	TemplateKey        string          `json:"template_key"`
	Label              string          `json:"label"`
	Description        *string         `json:"description,omitempty"`
	Specialty          *string         `json:"specialty,omitempty"`
	Category           *string         `json:"category,omitempty"`
	Prompt             string          `json:"prompt"`        // AI extraction prompt
	ExtractStyle       string          `json:"extract_style"` // narrative, structured, hybrid
	PromptVersion      int             `json:"prompt_version"`
	PromptLastModified *time.Time      `json:"prompt_last_modified,omitempty"`
	Metadata           json.RawMessage `json:"metadata,omitempty"`
	IsActive           bool            `json:"is_active"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

// ClinicalNote represents a clinical note within an encounter
type ClinicalNote struct {
	ID               string          `json:"id"`
	EncounterID      string          `json:"encounter_id"`
	TemplateID       string          `json:"template_id"`
	UserID           string          `json:"user_id"`
	Content          string          `json:"content"`                  // Raw note content from extraction
	ExtractedData    json.RawMessage `json:"extracted_data,omitempty"` // Structured extraction if available
	Status           string          `json:"status"`                   // draft, completed, signed
	ExtractionMethod string          `json:"extraction_method"`        // ai, manual, hybrid
	SignedAt         *time.Time      `json:"signed_at,omitempty"`
	SignedBy         *string         `json:"signed_by,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

// UpdateNoteSectionRequest is the request payload for updating a note section
// Deprecated: Now using full content updates instead of section-by-section
type UpdateNoteSectionRequest struct {
	Content     string `json:"content" binding:"required"`
	EncounterID string `json:"encounter_id" binding:"required"`
}

// NoteSection represents a section of a clinical note
type NoteSection struct {
	ID        string    `json:"id"`
	Key       string    `json:"key"`
	Content   string    `json:"content"`
	UpdatedBy string    `json:"updated_by"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TemplateResponse is the response format for template endpoints
type TemplateResponse struct {
	ID                 string          `json:"id"`
	Name               string          `json:"name"`
	Label              string          `json:"label"`
	Description        *string         `json:"description,omitempty"`
	Specialty          *string         `json:"specialty,omitempty"`
	Category           *string         `json:"category,omitempty"`
	Prompt             string          `json:"prompt"`        // AI extraction prompt
	ExtractStyle       string          `json:"extract_style"` // narrative, structured, hybrid
	Version            string          `json:"version"`
	PromptVersion      int             `json:"prompt_version"`
	PromptLastModified *time.Time      `json:"prompt_last_modified,omitempty"`
	Metadata           json.RawMessage `json:"metadata,omitempty"`
	IsActive           bool            `json:"is_active"`
}

// Note represents a clinical note attached to a patient
type Note struct {
	ID           string          `json:"id"`
	PatientID    string          `json:"patient_id"`
	RecordingID  *string         `json:"recording_id,omitempty"`
	EncounterID  *string         `json:"encounter_id,omitempty"`
	CreatedBy    string          `json:"created_by"`
	UpdatedBy    *string         `json:"updated_by,omitempty"`
	Title        string          `json:"title"`
	Content      string          `json:"content"`
	NoteType     string          `json:"note_type"` // scribe, clinical, followup, general
	Status       string          `json:"status"`    // draft, completed, signed, archived
	ScribePageID *string         `json:"scribe_page_id,omitempty"`
	Tags         json.RawMessage `json:"tags,omitempty"` // Array of tags
	Metadata     json.RawMessage `json:"metadata,omitempty"`
	IsSigned     bool            `json:"is_signed"`
	SignedAt     *time.Time      `json:"signed_at,omitempty"`
	SignedBy     *string         `json:"signed_by,omitempty"`
	Version      int             `json:"version"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// CreateNoteRequest is the request payload for creating a note
type CreateNoteRequest struct {
	PatientID    string                 `json:"patient_id" binding:"required"`
	RecordingID  *string                `json:"recording_id"`
	EncounterID  *string                `json:"encounter_id"`
	Title        string                 `json:"title" binding:"required"`
	Content      string                 `json:"content" binding:"required"`
	NoteType     *string                `json:"note_type"` // Default: "scribe"
	Status       *string                `json:"status"`    // Default: "draft"
	ScribePageID *string                `json:"scribe_page_id"`
	Tags         []string               `json:"tags"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// UpdateNoteRequest is the request payload for updating a note
type UpdateNoteRequest struct {
	Title    *string                `json:"title"`
	Content  *string                `json:"content"`
	NoteType *string                `json:"note_type"`
	Status   *string                `json:"status"`
	Tags     []string               `json:"tags"`
	Metadata map[string]interface{} `json:"metadata"`
}

// SignNoteRequest is the request payload for signing a note
type SignNoteRequest struct {
	SignedBy string `json:"signed_by" binding:"required"`
}

// NoteListResponse represents a list of notes
type NoteListResponse struct {
	Notes  []Note `json:"notes"`
	Total  int    `json:"total"`
	Limit  int    `json:"limit"`
	Offset int    `json:"offset"`
}

// NoteMetadata stores additional note information
type NoteMetadata struct {
	AIConfidenceScore *float64               `json:"ai_confidence_score,omitempty"`
	Summary           *string                `json:"summary,omitempty"`
	ProcessingTimeMs  *int32                 `json:"processing_time_ms,omitempty"`
	OriginalRecording *string                `json:"original_recording,omitempty"`
	CustomFields      map[string]interface{} `json:"custom_fields,omitempty"`
}
