package models

import "time"

// User represents a user in the system
type User struct {
	ID             string     `json:"id"`
	Email          string     `json:"email"`
	FirstName      string     `json:"first_name,omitempty"`
	LastName       string     `json:"last_name,omitempty"`
	Role           string     `json:"role"` // doctor, nurse, admin, clinician
	OrganizationID *string    `json:"organization_id,omitempty"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	LastLogin      *time.Time `json:"last_login,omitempty"`
}

// UserProfile represents public user profile information
type UserProfile struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	FirstName      string    `json:"first_name"`
	LastName       string    `json:"last_name"`
	Role           string    `json:"role"`
	OrganizationID *string   `json:"organization_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// CreateUserRequest is the request payload for creating a user
type CreateUserRequest struct {
	Email     string  `json:"email" binding:"required,email"`
	Password  string  `json:"password" binding:"required,min=8"`
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Role      string  `json:"role" binding:"required"`
	OrgID     *string `json:"organization_id"`
}

// UpdateUserRequest is the request payload for updating a user
type UpdateUserRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}
