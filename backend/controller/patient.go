package controller

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetPatientsHandler retrieves all patients with pagination - filtered by user's organization
// GET /api/patients?limit={limit}&offset={offset}
func GetPatientsHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user's organization from context (set by AuthMiddleware)
		organizationID, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}

		// Parse pagination parameters
		limit := 20
		if l := c.Query("limit"); l != "" {
			if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
				limit = parsedLimit
			}
		}

		offset := 0
		if o := c.Query("offset"); o != "" {
			if parsedOffset, err := strconv.Atoi(o); err == nil && parsedOffset >= 0 {
				offset = parsedOffset
			}
		}

		// Count total patients in user's organization
		var total int
		err := dbConn.QueryRow("SELECT COUNT(*) FROM patients WHERE organization_id = $1", organizationID).Scan(&total)
		if err != nil {
			log.Printf("Database error counting patients: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to count patients",
			})
			return
		}

		// Fetch patients with pagination filtered by organization
		rows, err := dbConn.Query(`
			SELECT id, first_name, last_name, date_of_birth, gender, email, phone, medical_record_number, organization_id, created_at, updated_at
			FROM patients
			WHERE organization_id = $1
			ORDER BY last_name, first_name
			LIMIT $2 OFFSET $3
		`, organizationID, limit, offset)

		if err != nil {
			log.Printf("Database error fetching patients: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to fetch patients",
			})
			return
		}
		defer rows.Close()

		var patients []gin.H
		for rows.Next() {
			var id, firstName, lastName, dob sql.NullString
			var gender, email, phone, mrn, orgID sql.NullString
			var createdAt, updatedAt sql.NullTime

			if err := rows.Scan(&id, &firstName, &lastName, &dob, &gender, &email, &phone, &mrn, &orgID, &createdAt, &updatedAt); err != nil {
				log.Printf("Error scanning patient row: %v", err)
				continue
			}

			patient := gin.H{
				"id":                    id.String,
				"first_name":            firstName.String,
				"last_name":             lastName.String,
				"date_of_birth":         dob.String,
				"gender":                gender.String,
				"email":                 email.String,
				"phone":                 phone.String,
				"medical_record_number": mrn.String,
				"organization_id":       orgID.String,
			}

			if createdAt.Valid {
				patient["created_at"] = createdAt.Time
			}
			if updatedAt.Valid {
				patient["updated_at"] = updatedAt.Time
			}

			patients = append(patients, patient)
		}

		if patients == nil {
			patients = []gin.H{}
		}

		c.JSON(http.StatusOK, gin.H{
			"patients": patients,
			"total":    total,
			"limit":    limit,
			"offset":   offset,
		})
	}
}

// GetPatientByIDHandler retrieves a specific patient with all details - only from user's organization
// GET /api/patients/{patientId}
// CRITICAL FIX: Uses org-filtered query to prevent cross-organization data access
func GetPatientByIDHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		patientIDStr := c.Param("patientId")

		// Validate UUID format
		patientID, err := uuid.Parse(patientIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Invalid patient ID format",
			})
			return
		}

		// Get user's organization from context (set by AuthMiddleware)
		orgIDVal, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}

		// The middleware sets organizationID as uuid.UUID, use it directly
		userOrgID := orgIDVal.(uuid.UUID)

		// Fetch patient details using org-filtered query
		var (
			id, firstName, lastName, dob, gender, email, phone, mrn sql.NullString
			createdAt, updatedAt                                    sql.NullTime
			organizationID                                          sql.NullString
		)
		err = dbConn.QueryRow(`
			SELECT id, first_name, last_name, date_of_birth, gender, email, phone, medical_record_number,
				   organization_id, created_at, updated_at
			FROM patients
			WHERE id = $1 AND organization_id = $2
		`, patientID, userOrgID).Scan(&id, &firstName, &lastName, &dob, &gender, &email, &phone, &mrn,
			&organizationID, &createdAt, &updatedAt)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "not_found",
				"message": "Patient not found or access denied",
			})
			return
		}
		if err != nil {
			log.Printf("Database error fetching patient: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to fetch patient",
			})
			return
		}

		// Fetch allergies
		allergyRows, err := dbConn.Query(`
			SELECT id, allergen, reaction
			FROM patient_allergies
			WHERE patient_id = $1
			ORDER BY created_at DESC
		`, patientID)

		var allergies []gin.H
		if err == nil {
			defer allergyRows.Close()
			for allergyRows.Next() {
				var allergyID, allergen, reaction sql.NullString
				if err := allergyRows.Scan(&allergyID, &allergen, &reaction); err == nil {
					allergies = append(allergies, gin.H{
						"id":       allergyID.String,
						"allergen": allergen.String,
						"reaction": reaction.String,
					})
				}
			}
		}

		// Fetch medications
		medRows, err := dbConn.Query(`
			SELECT id, name, dose, frequency
			FROM patient_medications
			WHERE patient_id = $1
			ORDER BY created_at DESC
		`, patientID)

		var medications []gin.H
		if err == nil {
			defer medRows.Close()
			for medRows.Next() {
				var medID, name, dose, frequency sql.NullString
				if err := medRows.Scan(&medID, &name, &dose, &frequency); err == nil {
					medications = append(medications, gin.H{
						"id":        medID.String,
						"name":      name.String,
						"dose":      dose.String,
						"frequency": frequency.String,
					})
				}
			}
		}

		// Fetch encounters
		encounterRows, err := dbConn.Query(`
			SELECT id, encounter_type, status, created_at, updated_at
			FROM encounters
			WHERE patient_id = $1
			ORDER BY created_at DESC
			LIMIT 10
		`, patientID)

		var encounters []gin.H
		if err == nil {
			defer encounterRows.Close()
			for encounterRows.Next() {
				var encID, encType, status sql.NullString
				var encCreatedAt, encUpdatedAt sql.NullTime
				if err := encounterRows.Scan(&encID, &encType, &status, &encCreatedAt, &encUpdatedAt); err == nil {
					encounter := gin.H{
						"id":             encID.String,
						"encounter_type": encType.String,
						"status":         status.String,
					}
					if encCreatedAt.Valid {
						encounter["created_at"] = encCreatedAt.Time
					}
					if encUpdatedAt.Valid {
						encounter["updated_at"] = encUpdatedAt.Time
					}
					encounters = append(encounters, encounter)
				}
			}
		}

		patient := gin.H{
			"id":                    id.String,
			"first_name":            firstName.String,
			"last_name":             lastName.String,
			"date_of_birth":         dob.String,
			"gender":                gender.String,
			"email":                 email.String,
			"phone":                 phone.String,
			"medical_record_number": mrn.String,
		}

		if organizationID.Valid && organizationID.String != "" {
			patient["organization_id"] = organizationID.String
		}
		if createdAt.Valid {
			patient["created_at"] = createdAt.Time
		}
		if updatedAt.Valid {
			patient["updated_at"] = updatedAt.Time
		}

		if allergies == nil {
			allergies = []gin.H{}
		}
		patient["allergies"] = allergies

		if medications == nil {
			medications = []gin.H{}
		}
		patient["medications"] = medications

		if encounters == nil {
			encounters = []gin.H{}
		}
		patient["encounters"] = encounters

		c.JSON(http.StatusOK, patient)
	}
}

// CreatePatientHandler creates a new patient - only in user's organization
// POST /api/patients
func CreatePatientHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user's organization from context
		userOrgID, exists := c.Get("organizationID")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "User organization not found",
			})
			return
		}

		var req struct {
			FirstName           string `json:"first_name" binding:"required"`
			LastName            string `json:"last_name" binding:"required"`
			DateOfBirth         string `json:"date_of_birth"`
			Gender              string `json:"gender"`
			Email               string `json:"email"`
			Phone               string `json:"phone"`
			MedicalRecordNumber string `json:"medical_record_number"`
			OrganizationID      string `json:"organization_id"`
		}

		// Bind JSON request body
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_request",
				"message": "Missing required fields: first_name, last_name",
			})
			return
		}

		// If organization_id is provided, validate it matches user's organization
		if req.OrganizationID != "" {
			if _, err := uuid.Parse(req.OrganizationID); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "invalid_request",
					"message": "Invalid organization ID format",
				})
				return
			}
			// Verify user can only create patients in their own organization
			if req.OrganizationID != userOrgID.(uuid.UUID).String() {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "forbidden",
					"message": "You can only create patients in your own organization",
				})
				return
			}
		} else {
			// Use user's organization if not provided
			req.OrganizationID = userOrgID.(uuid.UUID).String()
		}

		// Generate new patient ID
		patientID := uuid.New().String()

		// Check if medical record number already exists (if provided)
		if req.MedicalRecordNumber != "" {
			var existingID string
			err := dbConn.QueryRow(
				"SELECT id FROM patients WHERE medical_record_number = $1",
				req.MedicalRecordNumber,
			).Scan(&existingID)

			if err != sql.ErrNoRows {
				if err == nil {
					c.JSON(http.StatusConflict, gin.H{
						"error":   "duplicate_mrn",
						"message": "Medical record number already exists",
					})
					return
				}
				log.Printf("Database error checking MRN: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "database_error",
					"message": "Failed to create patient",
				})
				return
			}
		}

		// Insert patient into database
		_, err := dbConn.Exec(`
			INSERT INTO patients (id, first_name, last_name, date_of_birth, gender, email, phone, medical_record_number, organization_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`,
			patientID,
			req.FirstName,
			req.LastName,
			nullIfEmpty(req.DateOfBirth),
			nullIfEmpty(req.Gender),
			nullIfEmpty(req.Email),
			nullIfEmpty(req.Phone),
			nullIfEmpty(req.MedicalRecordNumber),
			req.OrganizationID,
		)

		if err != nil {
			log.Printf("Database error creating patient: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to create patient",
			})
			return
		}

		// Return created patient
		patient := gin.H{
			"id":                    patientID,
			"first_name":            req.FirstName,
			"last_name":             req.LastName,
			"date_of_birth":         req.DateOfBirth,
			"gender":                req.Gender,
			"email":                 req.Email,
			"phone":                 req.Phone,
			"medical_record_number": req.MedicalRecordNumber,
			"organization_id":       req.OrganizationID,
		}

		c.JSON(http.StatusCreated, patient)
	}
}

// Helper function to return nil if string is empty
func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
