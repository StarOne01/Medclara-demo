package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/StarOne01/Medclara-backend.git/models"
)

// AuthService handles authentication operations
type AuthService struct {
	queries *db.Queries
	dbConn  *sql.DB
}

// NewAuthService creates a new auth service
func NewAuthService(queries *db.Queries, dbConn *sql.DB) *AuthService {
	return &AuthService{
		queries: queries,
		dbConn:  dbConn,
	}
}

// RegisterUser creates a new user account
func (s *AuthService) RegisterUser(ctx context.Context, email, password, firstName, lastName, role string) (*models.User, error) {
	// Validate inputs
	if email == "" || password == "" || role == "" {
		return nil, errors.New("email, password, and role are required")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	createdUser, err := s.queries.CreateUser(ctx, db.CreateUserParams{
		Email:     email,
		Password:  string(hashedPassword),
		FirstName: sql.NullString{String: firstName, Valid: firstName != ""},
		LastName:  sql.NullString{String: lastName, Valid: lastName != ""},
		Role:      role,
		IsActive:  sql.NullBool{Bool: true, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &models.User{
		ID:        createdUser.ID.String(),
		Email:     createdUser.Email,
		FirstName: parseNullString(createdUser.FirstName),
		LastName:  parseNullString(createdUser.LastName),
		Role:      createdUser.Role,
		IsActive:  parseBoolFromNullBool(createdUser.IsActive),
		CreatedAt: createdUser.CreatedAt.Time,
		UpdatedAt: createdUser.UpdatedAt.Time,
	}, nil
}

// AuthenticateUser validates user credentials
func (s *AuthService) AuthenticateUser(ctx context.Context, email, password string) (*models.User, error) {
	if email == "" || password == "" {
		return nil, errors.New("email and password are required")
	}

	// Get user by email
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("invalid email or password")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Update last login
	now := time.Now()
	if err := s.queries.UpdateUserLastLogin(ctx, db.UpdateUserLastLoginParams{
		LastLogin: sql.NullTime{Time: now, Valid: true},
		UpdatedAt: sql.NullTime{Time: now, Valid: true},
		ID:        user.ID,
	}); err != nil {
		// Log but don't fail authentication
		fmt.Printf("failed to update last login: %v\n", err)
	}

	return &models.User{
		ID:             user.ID.String(),
		Email:          user.Email,
		FirstName:      parseNullString(user.FirstName),
		LastName:       parseNullString(user.LastName),
		Role:           user.Role,
		OrganizationID: parseNullUUID(user.OrganizationID),
		IsActive:       parseBoolFromNullBool(user.IsActive),
		CreatedAt:      user.CreatedAt.Time,
		UpdatedAt:      user.UpdatedAt.Time,
		LastLogin:      parseNullTime(user.LastLogin),
	}, nil
}

// GetUserByID retrieves a user by ID
func (s *AuthService) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	// Parse UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid userID: %w", err)
	}

	user, err := s.queries.GetUserByID(ctx, userUUID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	return &models.User{
		ID:             user.ID.String(),
		Email:          user.Email,
		FirstName:      parseNullString(user.FirstName),
		LastName:       parseNullString(user.LastName),
		Role:           user.Role,
		OrganizationID: parseNullUUID(user.OrganizationID),
		IsActive:       parseBoolFromNullBool(user.IsActive),
		CreatedAt:      user.CreatedAt.Time,
		UpdatedAt:      user.UpdatedAt.Time,
		LastLogin:      parseNullTime(user.LastLogin),
	}, nil
}

// GetUserProfile gets public profile info for a user
func (s *AuthService) GetUserProfile(ctx context.Context, userID string) (*models.UserProfile, error) {
	user, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &models.UserProfile{
		ID:             user.ID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		Role:           user.Role,
		OrganizationID: user.OrganizationID,
		CreatedAt:      user.CreatedAt,
	}, nil
}

// ChangePassword changes a user's password
func (s *AuthService) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	// Parse UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid userID: %w", err)
	}

	user, err := s.queries.GetUserByID(ctx, userUUID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Verify old password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		return errors.New("invalid current password")
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password (would need to add this query to sqlc)
	// For now, using raw SQL
	now := time.Now()
	_, err = s.dbConn.ExecContext(ctx,
		"UPDATE users SET password = $1, updated_at = $2 WHERE id = $3",
		string(hashedPassword), now, userUUID)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// Helper functions to convert NULL types
func parseNullString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func parseNullUUID(nu uuid.NullUUID) *string {
	if nu.Valid {
		s := nu.UUID.String()
		return &s
	}
	return nil
}

func parseNullTime(nt sql.NullTime) *time.Time {
	if nt.Valid {
		return &nt.Time
	}
	return nil
}

func parseBoolFromNullBool(nb sql.NullBool) bool {
	if nb.Valid {
		return nb.Bool
	}
	return false
}
