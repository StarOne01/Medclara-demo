package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
)

// ClinicalService handles clinical note operations
type ClinicalService struct {
	queries *db.Queries
	dbConn  *sql.DB
}

// NewClinicalService creates a new clinical service
func NewClinicalService(queries *db.Queries, dbConn *sql.DB) *ClinicalService {
	return &ClinicalService{
		queries: queries,
		dbConn:  dbConn,
	}
}

// CreateClinicalNote creates a new clinical note for an encounter
func (s *ClinicalService) CreateClinicalNote(
	ctx context.Context,
	encounterID, templateID, userID string,
) (*models.ClinicalNote, error) {
	if encounterID == "" || templateID == "" || userID == "" {
		return nil, errors.New("encounterID, templateID, and userID are required")
	}

	// Parse UUIDs
	encounterUUID, err := uuid.Parse(encounterID)
	if err != nil {
		return nil, fmt.Errorf("invalid encounterID: %w", err)
	}

	templateUUID, err := uuid.Parse(templateID)
	if err != nil {
		return nil, fmt.Errorf("invalid templateID: %w", err)
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid userID: %w", err)
	}

	// Verify encounter exists
	_, err = s.queries.GetEncounterByID(ctx, db.GetEncounterByIDParams{
		ID:             encounterUUID,
		OrganizationID: uuid.UUID{},
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("encounter not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Verify template exists
	_, err = s.queries.GetTemplateByID(ctx, templateUUID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("template not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	noteID := uuid.New()
	now := time.Now()

	// Create clinical note with empty content (prompt-based extraction)
	// Content will be populated by AI extraction or manual input
	_, err = s.queries.CreateClinicalNote(ctx, db.CreateClinicalNoteParams{
		EncounterID:      encounterUUID,
		TemplateID:       templateUUID,
		UserID:           userUUID,
		Content:          "",
		Status:           "draft",
		ExtractionMethod: sql.NullString{String: "manual", Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create clinical note: %w", err)
	}

	return &models.ClinicalNote{
		ID:               noteID.String(),
		EncounterID:      encounterID,
		TemplateID:       templateID,
		UserID:           userID,
		Content:          "",
		ExtractionMethod: "manual",
		Status:           "draft",
		CreatedAt:        now,
		UpdatedAt:        now,
	}, nil
}

// UpdateNoteSection updates a specific section of a clinical note
func (s *ClinicalService) UpdateNoteSection(
	ctx context.Context,
	encounterID, sectionKey, content string,
	userID string,
) (*models.NoteSection, error) {
	if encounterID == "" || sectionKey == "" || content == "" {
		return nil, errors.New("encounterID, sectionKey, and content are required")
	}

	// Parse encounter UUID
	encounterUUID, err := uuid.Parse(encounterID)
	if err != nil {
		return nil, fmt.Errorf("invalid encounterID: %w", err)
	}

	// Get the clinical note for the encounter
	notes, err := s.queries.GetClinicalNotesByEncounter(ctx, encounterUUID)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("database error: %w", err)
	}

	if len(notes) == 0 {
		return nil, errors.New("no clinical note found for this encounter")
	}

	// Use the first (most recent) note
	note := notes[0]

	// Parse existing content
	var noteSections map[string]string
	if err := json.Unmarshal([]byte(note.Content), &noteSections); err != nil {
		// If content is empty or not JSON, start fresh
		noteSections = make(map[string]string)
	}

	// Update the section
	noteSections[sectionKey] = content

	// Marshal back to JSON
	updatedSectionsJSON, err := json.Marshal(noteSections)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal note sections: %w", err)
	}

	// Update the note in database
	now := time.Now()
	if err := s.queries.UpdateClinicalNoteSection(ctx, db.UpdateClinicalNoteSectionParams{
		Content:       string(updatedSectionsJSON),
		ExtractedData: pqtype.NullRawMessage{RawMessage: updatedSectionsJSON, Valid: true},
		UpdatedAt:     sql.NullTime{Time: now, Valid: true},
		ID:            note.ID,
	}); err != nil {
		return nil, fmt.Errorf("failed to update note section: %w", err)
	}

	return &models.NoteSection{
		ID:        uuid.New().String(),
		Key:       sectionKey,
		Content:   content,
		UpdatedBy: userID,
		UpdatedAt: now,
	}, nil
}

// SignClinicalNote signs a clinical note
func (s *ClinicalService) SignClinicalNote(
	ctx context.Context,
	noteID, userID string,
) error {
	if noteID == "" || userID == "" {
		return errors.New("noteID and userID are required")
	}

	// Parse note UUID
	noteUUID, err := uuid.Parse(noteID)
	if err != nil {
		return fmt.Errorf("invalid noteID: %w", err)
	}

	// Parse user UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid userID: %w", err)
	}

	now := time.Now()
	if err := s.queries.SignClinicalNote(ctx, db.SignClinicalNoteParams{
		Status:    "signed",
		SignedAt:  sql.NullTime{Time: now, Valid: true},
		SignedBy:  uuid.NullUUID{UUID: userUUID, Valid: true},
		UpdatedAt: sql.NullTime{Time: now, Valid: true},
		ID:        noteUUID,
	}); err != nil {
		return fmt.Errorf("failed to sign note: %w", err)
	}

	return nil
}

// GetClinicalNote retrieves a clinical note by ID
func (s *ClinicalService) GetClinicalNote(ctx context.Context, noteID string) (*models.ClinicalNote, error) {
	// Parse note UUID
	noteUUID, err := uuid.Parse(noteID)
	if err != nil {
		return nil, fmt.Errorf("invalid noteID: %w", err)
	}

	note, err := s.queries.GetClinicalNoteByID(ctx, noteUUID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("clinical note not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	var signedAt *time.Time
	if note.SignedAt.Valid {
		signedAt = &note.SignedAt.Time
	}

	var signedBy *string
	if note.SignedBy.Valid {
		signedByStr := note.SignedBy.UUID.String()
		signedBy = &signedByStr
	}

	return &models.ClinicalNote{
		ID:               note.ID.String(),
		EncounterID:      note.EncounterID.String(),
		TemplateID:       note.TemplateID.String(),
		UserID:           note.UserID.String(),
		Content:          note.Content,
		ExtractedData:    note.ExtractedData.RawMessage,
		ExtractionMethod: note.ExtractionMethod.String,
		Status:           note.Status,
		SignedAt:         signedAt,
		SignedBy:         signedBy,
		CreatedAt:        note.CreatedAt.Time,
		UpdatedAt:        note.UpdatedAt.Time,
	}, nil
}

// GetClinicalNotesByEncounter retrieves all clinical notes for an encounter
func (s *ClinicalService) GetClinicalNotesByEncounter(
	ctx context.Context,
	encounterID string,
) ([]models.ClinicalNote, error) {
	// Parse encounter UUID
	encounterUUID, err := uuid.Parse(encounterID)
	if err != nil {
		return nil, fmt.Errorf("invalid encounterID: %w", err)
	}

	notes, err := s.queries.GetClinicalNotesByEncounter(ctx, encounterUUID)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("database error: %w", err)
	}

	var result []models.ClinicalNote
	for _, note := range notes {
		var signedAt *time.Time
		if note.SignedAt.Valid {
			signedAt = &note.SignedAt.Time
		}

		var signedBy *string
		if note.SignedBy.Valid {
			signedByStr := note.SignedBy.UUID.String()
			signedBy = &signedByStr
		}

		result = append(result, models.ClinicalNote{
			ID:               note.ID.String(),
			EncounterID:      note.EncounterID.String(),
			TemplateID:       note.TemplateID.String(),
			UserID:           note.UserID.String(),
			Content:          note.Content,
			ExtractedData:    note.ExtractedData.RawMessage,
			ExtractionMethod: note.ExtractionMethod.String,
			Status:           note.Status,
			SignedAt:         signedAt,
			SignedBy:         signedBy,
			CreatedAt:        note.CreatedAt.Time,
			UpdatedAt:        note.UpdatedAt.Time,
		})
	}

	return result, nil
}
