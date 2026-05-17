'use client';

import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useTemplates, type UseTemplatesResult } from '@/lib/hooks/useTemplates';

const TemplateContext = createContext<UseTemplatesResult | null>(null);

export function TemplateProvider({ children }: { children: ReactNode }) {
  // Initialize token from query param or localStorage (for development/testing)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for token in URL params first (useful for testing)
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('token');
      
      if (tokenFromUrl) {
        localStorage.setItem('accessToken', tokenFromUrl);

      }
    }
  }, []);

  const result = useTemplates();

  return (
    <TemplateContext.Provider value={result}>
      {children}
    </TemplateContext.Provider>
  );
}

export function useTemplateContext() {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error('useTemplateContext must be used within TemplateProvider');
  }
  return context;
}
