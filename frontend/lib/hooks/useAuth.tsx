'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getApiClient } from '@/lib/api-client-unified';
import type { User } from '@/lib/api-client-unified';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  organizationId: string | null;
  logout: () => Promise<void>;
}

export function useAuth(): AuthContextType {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if token exists in localStorage
        const token = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('user');

        if (!token) {
          setUser(null);
          setLoading(false);
          // Redirect to login with the current page as the 'from' parameter
          const loginUrl = `/login?from=${encodeURIComponent(pathname)}`;
          router.push(loginUrl);
          return;
        }

        // If we have stored user data, use it immediately
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setLoading(false);
            return; // User is authenticated, don't need to verify with API
          } catch (e) {
          }
        }

        // Try to verify token with API (optional - for session validation)
        try {
          const client = getApiClient();
          const currentUser = await client.auth.getCurrentUser();
          setUser(currentUser);
          // Update stored user data
          localStorage.setItem('user', JSON.stringify(currentUser));
        } catch (err) {
          // Even if API call fails, if we have stored user data, keep using it
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch (e) {
              // If we can't parse stored user, clear and redirect to login
              localStorage.removeItem('accessToken');
              localStorage.removeItem('user');
              setUser(null);
              const loginUrl = `/login?from=${encodeURIComponent(pathname)}`;
              router.push(loginUrl);
            }
          } else {
            // No stored user data, token is invalid
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            setUser(null);
            const loginUrl = `/login?from=${encodeURIComponent(pathname)}`;
            router.push(loginUrl);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, pathname]);

  const logout = async () => {
    try {
      const client = getApiClient();
      await client.auth.logout();
    } catch (err) {
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setUser(null);
      router.push('/login');
    }
  };

  return {
    user,
    loading,
    isAuthenticated: !!user && !!localStorage.getItem('accessToken'),
    organizationId: user?.organization_id || null,
    logout,
  };
}

/**
 * Higher-order component that protects a page and requires authentication
 * Usage: 
 * export default withAuth(YourComponent);
 */
export function withAuth<T extends Record<string, any>>(
  Component: React.ComponentType<T & { user: User | null }>
) {
  return function ProtectedComponent(props: T) {
    const { user, loading, isAuthenticated } = useAuth();

    if (loading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />
            <p className="text-sm text-slate-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated || !user) {
      return null; // Will redirect via useAuth
    }

    return <Component {...props} user={user} />;
  };
}
