/**
 * Content Cache Management
 * Handles fetching and caching of dynamic content from backend
 * Provides in-memory and localStorage caching with TTL support
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  etag?: string;
}

interface CacheConfig {
  key: string;
  ttl: number; // milliseconds
}

const CACHE_CONFIG: Record<string, CacheConfig> = {
  TEMPLATES: {
    key: 'medclara_cache_templates',
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },
  TEMPLATE_UUIDS: {
    key: 'medclara_cache_template_uuids',
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },
  LANDING_CONTENT: {
    key: 'medclara_cache_landing_content',
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },
  WORKSPACE_TABS: {
    key: 'medclara_cache_workspace_tabs',
    ttl: 12 * 60 * 60 * 1000, // 12 hours
  },
  ERROR_MESSAGES: {
    key: 'medclara_cache_error_messages',
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

/**
 * Request deduplication to prevent multiple simultaneous API calls for same data
 */
const pendingRequests = new Map<string, Promise<any>>();

/**
 * ContentCache manages caching of API responses with TTL support
 * Implements two-tier caching: in-memory (fast) + localStorage (persistent)
 */
export class ContentCache {
  private static instance: ContentCache;
  private inMemoryCache = new Map<string, CacheEntry<any>>();

  /**
   * Get singleton instance
   */
  static getInstance(): ContentCache {
    if (!ContentCache.instance) {
      ContentCache.instance = new ContentCache();
    }
    return ContentCache.instance;
  }

  /**
   * Check if cache entry has expired based on TTL
   */
  private isExpired(entry: CacheEntry<any>, ttlMs: number): boolean {
    return Date.now() - entry.timestamp > ttlMs;
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      if (typeof window === 'undefined') return false;
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get data from cache or fetch from API
   * Uses request deduplication to prevent multiple simultaneous API calls
   *
   * @param cacheKey - Unique key for the cache entry
   * @param fetcher - Async function that fetches the data
   * @param ttlMs - Optional TTL override (defaults to config)
   * @returns The cached or freshly fetched data
   */
  async getOrFetch<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    // Return pending request if one is already in-flight
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey)!;
    }

    // Check in-memory cache first
    if (this.inMemoryCache.has(cacheKey)) {
      const entry = this.inMemoryCache.get(cacheKey)!;
      const config = this.getCacheConfig(cacheKey);
      const effectiveTtl = ttlMs ?? config?.ttl ?? 60 * 60 * 1000; // Default 1 hour

      if (!this.isExpired(entry, effectiveTtl)) {
        return entry.data as T;
      }
    }

    // Check localStorage
    if (this.isLocalStorageAvailable()) {
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          const entry: CacheEntry<any> = JSON.parse(stored);
          const config = this.getCacheConfig(cacheKey);
          const effectiveTtl = ttlMs ?? config?.ttl ?? 60 * 60 * 1000;

          if (!this.isExpired(entry, effectiveTtl)) {
            // Promote to in-memory cache
            this.inMemoryCache.set(cacheKey, entry);
            return entry.data as T;
          }
        }
      } catch (error) {
      }
    }

    // Fetch from API with deduplication
    const fetchPromise = (async () => {
      try {
        const data = await fetcher();

        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          version: `v1-${Date.now()}`,
        };

        // Store in in-memory cache
        this.inMemoryCache.set(cacheKey, entry as any);

        // Store in localStorage
        if (this.isLocalStorageAvailable()) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(entry));
          } catch (error) {
          }
        }

        return data;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Get cache configuration by key
   */
  private getCacheConfig(cacheKey: string): CacheConfig | null {
    for (const config of Object.values(CACHE_CONFIG)) {
      if (config.key === cacheKey) {
        return config;
      }
    }
    return null;
  }

  /**
   * Manually invalidate a cache entry
   */
  invalidate(cacheKey: string): void {
    this.inMemoryCache.delete(cacheKey);
    if (this.isLocalStorageAvailable()) {
      try {
        localStorage.removeItem(cacheKey);
      } catch (error) {
      }
    }
  }

  /**
   * Clear all cached content
   */
  clear(): void {
    this.inMemoryCache.clear();
    if (this.isLocalStorageAvailable()) {
      Object.values(CACHE_CONFIG).forEach(config => {
        try {
          localStorage.removeItem(config.key);
        } catch (error) {
        }
      });
    }
  }

  /**
   * Get cache statistics (for debugging/monitoring)
   */
  getStats(): {
    inMemorySize: number;
    cacheKeys: string[];
  } {
    return {
      inMemorySize: this.inMemoryCache.size,
      cacheKeys: Array.from(this.inMemoryCache.keys()),
    };
  }
}

// Export singleton instance
export const contentCache = ContentCache.getInstance();

// Export cache configuration keys for use in components
export const CACHE_KEYS = {
  TEMPLATES: CACHE_CONFIG.TEMPLATES.key,
  TEMPLATE_UUIDS: CACHE_CONFIG.TEMPLATE_UUIDS.key,
  LANDING_CONTENT: CACHE_CONFIG.LANDING_CONTENT.key,
  WORKSPACE_TABS: CACHE_CONFIG.WORKSPACE_TABS.key,
  ERROR_MESSAGES: CACHE_CONFIG.ERROR_MESSAGES.key,
};
