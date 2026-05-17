/**
 * Scribe API Type Definitions
 * Matches the Scribe Page API specification
 */

// Status types
export type SessionStatus = 'initialized' | 'active' | 'paused' | 'completed' | 'archived';
export type EncounterType = 'office_visit' | 'telehealth' | 'emergency' | 'follow_up' | 'consultation';
export type EncounterStatus = 'active' | 'completed' | 'cancelled' | 'no_show';
export type TaskStatus = 'pending' | 'in-progress' | 'completed';
export type OrderStatus = 'draft' | 'ordered' | 'resulted';
export type DiagnosticStatus = 'pending' | 'available' | 'critical';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type TimelineCategory = 'encounter' | 'task' | 'order' | 'alert';

// Standard error response
export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, any>;
}

// Session endpoints
export interface CreateSessionRequest {
  templateId: string;
  session_id?: string;
  initial_patient_id?: string;
  metadata?: Record<string, any>;
}

export interface CreateSessionResponse {
  session_id: string;
  status: 'initialized';
  created_at: string;
  templateId: string;
}

export interface ListSessionsResponse {
  sessions: SessionSummary[];
  limit: number;
  offset: number;
}

export interface SessionSummary {
  session_id: string;
  status: SessionStatus;
  patient_id?: string;
  encounter_id?: string;
  templateId: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// Patient types
export interface PatientInfo {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  email: string;
  phone: string;
  mrn: string;
  primary_language?: string;
  allergies?: string[];
}

// Encounter types
export interface EncounterInfo {
  id: string;
  patient_id: string;
  encounter_type: EncounterType;
  status: EncounterStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// Template types
export interface TemplateInfo {
  id: string;
  template_key: string;
  label: string;
  specialty?: string;
}

// Vitals types
export interface Vitals {
  bloodPressure?: string;
  heartRate?: string;
  respiratoryRate?: string;
  oxygenSaturation?: string;
  temperature?: string;
  painScore?: string;
}

// Note section types
export interface NoteSections {
  [key: string]: string;
}

// Clinical data types
export interface ClinicalTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  due?: string;
  assigned_to?: string;
  created_at: string;
}

export interface CareOrder {
  id: string;
  order_type: string;
  description: string;
  status: OrderStatus;
  ordered_by?: string;
  created_at: string;
}

export interface DiagnosticResult {
  id: string;
  test_name: string;
  test_type: string;
  result_value?: string;
  result_unit?: string;
  reference_range?: string;
  status: DiagnosticStatus;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  label: string;
  timestamp?: string;
  description?: string;
  category: TimelineCategory;
}

export interface DecisionSupportAlert {
  id: string;
  title: string;
  severity: AlertSeverity;
  guidance?: string;
}

export interface FollowUpItem {
  id: string;
  title: string;
  owner?: string;
  due?: string;
}

export interface BillingSummary {
  suggestedCodes?: string[];
  documentationCompleteness?: number;
  missingElements?: string[];
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  timestamp?: string;
}

// Get session data response
export interface GetSessionDataResponse {
  session_id: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  expires_at: string;
  patient?: PatientInfo;
  encounter?: EncounterInfo;
  template?: TemplateInfo;
  vitals?: Vitals;
  noteSections?: NoteSections;
  tasks?: ClinicalTask[];
  orders?: CareOrder[];
  diagnostics?: DiagnosticResult[];
  timeline?: TimelineEvent[];
  decisionSupport?: DecisionSupportAlert[];
  followUps?: FollowUpItem[];
  billing?: BillingSummary;
  transcriptSegments?: TranscriptSegment[];
  metadata?: {
    created_at: string;
    created_by: string;
    last_activity: string;
  };
}

// Bind patient request/response
export interface BindPatientRequest {
  patient_id: string;
  encounter_id?: string;
}

export interface BindPatientResponse {
  session_id: string;
  patient_id: string;
  encounter_id?: string;
  status: 'linked';
  linked_at: string;
}

// Update note section request/response
export interface UpdateNoteSectionRequest {
  content: string;
  encounter_id?: string;
}

export interface UpdateNoteSectionResponse {
  session_id: string;
  section_key: string;
  content: string;
  encounter_id?: string;
  updated_by: string;
  updated_at: string;
}

// Note section keys (as defined in API spec)
export const NOTE_SECTION_KEYS = [
  'chief_complaint',
  'history_of_present_illness',
  'review_of_systems',
  'physical_exam',
  'assessment',
  'plan',
  'follow_up',
] as const;

export type NoteSectionKey = typeof NOTE_SECTION_KEYS[number];

// Validation helpers
export function isValidSessionStatus(status: any): status is SessionStatus {
  return ['initialized', 'active', 'paused', 'completed', 'archived'].includes(status);
}

export function isValidNoteSectionKey(key: any): key is NoteSectionKey {
  return NOTE_SECTION_KEYS.includes(key);
}

export function isValidAlertSeverity(severity: any): severity is AlertSeverity {
  return ['info', 'warning', 'critical'].includes(severity);
}
