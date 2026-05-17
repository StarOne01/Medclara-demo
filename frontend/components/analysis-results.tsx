/**
 * Analysis Results Display Component
 * 
 * Displays the standardized backend analysis results:
 * - Full transcription of the audio
 * - AI-generated analysis report (markdown formatted)
 * - Speaker diarization and audio metadata
 * 
 * Expected response format: analysis.extracted_sections.response.content
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AnalysisResult } from '@/lib/hooks/useRecordingWorkflow';

interface AnalysisResultsProps {
  data: AnalysisResult;
  onCopy?: (text: string, section: string) => void;
}

interface CopiedState {
  [key: string]: boolean;
}

export function AnalysisResults({ data, onCopy }: AnalysisResultsProps) {
  const [copied, setCopied] = React.useState<CopiedState>({});

  if (!data.analysis) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-yellow-600 mb-2" />
        <p className="text-yellow-700">No analysis data available</p>
      </div>
    );
  }

  const aiReport = data.analysis?.extracted_sections?.response?.content;
  const { transcription_metadata } = data.analysis;

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [section]: true });
    onCopy?.(text, section);
    setTimeout(() => setCopied({ ...copied, [section]: false }), 2000);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="analysis-results max-w-5xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900">Analysis Complete</h2>
        </div>
        <p className="text-sm text-gray-600">
          Processed in {(data.processing_time_ms / 1000).toFixed(1)}s • {data.analysis.transcription_metadata.total_duration_seconds}s recording
        </p>
      </motion.div>

      {/* Transcription Section */}
      <motion.section variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">📝 Transcription</h3>
          <button
            onClick={() => handleCopy(data.transcription, 'transcription')}
            className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Copy transcription"
          >
            {copied.transcription ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {data.transcription}
          </p>
        </div>
      </motion.section>

      {/* AI Analysis Report */}
      <motion.section variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">📋 AI Analysis Report</h3>
          {aiReport && (
            <button
              onClick={() => handleCopy(aiReport, 'analysis')}
              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Copy analysis"
            >
              {copied.analysis ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>
        {aiReport ? (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {aiReport}
            </p>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700 text-sm">No analysis report available</p>
          </div>
        )}
      </motion.section>

      {/* Metadata */}
      <motion.section variants={itemVariants} className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">📊 Recording Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Duration</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {Math.floor(transcription_metadata.total_duration_seconds / 60)}:{
                (transcription_metadata.total_duration_seconds % 60).toString().padStart(2, '0')
              }
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Audio Quality</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1 capitalize">
              {transcription_metadata.audio_quality}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Processing Time</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">
              {(data.processing_time_ms / 1000).toFixed(1)}s
            </p>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Status</p>
            <p className="text-2xl font-bold text-rose-900 mt-1 capitalize">
              {data.status}
            </p>
          </div>
        </div>

        {/* Speaker Diarization */}
        {transcription_metadata.speaker_diarization && 
         transcription_metadata.speaker_diarization.length > 0 && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Speaker Distribution</h4>
            <div className="space-y-2">
              {transcription_metadata.speaker_diarization.map((speaker: any) => (
                <div key={speaker.role} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 capitalize w-20">
                    {speaker.role}
                  </span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${speaker.percentage}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-600 w-12 text-right">
                    {speaker.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.section>

      {/* Recording IDs for reference */}
      <motion.div
        variants={itemVariants}
        className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600"
      >
        <p>
          <span className="font-semibold">Recording ID:</span> {data.id}
        </p>
        <p className="mt-1">
          <span className="font-semibold">Processed:</span> {new Date(data.updated_at).toLocaleString()}
        </p>
      </motion.div>
    </motion.div>
  );
}

export default AnalysisResults;
