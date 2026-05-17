/**
 * Unified API Client for Medclara Backend
 * 
 * This is the single source of truth for all backend API interactions.
 * Organized by resource (auth, patients, templates, sessions, notes, recordings)
 * Follows the backend API documentation exactly.
 * 
 * Usage:
 *   import { getApiClient } from "@/lib/api-client-unified";
 *   const client = getApiClient();
 *   await client.auth.login(email, password);
 */

import { contentCache, CACHE_KEYS } from "./content-cache";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================================
// Error Handling
// ============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, any>,
    public requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isAuthenticationError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.statusCode === 401;
}

export function isValidationError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 422);
}

// ============================================================================
// Request/Response Utilities
// ============================================================================

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Convert snake_case keys to camelCase recursively
// EXCEPTION: Keep template_key, created_at, updated_at, is_active as-is (don't convert to camelCase)
function snakeToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamelCase);
  if (typeof obj !== 'object') return obj;

  const camelCased: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Keep these specific fields in their original form - they are identifiers/keys
    if (key === 'template_key' || key === 'created_at' || key === 'updated_at' || key === 'is_active' || key === 'extract_style' || key === 'prompt_version') {
      camelCased[key] = snakeToCamelCase(value);
    } else {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCased[camelKey] = snakeToCamelCase(value);
    }
  }
  return camelCased;
}


async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add authorization token if available
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;

    } else {
    }
  }

  try {
    const startTime = performance.now();
    const response = await fetch(url, {
      ...options,
      headers,
    });
    const endTime = performance.now();

    const requestId = response.headers.get("X-Request-ID") || undefined;

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: "unknown_error", message: response.statusText };
      }


      const errorCode = errorData.error || mapStatusToErrorCode(response.status);

      throw new ApiError(
        errorData.message || "An error occurred",
        response.status,
        errorCode,
        errorData.details || errorData,
        requestId
      );
    }

    const data = await response.json();

    // Convert snake_case response keys to camelCase
    const converted = snakeToCamelCase(data) as T;

    return converted;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Network error occurred", 0, "network_error");
  }
}

function mapStatusToErrorCode(status: number): string {
  switch (status) {
    case 400:
      return "invalid_request";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 413:
      return "chunk_too_large";
    case 422:
      return "chunk_order_invalid";
    case 429:
      return "rate_limit_exceeded";
    case 500:
    case 502:
    case 503:
    case 504:
      return "server_error";
    default:
      return "unknown_error";
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id?: string;
  // Camel case alternatives (from API responses)
  firstName?: string;
  lastName?: string;
  organizationId?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  medicalRecordNumber?: string;
  mrn?: string; // Alias for medicalRecordNumber
  address?: string;
  primaryLanguage?: string;
  allergies?: Array<{ allergen: string; reaction: string }>;
  medications?: Array<{ name: string; dose: string; frequency: string }>;
  createdAt: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  template_key: string;
  label: string;
  description?: string;
  specialty?: string;
  category?: string;
  // NOTE: Templates do NOT have a sections field. Sections are defined by the AI prompt.
  // Use template.prompt to understand how sections are extracted.
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // Prompt-based template fields
  prompt: string;  // AI extraction instructions
  extract_style: 'narrative' | 'structured' | 'hybrid';  // How content is extracted
  prompt_version: number;
  prompt_last_modified?: string;
}

export interface Session {
  sessionId: string;
  status: "initialized" | "active" | "completed";
  templateId: string;
  patientId?: string;
  noteSections?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
  // Additional fields for workspace
  transcriptSegments?: Array<{ id: string; speaker: string; text: string; start_time_seconds: number; end_time_seconds: number; confidence: number }>;
  [key: string]: any;
}

export interface Note {
  id: string;
  patient_id: string;
  recording_id?: string;
  encounter_id?: string;
  title: string;
  content: string;
  status: "draft" | "completed" | "signed" | "archived";
  scribe_page_id?: string;
  tags?: string[];
  is_signed: boolean;
  signed_at?: string;
  version: number;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export interface CreateNoteRequest {
  patient_id: string;
  recording_id?: string;
  encounter_id?: string;
  title: string;
  content: string;
  scribe_page_id?: string;
  tags?: string[];
  templateId?: string;
  extracted_data?: Record<string, any>;
  // Additional fields
  note_type?: 'scribe' | 'clinical' | 'followup' | 'general';
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface Recording {
  id: string;
  status: "processing" | "completed" | "failed";
  templateId: string;
  transcription?: string;
  analysis?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  // Processing metadata
  processing_time_ms?: number;
  [key: string]: any;
}

export interface ChunkedUploadSession {
  sessionId: string;
  recordingId: string;
  status: "active" | "finalized" | "resumed";
  totalChunks?: number;
  chunksReceived?: number;
  progress?: number;
  createdAt: string;
  expiresAt?: string;
}

// ============================================================================
// API Client Implementation
// ============================================================================

class ApiClient {
  private baseUrl = API_BASE_URL;

  // ========================================================================
  // Authentication APIs (3 endpoints)
  // ========================================================================
  auth = {
    /**
     * POST /api/auth/login
     * Login with email and password to get access token
     * Response includes first_name and last_name (converted from snake_case to camelCase by apiFetch)
     */
    login: async (email: string, password: string): Promise<{
      success: boolean;
      message: string;
      accessToken: string;
      tokenType: string;
      user: User;
    }> => {
      const response = await apiFetch<{
        success: boolean;
        message: string;
        accessToken: string;
        tokenType: string;
        user: any;
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      // Normalize user data to ensure first_name and last_name are available
      const normalizedUser: User = {
        id: response.user.id,
        email: response.user.email,
        first_name: response.user.firstName || response.user.first_name || "",
        last_name: response.user.lastName || response.user.last_name || "",
        role: response.user.role,
        organization_id: response.user.organizationId || response.user.organization_id,
      };
      
      return {
        success: response.success,
        message: response.message,
        accessToken: response.accessToken,
        tokenType: response.tokenType,
        user: normalizedUser,
      };
    },

    /**
     * POST /api/auth/logout
     * Logout and invalidate current session
     */
    logout: async (): Promise<{ success: boolean; message: string }> => {
      return apiFetch("/api/auth/logout", { method: "POST" });
    },

    /**
     * GET /api/auth/me
     * Get current authenticated user information
     */
    getCurrentUser: async (): Promise<User> => {
      const response = await apiFetch<any>("/api/auth/me");
      // Handle both direct response and wrapped response
      const user = response.user || response;
      // Note: Response is already converted from snake_case to camelCase by snakeToCamelCase
      return {
        id: user.id,
        email: user.email,
        first_name: user.firstName || user.first_name,
        last_name: user.lastName || user.last_name,
        role: user.role,
        organization_id: user.organizationId || user.organization_id,
      } as User;
    },
  };

  // ========================================================================
  // Patients APIs (3 endpoints)
  // ========================================================================
  patients = {
    /**
     * GET /api/patients
     * Get all patients with pagination
     */
    list: async (params?: { limit?: number; offset?: number }): Promise<{
      patients: Patient[];
      total: number;
      limit: number;
      offset: number;
    }> => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());

      const query = queryParams.toString();
      return apiFetch(`/api/patients${query ? `?${query}` : ""}`);
    },

    /**
     * GET /api/patients/{patientId}
     * Get a specific patient by ID
     */
    get: async (patientId: string): Promise<Patient> => {
      return apiFetch(`/api/patients/${patientId}`);
    },

    /**
     * POST /api/patients
     * Create a new patient record
     */
    create: async (patientData: {
      first_name: string;
      last_name: string;
      date_of_birth?: string;
      gender?: string;
      email?: string;
      phone?: string;
      medical_record_number?: string;
      organization_id?: string;
    }): Promise<Patient> => {
      return apiFetch("/api/patients", {
        method: "POST",
        body: JSON.stringify(patientData),
      });
    },
  };

  // ========================================================================
  // Templates APIs (5 endpoints documented + extras)
  // ========================================================================
  templates = {
    /**
     * GET /api/templates
     * Get all templates with optional filters
     */
    list: async (params?: {
      category?: string;
      specialty?: string;
      active_only?: boolean;
      limit?: number;
      offset?: number;
    }): Promise<{
      templates: Template[];
      total: number;
      limit: number;
      offset: number;
    }> => {
      const queryParams = new URLSearchParams();
      if (params?.category) queryParams.append("category", params.category);
      if (params?.specialty) queryParams.append("specialty", params.specialty);
      if (typeof params?.active_only !== "undefined")
        queryParams.append("active_only", String(params.active_only));
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());

      const query = queryParams.toString();
      return apiFetch(`/api/templates${query ? `?${query}` : ""}`);
    },

    /**
     * GET /api/templates/uuids
     * Get mapping of template keys to their UUIDs
     */
    getUuidMap: async (): Promise<Record<string, string>> => {
      const response = await apiFetch<{
        status: string;
        data: Record<string, string>;
      }>("/api/templates/uuids");
      return response.data;
    },

    /**
     * GET /api/templates/{templateId}
     * Get a specific template by ID
     */
    get: async (templateId: string): Promise<Template> => {
      return apiFetch(`/api/templates/${templateId}`);
    },

    /**
     * GET /api/templates/categories
     * Get all template categories
     */
    getCategories: async (): Promise<{
      categories: string[];
    }> => {
      return apiFetch("/api/templates/categories");
    },

    /**
     * GET /api/templates/key/{templateKey}
     * Get a template by its key (e.g., "soap-general")
     */
    getByKey: async (templateKey: string): Promise<Template> => {
      return apiFetch(`/api/templates/key/${encodeURIComponent(templateKey)}`);
    },

    /**
     * EXTRA: GET /api/templates/search
     * Full-text search across templates (NOT in docs, verify exists)
     */
    search: async (query: string, limit?: number): Promise<{
      results: Template[];
      count: number;
    }> => {
      const params = new URLSearchParams();
      params.append("q", query);
      if (limit) params.append("limit", String(limit));
      const response = await apiFetch<{
        data?: { results: Template[]; count: number };
        results?: Template[];
        count?: number;
      }>(`/api/templates/search?${params.toString()}`);
      
      // Handle both response formats: nested under 'data' or at top level
      if (response.data) {
        return {
          results: response.data.results || [],
          count: response.data.count || 0,
        };
      }
      
      return {
        results: response.results || [],
        count: response.count || 0,
      };
    },

    /**
     * EXTRA: GET /api/templates/specialty/{specialty}
     * Get templates by specialty (NOT in docs, verify exists)
     */
    getBySpecialty: async (specialty: string): Promise<{
      templates: Template[];
    }> => {
      return apiFetch(`/api/templates/specialty/${encodeURIComponent(specialty)}`);
    },
  };

  // ========================================================================
  // Sessions APIs (5 endpoints)
  // ========================================================================
  sessions = {
    /**
     * POST /api/sessions
     * Create a new scribe session
     */
    create: async (templateId: string, options?: {
      patientId?: string;
      initialPatientId?: string;
      encounterId?: string;
      sessionId?: string;
      metadata?: Record<string, any>;
    }): Promise<Session> => {
      return apiFetch("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          templateId: templateId,
          ...options,
        }),
      });
    },

    /**
     * GET /api/sessions
     * List user's scribe sessions
     */
    list: async (params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }): Promise<{
      sessions: Session[];
      total: number;
    }> => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append("status", params.status);
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());

      const query = queryParams.toString();
      return apiFetch(`/api/sessions${query ? `?${query}` : ""}`);
    },

    /**
     * GET /api/sessions/{sessionId}
     * Get a specific scribe session with all data
     */
    get: async (sessionId: string, options?: {
      patientId?: string;
      encounterId?: string;
      [key: string]: any;
    }): Promise<Session> => {
      // Build query params from options (GET requests cannot have body)
      const queryParams = new URLSearchParams();
      if (options?.patientId) queryParams.append("patientId", options.patientId);
      if (options?.encounterId) queryParams.append("encounterId", options.encounterId);
      
      const query = queryParams.toString();
      return apiFetch(`/api/sessions/${sessionId}${query ? `?${query}` : ""}`);
    },

    /**
     * POST /api/sessions/{sessionId}/patient
     * Bind a patient to a scribe session
     */
    bindPatient: async (
      sessionId: string,
      patientId: string,
      encounterId?: string
    ): Promise<{ success: boolean; message: string }> => {

      const payload = {
        patientId: patientId,
        ...(encounterId && { encounterId: encounterId }),
      };

      return apiFetch(`/api/sessions/${sessionId}/patient`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    /**
     * PATCH /api/sessions/{sessionId}/note-sections/{sectionKey}
     * Update a note section in a session
     */
    updateNoteSection: async (
      sessionId: string,
      sectionKey: string,
      content: string,
      encounterId?: string
    ): Promise<{ success: boolean; message: string }> => {
      return apiFetch(
        `/api/sessions/${sessionId}/note-sections/${encodeURIComponent(sectionKey)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            content,
            ...(encounterId && { encounter_id: encounterId }),
          }),
        }
      );
    },
  };

  // ========================================================================
  // Recordings APIs (6 endpoints)
  // ========================================================================
  recordings = {
    /**
     * POST /api/recordings/upload
     * Upload and process a complete audio file
     */
    upload: async (
      file: Blob | File,
      templateId: string,
      patientId?: string,
      encounterId?: string
    ): Promise<Recording> => {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("templateId", templateId);
      if (patientId) formData.append("patientId", patientId);
      if (encounterId) formData.append("encounterId", encounterId);

      const headers: Record<string, string> = {};
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("accessToken");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      try {
        const response = await fetch(`${this.baseUrl}/api/recordings/upload`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new ApiError(
            errorData.message || "Upload failed",
            response.status,
            errorData.error
          );
        }

        return await response.json();
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError("Upload failed", 0, "network_error");
      }
    },

    /**
     * GET /api/recordings
     * Get all recordings with optional filters
     */
    list: async (params?: {
      status?: string;
      limit?: number;
      offset?: number;
      encounterId?: string;
    }): Promise<{
      recordings: Recording[];
      total: number;
    }> => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append("status", params.status);
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());
      if (params?.encounterId)
        queryParams.append("encounterId", params.encounterId);

      const query = queryParams.toString();
      return apiFetch(`/api/recordings${query ? `?${query}` : ""}`);
    },

    /**
     * GET /api/recordings/{recordingId}
     * Get a specific recording with analysis results
     */
    get: async (recordingId: string): Promise<Recording> => {
      return apiFetch(`/api/recordings/${recordingId}`);
    },

    /**
     * GET /api/recordings/{recordingId}/status
     * Check the processing status of a recording
     */
    getStatus: async (recordingId: string): Promise<{
      id: string;
      status: string;
      progress: number;
      message: string;
    }> => {
      return apiFetch(`/api/recordings/${recordingId}/status`);
    },

    /**
     * GET /api/recordings/{recordingId}/segments
     * Get transcript segments from a recording
     */
    getSegments: async (recordingId: string): Promise<{
      segments: Array<{
        id: string;
        speaker: string;
        text: string;
        start_time_seconds: number;
        end_time_seconds: number;
        confidence: number;
      }>;
    }> => {
      return apiFetch(`/api/recordings/${recordingId}/segments`);
    },

    /**
     * DELETE /api/recordings/{recordingId}
     * Delete a recording (HIPAA compliant)
     */
    delete: async (recordingId: string): Promise<{
      success: boolean;
      message: string;
    }> => {
      return apiFetch(`/api/recordings/${recordingId}`, { method: "DELETE" });
    },

    /**
     * POST /api/recordings/chunked/init
     * Initialize a chunked upload session
     */
    initChunkedUpload: async (params: {
      templateId?: string;
      patient_id?: string;
      encounter_id?: string;
      scribe_session_id?: string;
      [key: string]: any;
    }): Promise<{
      sessionId: string;
      session_id: string;
      recordingId: string;
      recording_id: string;
      expiresAt: string;
      expires_at: string;
    }> => {
      return apiFetch("/api/recordings/chunked/init", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /**
     * POST /api/recordings/chunked/finalize
     * Finalize a chunked upload session
     */
    finalizeChunkedUpload: async (sessionId: string): Promise<{
      id: string;
      status: string;
      message: string;
      estimatedProcessingTime: number;
    }> => {
      return apiFetch("/api/recordings/chunked/finalize", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
    },

    /**
     * GET /api/recordings/chunked/status/{sessionId}
     * Check chunked upload session status
     */
    getChunkedUploadStatus: async (sessionId: string): Promise<{
      sessionId: string;
      status: string;
      totalChunks: number;
      chunksReceived: number;
      progress: number;
      recordingId: string;
      missingChunks: number[];
    }> => {
      return apiFetch(`/api/recordings/chunked/status/${sessionId}`);
    },

    /**
     * POST /api/recordings/chunked/resume
     * Resume an interrupted chunked upload
     */
    resumeChunkedUpload: async (sessionId: string): Promise<{
      sessionId: string;
      status: string;
      chunksToResend: number[];
    }> => {
      return apiFetch("/api/recordings/chunked/resume", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
    },
  };
  notes = {
    /**
     * POST /api/notes
     * Create a new clinical note
     */
    create: async (noteData: CreateNoteRequest): Promise<Note> => {
      return apiFetch("/api/notes", {
        method: "POST",
        body: JSON.stringify(noteData),
      });
    },

    /**
     * GET /api/notes/{noteId}
     * Get a specific note
     */
    get: async (noteId: string): Promise<Note> => {
      return apiFetch(`/api/notes/${noteId}`);
    },

    /**
     * PUT /api/notes/{noteId}
     * Update a note
     */
    update: async (
      noteId: string,
      noteData: {
        title?: string;
        content?: string;
        status?: string;
        tags?: string[];
      }
    ): Promise<Note> => {
      return apiFetch(`/api/notes/${noteId}`, {
        method: "PUT",
        body: JSON.stringify(noteData),
      });
    },

    /**
     * DELETE /api/notes/{noteId}
     * Delete a note
     */
    delete: async (noteId: string): Promise<{
      success: boolean;
      message: string;
    }> => {
      return apiFetch(`/api/notes/${noteId}`, { method: "DELETE" });
    },

    /**
     * POST /api/notes/{noteId}/sign
     * Sign a note (mark as officially completed)
     */
    sign: async (noteId: string): Promise<{
      success: boolean;
      message: string;
      signedAt: string;
    }> => {
      return apiFetch(`/api/notes/${noteId}/sign`, { method: "POST" });
    },

    /**
     * GET /api/notes?patientId={patientId}
     * Get notes for a patient
     */
    listByPatient: async (
      patientId: string,
      params?: { limit?: number; offset?: number }
    ): Promise<{
      notes: Note[];
      total: number;
    }> => {
      const queryParams = new URLSearchParams();
      queryParams.append("patientId", patientId);
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.offset) queryParams.append("offset", params.offset.toString());

      return apiFetch(`/api/notes?${queryParams.toString()}`);
    },

    /**
     * GET /api/notes/session/{scribeSessionId}
     * Get notes for a scribe session (by scribe_page_id)
     * Used after recording processing to find note and update with analysis
     */
    getByScribeSession: async (
      scribeSessionId: string
    ): Promise<{
      notes: Note[];
      total: number;
      count: number;
    }> => {
      return apiFetch(`/api/notes/session/${scribeSessionId}`);
    },
  };

  // ========================================================================
  // Chunked Upload APIs (5 endpoints)
  // ========================================================================
  chunkedUpload = {
    /**
     * POST /api/recordings/chunked/init
     * Initialize a chunked upload session
     */
    init: async (params: {
      templateId: string;
      patientId?: string;
      encounterId?: string;
      scribeSessionId?: string;
    }): Promise<ChunkedUploadSession> => {
      // Convert camelCase params to match backend expectations
      // IMPORTANT: Backend expects "sessionId", NOT "scribeSessionId"
      const requestBody = {
        templateId: params.templateId,
        patientId: params.patientId,
        encounterId: params.encounterId,
        sessionId: params.scribeSessionId,  // ✅ Map scribeSessionId -> sessionId
      };

      const response = await apiFetch<any>("/api/recordings/chunked/init", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Handle both camelCase and snake_case from backend response
      return {
        sessionId: response.sessionId || response.session_id,
        recordingId: response.recordingId || response.recording_id,
        status: response.status || "active",
        totalChunks: response.totalChunks || response.total_chunks,
        chunksReceived: response.chunksReceived || response.chunks_received,
        progress: response.progress || 0,
        createdAt: response.createdAt || response.created_at || new Date().toISOString(),
        expiresAt: response.expiresAt || response.expires_at,
      };
    },

    /**
     * POST /api/recordings/chunked/upload
     * Upload a single audio chunk
     */
    uploadChunk: async (
      sessionId: string,
      chunk: Blob,
      chunkIndex: number,
      totalChunks: number,
      isLastChunk: boolean
    ): Promise<{
      chunkIndex: number;
      sessionId: string;
      chunksReceived: number;
      totalChunks: number;
      progress: number;
      message: string;
    }> => {
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("chunkIndex", chunkIndex.toString());
      formData.append("totalChunks", totalChunks.toString());
      formData.append("isLastChunk", isLastChunk.toString());
      formData.append("chunk", chunk);

      const headers: Record<string, string> = {};
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("accessToken");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      try {
        const response = await fetch(
          `${this.baseUrl}/api/recordings/chunked/upload`,
          {
            method: "POST",
            headers,
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new ApiError(
            errorData.message || "Chunk upload failed",
            response.status,
            errorData.error
          );
        }

        return await response.json();
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError("Chunk upload failed", 0, "network_error");
      }
    },

    /**
     * POST /api/recordings/chunked/finalize
     * Finalize the chunked upload and start processing
     * 
     * @param sessionId - The upload session ID
     * @param totalSize - (Optional) Total audio size in bytes. Backend uses this to validate all chunks were received.
     *                    Pass this to verify the sum of all chunk sizes matches expectations.
     */
    finalize: async (sessionId: string, totalSize?: number): Promise<{
      id: string;
      sessionId: string;
      status: string;
      totalChunks: number;
      chunksReceived: number;
      message: string;
      estimatedProcessingTime: number;
    }> => {
      return apiFetch("/api/recordings/chunked/finalize", {
        method: "POST",
        body: JSON.stringify({ 
          sessionId,
          ...(typeof totalSize !== 'undefined' && { totalSize })
        }),
      });
    },

    /**
     * GET /api/recordings/chunked/status/{sessionId}
     * Check the status of a chunked upload session
     */
    getStatus: async (sessionId: string): Promise<{
      sessionId: string;
      status: string;
      totalChunks: number;
      chunksReceived: number;
      progress: number;
      recordingId: string;
      missingChunks?: number[];
    }> => {
      return apiFetch(`/api/recordings/chunked/status/${sessionId}`);
    },

    /**
     * POST /api/recordings/chunked/resume
     * Resume an interrupted chunked upload
     */
    resume: async (sessionId: string): Promise<{
      sessionId: string;
      status: string;
      chunksToResend: number[];
      message: string;
    }> => {
      return apiFetch("/api/recordings/chunked/resume", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
    },
  };

  // ========================================================================
  // Scribe Workspace API (2 endpoints - BONUS)
  // ========================================================================
  scribeWorkspace = {
    /**
     * GET /api/scribe-workspace
     * Get the scribe workspace with all related information
     */
    get: async (): Promise<{
      patient?: Patient;
      encounter?: Record<string, any>;
      tasks?: Record<string, any>[];
      orders?: Record<string, any>[];
      diagnostics?: Record<string, any>[];
    }> => {
      return apiFetch("/api/scribe-workspace");
    },

    /**
     * PATCH /api/scribe-workspace/note-sections/{sectionKey}
     * Update a note section in the scribe workspace
     */
    updateNoteSection: async (
      sectionKey: string,
      content: string,
      encounterId?: string
    ): Promise<{ success: boolean; message: string }> => {
      return apiFetch(
        `/api/scribe-workspace/note-sections/${encodeURIComponent(sectionKey)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            content,
            ...(encounterId && { encounter_id: encounterId }),
          }),
        }
      );
    },
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: ApiClient | null = null;

/**
 * Get or create the API client singleton
 * 
 * @example
 * import { getApiClient } from "@/lib/api-client-unified";
 * 
 * const client = getApiClient();
 * const user = await client.auth.getCurrentUser();
 * const patients = await client.patients.list();
 * const templates = await client.templates.list();
 */
export function getApiClient(): ApiClient {
  if (!clientInstance) {
    clientInstance = new ApiClient();
  }
  return clientInstance;
}

export default ApiClient;
