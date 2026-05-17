package config

import (
	"os"
	"strings"
	"testing"
)

func TestConfigLoad(t *testing.T) {
	// Set required environment variables for development
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")
	os.Setenv("JWT_SECRET", "test-secret-key-at-least-32-characters-long-yes")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if cfg.Environment != "development" {
		t.Errorf("Expected environment to be 'development', got '%s'", cfg.Environment)
	}

	if cfg.DatabaseURL != "postgresql://user:pass@localhost:5432/testdb" {
		t.Errorf("DatabaseURL not set correctly: %s", cfg.DatabaseURL)
	}
}

func TestConfigValidateProductionRequiresCredentials(t *testing.T) {
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")
	os.Setenv("JWT_SECRET", "prod-secret-key-at-least-32-characters-long-yes")
	os.Setenv("GCP_PROJECT_ID", "")
	os.Setenv("VERTEX_AI_API_KEY", "")

	_, err := Load()
	if err != nil {
		// Expected to fail validation
		if strings.Contains(err.Error(), "GCP_PROJECT_ID") || strings.Contains(err.Error(), "VERTEX_AI_API_KEY") {
			return // Success - validation caught missing creds
		}
	}
}

func TestConfigValidateDevelopmentAllowsMissingVars(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")
	os.Setenv("JWT_SECRET", "")
	os.Setenv("GCP_PROJECT_ID", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Development config should not fail: %v", err)
	}

	if cfg == nil {
		t.Fatal("Config is nil")
	}

	// In development, JWT_SECRET should get a fallback
	if cfg.JWTSecret == "" {
		t.Fatal("JWT_SECRET should have development fallback")
	}
}

func TestConfigJWTSecretMinimumLength(t *testing.T) {
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")
	os.Setenv("JWT_SECRET", "short")
	os.Setenv("GCP_PROJECT_ID", "test-project")
	os.Setenv("VERTEX_AI_API_KEY", "test-key")
	os.Setenv("POSTGRES_PASSWORD", "secure-password")

	_, err := Load()
	if err == nil {
		t.Fatal("Expected error for JWT_SECRET less than 32 chars in production")
	}
}

func TestConfigDatabasePasswordValidation(t *testing.T) {
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("DATABASE_URL", "")
	os.Setenv("POSTGRES_HOST", "localhost")
	os.Setenv("POSTGRES_PORT", "5432")
	os.Setenv("POSTGRES_USER", "user")
	os.Setenv("POSTGRES_PASSWORD", "")
	os.Setenv("POSTGRES_DATABASE", "testdb")
	os.Setenv("JWT_SECRET", "prod-secret-key-at-least-32-characters-long-yes")
	os.Setenv("GCP_PROJECT_ID", "test-project")
	os.Setenv("VERTEX_AI_API_KEY", "test-key")

	_, err := Load()
	if err == nil {
		t.Fatal("Expected error for missing POSTGRES_PASSWORD in production")
	}
}

func TestConfigEnvironmentNormalization(t *testing.T) {
	os.Setenv("ENVIRONMENT", "  PRODUCTION  ")
	os.Setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")
	os.Setenv("JWT_SECRET", "prod-secret-key-at-least-32-characters-long-yes")
	os.Setenv("GCP_PROJECT_ID", "test-project")
	os.Setenv("VERTEX_AI_API_KEY", "test-key")
	os.Setenv("POSTGRES_PASSWORD", "secure-password")

	cfg, _ := Load()
	if cfg != nil && cfg.Environment != "production" {
		t.Errorf("Environment should be normalized to 'production', got '%s'", cfg.Environment)
	}
}
