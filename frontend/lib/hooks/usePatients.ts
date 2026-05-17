'use client';

import { useState, useCallback, useEffect } from 'react';
import { getApiClient, type Patient, ApiError } from '@/lib/api-client-unified';

interface UsePatientsOptions {
  limit?: number;
  offset?: number;
  autoFetch?: boolean;
}

interface UsePatientsResult {
  patients: Patient[];
  total: number;
  limit: number;
  offset: number;
  loading: boolean;
  error: string | null;
  fetchPatients: (newLimit?: number, newOffset?: number) => Promise<void>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing patients with pagination
 * 
 * Usage:
 * const { patients, loading, error, fetchPatients, nextPage, prevPage } = usePatients();
 * 
 * With manual fetch:
 * const { patients, loading, fetchPatients } = usePatients({ autoFetch: false });
 * useEffect(() => { fetchPatients(20, 0); }, []);
 */
export function usePatients(options: UsePatientsOptions = {}): UsePatientsResult {
  const { limit = 20, offset = 0, autoFetch = true } = options;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [currentLimit, setCurrentLimit] = useState(limit);
  const [currentOffset, setCurrentOffset] = useState(offset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(
    async (newLimit = currentLimit, newOffset = currentOffset) => {
      try {
        setLoading(true);
        setError(null);

        const params = { 
          limit: Math.min(newLimit, 100), 
          offset: newOffset 
        };


        const client = getApiClient();
        const response = await client.patients.list(params);



        // Validate response structure
        if (!response) {
          throw new Error('No response from server');
        }

        // Log what we're getting



        if (!Array.isArray(response.patients)) {
          throw new Error(`Invalid patient data format from server. Got: ${typeof response.patients}`);
        }

        // Update state
        setPatients(response.patients);
        setTotal(response.total || 0);
        setCurrentLimit(response.limit || newLimit);
        setCurrentOffset(response.offset || newOffset);

      } catch (err) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to fetch patients';

        setError(errorMessage);
        setPatients([]);
      } finally {
        setLoading(false);
      }
    },
    [currentLimit, currentOffset]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchPatients(limit, offset);
    }
  }, [autoFetch, limit, offset, fetchPatients]);

  const nextPage = useCallback(async () => {
    const newOffset = currentOffset + currentLimit;
    if (newOffset < total) {
      await fetchPatients(currentLimit, newOffset);
    }
  }, [currentOffset, currentLimit, total, fetchPatients]);

  const prevPage = useCallback(async () => {
    const newOffset = Math.max(0, currentOffset - currentLimit);
    await fetchPatients(currentLimit, newOffset);
  }, [currentOffset, currentLimit, fetchPatients]);

  const refetch = useCallback(() => {
    return fetchPatients(currentLimit, currentOffset);
  }, [fetchPatients, currentLimit, currentOffset]);

  return {
    patients,
    total,
    limit: currentLimit,
    offset: currentOffset,
    loading,
    error,
    fetchPatients,
    nextPage,
    prevPage,
    hasNextPage: currentOffset + currentLimit < total,
    hasPrevPage: currentOffset > 0,
    refetch,
  };
}

export default usePatients;
