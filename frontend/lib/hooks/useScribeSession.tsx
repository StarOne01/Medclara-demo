/**
 * Custom hook for managing scribe session initialization and state
 */

import { useState, useEffect, useRef } from 'react';
import { getApiClient } from '@/lib/api-client-unified';
import { useToast } from '@/components/toast';
import type { NoteTemplate } from '@/lib/note-templates';

export interface UseScribeSessionOptions {
  sessionIdFromUrl?: string;
  selectedTemplate: NoteTemplate;
}

export interface UseScribeSessionReturn {
  scribeSessionId: string | null;
  currentNoteId: string | null;
  sessionCreationFailed: boolean;
  setCurrentNoteId: (id: string | null) => void;
}

/**
 * Hook to initialize and manage a scribe session
 */
export function useScribeSession({
  sessionIdFromUrl,
  selectedTemplate,
}: UseScribeSessionOptions): UseScribeSessionReturn {
  const [scribeSessionId, setScribeSessionId] = useState<string | null>(
    sessionIdFromUrl || null
  );
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [sessionCreationFailed, setSessionCreationFailed] = useState(false);
  const sessionInitializingRef = useRef<boolean>(false);
  const { addToast } = useToast();

  useEffect(() => {
    let active = true;

    const initializeSession = async () => {
      // CRITICAL: Check if already initializing (prevents race conditions)
      if (sessionInitializingRef.current) {

        return;
      }

      // If we already have a session ID in state, don't create a new one
      if (scribeSessionId) {

        return;
      }

      // If sessionId is provided from URL, we assume it's already been created
      if (sessionIdFromUrl) {
        setScribeSessionId(sessionIdFromUrl);
        sessionStorage.setItem('scribe_session_id', sessionIdFromUrl);

        return;
      }

      // Otherwise, check if we already have a session ID in sessionStorage
      const existingSessionId = sessionStorage.getItem('scribe_session_id');
      const existingNoteId = sessionStorage.getItem('activeNoteId');

      let sessionId: string;

      if (existingSessionId) {
        // We have an existing session, use it
        sessionId = existingSessionId;

        if (active) {
          setScribeSessionId(sessionId);
        }
      } else {
        // Set the ref to prevent concurrent attempts
        sessionInitializingRef.current = true;

        // Create a new session via backend - backend will generate the session_id
        try {

          const client = getApiClient();
          const response = await client.sessions.create(selectedTemplate);
          sessionId = response.sessionId;
          sessionStorage.setItem('scribe_session_id', sessionId);

          if (active) {
            setScribeSessionId(sessionId);
            setSessionCreationFailed(false);
          }
        } catch (error) {
          if (active) {
            setSessionCreationFailed(true);
          }
          addToast({
            type: 'error',
            title: 'Session Error',
            message: 'Failed to initialize scribe session. Please refresh the page.',
          });
          return;
        } finally {
          // Always clear the flag, even on error
          sessionInitializingRef.current = false;
        }
      }

      // Restore note ID if available
      if (existingNoteId) {
        setCurrentNoteId(existingNoteId);

      }
    };

    initializeSession();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromUrl]);

  return {
    scribeSessionId,
    currentNoteId,
    sessionCreationFailed,
    setCurrentNoteId,
  };
}
