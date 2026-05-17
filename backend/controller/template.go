package controller

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

// TemplateResponseRow is a helper to normalize different template row types
type TemplateResponseRow struct {
	ID                 uuid.UUID
	TemplateKey        string
	Label              string
	Description        sql.NullString
	Specialty          sql.NullString
	Category           sql.NullString
	Prompt             string
	ExtractStyle       string
	PromptVersion      int
	PromptLastModified sql.NullTime
	Metadata           interface{}
	IsActive           sql.NullBool
	CreatedAt          sql.NullTime
	UpdatedAt          sql.NullTime
}

// GetTemplateCategoriesHandler retrieves all template categories with counts
// GET /api/templates/categories
func GetTemplateCategoriesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Get all templates to group by category
		rows, err := queries.GetAllTemplates(ctx)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve templates",
			})
			return
		}

		// Group by category
		categoryMap := make(map[string]int)
		for _, row := range rows {
			if row.IsActive.Valid && row.IsActive.Bool {
				category := row.Category.String
				if category != "" {
					categoryMap[category]++
				}
			}
		}

		// Convert to response format
		type CategoryInfo struct {
			Name  string `json:"name"`
			Count int    `json:"count"`
		}

		categories := make([]CategoryInfo, 0)
		totalCount := 0
		for category, count := range categoryMap {
			categories = append(categories, CategoryInfo{
				Name:  category,
				Count: count,
			})
			totalCount += count
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"categories":       categories,
				"total_categories": len(categories),
				"total_templates":  totalCount,
			},
		})
	}
}

// GetTemplateByKeyHandler retrieves a template by its template_key
// GET /api/templates/key/{templateKey}
func GetTemplateByKeyHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		templateKey := c.Param("templateKey")
		if templateKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Template key is required",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		template, err := queries.GetTemplateByKey(ctx, templateKey)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Template not found: " + templateKey,
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve template",
			})
			return
		}

		response := gin.H{
			"id":            template.ID.String(),
			"name":          template.TemplateKey,
			"template_key":  template.TemplateKey,
			"label":         template.Label,
			"description":   template.Description.String,
			"prompt":        template.Prompt,
			"extract_style": template.ExtractStyle,
			"specialty":     template.Specialty.String,
			"category":      template.Category.String,
			"is_active":     template.IsActive.Bool,
			"created_at":    template.CreatedAt,
			"updated_at":    template.UpdatedAt,
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    response,
		})
	}
}

// GetTemplatesBySpecialtyHandler retrieves all templates for a specific specialty
// GET /api/templates/specialty/{specialty}
func GetTemplatesBySpecialtyHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		specialty := c.Param("specialty")
		if specialty == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Specialty is required",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		rows, err := queries.GetTemplatesBySpecialty(ctx, sql.NullString{String: specialty, Valid: true})
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve templates",
			})
			return
		}

		var templates []gin.H
		for _, row := range rows {
			template := gin.H{
				"id":            row.ID.String(),
				"name":          row.TemplateKey,
				"template_key":  row.TemplateKey,
				"label":         row.Label,
				"description":   row.Description.String,
				"prompt":        row.Prompt,
				"extract_style": row.ExtractStyle,
				"specialty":     row.Specialty.String,
				"category":      row.Category.String,
				"is_active":     row.IsActive.Bool,
			}
			templates = append(templates, template)
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"specialty": specialty,
				"templates": templates,
				"count":     len(templates),
			},
		})
	}
}

// SearchTemplatesHandler searches templates by label, description, or specialty
// GET /api/templates/search?q={query}
func SearchTemplatesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.DefaultQuery("q", "")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Search query is required",
			})
			return
		}

		queryDB := db.New(dbConn)
		ctx := c.Request.Context()

		// Get all templates and do client-side search
		rows, err := queryDB.GetAllTemplates(ctx)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve templates",
			})
			return
		}

		var results []gin.H
		for _, row := range rows {
			label := row.Label
			desc := row.Description.String
			specialty := row.Specialty.String

			// Simple substring search (case-insensitive)
			isMatch := false
			if matchSubstring(label, query) || matchSubstring(desc, query) || matchSubstring(specialty, query) {
				isMatch = true
			}

			if isMatch && row.IsActive.Bool {
				result := gin.H{
					"id":           row.ID.String(),
					"name":         row.TemplateKey,
					"template_key": row.TemplateKey,
					"label":        row.Label,
					"description":  row.Description.String,
					"specialty":    row.Specialty.String,
					"category":     row.Category.String,
				}
				results = append(results, result)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"query":   query,
				"results": results,
				"count":   len(results),
			},
		})
	}
}

// Helper function for case-insensitive substring matching
func matchSubstring(text, query string) bool {
	return strings.Contains(strings.ToLower(text), strings.ToLower(query))
}

// GetTemplatesHandler retrieves all available note templates
// GET /api/templates?specialty={specialty}&category={category}
func GetTemplatesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		specialty := c.DefaultQuery("specialty", "")
		category := c.DefaultQuery("category", "")

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		var templateRows []TemplateResponseRow

		if specialty != "" {
			// Filter by specialty
			rows, err := queries.GetTemplatesBySpecialty(ctx, sql.NullString{String: specialty, Valid: true})
			if err != nil && err != sql.ErrNoRows {
				log.Printf("Database error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "database_error",
					"message": "Failed to retrieve templates",
				})
				return
			}
			for _, row := range rows {
				templateRows = append(templateRows, TemplateResponseRow{
					ID:                 row.ID,
					TemplateKey:        row.TemplateKey,
					Label:              row.Label,
					Description:        row.Description,
					Specialty:          row.Specialty,
					Category:           row.Category,
					Prompt:             row.Prompt,
					ExtractStyle:       row.ExtractStyle.String,
					PromptVersion:      int(row.PromptVersion.Int32),
					PromptLastModified: row.PromptLastModified,
					Metadata:           row.Metadata,
					IsActive:           row.IsActive,
					CreatedAt:          row.CreatedAt,
					UpdatedAt:          row.UpdatedAt,
				})
			}
		} else if category != "" {
			// Filter by category
			rows, err := queries.GetTemplatesByCategory(ctx, sql.NullString{String: category, Valid: true})
			if err != nil && err != sql.ErrNoRows {
				log.Printf("Database error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "database_error",
					"message": "Failed to retrieve templates",
				})
				return
			}
			for _, row := range rows {
				templateRows = append(templateRows, TemplateResponseRow{
					ID:                 row.ID,
					TemplateKey:        row.TemplateKey,
					Label:              row.Label,
					Description:        row.Description,
					Specialty:          row.Specialty,
					Category:           row.Category,
					Prompt:             row.Prompt,
					ExtractStyle:       row.ExtractStyle.String,
					PromptVersion:      int(row.PromptVersion.Int32),
					PromptLastModified: row.PromptLastModified,
					Metadata:           row.Metadata,
					IsActive:           row.IsActive,
					CreatedAt:          row.CreatedAt,
					UpdatedAt:          row.UpdatedAt,
				})
			}
		} else {
			// Get all templates
			rows, err := queries.GetAllTemplates(ctx)
			if err != nil && err != sql.ErrNoRows {
				log.Printf("Database error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "database_error",
					"message": "Failed to retrieve templates",
				})
				return
			}
			for _, row := range rows {
				templateRows = append(templateRows, TemplateResponseRow{
					ID:                 row.ID,
					TemplateKey:        row.TemplateKey,
					Label:              row.Label,
					Description:        row.Description,
					Specialty:          row.Specialty,
					Category:           row.Category,
					Prompt:             row.Prompt,
					ExtractStyle:       row.ExtractStyle.String,
					PromptVersion:      int(row.PromptVersion.Int32),
					PromptLastModified: row.PromptLastModified,
					Metadata:           row.Metadata,
					IsActive:           row.IsActive,
					CreatedAt:          row.CreatedAt,
					UpdatedAt:          row.UpdatedAt,
				})
			}
		}

		// Convert to response model
		var response []gin.H
		for _, template := range templateRows {
			resp := gin.H{
				"id":             template.ID.String(),
				"name":           template.TemplateKey,
				"template_key":   template.TemplateKey,
				"label":          template.Label,
				"description":    template.Description.String,
				"extract_style":  template.ExtractStyle,
				"prompt_version": template.PromptVersion,
				"specialty":      template.Specialty.String,
				"category":       template.Category.String,
				"is_active":      template.IsActive.Bool,
				"created_at":     template.CreatedAt,
				"updated_at":     template.UpdatedAt,
			}
			response = append(response, resp)
		}

		c.JSON(http.StatusOK, gin.H{
			"templates": response,
		})
	}
}

// GetTemplateByIDHandler retrieves a specific template
// GET /api/templates/{templateId}
func GetTemplateByIDHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		templateIDStr := c.Param("templateId")
		if templateIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Template ID is required",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Resolve template ID - accept both UUID and template key string formats
		resolver := NewTemplateIDResolver(dbConn)
		templateID, err := resolver.ResolveTemplateID(ctx, templateIDStr)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Template not found: " + templateIDStr,
				})
				return
			}
			log.Printf("Database error resolving template ID: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to resolve template",
			})
			return
		}

		template, err := queries.GetTemplateByID(ctx, templateID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Template not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve template",
			})
			return
		}

		response := gin.H{
			"id":             template.ID.String(),
			"name":           template.TemplateKey,
			"template_key":   template.TemplateKey,
			"label":          template.Label,
			"description":    template.Description.String,
			"prompt":         template.Prompt,
			"extract_style":  template.ExtractStyle.String,
			"prompt_version": template.PromptVersion.Int32,
			"specialty":      template.Specialty.String,
			"category":       template.Category.String,
			"is_active":      template.IsActive.Bool,
			"created_at":     template.CreatedAt,
			"updated_at":     template.UpdatedAt,
		}

		c.JSON(http.StatusOK, response)
	}
}

// CreateTemplateRequest represents the request body for creating a template
type CreateTemplateRequest struct {
	TemplateKey  string                 `json:"template_key" binding:"required"`
	Label        string                 `json:"label" binding:"required"`
	Description  string                 `json:"description"`
	Specialty    string                 `json:"specialty"`
	Category     string                 `json:"category"`
	Prompt       string                 `json:"prompt" binding:"required"` // AI extraction prompt
	ExtractStyle string                 `json:"extract_style"`             // narrative, structured, hybrid
	Metadata     map[string]interface{} `json:"metadata"`
	IsActive     bool                   `json:"is_active"`
}

// UpdateTemplateRequest represents the request body for updating a template
type UpdateTemplateRequest struct {
	Label        string                 `json:"label" binding:"required"`
	Description  string                 `json:"description"`
	Specialty    string                 `json:"specialty"`
	Category     string                 `json:"category"`
	Prompt       string                 `json:"prompt" binding:"required"` // AI extraction prompt
	ExtractStyle string                 `json:"extract_style"`             // narrative, structured, hybrid
	Metadata     map[string]interface{} `json:"metadata"`
}

// CreateTemplateHandler creates a new template
// POST /api/templates
func CreateTemplateHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		var req CreateTemplateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid request payload",
				"details": err.Error(),
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Check if template key already exists
		_, err := queries.GetTemplateByKey(ctx, req.TemplateKey)
		if err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "conflict",
				"message": "Template with this key already exists",
			})
			return
		}

		// Validate extraction style
		extractStyle := "narrative"
		if req.ExtractStyle != "" {
			extractStyle = req.ExtractStyle
		}

		// Marshal metadata to JSON
		var metadataRaw pqtype.NullRawMessage
		if req.Metadata != nil {
			metadataJSON, err := json.Marshal(req.Metadata)
			if err != nil {
				log.Printf("Failed to marshal metadata: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_request",
					"message": "Invalid metadata format",
				})
				return
			}
			metadataRaw = pqtype.NullRawMessage{RawMessage: metadataJSON, Valid: true}
		}

		// Create template with prompt
		template, err := queries.CreateTemplate(ctx, db.CreateTemplateParams{
			TemplateKey:  req.TemplateKey,
			Label:        req.Label,
			Description:  sql.NullString{String: req.Description, Valid: req.Description != ""},
			Specialty:    sql.NullString{String: req.Specialty, Valid: req.Specialty != ""},
			Category:     sql.NullString{String: req.Category, Valid: req.Category != ""},
			Prompt:       req.Prompt,
			ExtractStyle: sql.NullString{String: extractStyle, Valid: extractStyle != ""},
			Metadata:     metadataRaw,
			IsActive:     sql.NullBool{Bool: req.IsActive, Valid: true},
			CreatedBy:    uuid.NullUUID{UUID: userID, Valid: true},
		})
		if err != nil {
			log.Printf("Failed to create template: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to create template",
			})
			return
		}

		response := gin.H{
			"id":            template.ID.String(),
			"name":          template.TemplateKey,
			"label":         template.Label,
			"description":   template.Description.String,
			"prompt":        template.Prompt,
			"extract_style": template.ExtractStyle,
			"specialty":     template.Specialty.String,
			"category":      template.Category.String,
			"is_active":     template.IsActive.Bool,
			"created_at":    template.CreatedAt,
		}

		c.JSON(http.StatusCreated, response)
	}
}

// UpdateTemplateHandler updates an existing template
// PUT /api/templates/{templateId}
func UpdateTemplateHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		templateIDStr := c.Param("templateId")
		if templateIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Template ID is required",
			})
			return
		}

		var req UpdateTemplateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid request payload",
				"details": err.Error(),
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Resolve template ID - accept both UUID and template key string formats
		resolver := NewTemplateIDResolver(dbConn)
		templateID, err := resolver.ResolveTemplateID(ctx, templateIDStr)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Template not found: " + templateIDStr,
				})
				return
			}
			log.Printf("Database error resolving template ID: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to resolve template",
			})
			return
		}

		// Verify template exists
		_, err = queries.GetTemplateByID(ctx, templateID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Template not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve template",
			})
			return
		}

		// Validate extraction style
		extractStyle := "narrative"
		if req.ExtractStyle != "" {
			extractStyle = req.ExtractStyle
		}

		// Marshal metadata to JSON
		var metadataRaw pqtype.NullRawMessage
		if req.Metadata != nil {
			metadataJSON, err := json.Marshal(req.Metadata)
			if err != nil {
				log.Printf("Failed to marshal metadata: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_request",
					"message": "Invalid metadata format",
				})
				return
			}
			metadataRaw = pqtype.NullRawMessage{RawMessage: metadataJSON, Valid: true}
		}

		// Update template with prompt
		err = queries.UpdateTemplate(ctx, db.UpdateTemplateParams{
			Label:        req.Label,
			Description:  sql.NullString{String: req.Description, Valid: req.Description != ""},
			Specialty:    sql.NullString{String: req.Specialty, Valid: req.Specialty != ""},
			Category:     sql.NullString{String: req.Category, Valid: req.Category != ""},
			Prompt:       req.Prompt,
			ExtractStyle: sql.NullString{String: extractStyle, Valid: extractStyle != ""},
			Metadata:     metadataRaw,
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
			ID:           templateID,
		})
		if err != nil {
			log.Printf("Failed to update template: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to update template",
			})
			return
		}

		// Retrieve updated template
		updatedTemplate, err := queries.GetTemplateByID(ctx, templateID)
		if err != nil {
			log.Printf("Failed to retrieve updated template: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve updated template",
			})
			return
		}

		response := gin.H{
			"id":            updatedTemplate.ID.String(),
			"name":          updatedTemplate.TemplateKey,
			"label":         updatedTemplate.Label,
			"description":   updatedTemplate.Description.String,
			"prompt":        updatedTemplate.Prompt,
			"extract_style": updatedTemplate.ExtractStyle,
			"specialty":     updatedTemplate.Specialty.String,
			"category":      updatedTemplate.Category.String,
			"is_active":     updatedTemplate.IsActive.Bool,
			"updated_at":    updatedTemplate.UpdatedAt,
		}

		c.JSON(http.StatusOK, response)
	}
}

// DeleteTemplateHandler deletes a template (soft delete)
// DELETE /api/templates/{templateId}
func DeleteTemplateHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		templateIDStr := c.Param("templateId")
		if templateIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Template ID is required",
			})
			return
		}

		queries := db.New(dbConn)
		ctx := c.Request.Context()

		// Resolve template ID - accept both UUID and template key string formats
		resolver := NewTemplateIDResolver(dbConn)
		templateID, err := resolver.ResolveTemplateID(ctx, templateIDStr)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Template not found: " + templateIDStr,
				})
				return
			}
			log.Printf("Database error resolving template ID: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to resolve template",
			})
			return
		}

		// Verify template exists
		_, err = queries.GetTemplateByID(ctx, templateID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "not_found",
					"message": "Template not found",
				})
				return
			}
			log.Printf("Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve template",
			})
			return
		}

		// Soft delete template (set is_active = false)
		err = queries.DeleteTemplate(ctx, db.DeleteTemplateParams{
			UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
			ID:        templateID,
		})
		if err != nil {
			log.Printf("Failed to delete template: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to delete template",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Template deleted successfully",
		})
	}
}
