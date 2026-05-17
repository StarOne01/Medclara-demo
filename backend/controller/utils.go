package controller

import (
	"database/sql"
	"time"
)

// formatNullTime converts sql.NullTime to ISO 8601 string for JSON serialization
// Returns empty string if the time is NULL/invalid
func formatNullTime(t sql.NullTime) string {
	if t.Valid {
		return t.Time.Format(time.RFC3339)
	}
	return ""
}
