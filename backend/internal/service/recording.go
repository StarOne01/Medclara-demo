package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
)

// RecordingService handles recording operations
type RecordingService struct {
	queries         *db.Queries
	dbConn          *sql.DB
	vertexAIService *VertexAIService
}

// NewRecordingService creates a new recording service
func NewRecordingService(queries *db.Queries, dbConn *sql.DB, vertexAI *VertexAIService) *RecordingService {
	return &RecordingService{
		queries:         queries,
		dbConn:          dbConn,
		vertexAIService: vertexAI,
	}
}

// CreateRecording creates a new recording record
func (s *RecordingService) CreateRecording(
	ctx context.Context,
	encounterID, userID, patientID, templateID string,
	audioURL string,
	durationSeconds int32,
) (*models.Recording, error) {
	if userID == "" || patientID == "" || templateID == "" {
		return nil, errors.New("userID, patientID, and templateID are required")
	}

	// Parse UUIDs
	var encounterUUID uuid.NullUUID
	if encounterID != "" {
		parsedUUID, err := uuid.Parse(encounterID)
		if err != nil {
			return nil, fmt.Errorf("invalid encounterID: %w", err)
		}
		encounterUUID = uuid.NullUUID{UUID: parsedUUID, Valid: true}
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid userID: %w", err)
	}

	patientUUID, err := uuid.Parse(patientID)
	if err != nil {
		return nil, fmt.Errorf("invalid patientID: %w", err)
	}

	templateUUID, err := uuid.Parse(templateID)
	if err != nil {
		return nil, fmt.Errorf("invalid templateID: %w", err)
	}

	recordingID := uuid.New()
	now := time.Now()

	_, err = s.queries.CreateRecording(ctx, db.CreateRecordingParams{
		EncounterID:          encounterUUID,
		UserID:               userUUID,
		PatientID:            uuid.NullUUID{UUID: patientUUID, Valid: true},
		TemplateID:           templateUUID,
		AudioFileUrl:         sql.NullString{String: audioURL, Valid: audioURL != ""},
		AudioDurationSeconds: sql.NullInt32{Int32: durationSeconds, Valid: durationSeconds > 0},
		Status:               "processing",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create recording: %w", err)
	}

	return &models.Recording{
		ID:                   recordingID.String(),
		EncounterID:          encounterID,
		UserID:               userID,
		PatientID:            patientID,
		TemplateID:           templateID,
		AudioFileURL:         &audioURL,
		AudioDurationSeconds: &durationSeconds,
		Status:               "processing",
		CreatedAt:            now,
		UpdatedAt:            now,
	}, nil
}

// ProcessRecording processes an audio recording
func (s *RecordingService) ProcessRecording(
	ctx context.Context,
	recordingID string,
	audioData io.Reader,
	mimeType string,
	templateKey string,
	patientContext *models.PatientData,
) error {
	if recordingID == "" {
		return errors.New("recordingID is required")
	}

	// Parse recording UUID
	recordingUUID, err := uuid.Parse(recordingID)
	if err != nil {
		return fmt.Errorf("invalid recordingID: %w", err)
	}

	startTime := time.Now()

	// Get the recording
	// Note: Organization validation already done at handler level
	_, err = s.queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
		ID:             recordingUUID,
		OrganizationID: uuid.NullUUID{}, // Organization already validated at handler
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("recording not found")
		}
		return fmt.Errorf("failed to get recording: %w", err)
	}

	// Process with Vertex AI
	analysisResult, err := s.vertexAIService.ProcessAudioRecording(
		ctx,
		audioData,
		mimeType,
		templateKey,
		patientContext,
	)
	if err != nil {
		processingTimeMs := int32(time.Since(startTime).Milliseconds())
		errorMsg := err.Error()
		if err := s.queries.UpdateRecordingError(ctx, db.UpdateRecordingErrorParams{
			ProcessingError:  sql.NullString{String: errorMsg, Valid: true},
			Status:           "failed",
			ProcessingTimeMs: sql.NullInt32{Int32: processingTimeMs, Valid: true},
			UpdatedAt:        sql.NullTime{Time: time.Now(), Valid: true},
			ID:               recordingUUID,
		}); err != nil {
			return fmt.Errorf("failed to update recording error: %w", err)
		}
		return fmt.Errorf("vertex AI processing failed: %w", err)
	}

	// Extract full transcription text
	var transcriptionText string
	if analysisResult.Transcription != nil && analysisResult.Transcription.FullText != "" {
		transcriptionText = analysisResult.Transcription.FullText
	} else {
		// Fallback: generate from extracted sections
		transcriptionText = GenerateFullTranscription(analysisResult)
	}

	// Marshal analysis result to JSON
	analysisJSON, err := json.Marshal(analysisResult)
	if err != nil {
		return fmt.Errorf("failed to marshal analysis: %w", err)
	}

	// Update recording with analysis results
	processingTimeMs := int32(time.Since(startTime).Milliseconds())
	if err := s.queries.UpdateRecordingAnalysis(ctx, db.UpdateRecordingAnalysisParams{
		Transcription:    sql.NullString{String: transcriptionText, Valid: true},
		Analysis:         pqtype.NullRawMessage{RawMessage: analysisJSON, Valid: true},
		Status:           "completed",
		ProcessingTimeMs: sql.NullInt32{Int32: processingTimeMs, Valid: true},
		UpdatedAt:        sql.NullTime{Time: time.Now(), Valid: true},
		ID:               recordingUUID,
	}); err != nil {
		return fmt.Errorf("failed to update recording analysis: %w", err)
	}

	// Store transcript segments if available
	if analysisResult.Transcription != nil && len(analysisResult.Transcription.SpeakerSegments) > 0 {
		err = s.saveTranscriptSegments(ctx, recordingUUID, analysisResult.Transcription.SpeakerSegments)
		if err != nil {
			// Log error but don't fail the whole operation
			fmt.Printf("Warning: failed to save transcript segments: %v\n", err)
		}
	}

	// Extract and log entities
	s.extractAndLogEntities(analysisResult)

	return nil
}

// GetRecording retrieves a recording by ID
func (s *RecordingService) GetRecording(ctx context.Context, recordingID string) (*models.Recording, error) {
	// Parse recording UUID
	recordingUUID, err := uuid.Parse(recordingID)
	if err != nil {
		return nil, fmt.Errorf("invalid recordingID: %w", err)
	}

	rec, err := s.queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
		ID:             recordingUUID,
		OrganizationID: uuid.NullUUID{},
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("recording not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	var audioURL *string
	if rec.AudioFileUrl.Valid {
		audioURL = &rec.AudioFileUrl.String
	}

	var audioDuration *int32
	if rec.AudioDurationSeconds.Valid {
		audioDuration = &rec.AudioDurationSeconds.Int32
	}

	var transcription *string
	if rec.Transcription.Valid {
		transcription = &rec.Transcription.String
	}

	var analysis json.RawMessage
	if rec.Analysis.Valid {
		analysis = rec.Analysis.RawMessage
	}

	var processingError *string
	if rec.ProcessingError.Valid {
		processingError = &rec.ProcessingError.String
	}

	var processingTime *int32
	if rec.ProcessingTimeMs.Valid {
		processingTime = &rec.ProcessingTimeMs.Int32
	}

	var encounterID string
	if rec.EncounterID.Valid {
		encounterID = rec.EncounterID.UUID.String()
	}

	var patientID string
	if rec.PatientID.Valid {
		patientID = rec.PatientID.UUID.String()
	}

	return &models.Recording{
		ID:                   rec.ID.String(),
		EncounterID:          encounterID,
		UserID:               rec.UserID.String(),
		PatientID:            patientID,
		TemplateID:           rec.TemplateID.String(),
		AudioFileURL:         audioURL,
		AudioDurationSeconds: audioDuration,
		Status:               rec.Status,
		Transcription:        transcription,
		Analysis:             analysis,
		ProcessingError:      processingError,
		ProcessingTimeMs:     processingTime,
		CreatedAt:            rec.CreatedAt.Time,
		UpdatedAt:            rec.UpdatedAt.Time,
	}, nil
}

// GetRecordingsByEncounter retrieves all recordings for an encounter
func (s *RecordingService) GetRecordingsByEncounter(
	ctx context.Context,
	encounterID string,
	limit, offset int32,
) ([]models.Recording, int, error) {
	// Parse encounter UUID
	encounterUUID, err := uuid.Parse(encounterID)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid encounterID: %w", err)
	}

	recs, err := s.queries.GetRecordingsByEncounter(ctx, db.GetRecordingsByEncounterParams{
		EncounterID: uuid.NullUUID{UUID: encounterUUID, Valid: true},
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil && err != sql.ErrNoRows {
		return nil, 0, fmt.Errorf("database error: %w", err)
	}

	var result []models.Recording
	for _, rec := range recs {
		var audioURL *string
		if rec.AudioFileUrl.Valid {
			audioURL = &rec.AudioFileUrl.String
		}

		var audioDuration *int32
		if rec.AudioDurationSeconds.Valid {
			audioDuration = &rec.AudioDurationSeconds.Int32
		}

		var transcription *string
		if rec.Transcription.Valid {
			transcription = &rec.Transcription.String
		}

		var analysis json.RawMessage
		if rec.Analysis.Valid {
			analysis = rec.Analysis.RawMessage
		}

		var processingError *string
		if rec.ProcessingError.Valid {
			processingError = &rec.ProcessingError.String
		}

		var processingTime *int32
		if rec.ProcessingTimeMs.Valid {
			processingTime = &rec.ProcessingTimeMs.Int32
		}

		var encounterID string
		if rec.EncounterID.Valid {
			encounterID = rec.EncounterID.UUID.String()
		}

		var patientID string
		if rec.PatientID.Valid {
			patientID = rec.PatientID.UUID.String()
		}

		result = append(result, models.Recording{
			ID:                   rec.ID.String(),
			EncounterID:          encounterID,
			UserID:               rec.UserID.String(),
			PatientID:            patientID,
			TemplateID:           rec.TemplateID.String(),
			AudioFileURL:         audioURL,
			AudioDurationSeconds: audioDuration,
			Status:               rec.Status,
			Transcription:        transcription,
			Analysis:             analysis,
			ProcessingError:      processingError,
			ProcessingTimeMs:     processingTime,
			CreatedAt:            rec.CreatedAt.Time,
			UpdatedAt:            rec.UpdatedAt.Time,
		})
	}

	return result, len(result), nil
}

// DeleteRecording deletes a recording
func (s *RecordingService) DeleteRecording(ctx context.Context, recordingID string) error {
	// Parse recording UUID
	recordingUUID, err := uuid.Parse(recordingID)
	if err != nil {
		return fmt.Errorf("invalid recordingID: %w", err)
	}

	// Verify it exists
	if _, err := s.queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
		ID:             recordingUUID,
		OrganizationID: uuid.NullUUID{},
	}); err != nil {
		if err == sql.ErrNoRows {
			return errors.New("recording not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	if err := s.queries.DeleteRecording(ctx, recordingUUID); err != nil {
		return fmt.Errorf("failed to delete recording: %w", err)
	}

	return nil
}

// GenerateTranscriptSegments generates transcript segments from analysis results
// This converts semantic sections into chronological transcript segments
func GenerateTranscriptSegments(analysis *models.AnalysisResult, totalDurationSeconds int) []models.TranscriptSegment {
	segments := []models.TranscriptSegment{}

	if analysis == nil || len(analysis.ExtractedSections) == 0 {
		return segments
	}

	// Determine speaker roles from diarization data
	speakerRoles := make(map[int]string)
	if len(analysis.TranscriptionMetadata.SpeakerDiarization) > 0 {
		for i, speaker := range analysis.TranscriptionMetadata.SpeakerDiarization {
			speakerRoles[i] = speaker.Role
		}
	}

	// If no duration info, use default
	if totalDurationSeconds == 0 {
		totalDurationSeconds = 300 // 5 minutes default
	}

	// Map semantic roles to speaker roles (heuristic)
	// Typically: doctor speaks most parts, patient speaks about symptoms
	sectionToSpeaker := map[string]string{
		"patient_presenting_problem": "patient",
		"medical_history":            "patient",
		"vitals_and_measurements":    "doctor",
		"physical_findings":          "doctor",
		"clinical_assessment":        "doctor",
		"clinical_plan":              "doctor",
	}

	// Sort sections for consistent ordering
	sectionOrder := []string{
		"patient_presenting_problem",
		"medical_history",
		"vitals_and_measurements",
		"physical_findings",
		"clinical_assessment",
		"clinical_plan",
	}

	segmentCount := 0
	for _, sectionKey := range sectionOrder {
		section, exists := analysis.ExtractedSections[sectionKey]
		if !exists || section.Content == "" {
			continue
		}

		// Determine speaker
		speaker := sectionToSpeaker[sectionKey]
		if speaker == "" {
			speaker = "doctor" // Default to doctor
		}

		// Assign timing based on position (evenly distributed)
		totalSections := len(analysis.ExtractedSections)
		segmentDuration := float64(totalDurationSeconds) / float64(totalSections)
		startTime := segmentDuration * float64(segmentCount)
		endTime := startTime + segmentDuration

		segment := models.TranscriptSegment{
			ID:               uuid.New().String(),
			Speaker:          &speaker,
			Text:             section.Content,
			StartTimeSeconds: &startTime,
			EndTimeSeconds:   &endTime,
		}

		segments = append(segments, segment)
		segmentCount++
	}

	return segments
}

// GenerateFullTranscription creates a full transcription text from all sections
func GenerateFullTranscription(analysis *models.AnalysisResult) string {
	if analysis == nil || len(analysis.ExtractedSections) == 0 {
		return ""
	}

	transcription := ""

	// Define natural order for sections
	sectionLabels := map[string]string{
		"patient_presenting_problem": "Chief Complaint",
		"medical_history":            "History of Present Illness",
		"vitals_and_measurements":    "Vital Signs",
		"physical_findings":          "Physical Examination",
		"clinical_assessment":        "Assessment",
		"clinical_plan":              "Plan",
	}

	sectionOrder := []string{
		"patient_presenting_problem",
		"medical_history",
		"vitals_and_measurements",
		"physical_findings",
		"clinical_assessment",
		"clinical_plan",
	}

	for _, sectionKey := range sectionOrder {
		section, exists := analysis.ExtractedSections[sectionKey]
		if !exists || section.Content == "" {
			continue
		}

		label, hasLabel := sectionLabels[sectionKey]
		if !hasLabel {
			label = sectionKey
		}

		if transcription != "" {
			transcription += "\n\n"
		}

		transcription += fmt.Sprintf("## %s\n%s", label, section.Content)
	}

	return transcription
}

// saveTranscriptSegments stores individual transcript segments in the database
func (s *RecordingService) saveTranscriptSegments(
	ctx context.Context,
	recordingID uuid.UUID,
	segments []models.SpeakerSegment,
) error {
	// First delete any existing segments
	if err := s.queries.DeleteTranscriptSegmentsByRecording(ctx, recordingID); err != nil {
		fmt.Printf("Error deleting old transcript segments: %v\n", err)
		// Continue anyway
	}

	// Insert new segments
	for _, segment := range segments {
		var startTime, endTime sql.NullString
		if segment.StartTime > 0 {
			startTime = sql.NullString{String: fmt.Sprintf("%d", segment.StartTime), Valid: true}
		}
		if segment.EndTime > 0 {
			endTime = sql.NullString{String: fmt.Sprintf("%d", segment.EndTime), Valid: true}
		}

		_, err := s.queries.CreateTranscriptSegment(ctx, db.CreateTranscriptSegmentParams{
			RecordingID:      recordingID,
			Speaker:          sql.NullString{String: segment.Speaker, Valid: segment.Speaker != ""},
			Text:             segment.Text,
			StartTimeSeconds: startTime,
			EndTimeSeconds:   endTime,
			Confidence:       sql.NullString{},
		})

		if err != nil {
			fmt.Printf("Error creating transcript segment: %v\n", err)
			// Continue with other segments even if one fails
		}
	}

	return nil
}

// extractAndLogEntities extracts clinical entities and logs them for potential further processing
func (s *RecordingService) extractAndLogEntities(analysis *models.AnalysisResult) {
	if len(analysis.Entities) == 0 {
		return
	}

	fmt.Printf("Extracted %d entities from recording\n", len(analysis.Entities))

	// Group entities by type
	entitiesByType := make(map[string][]models.Entity)
	for _, entity := range analysis.Entities {
		entitiesByType[entity.Type] = append(entitiesByType[entity.Type], entity)
	}

	// Log grouped entities
	for entityType, entities := range entitiesByType {
		fmt.Printf("Found %d %s entities:\n", len(entities), entityType)
		for _, entity := range entities {
			fmt.Printf("  - %s (confidence: %.2f, section: %s)\n", entity.Value, entity.Confidence, entity.Section)
		}
	}

	// Log extracted sections
	fmt.Printf("\nExtracted %d sections:\n", len(analysis.ExtractedSections))
	for sectionKey, section := range analysis.ExtractedSections {
		fmt.Printf("  - %s (content length: %d chars)\n", sectionKey, len(section.Content))
	}

	// Log transcription metadata
	fmt.Printf("\nTranscription metadata:\n")
	fmt.Printf("  - Duration: %d seconds\n", analysis.TranscriptionMetadata.TotalDurationSeconds)
	fmt.Printf("  - Audio quality: %s\n", analysis.TranscriptionMetadata.AudioQuality)
	fmt.Printf("  - Speaker diarization:\n")
	for _, speaker := range analysis.TranscriptionMetadata.SpeakerDiarization {
		fmt.Printf("    - %s: %.1f%%\n", speaker.Role, speaker.Percentage)
	}
	fmt.Printf("  - Overall confidence: %.2f\n", analysis.ConfidenceScore)
}
