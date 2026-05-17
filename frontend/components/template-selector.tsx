/**
 * Advanced Template Selector Component
 * 
 * Features:
 * - Category-based filtering using GetTemplateCategoriesHandler
 * - Specialty-based filtering using GetTemplatesBySpecialtyHandler
 * - Full-text search using SearchTemplatesHandler
 * - Template preview with metadata
 * - Favorite templates with localStorage persistence
 * - Recently used templates tracking
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Star, Clock, Filter, ChevronDown } from 'lucide-react';
import type { Template } from '@/lib/api-client-unified';
import { useTemplates, useSearchTemplates, useTemplatesBySpecialty } from '@/lib/hooks/useTemplates';

interface TemplateSelectorProps {
  selectedTemplateId?: string | null;
  onSelect: (template: Template) => void;
  onClose?: () => void;
  show: boolean;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelect,
  onClose,
  show,
}: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterSpecialty, setFilterSpecialty] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load favorites and recently used from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('template-favorites');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
    const savedRecent = localStorage.getItem('template-recently-used');
    if (savedRecent) {
      setRecentlyUsed(JSON.parse(savedRecent));
    }
  }, []);

  // Fetch templates and categories
  const {
    templates,
    categories,
    loading: templatesLoading,
    search,
    getBySpecialty,
    filter,
    getGroupedByCategory,
  } = useTemplates();

  // Search results
  const {
    results: searchResults,
    loading: searchLoading,
  } = useSearchTemplates(searchQuery, 50);

  // Specialty filtered results
  const {
    templates: specialtyTemplates,
    loading: specialtyLoading,
  } = useTemplatesBySpecialty(filterSpecialty);

  // Determine which templates to display based on filters
  const displayedTemplates = useMemo(() => {
    let result = templates;

    // Apply search filter (highest priority)
    if (searchQuery.trim()) {
      result = searchResults;
    }

    // Apply specialty filter
    if (filterSpecialty && !searchQuery.trim()) {
      result = specialtyTemplates;
    }

    // Apply category filter
    if (filterCategory && !searchQuery.trim() && !filterSpecialty) {
      result = result.filter(t => t.category === filterCategory);
    }

    // Sort: favorites first, then recently used, then others
    return result.sort((a, b) => {
      const aIsFavorite = favorites.has(a.id);
      const bIsFavorite = favorites.has(b.id);
      
      if (aIsFavorite !== bIsFavorite) {
        return aIsFavorite ? -1 : 1;
      }

      const aIsRecent = recentlyUsed.includes(a.id);
      const bIsRecent = recentlyUsed.includes(b.id);
      
      if (aIsRecent !== bIsRecent) {
        return aIsRecent ? -1 : 1;
      }

      return 0;
    });
  }, [
    templates,
    searchResults,
    specialtyTemplates,
    filterCategory,
    filterSpecialty,
    searchQuery,
    favorites,
    recentlyUsed,
  ]);

  const handleSelectTemplate = useCallback((template: Template) => {
    // Add to recently used
    const updated = [template.id, ...recentlyUsed.filter(id => id !== template.id)].slice(0, 10);
    setRecentlyUsed(updated);
    localStorage.setItem('template-recently-used', JSON.stringify(updated));

    onSelect(template);
  }, [recentlyUsed, onSelect]);

  const handleToggleFavorite = useCallback((templateId: string) => {
    const updated = new Set(favorites);
    if (updated.has(templateId)) {
      updated.delete(templateId);
    } else {
      updated.add(templateId);
    }
    setFavorites(updated);
    localStorage.setItem('template-favorites', JSON.stringify(Array.from(updated)));
  }, [favorites]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterCategory(null);
    setFilterSpecialty(null);
  }, []);

  const hasActiveFilters = searchQuery || filterCategory || filterSpecialty;

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[color:var(--surface-base)] rounded-xl shadow-lg border border-[color:var(--border-subtle)] w-full max-w-2xl max-h-96 flex flex-col"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-subtle)]">
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Select Template</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[color:var(--surface-card)] rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="p-4 space-y-3 border-b border-[color:var(--border-subtle)]">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-[color:var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search templates by name, description, or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
              />
            </div>

            {/* Filters Toggle and Category/Specialty Selectors */}
            <div className="flex gap-2 items-center flex-wrap">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] transition"
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)] hover:bg-[color:var(--color-warning)]/20 transition text-sm"
                >
                  <X className="w-3 h-3" />
                  Clear filters
                </button>
              )}
            </div>

            {/* Filter Options */}
            {showFilters && (
              <motion.div
                className="space-y-3"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                {/* Category Filter */}
                <div>
                  <label className="text-xs font-medium text-[color:var(--text-secondary)] block mb-2">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilterCategory(null)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        filterCategory === null
                          ? 'bg-[color:var(--color-primary)] text-white'
                          : 'bg-[color:var(--surface-card)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]'
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => setFilterCategory(cat.name)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          filterCategory === cat.name
                            ? 'bg-[color:var(--color-primary)] text-white'
                            : 'bg-[color:var(--surface-card)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]'
                        }`}
                      >
                        {cat.name} ({cat.count})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specialty Filter - Extract unique specialties from templates */}
                <div>
                  <label className="text-xs font-medium text-[color:var(--text-secondary)] block mb-2">
                    Specialty
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilterSpecialty(null)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        filterSpecialty === null
                          ? 'bg-[color:var(--color-primary)] text-white'
                          : 'bg-[color:var(--surface-card)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]'
                      }`}
                    >
                      All
                    </button>
                    {Array.from(
                      new Set(templates.map((t) => t.specialty).filter(Boolean))
                    ).map((specialty) => (
                      <button
                        key={specialty}
                        onClick={() => setFilterSpecialty(specialty!)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          filterSpecialty === specialty
                            ? 'bg-[color:var(--color-primary)] text-white'
                            : 'bg-[color:var(--surface-card)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]'
                        }`}
                      >
                        {specialty}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Template List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {templatesLoading || searchLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[color:var(--color-primary)] border-t-transparent"></div>
              </div>
            ) : displayedTemplates.length === 0 ? (
              <div className="text-center py-8 text-[color:var(--text-tertiary)]">
                <p className="text-sm">No templates found</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-[color:var(--color-primary)] hover:underline mt-2"
                  >
                    Try clearing filters
                  </button>
                )}
              </div>
            ) : (
              displayedTemplates.map((template) => (
                <motion.button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`w-full p-3 rounded-lg text-left transition border ${
                    selectedTemplateId === template.id
                      ? 'bg-[color:var(--color-primary)]/10 border-[color:var(--color-primary)]'
                      : 'border-[color:var(--border-subtle)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--surface-hover)]'
                  }`}
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[color:var(--text-primary)] truncate">
                          {template.label || template.template_key}
                        </h3>
                        {template.specialty && (
                          <span className="text-xs bg-[color:var(--color-info)]/10 text-[color:var(--color-info)] px-2 py-0.5 rounded whitespace-nowrap">
                            {template.specialty}
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-[color:var(--text-secondary)] mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      {template.category && (
                        <span className="text-xs text-[color:var(--text-tertiary)] mt-1">
                          Category: {template.category}
                        </span>
                      )}
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(template.id);
                      }}
                      className="flex-shrink-0 p-2 rounded-lg hover:bg-[color:var(--surface-card)] transition cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleFavorite(template.id);
                        }
                      }}
                    >
                      <Star
                        className={`w-4 h-4 transition ${
                          favorites.has(template.id)
                            ? 'fill-[color:var(--color-warning)] text-[color:var(--color-warning)]'
                            : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--color-warning)]'
                        }`}
                      />
                    </div>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Compact template selector for toolbar/headers
 * Shows recently used and favorites at a glance
 */
interface CompactTemplateSelectorProps {
  selectedTemplateId?: string | null;
  onSelect: (template: Template) => void;
}

export function CompactTemplateSelector({
  selectedTemplateId,
  onSelect,
}: CompactTemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);

  const { templates } = useTemplates();

  useEffect(() => {
    const savedFavorites = localStorage.getItem('template-favorites');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
    const savedRecent = localStorage.getItem('template-recently-used');
    if (savedRecent) {
      setRecentlyUsed(JSON.parse(savedRecent));
    }
  }, []);

  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
    }
  }, [selectedTemplateId, templates]);

  const recentTemplates = useMemo(() => {
    return recentlyUsed
      .map(id => templates.find(t => t.id === id))
      .filter(Boolean) as Template[];
  }, [recentlyUsed, templates]);

  const favoriteTemplates = useMemo(() => {
    return Array.from(favorites)
      .map(id => templates.find(t => t.id === id))
      .filter(Boolean) as Template[];
  }, [favorites, templates]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] transition"
      >
        <span className="text-sm font-medium">{selectedTemplate?.label || 'Select Template'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <motion.div
          className="absolute top-full mt-2 right-0 z-50 bg-[color:var(--surface-base)] rounded-lg shadow-lg border border-[color:var(--border-subtle)] w-64 max-h-96 overflow-y-auto"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {/* Recently Used */}
          {recentTemplates.length > 0 && (
            <div className="border-b border-[color:var(--border-subtle)]">
              <div className="px-3 py-2 bg-[color:var(--surface-card)]">
                <h4 className="text-xs font-semibold text-[color:var(--text-secondary)] flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Recently Used
                </h4>
              </div>
              <div className="p-2 space-y-1">
                {recentTemplates.slice(0, 3).map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      onSelect(template);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[color:var(--surface-hover)] transition text-[color:var(--text-primary)]"
                  >
                    {template.label || template.template_key}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Favorites */}
          {favoriteTemplates.length > 0 && (
            <div className="border-b border-[color:var(--border-subtle)]">
              <div className="px-3 py-2 bg-[color:var(--surface-card)]">
                <h4 className="text-xs font-semibold text-[color:var(--text-secondary)] flex items-center gap-2">
                  <Star className="w-3 h-3" /> Favorites
                </h4>
              </div>
              <div className="p-2 space-y-1">
                {favoriteTemplates.slice(0, 5).map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      onSelect(template);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[color:var(--surface-hover)] transition text-[color:var(--text-primary)]"
                  >
                    {template.label || template.template_key}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View All */}
          <div className="p-2">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-3 py-2 rounded-lg bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] text-sm font-medium hover:opacity-90 transition"
            >
              View All Templates
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
