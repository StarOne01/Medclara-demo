package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	// Database
	DatabaseURL       string
	PostgresHost      string
	PostgresPort      string
	PostgresUser      string
	PostgresPassword  string
	PostgresDatabase  string
	PostgresSSLMode   string
	MaxConnections    int
	MinConnections    int
	ConnectionTimeout int
	IdleTimeout       int

	// Server
	ServerAddr  string
	Environment string
	LogLevel    string
	GinMode     string

	// JWT & Security
	JWTSecret     string
	JWTExpiration int
	CORSOrigins   []string

	// GCP & Vertex AI
	GCPProjectID                 string
	GCPLocation                  string
	GoogleApplicationCredentials string
	VertexAIAPIKey               string
	VertexAIModel                string
	VertexAIModelAdvanced        string
	MaxOutputTokens              int
	Temperature                  float64

	// Cloud Storage
	GCSBucket string
	GCSRegion string

	// Recording Processing
	MaxAudioFileSize      int64
	AudioRetentionDays    int
	MaxProcessingTime     int
	EnableRecordingDelete bool
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	config := &Config{
		// Database
		DatabaseURL:       getEnv("DATABASE_URL", ""),
		PostgresHost:      getEnv("POSTGRES_HOST", "localhost"),
		PostgresPort:      getEnv("POSTGRES_PORT", "5432"),
		PostgresUser:      getEnv("POSTGRES_USER", "medclara_user"),
		PostgresPassword:  getEnv("POSTGRES_PASSWORD", ""), // NO DEFAULT - will validate below
		PostgresDatabase:  getEnv("POSTGRES_DATABASE", "medclara_scribe"),
		PostgresSSLMode:   getEnv("POSTGRES_SSL_MODE", "disable"),
		MaxConnections:    getEnvInt("POSTGRES_MAX_CONNECTIONS", 20),
		MinConnections:    getEnvInt("POSTGRES_MIN_CONNECTIONS", 5),
		ConnectionTimeout: getEnvInt("CONNECTION_TIMEOUT", 30),
		IdleTimeout:       getEnvInt("IDLE_TIMEOUT", 900),

		// Server
		ServerAddr:  getEnv("SERVER_ADDR", ":8000"),
		Environment: strings.ToLower(strings.TrimSpace(getEnv("ENVIRONMENT", "development"))),
		LogLevel:    getEnv("LOG_LEVEL", "debug"),
		GinMode:     getEnv("GIN_MODE", "debug"),

		// JWT & Security
		JWTSecret:     getEnv("JWT_SECRET", ""), // NO DEFAULT - will validate below
		JWTExpiration: getEnvInt("JWT_EXPIRATION", 3600),
		CORSOrigins:   strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"), ","),

		// GCP & Vertex AI
		GCPProjectID:                 getEnv("GCP_PROJECT_ID", ""),
		GCPLocation:                  getEnv("GCP_LOCATION", "us-central1"),
		GoogleApplicationCredentials: getEnv("GOOGLE_APPLICATION_CREDENTIALS", ""),
		VertexAIAPIKey:               getEnv("VERTEX_AI_API_KEY", ""),
		VertexAIModel:                getEnv("VERTEX_AI_MODEL", "gemini-2.5-flash"),
		VertexAIModelAdvanced:        getEnv("VERTEX_AI_MODEL_ADVANCED", "gemini-2.5-pro"),
		MaxOutputTokens:              getEnvInt("MAX_OUTPUT_TOKENS", 2048),
		Temperature:                  getEnvFloat("TEMPERATURE", 0.2),

		// Cloud Storage
		GCSBucket: getEnv("GCS_BUCKET", "medclara-recordings"),
		GCSRegion: getEnv("GCS_REGION", "us-central1"),

		// Recording Processing
		MaxAudioFileSize:      getEnvInt64("MAX_AUDIO_FILE_SIZE", 104857600), // 100MB
		AudioRetentionDays:    getEnvInt("AUDIO_RETENTION_DAYS", 90),
		MaxProcessingTime:     getEnvInt("MAX_PROCESSING_TIME", 120),
		EnableRecordingDelete: getEnvBool("ENABLE_RECORDING_DELETE", true),
	}

	// Build DatabaseURL if not provided
	if config.DatabaseURL == "" {
		config.DatabaseURL = fmt.Sprintf(
			"postgresql://%s:%s@%s:%s/%s?sslmode=%s",
			config.PostgresUser,
			config.PostgresPassword,
			config.PostgresHost,
			config.PostgresPort,
			config.PostgresDatabase,
			config.PostgresSSLMode,
		)
	}

	// Validate required fields
	if err := config.Validate(); err != nil {
		return nil, err
	}

	return config, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	isProd := c.Environment == "production" || c.Environment == "prod"

	// Check database configuration
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL must be set")
	}

	// Database password validation
	if isProd && c.PostgresPassword == "" {
		return fmt.Errorf("POSTGRES_PASSWORD must be set in production")
	}
	if !isProd && c.PostgresPassword == "" {
		// In development, use a placeholder (but not insecure)
		c.PostgresPassword = "dev_password_change_in_production"
	}

	// JWT secret validation
	if c.JWTSecret == "" {
		if isProd {
			return fmt.Errorf("JWT_SECRET must be set in production. Generate with: openssl rand -base64 32")
		}
		// In development, use a placeholder
		c.JWTSecret = "dev-secret-key-change-in-production-min-32-chars"
	}

	if len(c.JWTSecret) < 32 {
		if isProd {
			return fmt.Errorf("JWT_SECRET must be at least 32 characters long in production")
		}
		// Warn in development
		fmt.Printf("WARNING: JWT_SECRET is less than 32 characters. This is not secure for production.\n")
	}

	// For production, require GCP configuration
	if isProd {
		if c.GCPProjectID == "" {
			return fmt.Errorf("GCP_PROJECT_ID must be set in production")
		}
		if c.VertexAIAPIKey == "" {
			return fmt.Errorf("VERTEX_AI_API_KEY must be set in production")
		}
		if c.GoogleApplicationCredentials == "" && os.Getenv("GOOGLE_APPLICATION_CREDENTIALS") == "" {
			return fmt.Errorf("GOOGLE_APPLICATION_CREDENTIALS must be set in production")
		}
	}

	// CORS validation - ensure it's not empty
	if len(c.CORSOrigins) == 0 || (len(c.CORSOrigins) == 1 && c.CORSOrigins[0] == "") {
		return fmt.Errorf("CORS_ORIGINS must be set")
	}

	return nil
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	valueStr := getEnv(key, "")
	if value, err := strconv.ParseInt(valueStr, 10, 64); err == nil {
		return value
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	valueStr := getEnv(key, "")
	if value, err := strconv.ParseFloat(valueStr, 64); err == nil {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	valueStr := strings.ToLower(strings.TrimSpace(getEnv(key, "")))
	if valueStr == "true" || valueStr == "1" || valueStr == "yes" {
		return true
	}
	if valueStr == "false" || valueStr == "0" || valueStr == "no" {
		return false
	}
	return defaultValue
}
