/**
 * Unified Recording Workflow Hook
 * 
 * This hook orchestrates the complete backend flow as documented in integration.md:
 * 1. POST /chunked/init → Returns: sessionId, recordingId
 * 2. POST /chunked/upload (chunks) → Receives audio data
 * 3. POST /chunked/finalize → Starts Vertex AI processing
 * 4. GET /stream (EventSource) → Streams: "processing", "completed"
 * 5. Display results
 * 
 * Handles all errors, retries, timeouts, and fallbacks.
 */

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/toast';
import { waitForResultViaSSE } from './useSSEWaiting';

export interface WorkflowMetadata {
  templateId?: string;
  patientId?: string;
  encounterId?: string;
  scribeSessionId?: string;
}

export interface AnalysisResult {
  id: string;
  status: 'completed' | 'failed';
  recordingId: string;
  transcription: string;
  analysis: {
    extracted_sections: {
      response: {
        content: string;  // Full AI-generated report as markdown
      };
    };
    entities: [];  // Empty array
    transcription_metadata: {
      total_duration_seconds: number;
      audio_quality: string;
      speaker_diarization?: Array<{
        role: string;
        percentage: number;
      }>;
    };
    confidence_score?: number;
  };
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
}

export interface RecordingWorkflowState {
  // Phase tracking
  phase: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  
  // Progress
  uploadProgress: number; // 0-100, mapped to 0-50% of total
  processingProgress: number; // Vertex AI progress
  totalProgress: number; // Combined 0-100
  
  // Session data
  sessionId: string | null;
  recordingId: string | null;
  
  // Results
  result: AnalysisResult | null;
  
  // Error handling
  error: string | null;
  errorCode: string | null;
}

export interface UseRecordingWorkflowReturn extends RecordingWorkflowState {
  // Actions
  recordAndProcess: (
    audioBlob: Blob,
    metadata: WorkflowMetadata
  ) => Promise<AnalysisResult>;
  
  cancel: () => void;
  
  // Retry on failure
  retryFromPhase: (phase: 'upload' | 'finalize' | 'wait') => Promise<AnalysisResult>;
}

const CHUNK_SIZE = 256 * 1024; // 256KB
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Main recording workflow hook
 * Orchestrates the complete flow from recording to results
 */
export function useRecordingWorkflow(): UseRecordingWorkflowReturn {
  // State
  const [phase, setPhase] = useState<RecordingWorkflowState['phase']>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { addToast } = useToast();

  // Get auth token
  const getAuthToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  }, []);

  // ========================================================================
  // Phase 1: Initialize Chunked Upload Session
  // ========================================================================
  const initChunkedSession = useCallback(
    async (metadata: WorkflowMetadata) => {

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/recordings/chunked/init`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getAuthToken()}`,
            },
            body: JSON.stringify({
              templateId: metadata.templateId || 'soap-general',
              patientId: metadata.patientId,
              encounterId: metadata.encounterId,
              sessionId: metadata.scribeSessionId, // Map scribeSessionId to sessionId
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw {
            statusCode: response.status,
            message: errorData.message || `Init failed: ${response.statusText}`,
            code: errorData.error || 'init_failed',
          };
        }

        const data = await response.json();
        const newSessionId = data.sessionId || data.session_id;
        const newRecordingId = data.recordingId || data.recording_id;

        setSessionId(newSessionId);
        setRecordingId(newRecordingId);
        
        return { sessionId: newSessionId, recordingId: newRecordingId };
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to initialize recording session';
        throw { code: err.code || 'init_error', message: errorMsg };
      }
    },
    [getAuthToken]
  );

  // ========================================================================
  // Phase 2: Upload Audio Chunks
  // ========================================================================
  const uploadChunks = useCallback(
    async (audioBlob: Blob, uploadSessionId: string) => {

      const chunkCount = Math.ceil(audioBlob.size / CHUNK_SIZE);
      const arrayBuffer = await audioBlob.arrayBuffer();

      try {
        for (let i = 0; i < chunkCount; i++) {
          // Check abort signal
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Upload cancelled by user');
          }

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
          const chunk = arrayBuffer.slice(start, end);
          const isLastChunk = i === chunkCount - 1;

          const formData = new FormData();
          formData.append('chunk', new Blob([chunk], { type: 'application/octet-stream' }));
          formData.append('chunkIndex', i.toString());
          formData.append('totalChunks', chunkCount.toString());
          formData.append('isLastChunk', isLastChunk.toString());
          formData.append('sessionId', uploadSessionId);

          const response = await fetch(
            `${API_BASE_URL}/api/recordings/chunked/upload`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${getAuthToken()}`,
              },
              body: formData,
              signal: abortControllerRef.current?.signal,
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw {
              statusCode: response.status,
              message: errorData.message || `Chunk ${i} upload failed`,
              code: errorData.error || 'chunk_upload_failed',
              chunkIndex: i,
            };
          }

          // Update progress (0-50% maps to upload phase)
          const uploadProgress = Math.round(((i + 1) / chunkCount) * 50);
          setUploadProgress(uploadProgress);

          // Small delay between chunks
          if (!isLastChunk) {
            await new Promise(r => setTimeout(r, 100));
          }
        }

      } catch (err: any) {
        if (err.message === 'Upload cancelled by user') {

          throw { code: 'upload_cancelled', message: err.message };
        }
        const errorMsg = err.message || 'Failed to upload chunks';
        throw { code: err.code || 'upload_error', message: errorMsg };
      }
    },
    [getAuthToken]
  );

  // ========================================================================
  // Phase 3: Finalize Upload & Start Processing
  // ========================================================================
  const finalizeUpload = useCallback(
    async (uploadSessionId: string) => {

      try {
        setUploadProgress(50); // Mark upload phase as complete
        
        const response = await fetch(
          `${API_BASE_URL}/api/recordings/chunked/finalize`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getAuthToken()}`,
            },
            body: JSON.stringify({ sessionId: uploadSessionId }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw {
            statusCode: response.status,
            message: errorData.message || `Finalize failed: ${response.statusText}`,
            code: errorData.error || 'finalize_failed',
          };
        }

        const data = await response.json();

        return data;
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to finalize upload';
        throw { code: err.code || 'finalize_error', message: errorMsg };
      }
    },
    [getAuthToken]
  );

  // ========================================================================
  // Phase 4: Wait for Processing Completion via SSE
  // ========================================================================
  const waitForCompletion = useCallback(
    async (waitRecordingId: string) => {

      try {
        const result = await waitForResultViaSSE(
          waitRecordingId,
          {
            timeoutMs: 30 * 60 * 1000, // 30 minutes
            enableLogging: true,
            onProgress: (data) => {
              // Update progress based on status messages
              if (data.progress) {
                const totalProgress = 50 + (data.progress * 0.5); // 50-100%
                setProcessingProgress(data.progress);

              }
            },
          }
        );

        if (result.status === 'completed') {
          setProcessingProgress(100);

          return result as AnalysisResult;
        } else if (result.status === 'failed') {
          throw {
            code: 'processing_failed',
            message: result.error || 'Vertex AI processing failed',
          };
        } else {
          throw {
            code: 'invalid_status',
            message: `Unexpected status: ${result.status}`,
          };
        }
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to wait for processing';
        throw { code: err.code || 'processing_error', message: errorMsg };
      }
    },
    []
  );

  // ========================================================================
  // Main Workflow: Record and Process
  // ========================================================================
  const recordAndProcess = useCallback(
    async (audioBlob: Blob, metadata: WorkflowMetadata): Promise<AnalysisResult> => {
      // Initialize abort controller
      abortControllerRef.current = new AbortController();
      
      // Reset state
      setPhase('idle');
      setUploadProgress(0);
      setProcessingProgress(0);
      setSessionId(null);
      setRecordingId(null);
      setResult(null);
      setError(null);
      setErrorCode(null);

      try {
        // Phase 1: Initialize

        setPhase('uploading');
        const { sessionId: newSessionId, recordingId: newRecordingId } = await initChunkedSession(metadata);

        // Phase 2: Upload chunks
        await uploadChunks(audioBlob, newSessionId);

        // Phase 3: Finalize
        await finalizeUpload(newSessionId);
        setUploadProgress(50);

        // Phase 4: Wait for completion
        setPhase('processing');
        setProcessingProgress(0);
        const analysisResult = await waitForCompletion(newRecordingId);

        // Success!
        setPhase('complete');
        setResult(analysisResult);
        
        addToast({
          type: 'success',
          title: 'Processing Complete',
          message: 'Your recording has been analyzed successfully!',
        });

        return analysisResult;

      } catch (err: any) {
        const errorMsg = err.message || 'An unexpected error occurred';
        const errorCode = err.code || 'unknown_error';


        setPhase('error');
        setError(errorMsg);
        setErrorCode(errorCode);

        // Show user-friendly error messages
        const userMessage = mapErrorToUserMessage(errorCode);
        addToast({
          type: 'error',
          title: 'Processing Failed',
          message: userMessage,
        });

        throw err;

      } finally {
        abortControllerRef.current = null;
      }
    },
    [initChunkedSession, uploadChunks, finalizeUpload, waitForCompletion, addToast]
  );

  // ========================================================================
  // Cancel and Retry
  // ========================================================================
  const cancel = useCallback(() => {

    abortControllerRef.current?.abort();
    eventSourceRef.current?.close();
    setPhase('idle');
    setError('Cancelled by user');
  }, []);

  const retryFromPhase = useCallback(
    async (retryPhase: 'upload' | 'finalize' | 'wait'): Promise<AnalysisResult> => {
      if (!sessionId || !recordingId) {
        throw new Error('Cannot retry: Session or Recording ID missing');
      }

      try {
        switch (retryPhase) {
          case 'upload':
            // Would need audio blob - not available after initial call
            throw new Error('Cannot retry upload without audio blob');

          case 'finalize':
            await finalizeUpload(sessionId);
            return await waitForCompletion(recordingId);

          case 'wait':
            return await waitForCompletion(recordingId);

          default:
            throw new Error(`Unknown retry phase: ${retryPhase}`);
        }
      } catch (err: any) {
        setError(err.message || 'Retry failed');
        throw err;
      }
    },
    [sessionId, recordingId, finalizeUpload, waitForCompletion]
  );

  // Compute total progress
  const totalProgress = uploadProgress * 0.5 + processingProgress * 0.5;

  return {
    // State
    phase,
    uploadProgress,
    processingProgress,
    totalProgress,
    sessionId,
    recordingId,
    result,
    error,
    errorCode,
    
    // Actions
    recordAndProcess,
    cancel,
    retryFromPhase,
  };
}

/**
 * Map error codes to user-friendly messages
 */
function mapErrorToUserMessage(errorCode: string): string {
  const messages: Record<string, string> = {
    init_error: 'Failed to initialize recording session. Please check your connection and try again.',
    init_failed: 'Invalid template or session. Please select a valid template.',
    
    chunk_upload_failed: 'Network error during upload. Please check your connection and try again.',
    upload_error: 'Failed to upload audio. Please check your connection and try again.',
    upload_cancelled: 'Upload was cancelled.',
    
    finalize_error: 'Failed to start processing. Please try again.',
    finalize_failed: 'Upload finalization failed. Please try again.',
    
    processing_error: 'Vertex AI processing failed. Please try again.',
    processing_failed: 'AI analysis failed. Please try again.',
    processing_timeout: 'Processing is taking longer than expected. The results may still be available shortly.',
    
    invalid_status: 'Unexpected server response. Please try again.',
    sse_connection_error: 'Connection interrupted during processing. Please try again.',
    not_found: 'Recording not found. The session may have expired.',
    expired: 'Recording session expired. Please start a new recording.',
    
    unknown_error: 'An unexpected error occurred. Please try again.',
  };

  return messages[errorCode] || messages.unknown_error;
}

export default useRecordingWorkflow;
