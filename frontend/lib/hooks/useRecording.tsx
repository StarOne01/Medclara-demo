/**
 * Custom hook for managing audio recording functionality
 * Supports streaming chunks to backend during recording
 */

import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/toast';
import { audioBufferToWav, trimAudio } from '@/lib/audio-utilities';

export interface UseRecordingReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  recordedBlob: Blob | null;
  isPreviewing: boolean;
  showWaveformEditor: boolean;
  uploadSessionId: string | null;
  isStreamingChunks: boolean;

  // Actions
  startRecording: (options?: { streamChunks?: boolean; uploadSessionId?: string; metadata?: any }) => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  editFromPause: () => Promise<void>;
  discardRecording: () => void;
  setRecordedBlob: (blob: Blob | null) => void;
  setIsPreviewing: (value: boolean) => void;
  setShowWaveformEditor: (value: boolean) => void;
  cutAudio: (startTime: number, endTime: number) => Promise<void>;
}

/**
 * Hook to manage audio recording state and operations
 * Supports real-time chunk streaming during recording
 */
export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showWaveformEditor, setShowWaveformEditor] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [isStreamingChunks, setIsStreamingChunks] = useState(false);
  
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamingMetadataRef = useRef<any>(null);
  const chunkIndexRef = useRef(0);
  const { addToast } = useToast();

  const startRecording = useCallback(
    async (options?: { streamChunks?: boolean; uploadSessionId?: string; metadata?: any }) => {
      try {
        const shouldStream = options?.streamChunks || false;
        
        if (shouldStream) {
          setIsStreamingChunks(true);
          streamingMetadataRef.current = options?.metadata;
          chunkIndexRef.current = 0;
          
          // If no upload session provided, initialize one
          if (!options?.uploadSessionId) {
            try {
              const initResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recordings/chunked/init`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''}`,
                  },
                  body: JSON.stringify({
                    templateId: options?.metadata?.templateId || 'soap-general',
                    encounterId: options?.metadata?.encounterId,
                    patientId: options?.metadata?.patientId,
                    sessionId: options?.metadata?.sessionId,
                    timestamp: new Date().toISOString(),
                  }),
                }
              );
              
              if (initResponse.ok) {
                const initData = await initResponse.json();
                // backend now returns camelCase fields
                setUploadSessionId(initData.sessionId || initData.session_id);

              }
            } catch (error) {
              setIsStreamingChunks(false);
            }
          } else {
            setUploadSessionId(options.uploadSessionId);
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });

        const chunks: Blob[] = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
            
            // If streaming is enabled, send chunk to backend immediately
            if (shouldStream && uploadSessionId) {
              uploadChunkToBackend(event.data, chunkIndexRef.current, uploadSessionId);
              chunkIndexRef.current++;
            }
          }
        };

        recorder.onstop = async () => {
          // Stop all tracks
          stream.getTracks().forEach((track) => track.stop());

          // Create audio blob from all chunks
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });

          // If streaming, finalize the session
          if (shouldStream && uploadSessionId) {
            try {
              const finalizeResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recordings/chunked/finalize`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''}`,
                  },
                  body: JSON.stringify({
                    sessionId: uploadSessionId,
                    timestamp: new Date().toISOString(),
                  }),
                }
              );
              
              if (finalizeResponse.ok) {

              }
            } catch (error) {
            }
            
            setIsStreamingChunks(false);
            setUploadSessionId(null);
          }

          // Store blob for preview or further use
          setRecordedBlob(audioBlob);
          setIsPreviewing(true);

          // Reset recording state
          setRecordedChunks([]);
          setRecordingTime(0);
        };

        setMediaRecorder(recorder);
        setRecordedChunks(chunks);
        setIsRecording(true);

        // Start recording timer
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);

        // Collect data every 1 second
        recorder.start(1000);
      } catch (error) {
        setIsStreamingChunks(false);
        addToast({
          type: 'error',
          title: 'Microphone Error',
          message: 'Failed to start recording. Please check microphone permissions.',
        });
      }
    },
    [uploadSessionId, addToast]
  );

  /**
   * Upload a single chunk to backend during recording
   */
  const uploadChunkToBackend = useCallback(
    async (chunk: Blob, chunkIndex: number, sessionId: string) => {
      try {
        const formData = new FormData();
        formData.append('chunk', chunk, `chunk-${chunkIndex}`);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('sessionId', sessionId);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/recordings/chunked/upload`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          return;
        }

      } catch (error) {
      }
    },
    []
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setIsPaused(false);

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, [mediaRecorder]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [mediaRecorder]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);

      // Resume the timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  }, [mediaRecorder]);

  const editFromPause = useCallback(async () => {
    if (recordedChunks.length > 0 && recordingTime > 0) {
      try {
        // Create a blob from current chunks
        const currentBlob = new Blob(recordedChunks, { type: 'audio/webm' });

        // Cut the audio from the pause point (keep everything up to current time)
        const audioContext = new AudioContext();
        const arrayBuffer = await currentBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const sampleRate = audioBuffer.sampleRate;
        const endSample = Math.floor(recordingTime * sampleRate);

        const newBuffer = audioContext.createBuffer(
          audioBuffer.numberOfChannels,
          endSample,
          sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const oldData = audioBuffer.getChannelData(channel);
          const newData = newBuffer.getChannelData(channel);
          for (let i = 0; i < endSample; i++) {
            newData[i] = oldData[i];
          }
        }

        // Convert back to blob
        const wavBuffer = audioBufferToWav(newBuffer);
        const editedBlob = new Blob([wavBuffer], { type: 'audio/wav' });

        setRecordedBlob(editedBlob);
        setIsRecording(false);
        setIsPaused(false);
        setShowWaveformEditor(true); // Open the waveform editor

        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      } catch (error) {
      }
    }
  }, [recordedChunks, recordingTime]);

  const cutAudio = useCallback(
    async (startTime: number, endTime: number) => {
      if (!recordedBlob) return;

      try {
        const audioContext = new AudioContext();
        const arrayBuffer = await recordedBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const totalSamples = audioBuffer.length;

        // Calculate new buffer length: everything before selection + everything after selection
        const newLength = startSample + (totalSamples - endSample);
        const newBuffer = audioContext.createBuffer(
          audioBuffer.numberOfChannels,
          newLength,
          sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const oldData = audioBuffer.getChannelData(channel);
          const newData = newBuffer.getChannelData(channel);

          // Copy everything before the selection
          for (let i = 0; i < startSample; i++) {
            newData[i] = oldData[i];
          }

          // Copy everything after the selection
          for (let i = endSample; i < totalSamples; i++) {
            newData[startSample + (i - endSample)] = oldData[i];
          }
        }

        // Convert back to blob
        const wavBuffer = audioBufferToWav(newBuffer);
        const newBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        setRecordedBlob(newBlob);
      } catch (error) {
      }
    },
    [recordedBlob]
  );

  const discardRecording = useCallback(() => {
    setRecordedBlob(null);
    setIsPreviewing(false);
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    recordedBlob,
    isPreviewing,
    showWaveformEditor,
    uploadSessionId,
    isStreamingChunks,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    editFromPause,
    discardRecording,
    setRecordedBlob,
    setIsPreviewing,
    setShowWaveformEditor,
    cutAudio,
  };
}
