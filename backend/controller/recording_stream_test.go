package controller

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TestGetRecordingStreamHandler_ValidConnection tests successful SSE connection
func TestGetRecordingStreamHandler_ValidConnection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Test SSE endpoint behavior
	router.GET("/stream/:recordingId", func(c *gin.Context) {
		// Simulate SSE endpoint
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")

		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "streaming_not_supported",
			})
			return
		}

		// Send connection message
		fmt.Fprintf(c.Writer, "data: {\"status\":\"connected\"}\n\n")
		flusher.Flush()

		// Send processing message
		fmt.Fprintf(c.Writer, "data: {\"status\":\"processing\",\"progress\":50}\n\n")
		flusher.Flush()
	})

	// Test request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/stream/test-id", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Check SSE headers
	if w.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("Expected Content-Type text/event-stream, got %s", w.Header().Get("Content-Type"))
	}

	if w.Header().Get("Cache-Control") != "no-cache" {
		t.Errorf("Expected Cache-Control no-cache, got %s", w.Header().Get("Cache-Control"))
	}

	// Check response content
	body := w.Body.String()
	if !strings.Contains(body, "connected") {
		t.Errorf("Expected connection message in response, got: %s", body)
	}

	if !strings.Contains(body, "processing") {
		t.Errorf("Expected processing message in response, got: %s", body)
	}
}

// TestGetRecordingStreamHandler_InvalidID tests invalid recording ID format
func TestGetRecordingStreamHandler_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.GET("/:recordingId", func(c *gin.Context) {
		recordingIDStr := c.Param("recordingId")
		if recordingIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Recording ID is required",
			})
			return
		}

		_, err := uuid.Parse(recordingIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid recording ID format",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/invalid-uuid", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	if response["error"] != "invalid_request" {
		t.Errorf("Expected error 'invalid_request', got %v", response["error"])
	}
}

// TestRecordingStreamEvent_Serialization tests SSE event JSON serialization
func TestRecordingStreamEvent_Serialization(t *testing.T) {
	now := time.Now()
	recordingID := uuid.New().String()

	tests := []struct {
		name  string
		event interface{}
		check func(data map[string]interface{}) bool
	}{
		{
			name: "Connected Event",
			event: models.RecordingStreamEvent{
				Status:      "connected",
				RecordingID: recordingID,
				UpdatedAt:   now,
			},
			check: func(data map[string]interface{}) bool {
				return data["status"] == "connected" &&
					data["recordingId"] == recordingID
			},
		},
		{
			name: "Processing Event",
			event: models.RecordingStreamEvent{
				Status:      "processing",
				Progress:    50,
				Message:     "Transcribing audio...",
				RecordingID: recordingID,
				UpdatedAt:   now,
			},
			check: func(data map[string]interface{}) bool {
				return data["status"] == "processing" &&
					int(data["progress"].(float64)) == 50 &&
					data["message"] == "Transcribing audio..."
			},
		},
		{
			name: "Completed Event",
			event: models.RecordingStreamEvent{
				Status:           "completed",
				RecordingID:      recordingID,
				Transcription:    "Patient has chest pain for 3 days",
				ProcessingTimeMs: 45000,
				UpdatedAt:        now,
			},
			check: func(data map[string]interface{}) bool {
				return data["status"] == "completed" &&
					data["transcription"] == "Patient has chest pain for 3 days" &&
					int(data["processing_time_ms"].(float64)) == 45000
			},
		},
		{
			name: "Failed Event",
			event: models.RecordingStreamEvent{
				Status:      "failed",
				RecordingID: recordingID,
				Error:       "Audio quality too poor for processing",
				UpdatedAt:   now,
			},
			check: func(data map[string]interface{}) bool {
				return data["status"] == "failed" &&
					data["error"] == "Audio quality too poor for processing"
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.event)
			if err != nil {
				t.Fatalf("Failed to marshal event: %v", err)
			}

			var parsed map[string]interface{}
			err = json.Unmarshal(data, &parsed)
			if err != nil {
				t.Fatalf("Failed to unmarshal event: %v", err)
			}

			if !tt.check(parsed) {
				t.Errorf("Event validation failed: %v", parsed)
			}
		})
	}
}

// TestSSEProgressCalculator tests progress calculation logic
func TestSSEProgressCalculator(t *testing.T) {
	tests := []struct {
		name           string
		elapsedTime    time.Duration
		estimatedTotal time.Duration
		expectedMin    int
		expectedMax    int
		expectedExact  int
	}{
		{
			name:           "Start (0%)",
			elapsedTime:    0,
			estimatedTotal: 10 * time.Second,
			expectedExact:  0,
		},
		{
			name:           "Quarter way (25%)",
			elapsedTime:    2500 * time.Millisecond,
			estimatedTotal: 10 * time.Second,
			expectedExact:  25,
		},
		{
			name:           "Halfway (50%)",
			elapsedTime:    5 * time.Second,
			estimatedTotal: 10 * time.Second,
			expectedExact:  50,
		},
		{
			name:           "90% - capped at 95%",
			elapsedTime:    9 * time.Second,
			estimatedTotal: 10 * time.Second,
			expectedMin:    90,
			expectedMax:    95, // Should be capped
		},
		{
			name:           "Over 100% - capped at 95%",
			elapsedTime:    15 * time.Second,
			estimatedTotal: 10 * time.Second,
			expectedMax:    95, // Should be capped
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			startTime := time.Now().Add(-tt.elapsedTime)
			calc := models.NewSSEProgressCalculator(startTime, tt.estimatedTotal)

			progress := calc.CalculateProgress()

			if tt.expectedExact > 0 {
				// Allow 1% margin for exact checks
				if progress < tt.expectedExact-1 || progress > tt.expectedExact+1 {
					t.Errorf("Expected %d, got %d", tt.expectedExact, progress)
				}
			}

			if tt.expectedMin > 0 && progress < tt.expectedMin {
				t.Errorf("Expected at least %d, got %d", tt.expectedMin, progress)
			}

			if tt.expectedMax > 0 && progress > tt.expectedMax {
				t.Errorf("Expected at most %d, got %d", tt.expectedMax, progress)
			}

			// Progress should always be 0-100
			if progress < 0 || progress > 100 {
				t.Errorf("Progress out of range: %d", progress)
			}
		})
	}
}

// TestRecordingStreamEvent_CompleteAnalysis tests event with full analysis data
func TestRecordingStreamEvent_CompleteAnalysis(t *testing.T) {
	recordingID := uuid.New().String()
	now := time.Now()

	analysis := map[string]interface{}{
		"extracted_sections": map[string]interface{}{
			"chief_complaint": map[string]interface{}{
				"content":    "Chest pain x3 days",
				"confidence": 0.98,
			},
		},
		"entities": []interface{}{
			map[string]interface{}{
				"type":       "symptom",
				"value":      "chest pain",
				"confidence": 0.99,
			},
		},
	}

	event := models.RecordingStreamEvent{
		Status:           "completed",
		RecordingID:      recordingID,
		Transcription:    "Full transcription text here",
		Analysis:         analysis,
		ProcessingTimeMs: 45000,
		UpdatedAt:        now,
	}

	// Marshal to JSON
	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	// Unmarshal back to verify
	var parsed models.RecordingStreamEvent
	err = json.Unmarshal(data, &parsed)
	if err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if parsed.Status != "completed" {
		t.Errorf("Expected status 'completed', got %s", parsed.Status)
	}

	if parsed.RecordingID != recordingID {
		t.Errorf("RecordingID mismatch")
	}

	if parsed.Analysis == nil {
		t.Error("Analysis should not be nil")
	}

	if len(parsed.Analysis) == 0 {
		t.Error("Analysis should contain data")
	}
}

// TestSSEEventFormat tests proper SSE message format
func TestSSEEventFormat(t *testing.T) {
	// Test that events are formatted correctly for SSE
	w := httptest.NewRecorder()

	// Simulate SSE response
	event := models.RecordingStreamEvent{
		Status:      "processing",
		Progress:    50,
		RecordingID: "test-id",
	}

	eventData, _ := json.Marshal(event)
	fmt.Fprintf(w, "data: %s\n\n", string(eventData))

	body := w.Body.String()

	// Check SSE format: data: {...}\n\n
	if !strings.HasPrefix(body, "data: {") {
		t.Errorf("SSE message should start with 'data: {', got: %s", body[:20])
	}

	if !strings.HasSuffix(body, "\n\n") {
		t.Errorf("SSE message should end with '\\n\\n'")
	}

	// Check that data is valid JSON
	lines := strings.Split(strings.TrimSpace(body), "\n")
	dataLine := lines[0]
	jsonStr := strings.TrimPrefix(dataLine, "data: ")

	var parsedEvent models.RecordingStreamEvent
	err := json.Unmarshal([]byte(jsonStr), &parsedEvent)
	if err != nil {
		t.Errorf("Failed to parse SSE data as JSON: %v", err)
	}

	if parsedEvent.Status != "processing" {
		t.Errorf("Expected status 'processing', got %s", parsedEvent.Status)
	}
}

// TestSSEStreamReading tests reading SSE stream like a client would
func TestSSEStreamReading(t *testing.T) {
	w := httptest.NewRecorder()

	// Simulate multiple SSE events
	events := []models.RecordingStreamEvent{
		{Status: "connected", RecordingID: "test-id"},
		{Status: "processing", Progress: 25, Message: "Starting..."},
		{Status: "processing", Progress: 50, Message: "Transcribing..."},
		{Status: "processing", Progress: 75, Message: "Analyzing..."},
		{Status: "completed", Progress: 100, Transcription: "Result"},
	}

	for _, event := range events {
		eventData, _ := json.Marshal(event)
		fmt.Fprintf(w, "data: %s\n\n", string(eventData))
	}

	// Parse events like a client would
	body := w.Body.String()
	scanner := bufio.NewScanner(strings.NewReader(body))

	eventCount := 0
	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "data: ") {
			jsonStr := strings.TrimPrefix(line, "data: ")
			var event models.RecordingStreamEvent
			err := json.Unmarshal([]byte(jsonStr), &event)
			if err != nil {
				t.Errorf("Failed to parse event: %v", err)
				continue
			}

			if event.Status == "" {
				t.Error("Event status should not be empty")
			}

			eventCount++
		}
	}

	if eventCount != len(events) {
		t.Errorf("Expected %d events, parsed %d", len(events), eventCount)
	}
}

// TestRecordingStreamEvent_OmitEmpty tests that zero-value fields are omitted
func TestRecordingStreamEvent_OmitEmpty(t *testing.T) {
	// Test with minimal data
	event := models.RecordingStreamEvent{
		Status:      "connected",
		RecordingID: "test-id",
	}

	data, _ := json.Marshal(event)
	jsonStr := string(data)

	// Fields that should NOT be in JSON (omitEmpty)
	shouldNotContain := []string{
		"\"progress\":0",   // Progress should be omitted if 0
		"\"message\":\"\"", // Message should be omitted if empty
		"\"transcription\":\"\"",
		"\"error\":\"\"",
	}

	for _, forbidden := range shouldNotContain {
		if strings.Contains(jsonStr, forbidden) {
			t.Errorf("JSON should not contain zero-value field: %s\nGot: %s", forbidden, jsonStr)
		}
	}

	// But RecordingID and Status should always be present
	if !strings.Contains(jsonStr, "\"status\"") {
		t.Error("JSON should contain 'status' field")
	}
	if !strings.Contains(jsonStr, "\"recordingId\"") {
		t.Error("JSON should contain 'recordingId' field")
	}
}

// BenchmarkSSEEventSerialization benchmarks event marshaling
func BenchmarkSSEEventSerialization(b *testing.B) {
	event := models.RecordingStreamEvent{
		Status:           "completed",
		RecordingID:      "550e8400-e29b-41d4-a716-446655440000",
		Progress:         100,
		Transcription:    strings.Repeat("a", 1000),
		ProcessingTimeMs: 45000,
		Analysis: map[string]interface{}{
			"sections": map[string]interface{}{
				"chief_complaint": "Patient complains of chest pain",
			},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		json.Marshal(event)
	}
}

// BenchmarkProgressCalculation benchmarks progress calculation
func BenchmarkProgressCalculation(b *testing.B) {
	startTime := time.Now().Add(-10 * time.Second)
	calc := models.NewSSEProgressCalculator(startTime, 15*time.Second)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		calc.CalculateProgress()
	}
}
