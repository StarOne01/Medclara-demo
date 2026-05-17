-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'doctor', -- doctor, nurse, admin, clinician
    organization_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization_id ON users(organization_id);

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PATIENTS TABLE
-- ============================================
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT, -- M, F, Other
    email TEXT,
    phone TEXT,
    medical_record_number TEXT UNIQUE,
    organization_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patients_organization_id ON patients(organization_id);
CREATE INDEX idx_patients_medical_record_number ON patients(medical_record_number);

-- ============================================
-- ENCOUNTERS TABLE
-- ============================================
CREATE TABLE encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    user_id UUID NOT NULL REFERENCES users(id),
    encounter_type TEXT, -- office-visit, consultation, hospital-admission, etc.
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, cancelled
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_encounters_patient_id ON encounters(patient_id);
CREATE INDEX idx_encounters_user_id ON encounters(user_id);
CREATE INDEX idx_encounters_created_at ON encounters(created_at DESC);

-- ============================================
-- TEMPLATES TABLE - PROMPT-BASED EXTRACTION
-- ============================================
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE, -- e.g., "soap-general", "cardiology-note"
    label TEXT NOT NULL,
    description TEXT,
    specialty TEXT, -- e.g., "cardiology", "psychiatry"
    category TEXT, -- "General Medicine", "Specialty", "Procedure", etc.
    prompt TEXT NOT NULL, -- AI extraction prompt
    extract_style TEXT DEFAULT 'narrative', -- narrative, structured, hybrid
    prompt_version INTEGER DEFAULT 1,
    prompt_last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB, -- Additional template info
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_template_key ON templates(template_key);
CREATE INDEX idx_templates_specialty ON templates(specialty);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_extract_style ON templates(extract_style);
CREATE INDEX idx_templates_prompt_modified ON templates(prompt_last_modified DESC);

-- Insert prompt-based clinical note templates
INSERT INTO templates (template_key, label, description, specialty, category, prompt, extract_style, is_active) VALUES
-- General Medicine & Primary Care
('soap-general', 'SOAP Note (General)', 'Standard SOAP note for general medicine', 'General Medicine', 'General Medicine & Primary Care', 'Extract a comprehensive SOAP note from the medical encounter. Provide: Chief Complaint, History of Present Illness, Review of Systems, Past Medical History, Medications, Allergies, Physical Examination, Assessment, and Plan. Return as free-form narrative text organized by section.', 'structured', TRUE),
('office-visit', 'Office Visit Note', 'Routine office visit documentation', 'General Medicine', 'General Medicine & Primary Care', 'Extract a routine office visit note. Document: Chief Complaint, Vital Signs, History of present illness, Physical Examination findings, Assessment/Clinical Impression, and Treatment/Management plan. Include any follow-up needed.', 'structured', TRUE),
('acute-illness', 'Acute Illness Note', 'Documentation for acute health issues', 'General Medicine', 'General Medicine & Primary Care', 'Extract documentation for acute health issues. Include: Chief Complaint, Onset and progression of symptoms, Associated symptoms, Physical Examination findings, Differential diagnosis considerations, Diagnostic tests ordered, Initial treatment provided, and Follow-up plan.', 'narrative', TRUE),
('consultation-note', 'Consultation Note', 'Specialist consultation documentation', 'Various', 'Specialized Consultations', 'Extract a specialist consultation note. Document: Reason for consultation/referral, Relevant history of present illness, Relevant past medical/surgical history, Physical and clinical examination findings, Clinical impression and diagnosis, and Recommendations for management.', 'hybrid', TRUE),

-- Specialty-Specific: Cardiology
('cardiology-note', 'Cardiology Consultation', 'Cardiac specialty consultation', 'Cardiology', 'Specialty-Specific', 'Extract a comprehensive cardiology note. Include: Chief Complaint, Cardiac history and symptoms, Cardiovascular risk factors, Current cardiac medications, Vital signs and physical examination, ECG findings, Echocardiogram results, Imaging findings, Assessment and diagnosis, and Treatment recommendations.', 'structured', TRUE),

-- Specialty-Specific: Dermatology
('dermatology-note', 'Dermatology Visit', 'Dermatology consultation', 'Dermatology', 'Specialty-Specific', 'Extract a dermatology visit note. Document: Chief Complaint and skin concerns, Lesion description (size, color, borders), Location on body, Onset and progression, Associated symptoms, Skin type and examination findings, Any culture or test results, Differential diagnosis, Treatment plan, and Follow-up instructions.', 'structured', TRUE),

-- Specialty-Specific: Psychiatry
('mental-health-intake', 'Mental Health Intake', 'Initial psychiatric assessment', 'Psychiatry', 'Mental Health & Behavioral', 'Extract a comprehensive mental health intake assessment. Include: Chief Complaint, Psychiatric history, Substance use history, Trauma history, Family psychiatric history, Current medical history, Current medications, Allergies, Mental status examination findings, Preliminary diagnosis, Safety assessment, Treatment recommendations, and Prognosis.', 'structured', TRUE),

-- Specialty-Specific: Orthopedics
('orthopedic-note', 'Orthopedic Consultation', 'Orthopedic specialty consultation', 'Orthopedics', 'Specialty-Specific', 'Extract an orthopedic consultation note. Document: Chief Complaint, Injury mechanism and date, Pain location and severity, Functional limitations, Physical examination findings, Range of motion assessment, Special orthopedic tests, Imaging findings, Working diagnosis, Treatment recommendations, and Prognosis.', 'structured', TRUE),

-- Specialty-Specific: Pulmonology
('pulmonology-note', 'Pulmonology Consultation', 'Pulmonology specialty consultation', 'Pulmonology', 'Specialty-Specific', 'Extract a pulmonology note. Include: Chief Complaint, Respiratory history and symptoms, Dyspnea assessment, Smoking history and exposure history, Current medications, Physical examination findings, Spirometry results, Imaging findings, Assessment and diagnosis, and Treatment plan with follow-up.', 'structured', TRUE),

-- Procedures
('procedure-note', 'Procedure Note', 'General procedure documentation', 'Various', 'Procedure Notes', 'Extract procedure documentation. Document: Procedure name and date/time, Indication for procedure, Informed consent status, Description of procedure performed, Findings and results, Any specimens obtained, Complications or adverse events, Medications used, Post-procedure instructions, and Follow-up needed.', 'hybrid', TRUE),
('injection-note', 'Injection Note', 'Injection administration documentation', 'Various', 'Procedure Notes', 'Extract injection documentation. Include: Type of injection, Site/location of injection, Route of administration, Dose and substance used, Indication for injection, Technique used, Patient response, Post-injection instructions, Any complications, and Follow-up recommendations.', 'narrative', TRUE),

-- Administrative
('discharge-summary', 'Discharge Summary', 'Hospital discharge documentation', 'Hospital', 'Administrative', 'Extract hospital discharge summary. Document: Admission and discharge dates, Admission and discharge diagnoses, Hospital course summary, Procedures performed, Discharge medications, Allergies, Follow-up appointments scheduled, Activity and diet restrictions, Wound care instructions if applicable, and Warning signs to monitor.', 'structured', TRUE),
('pediatric-visit', 'Pediatric Visit', 'Pediatric specialty visit', 'Pediatrics', 'Specialty-Specific', 'Extract a pediatric visit note. Document: Chief Complaint, Child age and developmental status, Immunization status, Developmental and growth assessment, Behavioral assessment, Current medications, Allergies, Physical examination findings, Assessment and diagnosis, Treatment plan, and Follow-up.', 'structured', TRUE);

-- ============================================
-- CLINICAL NOTES TABLE - PROMPT-BASED EXTRACTION
-- ============================================
CREATE TABLE clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    template_id UUID NOT NULL REFERENCES templates(id),
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL, -- Raw note content from AI extraction
    extracted_data JSONB, -- Structured extraction if available
    status TEXT NOT NULL DEFAULT 'draft', -- draft, completed, signed
    extraction_method TEXT DEFAULT 'ai', -- ai, manual, hybrid
    signed_at TIMESTAMP WITH TIME ZONE,
    signed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clinical_notes_encounter_id ON clinical_notes(encounter_id);
CREATE INDEX idx_clinical_notes_user_id ON clinical_notes(user_id);
CREATE INDEX idx_clinical_notes_template_id ON clinical_notes(template_id);

-- ============================================
-- RECORDINGS TABLE - WITH PROMPT TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES encounters(id),
    user_id UUID NOT NULL REFERENCES users(id),
    patient_id UUID, -- NOW NULLABLE for scribe sessions without initial patient selection
    template_id UUID NOT NULL REFERENCES templates(id),
    audio_file_url TEXT,
    audio_duration_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'processing', -- processing, completed, failed
    transcription TEXT,
    analysis JSONB, -- Contains analysis result
    raw_extraction JSONB, -- Raw response from Vertex AI using prompt
    extraction_prompt_used TEXT, -- Track which prompt was used
    processing_error TEXT,
    processing_time_ms INTEGER,
    scribe_page_id TEXT, -- Reference to scribe page/session ID for patient-optional workflows
    is_linked BOOLEAN DEFAULT FALSE, -- Whether this recording has been linked to a patient
    linked_at TIMESTAMP WITH TIME ZONE, -- When the recording was linked to a patient
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Foreign key constraint is implicit but patient_id can be NULL
    CONSTRAINT fk_recordings_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

-- Make sure we have the nullable foreign key reference
ALTER TABLE recordings 
DROP CONSTRAINT IF EXISTS "recordings_patient_id_fkey",
ADD CONSTRAINT recordings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

CREATE INDEX idx_recordings_encounter_id ON recordings(encounter_id);
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_patient_id ON recordings(patient_id);
CREATE INDEX idx_recordings_template_id ON recordings(template_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX idx_recordings_scribe_page_id ON recordings(scribe_page_id);
CREATE INDEX idx_recordings_unlinked_created ON recordings(is_linked, created_at) WHERE is_linked = FALSE;
CREATE INDEX idx_recordings_user_scribe ON recordings(user_id, scribe_page_id);

-- ============================================
-- TRANSCRIPT SEGMENTS TABLE
-- ============================================
CREATE TABLE transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES recordings(id),
    speaker TEXT, -- Doctor, Patient, Nurse, etc.
    text TEXT NOT NULL,
    start_time_seconds NUMERIC,
    end_time_seconds NUMERIC,
    confidence NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transcript_segments_recording_id ON transcript_segments(recording_id);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, completed, cancelled
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_encounter_id ON tasks(encounter_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    order_type TEXT NOT NULL, -- medication, procedure, imaging, lab, referral
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    ordered_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_encounter_id ON orders(encounter_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ============================================
-- DIAGNOSTIC RESULTS TABLE
-- ============================================
CREATE TABLE diagnostic_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    test_name TEXT NOT NULL,
    test_type TEXT, -- lab, imaging, other
    result_value TEXT,
    result_unit TEXT,
    reference_range TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, reviewed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diagnostic_results_encounter_id ON diagnostic_results(encounter_id);

-- ============================================
-- NOTES TABLE - WITH EXTRACTION METHOD TRACKING
-- ============================================
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    recording_id UUID REFERENCES recordings(id),
    encounter_id UUID REFERENCES encounters(id),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'scribe', -- scribe, clinical, followup, general
    status TEXT NOT NULL DEFAULT 'draft', -- draft, completed, signed, archived
    scribe_page_id TEXT, -- Reference to scribe page/session that created this note
    tags JSONB, -- Array of tags for organization
    metadata JSONB, -- Additional metadata (e.g., AI confidence scores, summary)
    extraction_method TEXT DEFAULT 'ai', -- ai, manual, hybrid
    prompt_version TEXT, -- Track prompt version used for extraction
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMP WITH TIME ZONE,
    signed_by UUID REFERENCES users(id),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notes_patient_id ON notes(patient_id);
CREATE INDEX idx_notes_recording_id ON notes(recording_id);
CREATE INDEX idx_notes_encounter_id ON notes(encounter_id);
CREATE INDEX idx_notes_created_by ON notes(created_by);
CREATE INDEX idx_notes_status ON notes(status);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_scribe_page_id ON notes(scribe_page_id);
CREATE INDEX idx_notes_patient_created_at ON notes(patient_id, created_at DESC);

-- Add foreign keys to link users with organizations
ALTER TABLE users ADD CONSTRAINT fk_users_organization_id 
FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add foreign keys to link patients with organizations
ALTER TABLE patients ADD CONSTRAINT fk_patients_organization_id 
FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- ============================================
-- SCRIBE SESSIONS TABLE
-- ============================================
CREATE TABLE scribe_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
    template_id UUID NOT NULL REFERENCES templates(id),
    status TEXT NOT NULL DEFAULT 'initialized', -- initialized, active, paused, completed, archived
    version INTEGER NOT NULL DEFAULT 1, -- For optimistic locking
    metadata JSONB, -- Stores client metadata (user_agent, client_version, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_scribe_sessions_user_created ON scribe_sessions(user_id, created_at DESC);
CREATE INDEX idx_scribe_sessions_expires_at ON scribe_sessions(expires_at) WHERE status != 'archived';
CREATE INDEX idx_scribe_sessions_patient_id ON scribe_sessions(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_scribe_sessions_encounter_id ON scribe_sessions(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX idx_scribe_sessions_status ON scribe_sessions(status) WHERE status != 'archived';

-- ============================================
-- SESSION AUDIT LOGS TABLE
-- ============================================
CREATE TABLE session_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL REFERENCES scribe_sessions(session_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action TEXT NOT NULL, -- create, update_note_section, bind_patient, status_change, link_recording
    resource_type TEXT, -- session, note_section, patient_binding, recording
    resource_id VARCHAR(255), -- session_id, section_key, patient_id, recording_id
    old_value JSONB, -- Previous value for updates
    new_value JSONB, -- New value for updates
    metadata JSONB, -- Additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_audit_logs_session_id ON session_audit_logs(session_id, created_at DESC);
CREATE INDEX idx_session_audit_logs_user_id ON session_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_session_audit_logs_action ON session_audit_logs(action);

-- ============================================
-- UPDATE RECORDINGS TABLE FOR SESSION LINKAGE
-- ============================================
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS session_id VARCHAR(255) REFERENCES scribe_sessions(session_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recordings_session_created ON recordings(session_id, created_at DESC) WHERE session_id IS NOT NULL;

-- ============================================
-- UPDATE NOTES TABLE INDEXES FOR SESSION QUERIES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notes_session_created ON notes(scribe_page_id, created_at DESC) WHERE scribe_page_id IS NOT NULL;

-- ============================================
-- CHUNKED UPLOAD SESSIONS TABLE
-- ============================================
-- Stores metadata for chunked audio uploads
-- Enables progressive transcription and network resilience

CREATE TABLE IF NOT EXISTS chunked_upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES templates(id),
    encounter_id UUID REFERENCES encounters(id),
    patient_id UUID REFERENCES patients(id),
    scribe_session_id TEXT, -- Reference to scribe session
    
    status VARCHAR(50) DEFAULT 'active', -- active, finalized, expired, failed
    total_chunks INTEGER DEFAULT 0,
    chunks_received INTEGER DEFAULT 0,
    
    -- Storage location
    chunk_storage_path TEXT, -- Path to temp directory for chunks
    
    -- Metadata
    metadata JSONB, -- Additional session metadata
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    upload_start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    upload_end_time TIMESTAMP WITH TIME ZONE,
    
    -- Tracking
    upload_duration_ms INTEGER,
    total_size_bytes BIGINT DEFAULT 0,
    
    CONSTRAINT chunks_not_negative CHECK (chunks_received >= 0),
    CONSTRAINT total_chunks_not_negative CHECK (total_chunks >= 0),
    CONSTRAINT chunks_within_total CHECK (chunks_received <= total_chunks)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chunked_sessions_session_id ON chunked_upload_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chunked_sessions_recording_id ON chunked_upload_sessions(recording_id);
CREATE INDEX IF NOT EXISTS idx_chunked_sessions_user_id ON chunked_upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chunked_sessions_created_at ON chunked_upload_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunked_sessions_expires_at ON chunked_upload_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_chunked_sessions_status ON chunked_upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chunked_sessions_active ON chunked_upload_sessions(status, expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_chunked_sessions_updated_at ON chunked_upload_sessions(updated_at DESC);

-- ============================================
-- CHUNKED UPLOAD SESSIONS CHUNKS TABLE
-- ============================================
-- Individual chunk tracking for robust uploads

CREATE TABLE IF NOT EXISTS chunked_upload_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chunked_upload_sessions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_size_bytes INTEGER NOT NULL,
    
    -- Storage
    storage_path TEXT, -- Path to chunk file
    
    -- Integrity
    checksum VARCHAR(255), -- MD5/SHA256 hash for verification
    
    -- Timing
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT chunk_index_not_negative CHECK (chunk_index >= 0),
    CONSTRAINT chunk_size_positive CHECK (chunk_size_bytes > 0),
    UNIQUE(session_id, chunk_index)
);

-- Indexes for efficient chunk retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_session_id ON chunked_upload_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON chunked_upload_chunks(session_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_chunks_received_at ON chunked_upload_chunks(received_at DESC);

-- ============================================
-- UPDATE RECORDINGS TABLE WITH UPLOAD TRACKING COLUMNS
-- ============================================
-- Add columns to track chunked upload metadata

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS upload_session_id UUID REFERENCES chunked_upload_sessions(id);
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS upload_method VARCHAR(50) DEFAULT 'standard'; -- standard, chunked
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS upload_duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_recordings_upload_session_id ON recordings(upload_session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_upload_method ON recordings(upload_method);

-- Make patient_id nullable in notes table to support notes created during recording processing
ALTER TABLE notes ALTER COLUMN patient_id DROP NOT NULL;