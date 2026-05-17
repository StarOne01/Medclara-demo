-- ============================================
-- USERS QUERIES
-- ============================================

-- name: GetUserByEmail :one
SELECT id, email, password, first_name, last_name, role, organization_id, is_active, created_at, updated_at, last_login
FROM users
WHERE email = $1;

-- name: GetUserByID :one
SELECT id, email, password, first_name, last_name, role, organization_id, is_active, created_at, updated_at, last_login
FROM users
WHERE id = $1;

-- name: CreateUser :one
INSERT INTO users (email, password, first_name, last_name, role, organization_id, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, email, password, first_name, last_name, role, organization_id, is_active, created_at, updated_at, last_login;

-- name: UpdateUserLastLogin :exec
UPDATE users
SET last_login = $1, updated_at = $2
WHERE id = $3;

-- name: GetUserProfile :one
SELECT id, email, first_name, last_name, role, organization_id, is_active, created_at
FROM users
WHERE id = $1 AND is_active = TRUE;

-- ============================================
-- ORGANIZATIONS QUERIES
-- ============================================

-- name: GetOrganizationByID :one
SELECT id, name, description, created_at, updated_at
FROM organizations
WHERE id = $1;

-- name: CreateOrganization :one
INSERT INTO organizations (name, description)
VALUES ($1, $2)
RETURNING id, name, description, created_at, updated_at;

-- ============================================
-- PATIENTS QUERIES
-- ============================================

-- name: GetPatientByID :one
SELECT id, first_name, last_name, date_of_birth, gender, email, phone, medical_record_number, organization_id, created_at, updated_at
FROM patients
WHERE id = $1 AND organization_id = $2;

-- name: GetPatientsByOrganization :many
SELECT id, first_name, last_name, date_of_birth, gender, email, phone, medical_record_number, organization_id, created_at, updated_at
FROM patients
WHERE organization_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreatePatient :one
INSERT INTO patients (first_name, last_name, date_of_birth, gender, email, phone, medical_record_number, organization_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, first_name, last_name, date_of_birth, gender, email, phone, medical_record_number, organization_id, created_at, updated_at;

-- name: UpdatePatient :exec
UPDATE patients
SET first_name = $1, last_name = $2, date_of_birth = $3, gender = $4, email = $5, phone = $6, updated_at = $7
WHERE id = $8;

-- ============================================
-- ENCOUNTERS QUERIES
-- ============================================

-- name: GetEncounterByID :one
SELECT e.id, e.patient_id, e.user_id, e.encounter_type, e.status, e.notes, e.created_at, e.updated_at, e.completed_at
FROM encounters e
WHERE e.id = $1 AND e.patient_id IN (SELECT id FROM patients WHERE organization_id = $2);

-- name: GetEncountersByPatient :many
SELECT id, patient_id, user_id, encounter_type, status, notes, created_at, updated_at, completed_at
FROM encounters
WHERE patient_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetEncountersByUser :many
SELECT id, patient_id, user_id, encounter_type, status, notes, created_at, updated_at, completed_at
FROM encounters
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateEncounter :one
INSERT INTO encounters (patient_id, user_id, encounter_type, status, notes)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, patient_id, user_id, encounter_type, status, notes, created_at, updated_at, completed_at;

-- name: UpdateEncounterStatus :exec
UPDATE encounters
SET status = $1, updated_at = $2, completed_at = $3
WHERE id = $4;

-- ============================================
-- TEMPLATES QUERIES - PROMPT-BASED
-- ============================================

-- name: GetAllTemplates :many
SELECT id, template_key, label, description, specialty, category, prompt, extract_style, prompt_version, prompt_last_modified, metadata, is_active, created_at, updated_at
FROM templates
WHERE is_active = TRUE
ORDER BY category, label;

-- name: GetTemplateByID :one
SELECT id, template_key, label, description, specialty, category, prompt, extract_style, prompt_version, prompt_last_modified, metadata, is_active, created_at, updated_at
FROM templates
WHERE id = $1 AND is_active = TRUE;

-- name: GetTemplateByKey :one
SELECT id, template_key, label, description, specialty, category, prompt, extract_style, prompt_version, prompt_last_modified, metadata, is_active, created_at, updated_at
FROM templates
WHERE template_key = $1 AND is_active = TRUE;

-- name: GetTemplatesBySpecialty :many
SELECT id, template_key, label, description, specialty, category, prompt, extract_style, prompt_version, prompt_last_modified, metadata, is_active, created_at, updated_at
FROM templates
WHERE specialty = $1 AND is_active = TRUE
ORDER BY label;

-- name: GetTemplatesByCategory :many
SELECT id, template_key, label, description, specialty, category, prompt, extract_style, prompt_version, prompt_last_modified, metadata, is_active, created_at, updated_at
FROM templates
WHERE category = $1 AND is_active = TRUE
ORDER BY label;

-- name: CreateTemplate :one
INSERT INTO templates (template_key, label, description, specialty, category, prompt, extract_style, metadata, is_active, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, template_key, label, description, specialty, category, prompt, extract_style, prompt_version, prompt_last_modified, metadata, is_active, created_by, created_at, updated_at;

-- name: UpdateTemplate :exec
UPDATE templates
SET label = $1, description = $2, specialty = $3, category = $4, prompt = $5, extract_style = $6, metadata = $7, prompt_version = prompt_version + 1, prompt_last_modified = CURRENT_TIMESTAMP, updated_at = $8
WHERE id = $9;

-- name: UpdateTemplateStatus :exec
UPDATE templates
SET is_active = $1, updated_at = $2
WHERE id = $3;

-- name: DeleteTemplate :exec
UPDATE templates
SET is_active = FALSE, updated_at = $1
WHERE id = $2;

-- ============================================
-- CLINICAL NOTES QUERIES - PROMPT-BASED EXTRACTION
-- ============================================

-- name: GetClinicalNoteByID :one
SELECT id, encounter_id, template_id, user_id, content, extracted_data, status, extraction_method, signed_at, signed_by, created_at, updated_at
FROM clinical_notes
WHERE id = $1;

-- name: GetClinicalNotesByEncounter :many
SELECT id, encounter_id, template_id, user_id, content, extracted_data, status, extraction_method, signed_at, signed_by, created_at, updated_at
FROM clinical_notes
WHERE encounter_id = $1
ORDER BY created_at DESC;

-- name: GetClinicalNotesByUser :many
SELECT id, encounter_id, template_id, user_id, content, extracted_data, status, extraction_method, signed_at, signed_by, created_at, updated_at
FROM clinical_notes
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetClinicalNotesByPatient :many
SELECT cn.id, cn.encounter_id, cn.template_id, cn.user_id, cn.content, cn.extracted_data, cn.status, cn.extraction_method, cn.signed_at, cn.signed_by, cn.created_at, cn.updated_at
FROM clinical_notes cn
JOIN encounters e ON cn.encounter_id = e.id
WHERE e.patient_id = $1
ORDER BY cn.created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetAllClinicalNotes :many
SELECT id, encounter_id, template_id, user_id, content, extracted_data, status, extraction_method, signed_at, signed_by, created_at, updated_at
FROM clinical_notes
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CreateClinicalNote :one
INSERT INTO clinical_notes (encounter_id, template_id, user_id, content, status, extraction_method)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, encounter_id, template_id, user_id, content, extracted_data, status, extraction_method, signed_at, signed_by, created_at, updated_at;

-- name: UpdateClinicalNoteSection :exec
UPDATE clinical_notes
SET content = $1, extracted_data = $2, updated_at = $3
WHERE id = $4;

-- name: SignClinicalNote :exec
UPDATE clinical_notes
SET status = $1, signed_at = $2, signed_by = $3, updated_at = $4
WHERE id = $5;

-- ============================================
-- RECORDINGS QUERIES - WITH PROMPT TRACKING
-- ============================================

-- name: GetRecordingByID :one
SELECT r.id, r.encounter_id, r.user_id, r.patient_id, r.template_id, r.audio_file_url, r.audio_duration_seconds, r.status, r.transcription, r.analysis, r.raw_extraction, r.extraction_prompt_used, r.processing_error, r.processing_time_ms, r.scribe_page_id, r.is_linked, r.linked_at, r.created_at, r.updated_at
FROM recordings r
WHERE r.id = $1 AND r.user_id = (SELECT u.id FROM users u WHERE u.organization_id = $2 LIMIT 1);

-- name: GetRecordingsByEncounter :many
SELECT id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, raw_extraction, extraction_prompt_used, processing_error, processing_time_ms, scribe_page_id, is_linked, linked_at, created_at, updated_at
FROM recordings
WHERE encounter_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetRecordingsByUser :many
SELECT id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, raw_extraction, extraction_prompt_used, processing_error, processing_time_ms, scribe_page_id, is_linked, linked_at, created_at, updated_at
FROM recordings
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetRecordingsByPatient :many
SELECT id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, raw_extraction, extraction_prompt_used, processing_error, processing_time_ms, scribe_page_id, is_linked, linked_at, created_at, updated_at
FROM recordings
WHERE patient_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateRecording :one
INSERT INTO recordings (encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, raw_extraction, extraction_prompt_used, processing_error, processing_time_ms, created_at, updated_at;

-- name: UpdateRecordingStatus :exec
UPDATE recordings
SET status = $1, updated_at = $2
WHERE id = $3;

-- name: UpdateRecordingAnalysis :exec
UPDATE recordings
SET transcription = $1, analysis = $2, raw_extraction = $3, status = $4, processing_time_ms = $5, updated_at = $6
WHERE id = $7;

-- name: UpdateRecordingError :exec
UPDATE recordings
SET processing_error = $1, status = $2, processing_time_ms = $3, updated_at = $4
WHERE id = $5;

-- name: UpdateRecordingWithPrompt :exec
UPDATE recordings
SET extraction_prompt_used = $1, updated_at = $2
WHERE id = $3;

-- name: DeleteRecording :exec
DELETE FROM recordings
WHERE id = $1;

-- name: GetRecordingsByScribeSession :many
SELECT id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, raw_extraction, extraction_prompt_used, processing_error, processing_time_ms, scribe_page_id, is_linked, linked_at, created_at, updated_at
FROM recordings
WHERE scribe_page_id = $1 AND user_id = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetUnlinkedRecordingsByScribeSession :many
SELECT id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, raw_extraction, extraction_prompt_used, processing_error, processing_time_ms, scribe_page_id, is_linked, linked_at, created_at, updated_at
FROM recordings
WHERE scribe_page_id = $1 AND is_linked = FALSE
ORDER BY created_at DESC;

-- name: LinkRecordingToPatient :exec
UPDATE recordings
SET patient_id = $1, encounter_id = $2, is_linked = TRUE, linked_at = $3, updated_at = $4
WHERE id = $5 AND user_id = $6;

-- name: GetOldUnlinkedRecordings :many
SELECT id, user_id, audio_file_url, created_at
FROM recordings
WHERE is_linked = FALSE AND created_at < $1
ORDER BY created_at ASC;

-- name: DeleteUnlinkedRecording :exec
DELETE FROM recordings
WHERE id = $1 AND is_linked = FALSE;

-- name: UpdateRecordingWithScribePageID :one
UPDATE recordings
SET scribe_page_id = $1, updated_at = $2
WHERE id = $3
RETURNING id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, raw_extraction, extraction_prompt_used, processing_error, processing_time_ms, scribe_page_id, is_linked, linked_at, created_at, updated_at;

-- name: CreateRecordingWithScribePage :one
INSERT INTO recordings (encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, scribe_page_id, is_linked)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, raw_extraction, extraction_prompt_used, processing_error, processing_time_ms, scribe_page_id, is_linked, linked_at, created_at, updated_at;

-- ============================================
-- TRANSCRIPT SEGMENTS QUERIES
-- ============================================

-- name: GetTranscriptSegmentsByRecording :many
SELECT id, recording_id, speaker, text, start_time_seconds, end_time_seconds, confidence, created_at
FROM transcript_segments
WHERE recording_id = $1
ORDER BY start_time_seconds ASC;

-- name: CreateTranscriptSegment :one
INSERT INTO transcript_segments (recording_id, speaker, text, start_time_seconds, end_time_seconds, confidence)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, recording_id, speaker, text, start_time_seconds, end_time_seconds, confidence, created_at;

-- name: DeleteTranscriptSegmentsByRecording :exec
DELETE FROM transcript_segments
WHERE recording_id = $1;

-- ============================================
-- TASKS QUERIES
-- ============================================

-- name: GetTaskByID :one
SELECT id, encounter_id, title, description, status, assigned_to, created_by, due_date, created_at, updated_at
FROM tasks
WHERE id = $1;

-- name: GetTasksByEncounter :many
SELECT id, encounter_id, title, description, status, assigned_to, created_by, due_date, created_at, updated_at
FROM tasks
WHERE encounter_id = $1
ORDER BY created_at DESC;

-- name: GetTasksByAssignee :many
SELECT id, encounter_id, title, description, status, assigned_to, created_by, due_date, created_at, updated_at
FROM tasks
WHERE assigned_to = $1
ORDER BY due_date ASC;

-- name: CreateTask :one
INSERT INTO tasks (encounter_id, title, description, status, assigned_to, created_by, due_date)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, encounter_id, title, description, status, assigned_to, created_by, due_date, created_at, updated_at;

-- name: UpdateTaskStatus :exec
UPDATE tasks
SET status = $1, updated_at = $2
WHERE id = $3;

-- ============================================
-- ORDERS QUERIES
-- ============================================

-- name: GetOrderByID :one
SELECT id, encounter_id, order_type, description, status, ordered_by, created_at, updated_at
FROM orders
WHERE id = $1;

-- name: GetOrdersByEncounter :many
SELECT id, encounter_id, order_type, description, status, ordered_by, created_at, updated_at
FROM orders
WHERE encounter_id = $1
ORDER BY created_at DESC;

-- name: CreateOrder :one
INSERT INTO orders (encounter_id, order_type, description, status, ordered_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, encounter_id, order_type, description, status, ordered_by, created_at, updated_at;

-- name: UpdateOrderStatus :exec
UPDATE orders
SET status = $1, updated_at = $2
WHERE id = $3;

-- ============================================
-- DIAGNOSTIC RESULTS QUERIES
-- ============================================

-- name: GetDiagnosticResultByID :one
SELECT id, encounter_id, test_name, test_type, result_value, result_unit, reference_range, status, created_at, updated_at
FROM diagnostic_results
WHERE id = $1;

-- name: GetDiagnosticResultsByEncounter :many
SELECT id, encounter_id, test_name, test_type, result_value, result_unit, reference_range, status, created_at, updated_at
FROM diagnostic_results
WHERE encounter_id = $1
ORDER BY created_at DESC;

-- name: CreateDiagnosticResult :one
INSERT INTO diagnostic_results (encounter_id, test_name, test_type, result_value, result_unit, reference_range, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, encounter_id, test_name, test_type, result_value, result_unit, reference_range, status, created_at, updated_at;

-- name: UpdateDiagnosticResultStatus :exec
UPDATE diagnostic_results
SET status = $1, updated_at = $2
WHERE id = $3;

-- ============================================
-- NOTES QUERIES - WITH EXTRACTION METHOD
-- ============================================

-- name: GetNoteByID :one
SELECT n.id, n.patient_id, n.recording_id, n.encounter_id, n.created_by, n.updated_by, n.title, n.content, n.note_type, n.status, n.scribe_page_id, n.tags, n.metadata, n.extraction_method, n.prompt_version, n.is_signed, n.signed_at, n.signed_by, n.version, n.created_at, n.updated_at
FROM notes n
WHERE n.id = $1 AND (n.patient_id IN (SELECT p.id FROM patients p WHERE p.organization_id = $2) OR n.encounter_id IN (SELECT e.id FROM encounters e WHERE e.patient_id IN (SELECT p.id FROM patients p WHERE p.organization_id = $2)));

-- name: GetNotesByPatient :many
SELECT n.id, n.patient_id, n.recording_id, n.encounter_id, n.created_by, n.updated_by, n.title, n.content, n.note_type, n.status, n.scribe_page_id, n.tags, n.metadata, n.extraction_method, n.prompt_version, n.is_signed, n.signed_at, n.signed_by, n.version, n.created_at, n.updated_at
FROM notes n
WHERE n.patient_id = $1 AND n.patient_id IN (SELECT p.id FROM patients p WHERE p.organization_id = $3)
ORDER BY n.created_at DESC
LIMIT $2 OFFSET $4;

-- name: GetNotesByRecording :many
SELECT id, patient_id, recording_id, encounter_id, created_by, updated_by, title, content, note_type, status, scribe_page_id, tags, metadata, extraction_method, prompt_version, is_signed, signed_at, signed_by, version, created_at, updated_at
FROM notes
WHERE recording_id = $1
ORDER BY created_at DESC;

-- name: GetNotesByEncounter :many
SELECT id, patient_id, recording_id, encounter_id, created_by, updated_by, title, content, note_type, status, scribe_page_id, tags, metadata, extraction_method, prompt_version, is_signed, signed_at, signed_by, version, created_at, updated_at
FROM notes
WHERE encounter_id = $1
ORDER BY created_at DESC;

-- name: GetNotesByScribePage :many
SELECT id, patient_id, recording_id, encounter_id, created_by, updated_by, title, content, note_type, status, scribe_page_id, tags, metadata, extraction_method, prompt_version, is_signed, signed_at, signed_by, version, created_at, updated_at
FROM notes
WHERE scribe_page_id = $1
ORDER BY created_at DESC;

-- name: CreateNote :one
INSERT INTO notes (patient_id, recording_id, encounter_id, created_by, title, content, note_type, status, scribe_page_id, tags, metadata, extraction_method, prompt_version, version)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING id, patient_id, recording_id, encounter_id, created_by, updated_by, title, content, note_type, status, scribe_page_id, tags, metadata, extraction_method, prompt_version, is_signed, signed_at, signed_by, version, created_at, updated_at;

-- name: UpdateNote :exec
UPDATE notes
SET title = $1, content = $2, note_type = $3, status = $4, tags = $5, metadata = $6, updated_by = $7, updated_at = $8, version = version + 1
WHERE id = $9;

-- name: UpdateNoteStatus :exec
UPDATE notes
SET status = $1, updated_at = $2
WHERE id = $3;

-- name: UpdateNotePatient :exec
UPDATE notes
SET patient_id = $1, updated_at = $2
WHERE id = $3;

-- name: SignNote :exec
UPDATE notes
SET is_signed = TRUE, signed_at = $1, signed_by = $2, status = 'signed', updated_at = $3
WHERE id = $4;

-- name: DeleteNote :exec
DELETE FROM notes
WHERE id = $1;

-- name: GetNotesByStatus :many
SELECT id, patient_id, recording_id, encounter_id, created_by, updated_by, title, content, note_type, status, scribe_page_id, tags, metadata, extraction_method, prompt_version, is_signed, signed_at, signed_by, version, created_at, updated_at
FROM notes
WHERE patient_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: SearchNotes :many
SELECT id, patient_id, recording_id, encounter_id, created_by, updated_by, title, content, note_type, status, scribe_page_id, tags, metadata, extraction_method, prompt_version, is_signed, signed_at, signed_by, version, created_at, updated_at
FROM notes
WHERE patient_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountNotesByPatient :one
SELECT COUNT(*)
FROM notes
WHERE patient_id = $1;

-- ============================================
-- SCRIBE SESSIONS QUERIES
-- ============================================

-- name: CreateScribeSession :one
INSERT INTO scribe_sessions (session_id, user_id, patient_id, encounter_id, template_id, status, metadata, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING session_id, user_id, patient_id, encounter_id, template_id, status, version, metadata, created_at, updated_at, expires_at;

-- name: GetScribeSession :one
SELECT session_id, user_id, patient_id, encounter_id, template_id, status, version, metadata, created_at, updated_at, expires_at
FROM scribe_sessions
WHERE session_id = $1;

-- name: UpdateScribeSession :exec
UPDATE scribe_sessions
SET patient_id = $1, encounter_id = $2, status = $3, version = version + 1, updated_at = $4
WHERE session_id = $5 AND version = $6;

-- name: UpdateScribeSessionStatus :exec
UPDATE scribe_sessions
SET status = $1, updated_at = $2
WHERE session_id = $3;

-- name: GetScribeSessionsByUser :many
SELECT session_id, user_id, patient_id, encounter_id, template_id, status, version, metadata, created_at, updated_at, expires_at
FROM scribe_sessions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetExpiredSessions :many
SELECT session_id, user_id, patient_id, encounter_id, template_id, status, version, metadata, created_at, updated_at, expires_at
FROM scribe_sessions
WHERE expires_at < CURRENT_TIMESTAMP AND status != 'archived'
LIMIT $1;

-- name: DeleteScribeSession :exec
DELETE FROM scribe_sessions
WHERE session_id = $1;

-- name: BindPatientToSession :one
UPDATE scribe_sessions
SET patient_id = $1, encounter_id = $2, status = 'active', version = version + 1, updated_at = $3
WHERE session_id = $4 AND version = $5
RETURNING session_id, patient_id, encounter_id, status, version, updated_at;

-- name: GetSessionAuditLogs :many
SELECT id, session_id, user_id, action, resource_type, resource_id, old_value, new_value, metadata, created_at
FROM session_audit_logs
WHERE session_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateSessionAuditLog :exec
INSERT INTO session_audit_logs (session_id, user_id, action, resource_type, resource_id, old_value, new_value, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: GetSessionRecordings :many
SELECT id, encounter_id, user_id, patient_id, template_id, audio_file_url, audio_duration_seconds, status, transcription, analysis, processing_error, processing_time_ms, scribe_page_id, is_linked, linked_at, created_at, updated_at
FROM recordings
WHERE session_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetSessionNotes :many
SELECT id, patient_id, recording_id, encounter_id, created_by, updated_by, title, content, note_type, status, scribe_page_id, tags, metadata, is_signed, signed_at, signed_by, version, created_at, updated_at
FROM notes
WHERE scribe_page_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- ============================================
-- CHUNKED UPLOAD SESSIONS QUERIES
-- ============================================

-- name: CreateChunkedUploadSession :one
INSERT INTO chunked_upload_sessions (
    session_id, recording_id, user_id, template_id, encounter_id, patient_id, 
    scribe_session_id, status, total_chunks, chunks_received, expires_at, metadata
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING id, session_id, recording_id, user_id, template_id, encounter_id, patient_id, 
    scribe_session_id, status, total_chunks, chunks_received, chunk_storage_path, 
    metadata, created_at, expires_at, finalized_at, upload_start_time, upload_end_time, 
    upload_duration_ms, total_size_bytes;

-- name: GetChunkedUploadSession :one
SELECT id, session_id, recording_id, user_id, template_id, encounter_id, patient_id, 
    scribe_session_id, status, total_chunks, chunks_received, chunk_storage_path, 
    metadata, created_at, expires_at, finalized_at, upload_start_time, upload_end_time, 
    upload_duration_ms, total_size_bytes
FROM chunked_upload_sessions
WHERE session_id = $1;

-- name: GetChunkedUploadSessionByRecording :one
SELECT id, session_id, recording_id, user_id, template_id, encounter_id, patient_id, 
    scribe_session_id, status, total_chunks, chunks_received, chunk_storage_path, 
    metadata, created_at, expires_at, finalized_at, upload_start_time, upload_end_time, 
    upload_duration_ms, total_size_bytes
FROM chunked_upload_sessions
WHERE recording_id = $1;

-- name: UpdateChunkedUploadSessionChunks :exec
UPDATE chunked_upload_sessions
SET chunks_received = $1, total_size_bytes = $2, updated_at = CURRENT_TIMESTAMP
WHERE session_id = $3;

-- name: UpdateChunkedUploadSessionTotalChunks :exec
UPDATE chunked_upload_sessions
SET total_chunks = $1, updated_at = CURRENT_TIMESTAMP
WHERE session_id = $2;

-- name: FinalizeChunkedUploadSession :exec
UPDATE chunked_upload_sessions
SET status = 'finalized', finalized_at = CURRENT_TIMESTAMP, upload_end_time = CURRENT_TIMESTAMP, 
    upload_duration_ms = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - upload_start_time))::INTEGER, 
    updated_at = CURRENT_TIMESTAMP
WHERE session_id = $1;

-- name: UpdateChunkedUploadSessionStatus :exec
UPDATE chunked_upload_sessions
SET status = $1, updated_at = CURRENT_TIMESTAMP
WHERE session_id = $2;

-- name: UpdateChunkedUploadSessionPath :exec
UPDATE chunked_upload_sessions
SET chunk_storage_path = $1, updated_at = CURRENT_TIMESTAMP
WHERE session_id = $2;

-- name: GetExpiredChunkedUploadSessions :many
SELECT id, session_id, recording_id, user_id, template_id, encounter_id, patient_id, 
    scribe_session_id, status, total_chunks, chunks_received, chunk_storage_path, 
    metadata, created_at, expires_at, finalized_at, upload_start_time, upload_end_time, 
    upload_duration_ms, total_size_bytes
FROM chunked_upload_sessions
WHERE expires_at < CURRENT_TIMESTAMP AND status = 'active'
LIMIT $1;

-- name: DeleteChunkedUploadSession :exec
DELETE FROM chunked_upload_sessions
WHERE session_id = $1;

-- ============================================
-- CHUNKED UPLOAD CHUNKS QUERIES
-- ============================================

-- name: CreateChunkedUploadChunk :one
INSERT INTO chunked_upload_chunks (session_id, chunk_index, chunk_size_bytes, storage_path, checksum)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, session_id, chunk_index, chunk_size_bytes, storage_path, checksum, received_at, processed_at;

-- name: GetChunkedUploadChunk :one
SELECT id, session_id, chunk_index, chunk_size_bytes, storage_path, checksum, received_at, processed_at
FROM chunked_upload_chunks
WHERE session_id = $1 AND chunk_index = $2;

-- name: GetChunkedUploadChunksBySession :many
SELECT id, session_id, chunk_index, chunk_size_bytes, storage_path, checksum, received_at, processed_at
FROM chunked_upload_chunks
WHERE session_id = $1
ORDER BY chunk_index ASC;

-- name: GetMissingChunksBySession :many
SELECT chunk_index
FROM chunked_upload_chunks
WHERE session_id = $1
ORDER BY chunk_index ASC;

-- name: CountChunksBySession :one
SELECT COUNT(*) as chunk_count
FROM chunked_upload_chunks
WHERE session_id = $1;

-- name: DeleteChunkedUploadChunks :exec
DELETE FROM chunked_upload_chunks
WHERE session_id = $1;