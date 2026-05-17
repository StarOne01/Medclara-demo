package middlewares

import (
	"database/sql"
	"log"
	"net/http"
	"strings"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// AuthMiddleware verifies JWT token and adds user info to context
// FIXED: Takes dbConn as parameter to use singleton connection pool
// UPDATED: Now checks both Authorization header AND HTTP-only cookie
func AuthMiddleware(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// First try to get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			// Extract token from "Bearer <token>"
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		// If no Authorization header, try HTTP-only cookie
		if tokenString == "" {
			cookie, err := c.Cookie("accessToken")
			if err == nil && cookie != "" {
				tokenString = cookie
			}
		}

		// If still no token, reject
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "Missing authorization (use Authorization header or accessToken cookie)",
			})
			c.Abort()
			return
		}

		// Verify token
		claims, err := models.VerifyToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Parse userID from string to UUID
		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "Invalid user ID in token",
			})
			c.Abort()
			return
		}

		// FIXED: Use injected connection pool instead of creating new connection
		queries := db.New(dbConn)
		user, err := queries.GetUserByID(c.Request.Context(), userID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusUnauthorized, models.LoginResponse{
					Success: false,
					Message: "User not found",
				})
			} else {
				log.Printf("Database query error: %v", err)
				c.JSON(http.StatusInternalServerError, models.LoginResponse{
					Success: false,
					Message: "Database error",
				})
			}
			c.Abort()
			return
		}

		// Add user info to context
		c.Set("userID", userID)
		c.Set("email", claims.Email)

		// Add organization_id to context if user has one
		if user.OrganizationID.Valid {
			c.Set("organizationID", user.OrganizationID.UUID)
		}

		c.Next()
	}
}

// SSEAuthMiddleware verifies JWT token from query parameter, Authorization header, or cookie
// This is needed for Server-Sent Events (SSE) since EventSource cannot send custom headers
// FIXED: Takes dbConn as parameter to use singleton connection pool
// UPDATED: Now checks Authorization header, HTTP-only cookie, AND query parameter
func SSEAuthMiddleware(dbConn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// First try to get token from Authorization header (preferred method)
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		// If no Authorization header, try HTTP-only cookie
		if tokenString == "" {
			cookie, err := c.Cookie("accessToken")
			if err == nil && cookie != "" {
				tokenString = cookie
			}
		}

		// If no cookie, try query parameter (for EventSource compatibility)
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		// If still no token, reject
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "Missing authorization token (use Authorization header or ?token= query param)",
			})
			c.Abort()
			return
		}

		// Verify token
		claims, err := models.VerifyToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Parse userID from string to UUID
		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.LoginResponse{
				Success: false,
				Message: "Invalid user ID in token",
			})
			c.Abort()
			return
		}

		// FIXED: Use injected connection pool instead of creating new connection
		queries := db.New(dbConn)
		user, err := queries.GetUserByID(c.Request.Context(), userID)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusUnauthorized, models.LoginResponse{
					Success: false,
					Message: "User not found",
				})
			} else {
				log.Printf("Database query error: %v", err)
				c.JSON(http.StatusInternalServerError, models.LoginResponse{
					Success: false,
					Message: "Database error",
				})
			}
			c.Abort()
			return
		}

		// Add user info to context
		c.Set("userID", userID)
		c.Set("email", claims.Email)

		// Add organization_id to context if user has one
		if user.OrganizationID.Valid {
			c.Set("organizationID", user.OrganizationID.UUID)
		}

		c.Next()
	}
}
