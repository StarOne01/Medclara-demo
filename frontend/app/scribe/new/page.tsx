'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getApiClient } from '@/lib/api-client-unified';
import { useToast } from '@/components/toast';

function ScribeNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const maxAttempts = 3;

  // Get patientId from query parameters
  const patientId = searchParams.get('patientId');

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Validate patientId format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!patientId || !uuidRegex.test(patientId)) {
      addToast({
        type: 'error',
        title: 'Invalid Patient',
        message: 'No valid patient selected. Redirecting to patients list.',
      });
      // Redirect to patients page after a short delay to show the toast
      setTimeout(() => router.push('/patients'), 1500);
      return;
    }

    // Create a new session with the patient ID
    const createSessionWithPatient = async (attempt = 0) => {
      // Prevent infinite loops - max 3 attempts
      if (attempt > maxAttempts) {
        addToast({
          type: 'error',
          title: 'Session Error',
          message: 'Failed to create scribe session after multiple attempts. Please refresh the page.',
        });
        setIsProcessing(false);
        return;
      }

      try {
        setIsProcessing(true);

        const client = getApiClient();

        // Verify current user is authenticated

        const currentUser = await client.auth.getCurrentUser();

        // Fetch available templates to get a valid template ID from the backend

        const templatesRes = await client.templates.list({ active_only: true, limit: 1 });
        const firstTemplate = templatesRes.templates?.[0];

        if (!firstTemplate) {
          throw new Error('No templates available on backend');
        }

        // Create the session with the template ID

        const response = await client.sessions.create(firstTemplate.id);
        const sessionId = response.sessionId;

        // Store session ID in sessionStorage
        sessionStorage.setItem('scribe_session_id', sessionId);

        // Navigate to the scribe session page with patient ID in query params
        router.push(`/scribe/${sessionId}?patientId=${patientId}`);
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
            createSessionWithPatient(attempt + 1);
          }, delayMs);
        } else {
          // Not retryable or max attempts reached
          addToast({
            type: 'error',
            title: 'Session Error',
            message: `Failed to create scribe session: ${errorMessage}`,
          });
          setIsProcessing(false);
        }
      }
    };

    createSessionWithPatient(0);
  }, [router, loading, isAuthenticated, patientId, addToast]);

  return (
    <div className="flex h-screen items-center justify-center bg-[color:var(--color-background)]">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--border-subtle)] border-t-[color:var(--text-primary)] dark:border-[color:var(--border-subtle)] dark:border-t-white" />
        <p className="text-sm text-[color:var(--text-secondary)]">
          Initializing scribe session for patient...
        </p>
        {patientId && (
          <p className="text-xs text-[color:var(--text-tertiary)] mt-2 font-mono">{patientId}</p>
        )}
      </div>
    </div>
  );
}

export default function ScribeNewRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[color:var(--color-background)]">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--border-subtle)] border-t-[color:var(--text-primary)]" />
            <p className="text-sm text-[color:var(--text-secondary)]">Loading...</p>
          </div>
        </div>
      }
    >
      <ScribeNewContent />
    </Suspense>
  );
}
