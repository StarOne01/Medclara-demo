/**
 * Recording Progress Component
 * 
 * Displays:
 * - Upload progress (0-50%)
 * - Processing progress (50-100%)
 * - Current phase indicator
 * - Error messages and retry options
 * - Cancel button
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
} from 'lucide-react';
import type { RecordingWorkflowState } from '@/lib/hooks/useRecordingWorkflow';

interface RecordingProgressProps {
  state: RecordingWorkflowState;
  onCancel?: () => void;
  onRetry?: (phase: 'upload' | 'finalize' | 'wait') => void;
  isProcessing?: boolean;
}

export function RecordingProgress({
  state,
  onCancel,
  onRetry,
  isProcessing,
}: RecordingProgressProps) {
  const { phase, totalProgress, uploadProgress, processingProgress, error, errorCode } = state;

  const phaseSteps = [
    { key: 'uploading', label: 'Uploading', icon: Upload },
    { key: 'processing', label: 'Processing', icon: Zap },
    { key: 'complete', label: 'Complete', icon: CheckCircle2 },
  ];

  const currentStepIndex = phaseSteps.findIndex(s => s.key === phase);
  const isError = phase === 'error';
  const isComplete = phase === 'complete';

  const getPhaseMessage = (currentPhase: string): string => {
    switch (currentPhase) {
      case 'uploading':
        return `Uploading audio... ${uploadProgress}%`;
      case 'processing':
        return `Analyzing with Vertex AI... ${processingProgress}%`;
      case 'complete':
        return 'Analysis complete!';
      case 'idle':
        return 'Ready to start recording';
      default:
        return '';
    }
  };

  const getRetryPhase = (): 'upload' | 'finalize' | 'wait' => {
    if (errorCode === 'upload_error' || errorCode === 'chunk_upload_failed') {
      return 'upload';
    }
    if (errorCode === 'finalize_error' || errorCode === 'finalize_failed') {
      return 'finalize';
    }
    return 'wait';
  };

  return (
    <div className="recording-progress space-y-4">
      {/* Phase Indicators */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        {phaseSteps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;

          return (
            <React.Fragment key={step.key}>
              {/* Step */}
              <motion.div
                className={`flex flex-col items-center flex-1 ${
                  index !== 0 ? '-ml-2' : ''
                }`}
                animate={{
                  scale: isCurrent ? 1.1 : isActive ? 1 : 0.9,
                }}
              >
                <motion.div
                  className={`rounded-full p-3 transition-all ${
                    isCompleted
                      ? 'bg-green-100 text-green-600'
                      : isCurrent
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                  animate={{
                    boxShadow: isCurrent
                      ? '0 0 0 4px rgba(59, 130, 246, 0.1)'
                      : 'none',
                  }}
                >
                  <StepIcon className="w-5 h-5" />
                </motion.div>
                <p className="text-xs font-semibold mt-2 text-gray-700">
                  {step.label}
                </p>
              </motion.div>

              {/* Connector Line */}
              {index < phaseSteps.length - 1 && (
                <motion.div
                  className="h-1 bg-gray-200 flex-1 -ml-2"
                  animate={{
                    backgroundColor:
                      isCompleted || isCurrent ? '#10b981' : '#e5e7eb',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </motion.div>

      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {getPhaseMessage(phase)}
          </h3>
          <span className="text-xs font-bold text-gray-600">
            {Math.round(totalProgress)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(totalProgress, 5)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Sub-progress (if uploading) */}
        {phase === 'uploading' && uploadProgress > 0 && (
          <div className="text-xs text-gray-600">
            Uploading chunks: {uploadProgress}% complete
          </div>
        )}

        {/* Sub-progress (if processing) */}
        {phase === 'processing' && processingProgress > 0 && (
          <div className="text-xs text-gray-600">
            Vertex AI Analysis: {processingProgress}% complete
          </div>
        )}
      </motion.div>

      {/* Status Messages */}
      <AnimatePresence>
        {phase === 'uploading' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700"
          >
            <p className="font-semibold mb-1">Uploading Audio</p>
            <p className="text-xs opacity-90">
              Your audio is being uploaded in chunks. This process is optimized
              for network efficiency and can be resumed if interrupted.
            </p>
          </motion.div>
        )}

        {phase === 'processing' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700"
          >
            <p className="font-semibold mb-1">Processing with Vertex AI</p>
            <p className="text-xs opacity-90">
              Your audio is being analyzed. This typically takes 15-30 seconds
              depending on the recording length.
            </p>
          </motion.div>
        )}

        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Analysis Complete!</p>
              <p className="text-xs opacity-90">
                Your recording has been analyzed and results are ready to view.
              </p>
            </div>
          </motion.div>
        )}

        {isError && error && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error During Processing</p>
                <p className="text-xs opacity-90 mt-1">{error}</p>
              </div>
            </div>

            {/* Retry Button */}
            {onRetry && (
              <motion.button
                onClick={() => onRetry(getRetryPhase())}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors mt-3"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      {isProcessing && !isComplete && !isError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="flex gap-2"
        >
          <motion.button
            onClick={onCancel}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </motion.button>
        </motion.div>
      )}

      {/* Estimated Time Remaining */}
      {phase === 'uploading' && uploadProgress > 0 && uploadProgress < 50 && (
        <div className="text-xs text-gray-600 text-center animate-pulse">
          Estimated time remaining: {Math.max(3, 30 - Math.round(uploadProgress / 2))}s
        </div>
      )}

      {phase === 'processing' && processingProgress > 0 && processingProgress < 100 && (
        <div className="text-xs text-gray-600 text-center animate-pulse">
          Estimated time remaining: {Math.max(5, 30 - processingProgress)}s
        </div>
      )}
    </div>
  );
}

export default RecordingProgress;
