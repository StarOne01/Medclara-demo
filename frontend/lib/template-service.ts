/**
 * Template Service
 * 
 * Comprehensive template management using all backend APIs:
 * - GetTemplateCategoriesHandler: Lists all categories with counts
 * - GetTemplatesHandler: Lists templates with optional filters (specialty/category)
 * - GetTemplateByKeyHandler: Get template by template_key (preferred for lookups)
 * - GetTemplateByIDHandler: Get template by UUID
 * - GetTemplatesBySpecialtyHandler: Filter by specialty
 * - SearchTemplatesHandler: Full-text search across label, description, specialty
 * 
 * This service optimizes template selection by caching, deduplication, and
 * providing filtered/searched results efficiently.
 */

import { getApiClient, type Template } from '@/lib/api-client-unified';
import { contentCache, CACHE_KEYS } from '@/lib/content-cache';

export interface TemplateCategory {
  name: string;
  count: number;
  description?: string;
}

export interface TemplateSearchResult {
  templates: Template[];
  total: number;
  query: string;
}

export interface TemplateFilterOptions {
  specialty?: string;
  category?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

class TemplateService {
  private client = getApiClient();
  private categoryCache: Map<string, TemplateCategory[]> = new Map();
  private templateCache: Map<string, Template> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all template categories with counts
   * Uses: GetTemplateCategoriesHandler
   */
  async getCategories(forceRefresh = false): Promise<TemplateCategory[]> {
    const cacheKey = 'template-categories';
    
    if (!forceRefresh && this.categoryCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && expiry > Date.now()) {
        return this.categoryCache.get(cacheKey)!;
      }
    }

    try {
      const response = await this.client.templates.getCategories();
      const categories = (response.categories || []).map((cat: any) => 
        typeof cat === 'string' ? { name: cat, count: 0 } : cat
      ) as TemplateCategory[];
      
      this.categoryCache.set(cacheKey, categories);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL_MS);
      
      return categories;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all templates with optional filters
   * Uses: GetTemplatesHandler with specialty/category query params
   */
  async getTemplates(options: TemplateFilterOptions = {}): Promise<Template[]> {
    const {
      specialty,
      category,
      activeOnly = true,
      limit = 100,
      offset = 0,
    } = options;

    const cacheKey = `templates-${specialty || ''}-${category || ''}-${activeOnly}`;
    
    if (this.templateCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && expiry > Date.now()) {
        const cached = Array.from(this.templateCache.values()).filter(t => {
          if (activeOnly && !t.is_active) return false;
          if (specialty && t.specialty !== specialty) return false;
          if (category && t.category !== category) return false;
          return true;
        });
        return cached.slice(offset, offset + limit);
      }
    }

    try {
      const response = await this.client.templates.list({
        specialty: specialty,
        category: category,
        active_only: activeOnly,
        limit,
        offset,
      });

      const templates = (response.templates || []) as Template[];
      
      // Cache individual templates
      templates.forEach(t => {
        this.templateCache.set(t.id, t);
        if (t.template_key) {
          this.templateCache.set(`key-${t.template_key}`, t);
        }
      });
      
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL_MS);
      
      return templates;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get templates by specialty
   * Uses: GetTemplatesBySpecialtyHandler - optimized query
   */
  async getBySpecialty(specialty: string): Promise<Template[]> {
    if (!specialty) return [];

    const cacheKey = `specialty-${specialty}`;
    
    if (this.templateCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && expiry > Date.now()) {
        return this.templateCache.get(cacheKey) as any;
      }
    }

    try {
      const response = await this.client.templates.getBySpecialty(specialty);
      const templates = (response.templates || []) as Template[];
      
      templates.forEach(t => {
        this.templateCache.set(t.id, t);
      });
      
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL_MS);
      
      return templates;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search templates by query
   * Uses: SearchTemplatesHandler - full-text search
   */
  async search(query: string, limit = 50): Promise<TemplateSearchResult> {
    if (!query.trim()) {
      return { templates: [], total: 0, query };
    }

    const cacheKey = `search-${query}`;
    
    if (this.templateCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && expiry > Date.now()) {
        const templates = this.templateCache.get(cacheKey) as any;
        return { templates, total: templates.length, query };
      }
    }

    try {
      const response = await this.client.templates.search(query, limit);
      const templates = (response.results || []) as Template[];
      
      templates.forEach(t => {
        this.templateCache.set(t.id, t);
      });
      
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL_MS);
      
      return { templates, total: templates.length, query };
    } catch (error) {
      return { templates: [], total: 0, query };
    }
  }

  /**
   * Get template by ID (UUID)
   * Uses: GetTemplateByIDHandler
   */
  async getById(templateId: string): Promise<Template | null> {
    if (!templateId) return null;

    // Check cache first
    if (this.templateCache.has(templateId)) {
      const expiry = this.cacheExpiry.get(templateId);
      if (expiry && expiry > Date.now()) {
        return this.templateCache.get(templateId)!;
      }
    }

    try {
      const template = await this.client.templates.get(templateId);
      
      this.templateCache.set(templateId, template);
      if (template.template_key) {
        this.templateCache.set(`key-${template.template_key}`, template);
      }
      this.cacheExpiry.set(templateId, Date.now() + this.CACHE_TTL_MS);
      
      return template;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get template by key (template_key string like "soap-general")
   * Uses: GetTemplateByKeyHandler - preferred for lookups by name
   */
  async getByKey(templateKey: string): Promise<Template | null> {
    if (!templateKey) return null;

    // Check cache first
    const cacheKey = `key-${templateKey}`;
    if (this.templateCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && expiry > Date.now()) {
        return this.templateCache.get(cacheKey)!;
      }
    }

    try {
      const template = await this.client.templates.getByKey(templateKey);
      
      this.templateCache.set(template.id, template);
      this.templateCache.set(cacheKey, template);
      this.cacheExpiry.set(template.id, Date.now() + this.CACHE_TTL_MS);
      
      return template;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get templates grouped by category
   * Uses: GetTemplatesHandler with category filter, called multiple times
   */
  async getGroupedByCategory(): Promise<Record<string, Template[]>> {
    try {
      const categories = await this.getCategories();
      const grouped: Record<string, Template[]> = {};
      
      // Fetch templates for each category in parallel
      const results = await Promise.all(
        categories.map(cat => 
          this.getTemplates({ category: cat.name })
            .then(templates => ({ category: cat.name, templates }))
        )
      );
      
      results.forEach(({ category, templates }) => {
        grouped[category] = templates;
      });
      
      return grouped;
    } catch (error) {
      return {};
    }
  }

  /**
   * Get templates grouped by specialty
   * Uses: GetTemplatesBySpecialtyHandler called for common specialties
   */
  async getGroupedBySpecialty(): Promise<Record<string, Template[]>> {
    try {
      const allTemplates = await this.getTemplates({ limit: 500 });
      const specialties = new Set<string>();
      
      // Collect unique specialties
      allTemplates.forEach(t => {
        if (t.specialty) specialties.add(t.specialty);
      });
      
      const grouped: Record<string, Template[]> = {};
      
      // Fetch templates for each specialty in parallel
      const results = await Promise.all(
        Array.from(specialties).map(specialty =>
          this.getBySpecialty(specialty)
            .then(templates => ({ specialty, templates }))
        )
      );
      
      results.forEach(({ specialty, templates }) => {
        grouped[specialty] = templates;
      });
      
      return grouped;
    } catch (error) {
      return {};
    }
  }

  /**
   * Resolve template ID or key to full template object
   * Tries ID first, then falls back to key lookup
   */
  async resolveTemplate(identifier: string): Promise<Template | null> {
    // Try as ID first
    let template = await this.getById(identifier);
    if (template) return template;
    
    // Try as key second
    template = await this.getByKey(identifier);
    if (template) return template;
    
    return null;
  }

  /**
   * Filter templates by multiple criteria
   */
  async filterTemplates(criteria: {
    query?: string;
    specialty?: string;
    category?: string;
    activeOnly?: boolean;
  }): Promise<Template[]> {
    // If query is provided, use search API
    if (criteria.query) {
      const results = await this.search(criteria.query);
      let templates = results.templates;
      
      // Apply additional filters
      if (criteria.specialty) {
        templates = templates.filter(t => t.specialty === criteria.specialty);
      }
      if (criteria.category) {
        templates = templates.filter(t => t.category === criteria.category);
      }
      if (criteria.activeOnly !== false) {
        templates = templates.filter(t => t.is_active !== false);
      }
      
      return templates;
    }
    
    // Otherwise use regular fetch with filters
    return this.getTemplates({
      specialty: criteria.specialty,
      category: criteria.category,
      activeOnly: criteria.activeOnly !== false,
      limit: 100,
    });
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.categoryCache.clear();
    this.templateCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Preload commonly used templates
   */
  async preloadCommonTemplates(): Promise<void> {
    try {
      // Fetch all templates to populate cache
      await this.getTemplates({ limit: 100 });
      // Fetch categories
      await this.getCategories();
    } catch (error) {
    }
  }
}

// Create singleton instance
let instance: TemplateService | null = null;

export function getTemplateService(): TemplateService {
  if (!instance) {
    instance = new TemplateService();
  }
  return instance;
}

export function createTemplateService(): TemplateService {
  return new TemplateService();
}
