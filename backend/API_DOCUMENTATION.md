# DocterScribe-EMR API Documentation

Complete API documentation for DocterScribe-EMR clinical documentation platform featuring real-time audio transcription, AI-powered clinical analysis, and template-agnostic note generation.

## Table of Contents

- [Overview](#overview)
- [Base URLs](#base-urls)
- [Authentication](#authentication)
- [Real-Time Processing with SSE](#real-time-processing-with-sse)
- [Quick Workflows](#quick-workflows)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Patients](#patient-endpoints)
  - [Templates](#template-endpoints)
  - [Sessions](#session-endpoints)
  - [Recordings](#recording-endpoints)
  - [Chunked Upload](#chunked-upload-endpoints)
  - [Notes](#notes-endpoints)
  - [Workspace](#workspace-endpoints)
- [Error Handling](#error-handling)
- [Common Response Formats](#common-response-formats)

---

## Overview

DocterScribe-EMR Backend API provides comprehensive endpoints for:

- **User Authentication** - Login and session management
- **Patient Management** - Create and retrieve patient records
- **Clinical Templates** - Access 54+ specialty-specific templates
- **Recording Upload** - Single and chunked audio file uploads
- **AI Processing** - Automatic transcription and clinical analysis via Google Vertex AI
- **Real-Time Updates** - Server-Sent Events (SSE) for processing status
- **Note Management** - Create, update, and sign clinical notes
- **Scribe Workspace** - Complete workspace context for clinical documentation

## Base URLs

| Environment       | URL                            |
| ----------------- | ------------------------------ |
| Local Development | `http://localhost:8000`        |
| Staging           | `https://staging.medclara.com` |
| Production        | `https://api.medclara.com`     |

## Authentication

All API endpoints (except login) require JWT Bearer token authentication.

### Getting a Token

**Endpoint:** `POST /api/auth/login`

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@medclara.com",
    "password": "secure_password"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "user": {
    "id": "user-123",
    "email": "doctor@medclara.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "clinician",
    "organization_id": "org-456"
  }
}
```

### Using the Token

Include the token in the `Authorization` header for all subsequent requests:

```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Token Details

- **Type:** JWT (JSON Web Token)
- **Algorithm:** HS256
- **Expiration:** 1 hour
- **Refresh:** Re-authenticate to get a new token

---

## Real-Time Processing with SSE

DocterScribe-EMR uses **Server-Sent Events (SSE)** for real-time recording processing updates.

### Benefits Over Polling

| Metric           | SSE                     | Polling           |
| ---------------- | ----------------------- | ----------------- |
| Network Requests | 1 persistent connection | 99% more requests |
| Response Time    | Instant                 | 20x slower        |
| Battery Drain    | 83% less                | Constant polling  |
| Server Load      | 80% less                | Hundreds of polls |

### SSE Workflow

1. **Initialize Upload**: `POST /api/recordings/chunked/init`
2. **Upload Chunks**: `POST /api/recordings/chunked/upload` (repeat)
3. **Finalize Upload**: `POST /api/recordings/chunked/finalize`
4. **Stream Events**: `GET /api/recordings/{recordingId}/stream` (SSE)
5. **Process Events**: Listen for `processing` → `completed` or `failed`

### Listening to SSE Events

**JavaScript Example:**

```javascript
const eventSource = new EventSource(
  `http://localhost:8000/api/recordings/rec-123/stream`,
  { headers: { Authorization: `Bearer ${token}` } },
);

eventSource.addEventListener("processing", (event) => {
  const data = JSON.parse(event.data);
  console.log("Processing:", data);
});

eventSource.addEventListener("completed", (event) => {
  const data = JSON.parse(event.data);
  console.log("Completed:", data);
  eventSource.close();
});

eventSource.addEventListener("failed", (event) => {
  const data = JSON.parse(event.data);
  console.log("Failed:", data.error);
  eventSource.close();
});
```

### Event Types

| Event        | Description                      | Data                              |
| ------------ | -------------------------------- | --------------------------------- |
| `processing` | Recording is being processed     | `{ status, progress, message }`   |
| `completed`  | Processing finished successfully | `{ id, transcription, analysis }` |
| `failed`     | Processing failed                | `{ error, message, details }`     |

---

## Quick Workflows

### Workflow 1: Simple Recording Upload

```bash
# 1. Upload a complete audio file
curl -X POST http://localhost:8000/api/recordings/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@recording.mp3" \
  -F "encounterId=enc-123"

# Response includes recording ID and processing status
# Audio is automatically transcribed and analyzed
```

### Workflow 2: Chunked Upload with Progress Tracking

```bash
# 1. Initialize chunked upload
curl -X POST http://localhost:8000/api/recordings/chunked/init \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"large_recording.mp3"}'

# Returns: { "sessionId": "session-123", "recordingId": "rec-123" }

# 2. Upload chunks (in any order)
curl -X POST http://localhost:8000/api/recordings/chunked/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "sessionId=session-123" \
  -F "chunkIndex=0" \
  -F "chunk=@chunk_0.bin"

# 3. Finalize upload and start processing
curl -X POST http://localhost:8000/api/recordings/chunked/finalize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"session-123"}'

# 4. Listen for real-time updates
curl -N http://localhost:8000/api/recordings/rec-123/stream \
  -H "Authorization: Bearer $TOKEN"
```

### Workflow 3: Create Clinical Note from Session

```bash
# 1. Get available templates
curl -X GET "http://localhost:8000/api/templates?specialty=cardiology" \
  -H "Authorization: Bearer $TOKEN"

# 2. Create a session with template
curl -X POST http://localhost:8000/api/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"templateId":"template-uuid-123"}'

# Returns: { "sessionId": "session-456" }

# 3. Bind patient to session
curl -X POST http://localhost:8000/api/sessions/session-456/patient \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId":"patient-789"}'

# 4. Get workspace with pre-populated data
curl -X GET http://localhost:8000/api/scribe-workspace \
  -H "Authorization: Bearer $TOKEN"

# 5. Update note sections from recording
curl -X PATCH http://localhost:8000/api/scribe-workspace/note-sections/hpi \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Patient presents with chest pain..."}'
```

---

## API Endpoints

### Authentication Endpoints

#### Login User

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate user with email and password to receive JWT token

**Request Body:**

```json
{
  "email": "doctor@medclara.com",
  "password": "password123",
  "from": "http://example.com/redirect" // Optional redirect URL
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "user": {
    "id": "user-123",
    "email": "doctor@medclara.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "clinician",
    "organization_id": "org-456"
  }
}
```

**Error (401 Unauthorized):**

```json
{
  "error": "unauthorized",
  "message": "Invalid email or password"
}
```

---

#### Get Current User

**Endpoint:** `GET /api/auth/me`

**Description:** Retrieve information about the authenticated user

**Headers:**

```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**

```json
{
  "id": "user-123",
  "email": "doctor@medclara.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "clinician",
  "organization_id": "org-456"
}
```

---

#### Logout User

**Endpoint:** `POST /api/auth/logout`

**Description:** Invalidate current session

**Headers:**

```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### Patient Endpoints

#### List Patients

**Endpoint:** `GET /api/patients`

**Description:** Retrieve paginated list of patients

**Query Parameters:**

- `limit` (integer, optional): Items per page (default: 20)
- `offset` (integer, optional): Offset from start (default: 0)

**Headers:**

```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "patient-123",
      "first_name": "Jane",
      "last_name": "Smith",
      "date_of_birth": "1985-05-15",
      "gender": "F",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "medical_record_number": "MRN-2024-001",
      "address": "123 Main St, City, State",
      "primary_language": "en",
      "allergies": ["Penicillin"],
      "medications": ["Lisinopril"],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-05-17T12:45:00Z"
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

---

#### Create Patient

**Endpoint:** `POST /api/patients`

**Description:** Create a new patient record

**Request Body:**

```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "date_of_birth": "1985-05-15",
  "gender": "F",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "medical_record_number": "MRN-2024-001"
}
```

**Response (201 Created):**

```json
{
  "id": "patient-123",
  "first_name": "Jane",
  "last_name": "Smith",
  "date_of_birth": "1985-05-15",
  "gender": "F",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "medical_record_number": "MRN-2024-001",
  "address": null,
  "primary_language": "en",
  "allergies": [],
  "medications": [],
  "created_at": "2024-05-17T12:45:00Z",
  "updated_at": "2024-05-17T12:45:00Z"
}
```

---

#### Get Patient

**Endpoint:** `GET /api/patients/{patientId}`

**Description:** Retrieve specific patient by ID

**Path Parameters:**

- `patientId` (string, required): Patient UUID

**Response (200 OK):**

```json
{
  "id": "patient-123",
  "first_name": "Jane",
  "last_name": "Smith",
  "date_of_birth": "1985-05-15",
  "gender": "F",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "medical_record_number": "MRN-2024-001",
  "address": "123 Main St, City, State",
  "primary_language": "en",
  "allergies": ["Penicillin"],
  "medications": ["Lisinopril"],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-05-17T12:45:00Z"
}
```

---

### Template Endpoints

#### List Templates

**Endpoint:** `GET /api/templates`

**Description:** Retrieve available clinical note templates

**Query Parameters:**

- `active_only` (boolean, optional): Return only active templates (default: true)
- `specialty` (string, optional): Filter by specialty (e.g., "cardiology")
- `category` (string, optional): Filter by category (e.g., "General Medicine")

**Example:**

```bash
curl -X GET "http://localhost:8000/api/templates?specialty=cardiology&active_only=true" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**

```json
[
  {
    "id": "template-uuid-001",
    "template_key": "soap-cardiology",
    "label": "SOAP - Cardiology",
    "description": "Standard cardiology SOAP note template",
    "specialty": "cardiology",
    "category": "General Medicine",
    "sections": [
      "chief_complaint",
      "history_of_present_illness",
      "past_medical_history",
      "medications",
      "physical_examination",
      "assessment",
      "plan"
    ],
    "is_active": true,
    "prompt": "Extract clinical information from cardiology consultation...",
    "extract_style": "structured",
    "prompt_version": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-05-17T00:00:00Z"
  }
]
```

---

#### Get Template by Key

**Endpoint:** `GET /api/templates/key/{templateKey}`

**Description:** Retrieve template by machine-readable key

**Path Parameters:**

- `templateKey` (string, required): Template key (e.g., "soap-general")

**Response (200 OK):**

```json
{
  "id": "template-uuid-001",
  "template_key": "soap-general",
  "label": "SOAP - General",
  "description": "Standard SOAP note template",
  "specialty": "general_medicine",
  "category": "General Medicine",
  "sections": [
    "chief_complaint",
    "history_of_present_illness",
    "past_medical_history",
    "medications",
    "allergies",
    "physical_examination",
    "assessment",
    "plan"
  ],
  "is_active": true,
  "prompt": "Extract clinical information...",
  "extract_style": "structured",
  "prompt_version": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-05-17T00:00:00Z"
}
```

---

#### Get Template UUID Mapping

**Endpoint:** `GET /api/templates/uuids`

**Description:** Retrieve mapping of template keys to their UUIDs for caching

**Response (200 OK):**

```json
{
  "soap-general": "550e8400-e29b-41d4-a716-446655440000",
  "soap-cardiology": "550e8400-e29b-41d4-a716-446655440001",
  "soap-pediatrics": "550e8400-e29b-41d4-a716-446655440002",
  "hp-general": "550e8400-e29b-41d4-a716-446655440003",
  "hpi-focused": "550e8400-e29b-41d4-a716-446655440004"
}
```

---

#### Get Template Categories

**Endpoint:** `GET /api/templates/categories`

**Description:** Retrieve all available template categories

**Response (200 OK):**

```json
[
  "General Medicine",
  "Cardiology",
  "Pediatrics",
  "Orthopedics",
  "Mental Health",
  "Dermatology",
  "ENT",
  "Neurology",
  "Gastroenterology"
]
```

---

### Recording Endpoints

#### Upload Recording (Simple)

**Endpoint:** `POST /api/recordings/upload`

**Description:** Upload a complete audio file for transcription and analysis

**Request Body (multipart/form-data):**

- `audio` (file, required): Audio file (WebM, MP3, WAV, OGG, FLAC, AMR)
- `encounterId` (string, optional): Associated encounter ID
- `templateId` (string, optional): Template for extraction
- `patientId` (string, optional): Associated patient ID

**Example:**

```bash
curl -X POST http://localhost:8000/api/recordings/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@recording.mp3" \
  -F "encounterId=enc-123" \
  -F "templateId=template-uuid-001"
```

**Response (201 Created):**

```json
{
  "id": "rec-999",
  "status": "processing",
  "transcription": null,
  "analysis": null,
  "created_at": "2024-05-17T14:30:00Z",
  "updated_at": "2024-05-17T14:30:00Z",
  "encounter_id": "enc-123",
  "template_id": "template-uuid-001"
}
```

---

#### Get Recording

**Endpoint:** `GET /api/recordings/{recordingId}`

**Description:** Retrieve specific recording with analysis results

**Path Parameters:**

- `recordingId` (string, required): Recording ID

**Response (200 OK - Completed):**

```json
{
  "id": "rec-999",
  "status": "completed",
  "transcription": "Doctor: How are you feeling today? Patient: I've had chest pain for the last two days...",
  "analysis": {
    "extracted_sections": {
      "chief_complaint": "Chest pain",
      "history_of_present_illness": "Patient reports chest pain for the last 2 days, worse with exertion...",
      "medications": ["Aspirin", "Lisinopril"],
      "assessment": "Atypical chest pain, rule out cardiac etiology",
      "plan": "EKG, chest X-ray, troponin levels"
    },
    "entities": [
      {
        "type": "symptom",
        "value": "chest pain",
        "confidence": 0.98
      },
      {
        "type": "medication",
        "value": "Aspirin",
        "confidence": 0.95
      }
    ],
    "confidence_score": 0.92,
    "speaker_diarization": [
      {
        "speaker": "doctor",
        "start_time": 0,
        "end_time": 5,
        "text": "How are you feeling today?"
      },
      {
        "speaker": "patient",
        "start_time": 5,
        "end_time": 15,
        "text": "I've had chest pain for the last two days..."
      }
    ]
  },
  "processing_time_ms": 5000,
  "created_at": "2024-05-17T14:30:00Z",
  "updated_at": "2024-05-17T14:35:00Z"
}
```

---

#### Get Recording Status

**Endpoint:** `GET /api/recordings/{recordingId}/status`

**Description:** Check the processing status of a recording

**Response (200 OK):**

```json
{
  "id": "rec-999",
  "status": "processing",
  "progress": 65,
  "message": "Analyzing clinical entities...",
  "processing_time_ms": 3200
}
```

**Status Values:**

- `pending` - Waiting to be processed
- `processing` - Currently being transcribed and analyzed
- `completed` - Processing finished successfully
- `failed` - Processing failed

---

#### Get Transcript Segments

**Endpoint:** `GET /api/recordings/{recordingId}/segments`

**Description:** Retrieve transcript segments with speaker diarization

**Response (200 OK):**

```json
[
  {
    "id": "segment-1",
    "recording_id": "rec-999",
    "speaker": "doctor",
    "start_time_seconds": 0,
    "end_time_seconds": 5,
    "text": "How are you feeling today?",
    "confidence": 0.98
  },
  {
    "id": "segment-2",
    "recording_id": "rec-999",
    "speaker": "patient",
    "start_time_seconds": 5,
    "end_time_seconds": 20,
    "text": "I've had chest pain for the last two days, especially when I exert myself.",
    "confidence": 0.95
  }
]
```

---

#### Delete Recording

**Endpoint:** `DELETE /api/recordings/{recordingId}`

**Description:** Delete a recording (HIPAA compliant, removes audio)

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Recording deleted successfully"
}
```

---

### Chunked Upload Endpoints

#### Initialize Chunked Upload

**Endpoint:** `POST /api/recordings/chunked/init`

**Description:** Start a new chunked upload session for large audio files

**Request Body:**

```json
{
  "fileName": "large_recording.mp3",
  "fileSize": 52428800,
  "encounterId": "enc-123"
}
```

**Response (201 Created):**

```json
{
  "sessionId": "session-12345",
  "recordingId": "rec-123",
  "uploadUrl": "http://localhost:8000/api/recordings/chunked/upload",
  "chunkSize": 5242880,
  "expiresAt": "2024-05-18T14:30:00Z"
}
```

---

#### Upload Chunk

**Endpoint:** `POST /api/recordings/chunked/upload`

**Description:** Upload a single chunk of audio data

**Request Body (multipart/form-data):**

- `sessionId` (string, required): Upload session ID
- `chunkIndex` (integer, required): Zero-based chunk index
- `chunk` (file, required): Binary audio chunk

**Example:**

```bash
curl -X POST http://localhost:8000/api/recordings/chunked/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "sessionId=session-12345" \
  -F "chunkIndex=0" \
  -F "chunk=@chunk_0.bin"
```

**Response (200 OK):**

```json
{
  "chunkIndex": 0,
  "received": true,
  "chunksReceived": 1,
  "totalChunks": 10,
  "progress": 10,
  "nextChunkIndex": 1
}
```

---

#### Finalize Chunked Upload

**Endpoint:** `POST /api/recordings/chunked/finalize`

**Description:** Finalize the chunked upload and start Vertex AI processing

**Request Body:**

```json
{
  "sessionId": "session-12345",
  "templateId": "template-uuid-001"
}
```

**Response (200 OK):**

```json
{
  "id": "rec-123",
  "sessionId": "session-12345",
  "status": "processing",
  "message": "Upload completed, processing started",
  "chunksReceived": 10,
  "totalChunks": 10
}
```

---

#### Get Chunked Upload Status

**Endpoint:** `GET /api/recordings/chunked/status/{sessionId}`

**Description:** Check the status of a chunked upload session

**Response (200 OK):**

```json
{
  "sessionId": "session-12345",
  "status": "uploading",
  "chunksReceived": 7,
  "totalChunks": 10,
  "progress": 70,
  "expiresAt": "2024-05-18T14:30:00Z"
}
```

---

#### Resume Interrupted Upload

**Endpoint:** `POST /api/recordings/chunked/resume`

**Description:** Resume an interrupted chunked upload

**Request Body:**

```json
{
  "sessionId": "session-12345"
}
```

**Response (200 OK):**

```json
{
  "sessionId": "session-12345",
  "recordingId": "rec-123",
  "chunksReceived": 7,
  "missingChunks": [7, 8, 9],
  "nextChunkIndex": 7
}
```

---

### Notes Endpoints

#### Create Note

**Endpoint:** `POST /api/notes`

**Description:** Create a new clinical note

**Request Body:**

```json
{
  "patient_id": "patient-123",
  "encounter_id": "enc-456",
  "template_id": "template-uuid-001",
  "title": "Follow-up Visit - Cardiology",
  "content": "Patient presents for follow-up of hypertension..."
}
```

**Response (201 Created):**

```json
{
  "id": "note-789",
  "patient_id": "patient-123",
  "encounter_id": "enc-456",
  "template_id": "template-uuid-001",
  "title": "Follow-up Visit - Cardiology",
  "content": "Patient presents for follow-up of hypertension...",
  "status": "draft",
  "created_by": "user-123",
  "created_at": "2024-05-17T14:30:00Z",
  "updated_at": "2024-05-17T14:30:00Z"
}
```

---

#### List Notes by Patient

**Endpoint:** `GET /api/notes`

**Description:** Retrieve notes for a specific patient

**Query Parameters:**

- `patientId` (string, required): Patient UUID
- `limit` (integer, optional): Items per page (default: 20)
- `offset` (integer, optional): Offset from start (default: 0)

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "note-789",
      "patient_id": "patient-123",
      "encounter_id": "enc-456",
      "template_id": "template-uuid-001",
      "title": "Follow-up Visit - Cardiology",
      "content": "Patient presents for follow-up...",
      "status": "signed",
      "created_by": "user-123",
      "created_at": "2024-05-17T14:30:00Z",
      "updated_at": "2024-05-17T15:00:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

#### Get Note

**Endpoint:** `GET /api/notes/{noteId}`

**Description:** Retrieve specific note

**Response (200 OK):**

```json
{
  "id": "note-789",
  "patient_id": "patient-123",
  "encounter_id": "enc-456",
  "template_id": "template-uuid-001",
  "title": "Follow-up Visit - Cardiology",
  "content": "Patient presents for follow-up of hypertension...",
  "status": "signed",
  "created_by": "user-123",
  "signed_by": "user-123",
  "signed_at": "2024-05-17T15:00:00Z",
  "created_at": "2024-05-17T14:30:00Z",
  "updated_at": "2024-05-17T15:00:00Z"
}
```

---

#### Update Note

**Endpoint:** `PUT /api/notes/{noteId}`

**Description:** Update a note

**Request Body:**

```json
{
  "title": "Updated Title",
  "content": "Updated clinical content..."
}
```

**Response (200 OK):**

```json
{
  "id": "note-789",
  "title": "Updated Title",
  "content": "Updated clinical content...",
  "status": "draft",
  "updated_at": "2024-05-17T15:30:00Z"
}
```

---

#### Sign Note

**Endpoint:** `POST /api/notes/{noteId}/sign`

**Description:** Sign a note (mark as officially completed)

**Response (200 OK):**

```json
{
  "id": "note-789",
  "status": "signed",
  "signed_by": "user-123",
  "signed_at": "2024-05-17T15:00:00Z",
  "message": "Note signed successfully"
}
```

---

#### Delete Note

**Endpoint:** `DELETE /api/notes/{noteId}`

**Description:** Delete a note

**Response (204 No Content)**

---

### Workspace Endpoints

#### Get Scribe Workspace

**Endpoint:** `GET /api/scribe-workspace`

**Description:** Retrieve scribe workspace with patient context and related data

**Query Parameters:**

- `patientId` (string, optional): Patient UUID
- `encounterId` (string, optional): Encounter UUID

**Response (200 OK):**

```json
{
  "patient": {
    "id": "patient-123",
    "first_name": "Jane",
    "last_name": "Smith",
    "date_of_birth": "1985-05-15",
    "gender": "F",
    "email": "jane@example.com",
    "allergies": ["Penicillin"],
    "medications": ["Lisinopril"]
  },
  "encounter": {
    "id": "enc-456",
    "patient_id": "patient-123",
    "type": "office_visit",
    "date": "2024-05-17",
    "chief_complaint": "Chest pain"
  },
  "current_note": {
    "id": "note-789",
    "status": "draft",
    "template_id": "template-uuid-001",
    "content": "..."
  },
  "recent_recordings": [
    {
      "id": "rec-999",
      "status": "completed",
      "created_at": "2024-05-17T14:30:00Z"
    }
  ],
  "tasks": [
    {
      "id": "task-111",
      "description": "Schedule follow-up appointment",
      "status": "pending",
      "due_date": "2024-05-24"
    }
  ],
  "orders": [
    {
      "id": "order-222",
      "type": "lab",
      "description": "Complete blood count",
      "status": "pending"
    }
  ],
  "diagnostic_results": [
    {
      "id": "result-333",
      "type": "lab",
      "name": "Blood Pressure",
      "value": "120/80",
      "unit": "mmHg",
      "date": "2024-05-17"
    }
  ],
  "available_templates": [
    {
      "id": "template-uuid-001",
      "label": "SOAP - General",
      "key": "soap-general"
    }
  ]
}
```

---

#### Update Workspace Note Section

**Endpoint:** `PATCH /api/scribe-workspace/note-sections/{sectionKey}`

**Description:** Update a note section in the scribe workspace

**Path Parameters:**

- `sectionKey` (string, required): Section key (e.g., "hpi", "assessment")

**Request Body:**

```json
{
  "content": "Patient presents with chest pain and shortness of breath...",
  "encounterId": "enc-456"
}
```

**Response (200 OK):**

```json
{
  "sectionKey": "hpi",
  "content": "Patient presents with chest pain and shortness of breath...",
  "updated_at": "2024-05-17T15:30:00Z"
}
```

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable error description",
  "details": {
    "field": "additional error details"
  }
}
```

### Common HTTP Status Codes

| Code | Meaning              | Example                                  |
| ---- | -------------------- | ---------------------------------------- |
| 200  | OK                   | Successful GET, PATCH, PUT               |
| 201  | Created              | Successful POST (resource created)       |
| 204  | No Content           | Successful DELETE                        |
| 400  | Bad Request          | Invalid request parameters               |
| 401  | Unauthorized         | Missing or invalid token                 |
| 403  | Forbidden            | Token valid but insufficient permissions |
| 404  | Not Found            | Resource does not exist                  |
| 409  | Conflict             | Duplicate or conflicting resource        |
| 422  | Unprocessable Entity | Validation error                         |
| 429  | Too Many Requests    | Rate limit exceeded                      |
| 500  | Server Error         | Internal server error                    |

### Example Error Responses

**400 Bad Request:**

```json
{
  "error": "bad_request",
  "message": "Invalid request parameters",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  }
}
```

**401 Unauthorized:**

```json
{
  "error": "unauthorized",
  "message": "Invalid or missing authentication token"
}
```

**404 Not Found:**

```json
{
  "error": "not_found",
  "message": "Patient with ID patient-999 not found"
}
```

**422 Unprocessable Entity:**

```json
{
  "error": "validation_error",
  "message": "Validation failed",
  "details": {
    "audio": "File size exceeds maximum allowed size (100MB)"
  }
}
```

---

## Common Response Formats

### Paginated Response

Used for list endpoints:

```json
{
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### Success Response

For single resource operations:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {...}
}
```

### Async Response

For long-running operations:

```json
{
  "id": "operation-123",
  "status": "processing",
  "progress": 45,
  "message": "Processing your request...",
  "statusUrl": "http://localhost:8000/api/.../status/operation-123"
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authenticated Users**: 1000 requests per hour
- **Per IP**: 100 requests per hour

Rate limit headers returned in all responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1234567890
```

---

## Support & Resources

- **API Base URL**: See [Base URLs](#base-urls) section
- **Authentication**: See [Authentication](#authentication) section
- **OpenAPI Specification**: See `openapi.yaml` in repository
- **Backend README**: See `backend/README.md`

For issues or questions, contact: `support@medclara.com`

---

**Last Updated**: May 17, 2026  
**Version**: 1.0.0  
**Status**: Production Ready
