package service

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/StarOne01/Medclara-backend.git/config"
	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

// uploadSessionState tracks in-memory state for active upload sessions
type uploadSessionState struct {
	ChunksReceived  int32
	TotalSize       int64
	ExpiresAt       time.Time
	UploadStartTime time.Time
	LastUpdate      time.Time
	mu              sync.Mutex
}

// ChunkedUploadService handles chunked audio upload operations
type ChunkedUploadService struct {
	uploadDir       string
	sessionTimeout  time.Duration
	maxChunkSize    int64
	vertexAIService *VertexAIService
	dbConn          *sql.DB
	queries         *db.Queries
	// In-memory tracking of active upload sessions
	sessionStates   map[string]*uploadSessionState
	sessionStatesMu sync.RWMutex
}

const (
	// Default session timeout (2 hours)
	DefaultSessionTimeout = 2 * time.Hour
	// Default max chunk size (512 KB)
	DefaultMaxChunkSize = 512 * 1024
	// Chunk size for progressive processing (3 chunks = ~768KB)
	ProgressiveProcessingThreshold = 3
)

// NewChunkedUploadService creates a new chunked upload service
func NewChunkedUploadService(
	uploadDir string,
	vertexAI *VertexAIService,
	dbConn *sql.DB,
) *ChunkedUploadService {
	if uploadDir == "" {
		uploadDir = "./uploads/chunked"
	}

	// Ensure upload directory exists
	os.MkdirAll(uploadDir, 0755)

	return &ChunkedUploadService{
		uploadDir:       uploadDir,
		sessionTimeout:  DefaultSessionTimeout,
		maxChunkSize:    DefaultMaxChunkSize,
		vertexAIService: vertexAI,
		dbConn:          dbConn,
		queries:         db.New(dbConn),
		sessionStates:   make(map[string]*uploadSessionState),
	}
}

// InitializeUploadSession creates a new chunked upload session and stores recording ID
func (s *ChunkedUploadService) InitializeUploadSession(
	ctx context.Context,
	templateID, patientID, encounterID, scribeSessionID, userID string,
) (*models.ChunkedUploadSession, error) {
	// Validate required parameters
	if templateID == "" || userID == "" {
		return nil, errors.New("templateId and userID are required")
	}

	// Parse UUIDs for validation
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid userID: %w", err)
	}

	// Resolve templateID - accept both UUID and template key/name string formats
	templateUUID := uuid.Nil
	resolvedTemplateKey := templateID // Default to what was passed in

	log.Printf("[ChunkedUpload] INIT: Attempting to resolve template: %s", templateID)

	// Try parsing as UUID first
	if parsedUUID, err := uuid.Parse(templateID); err == nil {
		templateUUID = parsedUUID
		// If it was a UUID, we need to fetch the template to get its key
		template, err := s.queries.GetTemplateByID(ctx, templateUUID)
		if err != nil {
			if err == sql.ErrNoRows {
				log.Printf("[ChunkedUpload] INIT ERROR: Template UUID not found: %s", templateID)
				return nil, fmt.Errorf("template not found: %s", templateID)
			}
			log.Printf("[ChunkedUpload] INIT ERROR: Failed to lookup template by UUID: %v", err)
			return nil, fmt.Errorf("failed to lookup template: %w", err)
		}
		resolvedTemplateKey = template.TemplateKey
		log.Printf("[ChunkedUpload] INIT SUCCESS: Resolved UUID '%s' → template_key: '%s'", templateID, resolvedTemplateKey)
	} else {
		// Not a UUID, treat as template key/name and look it up in database
		log.Printf("[ChunkedUpload] INIT: Looking up by template_key: %s", templateID)
		template, err := s.queries.GetTemplateByKey(ctx, templateID)
		if err != nil {
			if err == sql.ErrNoRows {
				log.Printf("[ChunkedUpload] INIT ERROR: Template key not found in database: %s", templateID)
				return nil, fmt.Errorf("template not found: %s", templateID)
			}
			log.Printf("[ChunkedUpload] INIT ERROR: Database error looking up template key: %v", err)
			return nil, fmt.Errorf("failed to lookup template: %w", err)
		}
		templateUUID = template.ID
		resolvedTemplateKey = template.TemplateKey
		log.Printf("[ChunkedUpload] INIT SUCCESS: Resolved key '%s' → UUID: %s, TemplateKey: '%s'", templateID, templateUUID, resolvedTemplateKey)
	}

	var encounterUUID uuid.NullUUID
	if encounterID != "" {
		parsed, err := uuid.Parse(encounterID)
		if err != nil {
			return nil, fmt.Errorf("invalid encounterID: %w", err)
		}
		encounterUUID = uuid.NullUUID{UUID: parsed, Valid: true}
	}

	var patientUUID uuid.NullUUID
	if patientID != "" {
		parsed, err := uuid.Parse(patientID)
		if err != nil {
			return nil, fmt.Errorf("invalid patientID: %w", err)
		}
		patientUUID = uuid.NullUUID{UUID: parsed, Valid: true}
	}

	// Generate session ID and recording ID
	sessionID := "chunked-" + uuid.New().String()
	sessionUUID := uuid.New()

	// Calculate expiration time
	expiresAt := time.Now().Add(s.sessionTimeout)
	createdAt := time.Now()

	// Create session directory
	sessionDir := filepath.Join(s.uploadDir, sessionID)
	if err := os.MkdirAll(sessionDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create session directory: %w", err)
	}

	// Create recording in database with "uploading" status
	recordingRow, err := s.queries.CreateRecordingWithScribePage(ctx, db.CreateRecordingWithScribePageParams{
		EncounterID:          encounterUUID,
		UserID:               userUUID,
		PatientID:            patientUUID,
		TemplateID:           templateUUID,
		AudioFileUrl:         sql.NullString{String: "", Valid: false},
		AudioDurationSeconds: sql.NullInt32{},
		Status:               "uploading",
		ScribePageID:         sql.NullString{String: scribeSessionID, Valid: scribeSessionID != ""},
		IsLinked:             sql.NullBool{Bool: false, Valid: true},
	})
	if err != nil {
		log.Printf("Failed to create recording: %v", err)
		return nil, fmt.Errorf("failed to create recording: %w", err)
	}

	// Use the recording ID from the database insert, not a generated one
	recordingID := recordingRow.ID

	// Store session info in a metadata file for later retrieval
	log.Printf("[ChunkedUpload] INIT: Storing metadata with template_id='%s'", resolvedTemplateKey)
	sessionMetadata := map[string]interface{}{
		"recording_id":      recordingID.String(),
		"user_id":           userID,
		"template_id":       resolvedTemplateKey, // Store the resolved template key, not the UUID
		"encounter_id":      encounterID,
		"patient_id":        patientID,
		"scribe_session_id": scribeSessionID,
	}
	metadataBytes, _ := json.Marshal(sessionMetadata)
	metadataPath := filepath.Join(sessionDir, "session.json")
	os.WriteFile(metadataPath, metadataBytes, 0644)
	log.Printf("[ChunkedUpload] INIT: Metadata file created at: %s", metadataPath)

	// Register session state in memory immediately
	s.sessionStatesMu.Lock()
	s.sessionStates[sessionID] = &uploadSessionState{
		ChunksReceived:  0,
		TotalSize:       0,
		ExpiresAt:       expiresAt,
		UploadStartTime: createdAt,
		LastUpdate:      createdAt,
	}
	s.sessionStatesMu.Unlock()

	log.Printf("Initialized chunked upload session: %s, recording: %s", sessionID, recordingID)

	return &models.ChunkedUploadSession{
		ID:              sessionUUID.String(),
		SessionID:       sessionID,
		RecordingID:     recordingID.String(),
		UserID:          userID,
		TemplateID:      templateID,
		EncounterID:     &encounterID,
		PatientID:       &patientID,
		ScribeSessionID: &scribeSessionID,
		Status:          "active",
		TotalChunks:     0,
		ChunksReceived:  0,
		CreatedAt:       createdAt,
		ExpiresAt:       expiresAt,
		UploadStartTime: createdAt,
		TotalSizeBytes:  0,
	}, nil
}

// GetUploadSession retrieves session info from in-memory state
func (s *ChunkedUploadService) GetUploadSession(
	ctx context.Context,
	sessionID string,
) (*models.ChunkedUploadSession, error) {
	state := s.getOrCreateSessionState(sessionID)

	state.mu.Lock()
	chunksReceived := state.ChunksReceived
	totalSize := state.TotalSize
	expiresAt := state.ExpiresAt
	state.mu.Unlock()

	// Return basic session info from in-memory state
	return &models.ChunkedUploadSession{
		SessionID:       sessionID,
		Status:          "active",
		TotalChunks:     0,
		ChunksReceived:  chunksReceived,
		ExpiresAt:       expiresAt,
		UploadStartTime: state.UploadStartTime,
		TotalSizeBytes:  totalSize,
	}, nil
}

// UploadChunk stores a chunk and updates session metadata
func (s *ChunkedUploadService) UploadChunk(
	ctx context.Context,
	sessionID string,
	chunkIndex int32,
	totalChunks int32,
	isLastChunk bool,
	chunkData []byte,
) (*models.ChunkedUploadChunkResponse, error) {
	// Validate chunk size
	if int64(len(chunkData)) > s.maxChunkSize {
		return nil, fmt.Errorf("chunk too large: %d bytes (max %d)", len(chunkData), s.maxChunkSize)
	}

	// Get existing in-memory session state (don't create new one)
	s.sessionStatesMu.RLock()
	state, exists := s.sessionStates[sessionID]
	s.sessionStatesMu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	// Check if session is expired
	state.mu.Lock()
	if time.Now().After(state.ExpiresAt) {
		state.mu.Unlock()
		s.removeSessionState(sessionID)
		return nil, errors.New("session expired")
	}
	state.mu.Unlock()

	// Save chunk to disk (no ordering requirement)
	sessionDir := filepath.Join(s.uploadDir, sessionID)
	chunkPath := filepath.Join(sessionDir, fmt.Sprintf("chunk_%d.bin", chunkIndex))

	if err := os.WriteFile(chunkPath, chunkData, 0644); err != nil {
		return nil, fmt.Errorf("failed to save chunk: %w", err)
	}

	// Update in-memory state
	state.mu.Lock()
	state.TotalSize += int64(len(chunkData))
	state.LastUpdate = time.Now()
	state.ChunksReceived++
	newChunksReceived := state.ChunksReceived
	state.mu.Unlock()

	// Determine total chunks and calculate progress
	var newTotalChunks int32
	if totalChunks > 0 {
		newTotalChunks = totalChunks
	}

	progress := float64(0)
	if newTotalChunks > 0 {
		progress = (float64(newChunksReceived) / float64(newTotalChunks)) * 100
	}

	return &models.ChunkedUploadChunkResponse{
		ChunkIndex:     chunkIndex,
		SessionID:      sessionID,
		ChunksReceived: newChunksReceived,
		TotalChunks:    newTotalChunks,
		Progress:       progress,
		Message:        "Chunk received and buffered",
	}, nil
}

// FinalizeUploadSession assembles chunks, processes audio with Vertex AI, and returns analysis
func (s *ChunkedUploadService) FinalizeUploadSession(
	ctx context.Context,
	sessionID string,
	totalSize *int64,
) (*models.ChunkedUploadFinalizeResponse, error) {
	// Get in-memory session state
	state := s.getOrCreateSessionState(sessionID)

	state.mu.Lock()
	chunksReceived := state.ChunksReceived
	uploadStartTime := state.UploadStartTime
	state.mu.Unlock()

	// Get all chunks and assemble audio
	chunks, err := s.getSessionChunks(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get chunks: %w", err)
	}

	if len(chunks) == 0 {
		return nil, errors.New("no chunks found in session")
	}

	// Assemble audio from chunks
	sessionDir := filepath.Join(s.uploadDir, sessionID)
	audioPath := filepath.Join(sessionDir, "audio.webm")

	assembledAudio, err := s.assembleChunks(chunks)
	if err != nil {
		return nil, fmt.Errorf("failed to assemble chunks: %w", err)
	}

	// Write assembled audio to file
	if err := os.WriteFile(audioPath, assembledAudio, 0644); err != nil {
		return nil, fmt.Errorf("failed to write assembled audio: %w", err)
	}

	// Load session metadata to get recording ID and other info
	metadataPath := filepath.Join(sessionDir, "session.json")
	var sessionMetadata map[string]interface{}
	if metadataBytes, err := os.ReadFile(metadataPath); err == nil {
		json.Unmarshal(metadataBytes, &sessionMetadata)
	}

	recordingIDStr, ok := sessionMetadata["recording_id"].(string)
	if !ok {
		return nil, errors.New("invalid session metadata: missing recording_id")
	}

	recordingID, err := uuid.Parse(recordingIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid recording ID: %w", err)
	}

	templateIDStr, ok := sessionMetadata["template_id"].(string)
	if !ok {
		return nil, errors.New("invalid session metadata: missing template_id")
	}
	log.Printf("[ChunkedUpload] FINALIZE: Retrieved template_id from metadata: '%s'", templateIDStr)

	userIDStr, ok := sessionMetadata["user_id"].(string)
	if !ok {
		return nil, errors.New("invalid session metadata: missing user_id")
	}

	patientIDStr, ok := sessionMetadata["patient_id"].(string)
	patientID := uuid.NullUUID{}
	if patientIDStr != "" {
		parsed, err := uuid.Parse(patientIDStr)
		if err == nil {
			patientID = uuid.NullUUID{UUID: parsed, Valid: true}
		}
	}

	// Start background processing with all the recording data
	// Use config from environment if available
	var appConfig *config.Config
	if cfg, err := config.Load(); err == nil {
		appConfig = cfg
	}

	go s.processChunkedAudioInBackground(
		recordingID,
		userIDStr,
		templateIDStr,
		patientID,
		assembledAudio,
		uploadStartTime,
		appConfig,
	)

	// Clean up in-memory state
	s.removeSessionState(sessionID)

	// Calculate estimated processing time
	estimatedSeconds := int32(len(assembledAudio)/(16000*2)) + 10 // ~10 extra seconds for overhead

	return &models.ChunkedUploadFinalizeResponse{
		ID:                      recordingIDStr,
		RecordingID:             recordingIDStr,
		SessionID:               sessionID,
		Status:                  "processing",
		ChunksReceived:          chunksReceived,
		Message:                 "Upload complete. Processing started.",
		EstimatedProcessingTime: estimatedSeconds,
	}, nil
}
func (s *ChunkedUploadService) GetUploadStatus(
	ctx context.Context,
	sessionID string,
) (*models.ChunkedUploadStatusResponse, error) {
	// Get session from database
	session, err := s.GetUploadSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	// Get in-memory session state
	state := s.getOrCreateSessionState(sessionID)

	state.mu.Lock()
	chunksReceived := state.ChunksReceived
	state.mu.Unlock()

	// Calculate progress
	progress := float64(0)
	if session.TotalChunks > 0 {
		progress = (float64(chunksReceived) / float64(session.TotalChunks)) * 100
	}

	// Get missing chunks if not complete
	missingChunks := []int32{}
	if chunksReceived < session.TotalChunks {
		chunks, err := s.getSessionChunks(ctx, sessionID)
		if err == nil && chunks != nil {
			receivedIndexes := make(map[int32]bool)
			for _, chunk := range chunks {
				receivedIndexes[chunk.ChunkIndex] = true
			}

			for i := int32(0); i < session.TotalChunks; i++ {
				if !receivedIndexes[i] {
					missingChunks = append(missingChunks, i)
				}
			}
		}
	}

	status := "active"
	if session.Status == "finalized" {
		status = "completed"
	}

	return &models.ChunkedUploadStatusResponse{
		SessionID:      sessionID,
		Status:         status,
		TotalChunks:    session.TotalChunks,
		ChunksReceived: chunksReceived,
		Progress:       progress,
		RecordingID:    session.RecordingID,
		MissingChunks:  missingChunks,
	}, nil
}

// ResumeUploadSession extends session expiration for active uploads
func (s *ChunkedUploadService) ResumeUploadSession(
	ctx context.Context,
	sessionID string,
) (*models.ChunkedUploadResumeResponse, error) {
	// Get in-memory session state
	state := s.getOrCreateSessionState(sessionID)

	state.mu.Lock()
	state.ExpiresAt = time.Now().Add(s.sessionTimeout)
	state.mu.Unlock()

	// Get all chunks from disk to calculate missing ones
	chunks, err := s.getSessionChunks(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get chunks: %w", err)
	}

	receivedIndexes := make(map[int32]bool)
	for _, chunk := range chunks {
		receivedIndexes[chunk.ChunkIndex] = true
	}

	// For resume, we'll need the total chunks count from in-memory state
	// Since we don't have it stored permanently, we can infer from chunk files
	maxChunkIndex := int32(-1)
	for idx := range receivedIndexes {
		if idx > maxChunkIndex {
			maxChunkIndex = idx
		}
	}

	missingChunks := []int32{}
	if maxChunkIndex >= 0 {
		for i := int32(0); i <= maxChunkIndex; i++ {
			if !receivedIndexes[i] {
				missingChunks = append(missingChunks, i)
			}
		}
	}

	return &models.ChunkedUploadResumeResponse{
		SessionID:      sessionID,
		Status:         "resumed",
		ChunksToResend: missingChunks,
		Message:        "Session resumed. Ready to receive missing chunks.",
	}, nil
}

// processChunkedAudioInBackground handles async audio processing for chunked uploads
// This is similar to processAudioInBackground but tailored for chunked uploads
func (s *ChunkedUploadService) processChunkedAudioInBackground(
	recordingID uuid.UUID,
	userIDStr string,
	templateIDStr string,
	patientID uuid.NullUUID,
	audioData []byte,
	uploadStartTime time.Time,
	appConfig *config.Config,
) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic in processChunkedAudioInBackground for recording %s: %v", recordingID, r)
			markRecordingFailed(s.dbConn, recordingID, fmt.Sprintf("Processing panic: %v", r))
		}
	}()

	log.Printf("[ChunkedUpload] 🚀 START: processChunkedAudioInBackground for recording %s, audio size: %d bytes", recordingID, len(audioData))

	queries := db.New(s.dbConn)
	ctx := context.Background()
	startTime := time.Now()

	// CRITICAL FIX: Get user's organization for org-filtered queries
	userUUID := uuid.MustParse(userIDStr)
	user, err := queries.GetUserByID(ctx, userUUID)
	if err != nil {
		log.Printf("ERROR: Failed to get user %s: %v", userIDStr, err)
		return
	}

	// Extract org UUID - it should be valid for authenticated users
	var userOrgID uuid.UUID
	if user.OrganizationID.Valid {
		userOrgID = user.OrganizationID.UUID
	} else {
		log.Printf("ERROR: User %s has no organization ID", userIDStr)
		return
	}

	// Fetch patient data for context (if available)
	var patientData *models.PatientData
	if patientID.Valid {
		// CRITICAL FIX: Pass organization_id to GetPatientByID
		patient, err := queries.GetPatientByID(ctx, db.GetPatientByIDParams{
			ID:             patientID.UUID,
			OrganizationID: userOrgID,
		})
		if err == nil {
			var gender *string
			if patient.Gender.Valid {
				gender = &patient.Gender.String
			}
			patientData = &models.PatientData{
				ID:        patient.ID.String(),
				FirstName: patient.FirstName,
				LastName:  patient.LastName,
				Gender:    gender,
			}
		}
	}

	// Create default patient data if not provided
	if patientData == nil {
		log.Printf("No patient data provided for recording %s, using defaults", recordingID)
		patientData = &models.PatientData{
			FirstName: "Unknown",
			LastName:  "Patient",
		}
	}

	// Create Vertex AI service
	// The service constructor handles credential validation in production mode
	vertexService := NewVertexAIService(
		appConfig.GCPProjectID,
		appConfig.GCPLocation,
		appConfig.VertexAIModel,
		appConfig.VertexAIModelAdvanced,
		appConfig.VertexAIAPIKey,
		s.queries,
	)

	if vertexService == nil {
		log.Printf("Failed to create Vertex AI service for recording %s", recordingID)
		markRecordingFailed(s.dbConn, recordingID, "Failed to initialize processing service")
		return
	}

	// Process audio with Vertex AI
	analysis, err := vertexService.ProcessAudioRecording(
		ctx,
		bytes.NewReader(audioData),
		"audio/webm",
		templateIDStr,
		patientData,
	)

	if err != nil {
		log.Printf("Audio processing failed for recording %s: %v", recordingID, err)
		markRecordingFailed(s.dbConn, recordingID, fmt.Sprintf("Processing error: %v", err))
		return
	}

	// Check if analysis is nil
	if analysis == nil {
		log.Printf("Audio processing returned nil analysis for recording %s", recordingID)
		markRecordingFailed(s.dbConn, recordingID, "Processing returned empty analysis")
		return
	}

	// Validate analysis has required fields
	if analysis.ExtractedSections == nil {
		log.Printf("Analysis missing extracted sections for recording %s, initializing empty map", recordingID)
		analysis.ExtractedSections = make(map[string]models.ExtractionSection)
	}

	if analysis.Entities == nil {
		log.Printf("Analysis missing entities slice for recording %s, initializing empty slice", recordingID)
		analysis.Entities = []models.Entity{}
	}

	// Prepare analysis JSON
	analysisJSON, err := json.Marshal(analysis)
	if err != nil {
		log.Printf("Failed to marshal analysis for recording %s: %v", recordingID, err)
		markRecordingFailed(s.dbConn, recordingID, "Failed to marshal analysis results")
		return
	}

	// Extract full transcription from analysis
	var transcription string
	if analysis.Transcription != nil && analysis.Transcription.FullText != "" {
		transcription = analysis.Transcription.FullText
	} else {
		// Fallback: generate from extracted sections
		transcription = GenerateFullTranscription(analysis)
	}

	// Get total duration from analysis metadata
	totalDurationSeconds := int(analysis.TranscriptionMetadata.TotalDurationSeconds)
	if totalDurationSeconds == 0 {
		totalDurationSeconds = 300 // Default 5 minutes
	}

	// Generate transcript segments from analysis
	transcriptSegments := GenerateTranscriptSegments(analysis, totalDurationSeconds)

	// If we have speaker segments from the API, use those instead
	if analysis.Transcription != nil && len(analysis.Transcription.SpeakerSegments) > 0 {
		// Convert API speaker segments to model format
		for _, apiSegment := range analysis.Transcription.SpeakerSegments {
			transcriptSegments = append(transcriptSegments, models.TranscriptSegment{
				ID:               uuid.New().String(),
				RecordingID:      recordingID.String(),
				Speaker:          &apiSegment.Speaker,
				Text:             apiSegment.Text,
				StartTimeSeconds: func(t int) *float64 { f := float64(t); return &f }(apiSegment.StartTime),
				EndTimeSeconds:   func(t int) *float64 { f := float64(t); return &f }(apiSegment.EndTime),
				Confidence:       nil,
			})
		}
		// Sort by start time
		sort.Slice(transcriptSegments, func(i, j int) bool {
			if transcriptSegments[i].StartTimeSeconds == nil || transcriptSegments[j].StartTimeSeconds == nil {
				return false
			}
			return *transcriptSegments[i].StartTimeSeconds < *transcriptSegments[j].StartTimeSeconds
		})
	}

	// Calculate processing time
	processingTimeMs := int32(time.Since(startTime).Milliseconds())

	// Update recording with analysis and transcription
	recordingAnalysis := pqtype.NullRawMessage{RawMessage: analysisJSON, Valid: true}
	now := time.Now()

	log.Printf("[ChunkedUpload] ⏸️  About to update recording %s status to 'completed' (processing time: %dms)", recordingID, processingTimeMs)

	err = queries.UpdateRecordingAnalysis(ctx, db.UpdateRecordingAnalysisParams{
		Transcription:    sql.NullString{String: transcription, Valid: transcription != ""},
		Analysis:         recordingAnalysis,
		Status:           "completed",
		ProcessingTimeMs: sql.NullInt32{Int32: processingTimeMs, Valid: true},
		UpdatedAt:        sql.NullTime{Time: now, Valid: true},
		ID:               recordingID,
	})

	if err != nil {
		log.Printf("[ChunkedUpload] ❌ Failed to update recording %s with analysis: %v", recordingID, err)
		markRecordingFailed(s.dbConn, recordingID, "Failed to update recording with results")
		return
	}

	log.Printf("[ChunkedUpload] ✅ SUCCESS: Recording %s status updated to 'completed'", recordingID)

	// Create a note for this recording with the analysis content
	// The note is created without a patient initially; it will be linked when the session is bound to a patient
	// Fetch the updated recording to get scribe_page_id
	updatedRecording, err := queries.GetRecordingByID(ctx, db.GetRecordingByIDParams{
		ID:             recordingID,
		OrganizationID: uuid.NullUUID{UUID: userOrgID, Valid: true},
	})
	var scribeSessionID string
	if err == nil && updatedRecording.ScribePageID.Valid {
		scribeSessionID = updatedRecording.ScribePageID.String
	}

	log.Printf("[ChunkedUpload] 📝 Creating note for recording %s (scribeSessionID: %s)", recordingID, scribeSessionID)

	// Parse analysis to extract sections for note content
	var extractedSections map[string]interface{}
	if err := json.Unmarshal(analysisJSON, &analysis); err == nil {
		if analysis.ExtractedSections != nil {
			extractedSections = make(map[string]interface{})
			for key, section := range analysis.ExtractedSections {
				extractedSections[key] = section.Content
			}
		}
	}

	if extractedSections == nil {
		extractedSections = make(map[string]interface{})
	}

	// Convert extracted sections to JSON for note content
	noteContent, err := json.Marshal(extractedSections)
	if err != nil {
		noteContent = analysisJSON // Fallback to full analysis if conversion fails
	}

	// Create note (without patient initially - it will be set when patient is bound)
	log.Printf("[ChunkedUpload] 📝 Note request details - Title: 'Recording %s', ScribePageID: '%s', RecordingID: '%s'",
		recordingID.String()[:8], scribeSessionID, recordingID.String())

	noteReq := &models.CreateNoteRequest{
		Title:        fmt.Sprintf("Recording %s", recordingID.String()[:8]),
		Content:      string(noteContent),
		NoteType:     ptrString("scribe"),
		Status:       ptrString("completed"), // Note is completed since it has transcription/analysis
		ScribePageID: ptrString(scribeSessionID),
		RecordingID:  ptrString(recordingID.String()),
	}

	notesService := NewNotesService(queries, s.dbConn)
	// CRITICAL FIX: Pass organization_id to CreateNote
	createdNote, err := notesService.CreateNote(ctx, "", userIDStr, userOrgID, noteReq) // Empty patientID since patient may not be linked yet
	if err != nil {
		log.Printf("[ChunkedUpload] ⚠️  Warning: Failed to create note for recording %s: %v", recordingID, err)
		// Don't fail the whole operation - the recording is already processed and updated
	} else {
		if createdNote != nil {
			scribePageID := ""
			if createdNote.ScribePageID != nil {
				scribePageID = *createdNote.ScribePageID
			}
			log.Printf("[ChunkedUpload] ✅ Note created successfully - ID: %s, ScribePageID: %s, PatientID: %s",
				createdNote.ID, scribePageID, createdNote.PatientID)
		} else {
			log.Printf("[ChunkedUpload] ✅ Note created successfully for recording %s (but returned nil)", recordingID)
		}
	}

	// Store transcript segments in database
	segmentCount := 0
	for _, segment := range transcriptSegments {
		// Convert float64 pointers to sql.NullString for storage
		var startTimeStr, endTimeStr, confidenceStr sql.NullString

		if segment.StartTimeSeconds != nil {
			startTimeStr = sql.NullString{String: fmt.Sprintf("%.2f", *segment.StartTimeSeconds), Valid: true}
		}
		if segment.EndTimeSeconds != nil {
			endTimeStr = sql.NullString{String: fmt.Sprintf("%.2f", *segment.EndTimeSeconds), Valid: true}
		}
		if segment.Confidence != nil {
			confidenceStr = sql.NullString{String: fmt.Sprintf("%.2f", *segment.Confidence), Valid: true}
		}

		_, err := queries.CreateTranscriptSegment(ctx, db.CreateTranscriptSegmentParams{
			RecordingID:      recordingID,
			Speaker:          sql.NullString{String: getStringValue(segment.Speaker, ""), Valid: segment.Speaker != nil},
			Text:             segment.Text,
			StartTimeSeconds: startTimeStr,
			EndTimeSeconds:   endTimeStr,
			Confidence:       confidenceStr,
		})

		if err != nil {
			log.Printf("Failed to create transcript segment %d for recording %s: %v", segmentCount, recordingID, err)
		} else {
			segmentCount++
		}
	}

	uploadDuration := time.Since(uploadStartTime).Milliseconds()
	log.Printf("Successfully processed chunked recording %s: %d segments stored, upload duration: %d ms, processing time: %d ms",
		recordingID, segmentCount, uploadDuration, processingTimeMs)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// getSessionChunks retrieves all chunks from disk for a session
func (s *ChunkedUploadService) getSessionChunks(ctx context.Context, sessionID string) ([]chunkData, error) {
	sessionDir := filepath.Join(s.uploadDir, sessionID)

	// Read all chunk files from disk
	files, err := os.ReadDir(sessionDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read session directory: %w", err)
	}

	var chunks []chunkData
	for _, file := range files {
		if file.IsDir() || filepath.Ext(file.Name()) != ".bin" {
			continue
		}

		// Parse chunk filename to get index
		var chunkIndex int32
		_, err := fmt.Sscanf(file.Name(), "chunk_%d.bin", &chunkIndex)
		if err != nil {
			continue
		}

		info, err := file.Info()
		if err != nil {
			continue
		}

		chunkPath := filepath.Join(sessionDir, file.Name())
		chunks = append(chunks, chunkData{
			ChunkIndex:     chunkIndex,
			ChunkSizeBytes: int32(info.Size()),
			StoragePath:    chunkPath,
		})
	}

	// Sort chunks by index
	for i := 0; i < len(chunks)-1; i++ {
		for j := i + 1; j < len(chunks); j++ {
			if chunks[i].ChunkIndex > chunks[j].ChunkIndex {
				chunks[i], chunks[j] = chunks[j], chunks[i]
			}
		}
	}

	return chunks, nil
}

// assembleChunks combines all chunks in order
func (s *ChunkedUploadService) assembleChunks(chunks []chunkData) ([]byte, error) {
	if len(chunks) == 0 {
		return []byte{}, errors.New("no chunks to assemble")
	}

	// Read and concatenate all chunks
	var assembledData []byte
	for _, chunk := range chunks {
		data, err := os.ReadFile(chunk.StoragePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read chunk file: %w", err)
		}
		assembledData = append(assembledData, data...)
	}

	return assembledData, nil
}

// Internal chunk data structure
type chunkData struct {
	ChunkIndex     int32
	ChunkSizeBytes int32
	StoragePath    string
}

// ============================================
// SESSION STATE HELPERS
// ============================================

// getOrCreateSessionState gets or creates in-memory session state
func (s *ChunkedUploadService) getOrCreateSessionState(sessionID string) *uploadSessionState {
	s.sessionStatesMu.Lock()
	defer s.sessionStatesMu.Unlock()

	state, exists := s.sessionStates[sessionID]
	if !exists {
		now := time.Now()
		state = &uploadSessionState{
			ChunksReceived:  0,
			TotalSize:       0,
			ExpiresAt:       now.Add(s.sessionTimeout),
			UploadStartTime: now,
			LastUpdate:      now,
		}
		s.sessionStates[sessionID] = state
	}
	return state
}

// removeSessionState removes in-memory session state
func (s *ChunkedUploadService) removeSessionState(sessionID string) {
	s.sessionStatesMu.Lock()
	defer s.sessionStatesMu.Unlock()
	delete(s.sessionStates, sessionID)
}

// ============================================
// ERROR HANDLING HELPERS
// ============================================

// markRecordingFailed updates a recording record with error status
func markRecordingFailed(dbConn *sql.DB, recordingID uuid.UUID, errorMsg string) {
	queries := db.New(dbConn)
	ctx := context.Background()
	now := time.Now()

	// Use UpdateRecordingStatus which takes different parameters
	// First, let's check what parameters it expects by using UpdateRecordingStatus as fallback
	err := queries.UpdateRecordingStatus(ctx, db.UpdateRecordingStatusParams{
		Status:    "failed",
		UpdatedAt: sql.NullTime{Time: now, Valid: true},
		ID:        recordingID,
	})

	if err != nil {
		log.Printf("Failed to mark recording %s as failed: %v", recordingID, err)
	}
}

// ptrString returns a pointer to a string
func ptrString(s string) *string {
	return &s
}
