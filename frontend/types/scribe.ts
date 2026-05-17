/**
 * Type definitions for the Scribe feature
 */

export type PatientOverview = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  mrn: string;
  email?: string;
  phone?: string;
  primary_language?: string;
  allergies?: string[];
  careTeam?: string[];
};

export type Vitals = {
  bloodPressure?: string;
  heartRate?: string;
  respiratoryRate?: string;
  oxygenSaturation?: string;
  temperature?: string;
  painScore?: string;
};

export type ScribeNoteSections = {
  [key: string]: string; // Template-agnostic: maps section keys to content
};

export type TemplateSection = {
  key: string;
  title: string;
  helper: string;
};

export type ClinicalTask = {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed";
  due?: string;
};

export type CareOrder = {
  id: string;
  order_type?: string;
  name?: string;
  description?: string;
  category?: string;
  status: "draft" | "ordered" | "resulted";
  ordered_by?: string;
  created_at?: string;
};

export type DiagnosticResult = {
  id: string;
  test?: string;
  test_name?: string;
  test_type?: string;
  result_value?: string;
  result_unit?: string;
  reference_range?: string;
  status: "pending" | "available" | "critical";
  collectedAt?: string;
  created_at?: string;
};

export type TimelineEvent = {
  id: string;
  label: string;
  timestamp?: string;
  description?: string;
  category: "encounter" | "task" | "order" | "alert";
};

export type DecisionSupportAlert = {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  guidance?: string;
};

export type FollowUpItem = {
  id: string;
  title: string;
  owner?: string;
  due?: string;
};

export type TranscriptSegment = {
  id: string;
  speaker: string;
  text: string;
  timestamp?: string;
};

export type BillingSummary = {
  suggestedCodes?: string[];
  documentationCompleteness?: number;
  missingElements?: string[];
};

export type ScribeWorkspaceData = {
  patient?: PatientOverview;
  vitals?: Vitals;
  noteSections?: ScribeNoteSections;
  tasks?: ClinicalTask[];
  orders?: CareOrder[];
  diagnostics?: DiagnosticResult[];
  timeline?: TimelineEvent[];
  decisionSupport?: DecisionSupportAlert[];
  followUps?: FollowUpItem[];
  billing?: BillingSummary;
  transcriptSegments?: TranscriptSegment[];
};

export type NoteTabId = "soap" | "transcript" | "context";
export type ConsoleTabId = "patient" | "tasks" | "billing" | "alerts";
export type AllTabId = NoteTabId | ConsoleTabId;
export type NoteSectionKey = string; // Template-agnostic: any section key from current template

export const noteTabs: Array<{ id: NoteTabId; label: string }> = [
  { id: "soap", label: "Note" },
  { id: "transcript", label: "Transcript" },
  { id: "context", label: "Context" },
];

export const consoleTabs: Array<{ id: ConsoleTabId; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "billing", label: "Billing" },
  { id: "alerts", label: "Alerts" },
];
