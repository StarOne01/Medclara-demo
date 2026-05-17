/**
 * API Error Boundary Component
 * 
 * Catches and displays API errors in a user-friendly way
 * Provides error recovery and logging
 */

'use client';

import React, { ReactNode, ReactElement } from 'react';
import { ApiResponseError, isAuthenticationError, isPermissionError, isValidationError, getErrorMessageForStatus, formatRateLimitReset, isRateLimitError } from '@/lib/api-response-handler';
import { AlertCircle, RefreshCw, LogOut, Lock, AlertTriangle } from 'lucide-react';

export interface ApiErrorBoundaryProps {
  children: ReactNode;
  onAuthError?: () => void;
  onError?: (error: ApiResponseError) => void;
  fallback?: (error: ApiResponseError, retry: () => void) => ReactNode;
  hideDetails?: boolean;
}

export interface ApiErrorBoundaryState {
  error: ApiResponseError | null;
  hasError: boolean;
  errorCount: number;
}

/**
 * Error boundary class component for API errors
 */
export class ApiErrorBoundary extends React.Component<ApiErrorBoundaryProps, ApiErrorBoundaryState> {
  constructor(props: ApiErrorBoundaryProps) {
    super(props);
    this.state = {
      error: null,
      hasError: false,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ApiErrorBoundaryState> {
    if (error instanceof ApiResponseError) {
      return {
        error,
        hasError: true,
      };
    }
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (error instanceof ApiResponseError) {
      // Increment error count for circuit breaker pattern
      this.setState((prev) => ({
        errorCount: prev.errorCount + 1,
      }));

      // Call custom error handler
      this.props.onError?.(error);

      // Handle authentication errors
      if (isAuthenticationError(error)) {
        this.props.onAuthError?.();
      }
    } else {
    }
  }

  retry = () => {
    this.setState({
      error: null,
      hasError: false,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const error = this.state.error;

    if (error && this.props.fallback) {
      return this.props.fallback(error, this.retry);
    }

    return <ApiErrorDisplay error={error} onRetry={this.retry} hideDetails={this.props.hideDetails} />;
  }
}

/**
 * Default error display component
 */
export function ApiErrorDisplay({
  error,
  onRetry,
  hideDetails = false,
}: {
  error: ApiResponseError | null;
  onRetry: () => void;
  hideDetails?: boolean;
}): ReactElement {
  if (!error) {
    return <div />;
  }

  const { title, userMessage } = getErrorMessageForStatus(error.statusCode, error.errorCode);
  const isAuth = isAuthenticationError(error);
  const isPermission = isPermissionError(error);
  const isValidation = isValidationError(error);
  const isRateLimit = isRateLimitError(error);

  const getIcon = () => {
    if (isAuth) return <LogOut className="w-5 h-5" />;
    if (isPermission) return <Lock className="w-5 h-5" />;
    if (isValidation) return <AlertTriangle className="w-5 h-5" />;
    return <AlertCircle className="w-5 h-5" />;
  };

  const getColor = () => {
    if (isAuth || isPermission) return 'border-red-200 bg-red-50';
    if (isValidation) return 'border-yellow-200 bg-yellow-50';
    if (isRateLimit) return 'border-orange-200 bg-orange-50';
    return 'border-red-200 bg-red-50';
  };

  const getIconColor = () => {
    if (isAuth || isPermission) return 'text-red-600';
    if (isValidation) return 'text-yellow-600';
    if (isRateLimit) return 'text-orange-600';
    return 'text-red-600';
  };

  const getTextColor = () => {
    if (isAuth || isPermission) return 'text-red-900';
    if (isValidation) return 'text-yellow-900';
    if (isRateLimit) return 'text-orange-900';
    return 'text-red-900';
  };

  return (
    <div className={`border rounded-lg p-4 ${getColor()}`}>
      <div className="flex gap-3">
        <div className={`flex-shrink-0 mt-0.5 ${getIconColor()}`}>{getIcon()}</div>
        <div className="flex-1">
          <h3 className={`font-semibold ${getTextColor()}`}>{title}</h3>
          <p className={`text-sm mt-1 ${getTextColor()}`}>{userMessage}</p>

          {/* Validation errors */}
          {isValidation && error.validationErrors && (
            <ul className={`text-sm mt-2 space-y-1 ${getTextColor()}`}>
              {Object.entries(error.validationErrors).map(([field, message]) => (
                <li key={field} className="ml-4">
                  • <strong>{field}</strong>: {message}
                </li>
              ))}
            </ul>
          )}

          {/* Rate limit info */}
          {isRateLimit && error.rateLimitInfo.reset && (
            <p className={`text-sm mt-2 ${getTextColor()}`}>
              Try again in {formatRateLimitReset(error.rateLimitInfo.reset)}.
            </p>
          )}

          {/* Debug info */}
          {!hideDetails && error.requestId && (
            <p className={`text-xs mt-3 opacity-75 font-mono ${getTextColor()}`}>
              Request ID: {error.requestId}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            {!isAuth && !isPermission && (
              <button
                onClick={onRetry}
                className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded border transition-colors ${
                  isValidation
                    ? 'border-yellow-300 bg-yellow-100 text-yellow-900 hover:bg-yellow-200'
                    : isRateLimit
                    ? 'border-orange-300 bg-orange-100 text-orange-900 hover:bg-orange-200'
                    : 'border-red-300 bg-red-100 text-red-900 hover:bg-red-200'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}
            {isAuth && (
              <a
                href="/login"
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded border border-red-300 bg-red-100 text-red-900 hover:bg-red-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Go to Login
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for handling API errors in components
 */
export function useApiErrorHandler() {
  const [error, setError] = React.useState<ApiResponseError | null>(null);

  const handleError = (err: unknown) => {
    if (err instanceof ApiResponseError) {
      setError(err);
      return;
    }
    if (err instanceof Error) {
    }
  };

  const clearError = () => setError(null);

  return {
    error,
    setError,
    handleError,
    clearError,
    isAuthError: error ? isAuthenticationError(error) : false,
    isPermissionError: error ? isPermissionError(error) : false,
    isValidationError: error ? isValidationError(error) : false,
  };
}

/**
 * Hook for form validation errors
 */
export function useFormErrorHandler() {
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const handleError = (err: unknown) => {
    if (err instanceof ApiResponseError && isValidationError(err) && err.validationErrors) {
      setFieldErrors(err.validationErrors);
      return true;
    }
    return false;
  };

  const clearError = (field?: string) => {
    if (field) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    } else {
      setFieldErrors({});
    }
  };

  const hasErrors = Object.keys(fieldErrors).length > 0;

  return {
    fieldErrors,
    handleError,
    clearError,
    hasErrors,
    getFieldError: (field: string) => fieldErrors[field],
  };
}
