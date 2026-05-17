/**
 * Custom hook for optimized chunked audio recording upload
 * 
 * This hook enables streaming audio data to the backend as chunks are collected,
 * reducing latency between recording completion and note generation.
 * 
 * Benefits:
 * - Processes audio in real-time as data arrives
 * - Reduces total time-to-note-generation
 * - Enables progressive transcription
 * - Better network resilience with smaller chunks
 * - Allows backend to start processing while recording continues
 */

import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/toast';

export interface ChunkedUploadConfig {
  /** Size of each audio chunk in bytes (default: 256KB) */
  chunkSize?: number;
  
  /** Maximum time between chunks in milliseconds (default: 2000ms) */
  chunkTimeInterval?: number;
  
  /** Enable detailed logging for debugging */
  enableLogging?: boolean;
  
  /** Called when a chunk is successfully uploaded */
  onChunkUploaded?: (chunkIndex: number, totalChunks: number) => void;
  
  /** Called when upload progress changes */
  onProgressChange?: (progress: number) => void;
  
  /** Called when upload session starts (returns sessionId) */
  onSessionStarted?: (sessionId: string) => void;
}

export interface UseChunkedRecordingUploadReturn {
  // State
  isUploading: boolean;
  uploadProgress: number;
  uploadSessionId: string | null;
  totalChunksSent: number;
  
  // Actions
  startChunkedUpload: (
    audioBlob: Blob,
    metadata: {
      templateId?: string;
      encounterId?: string;
      patientId?: string;
      sessionId?: string;
    }
  ) => Promise<string>; // Returns upload session ID
  
  cancelChunkedUpload: () => void;
  
  uploadCompleteAudio: (audioBlob: Blob, metadata: any) => Promise<string>;
  
  /** Resume a failed chunked upload by identifying and retrying missing chunks */
  resumeChunkedUpload: (
    sessionId: string,
    audioBlob: Blob,
    totalChunks: number
  ) => Promise<string>;
}

/**
 * Hook to manage chunked audio upload with progress tracking
 */
export function useChunkedRecordingUpload(
  config: ChunkedUploadConfig = {}
): UseChunkedRecordingUploadReturn {
  const {
    chunkSize = 256 * 1024, // 256KB default
    chunkTimeInterval = 2000, // 2 seconds default
    enableLogging = false,
    onChunkUploaded,
    onProgressChange,
    onSessionStarted,
  } = config;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [totalChunksSent, setTotalChunksSent] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { addToast } = useToast();

  const log = useCallback(
    (message: string, data?: any) => {
      if (enableLogging) {

      }
    },
    [enableLogging]
  );

  /**
   * Initialize a chunked upload session with the backend
   * Returns a session ID that will be used for all chunks
   */
  const initializeChunkedSession = useCallback(
    async (metadata: any): Promise<string> => {
      try {
        log('Initializing chunked upload session', metadata);
        
        // Call backend to initialize session
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recordings/chunked/init`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(typeof window !== 'undefined'
                ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
                : {}),
            },
            body: JSON.stringify({
              templateId: metadata.templateId || 'soap-general',
              encounterId: metadata.encounterId,
              patientId: metadata.patientId,
              sessionId: metadata.sessionId,
              timestamp: new Date().toISOString(),
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to initialize session: ${response.statusText}`);
        }

  const data = await response.json();
  // backend now returns camelCase keys (sessionId)
  const sessionId = data.sessionId || data.session_id;

  log('Chunked session initialized', { sessionId });
  setUploadSessionId(sessionId);
  onSessionStarted?.(sessionId);

  return sessionId;
      } catch (error) {
        log('Failed to initialize session', error);
        throw new Error(`Session initialization failed: ${error}`);
      }
    },
    [log, onSessionStarted]
  );

  /**
   * Upload a single audio chunk with retry logic
   */
  const uploadChunkWithRetry = useCallback(
    async (
      chunk: ArrayBuffer,
      chunkIndex: number,
      totalChunks: number,
      sessionId: string,
      isLastChunk: boolean
    ): Promise<void> => {
      const maxRetries = 3;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          log(`Uploading chunk ${chunkIndex + 1}/${totalChunks}`, {
            size: `${(chunk.byteLength / 1024).toFixed(2)}KB`,
            isLastChunk,
            attempt: retryCount + 1,
          });

          const formData = new FormData();
          formData.append('chunk', new Blob([chunk], { type: 'application/octet-stream' }));
          formData.append('chunkIndex', chunkIndex.toString());
          formData.append('totalChunks', totalChunks.toString());
          formData.append('isLastChunk', isLastChunk.toString());
          formData.append('sessionId', sessionId);

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recordings/chunked/upload`,
            {
              method: 'POST',
              headers: {
                ...(typeof window !== 'undefined'
                  ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
                  : {}),
              },
              body: formData,
              signal: abortControllerRef.current?.signal,
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.message || 'Upload failed'}`);
          }

          const result = await response.json();
          log(`✅ Chunk ${chunkIndex + 1} uploaded successfully`, result);

          // Update progress
          const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
          setUploadProgress(progress);
          onProgressChange?.(progress);
          onChunkUploaded?.(chunkIndex, totalChunks);

          setTotalChunksSent((prev) => prev + 1);
          return; // Success - exit retry loop
        } catch (error) {
          retryCount++;
          log(`Chunk ${chunkIndex + 1} upload attempt ${retryCount} failed:`, error);

          if (error instanceof Error && error.name === 'AbortError') {
            log('Chunk upload cancelled');
            throw error;
          }

          if (retryCount <= maxRetries) {
            // Exponential backoff: 1s, 2s, 4s, 8s
            const delayMs = Math.pow(2, retryCount - 1) * 1000;
            log(`Retrying in ${delayMs}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            // All retries exhausted
            const errorMsg = `Failed to upload chunk ${chunkIndex + 1} after ${maxRetries} attempts`;
            log(errorMsg);
            throw new Error(errorMsg);
          }
        }
      }
    },
    [log, onChunkUploaded, onProgressChange]
  );

  /**
   * Finalize the chunked upload session
   * This signals to backend that all chunks have been sent and processing should begin
   */
  const finalizeChunkedSession = useCallback(
    async (sessionId: string): Promise<{ id: string; status: string }> => {
      try {
        log('Finalizing chunked upload session', { sessionId });

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recordings/chunked/finalize`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(typeof window !== 'undefined'
                ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
                : {}),
            },
            body: JSON.stringify({
              sessionId,
              timestamp: new Date().toISOString(),
            }),
            signal: abortControllerRef.current?.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to finalize session: ${response.statusText}`);
        }

        const result = await response.json();
        log('Chunked session finalized', result);
        
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          log('Finalization cancelled');
          throw error;
        }
        throw new Error(`Failed to finalize session: ${error}`);
      }
    },
    [log]
  );

  /**
   * Check session progress and identify missing chunks
   * Used for resuming failed uploads
   */
  const getSessionProgress = useCallback(
    async (sessionId: string): Promise<{ chunksReceived: number; lastChunkIndex: number }> => {
      try {
        log('Checking session progress', { sessionId });

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recordings/chunked/status/${sessionId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(typeof window !== 'undefined'
                ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
                : {}),
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to get session progress: ${response.statusText}`);
        }

        const result = await response.json();
        log('Session progress retrieved', result);

        // backend now returns camelCase keys
        return {
          chunksReceived: typeof result.chunksReceived !== 'undefined' ? result.chunksReceived : (result.chunks_received || 0),
          lastChunkIndex: typeof result.lastChunkIndexReceived !== 'undefined' ? result.lastChunkIndexReceived : (result.last_chunk_index_received || -1),
        };
      } catch (error) {
        log('Failed to get session progress', error);
        throw error;
      }
    },
    [log]
  );

  /**
   * Resume a failed chunked upload by retrying missing chunks
   * Identifies which chunks were not received and resends them
   */
  const resumeChunkedUpload = useCallback(
    async (
      sessionId: string,
      audioBlob: Blob,
      totalChunks: number
    ): Promise<string> => {
      abortControllerRef.current = new AbortController();
      setIsUploading(true);

      try {
        log('Resuming chunked upload', { sessionId, totalChunks });

        // Step 1: Check which chunks were already received
        const progress = await getSessionProgress(sessionId);
        log('Session progress', progress);

        // Step 2: Read audio blob as array buffer
        const arrayBuffer = await audioBlob.arrayBuffer();

        // Step 3: Identify missing chunks
        const uploadedChunks = new Set<number>();
        for (let i = 0; i <= progress.lastChunkIndex; i++) {
          uploadedChunks.add(i);
        }

        const missingChunks: number[] = [];
        for (let i = 0; i < totalChunks; i++) {
          if (!uploadedChunks.has(i)) {
            missingChunks.push(i);
          }
        }

        log('Missing chunks identified', { missingChunks, count: missingChunks.length });

        if (missingChunks.length === 0) {
          log('No missing chunks - finalizing session directly');
          const result = await finalizeChunkedSession(sessionId);
          return result.id || sessionId;
        }

        // Step 4: Retry uploading missing chunks
        let retryCount = 0;
        const maxRetries = 3;

        for (const chunkIndex of missingChunks) {
          let success = false;
          retryCount = 0;

          while (!success && retryCount < maxRetries) {
            try {
              const start = chunkIndex * chunkSize;
              const end = Math.min(start + chunkSize, arrayBuffer.byteLength);
              const chunk = arrayBuffer.slice(start, end);
              const isLastChunk = chunkIndex === totalChunks - 1;

              log(`Retrying missing chunk ${chunkIndex + 1}/${totalChunks} (attempt ${retryCount + 1})`);
              
              await uploadChunkWithRetry(chunk, chunkIndex, totalChunks, sessionId, isLastChunk);
              success = true;

              // Update progress
              const currentProgress = Math.round(((progress.chunksReceived + missingChunks.indexOf(chunkIndex) + 1) / totalChunks) * 100);
              setUploadProgress(currentProgress);
              onProgressChange?.(currentProgress);

              // Small delay between chunks
              if (!isLastChunk) {
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            } catch (error) {
              retryCount++;
              log(`Retry ${retryCount} failed for chunk ${chunkIndex + 1}`, error);

              if (retryCount < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s
                const delayMs = Math.pow(2, retryCount - 1) * 1000;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
              } else {
                throw new Error(`Failed to upload chunk ${chunkIndex + 1} after ${maxRetries} retries`);
              }
            }
          }
        }

        log(`All ${missingChunks.length} missing chunks retried successfully`);

        // Step 5: Finalize upload session
        const result = await finalizeChunkedSession(sessionId);

        addToast({
          type: 'success',
          title: 'Upload Resumed',
          message: `Resumed and completed upload. ${missingChunks.length} chunks retried.`,
        });

        return result.id || sessionId;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Resume failed';
        log('Chunked upload resume failed', error);

        addToast({
          type: 'error',
          title: 'Resume Failed',
          message: errorMessage,
        });

        throw error;
      } finally {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    },
    [
      chunkSize,
      log,
      uploadChunkWithRetry,
      finalizeChunkedSession,
      getSessionProgress,
      onProgressChange,
      addToast,
    ]
  );

  /**
   * Start chunked upload of audio blob
   * This is the main entry point for uploading audio in chunks
   */
  const startChunkedUpload = useCallback(
    async (
      audioBlob: Blob,
      metadata: {
        templateId?: string;
        encounterId?: string;
        patientId?: string;
        sessionId?: string;
      }
    ): Promise<string> => {
      abortControllerRef.current = new AbortController();
      setIsUploading(true);
      setUploadProgress(0);
      setTotalChunksSent(0);

      try {
        log('Starting chunked upload', {
          audioSize: `${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`,
          chunkSize: `${(chunkSize / 1024).toFixed(0)}KB`,
        });

        // Step 1: Initialize upload session
        const sessionId = await initializeChunkedSession(metadata);

        // Step 2: Read audio blob as array buffer
        const arrayBuffer = await audioBlob.arrayBuffer();

        // Step 3: Split into chunks and upload
        const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize);
        log(`Audio will be split into ${totalChunks} chunks`);

        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, arrayBuffer.byteLength);
          const chunk = arrayBuffer.slice(start, end);
          const isLastChunk = i === totalChunks - 1;

          await uploadChunkWithRetry(chunk, i, totalChunks, sessionId, isLastChunk);

          // Small delay between chunks to avoid overwhelming server
          if (!isLastChunk) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // Step 4: Finalize upload session
        const result = await finalizeChunkedSession(sessionId);

        log('Chunked upload completed successfully', result);

        addToast({
          type: 'success',
          title: 'Upload Complete',
          message: `Uploaded ${totalChunks} chunks. Processing started.`,
        });

        return result.id || sessionId;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        log('Chunked upload failed', error);

        addToast({
          type: 'error',
          title: 'Upload Failed',
          message: errorMessage,
        });

        throw error;
      } finally {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    },
    [
      chunkSize,
      log,
      initializeChunkedSession,
      uploadChunkWithRetry,
      finalizeChunkedSession,
      addToast,
    ]
  );

  /**
   * Cancel an ongoing upload
   */
  const cancelChunkedUpload = useCallback(() => {
    log('Cancelling chunked upload');
    abortControllerRef.current?.abort();
    setIsUploading(false);
    setUploadProgress(0);
  }, [log]);

  /**
   * Fallback method: upload complete audio as single blob
   * Used when chunked upload is not applicable or as fallback
   */
  const uploadCompleteAudio = useCallback(
    async (
      audioBlob: Blob,
      metadata: any
    ): Promise<string> => {
      setIsUploading(true);
      setUploadProgress(0);

      try {
        log('Uploading complete audio (non-chunked)', {
          size: `${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`,
        });

        const formData = new FormData();
        formData.append('audio', audioBlob, `recording-${Date.now()}.webm`);
        formData.append('templateId', metadata.templateId || 'soap-general');

        if (metadata.encounterId) {
          formData.append('encounterId', metadata.encounterId);
        }
        if (metadata.patientId) {
          formData.append('patientId', metadata.patientId);
        }
        if (metadata.sessionId) {
          formData.append('sessionId', metadata.sessionId);
        }

        const token =
          typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recordings/upload`,
          {
            method: 'POST',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
            signal: abortControllerRef.current?.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        setUploadProgress(100);

        log('Complete audio uploaded successfully', result);

        return result.id;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        log('Complete audio upload failed', error);

        addToast({
          type: 'error',
          title: 'Upload Failed',
          message: errorMessage,
        });

        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [log, addToast]
  );

  return {
    isUploading,
    uploadProgress,
    uploadSessionId,
    totalChunksSent,
    startChunkedUpload,
    cancelChunkedUpload,
    uploadCompleteAudio,
    resumeChunkedUpload,
  };
}
