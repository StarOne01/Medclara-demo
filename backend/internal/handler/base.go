// Package handler provides base functionality for HTTP handlers.
// This implements the Template Method pattern and reduces code duplication
// across controllers by providing common operations.
package handler

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	apperrors "github.com/StarOne01/Medclara-backend.git/internal/errors"
)

// BaseHandler provides common functionality for all handlers
type BaseHandler struct {
	DBConn  *sql.DB
	Queries *db.Queries
}

// NewBaseHandler creates a new base handler
func NewBaseHandler(dbConn *sql.DB) *BaseHandler {
	return &BaseHandler{
		DBConn:  dbConn,
		Queries: db.New(dbConn),
	}
}

// =============================================================================
// CONTEXT EXTRACTION METHODS
// =============================================================================

// GetUserID extracts the user ID from the gin context
// Returns an error response if user is not authenticated
func (h *BaseHandler) GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		h.RespondError(c, apperrors.Unauthorized("User not authenticated"))
		return uuid.Nil, false
	}

	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		h.RespondError(c, apperrors.Unauthorized("Invalid user ID format"))
		return uuid.Nil, false
	}

	return userID, true
}

// GetOrganizationID extracts the organization ID from the gin context
// Returns an error response if organization is not found
func (h *BaseHandler) GetOrganizationID(c *gin.Context) (uuid.UUID, bool) {
	orgIDVal, exists := c.Get("organizationID")
	if !exists {
		h.RespondError(c, apperrors.Forbidden("User organization not found"))
		return uuid.Nil, false
	}

	orgID, ok := orgIDVal.(uuid.UUID)
	if !ok {
		h.RespondError(c, apperrors.Forbidden("Invalid organization ID format"))
		return uuid.Nil, false
	}

	return orgID, true
}

// GetAuthContext extracts both user ID and organization ID from context
func (h *BaseHandler) GetAuthContext(c *gin.Context) (userID, orgID uuid.UUID, ok bool) {
	userID, ok = h.GetUserID(c)
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}

	orgID, ok = h.GetOrganizationID(c)
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}

	return userID, orgID, true
}

// =============================================================================
// PARAMETER PARSING METHODS
// =============================================================================

// ParseUUIDParam parses a UUID path parameter
func (h *BaseHandler) ParseUUIDParam(c *gin.Context, paramName string) (uuid.UUID, bool) {
	paramValue := c.Param(paramName)
	if paramValue == "" {
		h.RespondError(c, apperrors.BadRequest(paramName+" is required"))
		return uuid.Nil, false
	}

	parsedUUID, err := uuid.Parse(paramValue)
	if err != nil {
		h.RespondError(c, apperrors.BadRequest("Invalid "+paramName+" format"))
		return uuid.Nil, false
	}

	return parsedUUID, true
}

// ParseStringParam parses a required string path parameter
func (h *BaseHandler) ParseStringParam(c *gin.Context, paramName string) (string, bool) {
	paramValue := c.Param(paramName)
	if paramValue == "" {
		h.RespondError(c, apperrors.BadRequest(paramName+" is required"))
		return "", false
	}
	return paramValue, true
}

// PaginationParams holds pagination parameters
type PaginationParams struct {
	Limit  int32
	Offset int32
}

// DefaultPagination returns default pagination parameters
func DefaultPagination() PaginationParams {
	return PaginationParams{
		Limit:  20,
		Offset: 0,
	}
}

// ParsePagination parses limit and offset query parameters
func (h *BaseHandler) ParsePagination(c *gin.Context) PaginationParams {
	params := DefaultPagination()

	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			params.Limit = int32(parsedLimit)
		}
	}

	if o := c.Query("offset"); o != "" {
		if parsedOffset, err := strconv.Atoi(o); err == nil && parsedOffset >= 0 {
			params.Offset = int32(parsedOffset)
		}
	}

	return params
}

// =============================================================================
// RESPONSE METHODS
// =============================================================================

// RespondSuccess sends a successful JSON response
func (h *BaseHandler) RespondSuccess(c *gin.Context, statusCode int, data interface{}) {
	c.JSON(statusCode, data)
}

// RespondCreated sends a 201 Created response
func (h *BaseHandler) RespondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, data)
}

// RespondOK sends a 200 OK response
func (h *BaseHandler) RespondOK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, data)
}

// RespondNoContent sends a 204 No Content response
func (h *BaseHandler) RespondNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// RespondError sends an error response
func (h *BaseHandler) RespondError(c *gin.Context, err error) {
	statusCode, response := apperrors.ToResponse(err)
	c.JSON(statusCode, response)
}

// RespondErrorWithLog logs the error and sends an error response
func (h *BaseHandler) RespondErrorWithLog(c *gin.Context, err error, context string) {
	log.Printf("%s: %v", context, err)
	h.RespondError(c, err)
}

// RespondList sends a paginated list response
func (h *BaseHandler) RespondList(c *gin.Context, items interface{}, total int, params PaginationParams) {
	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  params.Limit,
		"offset": params.Offset,
	})
}

// =============================================================================
// REQUEST BINDING METHODS
// =============================================================================

// BindJSON binds JSON request body and handles errors
func (h *BaseHandler) BindJSON(c *gin.Context, obj interface{}) bool {
	if err := c.ShouldBindJSON(obj); err != nil {
		h.RespondError(c, apperrors.BadRequest(err.Error()))
		return false
	}
	return true
}

// =============================================================================
// DATABASE HELPERS
// =============================================================================

// HandleDBError handles common database errors and returns appropriate HTTP responses
func (h *BaseHandler) HandleDBError(c *gin.Context, err error, resourceName string) bool {
	if err == nil {
		return true // No error
	}

	if err == sql.ErrNoRows {
		h.RespondError(c, apperrors.NotFound(resourceName))
		return false
	}

	h.RespondErrorWithLog(c, apperrors.DatabaseError("query", err), "Database error")
	return false
}

// GetUserOrg retrieves the user's organization ID from the database
func (h *BaseHandler) GetUserOrg(c *gin.Context, userID uuid.UUID) (uuid.UUID, bool) {
	user, err := h.Queries.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		h.HandleDBError(c, err, "user")
		return uuid.Nil, false
	}

	if !user.OrganizationID.Valid {
		h.RespondError(c, apperrors.Forbidden("User has no organization"))
		return uuid.Nil, false
	}

	return user.OrganizationID.UUID, true
}
