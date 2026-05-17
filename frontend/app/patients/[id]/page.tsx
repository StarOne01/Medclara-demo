"use client";

import { useState, useEffect } from "react";
import { motion, type Variants, type Easing } from "framer-motion";
import { ArrowLeft, Phone, Mail, MapPin, FileText, Plus, Loader, AlertCircle, ChevronRight, Pill, AlertTriangle, Calendar } from "lucide-react";
import Link from "next/link";
import { SideNav } from "@/components/side-nav";
import { useSidebar } from "@/lib/sidebar-context";
import { useToast } from "@/components/toast";
import { getApiClient, type Note, type Patient } from "@/lib/api-client-unified";

const easeOutExpo: Easing = [0.12, 0.12, 0.1, 0.1];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutExpo },
  },
};

const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  medicalRecordNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  primaryLanguage?: string;
  allergies?: Array<{ allergen: string; reaction: string }>;
  medications?: Array<{ name: string; dose: string; frequency: string }>;
}

/**
 * Component to render markdown content
 * Parses markdown syntax and renders as formatted HTML
 */
function MarkdownRenderer({ content }: { content: string }) {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Headers (##, ###, etc.)
      if (trimmed.startsWith('##')) {
        const level = trimmed.match(/^#+/)?.[0].length || 2;
        const title = trimmed.replace(/^#+\s*/, '');
        const headingClass = level === 2 ? 'text-lg font-bold' : level === 3 ? 'text-base font-bold' : 'text-sm font-semibold';
        elements.push(
          <h2 key={`heading-${i}`} className={`${headingClass} text-[color:var(--text-primary)] mt-4 mb-2`}>
            {title}
          </h2>
        );
      }
      // Bold text
      else if (trimmed.includes('**')) {
        const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        elements.push(
          <p key={`bold-${i}`} className="text-sm text-[color:var(--text-primary)] mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
        );
      }
      // List items
      else if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        const itemText = trimmed.replace(/^[\*\-]\s*/, '');
        elements.push(
          <li key={`list-${i}`} className="text-sm text-[color:var(--text-primary)] ml-4 mb-1">
            {itemText}
          </li>
        );
      }
      // Empty lines (paragraph breaks)
      else if (trimmed === '') {
        // Skip multiple consecutive empty lines
        if (i > 0 && lines[i - 1].trim() !== '') {
          elements.push(<div key={`space-${i}`} className="h-2" />);
        }
      }
      // Regular text
      else if (trimmed) {
        elements.push(
          <p key={`text-${i}`} className="text-sm text-[color:var(--text-primary)] mb-2 leading-relaxed">
            {trimmed}
          </p>
        );
      }

      i++;
    }

    return elements;
  };

  return (
    <div className="space-y-1">
      {renderMarkdown(content)}
    </div>
  );
}

/**
 * Component to render note content
 * Handles both plain text, markdown, and JSON-formatted content
 */
function NoteContentRenderer({ content }: { content: string | null | undefined }) {
  if (!content) {
    return (
      <div>
        <p className="text-sm text-[color:var(--text-tertiary)] italic">No content available</p>
      </div>
    );
  }

  // Try to parse as JSON
  let parsedContent: Record<string, any> | null = null;
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null) {
      parsedContent = parsed;
    }
  } catch (e) {
    // Not JSON, treat as plain text/markdown
  }

  // If it's JSON with multiple fields, render as sections
  if (parsedContent && Object.keys(parsedContent).length > 0) {
    return (
      <div className="space-y-6">
        {Object.entries(parsedContent).map(([key, value]) => {
          // Skip empty values
          if (!value) return null;

          // Format the key as a readable title
          const title = key
            .split(/[_-]/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          // Handle different value types
          let displayValue: string;
          if (typeof value === 'string') {
            displayValue = value;
          } else if (typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
          } else {
            displayValue = String(value);
          }

          return (
            <div key={key} className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-4">
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-2 capitalize">
                {title}
              </h3>
              <p className="text-sm text-[color:var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {displayValue}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  // Markdown/plain text content - try to render as markdown
  if (content.includes('**') || content.includes('##') || content.includes('*')) {
    return <MarkdownRenderer content={content} />;
  }

  // Plain text content
  return (
    <div>
      <p className="text-sm text-[color:var(--text-primary)] whitespace-pre-wrap leading-relaxed">
        {content}
      </p>
    </div>
  );
}

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { isCollapsed } = useSidebar();
  const { addToast } = useToast();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  // Extract patient ID from params
  useEffect(() => {
    const getPatientId = async () => {
      const resolvedParams = await params;
      setPatientId(resolvedParams.id);
    };
    getPatientId();
  }, [params]);

  // Fetch patient data on mount
  useEffect(() => {
    if (!patientId) return;

    const fetchPatient = async () => {
      try {
        setLoading(true);
        const client = getApiClient();
        const response = await client.patients.get(patientId);
        setPatient(response);
        setError(null);

        // Fetch patient's clinical notes
        const notesResponse = await client.notes.listByPatient(patientId, { limit: 50 });
        setNotes(notesResponse.notes);
      } catch (err) {
        // Handle 404 (patient not found or access denied) with generic message
        if (err instanceof Error && 'statusCode' in err) {
          const apiError = err as any;
          if (apiError.statusCode === 404) {
            setError("Patient not found or access denied");
          } else {
            setError(err.message);
          }
        } else {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load patient';
          setError(errorMessage);
        }
        addToast({
          type: 'error',
          title: 'Error Loading Patient',
          message: error || 'Failed to load patient'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
    // Only depend on patientId - NOT on addToast to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-[color:var(--color-background)]">
        <SideNav />
        <main className={`flex items-center justify-center flex-1 px-6 transition-all duration-300 ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}>
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 text-[color:var(--text-tertiary)] animate-spin" />
            <p className="text-sm text-[color:var(--text-secondary)]">Loading patient...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex h-screen flex-col bg-[color:var(--color-background)]">
        <SideNav />
        <main className={`flex items-center justify-center flex-1 px-6 transition-all duration-300 ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}>
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <h1 className="text-2xl font-semibold text-[color:var(--text-primary)] mt-4">{error || 'Patient not found'}</h1>
            <Link href="/patients" className="mt-4 inline-flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400">
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const age = patient?.dateOfBirth 
    ? Math.floor((new Date().getTime() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="flex h-screen flex-col bg-[color:var(--color-background)]">
      <SideNav />

      <main
        className={`flex h-screen flex-1 flex-col overflow-hidden transition-all duration-300 ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Top Section - Patient Info */}
        <motion.div
          className="border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-6 py-4 flex-shrink-0 space-y-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header Row - Name & Button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Link
                  href="/patients"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-card-strong)] transition flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-semibold text-[color:var(--text-primary)]">{patient.firstName} {patient.lastName}</h1>
                  <p className="text-sm text-[color:var(--text-secondary)] mt-0.5">
                    {patient.medicalRecordNumber && `${patient.medicalRecordNumber} • `}
                    {age ? `${age} years` : 'N/A'} • {patient.gender || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

          <Link href={`/scribe/new?patientId=${patientId}`}>
            <motion.button
              className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--button-primary-hover)] transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-4 w-4" />
              Add notes
            </motion.button>
          </Link>
          </div>

          {/* Details Row 1 - Contact & Demographics */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Contact */}
            {(patient.email || patient.phone) && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--surface-card-strong)]">
                {patient.email && (
                  <a
                    href={`mailto:${patient.email}`}
                    className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition"
                    title={patient.email}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate max-w-xs">{patient.email}</span>
                  </a>
                )}
                {patient.email && patient.phone && <span className="text-[color:var(--border-subtle)]">•</span>}
                {patient.phone && (
                  <a
                    href={`tel:${patient.phone}`}
                    className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition"
                    title={patient.phone}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{patient.phone}</span>
                  </a>
                )}
              </div>
            )}

            {/* Address */}
            {patient.address && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[color:var(--surface-card-strong)] text-xs text-[color:var(--text-secondary)]">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate max-w-xs">{patient.address}</span>
              </div>
            )}

            {/* DOB */}
            {patient.dateOfBirth && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[color:var(--surface-card-strong)] text-xs text-[color:var(--text-secondary)]">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{new Date(patient.dateOfBirth).toLocaleDateString()}</span>
              </div>
            )}

            {/* Language */}
            {patient.primaryLanguage && (
              <div className="px-3 py-1.5 rounded-full bg-[color:var(--surface-card-strong)] text-xs text-[color:var(--text-secondary)]">
                {patient.primaryLanguage}
              </div>
            )}
          </div>

          {/* Details Row 2 - Allergies & Medications */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Allergies */}
            {patient.allergies && patient.allergies.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-red-600">
                    {patient.allergies.length} Allergie{patient.allergies.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Allergy Details Tooltip/Expandable */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/5 border border-red-500/20">
                  {patient.allergies?.slice(0, 2).map((allergy, idx) => (
                    <span key={idx} className="text-xs text-red-600">
                      {allergy.allergen}
                      {idx === 0 && patient.allergies && patient.allergies.length > 1 && patient.allergies.length > 2 ? ',' : ''}
                      {idx === 1 && patient.allergies && patient.allergies.length > 2 ? `, +${patient.allergies.length - 2}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Medications */}
            {patient.medications && patient.medications.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <Pill className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-blue-600">
                    {patient.medications.length} Medication{patient.medications.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Medication Details Tooltip/Expandable */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/20">
                  {patient.medications?.slice(0, 2).map((med, idx) => (
                    <span key={idx} className="text-xs text-blue-600">
                      {med.name}
                      {idx === 0 && patient.medications && patient.medications.length > 1 && patient.medications.length > 2 ? ',' : ''}
                      {idx === 1 && patient.medications && patient.medications.length > 2 ? `, +${patient.medications.length - 2}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Bottom Section - Clinical Notes */}
        <motion.div
          className="flex-1 flex flex-col overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Notes Header */}
          <div className="border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]/50 px-6 py-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[color:var(--text-tertiary)]" />
              <h2 className="font-semibold text-[color:var(--text-primary)]">Clinical Notes</h2>
              {notes && notes.length > 0 && (
                <span className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold bg-[color:var(--surface-card-strong)] text-[color:var(--text-secondary)]">
                  {notes.length}
                </span>
              )}
            </div>
          </div>

          {/* Notes Grid */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <motion.div
              className="grid gap-4 auto-rows-max md:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: 0.05 },
                },
              }}
            >
              {notes && notes.length > 0 ? (
                notes.map((note) => (
                  <motion.button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="group text-left rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-4 hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card-hover)] hover:shadow-lg transition-all"
                    variants={fadeInUp}
                    whileHover={{ y: -4 }}
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[color:var(--text-tertiary)]">
                            {note.created_at ? new Date(note.created_at).toLocaleDateString() : 'Date unknown'}
                          </p>
                          <p className="text-sm font-semibold text-[color:var(--text-primary)] mt-1.5 capitalize line-clamp-1">
                            {note.title || `${note.note_type} Note`}
                          </p>
                        </div>
                      </div>

                      {/* Tags */}
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {note.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--surface-card-strong)] text-[color:var(--text-tertiary)] border border-[color:var(--border-subtle)]">
                              {tag}
                            </span>
                          ))}
                          {note.tags.length > 2 && (
                            <span className="text-xs px-2 py-0.5 rounded-full text-[color:var(--text-tertiary)]">
                              +{note.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Preview */}
                      <p className="text-sm text-[color:var(--text-secondary)] line-clamp-3 leading-relaxed">
                        {note.content?.substring(0, 150) || 'No content'}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-[color:var(--border-subtle)]">
                        <span className="text-xs text-[color:var(--text-tertiary)] capitalize">{note.note_type}</span>
                        <ChevronRight className="h-4 w-4 text-[color:var(--text-tertiary)] group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.button>
                ))
              ) : (
                <div className="col-span-full flex items-center justify-center py-16">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-[color:var(--text-tertiary)] mx-auto opacity-50" />
                    <p className="mt-3 text-sm text-[color:var(--text-secondary)]">No clinical notes yet</p>
                    <p className="text-xs text-[color:var(--text-tertiary)] mt-1">Add your first note to get started</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      </main>

      {/* Note Detail Modal */}
      {selectedNote && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedNote(null)}
        >
          <motion.div
            className="w-full max-w-2xl rounded-lg bg-[color:var(--surface-card)] border border-[color:var(--border-subtle)] shadow-xl flex flex-col max-h-[90vh]"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-card-strong)] px-6 py-4 flex-shrink-0">
              <div>
                <p className="text-xs font-medium text-[color:var(--text-tertiary)] capitalize">{selectedNote.status}</p>
                <h2 className="text-lg font-semibold text-[color:var(--text-primary)] mt-1">{selectedNote.title || 'Clinical Note'}</h2>
              </div>
              <motion.button
                onClick={() => setSelectedNote(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-card-hover)] transition flex-shrink-0"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-4">
                <div className="border-b border-[color:var(--border-subtle)] pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-medium text-[color:var(--text-primary)]">Note Type</h3>
                    <span className="text-sm text-[color:var(--text-secondary)] capitalize font-medium">{selectedNote.note_type}</span>
                  </div>
                  {selectedNote.tags && selectedNote.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedNote.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-1 rounded-full bg-[color:var(--surface-card-strong)] text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <NoteContentRenderer content={selectedNote.content} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-card-strong)] px-6 py-4 flex-shrink-0">
              <motion.button
                onClick={() => setSelectedNote(null)}
                className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--surface-card-hover)] transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Close
              </motion.button>
              <motion.button
                onClick={() => {
                  addToast({
                    type: 'info',
                    title: 'Note Editor',
                    message: 'Note editing feature coming soon'
                  });
                }}
                className="rounded-lg bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--button-primary-hover)] transition"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Edit Note
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
