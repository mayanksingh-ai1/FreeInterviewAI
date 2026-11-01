import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Trash2,
  Volume2,
  Headphones,
  Sparkles,
  Zap,
  BookOpen,
  Smile,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  BookmarkCheck,
  KeyRound,
  Code2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  AnswerStyle,
  QuestionProcessResponse,
  InterviewSession,
  AudioDeviceInfo,
  AudioTestResponse,
  AudioSessionStatusResponse,
} from '../types';
import { aiService } from '../services/aiService';
import { audioService } from '../services/audioService';
import { QuestionDetectionPanel } from '../components/detection/QuestionDetectionPanel';

interface InterviewPracticeViewProps {
  onSaveToHistory?: (session: InterviewSession) => void;
}

const SAMPLE_QUESTIONS = [
  'Design a distributed rate limiter that handles 100,000 requests per second.',
  'Explain the JavaScript event loop, microtasks, and macrotasks execution order.',
  'How do you manage technical debt and push back on unrealistic stakeholder deadlines?',
  'Explain optimistic vs pessimistic concurrency control in distributed databases.',
  'Implement LRU Cache with O(1) get and put time complexity.',
];

export const InterviewPracticeView: React.FC<InterviewPracticeViewProps> = ({ onSaveToHistory }) => {
  // Navigation between Audio Practice, Question Detection, and Question Answering
  const [activePracticeTab, setActivePracticeTab] = useState<'audio-stt' | 'question-detection' | 'question-answering'>('audio-stt');

  // --- Phase 4 Live Audio State ---
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [selectedWhisperModel, setSelectedWhisperModel] = useState<'tiny.en' | 'base.en'>('tiny.en');
  const [chunkDuration, setChunkDuration] = useState<number>(3.0);
  const [audioStatus, setAudioStatus] = useState<AudioSessionStatusResponse>({
    state: 'idle',
    device_id: null,
    device_name: 'Microphone',
    model_name: 'tiny.en',
    chunk_duration_sec: 3.0,
    current_volume_rms: 0.0,
    is_silent: true,
    finalized_segments: [],
    partial_segment: null,
    duration_seconds: 0,
  });
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [testResult, setTestResult] = useState<AudioTestResponse | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [savedTranscriptSuccess, setSavedTranscriptSuccess] = useState(false);

  // --- Phase 3 Question Processor State ---
  const [questionInput, setQuestionInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<AnswerStyle>('detailed');
  const [selectedAIModel, setSelectedAIModel] = useState('llama3.2:1b');
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [answerData, setAnswerData] = useState<QuestionProcessResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [answerWindowOpen, setAnswerWindowOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch audio endpoints on mount
  useEffect(() => {
    audioService
      .fetchDevices()
      .then((res) => {
        setAudioDevices(res.devices);
        if (res.default_input_id !== null && res.default_input_id !== undefined) {
          setSelectedDeviceId(res.default_input_id);
        } else if (res.devices.length > 0) {
          setSelectedDeviceId(res.devices[0].device_id);
        }
      })
      .catch((err: any) => {
        setAudioError(err.message || 'Could not reach local audio service');
      });

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Poll audio status when recording
  useEffect(() => {
    if (audioStatus.state === 'recording' || audioStatus.state === 'paused') {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(async () => {
          const status = await audioService.getSessionStatus();
          setAudioStatus(status);
        }, 600);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [audioStatus.state]);

  // --- Phase 4 Audio Handlers ---
  const handleStartRecording = async () => {
    setAudioError(null);
    try {
      const chosenDev = audioDevices.find((d) => d.device_id === selectedDeviceId);
      const isLoop = chosenDev ? (chosenDev.category === 'playback_loopback' || chosenDev.supports_loopback) : false;

      await audioService.startSession({
        deviceId: selectedDeviceId ?? undefined,
        modelName: selectedWhisperModel,
        chunkDurationSec: chunkDuration,
        isLoopback: isLoop,
      });
      const status = await audioService.getSessionStatus();
      setAudioStatus(status);
      if (status.state === 'error' && status.error_message) {
        setAudioError(status.error_message);
      }
    } catch (err: any) {
      setAudioError(err.message || 'Failed to start recording');
    }
  };

  const handlePauseRecording = async () => {
    await audioService.pauseSession();
    const status = await audioService.getSessionStatus();
    setAudioStatus(status);
  };

  const handleResumeRecording = async () => {
    await audioService.resumeSession();
    const status = await audioService.getSessionStatus();
    setAudioStatus(status);
  };

  const handleStopRecording = async () => {
    await audioService.stopSession();
    const status = await audioService.getSessionStatus();
    setAudioStatus(status);
  };

  const handleClearTranscript = async () => {
    await audioService.clearTranscript();
    setAudioStatus((prev) => ({
      ...prev,
      finalized_segments: [],
      partial_segment: null,
    }));
  };

  const handleTestEndpoint = async () => {
    setIsTestingAudio(true);
    setTestResult(null);
    setAudioError(null);
    try {
      const res = await audioService.testDevice(selectedDeviceId ?? undefined, 1.0);
      setTestResult(res);
    } catch (err: any) {
      setAudioError(err.message || 'Audio endpoint test failed');
    } finally {
      setIsTestingAudio(false);
    }
  };

  const handleCopyTranscript = () => {
    const text = audioStatus.finalized_segments.map((s) => `[${s.timestamp}] ${s.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleSaveTranscriptToHistory = () => {
    const fullText = audioStatus.finalized_segments.map((s) => s.text).join(' ');
    if (!fullText.trim()) return;

    const newSession: InterviewSession = {
      id: `audio-session-${Date.now()}`,
      title: `Interview Audio Practice (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      role: 'Audio Practice Candidate',
      type: 'Behavioral',
      date: new Date().toISOString().split('T')[0],
      durationMinutes: Math.max(1, Math.round(audioStatus.duration_seconds / 60)),
      score: 85,
      totalQuestions: 1,
      status: 'Completed',
      isMock: false,
    };

    onSaveToHistory?.(newSession);
    setSavedTranscriptSuccess(true);
    setTimeout(() => setSavedTranscriptSuccess(false), 2500);
  };

  const handleSendTranscriptToQuestion = (text: string) => {
    setQuestionInput(text);
    setActivePracticeTab('question-answering');
  };

  // --- Phase 3 & 5 Question Processing Handlers ---
  const executeQuestionProcessing = async (textToProcess: string) => {
    if (!textToProcess.trim() || isLoadingQuestion) return;

    setQuestionError(null);
    setSavedSuccess(false);
    setIsLoadingQuestion(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await aiService.processQuestion(textToProcess, {
        style: selectedStyle,
        model: selectedAIModel,
        allowMockFallback: true,
        signal: abortControllerRef.current.signal,
      });

      setAnswerData(response);

      if (window.electronAPI) {
        window.electronAPI.sendToAnswerWindow(response);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelled')) {
        setQuestionError('Generation stopped by user.');
      } else {
        setQuestionError(err.message || 'Failed to process question.');
      }
    } finally {
      setIsLoadingQuestion(false);
      abortControllerRef.current = null;
    }
  };

  const handleGenerateQuestion = async () => {
    await executeQuestionProcessing(questionInput);
  };

  const handleApproveDetectedQuestion = (questionText: string, autoGenerate = true) => {
    setQuestionInput(questionText);
    setActivePracticeTab('question-answering');
    if (autoGenerate) {
      executeQuestionProcessing(questionText);
    }
  };

  const handleStopQuestion = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyFullAnswer = () => {
    if (!answerData) return;
    const text = `QUESTION:\n${answerData.question}\n\n1. DIRECT ANSWER:\n${answerData.structured_answer.direct_answer}\n\n2. SIMPLE EXPLANATION:\n${answerData.structured_answer.simple_explanation}\n\n3. EXAMPLE:\n${answerData.structured_answer.example}\n\n4. IMPORTANT KEYWORDS:\n${answerData.structured_answer.important_keywords.join(', ')}`;
    copyToClipboard(text, 'full');
  };

  const handleOpenSeparateWindow = async () => {
    if (window.electronAPI) {
      await window.electronAPI.openAnswerWindow();
      setAnswerWindowOpen(true);
      if (answerData) {
        window.electronAPI.sendToAnswerWindow(answerData);
      }
    } else {
      window.open('#answer-window', '_blank', 'width=540,height=720');
    }
  };

  // Format timer
  const formatSecs = (total: number) => {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-6xl pb-10 animate-fade-in">
      {/* Top Header & Tab Switching */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Interview Practice & Assistance</h2>
            <Badge variant="primary">Phase 5 Active</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Local Whisper speech-to-text, Question Detection from transcript, and 4-part structured answer processing
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center p-1 bg-surface-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActivePracticeTab('audio-stt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activePracticeTab === 'audio-stt'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Audio & STT</span>
          </button>
          <button
            onClick={() => setActivePracticeTab('question-detection')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activePracticeTab === 'question-detection'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Question Detection</span>
          </button>
          <button
            onClick={() => setActivePracticeTab('question-answering')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activePracticeTab === 'question-answering'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Answer Panel</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE AUDIO CAPTURE & SPEECH-TO-TEXT (PHASE 4)                      */}
      {/* ========================================================================= */}
      {activePracticeTab === 'audio-stt' && (
        <div className="space-y-6 animate-fade-in">
          {/* Recording Status & Audio Visualizer Banner */}
          <Card className="border-slate-800 bg-surface-900/90 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                {audioStatus.state === 'recording' ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>LISTENING ({formatSecs(audioStatus.duration_seconds)})</span>
                  </div>
                ) : audioStatus.state === 'transcribing' ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-mono font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span>TRANSCRIBING SPEECH ({formatSecs(audioStatus.duration_seconds)})</span>
                  </div>
                ) : audioStatus.state === 'paused' ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>PAUSED ({formatSecs(audioStatus.duration_seconds)})</span>
                  </div>
                ) : audioStatus.state === 'error' ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>AUDIO ERROR</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-800 text-slate-400 border border-slate-700 text-xs font-mono">
                    <MicOff className="w-3.5 h-3.5 text-slate-400" />
                    <span>AUDIO ENGINE IDLE</span>
                  </div>
                )}
                <span className="text-xs text-slate-400">
                  Model: <span className="text-brand-300 font-mono">{selectedWhisperModel} (INT8 CPU)</span>
                </span>
              </div>

              {/* Explicit Permission & Non-Storage Privacy Badge */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-surface-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Memory-Only: Zero Audio Files Saved to Disk</span>
              </div>
            </div>

            {/* Audio Source Controls & Bluetooth Earbuds Routing (Requirement 2 & 3) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Endpoint Selector */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Select Windows Audio Input Endpoint
                </label>
                <select
                  value={selectedDeviceId ?? ''}
                  onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
                  disabled={audioStatus.state === 'recording' || audioStatus.state === 'transcribing'}
                  className="w-full bg-surface-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-sans"
                >
                  {audioDevices.map((dev) => {
                    let labelType = 'INPUT MIC';
                    if (dev.category === 'bluetooth_headset') labelType = 'BLUETOOTH MIC';
                    else if (dev.category === 'playback_loopback' || dev.supports_loopback) labelType = 'SYSTEM LOOPBACK';
                    else if (dev.max_input_channels <= 0) labelType = 'OUTPUT ONLY';

                    return (
                      <option key={dev.device_id} value={dev.device_id}>
                        [{labelType}] {dev.name} ({dev.hostapi_name}){dev.supports_loopback ? ' (Captures Meet/Zoom/Browser Audio)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-400">
                  Supports Built-in Laptop Mic, Bluetooth Earbuds Mic, or Windows System Audio Loopback.
                </p>
              </div>

              {/* Model & Chunk Config (Requirement 4) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Whisper Model & Chunk Size
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedWhisperModel}
                    onChange={(e) => setSelectedWhisperModel(e.target.value as any)}
                    disabled={audioStatus.state === 'recording' || audioStatus.state === 'transcribing'}
                    className="flex-1 bg-surface-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                  >
                    <option value="tiny.en">tiny.en (~39MB / Ultra-Fast English)</option>
                    <option value="tiny">tiny (~75MB / Multilingual & Hinglish)</option>
                    <option value="base.en">base.en (~74MB / Accurate English)</option>
                  </select>
                  <select
                    value={chunkDuration}
                    onChange={(e) => setChunkDuration(Number(e.target.value))}
                    disabled={audioStatus.state === 'recording' || audioStatus.state === 'transcribing'}
                    className="w-24 bg-surface-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                  >
                    <option value={2.0}>2.0s</option>
                    <option value={3.0}>3.0s</option>
                    <option value={4.0}>4.0s</option>
                    <option value={5.0}>5.0s</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bluetooth Earbuds Routing Notice (Requirement 3) */}
            <div className="p-3 rounded-lg bg-surface-950/70 border border-slate-800/80 flex items-start gap-2.5 text-xs">
              <Headphones className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Bluetooth Earbuds Windows Routing Guide:</p>
                <p className="text-slate-400 leading-relaxed mt-0.5">
                  Windows separates Bluetooth earbuds into two different devices: <strong>Headphones (Stereo Playback)</strong> and <strong>Headset (Hands-Free Mic)</strong>.
                  Microphone capture records only what you speak; it does not capture incoming sound played inside your earbuds. Test below to verify your levels before starting.
                </p>
              </div>
            </div>

            {/* Audio Diagnostics & Live VU Meter (Requirement 12) */}
            <div className="p-3.5 rounded-xl bg-surface-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-brand-400" />
                  Live Audio Level & Diagnostic Verification
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestEndpoint}
                  isLoading={isTestingAudio}
                  disabled={audioStatus.state === 'recording'}
                >
                  Test Selected Endpoint (1.0s)
                </Button>
              </div>

              {/* Dynamic VU Meter Bar */}
              <div className="space-y-1">
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-150 ${
                      audioStatus.current_volume_rms > 0.08
                        ? 'bg-rose-500'
                        : audioStatus.current_volume_rms > 0.02
                        ? 'bg-emerald-400'
                        : 'bg-brand-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(0, audioStatus.current_volume_rms * 450))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>-60 dB (Silence)</span>
                  <span>
                    RMS Level: {audioStatus.current_volume_rms.toFixed(4)}{' '}
                    {audioStatus.is_silent ? '(Silence Gate)' : '(Active Speech)'}
                  </span>
                  <span>0 dB (Peak)</span>
                </div>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                    testResult.audio_detected
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                      : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                  }`}
                >
                  <span>
                    <strong>{testResult.device_name}:</strong> {testResult.message}
                  </span>
                  <span className="font-mono text-[11px] shrink-0 ml-2">{testResult.db_level} dB</span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {audioError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center justify-between">
                <span>{audioError}</span>
                <button onClick={() => setAudioError(null)} className="underline ml-2">Dismiss</button>
              </div>
            )}

            {/* 6 User Controls (Requirement 5) */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {audioStatus.state !== 'recording' && audioStatus.state !== 'paused' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleStartRecording}
                    leftIcon={<Mic className="w-3.5 h-3.5" />}
                  >
                    Start Recording
                  </Button>
                ) : (
                  <>
                    {audioStatus.state === 'recording' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handlePauseRecording}
                        leftIcon={<Pause className="w-3.5 h-3.5" />}
                      >
                        Pause
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleResumeRecording}
                        leftIcon={<Play className="w-3.5 h-3.5" />}
                      >
                        Resume
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleStopRecording}
                      leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
                    >
                      Stop
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearTranscript}
                  disabled={audioStatus.finalized_segments.length === 0}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Clear Transcript
                </Button>
              </div>

              {/* Explicit Saving & Export Controls (Requirement 9) */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyTranscript}
                  disabled={audioStatus.finalized_segments.length === 0}
                  leftIcon={copiedTranscript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedTranscript ? 'Copied Transcript!' : 'Copy Transcript'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveTranscriptToHistory}
                  disabled={audioStatus.finalized_segments.length === 0}
                  leftIcon={savedTranscriptSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <BookmarkCheck className="w-3.5 h-3.5" />}
                >
                  {savedTranscriptSuccess ? 'Saved to Logs!' : 'Save Transcript'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Live Transcript Stream (Requirement 6) */}
          <Card className="border-slate-800 bg-surface-900/80 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Live Speech-to-Text Transcript</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-800 text-slate-400 border border-slate-700">
                    {audioStatus.finalized_segments.length} Segments
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time timestamps separating finalized segments from in-flight speech
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActivePracticeTab('question-detection')}
                leftIcon={<HelpCircle className="w-3.5 h-3.5 text-indigo-400" />}
              >
                <span>Triage Detected Questions</span>
              </Button>
            </div>

            {audioStatus.finalized_segments.length === 0 && !audioStatus.partial_segment ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-surface-950/40 text-slate-400 space-y-2">
                <Mic className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs font-medium text-slate-300">Transcript is empty</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Click "Start Recording" above and speak into your chosen microphone or headset. Audio chunks will transcribe locally every {chunkDuration}s.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {audioStatus.finalized_segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="p-3.5 rounded-xl bg-surface-950 border border-slate-800/80 space-y-2 hover:border-slate-700 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-surface-900 border border-slate-800 text-brand-300">
                          {seg.timestamp}
                        </span>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                          <Check className="w-3 h-3" />
                          Finalized
                        </span>
                      </div>

                      {/* Bridge to Phase 3: 1-click analyze as question */}
                      <button
                        onClick={() => handleSendTranscriptToQuestion(seg.text)}
                        className="text-[11px] text-slate-400 hover:text-brand-300 flex items-center gap-1 transition opacity-80 group-hover:opacity-100"
                        title="Process this segment in Structured Answer Panel"
                      >
                        <span>Analyze as Question</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">{seg.text}</p>
                  </div>
                ))}

                {/* Partial / In-flight segment */}
                {audioStatus.partial_segment && (
                  <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1 animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        {audioStatus.partial_segment.timestamp}
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono">Transcribing in-flight...</span>
                    </div>
                    <p className="text-xs text-amber-200/90 italic">{audioStatus.partial_segment.text}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUESTION DETECTION FROM TRANSCRIPT & TRIAGE (PHASE 5)              */}
      {/* ========================================================================= */}
      {activePracticeTab === 'question-detection' && (
        <QuestionDetectionPanel
          transcriptSegments={audioStatus.finalized_segments}
          onApproveQuestion={handleApproveDetectedQuestion}
          isGeneratingAnswer={isLoadingQuestion}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INTERVIEW QUESTION PROCESSING & STRUCTURED ANSWER (PHASE 3)        */}
      {/* ========================================================================= */}
      {activePracticeTab === 'question-answering' && (
        <div className="space-y-6 animate-fade-in">
          {/* Question Input Panel */}
          <Card className="border-slate-800 bg-surface-900/90 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">Interview Question Input</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({questionInput.length} characters)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSeparateWindow}
                  leftIcon={<ExternalLink className="w-3.5 h-3.5 text-brand-400" />}
                >
                  {answerWindowOpen ? 'Focus Floating Window' : 'Open in Separate Window'}
                </Button>
                {questionInput && (
                  <button
                    onClick={() => setQuestionInput('')}
                    className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition px-2 py-1 rounded hover:bg-surface-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={3}
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              disabled={isLoadingQuestion}
              placeholder="Enter or paste an interview question here (e.g. 'How would you design a distributed cache with LRU eviction?')..."
              className="w-full bg-surface-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-y leading-relaxed"
            />

            {/* Sample Chips */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-brand-400" />
                Quick Sample Questions:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuestionInput(q)}
                    disabled={isLoadingQuestion}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-surface-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50 text-left truncate max-w-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Style Controls */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 font-medium">Answer Style:</span>
                {[
                  { id: 'concise', label: 'Concise', icon: Zap },
                  { id: 'detailed', label: 'Detailed', icon: BookOpen },
                  { id: 'beginner-friendly', label: 'Beginner-Friendly', icon: Smile },
                  { id: 'interview-ready-english', label: 'Interview-Ready English', icon: Mic },
                ].map((style) => {
                  const Icon = style.icon;
                  const isSelected = selectedStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id as AnswerStyle)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-brand-600 text-white font-medium border-brand-500 shadow-sm'
                          : 'border-slate-800 bg-surface-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{style.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <select
                  value={selectedAIModel}
                  onChange={(e) => setSelectedAIModel(e.target.value)}
                  disabled={isLoadingQuestion}
                  className="bg-surface-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="llama3.2:3b">Llama 3.2 3B</option>
                  <option value="llama3.2:1b">Llama 3.2 1B (Fast CPU)</option>
                  <option value="qwen2.5-coder:3b">Qwen 2.5 Coder 3B</option>
                </select>

                {isLoadingQuestion ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleStopQuestion}
                    leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateQuestion}
                    disabled={!questionInput.trim() || questionInput.trim().length < 3}
                    leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Generate Answer
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Error Message */}
          {questionError && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-200 flex items-start justify-between gap-3 animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-300">Processing Notice:</p>
                  <p className="text-rose-200/90 mt-0.5">{questionError}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setQuestionError(null)} className="text-rose-300">
                Dismiss
              </Button>
            </div>
          )}

          {/* Loading */}
          {isLoadingQuestion && (
            <Card className="border-slate-800 bg-surface-900/60 p-6 flex flex-col items-center justify-center text-center gap-3 animate-fade-in">
              <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Generating 4-Part Structured Answer</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Executing local inference with bounded token limits to keep laptop responsive.
                </p>
              </div>
            </Card>
          )}

          {/* Structured Answer Output */}
          {answerData && !isLoadingQuestion && (
            <div className="space-y-4 animate-fade-in">
              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-surface-900 border border-slate-800 gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white">Generated Structured Answer</span>
                  <Badge variant={answerData.is_mock_fallback ? 'mock' : 'primary'} size="sm">
                    {answerData.is_mock_fallback ? 'Local Mock Fallback' : 'Local Ollama'}
                  </Badge>
                  <span className="text-[11px] font-mono text-slate-400">
                    {answerData.latency_ms}ms | {answerData.model_used}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateQuestion}
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyFullAnswer}
                    leftIcon={copiedKey === 'full' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedKey === 'full' ? 'Copied Full!' : 'Copy Full Answer'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!answerData) return;
                      onSaveToHistory?.({
                        id: `session-${Date.now()}`,
                        title: answerData.question.slice(0, 48),
                        role: 'Software Engineer',
                        type: selectedStyle === 'interview-ready-english' ? 'Behavioral' : 'Technical',
                        date: new Date().toISOString().split('T')[0],
                        durationMinutes: Math.max(1, Math.round(answerData.latency_ms / 1000)),
                        score: 90,
                        totalQuestions: 1,
                        status: 'Completed',
                        isMock: answerData.is_mock_fallback,
                      });
                      setSavedSuccess(true);
                      setTimeout(() => setSavedSuccess(false), 2500);
                    }}
                    leftIcon={savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <BookmarkCheck className="w-3.5 h-3.5" />}
                  >
                    {savedSuccess ? 'Saved to History!' : 'Save to History'}
                  </Button>
                </div>
              </div>

              {/* 1. Direct Answer */}
              <Card className="border-brand-500/30 bg-gradient-to-br from-brand-950/30 via-surface-900 to-surface-900 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-brand-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-brand-500/20 flex items-center justify-center text-brand-300">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-brand-200">1. Direct Answer</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(answerData.structured_answer.direct_answer, 'sec-1')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition px-2 py-1 rounded hover:bg-surface-800"
                  >
                    {copiedKey === 'sec-1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <p className="text-sm text-slate-100 font-medium leading-relaxed">
                  {answerData.structured_answer.direct_answer}
                </p>
              </Card>

              {/* 2. Simple Explanation */}
              <Card className="border-slate-800 bg-surface-900/90 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100">2. Simple Explanation</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(answerData.structured_answer.simple_explanation, 'sec-2')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition px-2 py-1 rounded hover:bg-surface-800"
                  >
                    {copiedKey === 'sec-2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {answerData.structured_answer.simple_explanation}
                </div>
              </Card>

              {/* 3. Practical Example */}
              <Card className="border-slate-800 bg-surface-900/90 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                      <Code2 className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100">3. Practical Example</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(answerData.structured_answer.example, 'sec-3')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition px-2 py-1 rounded hover:bg-surface-800"
                  >
                    {copiedKey === 'sec-3' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-surface-950 border border-slate-800 text-emerald-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {answerData.structured_answer.example}
                </pre>
              </Card>

              {/* 4. Important Keywords */}
              <Card className="border-slate-800 bg-surface-900/90 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center text-amber-300">
                      <KeyRound className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100">4. Important Keywords</h3>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {answerData.structured_answer.important_keywords.map((kw, i) => (
                    <span
                      key={i}
                      onClick={() => copyToClipboard(kw, `kw-${i}`)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-surface-950 border border-slate-800 text-slate-200 hover:border-brand-500 cursor-pointer transition flex items-center gap-1.5 shadow-sm"
                      title="Click to copy keyword"
                    >
                      <span>{kw}</span>
                      {copiedKey === `kw-${i}` && <Check className="w-3 h-3 text-emerald-400" />}
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
