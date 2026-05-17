package models

import (
	"time"
)

// ScribeWorkspace represents the complete data needed for the scribe interface
type ScribeWorkspace struct {
	Patient            PatientData            `json:"patient"`
	Encounter          EncounterData          `json:"encounter"`
	CurrentNote        *ClinicalNoteData      `json:"current_note,omitempty"`
	RecentRecordings   []Recording            `json:"recent_recordings,omitempty"`
	Tasks              []TaskData             `json:"tasks,omitempty"`
	Orders             []OrderData            `json:"orders,omitempty"`
	DiagnosticResults  []DiagnosticResultData `json:"diagnostic_results,omitempty"`
	AvailableTemplates []TemplateData         `json:"available_templates,omitempty"`
}

// PatientData contains patient information for the scribe workspace
type PatientData struct {
	ID                   string     `json:"id"`
	FirstName            string     `json:"first_name"`
	LastName             string     `json:"last_name"`
	DateOfBirth          *time.Time `json:"date_of_birth,omitempty"`
	Gender               *string    `json:"gender,omitempty"`
	Age                  *int       `json:"age,omitempty"`
	Phone                *string    `json:"phone,omitempty"`
	Email                *string    `json:"email,omitempty"`
	MedicalRecordNumber  *string    `json:"medical_record_number,omitempty"`
	Vitals               *Vitals    `json:"vitals,omitempty"`
	AllergiesString      *string    `json:"allergies,omitempty"`
	MedicationsString    *string    `json:"medications,omitempty"`
	MedicalHistoryString *string    `json:"medical_history,omitempty"`
}

// Vitals represents patient vital signs
type Vitals struct {
	BloodPressureSystolic  *int      `json:"blood_pressure_systolic,omitempty"`
	BloodPressureDiastolic *int      `json:"blood_pressure_diastolic,omitempty"`
	HeartRate              *int      `json:"heart_rate,omitempty"`
	RespiratoryRate        *int      `json:"respiratory_rate,omitempty"`
	Temperature            *float64  `json:"temperature,omitempty"`
	OxygenSaturation       *float64  `json:"oxygen_saturation,omitempty"`
	Weight                 *float64  `json:"weight,omitempty"`
	Height                 *float64  `json:"height,omitempty"`
	BMI                    *float64  `json:"bmi,omitempty"`
	MeasuredAt             time.Time `json:"measured_at"`
}

// EncounterData contains encounter information
type EncounterData struct {
	ID            string     `json:"id"`
	EncounterType *string    `json:"encounter_type,omitempty"`
	Status        string     `json:"status"`
	Notes         *string    `json:"notes,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
}

// ClinicalNoteData contains clinical note information for the scribe
type ClinicalNoteData struct {
	ID           string            `json:"id"`
	TemplateID   string            `json:"template_id"`
	TemplateName string            `json:"template_name"`
	Status       string            `json:"status"`
	NoteSections map[string]string `json:"note_sections"`
	SignedAt     *time.Time        `json:"signed_at,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// TaskData represents a task
type TaskData struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description *string    `json:"description,omitempty"`
	Status      string     `json:"status"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	AssignedTo  *string    `json:"assigned_to,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// OrderData represents an order
type OrderData struct {
	ID          string    `json:"id"`
	OrderType   string    `json:"order_type"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	OrderedBy   string    `json:"ordered_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// DiagnosticResultData represents a diagnostic result
type DiagnosticResultData struct {
	ID             string    `json:"id"`
	TestName       string    `json:"test_name"`
	TestType       *string   `json:"test_type,omitempty"`
	ResultValue    *string   `json:"result_value,omitempty"`
	ResultUnit     *string   `json:"result_unit,omitempty"`
	ReferenceRange *string   `json:"reference_range,omitempty"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

// TemplateData represents template information
type TemplateData struct {
	ID          string        `json:"id"`
	TemplateKey string        `json:"template_key"`
	Label       string        `json:"label"`
	Description *string       `json:"description,omitempty"`
	Specialty   *string       `json:"specialty,omitempty"`
	Category    *string       `json:"category,omitempty"`
	Sections    []SectionInfo `json:"sections"`
}

// SectionInfo represents information about a template section
type SectionInfo struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Required bool   `json:"required"`
}

// GetScribeWorkspaceRequest represents the query parameters for getting workspace data
type GetScribeWorkspaceRequest struct {
	PatientID   string `form:"patientId"`
	EncounterID string `form:"encounterId"`
}
