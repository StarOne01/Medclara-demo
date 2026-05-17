package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"github.com/StarOne01/Medclara-backend.git/controller"
)

// TemplateRoutes handles template-related routes
type TemplateRoutes struct {
	dbConn *sql.DB
}

// NewTemplateRoutes creates a new template routes handler
func NewTemplateRoutes(dbConn *sql.DB) *TemplateRoutes {
	return &TemplateRoutes{dbConn: dbConn}
}

// Register registers template routes
// Note: Order matters - specific routes must come BEFORE parameterized routes
func (r *TemplateRoutes) Register(group *gin.RouterGroup) {
	// List templates
	group.GET("", controller.GetTemplatesHandler(r.dbConn))

	// Comprehensive endpoints
	group.GET("/all", controller.GetTemplatesWithSectionsHandler(r.dbConn))
	group.GET("/uuids", controller.GetTemplateUUIDsHandler(r.dbConn))

	// Special routes (before parameterized routes)
	group.GET("/categories", controller.GetTemplateCategoriesHandler(r.dbConn))
	group.GET("/key/:templateKey", controller.GetTemplateByKeyHandler(r.dbConn))
	group.GET("/specialty/:specialty", controller.GetTemplatesBySpecialtyHandler(r.dbConn))
	group.GET("/search", controller.SearchTemplatesHandler(r.dbConn))

	// Parameterized routes (last)
	group.GET("/:templateId", controller.GetTemplateByIDHandler(r.dbConn))
	group.POST("", controller.CreateTemplateHandler(r.dbConn))
	group.PUT("/:templateId", controller.UpdateTemplateHandler(r.dbConn))
	group.DELETE("/:templateId", controller.DeleteTemplateHandler(r.dbConn))
}
