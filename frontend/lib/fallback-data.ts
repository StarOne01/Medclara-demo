/**
 * Fallback Templates Data
 * DEPRECATED: Templates now come 100% from the backend API.
 * This object is kept empty - do not use hardcoded templates.
 */

export const FALLBACK_TEMPLATES = {
  status: 'success',
  meta: {
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false,
    version: 'v1-fallback',
  },
  templates: [],
};  

/**
 * Fallback Template UUID mapping
 * DEPRECATED: This is no longer used. Templates come directly from the backend API.
 * Kept empty for backwards compatibility only.
 */
export const FALLBACK_TEMPLATE_UUIDS = {
  status: 'success',
  version: 'v1-fallback',
  data: {}
};

/**
 * Fallback workspace tabs configuration
 */
export const FALLBACK_WORKSPACE_TABS = {
  status: 'success',
  tabs: [
    {
      id: 'patient',
      label: 'Patient',
      icon: 'user',
      order: 1,
      enabled: true,
      permissions: ['read:patient'],
      permissions_required: true,
      feature_flag: null,
      beta: false,
      description: 'Patient overview and information',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: 'tasks',
      order: 2,
      enabled: true,
      permissions: ['read:tasks', 'write:tasks'],
      permissions_required: true,
      feature_flag: null,
      beta: false,
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: 'clipboard-check',
      order: 3,
      enabled: true,
      permissions: ['read:orders'],
      permissions_required: true,
      feature_flag: null,
      beta: false,
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      icon: 'microscope',
      order: 4,
      enabled: true,
      permissions: ['read:diagnostics'],
      permissions_required: true,
      feature_flag: null,
      beta: false,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: 'history',
      order: 5,
      enabled: true,
      permissions: ['read:timeline'],
      permissions_required: false,
      feature_flag: null,
      beta: false,
    },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: 'calendar',
      order: 6,
      enabled: true,
      permissions: ['read:followups'],
      permissions_required: true,
      feature_flag: null,
      beta: false,
    },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: 'alert-circle',
      order: 7,
      enabled: true,
      permissions: ['read:alerts'],
      permissions_required: false,
      feature_flag: 'decision_support_alerts',
      beta: true,
      description: 'Decision support and clinical alerts',
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: 'receipt',
      order: 8,
      enabled: true,
      permissions: ['read:billing'],
      permissions_required: true,
      feature_flag: null,
      beta: false,
    },
  ],
};
