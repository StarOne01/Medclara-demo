"use client";

import { useState, useEffect } from "react";
import { motion, type Variants, type Easing } from "framer-motion";
import { Search, Plus, User, AlertCircle, Loader } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SideNav } from "@/components/side-nav";
import { useSidebar } from "@/lib/sidebar-context";
import { useAuth } from "@/lib/hooks/useAuth";
import { usePatients } from "@/lib/hooks/usePatients";
import { useToast } from "@/components/toast";

const easeOutExpo: Easing = [0.12, 0.12, 0.1, 0.1];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutExpo },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export default function PatientsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { addToast } = useToast();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Use the custom hook for fetching patients
  const { 
    patients, 
    loading, 
    error,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    offset,
    limit,
    total
  } = usePatients({ limit: 20, autoFetch: true });

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      addToast({
        type: 'error',
        title: 'Error Loading Patients',
        message: error
      });
    }
  }, [error, addToast]);

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const filteredPatients = patients.filter(
    (patient) =>
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (patient.medicalRecordNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

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

      <main
        className={`flex h-screen flex-1 flex-col gap-6 overflow-auto px-6 pb-6 pt-6 transition-all duration-300 ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header */}
        <motion.div
          className="flex items-center justify-between"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div>
            <h1 className="text-3xl font-semibold text-[color:var(--text-primary)]">Patients</h1>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1">{total} patient{total !== 1 ? 's' : ''} in system</p>
          </div>
          <Link href="/patients/add">
            <motion.button
              className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--button-primary-hover)] transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-4 w-4" />
              Add Patient
            </motion.button>
          </Link>
        </motion.div>

        {/* Search */}
        <motion.div className="relative" variants={fadeInUp} initial="hidden" animate="visible">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search by name or MRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] py-2.5 pl-10 pr-3 text-sm text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] focus:border-[color:var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition"
          />
        </motion.div>

        {/* Patient List */}
        <motion.div
          className="flex-1 overflow-y-auto space-y-2"
          initial="hidden"
          animate="visible"
        >
          {loading ? (
            <motion.div
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--border-subtle)] py-12"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
            >
              <Loader className="h-8 w-8 text-[color:var(--text-tertiary)] animate-spin" />
              <p className="mt-3 text-sm text-[color:var(--text-secondary)]">Loading patients...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-red-500/30 bg-red-50/30 py-8 dark:border-red-500/20 dark:bg-red-950/10"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
            >
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            </motion.div>
          ) : filteredPatients.length > 0 ? (
            <div className="space-y-2">
              {filteredPatients.map((patient) => {
                const age = patient.dateOfBirth 
                  ? Math.floor((new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                  : null;
                
                return (
                  <motion.a
                    key={patient.id}
                    href={`/patients/${patient.id}`}
                    className="block rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-4 hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card-hover)] transition"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--surface-card-strong)] flex-shrink-0">
                          <User className="h-5 w-5 text-[color:var(--text-secondary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-xs text-[color:var(--text-tertiary)]">
                            {patient.medicalRecordNumber} • {age ? `${age}y` : 'N/A'} • {patient.gender}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <motion.button
                          onClick={(e) => {
                            e.preventDefault();
                          }}
                          className="rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-card-strong)] text-[color:var(--text-primary)] px-3 py-1.5 text-xs font-medium hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card-hover)] transition"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          View
                        </motion.button>
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </div>
          ) : (
            <motion.div
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--border-subtle)] py-8"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
            >
              <User className="h-8 w-8 text-[color:var(--text-tertiary)]" />
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">No patients found</p>
            </motion.div>
          )}
        </motion.div>

        {/* Pagination Controls */}
        {!loading && !error && patients.length > 0 && (
          <motion.div
            className="flex items-center justify-between py-4 px-2 border-t border-[color:var(--border-subtle)]"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <div className="text-sm text-[color:var(--text-secondary)]">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} patients
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={prevPage}
                disabled={!hasPrevPage || loading}
                className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition"
                whileHover={hasPrevPage && !loading ? { scale: 1.05 } : {}}
                whileTap={hasPrevPage && !loading ? { scale: 0.95 } : {}}
              >
                ← Previous
              </motion.button>
              <motion.button
                onClick={nextPage}
                disabled={!hasNextPage || loading}
                className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition"
                whileHover={hasNextPage && !loading ? { scale: 1.05 } : {}}
                whileTap={hasNextPage && !loading ? { scale: 0.95 } : {}}
              >
                Next →
              </motion.button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
