package models

// LoginRequest represents the login request payload from the frontend
// Accepts either "email" or "username" field for flexibility
// The "from" field is optional and indicates where to redirect after successful login
type LoginRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password" binding:"required,min=1"`
	From     string `json:"from"`
}

// LoginResponse represents the login response sent to the frontend
// AccessToken and TokenType are no longer returned in response body
// Token is set via HTTP-only cookie instead
type LoginResponse struct {
	Success     bool          `json:"success"`
	Message     string        `json:"message"`
	CSRFToken   string        `json:"csrfToken,omitempty"`
	AccessToken string        `json:"accessToken,omitempty"` // Deprecated - for backward compatibility only
	TokenType   string        `json:"tokenType,omitempty"`   // Deprecated - for backward compatibility only
	User        *UserResponse `json:"user,omitempty"`
	RedirectUrl string        `json:"redirectUrl,omitempty"`
}

// UserResponse represents a user in the system (for response)
type UserResponse struct {
	ID             string  `json:"id"`
	Email          string  `json:"email"`
	FirstName      string  `json:"first_name,omitempty"`
	LastName       string  `json:"last_name,omitempty"`
	Role           string  `json:"role"`
	OrganizationID *string `json:"organization_id,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
	Error   string `json:"error,omitempty"`
}

// LogoutRequest represents a logout request
type LogoutRequest struct {
	// Empty for now, can add fields if needed
}

// LogoutResponse represents a logout response
type LogoutResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}
