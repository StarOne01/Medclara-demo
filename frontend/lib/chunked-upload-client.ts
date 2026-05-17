/**
 * Chunked Audio Upload Client
 * 
 * Handles streaming audio uploads to the backend in optimized chunks.
 * Enables real-time processing and reduces latency for note generation.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ChunkedUploadOptions {
  chunkSize?: number;
  onProgress?: (progress: number, chunkIndex: number, totalChunks: number) => void;
  onChunkUploaded?: (chunkIndex: number) => void;
  signal?: AbortSignal;
}

export interface ChunkedUploadSession {
  sessionId: string;
  recordingId?: string;
  createdAt: string;
}

export interface ChunkedUploadResult {
  id: string;
  sessionId: string;
  recordingId?: string; // May be separate from id
  status: 'processing' | 'completed' | 'failed';
  totalChunks: number;
  chunksReceived: number;
  message?: string;
}

class ChunkedUploadError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public chunkIndex?: number
  ) {
    super(message);
    this.name = 'ChunkedUploadError';
  }
}

/**
 * Get authorization header
 */
function getAuthHeader(): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
}

/**
 * Initialize a chunked upload session
 * 
 * @param metadata Upload metadata (template, patient, encounter IDs)
 * @returns Session information with sessionId
 */
export async function initializeChunkedUploadSession(
  metadata: {
    templateId?: string;
    encounterId?: string;
    patientId?: string;
    sessionId?: string;
  }
): Promise<ChunkedUploadSession> {
  const response = await fetch(`${API_BASE_URL}/api/recordings/chunked/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      templateId: metadata.templateId || 'soap-general',
      encounterId: metadata.encounterId,
      patientId: metadata.patientId,
      sessionId: metadata.sessionId,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ChunkedUploadError(
      error.message || 'Failed to initialize upload session',
      response.status
    );
  }

  return response.json();
}

/**
 * Upload a single audio chunk
 * 
 * @param chunk Binary chunk data
 * @param chunkIndex Index of this chunk
 * @param totalChunks Total number of chunks
 * @param sessionId Session ID from initialization
 * @param isLastChunk Whether this is the final chunk
 * @param options Upload options
 */
export async function uploadChunk(
  chunk: ArrayBuffer,
  chunkIndex: number,
  totalChunks: number,
  sessionId: string,
  isLastChunk: boolean,
  options?: ChunkedUploadOptions
): Promise<void> {
  const formData = new FormData();
  formData.append('chunk', new Blob([chunk], { type: 'application/octet-stream' }));
  formData.append('chunkIndex', chunkIndex.toString());
  formData.append('totalChunks', totalChunks.toString());
  formData.append('isLastChunk', isLastChunk.toString());
  formData.append('sessionId', sessionId);

  const response = await fetch(`${API_BASE_URL}/api/recordings/chunked/upload`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: formData,
    signal: options?.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ChunkedUploadError(
      error.message || `Failed to upload chunk ${chunkIndex}`,
      response.status,
      chunkIndex
    );
  }

  options?.onChunkUploaded?.(chunkIndex);
  
  const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
  options?.onProgress?.(progress, chunkIndex, totalChunks);
}

/**
 * Finalize a chunked upload session
 * 
 * Signals backend to finish assembly and start processing.
 * Returns the recordingId which should be used for subsequent operations (SSE waiting, etc).
 * 
 * IMPORTANT: Use the returned recordingId (from response.recordingId or response.id) 
 * for SSE waiting, NOT the sessionId. SessionId is for upload phase only.
 * 
 * @param sessionId Session ID from initialization (used for upload phase)
 * @returns Upload result with recordingId for processing phase
 */
export async function finalizeChunkedUploadSession(
  sessionId: string
): Promise<ChunkedUploadResult> {
  const response = await fetch(
    `${API_BASE_URL}/api/recordings/chunked/finalize`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        sessionId,
        timestamp: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ChunkedUploadError(
      error.message || 'Failed to finalize upload session',
      response.status
    );
  }

  const result = await response.json();

  return result;
}

/**
 * Upload audio blob in chunks
 * 
 * High-level function that handles the complete chunked upload flow.
 * Returns the recordingId which should be used for SSE waiting and other operations.
 * 
 * IMPORTANT: The returned ID is the recordingId, NOT the sessionId.
 * Use this ID for SSE waiting via waitForCompletionOptimized(recordingId).
 * 
 * @param audioBlob The audio data to upload
 * @param metadata Metadata about the recording
 * @param options Upload options
 * @returns recordingId (NOT sessionId) - use this for SSE waiting
 */
export async function uploadAudioInChunks(
  audioBlob: Blob,
  metadata: {
    templateId?: string;
    encounterId?: string;
    patientId?: string;
    sessionId?: string;
  },
  options: ChunkedUploadOptions = {}
): Promise<string> {
  const chunkSize = options.chunkSize || 256 * 1024; // 256KB default

  // Step 1: Initialize session → returns sessionId (for uploads) and recordingId
  const session = await initializeChunkedUploadSession(metadata);
  const uploadSessionId = session.sessionId;
  const recordingId = session.recordingId || session.sessionId; // Fallback if backend only returns sessionId

  // Step 2: Split and upload chunks
  const arrayBuffer = await audioBlob.arrayBuffer();
  const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, arrayBuffer.byteLength);
    const chunk = arrayBuffer.slice(start, end);
    const isLastChunk = i === totalChunks - 1;

    await uploadChunk(chunk, i, totalChunks, uploadSessionId, isLastChunk, options);

    // Small delay between chunks to avoid overwhelming server
    if (!isLastChunk) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Step 3: Finalize and get recording ID
  const result = await finalizeChunkedUploadSession(uploadSessionId);
  const finalRecordingId = result.id || result.recordingId || recordingId;

  return finalRecordingId;
}

/**
 * Resume a chunked upload session
 * 
 * Useful for resuming interrupted uploads
 * 
 * @param sessionId The session ID to resume
 * @param missingChunks List of chunk indices that need to be re-uploaded
 */
export async function resumeChunkedUpload(
  sessionId: string,
  missingChunks: number[]
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/recordings/chunked/resume`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        sessionId,
        missingChunks,
        timestamp: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ChunkedUploadError(
      error.message || 'Failed to resume upload',
      response.status
    );
  }
}

/**
 * Get status of a chunked upload session
 */
export async function getChunkedUploadStatus(
  sessionId: string
): Promise<{
  sessionId: string;
  status: 'active' | 'completed' | 'failed';
  totalChunks: number;
  chunksReceived: number;
  recordingId?: string;
  missingChunks?: number[];
}> {
  const response = await fetch(
    `${API_BASE_URL}/api/recordings/chunked/status/${sessionId}`,
    {
      method: 'GET',
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ChunkedUploadError(
      error.message || 'Failed to get upload status',
      response.status
    );
  }

  return response.json();
}

/**
 * Wait for recording completion via Server-Sent Events (SSE)
 * 
 * Replaces polling with real-time streaming updates from backend.
 * Much more efficient than polling.
 * 
 * @param recordingId The recording ID to wait for
 * @param options Options for waiting
 * @returns Complete recording result when processing is done
 * @throws Error if connection fails or processing fails
 */
export interface WaitForCompletionOptions {
  timeoutMs?: number; // Default: 30 minutes
  onProgress?: (data: any) => void;
  enableLogging?: boolean;
}

export function waitForCompletionViaSSE(
  recordingId: string,
  options: WaitForCompletionOptions = {}
): Promise<any> {

  const {
    timeoutMs = 30 * 60 * 1000, // 30 minutes
    onProgress,
    enableLogging = false,
  } = options;

  const log = (message: string, data?: any) => {
    if (enableLogging) {

    }
  };

  // 🔐 CRITICAL FIX: EventSource doesn't support custom headers
  // Must pass auth token as query parameter instead
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  
  log(`Token check: ${token ? 'Found' : 'MISSING - localStorage.accessToken is empty!'}`);

  const streamUrl = token 
    ? `${API_BASE_URL}/api/recordings/${recordingId}/stream?token=${encodeURIComponent(token)}`
    : `${API_BASE_URL}/api/recordings/${recordingId}/stream`;

  log(`SSE Stream URL: ${streamUrl.replace(/token=[^&]*/g, 'token=***')}`); // Log with masked token
  log(`Full URL (unmasked): ${streamUrl}`); // For debugging


  return new Promise((resolve, reject) => {
    let timeoutHandle: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;
    let resolved = false;

    // Set up timeout
    if (timeoutMs && timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          log('Timeout waiting for recording completion');
          
          if (eventSource) {
            eventSource.close();
          }
          
          timeoutHandle = null;
          reject(new Error('timeout: Processing took longer than expected'));
        }
      }, timeoutMs);
    }

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    try {
      log(`Connecting to SSE stream: ${streamUrl.replace(/token=[^&]*/g, 'token=***')}`);
      eventSource = new EventSource(streamUrl);

      // Log connection state changes
      const checkReadyState = () => {
        if (eventSource?.readyState === EventSource.CONNECTING) {
          log('EventSource state: CONNECTING');
        } else if (eventSource?.readyState === EventSource.OPEN) {
          log('EventSource state: OPEN');
        } else if (eventSource?.readyState === EventSource.CLOSED) {
          log('EventSource state: CLOSED');
        }
      };

      // Handle incoming messages
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          checkReadyState();
          log('🔔 RAW SSE event received');
          log('  Length:', event.data.length);
          log('  First 100 chars:', event.data.substring(0, 100));
          log('  Full raw data:', event.data);
          
          // Try to parse JSON
          let data: any;
          try {
            data = JSON.parse(event.data);
            log('✅ JSON parsed successfully');
          } catch (jsonError) {
            log('❌ JSON.parse failed:', jsonError);
            // Try alternative parsing
            if (event.data.includes('{') && event.data.includes('}')) {
              log('  Attempting to extract JSON from string...');
              const jsonMatch = event.data.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                data = JSON.parse(jsonMatch[0]);
                log('✅ Extracted and parsed JSON successfully');
              } else {
                throw new Error('Could not extract JSON from event data');
              }
            } else {
              throw jsonError;
            }
          }
          
          log(`📊 Received update: status=${data.status}`, data);
          log('  Data structure:', Object.keys(data));
          log('  Data types:', Object.entries(data).map(([k, v]) => `${k}: ${typeof v}`));

          // Call progress callback if provided
          try {
            onProgress?.(data);
            log('✅ Progress callback executed');
          } catch (cbError) {
            log('❌ Progress callback error:', cbError);
          }

          // Check for completion - handle multiple status variations
          const completeStatuses = ['completed', 'complete', 'success', 'done'];
          if (completeStatuses.includes(data.status)) {
            if (!resolved) {
              resolved = true;
              log('🎉 Recording completed successfully');
              log('  Status:', data.status);
              log('  Has analysis:', !!data.analysis);
              log('  Has transcription:', !!data.transcription);
              log('  Complete data object:', data);
              cleanup();
              resolve(data);
            }
          }
          // Check for failure
          else if (data.status === 'failed' || data.status === 'error') {
            if (!resolved) {
              resolved = true;
              log('❌ Recording processing failed:', data.error || data.message);
              cleanup();
              reject(new Error(data.error || data.message || 'Recording processing failed'));
            }
          }
          // Still processing - just log progress
          else {
            log(`⏳ Processing... status=${data.status}, progress=${data.progress || '?'}%`);
          }
        } catch (parseError) {
          if (!resolved) {
            resolved = true;
            log('❌ CRITICAL ERROR: Failed to process SSE message', parseError);
            log('  Raw event data that failed:', event.data);
            log('  Error details:', {
              name: parseError instanceof Error ? parseError.name : 'unknown',
              message: parseError instanceof Error ? parseError.message : String(parseError),
            });
            cleanup();
            reject(new Error(`Failed to parse server message: ${parseError}`));
          }
        }
      };

      // Handle connection state changes
      eventSource.onopen = (event: Event) => {
        log('✅ SSE connection OPENED');
        checkReadyState();
      };

      // Handle connection errors
      eventSource.onerror = (error: Event) => {
        if (!resolved) {
          resolved = true;
          
          checkReadyState();
          log('❌ SSE connection ERROR event');
          
          if (eventSource?.readyState === EventSource.CLOSED) {
            log('  State: CLOSED (connection was closed)');
            log('  Error object:', error);
            cleanup();
            reject(new Error('SSE connection closed by server'));
          } else {
            log('  State: CONNECTING or OPEN (connection issue)');
            log('  Error object:', error);
            cleanup();
            reject(new Error(`SSE connection error: ${error}`));
          }
        }
      };
    } catch (error) {
      if (!resolved) {
        resolved = true;
        log('❌ FAILED to create SSE connection', error);
        log('  Error details:', {
          name: error instanceof Error ? error.name : 'unknown',
          message: error instanceof Error ? error.message : String(error),
        });
        cleanup();
        reject(new Error(`Failed to establish SSE connection: ${error}`));
      }
    }
  });
}

/**
 * Check if browser supports EventSource (SSE)
 */
export function supportsSSE(): boolean {
  if (typeof window === 'undefined') {
    return false; // Server-side
  }
  return typeof EventSource !== 'undefined';
}

/**
 * Fallback polling for browsers that don't support SSE
 * 
 * Used as a fallback when EventSource is not available.
 * Polls the status endpoint until recording is complete.
 */
export async function pollForCompletion(
  recordingId: string,
  options: { enableLogging?: boolean; maxWaitMs?: number } = {}
): Promise<any> {
  const { enableLogging = false, maxWaitMs = 30 * 60 * 1000 } = options;
  const startTime = Date.now();

  const log = (message: string, data?: any) => {
    if (enableLogging) {

    }
  };

  let pollCount = 0;
  const maxPolls = Math.ceil(maxWaitMs / 5000); // 5-second poll interval

  while (true) {
    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed > maxWaitMs) {
      log('Polling timeout - max wait time exceeded');
      throw new Error('timeout: Processing took longer than expected');
    }

    pollCount++;

    try {
      const response = await fetch(`${API_BASE_URL}/api/recordings/${recordingId}`, {
        method: 'GET',
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      log(`Poll ${pollCount}: Status = ${result.status}`, result);

      if (result.status === 'completed') {
        log('Recording completed via polling');
        return result;
      } else if (result.status === 'failed') {
        log('Recording processing failed');
        throw new Error(result.error || 'Recording processing failed');
      }
      // Still processing - wait before next poll
      else {
        log(`Still processing... (poll ${pollCount}/${maxPolls})`);
        // Exponential backoff: 5s, 7s, 9s, 11s...
        const delayMs = 5000 + (pollCount * 500);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      log(`Poll ${pollCount} failed:`, error);
      
      // Don't fail on transient network errors - just retry
      if (pollCount < maxPolls) {
        // Wait before retrying
        const delayMs = 5000 + (pollCount * 500);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw new Error('polling: Max poll attempts reached');
      }
    }
  }
}

/**
 * Hybrid approach: Try SSE first, fall back to polling
 * 
 * Automatically uses SSE if supported, otherwise falls back to polling.
 * Provides the best of both worlds - efficiency on modern browsers,
 * compatibility with older ones.
 * 
 * @param recordingId The recording ID to wait for
 * @param options Options for waiting
 * @returns Complete recording result
 */
export async function waitForCompletionOptimized(
  recordingId: string,
  options: WaitForCompletionOptions = {}
): Promise<any> {
  // ALWAYS log entry to console, even if enableLogging is false

  const log = (message: string) => {
    if (options.enableLogging) {

    }
  };

  // Try SSE if supported
  if (supportsSSE()) {
    try {
      log('Attempting SSE connection...');

      return await waitForCompletionViaSSE(recordingId, options);
    } catch (error) {
      log(`SSE failed: ${error}. Falling back to polling.`);

      // Fall back to polling on SSE failure
      return await pollForCompletion(recordingId, options);
    }
  } else {
    // EventSource not supported, use fallback polling
    log('SSE not supported in this browser. Using polling.');

    return await pollForCompletion(recordingId, options);
  }
}
