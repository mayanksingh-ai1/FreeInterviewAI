import React, { useState } from 'react';
import { Target, Timer, Trophy, HardDriveDownload } from 'lucide-react';
import { SystemStatusCard } from '../components/dashboard/SystemStatusCard';
import { FeatureCard } from '../components/dashboard/FeatureCard';
import { RecentSessionsList } from '../components/dashboard/RecentSessionsList';
import { MetricTile } from '../components/dashboard/MetricTile';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  NavigationTab,
  FeatureCardItem,
  InterviewSession,
  SystemInfoData,
  LocalAIStatusData,
} from '../types';

interface DashboardViewProps {
  features: FeatureCardItem[];
  recentSessions: InterviewSession[];
  systemInfo: SystemInfoData | null;
  aiStatus: LocalAIStatusData | null;
  micStatus: string;
  onNavigate: (tab: NavigationTab) => void;
  onRefreshTelemetry: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  features,
  recentSessions,
  systemInfo,
  aiStatus,
  micStatus,
  onNavigate,
  onRefreshTelemetry,
}) => {
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-950/80 via-surface-900 to-indigo-950/40 border border-brand-500/20 relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
              FreeInterviewAI Desktop
            </span>
            {aiStatus?.ollamaRunning ? (
              <Badge variant="success">Ollama Live ({aiStatus.model})</Badge>
            ) : aiStatus?.backendOnline ? (
              <Badge variant="warning">FastAPI Online (Ollama Missing)</Badge>
            ) : (
              <Badge variant="danger">Backend Offline</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Prepare for Technical Interviews. Completely Offline.
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Zero cloud subscriptions, zero telemetry leaks, and zero data leaves your Intel i5 laptop.
            Optimized for fast local inference within an 8 GB RAM boundary.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          icon={Timer}
          label="Total Practice Time"
          value="147 min"
          subValue="4 sessions logged"
          trend="+18% this week"
        />
        <MetricTile
          icon={Trophy}
          label="Average Readiness Score"
          value="81%"
          subValue="Goal: >85%"
          trend="+5.4% improvement"
          iconColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        />
        <MetricTile
          icon={Target}
          label="Questions Mastered"
          value="15 / 500"
          subValue="Algorithms & System Design"
          iconColor="text-amber-400 bg-amber-500/10 border-amber-500/20"
        />
        <MetricTile
          icon={HardDriveDownload}
          label="Local SQLite Storage"
          value="4.2 MB"
          subValue="Encrypted local database"
          iconColor="text-purple-400 bg-purple-500/10 border-purple-500/20"
        />
      </div>

      {/* System Status Section */}
      <SystemStatusCard
        systemInfo={systemInfo}
        aiStatus={aiStatus}
        micStatus={micStatus}
        onRunDiagnostics={onRefreshTelemetry}
      />

      {/* Feature Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Practice & Assistance Suites</h2>
            <p className="text-xs text-slate-400">Launch specialized modules for your prep workflow</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">6 Modules Loaded</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              onLaunch={(id) => onNavigate(id)}
            />
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <RecentSessionsList
        sessions={recentSessions}
        onViewAll={() => onNavigate('history')}
        onSelectSession={(sess) => setSelectedSession(sess)}
      />

      {/* Session Details Modal */}
      <Modal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={selectedSession ? selectedSession.title : 'Session Details'}
        footer={
          <Button variant="secondary" size="sm" onClick={() => setSelectedSession(null)}>
            Close
          </Button>
        }
      >
        {selectedSession && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-950 border border-slate-800">
              <div>
                <p className="text-xs text-slate-400">Interview Evaluation</p>
                <p className="text-lg font-bold text-white">{selectedSession.score} / 100</p>
              </div>
              <Badge variant="mock">Simulated Score</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">Role & Focus</p>
              <p className="text-sm text-slate-400">{selectedSession.role} ({selectedSession.type})</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">Session Summary</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Candidate demonstrated strong conceptual understanding of the problem space, clear articulation
                of algorithmic time/space complexities, and proactive communication. Recommended improvement:
                deepen familiarity with distributed cache eviction edge cases.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
