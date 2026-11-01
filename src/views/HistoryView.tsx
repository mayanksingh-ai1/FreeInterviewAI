import React, { useState } from 'react';
import { Calendar, Clock, Award, Trash2, Search } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { InterviewSession } from '../types';
import { MOCK_RECENT_SESSIONS } from '../mocks/mockData';

export const HistoryView: React.FC = () => {
  const [sessions, setSessions] = useState<InterviewSession[]>(MOCK_RECENT_SESSIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);

  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Interview Practice Logs & History</h2>
            <Badge variant="mock">Phase 1 Mock Logs</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Past interview transcripts and local SQLite feedback evaluations
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search sessions by role, topic, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {filteredSessions.length} Recorded Sessions
        </span>
      </div>

      {filteredSessions.length === 0 ? (
        <EmptyState
          title="No Matching History Logs"
          description="No archived mock sessions matched your search criteria."
          actionLabel="Reset Search"
          onAction={() => setSearchTerm('')}
        />
      ) : (
        <Card className="border-slate-800 bg-surface-900/80 divide-y divide-slate-800/80">
          {filteredSessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-850/60 transition cursor-pointer"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-slate-100">{s.title}</h3>
                  <Badge
                    variant={
                      s.type === 'Technical'
                        ? 'primary'
                        : s.type === 'System Design'
                        ? 'warning'
                        : 'secondary'
                    }
                    size="sm"
                  >
                    {s.type}
                  </Badge>
                  <Badge variant="mock" size="sm">Mock Record</Badge>
                </div>
                <p className="text-xs text-slate-400">{s.role}</p>
                <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {s.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {s.durationMinutes} mins
                  </span>
                  <span>{s.totalQuestions} Questions</span>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-auto shrink-0">
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Award className="w-4 h-4 text-brand-400" />
                    <span className="text-lg font-bold text-white">{s.score}%</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">Completed</span>
                </div>

                <button
                  onClick={(e) => handleDelete(s.id, e)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Delete Session Log"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={selectedSession ? `${selectedSession.title} (Archived Transcript)` : ''}
        footer={
          <Button variant="secondary" size="sm" onClick={() => setSelectedSession(null)}>
            Close
          </Button>
        }
      >
        {selectedSession && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-950 border border-slate-800">
              <div>
                <p className="text-slate-400">Final Evaluated Score</p>
                <p className="text-xl font-bold text-emerald-400">{selectedSession.score}%</p>
              </div>
              <Badge variant="mock">Phase 1 Stored Log</Badge>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-slate-200">Question Transcript Summary:</p>
              <div className="p-3 rounded-lg bg-surface-950 border border-slate-800 space-y-2">
                <p className="text-brand-300 font-mono">Q1: "Explain how you handle cache stampedes in a high-throughput API."</p>
                <p className="text-slate-300">
                  <span className="text-slate-400">Candidate Answer:</span> "Used mutex locking around cache refills and implemented probabilistic early expiration (XFetch algorithm) to refresh keys prior to TTL lapse."
                </p>
                <p className="text-emerald-400 text-[11px]">
                  Evaluator Rating: 9.5/10 — Excellent awareness of real-world distributed systems problems.
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
