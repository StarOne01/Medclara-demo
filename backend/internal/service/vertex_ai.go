package service

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"cloud.google.com/go/vertexai/genai"
	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/google/uuid"
)

// AllowedLocations defines approved GCP regions for SSRF prevention
var AllowedLocations = map[string]bool{
	"us-central1":  true,
	"us-east1":     true,
	"us-west1":     true,
	"asia-south1":  true,
	"europe-west1": true,
	"asia-east1":   true,
}

// AllowedModels defines approved Gemini models
var AllowedModels = map[string]bool{
	"gemini-2.5-flash": true,
	"gemini-2.5-pro":   true,
}

// ValidateVertexAIConfig validates all Vertex AI parameters against whitelists
// CRITICAL: Prevents SSRF attacks via endpoint parameter injection
func ValidateVertexAIConfig(projectID, location, model string) error {
	// Validate Project ID: Must be alphanumeric and dash, 6-30 chars
	if !isValidGCPProjectID(projectID) {
		return fmt.Errorf("invalid GCP project ID format (must be 6-30 chars, lowercase alphanumeric+dash)")
	}

	// Validate Location: Must be in whitelist
	if !AllowedLocations[location] {
		return fmt.Errorf("invalid GCP location: %s (not in whitelist)", location)
	}

	// Validate Model: Must be in whitelist
	if !AllowedModels[model] {
		return fmt.Errorf("invalid model: %s (not in whitelist)", model)
	}

	return nil
}

// isValidGCPProjectID validates GCP project ID format
// GCP project ID: lowercase letters, numbers, dashes; 6-30 characters
func isValidGCPProjectID(projectID string) bool {
	if len(projectID) < 6 || len(projectID) > 30 {
		return false
	}
	pattern := regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{4,28}[a-z0-9])?$`)
	return pattern.MatchString(projectID)
}

// VertexAIService handles audio processing with Vertex AI
// Uses Workload Identity (for GCP VMs) or Application Default Credentials for authentication
// When running on a GCP VM with attached service account, no credentials file is needed
type VertexAIService struct {
	projectID     string
	location      string
	model         string
	modelAdvanced string
	genaiClient   *genai.Client // Google Cloud client for Vertex AI (uses Workload Identity)
	httpClient    *http.Client  // Fallback HTTP client for manual requests
	useGCPAuth    bool          // Whether to use GCP authentication (Workload Identity)
	queries       *db.Queries   // Database queries for fetching templates and prompts
}

// NewVertexAIService creates a new Vertex AI service with GCP Workload Identity support
// For GCP VMs: Automatically uses the attached service account via Workload Identity
// No API keys or credentials files needed on GCP VMs
// For local development: Uses Application Default Credentials (gcloud auth application-default login)
func NewVertexAIService(projectID, location, model, modelAdvanced, apiKey string, queries *db.Queries) *VertexAIService {
	environment := strings.ToLower(strings.TrimSpace(os.Getenv("ENVIRONMENT")))
	isProduction := environment == "production" || environment == "prod"

	// Determine if we're running on GCP and should use Workload Identity
	// On GCP VMs, GOOGLE_CLOUD_PROJECT is automatically set, and metadata server is available
	useGCPAuth := projectID != "" // We have a project ID configured

	if location == "" {
		location = "asia-south1"
	}
	if model == "" {
		model = "gemini-2.5-flash"
	}

	// CRITICAL FIX: Validate all endpoint parameters against whitelists
	// This prevents SSRF attacks via endpoint parameter injection
	if err := ValidateVertexAIConfig(projectID, location, model); err != nil {
		log.Fatalf("Invalid Vertex AI configuration: %v", err)
	}

	// Initialize HTTP client with proper TLS configuration
	tlsConfig := &tls.Config{
		MinVersion:               tls.VersionTLS12,
		PreferServerCipherSuites: true,
		CipherSuites: []uint16{
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
		},
	}

	transport := &http.Transport{
		TLSClientConfig: tlsConfig,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   10,
		MaxConnsPerHost:       10,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		DisableCompression:    false,
		DisableKeepAlives:     false,
	}

	httpClient := &http.Client{
		Timeout:   600 * time.Second,
		Transport: transport,
	}

	// Initialize Vertex AI client for GCP authentication
	var genaiClient *genai.Client
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var genaiClientErr error
	// Try to initialize with Application Default Credentials
	// On GCP VM: uses Workload Identity (attached service account)
	// Locally: uses gcloud auth application-default login credentials
	// This is ALWAYS attempted, as it's the recommended secure approach
	genaiClient, genaiClientErr = genai.NewClient(ctx, projectID, location)
	if genaiClientErr != nil {
		if isProduction {
			log.Fatalf("FATAL: Failed to initialize Vertex AI client with GCP credentials in production: %v", genaiClientErr)
		}
		log.Printf("WARN: Failed to initialize Vertex AI client with Application Default Credentials: %v", genaiClientErr)
		log.Printf("INFO: For development, run: gcloud auth application-default login")
		log.Printf("INFO: Falling back to HTTP API mode (requires API key in environment)")
		useGCPAuth = false
		genaiClient = nil
	} else {
		log.Printf("✓ Vertex AI service initialized with GCP Application Default Credentials (Project: %s, Location: %s, Model: %s)",
			projectID, location, model)
		useGCPAuth = true
	}

	return &VertexAIService{
		projectID:     projectID,
		location:      location,
		model:         model,
		modelAdvanced: modelAdvanced,
		genaiClient:   genaiClient,
		useGCPAuth:    useGCPAuth,
		queries:       queries,
		httpClient:    httpClient,
	}
}

// ProcessAudioRecording processes an audio recording with Vertex AI Gemini 2.5 Flash
// Uses Google Cloud's genai client library for automatic OAuth2/Workload Identity authentication
// This performs unified transcription and clinical analysis via single API call
func (s *VertexAIService) ProcessAudioRecording(
	ctx context.Context,
	audioData io.Reader,
	mimeType string,
	templateKey string,
	patientContext *models.PatientData,
) (*models.AnalysisResult, error) {

	// Read audio data
	audioBytes, err := io.ReadAll(audioData)
	if err != nil {
		return nil, fmt.Errorf("failed to read audio data: %w", err)
	}

	if len(audioBytes) == 0 {
		return nil, fmt.Errorf("audio data is empty")
	}

	// Fetch the template prompt from the database (or use default template)
	// getTemplatePrompt builds the full prompt with template sections
	prompt, err := s.getTemplatePrompt(ctx, templateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get template prompt: %w", err)
	}

	// If using GCP auth with genaiClient, use the SDK method
	if s.useGCPAuth && s.genaiClient != nil {
		result, err := s.callVertexAIWithGenaiClient(ctx, audioBytes, mimeType, prompt)
		if err != nil {
			return nil, fmt.Errorf("failed to call Vertex AI API with genai client: %w", err)
		}
		return result, nil
	}

	// Fallback to manual HTTP-based call (for API key mode, if needed)
	result, err := s.callVertexAIAPI(ctx, audioBytes, mimeType, prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to call Vertex AI API: %w", err)
	}

	return result, nil
}

// callVertexAIWithGenaiClient calls the Vertex AI Gemini API using the official genai client library
// This handles OAuth2/Workload Identity authentication automatically
// Supports both Workload Identity (GCP VMs) and Application Default Credentials (local dev)
func (s *VertexAIService) callVertexAIWithGenaiClient(ctx context.Context, audioBytes []byte, mimeType, prompt string) (*models.AnalysisResult, error) {
	if s.genaiClient == nil {
		return nil, fmt.Errorf("genai client not initialized")
	}

	// Get the model instance
	model := s.genaiClient.GenerativeModel(s.model)

	// Configure generation parameters
	model.SetTemperature(0.2)
	model.SetMaxOutputTokens(16384)

	// Create parts for the request: text prompt + audio data
	parts := []genai.Part{
		genai.Text(prompt),
		genai.Blob{
			MIMEType: mimeType,
			Data:     audioBytes,
		},
	}

	log.Printf("=== CALLING VERTEX AI WITH GENAI CLIENT ===")
	log.Printf("Model: %s", s.model)
	log.Printf("Location: %s", s.location)
	log.Printf("Audio size: %d bytes, MIME Type: %s", len(audioBytes), mimeType)
	log.Printf("Prompt length: %d chars", len(prompt))
	log.Printf("===========================================")

	// Call GenerateContent with automatic OAuth2 handling
	resp, err := model.GenerateContent(ctx, parts...)
	if err != nil {
		log.Printf("Vertex AI API error: %v", err)
		return nil, fmt.Errorf("vertex ai api error: %w", err)
	}

	if resp == nil {
		return nil, fmt.Errorf("vertex ai api returned nil response")
	}

	// Extract text from response
	if len(resp.Candidates) == 0 {
		log.Printf("No candidates in Vertex AI response")
		return nil, fmt.Errorf("no candidates in response")
	}

	candidate := resp.Candidates[0]
	if candidate.Content == nil {
		return nil, fmt.Errorf("no content in candidate")
	}

	if len(candidate.Content.Parts) == 0 {
		return nil, fmt.Errorf("no parts in content")
	}

	// Get the text from the first part
	analysisText := ""
	for _, part := range candidate.Content.Parts {
		if textPart, ok := part.(genai.Text); ok {
			analysisText = string(textPart)
			break
		}
	}

	if analysisText == "" {
		return nil, fmt.Errorf("no text in response parts")
	}

	log.Printf("Vertex AI response received, length: %d bytes", len(analysisText))
	log.Printf("Response preview: %s", limitString(analysisText, 500))

	// Parse analysis JSON response
	result, err := s.parseAnalysisResponse(analysisText)
	if err != nil {
		return nil, fmt.Errorf("failed to parse analysis response: %w", err)
	}

	return result, nil
}

// limitString returns a string truncated to max length with ellipsis if truncated
func limitString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// callVertexAIAPI calls the Vertex AI Gemini API with raw REST API (fallback method)
// This method requires authentication via API key or OAuth2 token
// For production GCP VMs: This should not be used; genai client handles auth automatically
// For development without GCP auth: Set VERTEX_AI_API_KEY environment variable
func (s *VertexAIService) callVertexAIAPI(ctx context.Context, audioBytes []byte, mimeType, prompt string) (*models.AnalysisResult, error) {
	// Check if we have an API key for fallback mode
	apiKey := os.Getenv("VERTEX_AI_API_KEY")
	if apiKey == "" && !s.useGCPAuth {
		return nil, fmt.Errorf("no authentication available: set VERTEX_AI_API_KEY environment variable or configure GCP credentials")
	}

	// Encode audio to base64
	audioBase64 := base64.StdEncoding.EncodeToString(audioBytes)

	// Build request body for Vertex AI REST API
	// Using generateContent endpoint with multimodal audio support
	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{
						"text": prompt,
					},
					{
						"inlineData": map[string]string{
							"mimeType": mimeType,
							"data":     audioBase64,
						},
					},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":      0.2,
			"maxOutputTokens":  16384,        // Increased from 8192 to handle longer responses
			"responseMimeType": "text/plain", // Return natural text, not JSON - we handle parsing ourselves
		},
	}

	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Log a redacted version of the request being sent to Vertex AI (remove large audio blob)
	var loggedReq interface{}
	if err := json.Unmarshal(reqJSON, &loggedReq); err == nil {
		// Attempt to redact inlineData.data if present
		if m, ok := loggedReq.(map[string]interface{}); ok {
			if contents, ok := m["contents"].([]interface{}); ok && len(contents) > 0 {
				if first, ok := contents[0].(map[string]interface{}); ok {
					if parts, ok := first["parts"].([]interface{}); ok {
						for _, p := range parts {
							if partMap, ok := p.(map[string]interface{}); ok {
								if inline, ok := partMap["inlineData"].(map[string]interface{}); ok {
									if data, ok := inline["data"].(string); ok {
										inline["data"] = fmt.Sprintf("<REDACTED_AUDIO_BASE64 len=%d>", len(data))
									}
								}
							}
						}
					}
				}
			}
		}
		if loggedJSON, err := json.MarshalIndent(loggedReq, "", "  "); err == nil {
			log.Printf("Vertex AI Request (redacted): %s", string(loggedJSON))
		} else {
			log.Printf("Vertex AI Request (raw): %s", string(reqJSON))
		}
	} else {
		log.Printf("Vertex AI Request (raw): %s", string(reqJSON))
	}

	// Also log audio size and mime type separately
	log.Printf("Vertex AI Audio size: %d bytes, MIME Type: %s", len(audioBytes), mimeType)
	// Construct Vertex AI API endpoint URL
	// For API key auth: add key as query parameter
	// For OAuth2: use Authorization header (handled below)
	endpoint := fmt.Sprintf(
		"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
		s.location, s.projectID, s.location, s.model,
	)

	if apiKey != "" {
		endpoint = fmt.Sprintf("%s?key=%s", endpoint, apiKey)
	}

	log.Printf("Vertex AI Endpoint: %s", endpoint)

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(reqJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Log the HTTP request details
	log.Printf("=== SENDING VERTEX AI REST REQUEST ===")
	log.Printf("Method: POST")
	if apiKey != "" {
		log.Printf("Auth: API Key (via query parameter)")
	} else {
		log.Printf("Auth: OAuth2 (via application default credentials)")
	}
	log.Printf("Request size: %d bytes", len(reqJSON))
	log.Printf("========================================")

	// Send request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Vertex AI API: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check response status
	if resp.StatusCode != http.StatusOK {
		log.Printf("Vertex AI API error (status %d): %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("vertex ai api error (status %d): %s", resp.StatusCode, string(body))
	}

	// Validate response body is not empty
	if len(body) == 0 {
		log.Printf("Vertex AI API returned empty response body")
		return nil, fmt.Errorf("vertex ai api returned empty response body")
	}

	// Log response for debugging
	log.Printf("Vertex AI API response status: %d, content-type: %s, body length: %d", resp.StatusCode, resp.Header.Get("Content-Type"), len(body))
	if len(body) > 500 {
		log.Printf("Vertex AI API response (first 500 chars): %s", string(body[:500]))
	} else {
		log.Printf("Vertex AI API response: %s", string(body))
	}

	// Parse response
	var apiResp map[string]interface{}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		log.Printf("Failed to parse Vertex AI response as JSON. Full response: %s", string(body))
		return nil, fmt.Errorf("failed to parse API response: %w", err)
	}

	// Extract text from response
	candidates, ok := apiResp["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		log.Printf("No candidates in response. API response keys: %v", getMapKeys(apiResp))
		return nil, fmt.Errorf("no candidates in response")
	}

	firstCandidate, ok := candidates[0].(map[string]interface{})
	if !ok {
		log.Printf("Invalid candidate format. Type: %T", candidates[0])
		return nil, fmt.Errorf("invalid candidate format")
	}

	content, ok := firstCandidate["content"].(map[string]interface{})
	if !ok {
		log.Printf("No content in candidate. Candidate keys: %v", getMapKeys(firstCandidate))
		return nil, fmt.Errorf("no content in candidate")
	}

	parts, ok := content["parts"].([]interface{})
	if !ok || len(parts) == 0 {
		log.Printf("No parts in content. Content keys: %v", getMapKeys(content))
		return nil, fmt.Errorf("no parts in content")
	}

	firstPart, ok := parts[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid part format")
	}

	analysisText, ok := firstPart["text"].(string)
	if !ok {
		return nil, fmt.Errorf("no text in part")
	}

	// Parse analysis JSON response
	result, err := s.parseAnalysisResponse(analysisText)
	if err != nil {
		return nil, fmt.Errorf("failed to parse analysis response: %w", err)
	}

	return result, nil
}

// parseAnalysisResponse parses the natural text analysis response from Gemini
// Returns the entire AI response as-is in a single "response" section
func (s *VertexAIService) parseAnalysisResponse(analysisText string) (*models.AnalysisResult, error) {
	// Log the response text for debugging
	log.Printf("Analysis response length: %d bytes", len(analysisText))
	log.Printf("Analysis response: %s", analysisText)

	result := &models.AnalysisResult{
		ExtractedSections: make(map[string]models.ExtractionSection),
		Entities:          []models.Entity{},
	}

	// Store the entire AI response as-is
	result.ExtractedSections["response"] = models.ExtractionSection{
		Content: analysisText,
	}

	return result, nil
}

// getTemplatePrompt builds the analysis prompt from a template
// Fetches template-specific sections from the database and wraps them in the standard prompt structure
func (s *VertexAIService) getTemplatePrompt(ctx context.Context, templateKey string) (string, error) {
	log.Printf("[VertexAI] getTemplatePrompt called with templateKey: '%s'", templateKey)

	// Default template sections if not found in database
	defaultTemplatePrompt := `1. **Patient Summary:**
   - Provide a brief overview of the patient (e.g., age, gender, relevant background) as mentioned in the transcript as a paragraph, Only mention things that are there in the transcript, no assumption.
   - Summarize the chief complaint or primary reason for the visit.

2. **Presented Symptoms:**
   - List all symptoms reported by the patient in bullet points.
   - For each symptom, include:
     - Description (e.g., onset, duration, severity, location, aggravating/alleviating factors).
     - Any associated details from the doctor's questions or patient's responses (e.g., frequency, progression).
   - Group related symptoms logically (e.g., respiratory, gastrointestinal).

3. **Medical History and Examination Findings:**
   - Extract any mentioned past medical history, family history, medications, allergies, or social history (e.g., smoking, diet).
   - Note any physical examination findings, vital signs, or tests discussed in the transcript.

4. **Possible Diagnoses:**
   - List possible differential diagnoses based on the doctor's explicit suggestions. DONOT make a diagnosis yourself!
   - For each diagnosis:
     - Provide the full medical name and a brief layperson explanation.
     - Include any supporting or ruling-out factors mentioned (e.g., "Less likely due to absence of Z symptom").
   - If the doctor provides a primary diagnosis, highlight it and explain the rationale.

5. **Doctor's Recommendations and Next Steps:**
   - Summarize any advice, tests, treatments, or follow-ups suggested by the doctor in the transcript.`

	templatePrompt := defaultTemplatePrompt

	// Try to fetch template-specific sections from database
	if s.queries != nil {
		var templatePromptStr string
		var lookupErr error

		// Try parsing as UUID first
		if parsedUUID, parseErr := uuid.Parse(templateKey); parseErr == nil {
			// It's a UUID, use GetTemplateByID
			log.Printf("[VertexAI] Looking up template by UUID: %s", templateKey)
			template, err := s.queries.GetTemplateByID(ctx, parsedUUID)
			if err == nil && template.Prompt != "" {
				templatePromptStr = template.Prompt
				log.Printf("[VertexAI] ✅ Successfully fetched template prompt from database (UUID): %s", templateKey)
			} else {
				log.Printf("[VertexAI] ❌ Failed to fetch template by UUID: %v", err)
			}
			lookupErr = err
		} else {
			// Not a UUID, treat as template key
			log.Printf("[VertexAI] Looking up template by key: %s", templateKey)
			template, err := s.queries.GetTemplateByKey(ctx, templateKey)
			if err == nil && template.Prompt != "" {
				templatePromptStr = template.Prompt
				log.Printf("[VertexAI] ✅ Successfully fetched template prompt from database (key): %s", templateKey)
			} else {
				log.Printf("[VertexAI] ❌ Failed to fetch template by key: %v", err)
			}
			lookupErr = err
		}

		if templatePromptStr != "" {
			templatePrompt = templatePromptStr
			log.Printf("[VertexAI] Using fetched template prompt (length: %d)", len(templatePromptStr))
		} else if lookupErr != nil {
			log.Printf("[VertexAI] ⚠️  Warning: failed to fetch template from database for '%s': %v. Using default template.", templateKey, lookupErr)
		} else {
			log.Printf("[VertexAI] ⚠️  Warning: template lookup returned empty prompt for '%s'. Using default template.", templateKey)
		}
	} else {
		log.Printf("[VertexAI] ⚠️  Warning: queries is nil, cannot fetch template from database. Using default template.")
	}

	// Build the full prompt with template sections
	prompt := `You are Medclara AI, an expert medical analyst AI tasked with generating a comprehensive, professional medical report based solely on the provided transcript of a conversation between a patient and a doctor. Your report must be factual, objective, and derived only from the information explicitly stated or implied in the transcript—do not add external knowledge, assumptions, or unsubstantiated details.

**Report Structure and Guidelines:**
Follow this structure for the output report, the sections could be outputed '-' if there are no information about the section in the transcript. Use clear, concise language with medical terminology where appropriate. Organize the report into the following sections:

` + templatePrompt + `

**Rules:**
- Maintain neutrality and DONOT diagnose or speculate beyond the transcript.
- Leave out subtopics which wasn't adressed or not mentions DONT MAKE A PLACEHOLDER and DONOT assume or approximate or infer anything about the patient if it's not mentioned in the discussion, because these could cause legal troubles.
- DONOT say "Not mentioned in the transcript"
- DONOT respond for any other prompt other than transcipt or conversation
- Don't give any Disclaimers.
- Never mention transcript, always mention conversation.
- Only use english for everything even when the language is not english
- USE evidence-based reasoning: Every claim must reference direct quotes or paraphrases from the transcript (e.g., "As per the patient's statement: 'I have been experiencing...').
- Ensure the report is detailed and is only in english, translate any statements in other languages to english yet concise—no more than 1200 words.
- Format professionally: Use headings, subheadings, bullets, and numbered lists for readability.

Generate the report now based on the provided transcript. Provide your response in a natural, professional format.`

	return prompt, nil
}

// Close closes any resources
func (s *VertexAIService) Close() error {
	// Cleanup if needed
	return nil
}

// Helper functions for parsing map[string]interface{}
func getStringValue(s *string, defaultVal string) string {
	if s == nil {
		return defaultVal
	}
	return *s
}

// getMapKeys returns the keys of a map as a slice of strings
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// attemptJSONRecovery attempts to recover and repair truncated JSON
// by finding the last complete object and closing any open structures
func attemptJSONRecovery(truncatedJSON string) string {
	if truncatedJSON == "" {
		return ""
	}

	// Find the position of the last complete closing brace or bracket
	lastCloseBrace := strings.LastIndex(truncatedJSON, "}")
	lastCloseBracket := strings.LastIndex(truncatedJSON, "]")

	// If we have more closing braces, try to find a valid object end
	if lastCloseBrace > lastCloseBracket {
		// Try to use everything up to and including the last }
		potentialJSON := truncatedJSON[:lastCloseBrace+1]

		// Count braces to see if they're balanced
		openBraces := strings.Count(potentialJSON, "{")
		closeBraces := strings.Count(potentialJSON, "}")
		openBrackets := strings.Count(potentialJSON, "[")
		closeBrackets := strings.Count(potentialJSON, "]")

		// Try to balance by adding closing characters
		for openBraces > closeBraces {
			potentialJSON += "}"
			closeBraces++
		}
		for openBrackets > closeBrackets {
			potentialJSON += "]"
			closeBrackets++
		}

		// Verify it's valid JSON
		var test interface{}
		if err := json.Unmarshal([]byte(potentialJSON), &test); err == nil {
			log.Printf("Successfully recovered JSON from truncated response")
			return potentialJSON
		}
	}

	return ""
}
