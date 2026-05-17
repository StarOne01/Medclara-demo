/**
 * API Response Handler
 * 
 * Provides comprehensive handling for GIN backend responses including:
 * - Status code mapping to user-friendly messages
 * - Request ID tracking for debugging
 * - Response time monitoring
 * - Rate limit handling
 * - Error parsing and logging
 */

/**
 * API Error with detailed context
 */
export class ApiResponseError extends Error {
  public readonly requestId: string | undefined;
  public readonly statusCode: number;
  public readonly errorCode: string | undefined;
  public readonly validationErrors: Record<string, string> | undefined;
  public readonly responseTime: number;
  public readonly retryable: boolean;
  public readonly rateLimitInfo: {
    limit?: number;
    remaining?: number;
    reset?: number;
  } = {};

  constructor(
    message: string,
    statusCode: number,
    options: {
      requestId?: string;
      errorCode?: string;
      validationErrors?: Record<string, string>;
      responseTime?: number;
      retryable?: boolean;
      rateLimitInfo?: typeof ApiResponseError.prototype.rateLimitInfo;
    } = {}
  ) {
    super(message);
    this.name = 'ApiResponseError';
    this.statusCode = statusCode;
    this.requestId = options.requestId;
    this.errorCode = options.errorCode;
    this.validationErrors = options.validationErrors;
    this.responseTime = options.responseTime ?? 0;
    this.retryable = options.retryable ?? false;
    if (options.rateLimitInfo) {
      this.rateLimitInfo = options.rateLimitInfo;
    }

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ApiResponseError.prototype);
  }
}

/**
 * Response context extracted from fetch response
 */
export interface ResponseContext {
  statusCode: number;
  contentType: string | null;
  requestId: string | undefined;
  responseTime: number;
  rateLimitInfo: {
    limit?: number;
    remaining?: number;
    reset?: number;
  };
}

/**
 * Extract context from fetch response headers
 */
export function extractResponseContext(response: Response, responseTime: number): ResponseContext {
  const contentType = response.headers.get('content-type');
  const requestId = response.headers.get('x-request-id') ?? undefined;
  
  const rateLimitInfo = {
    limit: response.headers.get('x-ratelimit-limit')
      ? parseInt(response.headers.get('x-ratelimit-limit')!, 10)
      : undefined,
    remaining: response.headers.get('x-ratelimit-remaining')
      ? parseInt(response.headers.get('x-ratelimit-remaining')!, 10)
      : undefined,
    reset: response.headers.get('x-ratelimit-reset')
      ? parseInt(response.headers.get('x-ratelimit-reset')!, 10)
      : undefined,
  };

  return {
    statusCode: response.status,
    contentType,
    requestId,
    responseTime,
    rateLimitInfo,
  };
}

/**
 * Parse response body as JSON, with fallback to empty object
 */
export async function parseResponseBody(
  response: Response,
  context: ResponseContext
): Promise<any> {
  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  // Try to parse as JSON
  if (context.contentType?.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  // Try to get text
  try {
    const text = await response.text();
    return text || null;
  } catch (error) {
    return null;
  }
}

/**
 * Map HTTP status codes to user-friendly messages
 */
export function getErrorMessageForStatus(statusCode: number, errorCode?: string): {
  title: string;
  message: string;
  userMessage: string;
} {
  const baseMessages: Record<number, { title: string; message: string; userMessage: string }> = {
    // 4xx Client Errors
    400: {
      title: 'Invalid Request',
      message: 'The request contained invalid data',
      userMessage: 'Please check your input and try again.',
    },
    401: {
      title: 'Authentication Required',
      message: 'Invalid or missing authentication token',
      userMessage: 'Your session has expired. Please log in again.',
    },
    403: {
      title: 'Permission Denied',
      message: 'You do not have permission to access this resource',
      userMessage: 'You don\'t have permission to perform this action.',
    },
    404: {
      title: 'Not Found',
      message: 'The requested resource does not exist',
      userMessage: 'The resource you\'re looking for doesn\'t exist.',
    },
    409: {
      title: 'Conflict',
      message: 'The request conflicts with existing data',
      userMessage: 'This resource has been modified. Please refresh and try again.',
    },
    429: {
      title: 'Rate Limited',
      message: 'Too many requests',
      userMessage: 'You\'ve made too many requests. Please wait a moment and try again.',
    },
    422: {
      title: 'Validation Failed',
      message: 'The request data failed validation',
      userMessage: 'Please check the highlighted fields and try again.',
    },

    // 5xx Server Errors
    500: {
      title: 'Server Error',
      message: 'An unexpected server error occurred',
      userMessage: 'Something went wrong on our end. Please try again later.',
    },
    502: {
      title: 'Bad Gateway',
      message: 'The server received an invalid response',
      userMessage: 'Service temporarily unavailable. Please try again in a moment.',
    },
    503: {
      title: 'Service Unavailable',
      message: 'The server is temporarily unavailable',
      userMessage: 'We\'re experiencing technical difficulties. Please try again soon.',
    },
    504: {
      title: 'Gateway Timeout',
      message: 'The server took too long to respond',
      userMessage: 'Request took too long. Please try again.',
    },

    // 0 = Network error
    0: {
      title: 'Network Error',
      message: 'Failed to connect to the server',
      userMessage: 'Unable to reach the server. Check your connection and try again.',
    },
  };

  return baseMessages[statusCode] || {
    title: 'Error',
    message: `HTTP ${statusCode}`,
    userMessage: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(statusCode: number): boolean {
  // Retryable status codes
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return retryableStatuses.includes(statusCode);
}

/**
 * Create an error from response
 */
export async function createErrorFromResponse(
  response: Response,
  responseTime: number
): Promise<ApiResponseError> {
  const context = extractResponseContext(response, responseTime);
  const body = await parseResponseBody(response, context);

  const errorCode = body?.error || body?.code;
  const validationErrors = body?.details || body?.errors || body?.validation_errors;
  const errorMessage = body?.message || body?.error_message || '';

  const { title, userMessage } = getErrorMessageForStatus(response.status, errorCode);
  const displayMessage = errorMessage || userMessage;

  const error = new ApiResponseError(displayMessage, response.status, {
    requestId: context.requestId,
    errorCode,
    validationErrors: typeof validationErrors === 'object' ? validationErrors : undefined,
    responseTime: context.responseTime,
    retryable: isRetryableError(response.status),
    rateLimitInfo: context.rateLimitInfo,
  });

  return error;
}

/**
 * Log successful response
 */
export function logSuccessResponse(
  statusCode: number,
  url: string,
  responseTime: number,
  requestId?: string
): void {
  // Don't log 204 No Content or OPTIONS requests as verbose
  if (statusCode === 204 || statusCode === 200) {
  }

  // Warn if response is slow
  if (responseTime > 2000) {
  }
}

/**
 * Extract header value safely
 */
export function getHeader(response: Response, headerName: string): string | null {
  return response.headers.get(headerName);
}

/**
 * Check if response indicates authentication failure
 */
export function isAuthenticationError(error: ApiResponseError): boolean {
  return error.statusCode === 401;
}

/**
 * Check if response indicates permission error
 */
export function isPermissionError(error: ApiResponseError): boolean {
  return error.statusCode === 403;
}

/**
 * Check if response indicates validation error
 */
export function isValidationError(error: ApiResponseError): boolean {
  return error.statusCode === 400 || error.statusCode === 422;
}

/**
 * Check if response indicates not found
 */
export function isNotFoundError(error: ApiResponseError): boolean {
  return error.statusCode === 404;
}

/**
 * Check if response indicates rate limiting
 */
export function isRateLimitError(error: ApiResponseError): boolean {
  return error.statusCode === 429;
}

/**
 * Get human-readable rate limit reset time
 */
export function formatRateLimitReset(resetTimestamp: number): string {
  const resetDate = new Date(resetTimestamp * 1000);
  const now = new Date();
  const diffSeconds = Math.ceil((resetDate.getTime() - now.getTime()) / 1000);

  if (diffSeconds <= 0) return 'now';
  if (diffSeconds < 60) return `${diffSeconds} second${diffSeconds === 1 ? '' : 's'}`;
  if (diffSeconds < 3600) {
    const minutes = Math.ceil(diffSeconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return resetDate.toLocaleTimeString();
}

/**
 * Response handler options
 */
export interface ResponseHandlerOptions {
  enableLogging?: boolean;
  logSlowRequests?: boolean;
  slowRequestThreshold?: number; // milliseconds
}

/**
 * Main response handler function
 */
export async function handleApiResponse<T>(
  response: Response,
  responseTime: number,
  options: ResponseHandlerOptions = {}
): Promise<T> {
  const {
    enableLogging = true,
    logSlowRequests = true,
    slowRequestThreshold = 2000,
  } = options;

  const context = extractResponseContext(response, responseTime);

  // Check for errors
  if (!response.ok) {
    const error = await createErrorFromResponse(response, responseTime);
    throw error;
  }

  // Log successful response
  if (enableLogging) {
    logSuccessResponse(response.status, response.url, responseTime, context.requestId);
  }

  // Warn about slow requests
  if (logSlowRequests && responseTime > slowRequestThreshold) {
  }

  // Parse and return body
  const body = await parseResponseBody(response, context);
  return body as T;
}
