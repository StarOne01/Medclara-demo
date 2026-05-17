package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"github.com/StarOne01/Medclara-backend.git/controller"
)

// PatientRoutes handles patient-related routes
type PatientRoutes struct {
	dbConn *sql.DB
}

// NewPatientRoutes creates a new patient routes handler
func NewPatientRoutes(dbConn *sql.DB) *PatientRoutes {
	return &PatientRoutes{dbConn: dbConn}
}

// Register registers patient routes
func (r *PatientRoutes) Register(group *gin.RouterGroup) {
	group.GET("", controller.GetPatientsHandler(r.dbConn))
	group.POST("", controller.CreatePatientHandler(r.dbConn))
	group.GET("/:patientId", controller.GetPatientByIDHandler(r.dbConn))
	group.GET("/:patientId/notes", controller.GetPatientNotesHandler(r.dbConn))
}
