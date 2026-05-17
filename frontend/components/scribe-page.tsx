"use client";

import {
  useEffect,
  useMemo,
  useState,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import type { SVGProps } from "react";
import { motion, type Variants, type Easing } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ClipboardCheck,
  Mic,
  NotebookPen,
  ShieldCheck,
  User,
} from "lucide-react";

import { SideNav } from "@/components/side-nav";
import { useSidebar } from "@/lib/sidebar-context";
import { getApiClient, type CreateNoteRequest } from "@/lib/api-client-unified";
import { contentCache, CACHE_KEYS } from "@/lib/content-cache";
import { useToast } from "@/components/toast";
import { PatientForm } from "@/components/patient-form";
import { TemplateSelector } from "@/components/template-selector";
import { useTemplateContext } from "@/lib/template-context";
import { exportNotesAsPdf } from "@/lib/pdf-export";
import { useChunkedRecordingUpload } from "@/lib/hooks/useChunkedRecordingUpload";
import { waitForCompletionOptimized } from "@/lib/chunked-upload-client";
import type { Template } from "@/lib/hooks/useTemplates";
import type {
  ClinicalTask,
  CareOrder,
  DiagnosticResult,
  TimelineEvent,
  DecisionSupportAlert,
  FollowUpItem,
  TranscriptSegment,
  BillingSummary,
  SessionStatus,
} from "@/types/scribe-api";

type PatientOverview = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  mrn?: string;
  medicalRecordNumber?: string;
  email?: string;
  phone?: string;
  primaryLanguage?: string;
  allergies?: Array<{ allergen: string; reaction: string }>;
  medications?: Array<{ name: string; dose: string; frequency: string }>;
  careTeam?: string[];
};

type Vitals = {
  bloodPressure?: string;
  heartRate?: string;
  respiratoryRate?: string;
  oxygenSaturation?: string;
  temperature?: string;
  painScore?: string;
};

type ScribeNoteSections = {
  [key: string]: string;  // Template-agnostic: maps section keys to content
};

type TemplateSection = {
  key: string;
  title: string;
  helper: string;
};

type ScribeWorkspaceData = {
  patient?: PatientOverview;
  vitals?: Vitals;
  noteSections?: ScribeNoteSections;
  tasks?: ClinicalTask[];
  orders?: CareOrder[];
  diagnostics?: DiagnosticResult[];
  timeline?: TimelineEvent[];
  decisionSupport?: DecisionSupportAlert[];
  followUps?: FollowUpItem[];
  billing?: BillingSummary;
  transcriptSegments?: TranscriptSegment[];
};

const easeOutExpo: Easing = [0.12, 0.12, 0.1, 0.1];

// Helper to get the API client
const getClient = () => getApiClient();

/**
 * Extract analysis results from SSE/backend response
 * Handles standardized API format: analysis.extracted_sections.response.content
 * 
 * Returns:
 * - extractedContent: Full AI-generated report text
 * - transcriptSegments: Array of transcript segments with speaker info
 */
function extractAnalysisResults(statusResult: any): {
  extractedContent: Record<string, string>;
  transcriptSegments: TranscriptSegment[];
} {
  const extractedContent: Record<string, string> = {};
  const transcriptSegments: TranscriptSegment[] = [];

  // Extract AI-generated report from standardized API response
  // API returns: analysis.extracted_sections.response.content = full markdown report
  const aiReport = statusResult.analysis?.extracted_sections?.response?.content;
  if (aiReport && typeof aiReport === 'string' && aiReport.trim().length > 0) {
    // Store as 'response' key to maintain compatibility
    extractedContent['response'] = aiReport;

  }

  // Extract transcript segments from speaker diarization
  if (statusResult.analysis?.transcription_metadata?.speaker_diarization) {
    const speakers = statusResult.analysis.transcription_metadata.speaker_diarization;
    speakers.forEach((speaker: any, idx: number) => {

    });
  }

  return { extractedContent, transcriptSegments };
}

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
      staggerChildren: 0.08,
    },
  },
};

type NoteTabId = "soap";

const noteTabs: Array<{ id: NoteTabId; label: string }> = [
  { id: "soap", label: "Note" },
];

type NoteSectionKey = string;  // Template-agnostic: any section key from current template

type AllTabId = NoteTabId | ConsoleTabId;

type ConsoleTabId =
  | "patient"
  | "tasks"
  | "orders"
  | "diagnostics"
  | "timeline"
  | "followups"
  | "alerts"
  | "billing";

/**
 * Default console tabs - used as fallback when API is unavailable
 * @deprecated - Tabs should be fetched from Promise.resolve({ tabs: [] })
 */
const DEFAULT_CONSOLE_TABS: Array<{ id: ConsoleTabId; label: string }> = [
  { id: "patient", label: "Patient" },
  { id: "tasks", label: "Tasks" },
  { id: "orders", label: "Orders" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "timeline", label: "Timeline" },
  { id: "followups", label: "Follow-ups" },
  { id: "alerts", label: "Alerts" },
  { id: "billing", label: "Billing" },
];

export function ScribePage({ sessionIdFromUrl }: { sessionIdFromUrl?: string }) {
  const [workspaceData, setWorkspaceData] = useState<ScribeWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AllTabId>("soap");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [backendTemplates, setBackendTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  
  // Dynamic console tabs from API
  const [consoleTabs, setConsoleTabs] = useState<Array<{ id: ConsoleTabId; label: string }>>(DEFAULT_CONSOLE_TABS);
  const [tabsLoading, setTabsLoading] = useState(true);
  
  // Get templates from context
  const { templates, loading: contextLoading, error: contextError } = useTemplateContext();
  
  // Initialize templates from context
  useEffect(() => {

    if (!contextLoading && templates.length > 0) {

      setBackendTemplates(templates);
      // Set default template to SOAP Note (General) if available, otherwise use first template
      if (!selectedTemplateId) {
        const soapTemplate = templates.find(t => t.template_key === 'soap-general');
        const defaultTemplate = soapTemplate || templates[0];
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
        }
      }
      setTemplatesLoading(false);
    }
  }, [templates, contextLoading]);
  
  // Load workspace tabs configuration from API
  useEffect(() => {
    async function loadTabs() {
      try {
        setTabsLoading(true);
        const response = await contentCache.getOrFetch(
          CACHE_KEYS.WORKSPACE_TABS,
          () => Promise.resolve({ tabs: [] })
        );
        
        // Convert API response to component format, filtering enabled tabs
        const enabledTabs = response.tabs
          .filter((tab: any) => tab.enabled)
          .map((tab: any) => ({
            id: tab.id as ConsoleTabId,
            label: tab.label,
          }))
          .sort((a: any, b: any) => {
            // Maintain default order if not specified
            const defaultOrder = DEFAULT_CONSOLE_TABS.findIndex(t => t.id === a.id);
            const newOrder = DEFAULT_CONSOLE_TABS.findIndex(t => t.id === b.id);
            return defaultOrder - newOrder;
          });
        
        setConsoleTabs(enabledTabs.length > 0 ? enabledTabs : DEFAULT_CONSOLE_TABS);
      } catch (error) {
        // Use defaults on error
        setConsoleTabs(DEFAULT_CONSOLE_TABS);
      } finally {
        setTabsLoading(false);
      }
    }

    loadTabs();
  }, []);
  
  // Get patient ID from query parameters - memoize to prevent infinite loops
  const searchParams = useSearchParams();
  const queryPatientId = useMemo(() => searchParams.get('patientId'), [searchParams]);
  
  // Patient/Encounter context
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [activeEncounterId, setActiveEncounterId] = useState<string | undefined>(undefined);
  
  // Scribe session and note management
  const [scribeSessionId, setScribeSessionId] = useState<string | null>(sessionIdFromUrl || null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [sessionCreationFailed, setSessionCreationFailed] = useState(false);

  // Sync activePatientId with URL params when they change
  useEffect(() => {
    if (queryPatientId && queryPatientId !== activePatientId) {

      setActivePatientId(queryPatientId);
    }
  }, [queryPatientId, activePatientId]);
  
  // Patient selection modal
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [availablePatients, setAvailablePatients] = useState<PatientOverview[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientModalTab, setPatientModalTab] = useState<"search" | "create">("search");
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [userOrganizationId, setUserOrganizationId] = useState<string | null>(null);
  
  const { isCollapsed } = useSidebar();
  const { addToast } = useToast();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionInitializingRef = useRef<boolean>(false);

  // Chunked upload hook for streaming audio to backend
  const {
    startChunkedUpload,
    isUploading: isChunkedUploading,
    uploadProgress,
    uploadSessionId
  } = useChunkedRecordingUpload({
    chunkSize: 256 * 1024, // 256KB chunks
    enableLogging: true,
    onSessionStarted: (sessionId) => {

    },
    onProgressChange: (progress) => {

    }
  });

  // Note saving state
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingAllSections, setIsSavingAllSections] = useState(false);

  // Export state
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Recording completion/processing state (IN-APP FLOW)
  const [recordingProcessing, setRecordingProcessing] = useState(false);
  const [recordingProcessingMessage, setRecordingProcessingMessage] = useState('');

  // File upload state (FILE UPLOAD FLOW)
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file is audio
    if (!file.type.startsWith('audio/')) {
      addToast({
        type: 'error',
        title: 'Invalid File',
        message: 'Please upload an audio file'
      });
      return;
    }

    // Create blob from file and set it for preview
    setRecordedBlob(file);
    setIsPreviewing(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Save all sections
  const handleSaveAllSections = async () => {
    if (!scribeSessionId) {
      addToast({
        type: 'error',
        title: 'Cannot Save',
        message: 'No active session. Please refresh the page.'
      });
      return;
    }

    const sectionsToSave = Object.entries(noteSections).filter(
      ([, content]) => content && content.trim().length > 0
    );

    if (sectionsToSave.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Content',
        message: 'No sections with content to save.'
      });
      return;
    }

    setIsSavingAllSections(true);
    const failedSections: string[] = [];

    try {
      for (const [sectionKey, sectionContent] of sectionsToSave) {
        try {
          await getClient().sessions.updateNoteSection(
            scribeSessionId,
            sectionKey,
            sectionContent,
            activeEncounterId
          );
        } catch (error) {
          failedSections.push(sectionKey);
        }
      }

      if (failedSections.length === 0) {
        addToast({
          type: 'success',
          title: 'All Saved',
          message: `Successfully saved ${sectionsToSave.length} section(s)`
        });
      } else {
        addToast({
          type: 'warning',
          title: 'Partial Save',
          message: `Saved ${sectionsToSave.length - failedSections.length} of ${sectionsToSave.length} sections`
        });
      }
    } catch (error) {
      let errorMessage = 'Failed to save sections';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: errorMessage
      });
    } finally {
      setIsSavingAllSections(false);
    }
  };

  // Save complete note
  const handleSaveNote = async () => {
    if (!currentNoteId) {
      addToast({
        type: 'error',
        title: 'Cannot Save',
        message: 'No note linked to this session. Please link a patient first.'
      });
      return;
    }

    if (Object.keys(noteSections).length === 0) {
      addToast({
        type: 'warning',
        title: 'Empty Note',
        message: 'No content to save. Please add or record some content first.'
      });
      return;
    }

    setIsSavingNote(true);
    try {
      // Build the note content from all sections
      let noteContent = '';
      for (const [key, content] of Object.entries(noteSections)) {
        if (content && content.trim().length > 0) {
          const sectionTitle = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          noteContent += `\n\n## ${sectionTitle}\n\n${content}`;
        }
      }

      await getClient().notes.update(currentNoteId, {
        content: noteContent.trim(),
        status: 'completed',
      });

      addToast({
        type: 'success',
        title: 'Note Saved',
        message: 'Your clinical note has been saved successfully'
      });
    } catch (error) {
      let errorMessage = 'Failed to save note';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: errorMessage
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  // Export notes as PDF
  const handleExportPdf = async () => {
    try {
      if (Object.keys(noteSections).length === 0) {
        addToast({
          type: 'warning',
          title: 'Empty Note',
          message: 'No content to export. Please add or record some content first.'
        });
        return;
      }

      setIsExportingPdf(true);
      
      const patientName = activePatient 
        ? `${activePatient.firstName} ${activePatient.lastName}` 
        : 'Patient';
      
      await exportNotesAsPdf({
        patientName,
        mrn: activePatient?.mrn,
        noteSections,
        timestamp: new Date(),
      });

      addToast({
        type: 'success',
        title: 'PDF Exported',
        message: 'Your clinical note has been exported as PDF'
      });
    } catch (error) {
      let errorMessage = 'Failed to export PDF';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: errorMessage
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Patient selection handler
  const handlePatientSelect = (patient: PatientOverview) => {

    setActivePatientId(patient.id);
    setShowPatientModal(false);
    setPatientSearchQuery("");
    
    // Bind patient to current session
    if (scribeSessionId) {

      getClient().sessions.bindPatient(scribeSessionId, patient.id)
        .then(result => {

          addToast({
            type: 'success',
            title: 'Patient Linked',
            message: `Linked to ${patient.firstName} ${patient.lastName}`
          });
        })
        .catch(error => {
          
          let errorMessage = 'Failed to link patient to session. Please try again.';
          if (error instanceof Error && 'code' in error) {
            const code = (error as any).code;
            if (code === 'not_found') {
              errorMessage = 'Patient not found in the system.';
            } else if (code === 'forbidden') {
              errorMessage = 'You do not have permission to link this patient.';
            } else if (code === 'invalid_request') {
              errorMessage = 'Invalid patient ID or session ID.';
            }
          }
          
          addToast({
            type: 'error',
            title: 'Binding Failed',
            message: errorMessage
          });
        });
    } else {
      addToast({
        type: 'warning',
        title: 'Session Error',
        message: 'No active session - patient will be linked but not persisted'
      });
    }
  };

  const handleCreatePatient = async (formData: {
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    medical_record_number?: string;
  }) => {
    if (!userOrganizationId) {
      throw new Error("Organization ID not available");
    }

    setIsCreatingPatient(true);
    try {
      const newPatient = await getClient().patients.create({
        ...formData,
        organization_id: userOrganizationId,
      });

      addToast({
        type: 'success',
        title: 'Patient Created',
        message: `${newPatient.firstName} ${newPatient.lastName} has been added successfully`
      });

      // Automatically link the newly created patient
      handlePatientSelect({
        id: newPatient.id,
        firstName: newPatient.firstName,
        lastName: newPatient.lastName,
        dateOfBirth: newPatient.dateOfBirth || '',
        gender: newPatient.gender || '',
        mrn: newPatient.medicalRecordNumber || '',
        email: newPatient.email,
        phone: newPatient.phone,
      });

      // Close modal and reset
      setShowPatientModal(false);
      setPatientModalTab("search");

      // Refresh patient list
      const response = await getClient().patients.list({ limit: 100 });
      const mappedPatients: PatientOverview[] = response.patients.map((p: any) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dateOfBirth || '',
        gender: p.gender || '',
        mrn: p.mrn,
        medicalRecordNumber: p.medicalRecordNumber,
        email: p.email,
        phone: p.phone,
      }));
      setAvailablePatients(mappedPatients);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create patient';
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: errorMessage
      });
      throw error;
    } finally {
      setIsCreatingPatient(false);
    }
  };

  // Recording functions
  const startRecording = async () => {
    try {
      // Step 1: Initialize chunked upload session BEFORE starting recording
      let uploadSessionId: string | null = null;
      let recordingId: string | null = null;
      let chunkIndex = 0;
      let totalAudioSize = 0; // Track total audio size for finalize
      
      try {

        const templateKey = getSelectedTemplateKey();

        const initResponse = await getClient().chunkedUpload.init({
          templateId: templateKey,
          patientId: activePatientId || undefined,
          scribeSessionId: scribeSessionId || undefined,
          encounterId: activeEncounterId || undefined,
        });
        
        // Handle both camelCase and snake_case response
        uploadSessionId = initResponse.sessionId;
        recordingId = initResponse.recordingId;

        if (!uploadSessionId) {
          throw new Error('No sessionId returned from init');
        }
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Upload Session Error',
          message: 'Failed to initialize upload session. Recording will be local only.'
        });
      }

      // Step 2: Start microphone recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks: Blob[] = [];
      let isRecordingStopping = false; // Flag to prevent processing final chunk twice

      recorder.ondataavailable = async (event) => {

        // SAFETY: Never upload chunks if recording is stopping
        if (isRecordingStopping) {

          return;
        }
        
        if (event.data.size > 0) {
          chunks.push(event.data);
          totalAudioSize += event.data.size; // Accumulate total size

          // Step 3: Send chunk to backend immediately if session initialized
          // SKIP if recording is stopping (final chunk will be sent separately)
          if (uploadSessionId && !isRecordingStopping) {
            try {


              // Use API client to upload chunk
              const result = await getClient().chunkedUpload.uploadChunk(
                uploadSessionId,
                event.data,
                chunkIndex,
                0, // Don't know total chunks yet during recording
                false // Not the last chunk
              );

              chunkIndex++;
            } catch (error) {
              // Log the specific error for debugging
              if (error instanceof Error) {
              }
            }
          }
        }
      };

      recorder.onstop = async () => {
        // IMMEDIATELY stop the recorder and clear handlers

        isRecordingStopping = true;

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // CRITICAL: Clear the ondataavailable handler to prevent further chunk uploads
        recorder.ondataavailable = null;

        // Step 4: Create audio blob for preview
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });

        // Step 5a: Send final chunk with totalChunks to backend if session initialized
        // Send the LAST CHUNK from recording with metadata indicating recording is complete
        if (uploadSessionId && chunkIndex > 0 && chunks.length > 0) {
          try {
            const lastChunkIndex = chunkIndex - 1; // 0-based index of last chunk
            const totalChunksCount = chunkIndex; // Total number of chunks sent

            // Send the last actual chunk data from chunks array
            const lastChunkBlob = chunks[chunks.length - 1];

            // Use API client to upload final chunk with totalChunks
            const result = await getClient().chunkedUpload.uploadChunk(
              uploadSessionId,
              lastChunkBlob,
              lastChunkIndex,
              totalChunksCount,
              true // This is the last chunk
            );

          } catch (error) {
            if (error instanceof Error) {
            }
          }
        }

        // Step 5b: Finalize upload session if it was initialized
        // Send totalSize so backend can validate all chunks were received
        if (uploadSessionId) {
          try {
            setRecordingProcessing(true);
            setRecordingProcessingMessage('Finalizing audio upload...');



            const finalizeResponse = await getClient().chunkedUpload.finalize(uploadSessionId, totalAudioSize);

            const recordingId = finalizeResponse.id;

            setRecordingProcessingMessage('Processing your recording with AI...');
            
            addToast({
              type: 'success',
              title: 'Recording Complete',
              message: 'Your audio has been uploaded. AI is now processing the recording...'
            });

            // NOW WAIT FOR SSE COMPLETION!

            try {
              const statusResult = await waitForCompletionOptimized(recordingId, {
                enableLogging: true,
                onProgress: (data) => {

                  setRecordingProcessingMessage(`Processing: ${data.progress || 0}%`);
                },
              });


              // Extract analysis and update workspace
              const { extractedContent, transcriptSegments } = extractAnalysisResults(statusResult);
              
              setWorkspaceData((prev) => ({
                ...prev,
                noteSections: {
                  ...prev?.noteSections,
                  ...extractedContent,
                },
                transcriptSegments: transcriptSegments.length > 0 ? transcriptSegments : prev?.transcriptSegments,
              }));

              setRecordingProcessing(false);
              setRecordingProcessingMessage('');
              
              // IMPORTANT: Clear recording state to prevent any further chunk uploads
              setRecordedChunks([]);
              setMediaRecorder(null);
              setIsRecording(false);
              setIsPaused(false);

            } catch (sseError) {
              setRecordingProcessing(false);
              setRecordingProcessingMessage('');
              addToast({
                type: 'error',
                title: 'Processing Error',
                message: 'Failed to process recording. Please try again.'
              });
              
              // IMPORTANT: Clear recording state even on error
              setRecordedChunks([]);
              setMediaRecorder(null);
              setIsRecording(false);
              setIsPaused(false);
            }

          } catch (error) {
            setRecordingProcessing(false);
            setRecordingProcessingMessage('');
            
            addToast({
              type: 'error',
              title: 'Finalization Error',
              message: 'Failed to finalize upload. Backend will process available chunks.'
            });
          }
        }

        // Note: recordingProcessing will be cleared when workspace updates with results or on error

        // For in-app recording: don't show preview since audio is auto-uploading
        // Only show preview for file uploads (handleFileUpload sets isPreviewing)
        // setRecordedBlob(audioBlob); // Keep blob in case user wants to edit later
        // setIsPreviewing(true); // Don't preview for in-app recording
        
        // Store blob but don't trigger preview - the audio is already being processed
        setRecordedBlob(null);
        setIsPreviewing(false);

        // Reset recording state
        setRecordedChunks([]);
        setRecordingTime(0);
      };

      setMediaRecorder(recorder);
      setRecordedChunks(chunks);
      setIsRecording(true);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      recorder.start(30000); // Collect data every 30 seconds and trigger ondataavailable

    } catch (error) {
      addToast({
        type: 'error',
        title: 'Microphone Error',
        message: 'Failed to start recording. Please check microphone permissions.'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setIsPaused(false);

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);

      // Resume the timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const uploadRecording = async (audioBlob: Blob) => {


    try {
      setIsUploadingFile(true);
      setLoading(true);

      addToast({
        type: 'info',
        title: 'Uploading File',
        message: 'Your audio file is being uploaded in chunks...'
      });

      // Step 1: Use chunked upload to send audio in chunks
      // This returns recordingId which is used for the next step
      const templateKey = getSelectedTemplateKey();

      const recordingId = await startChunkedUpload(audioBlob, {
        templateId: templateKey,
        encounterId: activeEncounterId,
        patientId: activePatient?.id || activePatientId || undefined,
        sessionId: scribeSessionId || undefined,
      });


      // Step 2: Wait for processing completion via SSE (replaces polling!)
      addToast({
        type: 'info',
        title: 'Recording Queued',
        message: 'Your audio is being processed. Please wait for transcription and analysis...'
      });


      let statusResult: any;
      try {

        statusResult = await waitForCompletionOptimized(recordingId, {
          enableLogging: true,
          onProgress: (data) => {

            if (data.progress) {

            }
          },
        });

      } catch (sseError) {
        throw sseError;
      }
      
      // Step 3: Extract analysis results using helper function
      const { extractedContent, transcriptSegments } = extractAnalysisResults(statusResult);

      // Step 4: Update workspace with analysis results
      setWorkspaceData((prev) => {
        const updated = {
          ...prev,
          noteSections: {
            ...prev?.noteSections,
            ...extractedContent,
          },
          transcriptSegments: transcriptSegments.length > 0 ? transcriptSegments : prev?.transcriptSegments,
        };

        return updated;
      });

      // Step 5: Fetch ALL notes linked to this session (CRITICAL per SSE_GUIDE)
      // This implements the documented flow: Get notes by session ID after processing completes
      if (scribeSessionId && Object.keys(extractedContent).length > 0) {
        try {

          const notesResponse = await getClient().notes.getByScribeSession(scribeSessionId);
          const linkedNotes = notesResponse.notes || [];

          // Build note content from extracted sections (reusable for all notes)
          let noteContent = '';
          for (const [key, content] of Object.entries(extractedContent)) {
            const sectionTitle = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            noteContent += `\n\n## ${sectionTitle}\n\n${content}`;
          }
          const finalNoteContent = noteContent.trim();

          // Step 6: Update ALL linked notes with analysis (per SSE_GUIDE Step 4)
          if (linkedNotes.length > 0) {

            for (const note of linkedNotes) {
              try {

                await getClient().notes.update(note.id, {
                  content: finalNoteContent,
                  status: 'draft',
                  title: note.title || 'Auto-generated note',
                  tags: Array.from(new Set([...(note.tags || []), 'auto-generated', 'recording-based'])),
                } as any);

              } catch (noteUpdateError) {
                // Continue updating other notes even if one fails
              }
            }

          } else {

          }
        } catch (noteFetchError) {
          // Don't fail the entire upload if note fetching fails
          // Fall back to using currentNoteId if available
          if (currentNoteId) {
            try {

              let noteContent = '';
              for (const [key, content] of Object.entries(extractedContent)) {
                const sectionTitle = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                noteContent += `\n\n## ${sectionTitle}\n\n${content}`;
              }

              await getClient().notes.update(currentNoteId, {
                content: noteContent.trim(),
                status: 'draft',
                title: 'Auto-generated note',
                tags: ['auto-generated', 'recording-based'],
              } as any);

            } catch (fallbackError) {
            }
          }
        }
      } else if (currentNoteId && Object.keys(extractedContent).length > 0) {
        // Legacy fallback if no session ID but note ID exists
        try {

          let noteContent = '';
          for (const [key, content] of Object.entries(extractedContent)) {
            const sectionTitle = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            noteContent += `\n\n## ${sectionTitle}\n\n${content}`;
          }

          await getClient().notes.update(currentNoteId, {
            content: noteContent.trim(),
            status: 'draft',
            title: 'Auto-generated note',
            tags: ['auto-generated', 'recording-based'],
          } as any);

        } catch (noteError) {
        }
      }

      // Clear processing state
      setRecordingProcessing(false);
      setRecordingProcessingMessage('');
      setIsUploadingFile(false);

      addToast({
        type: 'success',
        title: 'File Processed',
        message: 'Your audio file has been transcribed and analyzed'
      });

      setLoading(false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload recording. Please try again.';
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: errorMessage
      });
      setRecordingProcessing(false);
      setRecordingProcessingMessage('');
      setLoading(false);
    }
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    setIsPreviewing(false);
  };

  const uploadPreviewRecording = async () => {


    if (recordedBlob) {

      await uploadRecording(recordedBlob);

      setRecordedBlob(null);
      setIsPreviewing(false);
    }
  };

  // Generate a unique scribe session ID when component mounts and register with backend
  useEffect(() => {
    let active = true;

    const initializeSession = async () => {
      // CRITICAL: Check if already initializing (prevents race conditions)
      if (sessionInitializingRef.current) {

        return;
      }

      // If we already have a session ID in state, don't create a new one
      if (scribeSessionId) {

        return;
      }

      // If sessionId is provided from URL, we assume it's already been created
      if (sessionIdFromUrl) {
        setScribeSessionId(sessionIdFromUrl);
        sessionStorage.setItem('scribe_session_id', sessionIdFromUrl);

        return;
      }

      // Otherwise, check if we already have a session ID in sessionStorage
      const existingSessionId = sessionStorage.getItem('scribe_session_id');
      const existingNoteId = sessionStorage.getItem('activeNoteId');
      
      let sessionId: string;

      if (existingSessionId) {
        // We have an existing session, use it
        sessionId = existingSessionId;

        if (active) {
          setScribeSessionId(sessionId);
        }
      } else {
        // Set the ref to prevent concurrent attempts
        sessionInitializingRef.current = true;

        // Create a new session via backend - backend will generate the session_id
        try {

          // Send template key (name) to backend, not UUID
          const response = await getClient().sessions.create(getSelectedTemplateKey(), {
            initialPatientId: activePatientId || undefined,
            metadata: {
              template_used: selectedTemplateId,
              session_start_time: new Date().toISOString(),
            },
          });
          sessionId = response.sessionId || response.session_id;
          sessionStorage.setItem('scribe_session_id', sessionId);

          if (active) {
            setScribeSessionId(sessionId);
            setSessionCreationFailed(false);
          }
        } catch (error) {
          if (active) {
            setSessionCreationFailed(true);
          }
          addToast({
            type: 'error',
            title: 'Session Error',
            message: 'Failed to initialize scribe session. Please refresh the page.'
          });
          return;
        } finally {
          // Always clear the flag, even on error
          sessionInitializingRef.current = false;
        }
      }

      // Restore note ID if available
      if (existingNoteId) {
        setCurrentNoteId(existingNoteId);

      }
    };

    initializeSession();

    return () => {
      active = false;
    };
    // Note: addToast intentionally not in dependencies to avoid infinite loops
    // scribeSessionId is intentionally not in dependencies - we only want to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromUrl]);

  // Create a note when patient is selected
  useEffect(() => {
    // Create a note when both patient and session are available
    if (!activePatientId || !scribeSessionId) {
      // Patient not selected yet - this is OK, session can start without patient

      return;
    }

    // Check if we already have a note for this session and patient
    if (currentNoteId) {

      return;
    }

    // Create note automatically when patient is linked
    const createNote = async () => {
      try {

        const note = await getClient().notes.create({
          patient_id: activePatientId,
          scribe_page_id: scribeSessionId,
          title: `Clinical Note - ${new Date().toLocaleDateString()}`,
          content: 'Awaiting transcription...', // Backend requires non-empty content
          note_type: 'scribe',
          tags: ['scribe-session', 'auto-created'],
          metadata: {
            custom_fields: {
              session_start_time: new Date().toISOString(),
              template_used: selectedTemplateId,
            }
          }
        });

        setCurrentNoteId(note.id);
        sessionStorage.setItem('activeNoteId', note.id);

        addToast({
          type: 'success',
          title: 'Note Created',
          message: 'Note has been linked to the selected patient'
        });
      } catch (error) {
        addToast({
          type: 'error',
          title: 'Note Creation Failed',
          message: 'Failed to create note. You can continue recording.'
        });
      }
    };

    createNote();
    
    // Note: We intentionally don't include addToast in dependencies to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePatientId, scribeSessionId, selectedTemplateId, currentNoteId]);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      // Session is always available now
      if (!scribeSessionId) {

        setLoading(false);
        return;
      }

      setLoading(true);

      try {

        // Always load session data, even without a patient selected
        // This ensures we retrieve saved notes from previous sessions
        const payload = await getClient().sessions.get(scribeSessionId, {
          ...(activePatientId && { patientId: activePatientId }),
          ...(activeEncounterId && { encounterId: activeEncounterId }),
        });

        // Get noteSections from session response
        // Backend populates this by querying linked notes via scribe_page_id
        // Expected format: JSON object with section keys and content values
        // Example: { "Patient Summary": "...", "Medical History": "...", ... }
        let sessionNoteSections = payload.noteSections || {};

        // Fallback: If noteSections is empty, try fetching from notes endpoint
        // This handles cases where the session endpoint returns empty but notes exist
        if (Object.keys(sessionNoteSections).length === 0) {

          try {
            const notesResponse = await getClient().notes.getByScribeSession(scribeSessionId);
            const linkedNotes = notesResponse.notes || [];

            if (linkedNotes.length > 0) {
              const primaryNote = linkedNotes[0];

              if (primaryNote.content) {
                // Try to parse content as JSON (backend stores as JSON)
                try {
                  const parsed = JSON.parse(primaryNote.content);
                  if (typeof parsed === 'object' && parsed !== null) {
                    sessionNoteSections = parsed;

                  }
                } catch (jsonError) {
                  // If JSON parsing fails, try to parse as markdown with headers

                  const lines = primaryNote.content.split('\n');
                  let currentSection: string | null = null;
                  let sectionContent = '';
                  const parsedSections: Record<string, string> = {};
                  
                  for (const line of lines) {
                    const headerMatch = line.match(/^##\s+(.+?)$/);
                    if (headerMatch) {
                      // Save previous section
                      if (currentSection) {
                        const sectionKey = currentSection.toLowerCase().replace(/\s+/g, '_');
                        parsedSections[sectionKey] = sectionContent.trim();
                      }
                      currentSection = headerMatch[1];
                      sectionContent = '';
                    } else if (currentSection) {
                      sectionContent += line + '\n';
                    }
                  }
                  // Save last section
                  if (currentSection) {
                    const sectionKey = currentSection.toLowerCase().replace(/\s+/g, '_');
                    parsedSections[sectionKey] = sectionContent.trim();
                  }
                  
                  if (Object.keys(parsedSections).length > 0) {
                    sessionNoteSections = parsedSections;

                  }
                }
              }
            }
          } catch (notesError) {
            // Continue gracefully - notes simply don't exist yet
          }
        }
        
        // If patient data is not in payload, fetch it separately if we have a patient ID
        let patientData = payload.patient;
        if (!patientData && activePatientId) {
          try {

            patientData = await getClient().patients.get(activePatientId);

          } catch (patientErr) {
            // Don't throw - continue without patient data
          }
        } else if (!patientData && payload.patientId) {
          try {

            patientData = await getClient().patients.get(payload.patientId);

          } catch (patientErr) {
          }
        }

        if (active) {
          // Merge with existing data to preserve any uploaded recordings
          setWorkspaceData((prev) => {
            // Only preserve local sections if they have content
            // Otherwise use backend sections
            const mergedSections = { ...sessionNoteSections };
            if (prev?.noteSections) {
              for (const [key, content] of Object.entries(prev.noteSections)) {
                // Only preserve local content if it exists and has meaningful content
                if (content && content.trim().length > 0) {
                  mergedSections[key] = content;
                }
              }
            }
            
            const newState = {
              ...payload,
              patient: patientData, // Use fetched patient data if available
              noteSections: mergedSections,
              transcriptSegments: prev?.transcriptSegments?.length
                ? prev.transcriptSegments
                : payload.transcriptSegments,
            };

            return newState;
          });
          
          // CRITICAL: Set the template ID from the session so notes render correctly
          // When loading a previous session, we must use its original template
          if (payload.templateId && !selectedTemplateId) {

            setSelectedTemplateId(payload.templateId);
          } else if (payload.templateId && selectedTemplateId && selectedTemplateId !== payload.templateId) {

          }
          
          // NOTE: Don't update activePatientId here as it would cause infinite loop
          // The patient ID should only come from user selection or URL params
        }
      } catch (err) {
        if (active) {
          let errorMessage = "Unable to load scribe workspace data.";
          
          if (err instanceof Error) {
            // Handle specific API error codes
            if ('code' in err) {
              const errorCode = err.code as string;
              if (errorCode === 'invalid_request') {
                errorMessage = "Invalid patient ID or parameters. Please check your input.";
              } else if (errorCode === 'not_found') {
                errorMessage = "Patient not found. Please select a valid patient.";
              } else if (errorCode === 'unauthorized') {
                errorMessage = "Authentication failed. Please log in again.";
              } else if (errorCode === 'forbidden') {
                errorMessage = "Access denied. You don't have permission to view this patient's data.";
              } else if (errorCode === 'server_error') {
                errorMessage = "Server error. Please try again later.";
              } else {
                errorMessage = err.message;
              }
            } else {
              errorMessage = err.message;
            }
          }
          
          addToast({
            type: 'error',
            title: 'Failed to Load Workspace',
            message: errorMessage
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      active = false;
    };
    // Note: addToast is intentionally NOT in dependencies to prevent infinite loops
    // The toast is only shown when there's an error, which is acceptable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scribeSessionId, activePatientId]);

  // Fetch user's organization ID when modal opens for creating patient
  useEffect(() => {
    let active = true;

    async function fetchUserOrganization() {
      if (!showPatientModal || userOrganizationId) return;

      try {
        const user = await getClient().auth.getCurrentUser();
        if (active && user.organization_id) {
          setUserOrganizationId(user.organization_id);
        }
      } catch (error) {
      }
    }

    fetchUserOrganization();

    return () => {
      active = false;
    };
  }, [showPatientModal, userOrganizationId]);

  // Load patients when modal is opened
  useEffect(() => {
    let active = true;

    async function loadPatients() {
      if (!showPatientModal) return;

      setLoadingPatients(true);
      try {
        const response = await getClient().patients.list({ limit: 100 });
        if (active) {
          // Map API response to PatientOverview type
          const mappedPatients: PatientOverview[] = response.patients.map(p => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            dateOfBirth: p.dateOfBirth || '',
            gender: p.gender || '',
            mrn: p.mrn,
            medicalRecordNumber: p.medicalRecordNumber,
            email: p.email || '',
            phone: p.phone || '',
          }));
          setAvailablePatients(mappedPatients);
        }
      } catch (error) {
        if (active) {
          addToast({
            type: 'error',
            title: 'Load Failed',
            message: 'Could not load patient list'
          });
        }
      } finally {
        if (active) {
          setLoadingPatients(false);
        }
      }
    }

    loadPatients();

    return () => {
      active = false;
    };
    // Note: addToast is intentionally NOT in dependencies to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPatientModal]);

  // Helper: Get template key (name like "soap-general") from selected template ID (UUID)
  const getSelectedTemplateKey = (): string => {




    if (!selectedTemplateId) {
      return 'soap-general'; // Fallback only if truly nothing selected
    }
    
    if (backendTemplates.length === 0) {
      return 'soap-general'; // Fallback if templates not loaded
    }

    const template = backendTemplates.find(t => {
      const matches = t.id === selectedTemplateId;

      return matches;
    });
    
    if (!template) {
      return 'soap-general'; // Fallback if template not found
    }
    
    const key = template.template_key;
    if (!key) {
      return 'soap-general';
    }


    return key;
  };

  // Update active note section when template changes
  const activePatient = workspaceData?.patient;
  const vitals = workspaceData?.vitals;
  const noteSections = workspaceData?.noteSections ?? {};
  const tasks = workspaceData?.tasks ?? [];
  const orders = workspaceData?.orders ?? [];
  const diagnostics = workspaceData?.diagnostics ?? [];
  const timeline = workspaceData?.timeline ?? [];
  const decisionSupport = workspaceData?.decisionSupport ?? [];
  const followUps = workspaceData?.followUps ?? [];
  const billing = workspaceData?.billing;
  const transcriptSegments = workspaceData?.transcriptSegments ?? [];

  // Debug: Log workspace data whenever it changes

  const completionScore = useMemo(() => {
    if (billing?.documentationCompleteness === undefined) return null;
    return Math.round(billing.documentationCompleteness * 100);
  }, [billing?.documentationCompleteness]);

  const limitedTasks = useMemo(() => tasks.slice(0, 4), [tasks]);
  const limitedOrders = useMemo(() => orders.slice(0, 4), [orders]);
  const limitedDiagnostics = useMemo(() => diagnostics.slice(0, 4), [diagnostics]);
  const limitedTimeline = useMemo(() => timeline.slice(0, 4), [timeline]);
  const limitedFollowUps = useMemo(() => followUps.slice(0, 4), [followUps]);
  const limitedAlerts = useMemo(() => decisionSupport.slice(0, 3), [decisionSupport]);
  const limitedTranscript = useMemo(() => transcriptSegments.slice(0, 6), [transcriptSegments]);

  const statusChips = [
    {
      id: "patient",
      icon: User,
      label: "Patient",
      value: activePatient ? `${activePatient.firstName} ${activePatient.lastName}` : "Not linked yet",
      helper: activePatient ? `MRN ${activePatient.mrn}` : "Can link after recording",
    },
    {
      id: "dictation",
      icon: Mic,
      label: "Dictation",
      value: scribeSessionId ? "Ready" : "Initializing",
      helper: "Ambient capture",
    },
    {
      id: "note",
      icon: NotebookPen,
      label: "Note",
      value: completionScore !== null ? `${completionScore}% complete` : "Awaiting data",
      helper: "Auto-updates",
    },
    {
      id: "alerts",
      icon: ShieldCheck,
      label: "Alerts",
      value: decisionSupport.length > 0 ? `${decisionSupport.length}` : "Clear",
      helper: "Decision support",
    },
    {
      id: "tasks",
      icon: ClipboardCheck,
      label: "Tasks",
      value: tasks.length > 0 ? `${tasks.length}` : "None",
      helper: "Action items",
    },
  ];

  return (
    <div className="flex h-screen flex-col bg-[color:var(--color-background)]">
      <SideNav />

      {/* Scribe page is always accessible - patient can be linked later */}
      {false && !activePatientId ? (
        <main className={`flex h-screen flex-1 items-center justify-center px-6 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-64"}`}>
          <motion.div
            className="flex flex-col items-center gap-3 text-center"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            <User className="h-12 w-12 text-[color:var(--text-tertiary)]" />
            <h2 className="text-xl font-medium text-[color:var(--text-primary)]">No Patient Selected</h2>
            <p className="text-sm text-[color:var(--text-secondary)] max-w-md">
              Please select a patient from the Patients list to begin a clinical scribe session.
            </p>
            <motion.a
              href="/patients"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[color:var(--button-primary-bg)] px-4 py-2 text-sm font-medium text-[color:var(--button-primary-text)] hover:opacity-90 transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Go to Patients
            </motion.a>
          </motion.div>
        </main>
      ) : (
      <main className={`flex h-screen flex-1 flex-col gap-4 overflow-hidden px-6 pb-6 pt-4 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-64"
        }`}>
        <motion.section
          className="flex-shrink-0 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-4 shadow-sm"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h1 className="text-lg font-medium text-[color:var(--text-primary)]">Clinical Workspace</h1>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  {activePatient 
                    ? `${activePatient.firstName} ${activePatient.lastName}` 
                    : scribeSessionId 
                      ? "New Session - No Patient Linked"
                      : "Initializing session..."}
                </p>
              </div>
              <RecordControl
                loading={loading}
                isRecording={isRecording}
                isPaused={isPaused}
                recordingTime={recordingTime}
                isPreviewing={isPreviewing}
                recordedBlob={recordedBlob}
                recordingProcessing={recordingProcessing}
                recordingProcessingMessage={recordingProcessingMessage}
                isUploadingFile={isUploadingFile}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onPauseRecording={pauseRecording}
                onResumeRecording={resumeRecording}
                onUploadRecording={uploadPreviewRecording}
                onDiscardRecording={discardRecording}
                onUploadFile={triggerFileUpload}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload audio file"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[color:var(--text-secondary)]">
              {activePatient ? (
                <>
                  <span className="rounded-md bg-[color:var(--surface-card)] px-3 py-1.5">MRN: {activePatient.mrn || activePatient.medicalRecordNumber || 'N/A'}</span>
                  <span className="rounded-md bg-[color:var(--surface-card)] px-3 py-1.5">{activePatient.primaryLanguage || 'N/A'}</span>
                  {vitals?.bloodPressure && <span className="rounded-md bg-[color:var(--surface-card)] px-3 py-1.5">BP: {vitals.bloodPressure}</span>}
                  {vitals?.heartRate && <span className="rounded-md bg-[color:var(--surface-card)] px-3 py-1.5">HR: {vitals.heartRate}</span>}
                  {scribeSessionId && (
                    <span className="rounded-md bg-[color:var(--surface-card)] px-3 py-1.5 ml-auto font-mono text-xs">
                      Session: {scribeSessionId.substring(0, 12)}...
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="rounded-md bg-[color:var(--color-warning)]/10 px-3 py-1.5 text-[color:var(--color-warning)]">
                    No patient linked
                  </span>
                  <button
                    onClick={() => setShowPatientModal(true)}
                    className="rounded-md bg-[color:var(--button-primary-bg)] px-4 py-1.5 text-xs font-medium text-[color:var(--button-primary-text)] hover:opacity-90 transition whitespace-nowrap"
                  >
                    Link Patient
                  </button>
                  {scribeSessionId && (
                    <span className="rounded-md bg-[color:var(--surface-card)] px-3 py-1.5 ml-auto">
                      Session: {scribeSessionId.substring(0, 16)}...
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.section>

        <motion.section
          className="grid flex-1 grid-cols-1  gap-4 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-4 shadow-sm"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className="flex h-full flex-col overflow-hidden">

            <div className="mb-2 flex items-center justify-between">
              <div className="mb-3 flex items-center gap-3">
                <div className="relative">
                  <TemplateSelector
                    selectedTemplateId={selectedTemplateId}
                    onSelect={(template) => {
                      setSelectedTemplateId(template.id);
                      setShowTemplateDropdown(false);
                    }}
                    onClose={() => setShowTemplateDropdown(false)}
                    show={showTemplateDropdown}
                  />
                  <button
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-card)]"
                  >
                    <span>
                      {templatesLoading
                        ? "Loading..."
                        : backendTemplates.find((t) => t.id === selectedTemplateId)?.label || "Select Template"}
                    </span>
                    <svg className={`h-3 w-3 transition-transform ${showTemplateDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>
                </div>
                <span className="text-xs text-[color:var(--text-secondary)]">Template</span>
              </div>              
              <div className="flex items-center gap-1.5">
                <motion.button
                  onClick={handleSaveAllSections}
                  disabled={isSavingAllSections || Object.keys(noteSections).length === 0}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    isSavingAllSections || Object.keys(noteSections).length === 0
                      ? "cursor-not-allowed border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-tertiary)]"
                      : "border border-[color:var(--border-subtle)] bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] hover:opacity-90"
                  }`}
                  whileHover={Object.keys(noteSections).length > 0 && !isSavingAllSections ? { scale: 1.02 } : {}}
                  whileTap={Object.keys(noteSections).length > 0 && !isSavingAllSections ? { scale: 0.98 } : {}}
                  title="Save all sections with content"
                >
                  {isSavingAllSections ? (
                    <>
                      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V3" />
                      </svg>
                      Save All
                    </>
                  )}
                </motion.button>
              </div>
            </div>
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] pb-1.5 mb-2">
              {noteTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium transition ${activeTab === tab.id
                      ? "border-b-2 border-[color:var(--button-primary-bg)] text-[color:var(--button-primary-bg)]"
                      : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  recordingProcessing ? "bg-[color:var(--color-warning)] animate-pulse" : 
                  loading ? "bg-[color:var(--color-warning)]" : 
                  "bg-[color:var(--color-success)]"
                }`} aria-hidden />
                <span className="text-[color:var(--text-secondary)]">
                  {recordingProcessing ? "Processing recording..." :
                   loading ? "Linking patient..." :
                   "Ready"}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto pt-2">
              {activeTab === "soap" && (
                <div className="flex flex-1 flex-col overflow-y-auto">
                  <div className="space-y-2 w-full">
                    {(() => {
                      const currentTemplate = backendTemplates.find((t) => t.id === selectedTemplateId);
                      
                      // ✨ NOTE: Templates are prompt-based, not section-based
                      // Sections come from the noteSections object (parsed from notes)
                      // The template.prompt defines how sections are extracted by AI
                      const sectionKeys = Object.keys(noteSections);
                      
                      // If no noteSections, show empty state
                      if (sectionKeys.length === 0) {
                        // No notes to display - just return empty (will show fallback below)
                        return [];
                      }
                      
                      return sectionKeys
                        .filter((sectionKey: string) => {
                          // Only show sections that have content
                          const sectionContent = noteSections[sectionKey] || "";
                          return sectionContent.trim().length > 0;
                        })
                        .map((sectionKey: string) => {
                          const sectionContent = noteSections[sectionKey] || "";

                          return (
                            <NoteSectionCardH
                              key={sectionKey}
                              sectionKey={sectionKey}
                              content={sectionContent}
                            />
                          );
                        });
                    })()}
                    {/* Show message if no sections have content yet */}
                    {Object.keys(noteSections).length === 0 && (
                      <div className="w-full flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-8">
                        <NotebookPen className="h-12 w-12 text-[color:var(--text-tertiary)]" />
                        <div className="text-center">
                          <h3 className="text-sm font-medium text-[color:var(--text-primary)]">No Note Sections Yet</h3>
                          <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                            Upload or record audio to automatically generate clinical note sections
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
{/* 
          <div className="flex h-full flex-col overflow-hidden border-l border-[color:var(--border-subtle)] pl-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-[color:var(--text-primary)]">Console</h2>
              {billing?.documentationCompleteness !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {Math.round(billing.documentationCompleteness * 100)}%
                  </span>
                </div>
              )}
            </div>

            <div className="mb-2 flex items-center gap-1 border-b border-[color:var(--border-subtle)] pb-2 overflow-x-auto">
              {consoleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap px-1.5 py-1 text-xs font-medium transition ${
                    activeTab === tab.id
                      ? tab.id === "billing" && completionScore !== null && completionScore < 100
                        ? "border-b-2 border-[color:var(--color-warning)] text-[color:var(--color-warning)]"
                        : "border-b-2 border-[color:var(--button-primary-bg)] text-[color:var(--button-primary-bg)]"
                      : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {(activeTab === "tasks") && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[color:var(--text-secondary)]">Tasks</h3>
                  {limitedTasks.length > 0 ? (
                    limitedTasks.map((task) => (
                      <div key={task.id} className="group flex items-start gap-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-2 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card-hover)]">
                        <input
                          type="checkbox"
                          defaultChecked={task.status === "completed"}
                          className="mt-0.5 h-3 w-3 rounded border-[color:var(--border-subtle)] accent-[color:var(--color-accent)]"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-[color:var(--text-primary)] line-clamp-2">{task.title}</p>
                          {task.due && <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">Due {task.due}</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs italic text-[color:var(--text-muted)]">No tasks</p>
                  )}
                </>
              )}

              {activeTab === "billing" && (
                <>
                  <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-2 dark:border-white/10 dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">Complete</p>
                      <span className={`text-xs font-bold ${completionScore === 100 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                        {completionScore}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden dark:bg-white/10">
                      <div 
                        className={`h-full transition-all ${completionScore === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${completionScore}%` }}
                      />
                    </div>
                  </div>

                  {billing?.suggestedCodes && billing.suggestedCodes.length > 0 && (
                    <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-2 dark:border-white/10 dark:bg-white/[0.02]">
                      <p className="text-xs font-bold text-stone-600 dark:text-zinc-400 mb-1">Codes</p>
                      <div className="space-y-0.5">
                        {billing.suggestedCodes.slice(0, 3).map((code, idx) => (
                          <div key={idx} className="text-xs text-stone-700 dark:text-zinc-300 bg-white dark:bg-slate-900/30 px-1.5 py-0.5 rounded font-mono line-clamp-1">
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {billing?.missingElements && billing.missingElements.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">Missing</p>
                      <ul className="space-y-0.5">
                        {billing.missingElements.slice(0, 2).map((element, idx) => (
                          <li key={idx} className="text-xs text-amber-700 dark:text-amber-200 flex items-start gap-1">
                            <span className="mt-0.5 flex-shrink-0">•</span>
                            <span className="line-clamp-2">{element}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!billing?.missingElements && !billing?.suggestedCodes && (
                    <p className="text-xs italic text-stone-400 dark:text-zinc-500">No data</p>
                  )}
                </>
              )}

              {activeTab === "alerts" && (
                <>
                  {limitedAlerts.length > 0 ? (
                    limitedAlerts.map((alert) => (
                      <div key={alert.id} className={`rounded-lg border p-2 ${
                        alert.severity === 'critical' 
                          ? 'border-rose-200 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-500/10'
                          : alert.severity === 'warning'
                            ? 'border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10'
                            : 'border-stone-200 bg-stone-50/50 dark:border-white/10 dark:bg-white/[0.02]'
                      }`}>
                        <p className={`text-xs font-bold ${
                          alert.severity === 'critical'
                            ? 'text-rose-700 dark:text-rose-300'
                            : alert.severity === 'warning'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-stone-600 dark:text-zinc-400'
                        }`}>
                          {alert.title}
                        </p>
                        {alert.guidance && (
                          <p className="mt-0.5 text-xs text-stone-700 dark:text-zinc-400 line-clamp-2">{alert.guidance}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs italic text-stone-400 dark:text-zinc-500">No alerts</p>
                  )}
                </>
              )}
            </div>
           </div>
                     */}

        </motion.section>
      </main>
      )}

      {/* Patient Selection Modal */}
      {showPatientModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPatientModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-base)]">
              <div className="border-b border-[color:var(--border-subtle)] px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">Link Patient</h2>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                      {patientModalTab === "search" 
                        ? "Select a patient to link to this scribe session"
                        : "Create a new patient record"}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPatientModal(false)}
                    className="rounded-full p-2 text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--surface-card)] hover:text-[color:var(--text-secondary)]"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-6">
                <button
                  onClick={() => setPatientModalTab("search")}
                  className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                    patientModalTab === "search"
                      ? "border-[color:var(--button-primary-bg)] text-[color:var(--button-primary-bg)]"
                      : "border-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => setPatientModalTab("create")}
                  className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                    patientModalTab === "create"
                      ? "border-[color:var(--button-primary-bg)] text-[color:var(--button-primary-bg)]"
                      : "border-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                  }`}
                >
                  Create New
                </button>
              </div>

              {/* Search Input - Only show in search tab */}
              {patientModalTab === "search" && (
                <div className="border-b border-[color:var(--border-subtle)] px-6 py-4">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-tertiary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name or MRN..."
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] py-2 pl-10 pr-4 text-sm text-[color:var(--text-primary)] placeholder-[color:var(--text-tertiary)] transition focus:border-[color:var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--button-primary-bg)]/10"
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(80vh - 240px)' }}>
              {patientModalTab === "search" ? (
                <>
                  {loadingPatients ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <svg className="h-8 w-8 animate-spin text-[color:var(--text-tertiary)]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="mt-3 text-sm text-[color:var(--text-secondary)]">Loading patients...</p>
                    </div>
                  ) : availablePatients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <User className="h-12 w-12 text-[color:var(--text-tertiary)]" />
                      <p className="mt-3 text-sm text-[color:var(--text-secondary)]">No patients found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availablePatients
                        .filter((patient) => {
                          if (!patientSearchQuery) return true;
                          const query = patientSearchQuery.toLowerCase();
                          const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
                          const mrn = patient.mrn?.toLowerCase() || '';
                          return fullName.includes(query) || mrn.includes(query);
                        })
                        .map((patient) => (
                          <motion.button
                            key={patient.id}
                            onClick={() => handlePatientSelect(patient)}
                            className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-4 text-left transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card-hover)]"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium text-[color:var(--text-primary)]">
                                  {patient.firstName} {patient.lastName}
                                </h3>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[color:var(--text-secondary)]">
                                  {patient.mrn && (
                                    <span className="rounded bg-[color:var(--surface-card-strong)] px-2 py-0.5">
                                      MRN: {patient.mrn}
                                    </span>
                                  )}
                                  {patient.dateOfBirth && (
                                    <span className="rounded bg-[color:var(--surface-card-strong)] px-2 py-0.5">
                                      DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                                    </span>
                                  )}
                                  {patient.gender && (
                                    <span className="rounded bg-[color:var(--surface-card-strong)] px-2 py-0.5">
                                      {patient.gender}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <svg
                                className="h-5 w-5 text-[color:var(--text-tertiary)]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </motion.button>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                // Create Patient Tab
                <div className="max-w-md mx-auto">
                  <PatientForm
                    onSubmit={handleCreatePatient}
                    isLoading={isCreatingPatient}
                    submitButtonText="Create Patient"
                    onCancel={() => setPatientModalTab("search")}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

// Button style constants
const BUTTON_STYLES = {
  primary: "border border-[color:var(--border-subtle)] bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] hover:bg-[color:var(--button-primary-hover)] dark:bg-white dark:text-slate-900 dark:hover:bg-stone-100",
  secondary: "border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-card-hover)] dark:border-white/20 dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:bg-white/10",
  disabled: "cursor-not-allowed border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-tertiary)] dark:border-white/10 dark:bg-white/5 dark:text-zinc-500",
} as const;

const BUTTON_RECORDING = "border border-[color:var(--border-subtle)] bg-[color:var(--color-warning)] text-white hover:opacity-90 dark:bg-[color:var(--color-warning)] dark:hover:opacity-90";

// SVG Icon paths
const ICONS = {
  spinner: <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>,
  upload: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  trash: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  check: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  stop: <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
  uploadFile: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
} as const;

type RecordControlProps = {
  loading: boolean;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  isPreviewing: boolean;
  recordedBlob: Blob | null;
  recordingProcessing?: boolean;
  recordingProcessingMessage?: string;
  isUploadingFile?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onUploadRecording: () => void;
  onDiscardRecording: () => void;
  onUploadFile: () => void;
};

function RecordControlButton({ onClick, disabled, isPrimary = true, icon, label, loading = false, isRecording = false, isPaused = false }: { onClick: () => void; disabled?: boolean; isPrimary?: boolean; icon?: ReactNode; label: string; loading?: boolean; isRecording?: boolean; isPaused?: boolean }) {
  const getButtonStyle = () => {
    if (disabled) return BUTTON_STYLES.disabled;
    if (isRecording && !isPaused) return BUTTON_RECORDING;
    return isPrimary ? BUTTON_STYLES.primary : BUTTON_STYLES.secondary;
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition ${getButtonStyle()}`}
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
    >
      {loading ? ICONS.spinner : icon}
      {label}
    </motion.button>
  );
}

function RecordControl({ loading, isRecording, isPaused, recordingTime, isPreviewing, recordedBlob, onStartRecording, onStopRecording, onPauseRecording, onResumeRecording, onUploadRecording, onDiscardRecording, onUploadFile }: RecordControlProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isPreviewing && recordedBlob) {
    return (
      <motion.div
        className="flex flex-col gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: easeOutExpo }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[300px] space-y-3">
            <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
              <audio
                controls
                className="w-full"
                src={URL.createObjectURL(recordedBlob)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RecordControlButton
              onClick={onUploadRecording}
              disabled={loading || isRecording}
              isPrimary={true}
              icon={ICONS.upload}
              label={loading ? "Processing..." : "Upload & Process"}
              loading={loading}
            />
            <RecordControlButton
              onClick={onDiscardRecording}
              disabled={loading || isRecording}
              isPrimary={false}
              icon={ICONS.trash}
              label="Discard"
            />
          </div>
        </div>
      </motion.div>
    );
  }



  return (
    <div className="flex flex-wrap items-center gap-3">
      <motion.button
        type="button"
        onClick={isRecording ? (isPaused ? onResumeRecording : onPauseRecording) : onStartRecording}
        disabled={loading}
        className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition ${
          loading
            ? BUTTON_STYLES.disabled
            : isRecording
              ? isPaused
                ? BUTTON_STYLES.primary
                : BUTTON_RECORDING
              : BUTTON_STYLES.primary
        }`}
        whileHover={!loading ? { scale: 1.03 } : {}}
        whileTap={!loading ? { scale: 0.97 } : {}}
      >
        <Mic className={`h-4 w-4 ${isRecording && !isPaused ? "animate-pulse" : ""}`} aria-hidden />
        {loading ? "Preparing" : isRecording ? (isPaused ? "Resume" : "Pause") : "Start Recording"}
      </motion.button>

      {!isRecording && (
        <motion.button
          type="button"
          onClick={onUploadFile}
          disabled={loading}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition ${ BUTTON_STYLES.primary}`}
          whileHover={!loading ? { scale: 1.03 } : {}}
          whileTap={!loading ? { scale: 0.97 } : {}}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {ICONS.uploadFile}
          Upload Audio
        </motion.button>
      )}

      {isRecording && (
        <>
          <motion.button
            type="button"
            onClick={onStopRecording}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition ${BUTTON_STYLES.primary}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {ICONS.stop}
            Stop
          </motion.button>
        </>
      )}

      {isRecording && (
        <motion.div
          className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.05]"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-2">
            <motion.span
              className={`h-2.5 w-2.5 rounded-full ${isPaused ? "bg-[color:var(--color-warning)]" : "bg-[color:var(--color-success)]"}`}
              animate={isPaused ? {} : { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              aria-hidden
            />
            <span className="text-sm font-medium text-[color:var(--text-primary)]">
              {isPaused ? "Paused" : "Recording"}
            </span>
          </div>
          <span className="font-mono text-sm text-[color:var(--text-primary)]">{formatTime(recordingTime)}</span>
        </motion.div>
      )}
    </div>
  );
}

type PlaceholderProps = {
  message: string;
  variant?: "default" | "subtle";
};


type NoteSectionCardHProps = {
  sectionKey: string;
  content?: string;
};

function NoteSectionCardH({
  sectionKey,
  content,
}: NoteSectionCardHProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (content) {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
    }
  };

  // Parse content into numbered sections
  const parseSections = (text: string) => {
    if (!text) return [];
    
    const sections: Array<{ number: number; title: string; content: string }> = [];
    
    // Split by lines and process sections
    // Look for lines starting with **\d+\. or just \d+\.
    const lines = text.split('\n');
    let currentSection: { number: number; title: string; content: string[] } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line starts a new section: **1. Title:** or 1. **Title:**
      const sectionMatch = line.match(/^\*?\*?(\d+)\.\s+(.+?):?\*?\*?$/);
      
      if (sectionMatch) {
        // Save previous section
        if (currentSection) {
          sections.push({
            number: currentSection.number,
            title: currentSection.title,
            content: currentSection.content.join('\n').trim()
          });
        }
        
        const [, num, title] = sectionMatch;
        currentSection = {
          number: parseInt(num),
          title: title.replace(/\*\*/g, '').trim(),
          content: []
        };
      } else if (currentSection && line.trim()) {
        // Add content to current section
        currentSection.content.push(line);
      }
    }
    
    // Save the last section
    if (currentSection) {
      sections.push({
        number: currentSection.number,
        title: currentSection.title,
        content: currentSection.content.join('\n').trim()
      });
    }
    
    return sections;
  };

  const sections = parseSections(content || '');

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >


      {/* Render sections as individual cards */}
      <div className="space-y-2">
        {sections.length > 0 ? (
          sections.map((section) => {
            const [copiedId, setCopiedId] = useState<number | null>(null);
            
            const handleCopySection = async (sectionNum: number, sectionContent: string) => {
              try {
                // Extract plain text without markdown formatting
                const plainText = sectionContent
                  .split('\n')
                  .map((line) => {
                    const trimmed = line.trim();
                    if (!trimmed) return '';
                    
                    // Remove markdown formatting: **text** -> text, *text* -> text
                    const cleanLine = trimmed
                      .replace(/\*\*([^*]+)\*\*/g, '$1')
                      .replace(/\*([^*]+)\*/g, '$1');
                    
                    // Convert bullet points
                    if (cleanLine.startsWith('*') || cleanLine.startsWith('-')) {
                      return '• ' + cleanLine.replace(/^[\*-]\s+/, '').trim();
                    }
                    return cleanLine;
                  })
                  .filter((line) => line.length > 0)
                  .join('\n');
                
                await navigator.clipboard.writeText(plainText);
                setCopiedId(sectionNum);
                setTimeout(() => setCopiedId(null), 2000);
              } catch (error) {
              }
            };
            
            return (
              <motion.div
                key={section.number}
                className="rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900/30 p-3"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: section.number * 0.05 }}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-stone-200 dark:bg-zinc-700">
                    <span className="text-xs font-bold text-stone-900 dark:text-white">{section.number}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="text-sm font-semibold text-stone-900 dark:text-white">
                        {section.title}
                      </h4>
                      <motion.button
                        onClick={() => handleCopySection(section.number, section.content)}
                        className={`flex-shrink-0 rounded px-2 py-1 text-xs font-medium transition whitespace-nowrap ${
                          copiedId === section.number
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'bg-stone-200 text-stone-600 hover:bg-stone-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {copiedId === section.number ? 'Copied!' : 'Copy'}
                      </motion.button>
                    </div>
                    <div className="text-xs leading-relaxed text-stone-700 dark:text-zinc-300 space-y-1">
                      {section.content.split('\n').map((line, idx) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        
                        // Remove markdown formatting: **text** -> text, *text* -> text
                        const cleanLine = trimmed
                          .replace(/\*\*([^*]+)\*\*/g, '$1')
                          .replace(/\*([^*]+)\*/g, '$1');
                        
                        // Handle bullet points: "* text" or "- text"
                        if (cleanLine.startsWith('*') || cleanLine.startsWith('-')) {
                          const bulletContent = cleanLine
                            .replace(/^[\*-]\s+/, '')
                            .trim();
                          return (
                            <div key={idx} className="flex gap-2 ml-1">
                              <span className="flex-shrink-0 mt-0.5">•</span>
                              <span>{bulletContent}</span>
                            </div>
                          );
                        }
                        
                        return <div key={idx}>{cleanLine}</div>;
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : content ? (
          // Fallback if parsing fails - show raw content
          <div className="text-sm leading-relaxed text-stone-700 dark:text-zinc-300 whitespace-pre-wrap break-words rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900/30 p-3">
            {content}
          </div>
        ) : (
          <div className="text-center py-4 text-stone-500 dark:text-zinc-500">
            <p className="text-sm">No content available</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}


type ContextGridProps = {
  patient?: PatientOverview;
  vitals?: Vitals;
  orders: CareOrder[];
  tasks: ClinicalTask[];
};

export default ScribePage;
