package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/StarOne01/Medclara-backend.git/config"
	_ "github.com/lib/pq"
)

// InitDB initializes and returns a database connection with the provided config
func InitDB(cfg *config.Config) (*sql.DB, error) {
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL not set in configuration")
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(cfg.MaxConnections)
	db.SetMaxIdleConns(cfg.MinConnections)
	db.SetConnMaxLifetime(time.Duration(cfg.IdleTimeout) * time.Second)
	db.SetConnMaxIdleTime(time.Duration(cfg.IdleTimeout) * time.Second)

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}
