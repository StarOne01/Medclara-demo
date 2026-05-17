/**
 * Custom Hooks for Common API Patterns
 * 
 * Provides hooks for:
 * - Handling API responses and errors
 * - Managing loading states
 * - Tracking request metrics
 * - Parsing validation errors
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiResponseError, isValidationError, isRetryableError } from '@/lib/api-response-handler';

/**
 * Hook for async API calls with loading and error states
 */
export function useApiCall<T, E = ApiResponseError>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const execute = useCallback(async (apiFunction: () => Promise<T>) => {
    setIsLoading(true);
    setError(null);
    setIsError(false);

    try {
      const result = await apiFunction();
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      const error = err as E;
      setError(error);
      setIsError(true);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsError(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    isError,
    execute,
    reset,
  };
}

/**
 * Hook for managing form submission with API calls
 */
export function useApiForm<T, FormData = any>(
  submitFunction: (data: FormData) => Promise<T>,
  onSuccess?: (data: T) => void,
  onError?: (error: ApiResponseError) => void
) {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiResponseError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState(false);

  const submit = useCallback(
    async (data: FormData) => {
      setIsSubmitting(true);
      setError(null);
      setFieldErrors({});
      setValidationError(false);
      setFormData(data);

      try {
        const result = await submitFunction(data);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const apiError = err instanceof ApiResponseError ? err : new ApiResponseError(
          err instanceof Error ? err.message : 'Unknown error',
          0
        );

        setError(apiError);
        
        // Extract field errors from validation error
        if (isValidationError(apiError) && apiError.validationErrors) {
          setFieldErrors(apiError.validationErrors);
          setValidationError(true);
        }

        onError?.(apiError);
        throw apiError;
      } finally {
        setIsSubmitting(false);
      }
    },
    [submitFunction, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setFormData(null);
    setError(null);
    setFieldErrors({});
    setValidationError(false);
  }, []);

  const getFieldError = useCallback((fieldName: string): string | undefined => {
    return fieldErrors[fieldName];
  }, [fieldErrors]);

  const clearFieldError = useCallback((fieldName: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  }, []);

  return {
    formData,
    isSubmitting,
    error,
    fieldErrors,
    validationError,
    submit,
    reset,
    getFieldError,
    clearFieldError,
  };
}

/**
 * Hook for polling/retry logic with exponential backoff
 */
export interface UseApiRetryOptions {
  maxRetries?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  backoffMultiplier?: number;
  shouldRetry?: (error: ApiResponseError) => boolean;
  onRetry?: (attemptNumber: number, error: ApiResponseError) => void;
}

export function useApiRetry<T>(options: UseApiRetryOptions = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = (error) => isRetryableError(error.statusCode),
    onRetry,
  } = options;

  const [attempts, setAttempts] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const execute = useCallback(
    async (apiFunction: () => Promise<T>): Promise<T> => {
      let lastError: ApiResponseError | undefined;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          setAttempts(attempt + 1);
          const result = await apiFunction();
          setAttempts(0);
          return result;
        } catch (err) {
          lastError = err instanceof ApiResponseError ? err : undefined;

          if (!lastError || !shouldRetry(lastError)) {
            throw err;
          }

          attempt++;
          if (attempt < maxRetries) {
            // Calculate delay with exponential backoff
            const delay = Math.min(
              baseDelay * Math.pow(backoffMultiplier, attempt - 1),
              maxDelay
            );

            setIsRetrying(true);
            onRetry?.(attempt, lastError);

            // Wait before retrying
            await new Promise((resolve) => {
              timeoutRef.current = setTimeout(resolve, delay);
            });
          }
        }
      }

      setAttempts(0);
      setIsRetrying(false);

      if (lastError) {
        throw lastError;
      }

      throw new ApiResponseError('Max retries exceeded', 0);
    },
    [maxRetries, baseDelay, maxDelay, backoffMultiplier, shouldRetry, onRetry]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return {
    execute,
    attempts,
    isRetrying,
    cancel,
  };
}

/**
 * Hook for debouncing API calls
 */
export function useApiDebounce<T, Args extends any[]>(
  apiFunction: (...args: Args) => Promise<T>,
  delayMs: number = 500
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiResponseError | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const execute = useCallback(
    (...args: Args) => {
      setIsLoading(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      return new Promise<T>((resolve, reject) => {
        timeoutRef.current = setTimeout(async () => {
          try {
            const result = await apiFunction(...args);
            setData(result);
            setError(null);
            resolve(result);
          } catch (err) {
            const error = err instanceof ApiResponseError ? err : new ApiResponseError(
              err instanceof Error ? err.message : 'Unknown error',
              0
            );
            setError(error);
            setIsLoading(false);
            reject(error);
          }
        }, delayMs);
      });
    },
    [apiFunction, delayMs]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return {
    data,
    isLoading,
    error,
    execute,
    cancel,
  };
}

/**
 * Hook for tracking API metrics and performance
 */
export interface ApiMetrics {
  totalRequests: number;
  totalErrors: number;
  successRate: number;
  averageResponseTime: number;
  slowestRequest: number;
  fastestRequest: number;
  statusCodes: Record<number, number>;
}

export function useApiMetrics() {
  const [metrics, setMetrics] = useState<ApiMetrics>({
    totalRequests: 0,
    totalErrors: 0,
    successRate: 0,
    averageResponseTime: 0,
    slowestRequest: 0,
    fastestRequest: Infinity,
    statusCodes: {},
  });

  const recordRequest = useCallback(
    (statusCode: number, responseTime: number) => {
      setMetrics((prev) => {
        const totalRequests = prev.totalRequests + 1;
        const isError = statusCode >= 400;
        const totalErrors = prev.totalErrors + (isError ? 1 : 0);
        const successRate = ((totalRequests - totalErrors) / totalRequests) * 100;

        return {
          totalRequests,
          totalErrors,
          successRate,
          averageResponseTime:
            (prev.averageResponseTime * prev.totalRequests + responseTime) / totalRequests,
          slowestRequest: Math.max(prev.slowestRequest, responseTime),
          fastestRequest: Math.min(prev.fastestRequest, responseTime),
          statusCodes: {
            ...prev.statusCodes,
            [statusCode]: (prev.statusCodes[statusCode] ?? 0) + 1,
          },
        };
      });
    },
    []
  );

  const reset = useCallback(() => {
    setMetrics({
      totalRequests: 0,
      totalErrors: 0,
      successRate: 0,
      averageResponseTime: 0,
      slowestRequest: 0,
      fastestRequest: Infinity,
      statusCodes: {},
    });
  }, []);

  return {
    metrics,
    recordRequest,
    reset,
  };
}

/**
 * Hook for circuit breaker pattern (prevent cascading failures)
 */
export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening
  resetTimeout?: number; // Milliseconds before attempting to close
  onStateChange?: (state: 'closed' | 'open' | 'half-open') => void;
}

export function useCircuitBreaker(options: CircuitBreakerOptions = {}) {
  const {
    failureThreshold = 5,
    resetTimeout = 60000,
    onStateChange,
  } = options;

  const [state, setState] = useState<'closed' | 'open' | 'half-open'>('closed');
  const [failureCount, setFailureCount] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const recordSuccess = useCallback(() => {
    setFailureCount(0);
    if (state !== 'closed') {
      setState('closed');
      onStateChange?.('closed');
    }
  }, [state, onStateChange]);

  const recordFailure = useCallback(() => {
    const newCount = failureCount + 1;
    setFailureCount(newCount);

    if (newCount >= failureThreshold && state === 'closed') {
      setState('open');
      onStateChange?.('open');

      // Schedule half-open transition
      timeoutRef.current = setTimeout(() => {
        setState('half-open');
        onStateChange?.('half-open');
      }, resetTimeout);
    }
  }, [failureCount, failureThreshold, state, resetTimeout, onStateChange]);

  const canAttempt = useCallback(() => {
    return state === 'closed' || state === 'half-open';
  }, [state]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState('closed');
    setFailureCount(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    failureCount,
    canAttempt,
    recordSuccess,
    recordFailure,
    reset,
  };
}
