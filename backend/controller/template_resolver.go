package controller

import (
	"context"
	"database/sql"
	"log"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/google/uuid"
)

// TemplateIDResolver handles both UUID and template key string formats
type TemplateIDResolver struct {
	dbConn *sql.DB
}

// NewTemplateIDResolver creates a new resolver
func NewTemplateIDResolver(dbConn *sql.DB) *TemplateIDResolver {
	return &TemplateIDResolver{dbConn: dbConn}
}

// ResolveTemplateID accepts either a UUID or a template key string and returns the template UUID
// It tries UUID first, then falls back to looking up by template key
func (r *TemplateIDResolver) ResolveTemplateID(ctx context.Context, templateIDStr string) (uuid.UUID, error) {
	queries := db.New(r.dbConn)

	// Try parsing as UUID first
	if parsedUUID, err := uuid.Parse(templateIDStr); err == nil {
		// It's a valid UUID, return it
		return parsedUUID, nil
	}

	// Not a UUID, treat as template key and look it up
	template, err := queries.GetTemplateByKey(ctx, templateIDStr)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("Template key not found: %s", templateIDStr)
			return uuid.Nil, sql.ErrNoRows
		}
		log.Printf("Database error looking up template key: %v", err)
		return uuid.Nil, err
	}

	return template.ID, nil
}

// ResolveTemplateIDOrNil is like ResolveTemplateID but returns nil UUID on error
func (r *TemplateIDResolver) ResolveTemplateIDOrNil(ctx context.Context, templateIDStr string) uuid.UUID {
	id, err := r.ResolveTemplateID(ctx, templateIDStr)
	if err != nil {
		return uuid.Nil
	}
	return id
}
