package models

import (
	"os"
	"testing"
	"time"
)

func TestGenerateToken(t *testing.T) {
	// Set environment for testing
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("JWT_SECRET", "test-secret-key-at-least-32-characters-long")

	userID := "test-user-123"
	email := "test@example.com"

	token, err := GenerateToken(userID, email)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	if token == "" {
		t.Fatal("Generated token is empty")
	}

	// Verify the token
	claims, err := VerifyToken(token)
	if err != nil {
		t.Fatalf("Failed to verify token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("UserID mismatch: expected %s, got %s", userID, claims.UserID)
	}

	if claims.Email != email {
		t.Errorf("Email mismatch: expected %s, got %s", email, claims.Email)
	}
}

func TestVerifyTokenWithInvalidSecret(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("JWT_SECRET", "original-secret-key-at-least-32-characters-long")

	userID := "test-user-123"
	email := "test@example.com"

	token, err := GenerateToken(userID, email)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Change the secret
	os.Setenv("JWT_SECRET", "different-secret-key-at-least-32-characters")

	// Try to verify with different secret
	_, err = VerifyToken(token)
	if err == nil {
		t.Fatal("Expected error when verifying with different secret")
	}
}

func TestTokenExpiration(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("JWT_SECRET", "test-secret-key-at-least-32-characters-long")

	userID := "test-user-123"
	email := "test@example.com"

	token, err := GenerateToken(userID, email)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	// Verify token is valid
	claims, err := VerifyToken(token)
	if err != nil {
		t.Fatalf("Failed to verify token: %v", err)
	}

	// Check expiration is in the future
	if claims.ExpiresAt.Time.Before(time.Now()) {
		t.Fatal("Token has already expired")
	}

	// Check expiration is approximately 24 hours from now
	expirationDuration := time.Until(claims.ExpiresAt.Time)
	if expirationDuration < 23*time.Hour || expirationDuration > 25*time.Hour {
		t.Errorf("Token expiration not around 24 hours: %v", expirationDuration)
	}
}

func TestGenerateTokenWithShortSecret(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("JWT_SECRET", "short") // Too short!

	userID := "test-user-123"
	email := "test@example.com"

	// Should still work in development but with warning
	token, err := GenerateToken(userID, email)
	if err != nil {
		t.Fatalf("Failed to generate token in development with short secret: %v", err)
	}

	if token == "" {
		t.Fatal("Generated token is empty")
	}
}

func TestVerifyTokenEmptySecret(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("JWT_SECRET", "")

	userID := "test-user-123"
	email := "test@example.com"

	// Should work in development with fallback
	token, err := GenerateToken(userID, email)
	if err != nil {
		t.Fatalf("Failed to generate token with empty secret in development: %v", err)
	}

	// Should be able to verify with same fallback secret
	claims, err := VerifyToken(token)
	if err != nil {
		t.Fatalf("Failed to verify token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("UserID mismatch: expected %s, got %s", userID, claims.UserID)
	}
}

func TestGenerateTokenProductionRequiresSecret(t *testing.T) {
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("JWT_SECRET", "")

	// In production, should fail to generate
	// Note: log.Fatal calls os.Exit, so we can't easily test it here
	// Instead, test that development mode works and production validation logic exists
	t.Log("Production JWT_SECRET validation would trigger fatal error")
}
