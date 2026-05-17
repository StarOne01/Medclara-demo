package controller

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// LogoutHandler handles user logout
// POST /api/auth/logout
func LogoutHandler(c *gin.Context) {
	// Clear HTTP-only cookies by setting Max-Age=0
	c.SetCookie(
		"accessToken",
		"",
		0, // Max-Age=0 to delete
		"/",
		"",
		true, // Secure
		true, // HttpOnly
	)

	// Return success response
	c.JSON(http.StatusOK, models.LoginResponse{
		Success: true,
		Message: "Logout successful",
	})
}

// RefreshTokenHandler refreshes an expired access token
// POST /api/auth/refresh
func RefreshTokenHandler(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context (set by AuthMiddleware which validates the token)
		userIDStr, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "User not authenticated",
			})
			return
		}
		userID := userIDStr.(uuid.UUID)

		email, exists := c.Get("email")
		if !exists {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "User not authenticated",
			})
			return
		}

		// Generate new access token
		newToken, err := models.GenerateToken(userID.String(), email.(string))
		if err != nil {
			log.Printf("Token generation error: %v", err)
			c.JSON(http.StatusInternalServerError, models.LoginResponse{
				Success: false,
				Message: "Token refresh failed",
			})
			return
		}

		// Set new HTTP-only access token cookie (15 minutes)
		c.SetCookie(
			"accessToken",
			newToken,
			900, // Max-Age: 15 minutes
			"/",
			"",
			true, // Secure: only HTTPS
			true, // HttpOnly: JavaScript cannot access
		)

		// Fetch user details for response
		queries := db.New(dbConn)
		user, err := queries.GetUserByEmail(c.Request.Context(), email.(string))
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusUnauthorized, models.LoginResponse{
					Success: false,
					Message: "User not found",
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

		// Build organization reference if present
		var orgID *string
		if user.OrganizationID.Valid {
			orgIDStr := user.OrganizationID.UUID.String()
			orgID = &orgIDStr
		}

		// Return refreshed token response
		c.JSON(http.StatusOK, models.LoginResponse{
			Success: true,
			Message: "Token refreshed successfully",
			User: &models.UserResponse{
				ID:             userID.String(),
				Email:          user.Email,
				FirstName:      user.FirstName.String,
				LastName:       user.LastName.String,
				Role:           user.Role,
				OrganizationID: orgID,
			},
		})
	}
}

// GetUserHandler returns the current authenticated user
// GET /api/auth/me
func GetUserHandler(c *gin.Context) {
	// Get user info from context (set by AuthMiddleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.LoginResponse{
			Success: false,
			Message: "User not authenticated",
		})
		return
	}

	email, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.LoginResponse{
			Success: false,
			Message: "User not authenticated",
		})
		return
	}

	userIDStr := userID.(uuid.UUID).String()

	// Connect to database to fetch full user details
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
	user, err := queries.GetUserByEmail(c.Request.Context(), email.(string))
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "User not found",
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

	// Build organization reference if present
	var orgID *string
	if user.OrganizationID.Valid {
		orgIDStr := user.OrganizationID.UUID.String()
		orgID = &orgIDStr
	}

	// Return user response with organization info
	c.JSON(http.StatusOK, models.LoginResponse{
		Success: true,
		Message: "User retrieved successfully",
		User: &models.UserResponse{
			ID:             userIDStr,
			Email:          user.Email,
			FirstName:      user.FirstName.String,
			LastName:       user.LastName.String,
			Role:           user.Role,
			OrganizationID: orgID,
		},
	})
}
