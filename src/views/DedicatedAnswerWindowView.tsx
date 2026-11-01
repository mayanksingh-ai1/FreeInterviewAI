import React, { useState, useEffect } from 'react';
import {
  Pin,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Cpu,
  BookOpen,
  Code2,
  KeyRound,
  FileQuestion,
} from 'lucide-react';
import { QuestionProcessResponse } from '../types';

export const DedicatedAnswerWindowView: React.FC = () => {
  const [data, setData] = useState<QuestionProcessResponse | null>(null);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [fontSize, setFontSize] = useState<number>(14);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    // Check initial always-on-top status
    window.electronAPI?.getAnswerWindowStatus().then((status) => {
      setIsAlwaysOnTop(status.isAlwaysOnTop);
    }).catch(() => {});

    // Listen for incoming answer data via restricted IPC bridge
    const unsubscribe = window.electronAPI?.onAnswerWindowData((incomingData) => {
      if (incomingData) {
        setData(incomingData);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const toggleAlwaysOnTop = async () => {
    const nextState = !isAlwaysOnTop;
    const result = await window.electronAPI?.toggleAnswerWindowAlwaysOnTop(nextState);
    if (typeof result === 'boolean') {
      setIsAlwaysOnTop(result);
    } else {
      setIsAlwaysOnTop(nextState);
    }
  };

  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyFull = () => {
    if (!data) return;
    const full = `QUESTION:
${data.question}

1. DIRECT ANSWER:
${data.structured_answer.direct_answer}

2. SIMPLE EXPLANATION:
${data.structured_answer.simple_explanation}

3. EXAMPLE:
${data.structured_answer.example}

4. KEYWORDS:
${data.structured_answer.important_keywords.join(', ')}`;
    copyToClipboard(full, 'full');
  };

  return (
    <div className="h-screen w-screen bg-surface-950 text-slate-100 flex flex-col overflow-hidden font-sans select-text">
      {/* Top Header Bar */}
      <header className="h-12 bg-surface-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">Answer Panel</span>
          {data?.is_mock_fallback && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30 font-mono">
              Simulated
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Always on top toggle */}
          <button
            onClick={toggleAlwaysOnTop}
            title={isAlwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border transition ${
              isAlwaysOnTop
                ? 'bg-brand-600/30 text-brand-300 border-brand-500/50 shadow-sm'
                : 'bg-surface-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Pin className={`w-3 h-3 ${isAlwaysOnTop ? 'text-brand-400 rotate-45' : ''}`} />
            <span>{isAlwaysOnTop ? 'On Top' : 'Pin'}</span>
          </button>

          {/* Font zoom controls */}
          <div className="flex items-center bg-surface-800 rounded-md border border-slate-700">
            <button
              onClick={() => setFontSize((s) => Math.max(11, s - 1))}
              className="p-1 text-slate-400 hover:text-white"
              title="Decrease Font Size"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1 text-slate-300">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(22, s + 1))}
              className="p-1 text-slate-400 hover:text-white"
              title="Increase Font Size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy Full button */}
          {data && (
            <button
              onClick={handleCopyFull}
              className="p-1.5 rounded-md bg-surface-800 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Copy Entire Answer"
            >
              {copiedSection === 'full' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4" style={{ fontSize: `${fontSize}px` }}>
        {!data ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-full bg-surface-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <FileQuestion className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Waiting for Question</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              Enter or paste a question in the main FreeInterviewAI application and click Generate Answer or Open in Separate Window.
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Question Card */}
            <div className="p-3.5 rounded-xl bg-surface-900/90 border border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-mono text-brand-300 uppercase tracking-wide">Interview Question</span>
                <span className="font-mono">{data.style}</span>
              </div>
              <p className="font-semibold text-white leading-snug">{data.question}</p>
            </div>

            {/* 1. Direct Answer */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-brand-950/40 via-surface-900 to-surface-900 border border-brand-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-300">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  <span>1. Direct Answer</span>
                </div>
                <button
                  onClick={() => copyToClipboard(data.structured_answer.direct_answer, 'direct')}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-surface-800 transition"
                  title="Copy Direct Answer"
                >
                  {copiedSection === 'direct' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-slate-100 font-medium leading-relaxed">
                {data.structured_answer.direct_answer}
              </p>
            </div>

            {/* 2. Simple Explanation */}
            <div className="p-4 rounded-xl bg-surface-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>2. Simple Explanation</span>
                </div>
                <button
                  onClick={() => copyToClipboard(data.structured_answer.simple_explanation, 'explanation')}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-surface-800 transition"
                  title="Copy Explanation"
                >
                  {copiedSection === 'explanation' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                {data.structured_answer.simple_explanation}
              </div>
            </div>

            {/* 3. Practical Example */}
            <div className="p-4 rounded-xl bg-surface-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <span>3. Practical Example</span>
                </div>
                <button
                  onClick={() => copyToClipboard(data.structured_answer.example, 'example')}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-surface-800 transition"
                  title="Copy Example"
                >
                  {copiedSection === 'example' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-surface-950 border border-slate-800/80 text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                {data.structured_answer.example}
              </pre>
            </div>

            {/* 4. Important Keywords */}
            <div className="p-4 rounded-xl bg-surface-900 border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>4. Important Keywords</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {data.structured_answer.important_keywords.map((kw, i) => (
                  <span
                    key={i}
                    onClick={() => copyToClipboard(kw, `kw-${i}`)}
                    className="text-xs px-2.5 py-1 rounded-md bg-surface-950 border border-slate-800 text-slate-200 hover:border-brand-500 cursor-pointer transition flex items-center gap-1"
                    title="Click to copy keyword"
                  >
                    <span>{kw}</span>
                    {copiedSection === `kw-${i}` && <Check className="w-3 h-3 text-emerald-400" />}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer Telemetry */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/60">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                {data.model_used}
              </span>
              <span>{data.latency_ms}ms generation latency</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
