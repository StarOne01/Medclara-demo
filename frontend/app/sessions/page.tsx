"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { SideNav } from "@/components/side-nav";
import { useSidebar } from "@/lib/sidebar-context";
import { getApiClient } from "@/lib/api-client-unified";
import { useToast } from "@/components/toast";
import { Clock, FileText, User, ChevronRight, Plus } from "lucide-react";

type Session = {
  sessionId: string;
  status: string;
  patientId?: string;
  templateId: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  patient?: {
    firstName: string;
    lastName: string;
    id: string;
  };
  noteMetadata?: {
    noteId: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
  };
  noteSections?: Record<string, string>;
  [key: string]: any;
};

export default function SessionsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { addToast } = useToast();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientCache, setPatientCache] = useState<Record<string, { firstName: string; lastName: string }>>({});
  const [loadingPatients, setLoadingPatients] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getApiClient().sessions.list({ limit: 100 });

      if (response.sessions && response.sessions.length > 0) {
        const firstSession = response.sessions[0];






      }
      
      setSessions(response.sessions || []);
      
      // Load patient data for sessions that have patientId but no patient object
      loadPatientDataForSessions(response.sessions || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(errorMessage);
      addToast({
        type: 'error',
        title: 'Load Failed',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPatientDataForSessions = async (sessionsToLoad: Session[]) => {
    const patientIds = sessionsToLoad
      .filter(s => s.patientId && !s.patient && !patientCache[s.patientId])
      .map(s => s.patientId as string);

    if (patientIds.length === 0) {

      return;
    }

    const newLoadingPatients = new Set(loadingPatients);
    patientIds.forEach(id => newLoadingPatients.add(id));
    setLoadingPatients(newLoadingPatients);

    for (const patientId of patientIds) {
      try {
        const patientData = await getApiClient().patients.get(patientId);

        // Update cache
        setPatientCache(prev => ({
          ...prev,
          [patientId]: {
            firstName: patientData.firstName,
            lastName: patientData.lastName
          }
        }));

        // Update sessions with patient data
        setSessions(prev => 
          prev.map(session => 
            session.patientId === patientId && !session.patient
              ? {
                  ...session,
                  patient: {
                    id: patientId,
                    firstName: patientData.firstName,
                    lastName: patientData.lastName
                  }
                }
              : session
          )
        );
      } catch (err) {
      } finally {
        const updatedLoading = new Set(newLoadingPatients);
        updatedLoading.delete(patientId);
        setLoadingPatients(updatedLoading);
      }
    }
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/scribe/${sessionId}`);
  };

  const handleNewSession = () => {
    router.push('/scribe');
  };

  const formatDate = (dateString: string | number | undefined | null) => {
    if (!dateString) return 'N/A';
    
    try {

      let dateObj: Date | null = null;
      
      // Handle multiple possible formats
      if (typeof dateString === 'string') {
        // Try ISO 8601 format first (most common)
        dateObj = new Date(dateString);
        
        // If that failed, try parsing as other formats
        if (isNaN(dateObj.getTime())) {
          
          // Try removing milliseconds if present
          const cleaned = dateString.replace(/\.\d{3}Z$/, 'Z');
          dateObj = new Date(cleaned);
          
          if (isNaN(dateObj.getTime())) {
            return 'N/A';
          }
        }
      } else if (typeof dateString === 'number') {
        // Handle unix timestamps (seconds or milliseconds)
        // If number is very large, assume milliseconds; if small, assume seconds
        const timestamp = dateString > 10000000000 ? dateString : dateString * 1000;
        dateObj = new Date(timestamp);
      } else if (typeof dateString === 'object' && dateString !== null) {
        // Handle objects with toISOString or toString methods
        if (typeof (dateString as any).toISOString === 'function') {
          dateObj = new Date((dateString as any).toISOString());
        } else if (typeof (dateString as any).toString === 'function') {
          const str = (dateString as any).toString();
          dateObj = new Date(str);
        } else {
          return 'N/A';
        }
      }
      
      // Final check
      if (!dateObj || isNaN(dateObj.getTime())) {
        return 'N/A';
      }
      
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400';
      case 'completed':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400';
      case 'expired':
        return 'bg-stone-500/10 text-stone-700 border-stone-500/30 dark:text-stone-400';
      default:
        return 'bg-stone-500/10 text-stone-700 border-stone-500/30 dark:text-stone-400';
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[color:var(--color-background)]">
      <SideNav />

      <main className={`flex h-screen flex-1 flex-col gap-6 overflow-auto px-6 pb-6 pt-4 transition-all duration-300 ${
        isCollapsed ? "ml-20" : "ml-64"
      }`}>
        {/* Header */}
        <motion.section
          className="flex-shrink-0 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-6 shadow-sm"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Sessions</h1>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                Manage your scribe sessions and view saved notes
              </p>
            </div>
            <motion.button
              onClick={handleNewSession}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--button-primary-bg)] px-4 py-2.5 font-medium text-[color:var(--button-primary-text)] hover:opacity-90 transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-4 w-4" />
              New Session
            </motion.button>
          </div>
        </motion.section>

        {/* Content */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[color:var(--border-subtle)] border-t-[color:var(--button-primary-bg)]" />
              <p className="text-sm text-[color:var(--text-secondary)]">Loading sessions...</p>
            </div>
          </div>
        ) : error ? (
          <motion.div
            className="flex flex-1 items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center max-w-md">
              <p className="font-medium text-red-700 dark:text-red-400">Failed to Load Sessions</p>
              <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>
              <button
                onClick={loadSessions}
                className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/20 dark:text-red-400"
              >
                Retry
              </button>
            </div>
          </motion.div>
        ) : sessions.length === 0 ? (
          <motion.div
            className="flex flex-1 items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="rounded-lg border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-12 text-center max-w-md">
              <FileText className="h-12 w-12 text-[color:var(--text-tertiary)] mx-auto" />
              <p className="mt-3 font-medium text-[color:var(--text-primary)]">No Sessions Yet</p>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                Create a new session to start recording and generating clinical notes
              </p>
              <button
                onClick={handleNewSession}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--button-primary-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-primary-text)] hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Create Session
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 pb-4">
            {sessions.map((session, index) => (
              <motion.div
                key={session.sessionId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <button
                  onClick={() => handleSessionClick(session.sessionId)}
                  className="w-full text-left rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card)]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-success)]" />
                        <p className="text-sm font-mono text-[color:var(--text-secondary)]">
                          {session.sessionId.substring(0, 12)}...
                        </p>
                      </div>
                      <p className="text-xs text-[color:var(--text-tertiary)] mt-1">
                        Session ID
                      </p>
                    </div>
                    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4 border-t border-[color:var(--border-subtle)] pt-3">
                    {/* Patient */}
                    {session.patient ? (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                        <span className="text-[color:var(--text-primary)]">
                          {session.patient.firstName} {session.patient.lastName}
                        </span>
                      </div>
                    ) : session.patientId && loadingPatients.has(session.patientId) ? (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                        <span className="text-[color:var(--text-secondary)] italic">
                          Loading patient...
                        </span>
                      </div>
                    ) : session.patientId ? (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                        <span className="text-[color:var(--text-secondary)] italic">
                          Patient ID: {session.patientId.substring(0, 8)}...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                        <span className="text-[color:var(--text-tertiary)] italic">
                          No patient linked
                        </span>
                      </div>
                    )}

                    {/* Notes Status */}
                    {session.noteMetadata ? (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          Notes saved ({session.noteMetadata.status})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                        <span className="text-[color:var(--text-tertiary)] italic">
                          No notes yet
                        </span>
                      </div>
                    )}

                    {/* Created Date */}
                    <div className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                      <Clock className="h-4 w-4" />
                      <span>Created {formatDate(session.createdAt)}</span>
                    </div>

                    {/* Updated Date */}
                    {session.updatedAt && session.updatedAt !== session.createdAt && (
                      <div className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                        <Clock className="h-4 w-4" />
                        <span>Updated {formatDate(session.updatedAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[color:var(--border-subtle)]">
                    <span className="text-xs text-[color:var(--text-tertiary)]">
                      {session.noteMetadata ? 'View & Edit' : 'Continue'}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
