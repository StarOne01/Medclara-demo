import { useEffect, useState, useCallback } from 'react';
import { getApiClient, type Template } from '@/lib/api-client-unified';
import { getTemplateService, type TemplateFilterOptions } from '@/lib/template-service';

// Re-export Template for convenience
export type { Template };

export interface TemplateCategory {
  name: string;
  count: number;
  description?: string;
}

export interface UseTemplatesResult {
  templates: Template[];
  categories: TemplateCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getBySpecialty: (specialty: string) => Promise<Template[]>;
  search: (query: string) => Promise<Template[]>;
  getById: (id: string) => Promise<Template | null>;
  getByKey: (key: string) => Promise<Template | null>;
  filter: (options: TemplateFilterOptions) => Promise<Template[]>;
  getGroupedByCategory: () => Promise<Record<string, Template[]>>;
  getGroupedBySpecialty: () => Promise<Record<string, Template[]>>;
}

const defaultResult: UseTemplatesResult = {
  templates: [],
  categories: [],
  loading: true,
  error: null,
  refetch: async () => {},
  getBySpecialty: async () => [],
  search: async () => [],
  getById: async () => null,
  getByKey: async () => null,
  filter: async () => [],
  getGroupedByCategory: async () => ({}),
  getGroupedBySpecialty: async () => ({}),
};

export function useTemplates(): UseTemplatesResult {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const templateService = getTemplateService();

  // Check if user is authenticated
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');

  const fetchTemplates = useCallback(async (retry = 0) => {
    setLoading(true);
    setError(null);
    try {
      // Use template service to fetch with built-in caching and retry logic
      let fetchedTemplates = await templateService.getTemplates({
        activeOnly: true,
        limit: 100,
      });

      // FALLBACK: If list endpoint returns 0 templates, try search with wildcard
      // This handles backend API inconsistencies where list returns empty but search works
      if (!fetchedTemplates || fetchedTemplates.length === 0) {
        try {
          const searchResult = await templateService.search('*', 100);
          fetchedTemplates = searchResult.templates;
          if (fetchedTemplates.length > 0) {

          }
        } catch (searchErr) {
          // Continue with empty array
        }
      }

      // Map backend response - use template_key as-is, no derivation
      const mappedTemplates = fetchedTemplates.map((t: any) => {
        // Validate that template_key exists
        if (!t.template_key) {
        }

        // Extract timestamps from object format { Time: "...", Valid: true }
        let createdAt = t.createdAt || t.created_at;
        let updatedAt = t.updatedAt || t.updated_at;

        // If timestamps are objects, extract the Time field
        if (createdAt && typeof createdAt === 'object' && createdAt.Time) {
          createdAt = createdAt.Time;
        }
        if (updatedAt && typeof updatedAt === 'object' && updatedAt.Time) {
          updatedAt = updatedAt.Time;
        }

        return {
          ...t,
          // Ensure template_key is preserved exactly as backend sent it
          template_key: t.template_key,
          // Fix timestamps - extract from object if needed
          createdAt: createdAt,
          created_at: createdAt, // keep both for compatibility
          updatedAt: updatedAt,
          updated_at: updatedAt, // keep both for compatibility
          // prefer camelCase fields, fall back to snake_case
          isActive: typeof t.isActive !== 'undefined' ? t.isActive : (t.is_active !== false),
        };
      });

      setTemplates(mappedTemplates);

      // Fetch categories
      const fetchedCategories = await templateService.getCategories();
      setCategories(fetchedCategories);

      // Reset retry count on success
      setRetryCount(0);
      setLoading(false);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch templates';

      // Only retry on network errors or rate limiting, not on permanent errors
      const isRetryable = message.includes('429') || message.includes('timeout') || message.includes('fetch');

      if (isRetryable && retry < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, retry) * 1000;

        setTimeout(() => {
          setRetryCount(retry + 1);
          fetchTemplates(retry + 1);
        }, delayMs);
      } else {
        // Max retries exceeded or permanent error - stop trying
        setError(message);
        setLoading(false);
      }
    }
  }, [templateService]);

  useEffect(() => {
    // Only fetch if user is authenticated
    if (!isAuthenticated) {
      setLoading(false);
      setTemplates([]);
      setCategories([]);
      return;
    }

    fetchTemplates(0);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return {
    templates,
    categories,
    loading,
    error,
    refetch: async () => {
      setRetryCount(0);
      await fetchTemplates(0);
    },
    getBySpecialty: useCallback((specialty: string) => 
      templateService.getBySpecialty(specialty), [templateService]),
    search: useCallback((query: string) => 
      templateService.search(query).then(r => r.templates), [templateService]),
    getById: useCallback((id: string) => 
      templateService.getById(id), [templateService]),
    getByKey: useCallback((key: string) => 
      templateService.getByKey(key), [templateService]),
    filter: useCallback((options: TemplateFilterOptions) => 
      templateService.getTemplates(options), [templateService]),
    getGroupedByCategory: useCallback(() => 
      templateService.getGroupedByCategory(), [templateService]),
    getGroupedBySpecialty: useCallback(() => 
      templateService.getGroupedBySpecialty(), [templateService]),
  };
}

/**
 * Hook to fetch templates by specialty
 * Uses: GetTemplatesBySpecialtyHandler for optimized specialty filtering
 */
export function useTemplatesBySpecialty(specialty: string | null) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templateService = getTemplateService();
  
  // Check if user is authenticated
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');

  useEffect(() => {
    if (!specialty || !isAuthenticated) {
      setTemplates([]);
      return;
    }

    const fetchBySpecialty = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await templateService.getBySpecialty(specialty);
        setTemplates(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch templates';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchBySpecialty();
  }, [specialty, templateService, isAuthenticated]);

  return { templates, loading, error };
}

/**
 * Hook to search templates
 * Uses: SearchTemplatesHandler for full-text search across label, description, specialty
 * Implements debouncing to avoid excessive API calls
 */
export function useSearchTemplates(query: string, limit = 20) {
  const [results, setResults] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templateService = getTemplateService();
  
  // Check if user is authenticated
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');

  useEffect(() => {
    if (!query.trim() || !isAuthenticated) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await templateService.search(query, limit);
        setResults(res.templates);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search to avoid excessive API calls
    const debounceTimer = setTimeout(search, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, limit, templateService, isAuthenticated]);

  return { results, loading, error };
}

/**
 * Hook to get templates grouped by category
 * Uses: GetTemplateCategoriesHandler + GetTemplatesHandler with category filter
 */
export function useTemplatesByCategory() {
  const [grouped, setGrouped] = useState<Record<string, Template[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templateService = getTemplateService();
  
  // Check if user is authenticated
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');

  const fetch = useCallback(async () => {
    if (!isAuthenticated) {
      setGrouped({});
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await templateService.getGroupedByCategory();
      setGrouped(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to group templates';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [templateService, isAuthenticated]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { grouped, loading, error, refetch: fetch };
}
