package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"github.com/StarOne01/Medclara-backend.git/controller"
	"github.com/StarOne01/Medclara-backend.git/middlewares"
)

// AuthRoutes handles authentication-related routes
type AuthRoutes struct {
	dbConn *sql.DB
}

// NewAuthRoutes creates a new auth routes handler
func NewAuthRoutes(dbConn *sql.DB) *AuthRoutes {
	return &AuthRoutes{dbConn: dbConn}
}

// Register registers authentication routes
func (r *AuthRoutes) Register(group *gin.RouterGroup) {
	group.POST("/login", controller.LoginHandler)
	group.POST("/logout", controller.LogoutHandler)
	group.POST("/refresh", middlewares.AuthMiddleware(r.dbConn), controller.RefreshTokenHandler(r.dbConn))
	group.GET("/me", middlewares.AuthMiddleware(r.dbConn), controller.GetUserHandler)
}
