package models

import (
	"time"
)

// ============================================
// TEMPLATE SECTION MODELS
// ============================================

type TemplateSection struct {
	ID          string      `json:"id"`
	Key         string      `json:"key"`
	Title       string      `json:"title"`
	Helper      string      `json:"helper,omitempty"`
	Order       int         `json:"order"`
	IsRequired  bool        `json:"is_required"`
	InputType   string      `json:"input_type"`
	Placeholder string      `json:"placeholder,omitempty"`
	Icon        string      `json:"icon,omitempty"`
	Metadata    interface{} `json:"metadata,omitempty"`
}

// TemplateMetadata stores template-specific metadata
type TemplateMetadata struct {
	EstimatedCompletionTime int      `json:"estimated_completion_time,omitempty"`
	ComplexityLevel         string   `json:"complexity_level,omitempty"`
	ClinicalSetting         []string `json:"clinical_setting,omitempty"`
	AgeGroups               []string `json:"age_groups,omitempty"`
	LanguagesSupported      []string `json:"languages_supported,omitempty"`
}

// TemplateWithSections represents a complete template with sections for frontend
type TemplateWithSections struct {
	ID          string            `json:"id"`
	TemplateKey string            `json:"template_key"`
	Label       string            `json:"label"`
	Description string            `json:"description,omitempty"`
	Specialty   string            `json:"specialty,omitempty"`
	Category    string            `json:"category,omitempty"`
	Icon        string            `json:"icon,omitempty"`
	Sections    []TemplateSection `json:"sections"`
	Metadata    TemplateMetadata  `json:"metadata,omitempty"`
	IsActive    bool              `json:"is_active"`
	Version     string            `json:"version,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// GetTemplatesResponse is the response for GET /api/templates
type GetTemplatesResponse struct {
	Status    string                 `json:"status"`
	Meta      PaginationMeta         `json:"meta"`
	Templates []TemplateWithSections `json:"templates"`
}

// PaginationMeta stores pagination and versioning information
type PaginationMeta struct {
	Total        int    `json:"total"`
	Limit        int    `json:"limit"`
	Offset       int    `json:"offset"`
	HasMore      bool   `json:"hasMore"`
	Version      string `json:"version"`
	CacheControl string `json:"cacheControl,omitempty"`
}

// ============================================
// TEMPLATE UUID MAPPING
// ============================================

// GetTemplateUUIDsResponse maps template keys to their UUIDs
type GetTemplateUUIDsResponse struct {
	Status  string            `json:"status"`
	Version string            `json:"version"`
	Data    map[string]string `json:"data"` // template_key -> UUID
}

// ============================================
// LANDING PAGE CONTENT MODELS
// ============================================

type PainPoint struct {
	ID          string `json:"id"`
	Order       int    `json:"order"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Stat        string `json:"stat"`
	Icon        string `json:"icon"`
	Enabled     bool   `json:"enabled"`
}

type ProcessStep struct {
	ID          string `json:"id"`
	Order       int    `json:"order"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	MediaAlt    string `json:"mediaAlt,omitempty"`
	Enabled     bool   `json:"enabled"`
}

type Feature struct {
	ID             string `json:"id"`
	Order          int    `json:"order"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	Icon           string `json:"icon"`
	Enabled        bool   `json:"enabled"`
	HighlightOrder *int   `json:"highlightOrder,omitempty"`
}

type Testimonial struct {
	ID           string `json:"id"`
	Order        int    `json:"order"`
	Quote        string `json:"quote"`
	Author       string `json:"author"`
	Role         string `json:"role"`
	Organization string `json:"organization"`
	ImageURL     string `json:"image_url,omitempty"`
	Rating       int    `json:"rating"`
	Enabled      bool   `json:"enabled"`
}

type CTASection struct {
	Heading      string   `json:"heading"`
	Subheading   string   `json:"subheading"`
	BulletPoints []string `json:"bullet_points"`
}

type LandingPageContent struct {
	PainPoints   []PainPoint   `json:"painPoints"`
	Steps        []ProcessStep `json:"steps"`
	Features     []Feature     `json:"features"`
	Testimonials []Testimonial `json:"testimonials"`
	CTA          CTASection    `json:"cta,omitempty"`
}

// GetLandingPageContentResponse is the response for GET /api/content/landing-page
type GetLandingPageContentResponse struct {
	Status   string             `json:"status"`
	Language string             `json:"language"`
	Region   string             `json:"region,omitempty"`
	Version  string             `json:"version"`
	Content  LandingPageContent `json:"content"`
}

// ============================================
// UI CONFIGURATION MODELS
// ============================================

type ConsoleTab struct {
	ID                  string   `json:"id"`
	Label               string   `json:"label"`
	Icon                string   `json:"icon"`
	Order               int      `json:"order"`
	Enabled             bool     `json:"enabled"`
	Permissions         []string `json:"permissions"`
	PermissionsRequired bool     `json:"permissions_required"`
	FeatureFlag         string   `json:"feature_flag,omitempty"`
	Beta                bool     `json:"beta"`
	Description         string   `json:"description,omitempty"`
}

// GetConsoleTabsResponse is the response for GET /api/scribe/workspace/tabs
type GetConsoleTabsResponse struct {
	Status string       `json:"status"`
	Tabs   []ConsoleTab `json:"tabs"`
}

// ============================================
// ERROR MESSAGE MODELS
// ============================================

type ErrorMessageData struct {
	Title       string `json:"title"`
	Message     string `json:"message"`
	UserMessage string `json:"user_message"`
	Icon        string `json:"icon,omitempty"`
	Action      string `json:"action,omitempty"`
}

// GetErrorMessagesResponse is the response for GET /api/localization/error-messages
type GetErrorMessagesResponse struct {
	Status   string                      `json:"status"`
	Language string                      `json:"language"`
	Region   string                      `json:"region,omitempty"`
	Version  string                      `json:"version"`
	Messages map[string]ErrorMessageData `json:"messages"`
}

// ============================================
// CACHE UTILITY STRUCTS
// ============================================

// CacheHeaders contains cache-related HTTP headers
type CacheHeaders struct {
	CacheControl string
	ETag         string
	LastModified string
}

// GetCacheHeaders generates appropriate cache headers for content
func GetCacheHeaders(contentType string, version string) CacheHeaders {
	headers := CacheHeaders{}

	switch contentType {
	case "templates":
		headers.CacheControl = "public, max-age=86400, s-maxage=604800"
		headers.ETag = "\"v2-" + version + "-templates\""
	case "template_uuids":
		headers.CacheControl = "public, max-age=604800"
		headers.ETag = "\"v2-uuid-map-" + version + "\""
	case "landing_page":
		headers.CacheControl = "public, max-age=86400"
		headers.ETag = "\"v2-lp-content-" + version + "\""
	case "error_messages":
		headers.CacheControl = "public, max-age=604800"
		headers.ETag = "\"v1-errors-" + version + "\""
	default:
		headers.CacheControl = "public, max-age=3600"
		headers.ETag = "\"v1-" + version + "\""
	}

	return headers
}
