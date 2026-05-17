package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// Recording represents an audio recording with analysis results
type Recording struct {
	ID                   string          `json:"id"`
	EncounterID          string          `json:"encounterId"`
	UserID               string          `json:"userId"`
	PatientID            string          `json:"patientId"`
	TemplateID           string          `json:"templateId"`
	AudioFileURL         *string         `json:"audioFileUrl,omitempty"`
	AudioDurationSeconds *int32          `json:"audioDurationSeconds,omitempty"`
	Status               string          `json:"status"` // processing, completed, failed
	Transcription        *string         `json:"transcription,omitempty"`
	Analysis             json.RawMessage `json:"analysis,omitempty"`
	ProcessingError      *string         `json:"processingError,omitempty"`
	ProcessingTimeMs     *int32          `json:"processingTimeMs,omitempty"`
	CreatedAt            time.Time       `json:"createdAt"`
	UpdatedAt            time.Time       `json:"updatedAt"`
}

// RecordingUploadRequest is the multipart form data for uploading a recording
type RecordingUploadRequest struct {
	// Audio file handled by multipart/form-data
	TemplateID  *string `form:"template_id"`
	PatientID   *string `form:"patient_id"`
	EncounterID string  `form:"encounter_id" binding:"required"`
}

// AnalysisResult contains the output from Vertex AI analysis
type AnalysisResult struct {
	Transcription         *TranscriptionData           `json:"transcription,omitempty"`
	ExtractedSections     map[string]ExtractionSection `json:"extracted_sections"`
	Entities              []Entity                     `json:"entities"`
	TranscriptionMetadata TranscriptionMetadata        `json:"transcription_metadata"`
	ConfidenceScore       float64                      `json:"confidence_score"`
}

// TranscriptionData contains the full transcription and speaker segments
type TranscriptionData struct {
	FullText        string           `json:"full_text"`
	SpeakerSegments []SpeakerSegment `json:"speaker_segments"`
}

// SpeakerSegment represents a segment spoken by a particular speaker
type SpeakerSegment struct {
	Speaker   string `json:"speaker"`
	Text      string `json:"text"`
	StartTime int    `json:"start_time"`
	EndTime   int    `json:"end_time"`
}

// ExtractionSection represents extracted content for a semantic role
type ExtractionSection struct {
	Content string `json:"content"`
}

// Entity represents extracted clinical entities
type Entity struct {
	Type       string  `json:"type"` // medication, diagnosis, procedure, vital, etc.
	Value      string  `json:"value"`
	Confidence float64 `json:"confidence"`
	Section    string  `json:"section"` // Which section this entity relates to
}

// TranscriptionMetadata contains metadata about the transcription
type TranscriptionMetadata struct {
	TotalDurationSeconds int       `json:"total_duration_seconds"`
	SpeakerDiarization   []Speaker `json:"speaker_diarization"`
	AudioQuality         string    `json:"audio_quality"`
}

// Speaker represents a speaker in the recording
type Speaker struct {
	Role       string  `json:"role"` // Doctor, Patient, Nurse, etc.
	Percentage float64 `json:"percentage"`
}

// TranscriptSegment represents a segment of the transcription
type TranscriptSegment struct {
	ID               string    `json:"id"`
	RecordingID      string    `json:"recordingId"`
	Speaker          *string   `json:"speaker,omitempty"`
	Text             string    `json:"text"`
	StartTimeSeconds *float64  `json:"startTimeSeconds,omitempty"`
	EndTimeSeconds   *float64  `json:"endTimeSeconds,omitempty"`
	Confidence       *float64  `json:"confidence,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
}

// RecordingListResponse represents a list of recordings
type RecordingListResponse struct {
	Recordings []Recording `json:"recordings"`
	Total      int         `json:"total"`
	Limit      int         `json:"limit"`
	Offset     int         `json:"offset"`
}

// ProcessingStatus represents the status of recording processing
type ProcessingStatus struct {
	ID           string     `json:"id"`
	Status       string     `json:"status"`
	Progress     int        `json:"progress"` // 0-100
	ErrorMessage *string    `json:"error_message,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

// ============================================
// CHUNKED UPLOAD MODELS
// ============================================

// ChunkedUploadSession represents a chunked audio upload session
type ChunkedUploadSession struct {
	ID               string                 `json:"id"`
	SessionID        string                 `json:"sessionId"`
	RecordingID      string                 `json:"recordingId"`
	UserID           string                 `json:"userId"`
	TemplateID       string                 `json:"templateId"`
	EncounterID      *string                `json:"encounterId,omitempty"`
	PatientID        *string                `json:"patientId,omitempty"`
	ScribeSessionID  *string                `json:"scribeSessionId,omitempty"`
	Status           string                 `json:"status"` // active, finalized, expired, failed
	TotalChunks      int32                  `json:"totalChunks"`
	ChunksReceived   int32                  `json:"chunksReceived"`
	ChunkStoragePath *string                `json:"chunkStoragePath,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt        time.Time              `json:"createdAt"`
	ExpiresAt        time.Time              `json:"expiresAt"`
	FinalizedAt      *time.Time             `json:"finalizedAt,omitempty"`
	UploadStartTime  time.Time              `json:"uploadStartTime"`
	UploadEndTime    *time.Time             `json:"uploadEndTime,omitempty"`
	UploadDurationMs *int32                 `json:"uploadDurationMs,omitempty"`
	TotalSizeBytes   int64                  `json:"totalSizeBytes"`
}

// ChunkedUploadChunk represents a single chunk in a chunked upload session
type ChunkedUploadChunk struct {
	ID             string     `json:"id"`
	SessionID      string     `json:"sessionId"`
	ChunkIndex     int32      `json:"chunkIndex"`
	ChunkSizeBytes int32      `json:"chunkSizeBytes"`
	StoragePath    *string    `json:"storagePath,omitempty"`
	Checksum       *string    `json:"checksum,omitempty"`
	ReceivedAt     time.Time  `json:"receivedAt"`
	ProcessedAt    *time.Time `json:"processedAt,omitempty"`
}

// ChunkedUploadInitRequest is the request body for initializing a chunked upload
type ChunkedUploadInitRequest struct {
	TemplateID      string `json:"templateId" binding:"required"`
	PatientID       string `json:"patientId"`
	EncounterID     string `json:"encounterId"`
	ScribeSessionID string `json:"sessionId"`
	Timestamp       string `json:"timestamp"`
}

// ChunkedUploadInitResponse is the response for initializing a chunked upload
type ChunkedUploadInitResponse struct {
	SessionID      string    `json:"sessionId"`
	RecordingID    string    `json:"recordingId"`
	CreatedAt      time.Time `json:"createdAt"`
	ExpiresAt      time.Time `json:"expiresAt"`
	ExpectedChunks int32     `json:"expectedChunks"`
}

// ChunkedUploadChunkResponse is the response for uploading a chunk
type ChunkedUploadChunkResponse struct {
	ChunkIndex     int32   `json:"chunkIndex"`
	SessionID      string  `json:"sessionId"`
	ChunksReceived int32   `json:"chunksReceived"`
	TotalChunks    int32   `json:"totalChunks"`
	Progress       float64 `json:"progress"`
	Message        string  `json:"message"`
}

// ChunkedUploadFinalizeRequest is the request body for finalizing a chunked upload
type ChunkedUploadFinalizeRequest struct {
	SessionID string `json:"sessionId" binding:"required"`
	Timestamp string `json:"timestamp"`
	TotalSize *int64 `json:"totalSize,omitempty"` // Optional: total bytes of all chunks combined
}

// ChunkedUploadFinalizeResponse is the response for finalizing a chunked upload
type ChunkedUploadFinalizeResponse struct {
	ID                      string `json:"id"`
	RecordingID             string `json:"recordingId"`
	SessionID               string `json:"sessionId"`
	Status                  string `json:"status"`
	TotalChunks             int32  `json:"totalChunks"`
	ChunksReceived          int32  `json:"chunksReceived"`
	Message                 string `json:"message"`
	EstimatedProcessingTime int32  `json:"estimatedProcessingTime"`
}

// ChunkedUploadStatusResponse is the response for checking upload status
type ChunkedUploadStatusResponse struct {
	SessionID      string  `json:"sessionId"`
	Status         string  `json:"status"`
	TotalChunks    int32   `json:"totalChunks"`
	ChunksReceived int32   `json:"chunksReceived"`
	Progress       float64 `json:"progress"`
	RecordingID    string  `json:"recordingId"`
	MissingChunks  []int32 `json:"missingChunks,omitempty"`
}

// ChunkedUploadResumeRequest is the request body for resuming an upload
type ChunkedUploadResumeRequest struct {
	SessionID     string  `json:"sessionId" binding:"required"`
	MissingChunks []int32 `json:"missingChunks"`
	Timestamp     string  `json:"timestamp"`
}

// ChunkedUploadResumeResponse is the response for resuming an upload
type ChunkedUploadResumeResponse struct {
	SessionID      string  `json:"sessionId"`
	Status         string  `json:"status"`
	ChunksToResend []int32 `json:"chunksToResend"`
	Message        string  `json:"message"`
}

// Scan implements the sql.Scanner interface for AnalysisResult
func (a *AnalysisResult) Scan(value interface{}) error {
	bytes, _ := value.([]byte)
	return json.Unmarshal(bytes, &a)
}

// Value implements the driver.Valuer interface for AnalysisResult
func (a AnalysisResult) Value() (driver.Value, error) {
	return json.Marshal(a)
}
