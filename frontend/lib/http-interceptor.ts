/**
 * HTTP Request/Response Interceptor System
 * 
 * Provides centralized request/response logging, monitoring, and middleware
 */

export type RequestInterceptor = (request: FetchRequest) => FetchRequest | Promise<FetchRequest>;
export type ResponseInterceptor = (response: FetchResponse) => FetchResponse | Promise<FetchResponse>;
export type ErrorInterceptor = (error: Error) => Error | Promise<Error>;

export interface FetchRequest {
  url: string;
  options: RequestInit;
  timestamp: number;
}

export interface FetchResponse {
  response: Response;
  responseTime: number;
  timestamp: number;
}

export interface InterceptorConfig {
  enableDetailedLogging?: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
  trackMetrics?: boolean;
  excludePatterns?: RegExp[];
}

/**
 * Central interceptor manager for API calls
 */
export class HttpInterceptorManager {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private metrics: {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    statusCounts: Record<number, number>;
  } = {
    totalRequests: 0,
    totalErrors: 0,
    averageResponseTime: 0,
    statusCounts: {},
  };
  private config: InterceptorConfig;

  constructor(config: InterceptorConfig = {}) {
    this.config = {
      enableDetailedLogging: false,
      logRequests: true,
      logResponses: true,
      trackMetrics: true,
      excludePatterns: [],
      ...config,
    };
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Check if URL should be excluded from logging
   */
  private shouldExclude(url: string): boolean {
    return this.config.excludePatterns?.some((pattern) => pattern.test(url)) ?? false;
  }

  /**
   * Execute request interceptors
   */
  async executeRequestInterceptors(request: FetchRequest): Promise<FetchRequest> {
    let modifiedRequest = request;

    for (const interceptor of this.requestInterceptors) {
      modifiedRequest = await interceptor(modifiedRequest);
    }

    // Log request
    if (this.config.logRequests && !this.shouldExclude(request.url)) {
      this.logRequest(modifiedRequest);
    }

    return modifiedRequest;
  }

  /**
   * Execute response interceptors
   */
  async executeResponseInterceptors(response: FetchResponse): Promise<FetchResponse> {
    let modifiedResponse = response;

    for (const interceptor of this.responseInterceptors) {
      modifiedResponse = await interceptor(modifiedResponse);
    }

    // Log response
    if (this.config.logResponses && !this.shouldExclude(response.response.url)) {
      this.logResponse(modifiedResponse);
    }

    // Track metrics
    if (this.config.trackMetrics) {
      this.trackResponseMetrics(modifiedResponse);
    }

    return modifiedResponse;
  }

  /**
   * Execute error interceptors
   */
  async executeErrorInterceptors(error: Error): Promise<Error> {
    let modifiedError = error;

    for (const interceptor of this.errorInterceptors) {
      modifiedError = await interceptor(modifiedError);
    }

    // Track error
    if (this.config.trackMetrics) {
      this.metrics.totalErrors++;
    }

    return modifiedError;
  }

  /**
   * Log request details
   */
  private logRequest(request: FetchRequest): void {
    const { method = 'GET' } = request.options;
  }

  /**
   * Log response details
   */
  private logResponse(response: FetchResponse): void {
    const { status, url } = response.response;
    const isError = status >= 400;
  }

  /**
   * Track response metrics
   */
  private trackResponseMetrics(response: FetchResponse): void {
    const { status } = response.response;

    this.metrics.totalRequests++;
    this.metrics.statusCounts[status] = (this.metrics.statusCounts[status] ?? 0) + 1;

    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) +
      response.responseTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      statusCounts: {},
    };
  }

  /**
   * Clear all interceptors
   */
  clear(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }
}

/**
 * Create built-in request interceptors
 */
export const createRequestInterceptors = {
  /**
   * Add request timing
   */
  addTiming: (): RequestInterceptor => {
    return async (request: FetchRequest) => {
      return {
        ...request,
        timestamp: Date.now(),
      };
    };
  },

  /**
   * Add request ID for tracing
   */
  addRequestId: (): RequestInterceptor => {
    return async (request: FetchRequest) => {
      const requestId = crypto.randomUUID?.() ?? `req-${Date.now()}`;
      const options = {
        ...request.options,
        headers: {
          ...request.options.headers,
          'X-Request-Id': requestId,
        },
      };
      return { ...request, options };
    };
  },

  /**
   * Add authorization header
   */
  addAuth: (getToken: () => string | null): RequestInterceptor => {
    return async (request: FetchRequest) => {
      const token = getToken();
      if (!token) return request;

      const options = {
        ...request.options,
        headers: {
          ...request.options.headers,
          'Authorization': `Bearer ${token}`,
        },
      };
      return { ...request, options };
    };
  },

  /**
   * Add custom headers
   */
  addHeaders: (headers: Record<string, string>): RequestInterceptor => {
    return async (request: FetchRequest) => {
      const options = {
        ...request.options,
        headers: {
          ...request.options.headers,
          ...headers,
        },
      };
      return { ...request, options };
    };
  },

  /**
   * Log request details
   */
  logDetails: (includeBody: boolean = false): RequestInterceptor => {
    return async (request: FetchRequest) => {

      return request;
    };
  },
};

/**
 * Create built-in response interceptors
 */
export const createResponseInterceptors = {
  /**
   * Add response timing
   */
  addTiming: (): ResponseInterceptor => {
    return async (response: FetchResponse) => {
      return {
        ...response,
        timestamp: Date.now(),
      };
    };
  },

  /**
   * Extract request ID from response headers
   */
  extractRequestId: (): ResponseInterceptor => {
    return async (response: FetchResponse) => {
      const requestId = response.response.headers.get('x-request-id');
      return response;
    };
  },

  /**
   * Log response details
   */
  logDetails: (includeHeaders: boolean = false): ResponseInterceptor => {
    return async (response: FetchResponse) => {

      return response;
    };
  },
};

/**
 * Create built-in error interceptors
 */
export const createErrorInterceptors = {
  /**
   * Log error details
   */
  logDetails: (): ErrorInterceptor => {
    return async (error: Error) => {
      return error;
    };
  },

  /**
   * Handle authentication errors globally
   */
  handleAuthErrors: (onAuthError: () => void): ErrorInterceptor => {
    return async (error: Error) => {
      if (error instanceof Error && error.message.includes('401')) {
        onAuthError();
      }
      return error;
    };
  },
};

// Global interceptor instance
let globalInterceptorManager: HttpInterceptorManager | null = null;

/**
 * Initialize global interceptor manager
 */
export function initializeInterceptors(config?: InterceptorConfig): HttpInterceptorManager {
  globalInterceptorManager = new HttpInterceptorManager(config);
  return globalInterceptorManager;
}

/**
 * Get global interceptor manager
 */
export function getInterceptorManager(): HttpInterceptorManager {
  if (!globalInterceptorManager) {
    globalInterceptorManager = new HttpInterceptorManager();
  }
  return globalInterceptorManager;
}
