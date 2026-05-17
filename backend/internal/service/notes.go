package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
)

// NotesService handles notes operations
type NotesService struct {
	queries *db.Queries
	dbConn  *sql.DB
}

// NewNotesService creates a new notes service
func NewNotesService(queries *db.Queries, dbConn *sql.DB) *NotesService {
	return &NotesService{
		queries: queries,
		dbConn:  dbConn,
	}
}

// CreateNote creates a new note attached to a patient
// patientID can be empty if creating a draft note without a patient (e.g., from recording processing)
// The patient can be linked later when the session is bound to a patient
// CRITICAL FIX: Validates organization_id for access control
func (s *NotesService) CreateNote(
	ctx context.Context,
	patientID, createdBy string,
	organizationID uuid.UUID,
	req *models.CreateNoteRequest,
) (*models.Note, error) {
	if createdBy == "" {
		return nil, errors.New("createdBy is required")
	}

	log.Printf("[NotesService] CreateNote called - patientID: '%s', createdBy: '%s', title: '%s', scribePageID: '%v', recordingID: '%v'",
		patientID, createdBy, req.Title, req.ScribePageID, req.RecordingID)

	var patientUUID uuid.UUID

	// Validate patient exists and belongs to organization
	if patientID != "" {
		var err error
		patientUUID, err = uuid.Parse(patientID)
		if err != nil {
			return nil, fmt.Errorf("invalid patientID: %w", err)
		}

		// CRITICAL FIX: Pass organization_id to validate patient belongs to user's org
		_, err = s.queries.GetPatientByID(ctx, db.GetPatientByIDParams{
			ID:             patientUUID,
			OrganizationID: organizationID,
		})
		if err != nil {
			if err == sql.ErrNoRows {
				return nil, errors.New("patient not found")
			}
			return nil, fmt.Errorf("failed to verify patient: %w", err)
		}
	}

	// Parse createdBy UUID
	createdByUUID := uuid.MustParse(createdBy)

	// Prepare optional IDs

	noteType := "scribe"
	if req.NoteType != nil && *req.NoteType != "" {
		noteType = *req.NoteType
	}

	// Marshal tags to JSON
	var tagsJSON pqtype.NullRawMessage
	if len(req.Tags) > 0 {
		tagsData, err := json.Marshal(req.Tags)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal tags: %w", err)
		}
		tagsJSON = pqtype.NullRawMessage{RawMessage: tagsData, Valid: true}
	}

	// Marshal metadata to JSON
	var metadataJSON pqtype.NullRawMessage
	if len(req.Metadata) > 0 {
		metadataData, err := json.Marshal(req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
		metadataJSON = pqtype.NullRawMessage{RawMessage: metadataData, Valid: true}
	}

	var scribePageID sql.NullString
	if req.ScribePageID != nil && *req.ScribePageID != "" {
		scribePageID = sql.NullString{String: *req.ScribePageID, Valid: true}
	}

	// Convert recording and encounter IDs to NullUUID
	var recordingUUID uuid.NullUUID
	if req.RecordingID != nil && *req.RecordingID != "" {
		parsedID, err := uuid.Parse(*req.RecordingID)
		if err == nil {
			recordingUUID = uuid.NullUUID{UUID: parsedID, Valid: true}
		}
	}

	var encounterUUID uuid.NullUUID
	if req.EncounterID != nil && *req.EncounterID != "" {
		parsedID, err := uuid.Parse(*req.EncounterID)
		if err == nil {
			encounterUUID = uuid.NullUUID{UUID: parsedID, Valid: true}
		}
	}

	// Patient ID can be null if creating without a patient
	patientIDParam := uuid.NullUUID{}
	if patientID != "" {
		patientIDParam = uuid.NullUUID{UUID: patientUUID, Valid: true}
	}

	// Determine note status (default: "draft")
	noteStatus := "draft"
	if req.Status != nil && *req.Status != "" {
		noteStatus = *req.Status
	}

	note, err := s.queries.CreateNote(ctx, db.CreateNoteParams{
		PatientID:    patientIDParam,
		RecordingID:  recordingUUID,
		EncounterID:  encounterUUID,
		CreatedBy:    createdByUUID,
		Title:        req.Title,
		Content:      req.Content,
		NoteType:     noteType,
		Status:       noteStatus,
		ScribePageID: scribePageID,
		Tags:         tagsJSON,
		Metadata:     metadataJSON,
		Version:      sql.NullInt32{Int32: 1, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create note: %w", err)
	}

	// NEW: If scribe_page_id provided, link all unlinked recordings to this patient
	noteModel, err := s.convertDBNoteToModel(note)
	if err != nil {
		return nil, err
	}

	// Only link recordings if a patient was provided
	if patientID != "" && req.ScribePageID != nil && *req.ScribePageID != "" {
		// Get all unlinked recordings for this scribe session
		unlinkedRecordings, err := s.queries.GetUnlinkedRecordingsByScribeSession(ctx, sql.NullString{
			String: *req.ScribePageID,
			Valid:  true,
		})
		if err != nil && err != sql.ErrNoRows {
			// Log but don't fail - note was created successfully
			fmt.Printf("Warning: Failed to link recordings for scribe session: %v\n", err)
		} else {
			// Link each recording to the patient
			now := time.Now()
			for _, rec := range unlinkedRecordings {
				err := s.queries.LinkRecordingToPatient(ctx, db.LinkRecordingToPatientParams{
					PatientID:   uuid.NullUUID{UUID: patientUUID, Valid: true},
					EncounterID: encounterUUID,
					LinkedAt:    sql.NullTime{Time: now, Valid: true},
					UpdatedAt:   sql.NullTime{Time: now, Valid: true},
					ID:          rec.ID,
					UserID:      rec.UserID,
				})
				if err != nil {
					fmt.Printf("Warning: Failed to link recording %s: %v\n", rec.ID, err)
				}
			}
		}
	}

	return noteModel, nil
}

// UpdateNote updates an existing note
// UpdateNote updates an existing note with organization validation
// CRITICAL FIX: Requires organization_id parameter for access control
func (s *NotesService) UpdateNote(
	ctx context.Context,
	noteID, updatedBy string,
	organizationID uuid.UUID,
	req *models.UpdateNoteRequest,
) (*models.Note, error) {
	if noteID == "" {
		return nil, errors.New("noteID is required")
	}

	// Get existing note with org validation
	noteUUID := uuid.MustParse(noteID)
	existingNote, err := s.queries.GetNoteByID(ctx, db.GetNoteByIDParams{
		ID:             noteUUID,
		OrganizationID: organizationID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("note not found")
		}
		return nil, fmt.Errorf("failed to fetch note: %w", err)
	}

	// Prepare update fields with defaults from existing note
	title := existingNote.Title
	if req.Title != nil {
		title = *req.Title
	}

	content := existingNote.Content
	if req.Content != nil {
		content = *req.Content
	}

	noteType := existingNote.NoteType
	if req.NoteType != nil {
		noteType = *req.NoteType
	}

	status := existingNote.Status
	if req.Status != nil {
		status = *req.Status
	}

	// Marshal tags
	var tagsJSON pqtype.NullRawMessage = existingNote.Tags
	if len(req.Tags) > 0 {
		tagsData, err := json.Marshal(req.Tags)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal tags: %w", err)
		}
		tagsJSON = pqtype.NullRawMessage{RawMessage: tagsData, Valid: true}
	}

	// Marshal metadata
	var metadataJSON pqtype.NullRawMessage = existingNote.Metadata
	if len(req.Metadata) > 0 {
		metadataData, err := json.Marshal(req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
		metadataJSON = pqtype.NullRawMessage{RawMessage: metadataData, Valid: true}
	}

	updatedByUUID := uuid.NullUUID{}
	if updatedBy != "" {
		updatedByUUID = uuid.NullUUID{UUID: uuid.MustParse(updatedBy), Valid: true}
	}

	err = s.queries.UpdateNote(ctx, db.UpdateNoteParams{
		Title:     title,
		Content:   content,
		NoteType:  noteType,
		Status:    status,
		Tags:      tagsJSON,
		Metadata:  metadataJSON,
		UpdatedBy: updatedByUUID,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        noteUUID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	// Fetch updated note with org validation
	updatedNote, err := s.queries.GetNoteByID(ctx, db.GetNoteByIDParams{
		ID:             noteUUID,
		OrganizationID: organizationID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch updated note: %w", err)
	}

	return s.convertDBNoteToModel(updatedNote)
}

// GetNote retrieves a note by ID with organization validation
// CRITICAL FIX: Validates organization_id to prevent cross-org data access
func (s *NotesService) GetNote(ctx context.Context, noteID string, organizationID uuid.UUID) (*models.Note, error) {
	if noteID == "" {
		return nil, errors.New("noteID is required")
	}

	noteUUID := uuid.MustParse(noteID)

	// CRITICAL FIX: Pass organization_id to GetNoteByID to enforce org isolation
	note, err := s.queries.GetNoteByID(ctx, db.GetNoteByIDParams{
		ID:             noteUUID,
		OrganizationID: organizationID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("note not found")
		}
		return nil, fmt.Errorf("failed to fetch note: %w", err)
	}

	return s.convertDBNoteToModel(note)
}

// GetNotesByPatient retrieves all notes for a patient with organization validation
// CRITICAL FIX: Validates organization_id to prevent cross-org patient note access
func (s *NotesService) GetNotesByPatient(
	ctx context.Context,
	patientID string,
	organizationID uuid.UUID,
	limit, offset int32,
) ([]models.Note, int, error) {
	if patientID == "" {
		return nil, 0, errors.New("patientID is required")
	}

	patientUUID, err := uuid.Parse(patientID)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid patientID: %w", err)
	}

	// Get notes with org filtering
	notes, err := s.queries.GetNotesByPatient(ctx, db.GetNotesByPatientParams{
		PatientID:      uuid.NullUUID{UUID: patientUUID, Valid: true},
		Limit:          limit,
		OrganizationID: organizationID,
		Offset:         offset,
	})
	if err != nil && err != sql.ErrNoRows {
		return nil, 0, fmt.Errorf("failed to fetch notes: %w", err)
	}

	// Get total count
	count, err := s.queries.CountNotesByPatient(ctx, uuid.NullUUID{UUID: patientUUID, Valid: true})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count notes: %w", err)
	}

	var result []models.Note
	for _, note := range notes {
		modelNote, err := s.convertDBNoteToModel(note)
		if err == nil {
			result = append(result, *modelNote)
		}
	}

	return result, int(count), nil
}

// GetNotesByRecording retrieves all notes for a recording
func (s *NotesService) GetNotesByRecording(ctx context.Context, recordingID string) ([]models.Note, error) {
	if recordingID == "" {
		return nil, errors.New("recordingID is required")
	}

	recordingUUID, err := uuid.Parse(recordingID)
	if err != nil {
		return nil, fmt.Errorf("invalid recordingID: %w", err)
	}

	notes, err := s.queries.GetNotesByRecording(ctx, uuid.NullUUID{
		UUID:  recordingUUID,
		Valid: true,
	})
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to fetch notes: %w", err)
	}

	var result []models.Note
	for _, note := range notes {
		modelNote, err := s.convertDBNoteToModel(note)
		if err == nil {
			result = append(result, *modelNote)
		}
	}

	return result, nil
}

// GetNotesByScribePage retrieves all notes for a scribe page
func (s *NotesService) GetNotesByScribePage(ctx context.Context, scribePageID string) ([]models.Note, error) {
	if scribePageID == "" {
		return nil, errors.New("scribePageID is required")
	}

	notes, err := s.queries.GetNotesByScribePage(ctx, sql.NullString{
		String: scribePageID,
		Valid:  true,
	})
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to fetch notes: %w", err)
	}

	var result []models.Note
	for _, note := range notes {
		modelNote, err := s.convertDBNoteToModel(note)
		if err == nil {
			result = append(result, *modelNote)
		}
	}

	return result, nil
}

// SignNote signs a note with organization validation
// CRITICAL FIX: Requires organization_id for access control
func (s *NotesService) SignNote(ctx context.Context, noteID, signedBy string, organizationID uuid.UUID) (*models.Note, error) {
	if noteID == "" || signedBy == "" {
		return nil, errors.New("noteID and signedBy are required")
	}

	noteUUID := uuid.MustParse(noteID)
	signedByUUID := uuid.MustParse(signedBy)
	now := time.Now()

	err := s.queries.SignNote(ctx, db.SignNoteParams{
		SignedAt:  sql.NullTime{Time: now, Valid: true},
		SignedBy:  uuid.NullUUID{UUID: signedByUUID, Valid: true},
		UpdatedAt: sql.NullTime{Time: now, Valid: true},
		ID:        noteUUID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to sign note: %w", err)
	}

	// Fetch updated note with org validation
	note, err := s.queries.GetNoteByID(ctx, db.GetNoteByIDParams{
		ID:             noteUUID,
		OrganizationID: organizationID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch signed note: %w", err)
	}

	return s.convertDBNoteToModel(note)
}

// UpdateNoteStatus updates the status of a note with organization validation
// CRITICAL FIX: Requires organization_id for access control
func (s *NotesService) UpdateNoteStatus(ctx context.Context, noteID, status string, organizationID uuid.UUID) (*models.Note, error) {
	if noteID == "" || status == "" {
		return nil, errors.New("noteID and status are required")
	}

	noteUUID := uuid.MustParse(noteID)

	err := s.queries.UpdateNoteStatus(ctx, db.UpdateNoteStatusParams{
		Status:    status,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        noteUUID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update note status: %w", err)
	}

	// Fetch updated note with org validation
	note, err := s.queries.GetNoteByID(ctx, db.GetNoteByIDParams{
		ID:             noteUUID,
		OrganizationID: organizationID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch updated note: %w", err)
	}

	return s.convertDBNoteToModel(note)
}

// DeleteNote deletes a note with organization validation
// CRITICAL FIX: Requires organization_id for access control
func (s *NotesService) DeleteNote(ctx context.Context, noteID string, organizationID uuid.UUID) error {
	if noteID == "" {
		return errors.New("noteID is required")
	}

	// Verify note exists and belongs to organization
	noteUUID := uuid.MustParse(noteID)
	_, err := s.queries.GetNoteByID(ctx, db.GetNoteByIDParams{
		ID:             noteUUID,
		OrganizationID: organizationID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("note not found")
		}
		return fmt.Errorf("failed to verify note: %w", err)
	}

	err = s.queries.DeleteNote(ctx, noteUUID)
	if err != nil {
		return fmt.Errorf("failed to delete note: %w", err)
	}

	return nil
}

// SearchNotes searches for notes by title or content
func (s *NotesService) SearchNotes(
	ctx context.Context,
	patientID, query string,
	limit, offset int32,
) ([]models.Note, int, error) {
	if patientID == "" || query == "" {
		return nil, 0, errors.New("patientID and query are required")
	}

	patientUUID, err := uuid.Parse(patientID)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid patientID: %w", err)
	}

	searchQuery := "%" + query + "%"

	notes, err := s.queries.SearchNotes(ctx, db.SearchNotesParams{
		PatientID: uuid.NullUUID{UUID: patientUUID, Valid: true},
		Title:     searchQuery,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil && err != sql.ErrNoRows {
		return nil, 0, fmt.Errorf("failed to search notes: %w", err)
	}

	// Get total count (approximation using same query)
	count, err := s.queries.CountNotesByPatient(ctx, uuid.NullUUID{UUID: patientUUID, Valid: true})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count notes: %w", err)
	}

	var result []models.Note
	for _, note := range notes {
		modelNote, err := s.convertDBNoteToModel(note)
		if err == nil {
			result = append(result, *modelNote)
		}
	}

	return result, int(count), nil
}

// Helper function to convert DB note to model
func (s *NotesService) convertDBNoteToModel(dbNote db.Note) (*models.Note, error) {
	var patientID *string
	if dbNote.PatientID.Valid {
		patientIDStr := dbNote.PatientID.UUID.String()
		patientID = &patientIDStr
	}

	var recordingID *string
	if dbNote.RecordingID.Valid {
		recordingIDStr := dbNote.RecordingID.UUID.String()
		recordingID = &recordingIDStr
	}

	var encounterID *string
	if dbNote.EncounterID.Valid {
		encounterIDStr := dbNote.EncounterID.UUID.String()
		encounterID = &encounterIDStr
	}

	var updatedBy *string
	if dbNote.UpdatedBy.Valid {
		updatedByStr := dbNote.UpdatedBy.UUID.String()
		updatedBy = &updatedByStr
	}

	var tags json.RawMessage
	if dbNote.Tags.Valid {
		tags = dbNote.Tags.RawMessage
	}

	var metadata json.RawMessage
	if dbNote.Metadata.Valid {
		metadata = dbNote.Metadata.RawMessage
	}

	var signedAt *time.Time
	if dbNote.SignedAt.Valid {
		signedAt = &dbNote.SignedAt.Time
	}

	var signedBy *string
	if dbNote.SignedBy.Valid {
		signedByStr := dbNote.SignedBy.UUID.String()
		signedBy = &signedByStr
	}

	var scribePageID *string
	if dbNote.ScribePageID.Valid {
		scribePageID = &dbNote.ScribePageID.String
	}

	// Handle IsSigned
	isSigned := false
	if dbNote.IsSigned.Valid {
		isSigned = dbNote.IsSigned.Bool
	}

	// Handle Version
	version := 1
	if dbNote.Version.Valid {
		version = int(dbNote.Version.Int32)
	}

	// If PatientID is nil, use empty string for backward compatibility
	patientIDStr := ""
	if patientID != nil {
		patientIDStr = *patientID
	}

	return &models.Note{
		ID:           dbNote.ID.String(),
		PatientID:    patientIDStr,
		RecordingID:  recordingID,
		EncounterID:  encounterID,
		CreatedBy:    dbNote.CreatedBy.String(),
		UpdatedBy:    updatedBy,
		Title:        dbNote.Title,
		Content:      dbNote.Content,
		NoteType:     dbNote.NoteType,
		Status:       dbNote.Status,
		ScribePageID: scribePageID,
		Tags:         tags,
		Metadata:     metadata,
		IsSigned:     isSigned,
		SignedAt:     signedAt,
		SignedBy:     signedBy,
		Version:      version,
		CreatedAt:    dbNote.CreatedAt.Time,
		UpdatedAt:    dbNote.UpdatedAt.Time,
	}, nil
}
