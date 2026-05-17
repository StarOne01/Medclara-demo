package db

import (
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/StarOne01/Medclara-backend.git/config"
)

var (
	instance *sql.DB
	once     sync.Once
)

// GetConnection returns a singleton database connection pool
// This ensures all requests share the same connection pool instead of creating new connections
func GetConnection(cfg *config.Config) (*sql.DB, error) {
	var err error
	once.Do(func() {
		instance, err = initPool(cfg)
	})
	return instance, err
}

// initPool initializes the connection pool with proper settings
func initPool(cfg *config.Config) (*sql.DB, error) {
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Set connection pool parameters
	db.SetMaxOpenConns(cfg.MaxConnections)   // e.g., 20
	db.SetMaxIdleConns(cfg.MinConnections)   // e.g., 5
	db.SetConnMaxLifetime(900 * time.Second) // 15 minutes
	db.SetConnMaxIdleTime(600 * time.Second) // 10 minutes

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("Database connection pool initialized: max=%d, min=%d",
		cfg.MaxConnections, cfg.MinConnections)
	return db, nil
}

// Close closes the connection pool (call once on shutdown)
func Close() error {
	if instance != nil {
		return instance.Close()
	}
	return nil
}
