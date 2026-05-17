package controller

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"log"
	"net/http"
	"os"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

// LoginHandler handles the login request
// Frontend can send either: { "email": "...", "password": "..." } or { "username": "...", "password": "..." }
// Response: { "success": true, "accessToken": "...", "tokenType": "Bearer", "user": { "id": 1, "username": "..." } }
func LoginHandler(c *gin.Context) {
	var loginReq models.LoginRequest

	// Parse JSON request body
	if err := c.ShouldBindJSON(&loginReq); err != nil {
		c.JSON(http.StatusBadRequest, models.LoginResponse{
			Success: false,
			Message: "Invalid request format",
		})
		return
	}

	// Validate that either email or username is provided
	if loginReq.Email == "" && loginReq.Username == "" {
		c.JSON(http.StatusBadRequest, models.LoginResponse{
			Success: false,
			Message: "Email or username is required",
		})
		return
	}

	// Validate password is provided
	if loginReq.Password == "" {
		c.JSON(http.StatusBadRequest, models.LoginResponse{
			Success: false,
			Message: "Password is required",
		})
		return
	}

	// Use email if provided, otherwise use username (email)
	identifier := loginReq.Email
	if identifier == "" {
		identifier = loginReq.Username
	}

	// Connect to database
	dbConn, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
		c.JSON(http.StatusInternalServerError, models.LoginResponse{
			Success: false,
			Message: "Database connection failed",
		})
		return
	}
	defer dbConn.Close()

	// Create queries instance
	queries := db.New(dbConn)

	// Get user from database using sqlc generated function
	user, err := queries.GetUserByEmail(c.Request.Context(), identifier)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "Invalid credentials",
			})
			return
		}
		log.Printf("Database query error: %v", err)
		c.JSON(http.StatusInternalServerError, models.LoginResponse{
			Success: false,
			Message: "Database error",
		})
		return
	}

	// Verify password
	if err := models.VerifyPassword(user.Password, loginReq.Password); err != nil {
		log.Print(user.Password, "           -          ", err)
		c.JSON(http.StatusUnauthorized, models.LoginResponse{
			Success: false,
			Message: "Invalid credentials",
		})
		return
	}

	// Generate JWT token
	token, err := models.GenerateToken(user.ID.String(), user.Email)
	if err != nil {
		log.Printf("Token generation error: %v", err)
		c.JSON(http.StatusInternalServerError, models.LoginResponse{
			Success: false,
			Message: "Token generation failed",
		})
		return
	}

	// Generate CSRF token (32 bytes = 64 hex characters)
	csrfBytes := make([]byte, 32)
	if _, err := rand.Read(csrfBytes); err != nil {
		log.Printf("CSRF token generation error: %v", err)
		c.JSON(http.StatusInternalServerError, models.LoginResponse{
			Success: false,
			Message: "CSRF token generation failed",
		})
		return
	}
	csrfToken := hex.EncodeToString(csrfBytes)

	// Set HTTP-only access token cookie (15 minutes)
	// Using SetCookie properly sets SameSite=Lax by default in Gin
	c.SetCookie(
		"accessToken",
		token,
		900, // Max-Age: 15 minutes
		"/",
		"",
		true, // Secure: only HTTPS
		true, // HttpOnly: JavaScript cannot access
	)

	// Build organization reference if present
	var orgID *string
	if user.OrganizationID.Valid {
		orgIDStr := user.OrganizationID.UUID.String()
		orgID = &orgIDStr
	}

	// Return successful login response WITHOUT accessToken in body
	// Frontend will use the HTTP-only cookie set above
	c.JSON(http.StatusOK, models.LoginResponse{
		Success:   true,
		Message:   "Login successful",
		CSRFToken: csrfToken, // Frontend stores this in sessionStorage
		User: &models.UserResponse{
			ID:             user.ID.String(),
			Email:          user.Email,
			FirstName:      user.FirstName.String,
			LastName:       user.LastName.String,
			Role:           user.Role,
			OrganizationID: orgID,
		},
		RedirectUrl: loginReq.From,
	})
}
