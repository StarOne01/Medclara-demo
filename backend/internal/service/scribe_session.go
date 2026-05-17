package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

// formatTimestamp converts sql.NullTime to ISO 8601 string for JSON serialization
// Returns empty string if the time is NULL/invalid
func formatTimestamp(t sql.NullTime) string {
	if t.Valid {
		return t.Time.Format(time.RFC3339)
	}
	return ""
} // ScribeSessionService provides business logic for scribe sessions
type ScribeSessionService struct {
	db *sql.DB
}

// NewScribeSessionService creates a new scribe session service
func NewScribeSessionService(database *sql.DB) *ScribeSessionService {
	return &ScribeSessionService{
		db: database,
	}
}

// CreateSessionInput represents input for creating a new session
type CreateSessionInput struct {
	SessionID        string                 `json:"sessionId"`
	UserID           uuid.UUID              `json:"user_id"`
	TemplateID       uuid.UUID              `json:"template_id"`
	InitialPatientID *uuid.UUID             `json:"initial_patient_id"`
	Metadata         map[string]interface{} `json:"metadata"`
}

// CreateSession creates a new scribe session
func (s *ScribeSessionService) CreateSession(ctx context.Context, input CreateSessionInput) (*db.ScribeSession, error) {
	queries := db.New(s.db)

	if input.SessionID == "" {
		return nil, fmt.Errorf("sessionId is required")
	}

	template, err := queries.GetTemplateByID(ctx, input.TemplateID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("template not found")
		}
		return nil, fmt.Errorf("failed to validate template: %w", err)
	}

	if !template.IsActive.Valid || !template.IsActive.Bool {
		return nil, fmt.Errorf("template is not active")
	}

	var metadataJSON pqtype.NullRawMessage
	if input.Metadata != nil {
		data, err := json.Marshal(input.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
		metadataJSON = pqtype.NullRawMessage{RawMessage: json.RawMessage(data), Valid: true}
	}

	expiresAt := time.Now().AddDate(0, 0, 30)

	var patientIDParam uuid.NullUUID
	if input.InitialPatientID != nil {
		patientIDParam = uuid.NullUUID{UUID: *input.InitialPatientID, Valid: true}
	}

	session, err := queries.CreateScribeSession(ctx, db.CreateScribeSessionParams{
		SessionID:   input.SessionID,
		UserID:      input.UserID,
		PatientID:   patientIDParam,
		EncounterID: uuid.NullUUID{},
		TemplateID:  input.TemplateID,
		Status:      "initialized",
		Metadata:    metadataJSON,
		ExpiresAt:   sql.NullTime{Time: expiresAt, Valid: true},
	})

	if err != nil {
		// Check if it's a duplicate key error (session already exists)
		if strings.Contains(err.Error(), "duplicate key") {
			return nil, fmt.Errorf("session already exists: %s", input.SessionID)
		}
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	_ = s.logAuditEvent(ctx, input.SessionID, input.UserID, "create", "session", input.SessionID, pqtype.NullRawMessage{}, metadataJSON)

	return &session, nil
}

// GetSessionData retrieves comprehensive session data
func (s *ScribeSessionService) GetSessionData(ctx context.Context, sessionID string, userID uuid.UUID) (map[string]interface{}, error) {
	queries := db.New(s.db)

	session, err := queries.GetScribeSession(ctx, sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to retrieve session: %w", err)
	}

	if session.UserID != userID {
		return nil, fmt.Errorf("access denied")
	}

	// Get user to retrieve organization ID
	user, err := queries.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", err)
	}
	userOrgID := user.OrganizationID.UUID

	response := map[string]interface{}{
		"sessionId":  session.SessionID,
		"status":     session.Status,
		"created_at": formatTimestamp(session.CreatedAt),
		"updated_at": formatTimestamp(session.UpdatedAt),
		"expires_at": formatTimestamp(session.ExpiresAt),
	}

	if session.PatientID.Valid {
		patient, err := queries.GetPatientByID(ctx, db.GetPatientByIDParams{
			ID:             session.PatientID.UUID,
			OrganizationID: userOrgID,
		})
		if err == nil {
			response["patient"] = map[string]interface{}{
				"id":                    patient.ID.String(),
				"first_name":            patient.FirstName,
				"last_name":             patient.LastName,
				"date_of_birth":         patient.DateOfBirth,
				"gender":                patient.Gender.String,
				"email":                 patient.Email.String,
				"phone":                 patient.Phone.String,
				"medical_record_number": patient.MedicalRecordNumber.String,
			}
		}
	}

	if session.EncounterID.Valid {
		encounter, err := queries.GetEncounterByID(ctx, db.GetEncounterByIDParams{
			ID:             session.EncounterID.UUID,
			OrganizationID: userOrgID,
		})
		if err == nil {
			response["encounter"] = map[string]interface{}{
				"id":             encounter.ID.String(),
				"patient_id":     encounter.PatientID.String(),
				"encounter_type": encounter.EncounterType.String,
				"status":         encounter.Status,
				"notes":          encounter.Notes.String,
				"created_at":     formatTimestamp(encounter.CreatedAt),
				"updated_at":     formatTimestamp(encounter.UpdatedAt),
			}
		}
	}

	template, err := queries.GetTemplateByID(ctx, session.TemplateID)
	if err == nil {
		response["template"] = map[string]interface{}{
			"id":           template.ID.String(),
			"template_key": template.TemplateKey,
			"label":        template.Label,
			"specialty":    template.Specialty.String,
		}
	}

	// Retrieve notes associated with this session
	notes, err := queries.GetSessionNotes(ctx, db.GetSessionNotesParams{
		ScribePageID: sql.NullString{String: sessionID, Valid: true},
		Limit:        100,
		Offset:       0,
	})

	if err == nil && len(notes) > 0 {
		// Build notesSections map from retrieved notes
		// Notes store sections as individual records linked to the session
		noteSections := make(map[string]interface{})

		// For now, we retrieve the first note's content
		// In future, you may want to parse structured sections from the note
		if notes[0].Content != "" {
			// Try to unmarshal content as JSON to get individual sections
			var sectionsData map[string]interface{}
			if err := json.Unmarshal([]byte(notes[0].Content), &sectionsData); err == nil {
				noteSections = sectionsData
			} else {
				// If content is not JSON, treat the entire content as a generic section
				noteSections["content"] = notes[0].Content
			}
		}

		// Add note metadata
		response["notesSections"] = noteSections
		response["noteMetadata"] = map[string]interface{}{
			"noteId":    notes[0].ID.String(),
			"status":    notes[0].Status,
			"createdAt": formatTimestamp(notes[0].CreatedAt),
			"updatedAt": formatTimestamp(notes[0].UpdatedAt),
			"createdBy": notes[0].CreatedBy.String(),
		}
	}

	return response, nil
}

// UpdateNoteSectionInput represents input for updating a note section
type UpdateNoteSectionInput struct {
	SessionID   string
	SectionKey  string `json:"section_key"`
	Content     string `json:"content"`
	EncounterID *string
	UserID      uuid.UUID
}

// UpdateNoteSection updates a note section within a session
func (s *ScribeSessionService) UpdateNoteSection(ctx context.Context, input UpdateNoteSectionInput) (map[string]interface{}, error) {
	if input.SectionKey == "" {
		return nil, fmt.Errorf("section_key is required")
	}

	queries := db.New(s.db)

	session, err := queries.GetScribeSession(ctx, input.SessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to retrieve session: %w", err)
	}

	if session.UserID != input.UserID {
		return nil, fmt.Errorf("access denied")
	}

	notes, err := queries.GetSessionNotes(ctx, db.GetSessionNotesParams{
		ScribePageID: sql.NullString{String: input.SessionID, Valid: true},
		Limit:        10,
		Offset:       0,
	})

	var noteID uuid.UUID
	var noteSections map[string]interface{} = make(map[string]interface{})

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to retrieve notes: %w", err)
	}

	if len(notes) == 0 {
		if session.PatientID.Valid {
			// Initialize sections with the new content
			noteSections[input.SectionKey] = input.Content
			sectionsJSON, _ := json.Marshal(noteSections)

			newNote, err := queries.CreateNote(ctx, db.CreateNoteParams{
				PatientID:    session.PatientID,
				RecordingID:  uuid.NullUUID{},
				EncounterID:  session.EncounterID,
				CreatedBy:    input.UserID,
				Title:        fmt.Sprintf("Scribe Session %s", input.SessionID),
				Content:      string(sectionsJSON),
				NoteType:     "scribe",
				Status:       "draft",
				ScribePageID: sql.NullString{String: input.SessionID, Valid: true},
				Tags:         pqtype.NullRawMessage{},
				Metadata:     pqtype.NullRawMessage{},
				Version:      sql.NullInt32{Int32: 1, Valid: true},
			})
			if err != nil {
				return nil, fmt.Errorf("failed to create note: %w", err)
			}
			noteID = newNote.ID
		} else {
			return nil, fmt.Errorf("cannot create note without patient linked")
		}
	} else {
		noteID = notes[0].ID
		// Parse existing sections and update with new content
		if notes[0].Content != "" {
			if err := json.Unmarshal([]byte(notes[0].Content), &noteSections); err != nil {
				// If existing content is not JSON, preserve it as a fallback
				log.Printf("Warning: Could not parse existing note content as JSON: %v", err)
				noteSections = make(map[string]interface{})
			}
		}
		// Update the specific section
		noteSections[input.SectionKey] = input.Content
	}

	now := time.Now()
	// Store the entire sections map as JSON in the content field
	sectionsJSON, _ := json.Marshal(noteSections)

	err = queries.UpdateNote(ctx, db.UpdateNoteParams{
		ID:        noteID,
		Title:     fmt.Sprintf("Scribe Session %s", input.SessionID),
		Content:   string(sectionsJSON),
		NoteType:  "scribe",
		Status:    "draft",
		Tags:      pqtype.NullRawMessage{},
		Metadata:  pqtype.NullRawMessage{},
		UpdatedBy: uuid.NullUUID{UUID: input.UserID, Valid: true},
		UpdatedAt: sql.NullTime{Time: now, Valid: true},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	oldValue := map[string]interface{}{"section": input.SectionKey}
	newValue := map[string]interface{}{"section": input.SectionKey, "content": input.Content}
	oldJSON, _ := json.Marshal(oldValue)
	newJSON, _ := json.Marshal(newValue)
	_ = s.logAuditEvent(ctx, input.SessionID, input.UserID, "update_note_section", "note_section", input.SectionKey,
		pqtype.NullRawMessage{RawMessage: json.RawMessage(oldJSON), Valid: true},
		pqtype.NullRawMessage{RawMessage: json.RawMessage(newJSON), Valid: true})

	return map[string]interface{}{
		"sessionId":     input.SessionID,
		"section_key":   input.SectionKey,
		"content":       input.Content,
		"notesSections": noteSections,
		"updated_by":    input.UserID.String(),
		"updated_at":    now,
	}, nil
}

// BindPatientInput represents input for binding a patient
type BindPatientInput struct {
	SessionID   string
	PatientID   uuid.UUID
	EncounterID *uuid.UUID
	UserID      uuid.UUID
}

// BindPatient binds a patient to a session
func (s *ScribeSessionService) BindPatient(ctx context.Context, input BindPatientInput) (map[string]interface{}, error) {
	if input.PatientID == uuid.Nil {
		return nil, fmt.Errorf("patient_id is required")
	}

	queries := db.New(s.db)

	session, err := queries.GetScribeSession(ctx, input.SessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to retrieve session: %w", err)
	}

	if session.UserID != input.UserID {
		return nil, fmt.Errorf("access denied")
	}

	// Get user to retrieve organization ID
	user, err := queries.GetUserByID(ctx, input.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", err)
	}
	userOrgID := user.OrganizationID.UUID

	_, err = queries.GetPatientByID(ctx, db.GetPatientByIDParams{
		ID:             input.PatientID,
		OrganizationID: userOrgID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("patient not found")
		}
		return nil, fmt.Errorf("failed to retrieve patient: %w", err)
	}

	var encounterID uuid.UUID
	if input.EncounterID != nil && *input.EncounterID != uuid.Nil {
		encounterID = *input.EncounterID
		encounter, err := queries.GetEncounterByID(ctx, db.GetEncounterByIDParams{
			ID:             encounterID,
			OrganizationID: userOrgID,
		})
		if err != nil {
			if err == sql.ErrNoRows {
				return nil, fmt.Errorf("encounter not found")
			}
			return nil, fmt.Errorf("failed to retrieve encounter: %w", err)
		}
		if encounter.PatientID != input.PatientID {
			return nil, fmt.Errorf("encounter does not belong to patient")
		}
	} else {
		newEncounter, err := queries.CreateEncounter(ctx, db.CreateEncounterParams{
			PatientID:     input.PatientID,
			UserID:        input.UserID,
			EncounterType: sql.NullString{String: "office_visit", Valid: true},
			Status:        "active",
			Notes:         sql.NullString{String: fmt.Sprintf("Scribe session %s", input.SessionID), Valid: true},
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create encounter: %w", err)
		}
		encounterID = newEncounter.ID
	}

	now := time.Now()
	_, err = queries.BindPatientToSession(ctx, db.BindPatientToSessionParams{
		PatientID:   uuid.NullUUID{UUID: input.PatientID, Valid: true},
		EncounterID: uuid.NullUUID{UUID: encounterID, Valid: true},
		UpdatedAt:   sql.NullTime{Time: now, Valid: true},
		SessionID:   input.SessionID,
		Version:     session.Version,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to bind patient: %w", err)
	}

	// Verify the update actually applied. The generated query uses an
	// optimistic-locking version check and may succeed with no rows affected
	// (no error) if the version changed concurrently. Re-fetch the session
	// and ensure the patient_id was set to the requested value.
	updatedSession, err := queries.GetScribeSession(ctx, input.SessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify session after bind: %w", err)
	}
	if !updatedSession.PatientID.Valid || updatedSession.PatientID.UUID != input.PatientID {
		return nil, fmt.Errorf("bind did not apply; possible concurrent modification, please retry")
	}

	// Update any notes for this session to have the patient_id set
	// This handles notes created during recording processing before patient was bound
	notes, err := queries.GetSessionNotes(ctx, db.GetSessionNotesParams{
		ScribePageID: sql.NullString{String: input.SessionID, Valid: true},
		Limit:        1000,
		Offset:       0,
	})
	if err == nil {
		for _, note := range notes {
			if !note.PatientID.Valid { // Only update if patient_id is not already set
				err := queries.UpdateNotePatient(ctx, db.UpdateNotePatientParams{
					PatientID: uuid.NullUUID{UUID: input.PatientID, Valid: true},
					UpdatedAt: sql.NullTime{Time: now, Valid: true},
					ID:        note.ID,
				})
				if err != nil {
					log.Printf("Warning: Failed to update note %s with patient: %v", note.ID, err)
				}
			}
		}
	}

	auditData := map[string]interface{}{
		"patient_id":   input.PatientID.String(),
		"encounter_id": encounterID.String(),
	}
	auditJSON, _ := json.Marshal(auditData)
	_ = s.logAuditEvent(ctx, input.SessionID, input.UserID, "bind_patient", "patient_binding", input.PatientID.String(),
		pqtype.NullRawMessage{},
		pqtype.NullRawMessage{RawMessage: json.RawMessage(auditJSON), Valid: true})

	return map[string]interface{}{
		"sessionId":    input.SessionID,
		"patient_id":   input.PatientID.String(),
		"encounter_id": encounterID.String(),
		"status":       "linked",
		"linked_at":    now,
	}, nil
}

// ListUserSessions retrieves all sessions for a user
func (s *ScribeSessionService) ListUserSessions(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]db.ScribeSession, error) {
	queries := db.New(s.db)

	sessions, err := queries.GetScribeSessionsByUser(ctx, db.GetScribeSessionsByUserParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to retrieve sessions: %w", err)
	}

	return sessions, nil
}

// HandleExpiredSessions cleans up expired sessions
func (s *ScribeSessionService) HandleExpiredSessions(ctx context.Context) (int, error) {
	queries := db.New(s.db)

	expiredSessions, err := queries.GetExpiredSessions(ctx, 1000)
	if err != nil && err != sql.ErrNoRows {
		return 0, fmt.Errorf("failed to retrieve expired sessions: %w", err)
	}

	count := 0
	for _, session := range expiredSessions {
		err := queries.UpdateScribeSessionStatus(ctx, db.UpdateScribeSessionStatusParams{
			Status:    "archived",
			UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
			SessionID: session.SessionID,
		})
		if err != nil {
			log.Printf("Warning: failed to archive session %s: %v", session.SessionID, err)
		} else {
			count++
		}
	}

	return count, nil
}

func (s *ScribeSessionService) logAuditEvent(ctx context.Context, sessionID string, userID uuid.UUID, action, resourceType string, resourceID string, oldValue, newValue pqtype.NullRawMessage) error {
	queries := db.New(s.db)

	err := queries.CreateSessionAuditLog(ctx, db.CreateSessionAuditLogParams{
		SessionID:    sessionID,
		UserID:       userID,
		Action:       action,
		ResourceType: sql.NullString{String: resourceType, Valid: true},
		ResourceID:   sql.NullString{String: resourceID, Valid: true},
		OldValue:     oldValue,
		NewValue:     newValue,
		Metadata:     pqtype.NullRawMessage{},
	})

	if err != nil {
		log.Printf("Warning: failed to log audit event: %v", err)
		return err
	}

	return nil
}
