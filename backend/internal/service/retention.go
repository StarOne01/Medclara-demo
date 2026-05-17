package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/StarOne01/Medclara-backend.git/internal/db"
	"github.com/google/uuid"
)

// RetentionCleanupService handles deletion of old recordings per HIPAA requirements
type RetentionCleanupService struct {
	dbConn          *sql.DB
	retentionDays   int
	interval        time.Duration
	ticker          *time.Ticker
	stopChan        chan bool
	enableDelete    bool
}

// NewRetentionCleanupService creates a new retention cleanup service
func NewRetentionCleanupService(dbConn *sql.DB, retentionDays int, interval time.Duration, enableDelete bool) *RetentionCleanupService {
	return &RetentionCleanupService{
		dbConn:       dbConn,
		retentionDays: retentionDays,
		interval:      interval,
		stopChan:      make(chan bool),
		enableDelete:  enableDelete,
	}
}

// Start begins the periodic cleanup job
func (rcs *RetentionCleanupService) Start() {
	if !rcs.enableDelete {
		log.Printf("Recording deletion is DISABLED (ENABLE_RECORDING_DELETE=false). Retention cleanup will NOT delete recordings.")
		return
	}

	rcs.ticker = time.NewTicker(rcs.interval)

	go func() {
		// Run immediately on start
		rcs.cleanup()

		// Run periodically
		for {
			select {
			case <-rcs.ticker.C:
				rcs.cleanup()
			case <-rcs.stopChan:
				log.Printf("Retention cleanup service stopped")
				return
			}
		}
	}()

	log.Printf("Retention cleanup service started (interval: %v, retention: %d days)", rcs.interval, rcs.retentionDays)
}

// Stop stops the cleanup job
func (rcs *RetentionCleanupService) Stop() {
	if rcs.ticker != nil {
		rcs.ticker.Stop()
	}
	rcs.stopChan <- true
}

// cleanupUnlinkedRecordings deletes unlinked recordings older than 24 hours
func (rcs *RetentionCleanupService) cleanupUnlinkedRecordings(ctx context.Context, queries *db.Queries) {
	// Delete unlinked recordings created more than 24 hours ago
	cutoffTime := time.Now().Add(-24 * time.Hour)

	rows, err := rcs.dbConn.QueryContext(
		ctx,
		`SELECT id FROM recordings
		 WHERE is_linked = FALSE AND created_at < $1
		 ORDER BY created_at ASC
		 LIMIT 1000`,
		cutoffTime,
	)

	if err != nil {
		log.Printf("ERROR: Failed to query unlinked recordings: %v", err)
		return
	}
	defer rows.Close()

	deletedCount := 0
	errorCount := 0

	for rows.Next() {
		var recordingID string
		if err := rows.Scan(&recordingID); err != nil {
			log.Printf("ERROR: Failed to scan recording ID: %v", err)
			errorCount++
			continue
		}

		// Parse UUID
		recordingUUID, err := uuid.Parse(recordingID)
		if err != nil {
			log.Printf("ERROR: Invalid recording UUID %s: %v", recordingID, err)
			errorCount++
			continue
		}

		// Delete the unlinked recording
		// We use DELETE since it's unlinked and thus has minimal data
		if err := queries.DeleteUnlinkedRecording(ctx, recordingUUID); err != nil {
			log.Printf("ERROR: Failed to delete unlinked recording %s: %v", recordingID, err)
			errorCount++
			continue
		}

		deletedCount++
	}

	if deletedCount > 0 || errorCount > 0 {
		log.Printf("Unlinked recordings cleanup: deleted %d, errors %d", deletedCount, errorCount)
	}
}

// cleanup performs the actual cleanup of expired recordings
func (rcs *RetentionCleanupService) cleanup() {
	if !rcs.enableDelete {
		log.Printf("Skipping retention cleanup: recording deletion is disabled")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	startTime := time.Now()

	// Calculate cutoff date
	cutoffDate := time.Now().AddDate(0, 0, -rcs.retentionDays)

	log.Printf("Starting retention cleanup job: removing recordings older than %s", cutoffDate.Format(time.RFC3339))

	queries := db.New(rcs.dbConn)

	// NEW: First, clean up old unlinked recordings (24 hour retention)
	rcs.cleanupUnlinkedRecordings(ctx, queries)

	// Get recordings to delete
	recordings, err := rcs.getExpiredRecordings(ctx, queries, cutoffDate)
	if err != nil {
		log.Printf("ERROR: Failed to retrieve expired recordings: %v", err)
		return
	}

	if len(recordings) == 0 {
		log.Printf("No expired recordings to clean up")
		return
	}

	log.Printf("Found %d expired recordings to delete", len(recordings))

	// Delete each recording
	deletedCount := 0
	errorCount := 0

	for _, recording := range recordings {
		// Try to delete from GCS if file path exists
		// TODO: Implement GCS deletion when storage integration is complete
		// if storage file exists, delete it first

		// Delete from database
		err := queries.DeleteRecording(ctx, recording.ID)
		if err != nil {
			log.Printf("ERROR: Failed to delete recording %s: %v", recording.ID, err)
			errorCount++
			continue
		}

		deletedCount++

		if deletedCount%100 == 0 {
			log.Printf("Progress: Deleted %d recordings...", deletedCount)
		}
	}

	duration := time.Since(startTime)

	logMsg := fmt.Sprintf(
		"Retention cleanup completed: deleted %d recordings, %d errors, took %v",
		deletedCount,
		errorCount,
		duration,
	)

	if errorCount > 0 {
		log.Printf("WARNING: %s", logMsg)
	} else {
		log.Printf("INFO: %s", logMsg)
	}
}

// getExpiredRecordings retrieves all recordings older than the cutoff date
func (rcs *RetentionCleanupService) getExpiredRecordings(
	ctx context.Context,
	queries *db.Queries,
	cutoffDate time.Time,
) ([]db.Recording, error) {
	// Query recordings directly from database
	rows, err := rcs.dbConn.QueryContext(
		ctx,
		`SELECT id, encounter_id, user_id, patient_id, template_id, audio_file_url, 
		        audio_duration_seconds, status, transcription, analysis, processing_error, 
		        processing_time_ms, created_at, updated_at
		 FROM recordings 
		 WHERE created_at < $1 AND status NOT IN ('pending', 'processing')
		 ORDER BY created_at ASC
		 LIMIT 1000`,
		cutoffDate,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to query expired recordings: %w", err)
	}
	defer rows.Close()

	var recordings []db.Recording

	for rows.Next() {
		var r db.Recording
		err := rows.Scan(
			&r.ID, &r.EncounterID, &r.UserID, &r.PatientID, &r.TemplateID,
			&r.AudioFileUrl, &r.AudioDurationSeconds, &r.Status,
			&r.Transcription, &r.Analysis, &r.ProcessingError,
			&r.ProcessingTimeMs, &r.CreatedAt, &r.UpdatedAt,
		)
		if err != nil {
			log.Printf("ERROR: Failed to scan recording row: %v", err)
			continue
		}
		recordings = append(recordings, r)
	}

	return recordings, rows.Err()
}

// GetStats returns cleanup statistics
func (rcs *RetentionCleanupService) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"retention_days": rcs.retentionDays,
		"interval":       rcs.interval.String(),
		"status":         "running",
	}
}
