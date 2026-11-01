import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HelpCircle,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Sliders,
  Copy,
  Check,
  AlertTriangle,
  Layers,
  Activity,
  Terminal,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  TranscriptSegment,
  DetectedQuestion,
  QuestionCategory,
  QuestionDetectionConfig,
  SyntheticScenario,
} from '../../types';
import { detectionService } from '../../services/detectionService';

interface QuestionDetectionPanelProps {
  transcriptSegments: TranscriptSegment[];
  onApproveQuestion: (questionText: string, autoGenerate?: boolean) => void;
  isGeneratingAnswer?: boolean;
}

export const QuestionDetectionPanel: React.FC<QuestionDetectionPanelProps> = ({
  transcriptSegments,
  onApproveQuestion,
  isGeneratingAnswer = false,
}) => {
  // Detection engine states
  const [isDetectionPaused, setIsDetectionPaused] = useState(false);
  const [autoAnswerEnabled, setAutoAnswerEnabled] = useState(false);
  const [minLengthChars, setMinLengthChars] = useState(15);
  const [minConfidence, setMinConfidence] = useState(0.65);
  const [debounceSec, setDebounceSec] = useState(2.0);
  const [dedupThreshold, setDedupThreshold] = useState(0.85);

  // Detected questions stream
  const [detectedQuestions, setDetectedQuestions] = useState<DetectedQuestion[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Detection metrics
  const [ignoredPhrasesCount, setIgnoredPhrasesCount] = useState(0);
  const [duplicatesFilteredCount, setDuplicatesFilteredCount] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<string | null>(null);

  // Synthetic scenarios testbench
  const [scenarios, setScenarios] = useState<SyntheticScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedChunkCountRef = useRef(0);

  // Load synthetic scenarios on mount
  useEffect(() => {
    detectionService.getSyntheticScenarios().then((res) => {
      setScenarios(res.scenarios);
    });
  }, []);

  // Main evaluation trigger function
  const evaluateChunks = useCallback(
    async (chunksToProcess: TranscriptSegment[], isManualTrigger = false) => {
      if (chunksToProcess.length === 0) return;
      if (isDetectionPaused && !isManualTrigger) return;

      setIsEvaluating(true);
      try {
        const config: QuestionDetectionConfig = {
          min_length_chars: minLengthChars,
          min_confidence: minConfidence,
          debounce_seconds: debounceSec,
          deduplication_threshold: dedupThreshold,
          auto_answer_enabled: autoAnswerEnabled,
        };

        const res = await detectionService.detectQuestions(
          chunksToProcess,
          config,
          detectedQuestions
        );

        setIgnoredPhrasesCount((prev) => prev + res.ignored_phrases_count);
        setDuplicatesFilteredCount((prev) => prev + res.duplicates_filtered_count);
        setLastEvaluatedAt(new Date().toLocaleTimeString());

        if (res.detected_questions.length > 0) {
          // Append new unique detected questions
          setDetectedQuestions((prev) => {
            const existingIds = new Set(prev.map((q) => q.id));
            const fresh = res.detected_questions.filter((q) => !existingIds.has(q.id));
            const updated = [...prev, ...fresh];

            // If auto-answer is enabled, immediately trigger the highest confidence question
            if (autoAnswerEnabled && fresh.length > 0 && !isGeneratingAnswer) {
              const topQ = fresh[0];
              onApproveQuestion(topQ.text, true);
              // Mark as auto-submitted
              return updated.map((q) => (q.id === topQ.id ? { ...q, status: 'auto_submitted' } : q));
            }

            return updated;
          });
        }
      } catch (err) {
        console.error('Detection evaluation error:', err);
      } finally {
        setIsEvaluating(false);
      }
    },
    [
      isDetectionPaused,
      minLengthChars,
      minConfidence,
      debounceSec,
      dedupThreshold,
      autoAnswerEnabled,
      detectedQuestions,
      isGeneratingAnswer,
      onApproveQuestion,
    ]
  );

  // Debounced evaluation when live transcript chunks update
  useEffect(() => {
    if (transcriptSegments.length === 0) return;
    if (transcriptSegments.length === lastProcessedChunkCountRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastProcessedChunkCountRef.current = transcriptSegments.length;
      evaluateChunks(transcriptSegments);
    }, debounceSec * 1000);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [transcriptSegments, debounceSec, evaluateChunks]);

  // Handle synthetic scenario execution
  const handleRunScenario = async (scenario: SyntheticScenario) => {
    setActiveScenarioId(scenario.id);
    setTestLog(`Evaluating scenario: "${scenario.title}" with ${scenario.chunks.length} chunks...`);

    const config: QuestionDetectionConfig = {
      min_length_chars: minLengthChars,
      min_confidence: minConfidence,
      debounce_seconds: 0.1,
      deduplication_threshold: dedupThreshold,
      auto_answer_enabled: false,
    };

    const res = await detectionService.detectQuestions(scenario.chunks, config, detectedQuestions);

    setIgnoredPhrasesCount((prev) => prev + res.ignored_phrases_count);
    setDuplicatesFilteredCount((prev) => prev + res.duplicates_filtered_count);
    setLastEvaluatedAt(new Date().toLocaleTimeString());

    if (res.detected_questions.length > 0) {
      setDetectedQuestions((prev) => [...prev, ...res.detected_questions]);
      setTestLog(
        `SUCCESS: Detected ${res.detected_questions.length} question(s) [${res.detected_questions.map((q) => q.category).join(', ')}]. Filtered ${res.ignored_phrases_count} noise chunks, ${res.duplicates_filtered_count} duplicates.`
      );
    } else {
      setTestLog(
        `INFO: No questions passed threshold. Ignored ${res.ignored_phrases_count} phrases, ${res.duplicates_filtered_count} duplicates filtered.`
      );
    }
  };

  // Question action handlers
  const handleStartEdit = (q: DetectedQuestion) => {
    setEditingQuestionId(q.id);
    setEditText(q.text);
  };

  const handleSaveEdit = (id: string) => {
    setDetectedQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, text: editText.trim() } : q))
    );
    setEditingQuestionId(null);
  };

  const handleDismissQuestion = (id: string) => {
    setDetectedQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: 'dismissed' } : q))
    );
  };

  const handleRemoveQuestion = (id: string) => {
    setDetectedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleCopyQuestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleApprove = (q: DetectedQuestion) => {
    setDetectedQuestions((prev) =>
      prev.map((item) => (item.id === q.id ? { ...item, status: 'answered' } : item))
    );
    onApproveQuestion(q.text, false);
  };

  const handleClearAllDetected = () => {
    setDetectedQuestions([]);
    setIgnoredPhrasesCount(0);
    setDuplicatesFilteredCount(0);
    setTestLog(null);
  };

  // Badge color helper
  const getCategoryColor = (cat: QuestionCategory) => {
    switch (cat) {
      case 'technical':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'coding':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'behavioral':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'hr':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'general':
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  const activeQuestions = detectedQuestions.filter((q) => q.status !== 'dismissed');
  const dismissedQuestions = detectedQuestions.filter((q) => q.status === 'dismissed');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Controls & Status Bar */}
      <Card className="border-slate-800 bg-surface-900/90 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                isDetectionPaused
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
              }`}
            >
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-base">Question Detection Engine</h3>
                <Badge variant={isDetectionPaused ? 'warning' : 'success'}>
                  {isDetectionPaused ? 'Paused' : 'Active'}
                </Badge>
                {isEvaluating && (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono animate-pulse">
                    <Activity className="w-3.5 h-3.5" />
                    Evaluating...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-chunk sentence parser, deduplication sequence matcher, and interview trigger pattern triage
              </p>
            </div>
          </div>

          {/* Engine Action Controls */}
          <div className="flex items-center flex-wrap gap-2">
            <Button
              variant={isDetectionPaused ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setIsDetectionPaused(!isDetectionPaused)}
              leftIcon={isDetectionPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            >
              {isDetectionPaused ? 'Resume Detection' : 'Pause Detection'}
            </Button>

            <button
              onClick={() => setAutoAnswerEnabled(!autoAnswerEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                autoAnswerEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-surface-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="When enabled, high-confidence questions are directly forwarded to the local AI backend"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Answer: {autoAnswerEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => evaluateChunks(transcriptSegments, true)}
              disabled={transcriptSegments.length === 0 || isEvaluating}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Re-scan Transcript
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllDetected}
              disabled={detectedQuestions.length === 0}
              className="text-slate-400 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Engine Tuning Configuration & Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
          {/* Debounce setting */}
          <div className="bg-surface-800/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-300 font-medium">
              <span className="flex items-center gap-1">
                <Sliders className="w-3 h-3 text-slate-400" />
                Debounce Window
              </span>
              <span className="text-brand-400 font-mono">{debounceSec.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={debounceSec}
              onChange={(e) => setDebounceSec(parseFloat(e.target.value))}
              className="w-full h-1 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <p className="text-[10px] text-slate-500">Wait time after pause before sentence compilation</p>
          </div>

          {/* Min Length setting */}
          <div className="bg-surface-800/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-300 font-medium">
              <span>Min Length</span>
              <span className="text-brand-400 font-mono">{minLengthChars} chars</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              step="5"
              value={minLengthChars}
              onChange={(e) => setMinLengthChars(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <p className="text-[10px] text-slate-500">Filters tiny utterances and trailing filler noise</p>
          </div>

          {/* Min Confidence setting */}
          <div className="bg-surface-800/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-300 font-medium">
              <span>Min Confidence</span>
              <span className="text-brand-400 font-mono">{Math.round(minConfidence * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.50"
              max="0.90"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-full h-1 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <p className="text-[10px] text-slate-500">Pattern match & syntactic interrogative threshold</p>
          </div>

          {/* Deduplication Threshold setting */}
          <div className="bg-surface-800/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex justify-between text-slate-300 font-medium">
              <span>Deduplication</span>
              <span className="text-purple-400 font-mono">{Math.round(dedupThreshold * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.60"
              max="0.95"
              step="0.05"
              value={dedupThreshold}
              onChange={(e) => setDedupThreshold(parseFloat(e.target.value))}
              className="w-full h-1 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <p className="text-[10px] text-slate-500">Sequence matcher similarity cutoff for repeated queries</p>
          </div>
        </div>

        {/* Telemetry Counter Row */}
        <div className="flex items-center justify-between text-xs bg-surface-950/60 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-4 text-slate-300">
            <span>
              Candidate Questions: <strong className="text-brand-400 font-mono">{activeQuestions.length}</strong>
            </span>
            <span>
              Noise Phrases Filtered: <strong className="text-amber-400 font-mono">{ignoredPhrasesCount}</strong>
            </span>
            <span>
              Duplicates Suppressed: <strong className="text-purple-400 font-mono">{duplicatesFilteredCount}</strong>
            </span>
          </div>
          {lastEvaluatedAt && (
            <span className="text-[10px] text-slate-500 font-mono">Last Evaluated: {lastEvaluatedAt}</span>
          )}
        </div>
      </Card>

      {/* Synthetic Scenarios Testbench (Offline & Simulation Verification) */}
      <Card className="border-slate-800 bg-surface-900/70 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">Synthetic Transcript Verification Suite</h4>
          </div>
          <Badge variant="secondary">Target Laptop Verification</Badge>
        </div>
        <p className="text-xs text-slate-400">
          Simulate interviewer audio chunks to verify multi-chunk compilation, casual speech filtering, deduplication, and question categorization locally without needing an active live mic.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {scenarios.map((sc) => (
            <div
              key={sc.id}
              className={`p-3 rounded-xl border text-xs space-y-2 transition flex flex-col justify-between ${
                activeScenarioId === sc.id
                  ? 'border-brand-500/50 bg-brand-950/20'
                  : 'border-slate-800 bg-surface-800/60 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between font-semibold text-slate-200">
                  <span>{sc.title}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-700 text-slate-400">
                    {sc.expected_category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{sc.description}</p>
                <div className="text-[10px] text-slate-500 mt-2 font-mono">
                  {sc.chunks.length} transcript chunks
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => handleRunScenario(sc)}
              >
                Run Scenario
              </Button>
            </div>
          ))}
        </div>

        {testLog && (
          <div className="p-2.5 rounded-lg bg-surface-950 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center justify-between">
            <span className="truncate">{testLog}</span>
            <button
              onClick={() => setTestLog(null)}
              className="text-slate-500 hover:text-slate-300 ml-2 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}
      </Card>

      {/* Candidate Questions Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">Detected Interview Questions ({activeQuestions.length})</h4>
          </div>
          <span className="text-xs text-slate-400">
            Click <strong>Approve & Answer</strong> to send to local LLM, or edit text inline if speech was transcribed with errors.
          </span>
        </div>

        {activeQuestions.length === 0 ? (
          <Card className="border-slate-800/80 bg-surface-900/40 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-800 border border-slate-700/60 mx-auto flex items-center justify-center text-slate-500">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">No Interview Questions Detected Yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Start recording in the Audio Capture tab or click any <strong>Run Scenario</strong> button above to feed sample interview questions through the detection parser.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeQuestions.map((q) => {
              const isEditing = editingQuestionId === q.id;
              const isCopied = copiedId === q.id;

              return (
                <Card
                  key={q.id}
                  className={`border transition p-4 space-y-3 ${
                    q.status === 'answered'
                      ? 'border-emerald-500/30 bg-emerald-950/10'
                      : q.status === 'auto_submitted'
                      ? 'border-indigo-500/30 bg-indigo-950/10'
                      : 'border-slate-800 bg-surface-900/90 hover:border-slate-700'
                  }`}
                >
                  {/* Top Metadata */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono uppercase text-[10px] font-semibold border ${getCategoryColor(
                          q.category
                        )}`}
                      >
                        {q.category}
                      </span>
                      <span className="text-slate-500 font-mono">[{q.timestamp}]</span>
                      <span className="text-slate-400 text-[11px]">
                        Confidence: <strong className="text-slate-200">{Math.round(q.confidence * 100)}%</strong>
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        ({q.source_chunks.length} source chunk{q.source_chunks.length > 1 ? 's' : ''})
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {q.status === 'answered' && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Answered
                        </span>
                      )}
                      {q.status === 'auto_submitted' && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                          <Sparkles className="w-3 h-3 animate-pulse" /> Auto-Submitted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text / Inline Edit */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-surface-950 border border-brand-500 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        rows={2}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingQuestionId(null)}>
                          Cancel
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => handleSaveEdit(q.id)}>
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-100 leading-relaxed">{q.text}</p>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyQuestion(q.id, q.text)}
                        className="p-1.5 rounded hover:bg-surface-800 text-slate-400 hover:text-slate-200 transition"
                        title="Copy Question"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleStartEdit(q)}
                        className="p-1.5 rounded hover:bg-surface-800 text-slate-400 hover:text-slate-200 transition"
                        title="Edit question text"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDismissQuestion(q.id)}
                        className="p-1.5 rounded hover:bg-surface-800 text-slate-400 hover:text-amber-400 transition"
                        title="Dismiss as non-question"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="p-1.5 rounded hover:bg-surface-800 text-slate-400 hover:text-red-400 transition"
                        title="Delete from list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isGeneratingAnswer}
                        onClick={() => handleApprove(q)}
                        leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                        className="bg-brand-600 hover:bg-brand-500 text-white font-semibold"
                      >
                        Approve & Answer
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Dismissed questions restore section */}
        {dismissedQuestions.length > 0 && (
          <div className="pt-2">
            <details className="text-xs text-slate-500 cursor-pointer">
              <summary className="hover:text-slate-400">
                Show {dismissedQuestions.length} dismissed question{dismissedQuestions.length > 1 ? 's' : ''}
              </summary>
              <div className="space-y-1.5 mt-2 pl-2 border-l border-slate-800">
                {dismissedQuestions.map((dq) => (
                  <div key={dq.id} className="flex items-center justify-between text-slate-400 py-1">
                    <span className="line-through truncate max-w-md">{dq.text}</span>
                    <button
                      onClick={() =>
                        setDetectedQuestions((prev) =>
                          prev.map((item) => (item.id === dq.id ? { ...item, status: 'pending_review' } : item))
                        )
                      }
                      className="text-brand-400 hover:underline text-[11px] ml-2"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Phase 5 Transparency & Safety Callout */}
      <div className="p-3.5 rounded-xl bg-surface-900 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">Local-First Question Triage Safety</p>
          <p className="leading-relaxed">
            Speech transcription and automated question parsing can mishear technical jargon, acronyms, or pauses. FreeInterviewAI never submits audio externally and allows candidates to review, refine, or dismiss every detected prompt before requesting guidance from the local LLM.
          </p>
        </div>
      </div>
    </div>
  );
};
