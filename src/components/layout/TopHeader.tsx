import React from 'react';
import { Minus, Square, X, ShieldCheck, Activity } from 'lucide-react';
import { NavigationTab, LocalAIStatusData } from '../../types';

interface TopHeaderProps {
  activeTab: NavigationTab;
  aiStatus: LocalAIStatusData | null;
  appVersion: string;
}

const TAB_TITLES: Record<NavigationTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Command Center',
    subtitle: 'System readiness, quick-launch actions & performance telemetry',
  },
  'interview-practice': {
    title: 'Interview Simulator',
    subtitle: 'Interactive voice & text mock sessions with real-time feedback',
  },
  'ai-chat': {
    title: 'AI Copilot Chat',
    subtitle: 'Instant interview coaching and design brainstorming',
  },
  'coding-assistant': {
    title: 'Live Coding Assistant',
    subtitle: 'LeetCode-style algorithmic problem solving & hints',
  },
  'resume-analyzer': {
    title: 'Resume & ATS Matcher',
    subtitle: 'Private on-device CV parsing and role alignment',
  },
  'question-bank': {
    title: 'Curated Question Bank',
    subtitle: 'Explore 500+ standard engineering & behavioral questions',
  },
  history: {
    title: 'Session History',
    subtitle: 'Archived transcripts, evaluations & scoring logs',
  },
  settings: {
    title: 'Application Settings',
    subtitle: 'Local AI engine, hardware tuning & audio configuration',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  aiStatus,
  appVersion,
}) => {
  const current = TAB_TITLES[activeTab] || { title: 'Dashboard', subtitle: '' };

  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <header className="h-16 bg-surface-900 border-b border-slate-800/80 px-6 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            {current.title}
            <span className="text-[10px] font-mono text-slate-500 font-normal">v{appVersion}</span>
          </h1>
          <p className="text-xs text-slate-400">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Local Security & Privacy Pill */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-800 border border-slate-700/60 text-xs text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-medium">Local-Only (No Cloud APIs)</span>
        </div>

        {/* AI Engine Status */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-800 border border-slate-700/60 text-xs text-slate-300">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-medium">
            AI: {aiStatus ? (aiStatus.ollamaRunning ? `Ollama (${aiStatus.model})` : aiStatus.backendOnline ? 'Ollama Offline' : 'Backend Offline') : 'Connecting...'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              aiStatus?.ollamaRunning
                ? 'bg-emerald-400 animate-pulse'
                : aiStatus?.backendOnline
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`}
          />
        </div>

        {/* Window action buttons (for Electron desktop environment) */}
        {window.electronAPI && (
          <div className="flex items-center ml-2 border-l border-slate-800 pl-3 gap-1">
            <button
              onClick={handleMinimize}
              className="p-1.5 rounded hover:bg-surface-800 text-slate-400 hover:text-white transition"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              className="p-1.5 rounded hover:bg-surface-800 text-slate-400 hover:text-white transition"
              title="Maximize"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 rounded hover:bg-rose-600/80 text-slate-400 hover:text-white transition"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
