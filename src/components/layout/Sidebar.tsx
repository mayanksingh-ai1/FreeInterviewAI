import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Mic,
  Code2,
  FileSpreadsheet,
  BookOpen,
  History,
  Settings,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { NavigationTab } from '../../types';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  systemMemory?: { total: number; free: number };
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isPhase1Ready?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, isPhase1Ready: true },
  { id: 'interview-practice', label: 'Interview Practice', icon: Mic, badge: 'Phase 1 Mock' },
  { id: 'ai-chat', label: 'AI Chat', icon: MessageSquare, badge: 'Preview' },
  { id: 'coding-assistant', label: 'Coding Assistant', icon: Code2, badge: 'Phase 1 Mock' },
  { id: 'resume-analyzer', label: 'Resume Analyzer', icon: FileSpreadsheet, badge: 'Phase 1 Mock' },
  { id: 'question-bank', label: 'Question Bank', icon: BookOpen, isPhase1Ready: true },
  { id: 'history', label: 'History', icon: History, isPhase1Ready: true },
  { id: 'settings', label: 'Settings', icon: Settings, isPhase1Ready: true },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  systemMemory,
}) => {
  return (
    <aside className="w-64 bg-surface-900 border-r border-slate-800/80 flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800/80 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-bold">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">FreeInterview</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-mono font-semibold">AI</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">100% Local & Private</p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="py-4 px-3 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600/15 text-brand-300 border border-brand-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-brand-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 border border-slate-700/60 text-slate-400 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hardware / Low RAM Indicator */}
      <div className="p-3 border-t border-slate-800/80 bg-surface-950/40 m-2 rounded-xl border">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Target: 8 GB RAM</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-mono font-semibold">
            Optimal
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-tight">
          {systemMemory
            ? `${systemMemory.free.toFixed(1)} GB free of ${systemMemory.total.toFixed(1)} GB`
            : 'Low-memory model quantizations enabled'}
        </p>
      </div>
    </aside>
  );
};
