package controller

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/gin-gonic/gin"
)

// GetTemplatesWithSectionsHandler retrieves all templates with their sections
// GET /api/templates?includeAll=false&limit=100&offset=0&specialty=&category=
func GetTemplatesWithSectionsHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse query parameters
		includeAll := c.DefaultQuery("includeAll", "false") == "true"
		limitStr := c.DefaultQuery("limit", "50")
		offsetStr := c.DefaultQuery("offset", "0")
		specialty := c.Query("specialty")
		category := c.Query("category")

		// Validate pagination
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit <= 0 || limit > 1000 {
			limit = 50
		}
		offset, err := strconv.Atoi(offsetStr)
		if err != nil || offset < 0 {
			offset = 0
		}

		// Build query
		query := `
			SELECT 
				t.id, t.template_key, t.label, t.description, 
				t.specialty, t.category, t.is_active,
				t.created_at, t.updated_at
			FROM templates t
			WHERE 1=1
		`
		args := []interface{}{}
		argCount := 0

		if !includeAll {
			query += " AND t.is_active = TRUE"
		}

		if specialty != "" {
			argCount++
			query += fmt.Sprintf(" AND t.specialty = $%d", argCount)
			args = append(args, specialty)
		}

		if category != "" {
			argCount++
			query += fmt.Sprintf(" AND t.category = $%d", argCount)
			args = append(args, category)
		}

		// Get total count
		countQuery := strings.Replace(query, "SELECT t.id, t.template_key, t.label, t.description, t.specialty, t.category, t.is_active, t.created_at, t.updated_at", "SELECT COUNT(*)", 1)
		var total int
		err = dbConn.QueryRowContext(c.Request.Context(), countQuery, args...).Scan(&total)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Error counting templates: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve templates",
			})
			return
		}

		// Add pagination
		argCount++
		query += fmt.Sprintf(" ORDER BY t.created_at DESC LIMIT $%d OFFSET", argCount)
		args = append(args, limit)
		argCount++
		query += fmt.Sprintf(" $%d", argCount)
		args = append(args, offset)

		rows, err := dbConn.QueryContext(c.Request.Context(), query, args...)
		if err != nil {
			log.Printf("Error fetching templates: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve templates",
			})
			return
		}
		defer rows.Close()

		templates := []models.TemplateWithSections{}
		templateIDs := []string{}

		for rows.Next() {
			var (
				id, templateKey, label           string
				description, specialty, category sql.NullString
				isActive                         sql.NullBool
				createdAt, updatedAt             time.Time
			)

			err := rows.Scan(&id, &templateKey, &label, &description, &specialty, &category, &isActive, &createdAt, &updatedAt)
			if err != nil {
				log.Printf("Error scanning template: %v", err)
				continue
			}

			templateIDs = append(templateIDs, id)

			template := models.TemplateWithSections{
				ID:          id,
				TemplateKey: templateKey,
				Label:       label,
				Description: nullStringToString(description),
				Specialty:   nullStringToString(specialty),
				Category:    nullStringToString(category),
				IsActive:    isActive.Valid && isActive.Bool,
				Version:     "1.0.0",
				CreatedAt:   createdAt,
				UpdatedAt:   updatedAt,
				Sections:    []models.TemplateSection{},
				Metadata:    models.TemplateMetadata{},
			}

			templates = append(templates, template)
		}

		// Fetch sections for all templates
		if len(templateIDs) > 0 {
			sectionMap := make(map[string][]models.TemplateSection)
			placeholders := make([]string, len(templateIDs))
			sectionArgs := make([]interface{}, len(templateIDs))

			for i, id := range templateIDs {
				placeholders[i] = fmt.Sprintf("$%d", i+1)
				sectionArgs[i] = id
			}

			sectionQuery := `
				SELECT id, template_id, key, title, helper, "order", is_required, 
					   input_type, placeholder, icon
				FROM template_sections
				WHERE template_id IN (` + strings.Join(placeholders, ",") + `)
				ORDER BY "order" ASC
			`

			sectionRows, err := dbConn.QueryContext(c.Request.Context(), sectionQuery, sectionArgs...)
			if err == nil {
				defer sectionRows.Close()

				for sectionRows.Next() {
					var (
						id, templateID, key, title, inputType string
						helper                                sql.NullString
						order                                 int
						isRequired                            bool
						placeholder, icon                     sql.NullString
					)

					err := sectionRows.Scan(&id, &templateID, &key, &title, &helper, &order,
						&isRequired, &inputType, &placeholder, &icon)
					if err == nil {
						section := models.TemplateSection{
							ID:          id,
							Key:         key,
							Title:       title,
							Helper:      nullStringToString(helper),
							Order:       order,
							IsRequired:  isRequired,
							InputType:   inputType,
							Placeholder: nullStringToString(placeholder),
							Icon:        nullStringToString(icon),
						}
						sectionMap[templateID] = append(sectionMap[templateID], section)
					}
				}
			}

			// Populate sections in templates
			for i := range templates {
				if sections, ok := sectionMap[templates[i].ID]; ok {
					templates[i].Sections = sections
				}
			}
		}

		// Calculate version and cache headers
		version := fmt.Sprintf("v2-%s", time.Now().Format("2006-01-02"))
		cacheHeaders := models.GetCacheHeaders("templates", version)

		// Set cache headers
		c.Header("Cache-Control", cacheHeaders.CacheControl)
		c.Header("ETag", cacheHeaders.ETag)
		c.Header("Last-Modified", time.Now().UTC().Format(http.TimeFormat))

		response := models.GetTemplatesResponse{
			Status: "success",
			Meta: models.PaginationMeta{
				Total:        total,
				Limit:        limit,
				Offset:       offset,
				HasMore:      offset+limit < total,
				Version:      version,
				CacheControl: cacheHeaders.CacheControl,
			},
			Templates: templates,
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetTemplateUUIDsHandler returns a lightweight mapping of template keys to UUIDs
// GET /api/templates/uuids
func GetTemplateUUIDsHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT template_key, id
			FROM templates
			WHERE is_active = TRUE
			ORDER BY created_at
		`

		rows, err := dbConn.QueryContext(c.Request.Context(), query)
		if err != nil {
			log.Printf("Error fetching template UUIDs: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve template UUIDs",
			})
			return
		}
		defer rows.Close()

		data := make(map[string]string)
		for rows.Next() {
			var templateKey, id string
			err := rows.Scan(&templateKey, &id)
			if err != nil {
				log.Printf("Error scanning template UUID: %v", err)
				continue
			}
			data[templateKey] = id
		}

		version := fmt.Sprintf("v2-%s", time.Now().Format("2006-01-02"))
		cacheHeaders := models.GetCacheHeaders("template_uuids", version)

		// Set cache headers
		c.Header("Cache-Control", cacheHeaders.CacheControl)
		c.Header("ETag", cacheHeaders.ETag)

		response := models.GetTemplateUUIDsResponse{
			Status:  "success",
			Version: version,
			Data:    data,
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetConsoleTabsHandler retrieves available console tabs based on user permissions
// GET /api/scribe/workspace/tabs?sessionId=&organization_id=
func GetConsoleTabsHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// For now, return default tabs. Can be extended with org-specific config
		tabs := []models.ConsoleTab{
			{
				ID:                  "patient",
				Label:               "Patient",
				Icon:                "user",
				Order:               1,
				Enabled:             true,
				Permissions:         []string{"read:patient"},
				PermissionsRequired: true,
				Beta:                false,
				Description:         "Patient overview and information",
			},
			{
				ID:                  "tasks",
				Label:               "Tasks",
				Icon:                "tasks",
				Order:               2,
				Enabled:             true,
				Permissions:         []string{"read:tasks", "write:tasks"},
				PermissionsRequired: true,
				Beta:                false,
			},
			{
				ID:                  "orders",
				Label:               "Orders",
				Icon:                "clipboard-check",
				Order:               3,
				Enabled:             true,
				Permissions:         []string{"read:orders"},
				PermissionsRequired: true,
				Beta:                false,
			},
			{
				ID:                  "diagnostics",
				Label:               "Diagnostics",
				Icon:                "microscope",
				Order:               4,
				Enabled:             true,
				Permissions:         []string{"read:diagnostics"},
				PermissionsRequired: true,
				Beta:                false,
			},
			{
				ID:                  "timeline",
				Label:               "Timeline",
				Icon:                "history",
				Order:               5,
				Enabled:             true,
				Permissions:         []string{"read:timeline"},
				PermissionsRequired: false,
				Beta:                false,
			},
			{
				ID:                  "followups",
				Label:               "Follow-ups",
				Icon:                "calendar",
				Order:               6,
				Enabled:             true,
				Permissions:         []string{"read:followups"},
				PermissionsRequired: true,
				Beta:                false,
			},
			{
				ID:                  "alerts",
				Label:               "Alerts",
				Icon:                "alert-circle",
				Order:               7,
				Enabled:             true,
				Permissions:         []string{"read:alerts"},
				PermissionsRequired: false,
				FeatureFlag:         "decision_support_alerts",
				Beta:                true,
				Description:         "Decision support and clinical alerts",
			},
			{
				ID:                  "billing",
				Label:               "Billing",
				Icon:                "receipt",
				Order:               8,
				Enabled:             true,
				Permissions:         []string{"read:billing"},
				PermissionsRequired: true,
				Beta:                false,
			},
		}

		response := models.GetConsoleTabsResponse{
			Status: "success",
			Tabs:   tabs,
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetErrorMessagesHandler retrieves localized error messages
// GET /api/localization/error-messages?language=en&region=
func GetErrorMessagesHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		language := c.DefaultQuery("language", "en")
		region := c.DefaultQuery("region", "")

		query := `
			SELECT http_status_code, title, message, user_message, icon, action
			FROM error_messages
			WHERE language = $1
		`
		args := []interface{}{language}

		if region != "" {
			query += " AND region = $2"
			args = append(args, region)
		}

		query += " ORDER BY http_status_code"

		rows, err := dbConn.QueryContext(c.Request.Context(), query, args...)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Error fetching error messages: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to retrieve error messages",
			})
			return
		}
		defer rows.Close()

		messages := make(map[string]models.ErrorMessageData)

		for rows.Next() {
			var (
				statusCode                  int
				title, message, userMessage string
				icon, action                sql.NullString
			)

			err := rows.Scan(&statusCode, &title, &message, &userMessage, &icon, &action)
			if err != nil {
				log.Printf("Error scanning error message: %v", err)
				continue
			}

			errorMsg := models.ErrorMessageData{
				Title:       title,
				Message:     message,
				UserMessage: userMessage,
				Icon:        nullStringToString(icon),
				Action:      nullStringToString(action),
			}

			messages[strconv.Itoa(statusCode)] = errorMsg
		}

		version := fmt.Sprintf("v1-%s", time.Now().Format("2006-01-02"))
		cacheHeaders := models.GetCacheHeaders("error_messages", version)

		// Set cache headers
		c.Header("Cache-Control", cacheHeaders.CacheControl)
		c.Header("ETag", cacheHeaders.ETag)

		response := models.GetErrorMessagesResponse{
			Status:   "success",
			Language: language,
			Region:   region,
			Version:  version,
			Messages: messages,
		}

		c.JSON(http.StatusOK, response)
	}
}

// Helper function to convert sql.NullString to string
func nullStringToString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}
