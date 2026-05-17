/**
 * Clinical Note Templates Library - REFACTORED
 * 
 * This file now contains only type definitions and helper utilities.
 * Template definitions have been moved to the backend API.
 * 
 * MIGRATION GUIDE:
 * ================
 * 
 * Old way (hardcoded):
 *   import { noteTemplates } from '@/lib/note-templates';
 *   const template = noteTemplates['soap-general'];
 * 
 * New way (dynamic):
 *   import { contentCache, CACHE_KEYS } from '@/lib/content-cache';
 *   import { contentApi } from '@/lib/api-client';
 *   import { FALLBACK_TEMPLATES } from '@/lib/fallback-data';
 *   
 *   const response = await contentCache.getOrFetch(
 *     CACHE_KEYS.TEMPLATES,
 *     () => contentApi.getTemplates({ includeAll: true })
 *   );
 *   const templates = response.templates;
 *   const template = templates.find(t => t.template_key === 'soap-general');
 * 
 * For offline or fallback:
 *   import { FALLBACK_TEMPLATES } from '@/lib/fallback-data';
 *   const template = FALLBACK_TEMPLATES.templates[0]; // SOAP note
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TemplateSection = {
  key: string;
  title: string;
  helper: string;
  order?: number;
  is_required?: boolean;
  input_type?: string;
  placeholder?: string;
};

export type Template = {
  id: string;
  template_key: NoteTemplate;
  label: string;
  description?: string;
  specialty: string;
  category?: string;
  icon?: string;
  sections: TemplateSection[];
  metadata?: Record<string, any>;
  is_active: boolean;
  version?: string;
  created_at?: string;
  updated_at?: string;
};

/**
 * Template type union - all supported template keys
 * These match the backend's template_key values exactly
 */
export type NoteTemplate =
  // General Medicine & Primary Care
  | "soap-general"
  | "hp-comprehensive"
  | "office-visit"
  | "acute-illness"
  | "chronic-disease-mgmt"
  | "preventive-care"
  | "medication-review"
  // Specialized Consultations
  | "consultation"
  | "follow-up-visit"
  | "hospital-admission"
  | "discharge-summary"
  // Procedure Notes
  | "procedure"
  | "injection"
  | "wound-care"
  // Mental Health & Behavioral
  | "mental-health-intake"
  | "mental-status-exam"
  | "psychotherapy"
  | "medication-management"
  // Rehabilitation & Therapy
  | "pt-initial-eval"
  | "pt-treatment"
  | "ot-initial-eval"
  | "ot-treatment"
  | "speech-therapy"
  // Specialty-Specific
  | "cardiology"
  | "dermatology"
  | "orthopedic"
  | "rheumatology"
  | "endocrinology"
  | "pulmonology"
  | "gi"
  | "neurology"
  | "ophthalmology"
  | "ent"
  | "urology"
  | "obs-gyn-visit"
  | "pediatric-visit"
  | "geriatric-assessment"
  // Administrative & Reports
  | "referral-letter"
  | "disability-form"
  | "work-excuse"
  | "prior-authorization"
  | "medical-summary";

// ============================================================================
// DEPRECATED: EMPTY TEMPLATES OBJECT (kept for backwards compatibility)
// ============================================================================

/**
 * @deprecated - Templates are now fetched from the backend API
 * 
 * This object is empty and kept only for backwards compatibility.
 * Do not use this in new code.
 * 
 * Use contentApi.getTemplates() instead:
 * @example
 * ```typescript
 * import { contentCache, CACHE_KEYS } from '@/lib/content-cache';
 * import { contentApi } from '@/lib/api-client';
 * 
 * const response = await contentCache.getOrFetch(
 *   CACHE_KEYS.TEMPLATES,
 *   () => contentApi.getTemplates({ includeAll: true })
 * );
 * const templates = response.templates;
 * ```
 * 
 * For offline mode:
 * @example
 * ```typescript
 * import { FALLBACK_TEMPLATES } from '@/lib/fallback-data';
 * const templates = FALLBACK_TEMPLATES.templates;
 * ```
 */
export const noteTemplates = {} as Record<NoteTemplate, { label: string; specialty: string; sections: TemplateSection[] }>;

// ============================================================================
// SPECIALTY CONSTANTS
// ============================================================================

/**
 * List of all supported medical specialties
 * @deprecated - Consider fetching from backend if needed
 */
export const specialties = [
  "General Medicine",
  "Consultation",
  "Procedure",
  "Mental Health",
  "Physical Therapy",
  "Occupational Therapy",
  "Speech Therapy",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Rheumatology",
  "Endocrinology",
  "Pulmonology",
  "Gastroenterology",
  "Neurology",
  "Ophthalmology",
  "ENT",
  "Urology",
  "Obstetrics/Gynecology",
  "Pediatrics",
  "Geriatrics",
  "Administrative",
];

// ============================================================================
// HELPER FUNCTIONS & UTILITIES
// ============================================================================

/**
 * @deprecated - Group templates by specialty from dynamic API instead
 * 
 * This helper is kept for backwards compatibility but should use
 * the dynamic template data from contentApi.getTemplates()
 */
export const templatesBySpecialty = Object.entries(noteTemplates).reduce(
  (acc, [key, template]) => {
    const specialty = template.specialty;
    if (!acc[specialty]) {
      acc[specialty] = [];
    }
    acc[specialty].push({ key: key as NoteTemplate, label: template.label });
    return acc;
  },
  {} as Record<string, Array<{ key: NoteTemplate; label: string }>>
);

/**
 * Get a template by its key (DEPRECATED)
 * @deprecated - Use contentApi.getTemplates() instead
 * 
 * @param key - Template key
 * @returns Template object or undefined
 */
export function getTemplate(key: NoteTemplate): { label: string; specialty: string; sections: TemplateSection[] } | undefined {
  return noteTemplates[key];
}

/**
 * Get all templates by specialty (DEPRECATED)
 * @deprecated - Use contentApi.getTemplates() instead
 * 
 * @param specialty - Specialty name
 * @returns Array of templates for that specialty
 */
export function getTemplatesBySpecialty(specialty: string): NoteTemplate[] {
  const templates = templatesBySpecialty[specialty] || [];
  return templates.map(t => t.key);
}

/**
 * Get all available templates (DEPRECATED)
 * @deprecated - Use contentApi.getTemplates() instead
 * 
 * @returns Array of template keys
 */
export function getAllTemplates(): NoteTemplate[] {
  return Object.keys(noteTemplates) as NoteTemplate[];
}

// ============================================================================
// MIGRATION NOTES FOR DEVELOPERS
// ============================================================================

/**
 * MIGRATION TIMELINE:
 * 
 * Phase 1 (COMPLETE):
 * - Removed hardcoded templateUUIDs from this file
 * - Added dynamic UUID lookup via API
 * - Added content caching layer
 * 
 * Phase 2 (IN PROGRESS):
 * - Removed ~2,330 lines of hardcoded template definitions
 * - This file now contains only types and deprecation notices
 * - All template content now comes from backend API
 * 
 * Phase 3 (TODO):
 * - Remove deprecated functions from this file entirely
 * - Update all usages to use contentApi instead
 * - Remove this file or keep only as type definition file
 * 
 * BREAKING CHANGES:
 * - Direct access to noteTemplates will no longer work (empty object)
 * - Must use contentApi.getTemplates() instead
 * - Check fallback-data.ts for offline mode
 * 
 * BACKWARDS COMPATIBILITY:
 * - File exports maintained for import compatibility
 * - Deprecated functions left with warnings
 * - Empty noteTemplates object to prevent immediate breakage
 */
