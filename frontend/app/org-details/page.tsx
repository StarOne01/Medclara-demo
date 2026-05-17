"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { SideNav } from "@/components/side-nav";
import { useSidebar } from "@/lib/sidebar-context";
import { useAuth } from "@/lib/hooks/useAuth";

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

export default function OrgDetailsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { loading: authLoading, isAuthenticated, user, organizationId } = useAuth();
  const [copied, setCopied] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleCopyOrgId = () => {
    if (organizationId) {
      navigator.clipboard.writeText(organizationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white" />
          <p className="text-sm text-slate-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[color:var(--color-background)]">
      <SideNav />

      <main className={`flex h-screen flex-1 flex-col gap-6 overflow-auto px-6 pb-6 pt-6 transition-all duration-300 ${
        isCollapsed ? "ml-20" : "ml-64"
      }`}>
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-[color:var(--button-primary-bg)]" />
            <div>
              <h1 className="text-3xl font-semibold text-[color:var(--text-primary)]">Organization Details</h1>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                View and manage your organization information
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="max-w-2xl space-y-6 rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-6 shadow-sm"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          {/* Organization ID Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                Organization ID
              </h2>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                Your unique organization identifier
              </p>
            </div>

            {organizationId ? (
              <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-4">
                <div className="flex-1">
                  <p className="break-all font-mono text-sm text-[color:var(--text-primary)]">
                    {organizationId}
                  </p>
                </div>
                <motion.button
                  onClick={handleCopyOrgId}
                  className="flex items-center gap-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2 text-sm font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-card-hover)]"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </motion.button>
              </div>
            ) : (
              <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-4">
                <p className="text-sm text-[color:var(--text-tertiary)]">
                  No organization information available
                </p>
              </div>
            )}
          </div>

          {/* Organization Admin Section */}
          <div className="space-y-4 border-t border-[color:var(--border-subtle)] pt-6">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                Organization Administrator
              </h2>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                Contact your organization's primary administrator
              </p>
            </div>

            <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-4">
              <div className="space-y-3">
                {user ? (
                  <>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-[color:var(--text-tertiary)]">
                        Name
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                        {user.first_name} {user.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-[color:var(--text-tertiary)]">
                        Role
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--text-primary)]">
                        {user.role || "Healthcare Provider"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-[color:var(--text-tertiary)]">
                        Email
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--text-primary)] break-all">
                        {user.email}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[color:var(--text-tertiary)]">
                    Unable to load organization administrator information
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Organization Settings Info */}
          <div className="space-y-4 border-t border-[color:var(--border-subtle)] pt-6">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                Organization Settings
              </h2>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                To modify organization settings or manage team members, please contact your organization administrator
              </p>
            </div>

            <div className="rounded-xl border border-[color:var(--border-solid)] border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 For administrative changes including team member management, billing, or security settings, please reach out to your organization's primary administrator.
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
