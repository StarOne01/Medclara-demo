'use client';

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getApiClient } from "@/lib/api-client-unified";
import { useToast } from "@/components/toast";

export default function ScribeRoute() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const maxAttempts = 3;

  useEffect(() => {
    if (loading) return;
    
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Create a new session via backend (backend generates the session_id)
    const createSession = async (attempt = 0) => {
      // Prevent infinite loops - max 3 attempts
      if (attempt > maxAttempts) {
        addToast({
          type: 'error',
          title: 'Session Error',
          message: 'Failed to create scribe session after multiple attempts. Please refresh the page.'
        });
        setIsCreatingSession(false);
        return;
      }

      try {
        setIsCreatingSession(true);
        
        const client = getApiClient();
        
        // First, get the current user to ensure authentication is working

        const currentUser = await client.auth.getCurrentUser();

        // Fetch available templates to get a valid template ID from the backend

        const templatesRes = await client.templates.list({ active_only: true, limit: 1 });
        const firstTemplate = templatesRes.templates?.[0];
        
        if (!firstTemplate) {
          throw new Error('No templates available on backend');
        }
        
        // Now create the session with the actual template ID from backend

        const response = await client.sessions.create(firstTemplate.id);
        const sessionId = response.sessionId;

        // Store session ID and navigate to it
        sessionStorage.setItem('scribe_session_id', sessionId);
        router.push(`/scribe/${sessionId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Check if error is retryable (network, rate limit, etc)
        const isRetryable = 
          errorMessage.includes('429') || 
          errorMessage.includes('timeout') || 
          errorMessage.includes('fetch') ||
          errorMessage.includes('Rate limit');
        
        if (isRetryable && attempt < maxAttempts) {
          // Wait exponentially before retrying: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000;

          setTimeout(() => {
            setAttemptCount(attempt + 1);
            createSession(attempt + 1);
          }, delayMs);
        } else {
          // Not retryable or max attempts reached
          addToast({
            type: 'error',
            title: 'Session Error',
            message: `Failed to create scribe session: ${errorMessage}`
          });
          setIsCreatingSession(false);
        }
      }
    };

    createSession(0);
  }, [router, loading, isAuthenticated, addToast]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />
        <p className="text-sm text-slate-600 dark:text-zinc-400">Initializing scribe session...</p>
      </div>
    </div>
  );
}
