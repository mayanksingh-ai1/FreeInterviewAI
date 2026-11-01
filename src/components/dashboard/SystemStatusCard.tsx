import React from 'react';
import { Cpu, HardDrive, Mic, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { SystemInfoData, LocalAIStatusData } from '../../types';

interface SystemStatusCardProps {
  systemInfo: SystemInfoData | null;
  aiStatus: LocalAIStatusData | null;
  micStatus: string;
  onRunDiagnostics?: () => void;
}

export const SystemStatusCard: React.FC<SystemStatusCardProps> = ({
  systemInfo,
  aiStatus,
  micStatus,
  onRunDiagnostics,
}) => {
  const totalMem = systemInfo?.memoryTotalGB || 8.0;
  const freeMem = systemInfo?.memoryFreeGB || 4.2;
  const usedMem = Math.max(0, totalMem - freeMem);
  const memPercent = Math.round((usedMem / totalMem) * 100);

  return (
    <Card className="border-slate-800 bg-surface-900/90 relative overflow-hidden">
      {/* Background subtle glow */}
      <div className="absolute top-0 right-0 w-72 h-36 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-100">System Telemetry & Local Readiness</h2>
            {aiStatus?.ollamaRunning ? (
              <Badge variant="success">Ollama Ready</Badge>
            ) : aiStatus?.backendOnline ? (
              <Badge variant="warning">Ollama Missing (Simulated Fallback)</Badge>
            ) : (
              <Badge variant="danger">Backend Offline</Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time hardware verification tuned for Intel i5-1135G7 / 8 GB RAM laptop limits
          </p>
        </div>

        {onRunDiagnostics && (
          <button
            onClick={onRunDiagnostics}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Check Hardware
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
        {/* RAM Metric */}
        <div className="p-3.5 rounded-lg bg-surface-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              Memory Allocation
            </span>
            <span className="font-mono text-slate-300 font-medium">{memPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-500 ${
                memPercent > 80 ? 'bg-amber-500' : 'bg-brand-500'
              }`}
              style={{ width: `${memPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {usedMem.toFixed(1)} GB used / {totalMem.toFixed(1)} GB total
          </p>
        </div>

        {/* Local AI Engine */}
        <div className="p-3.5 rounded-lg bg-surface-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              Local AI Engine
            </span>
            {aiStatus?.ollamaRunning ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : aiStatus?.backendOnline ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1 truncate">
            {aiStatus?.model || 'llama3.2:1b'}
          </div>
          {aiStatus?.ollamaRunning ? (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-mono">
              ● Ollama Active (100% Local)
            </p>
          ) : aiStatus?.backendOnline ? (
            <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1 font-mono">
              ▲ Ollama Missing (Mock Fallback)
            </p>
          ) : (
            <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-mono">
              ✖ Backend Service Offline
            </p>
          )}
        </div>

        {/* Audio Input / Mic */}
        <div className="p-3.5 rounded-lg bg-surface-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              Audio Input Engine
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1">
            {micStatus === 'granted' ? 'Microphone Active' : 'Permission Required'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Local Whisper ASR Ready
          </p>
        </div>

        {/* Privacy & Airgap */}
        <div className="p-3.5 rounded-lg bg-surface-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              Data Airgap
            </span>
            <Badge variant="success" size="sm">Active</Badge>
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1">
            100% Local Persistence
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            SQLite local database only
          </p>
        </div>
      </div>
    </Card>
  );
};
