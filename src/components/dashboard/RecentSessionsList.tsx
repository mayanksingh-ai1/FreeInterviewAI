import React from 'react';
import { Calendar, Clock, Award, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { InterviewSession } from '../../types';

interface RecentSessionsListProps {
  sessions: InterviewSession[];
  isLoading?: boolean;
  onViewAll?: () => void;
  onSelectSession?: (session: InterviewSession) => void;
}

export const RecentSessionsList: React.FC<RecentSessionsListProps> = ({
  sessions,
  isLoading = false,
  onViewAll,
  onSelectSession,
}) => {
  if (isLoading) {
    return (
      <Card className="border-slate-800">
        <LoadingSpinner label="Loading local interview logs..." />
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="No Practice Sessions Yet"
        description="Launch an AI mock interview or practice question from the cards above to record your first local session."
        actionLabel="Start Mock Session"
        onAction={onViewAll}
      />
    );
  }

  return (
    <Card className="border-slate-800 bg-surface-900/80">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100">Recent Practice Sessions</h3>
            <Badge variant="mock">Mock Records</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Locally stored session evaluations and STAR performance scores
          </p>
        </div>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll} rightIcon={<ArrowUpRight className="w-4 h-4" />}>
            View All History
          </Button>
        )}
      </div>

      <div className="divide-y divide-slate-800/60 mt-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelectSession?.(session)}
            className="py-3.5 px-2 -mx-2 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-850/60 transition cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-medium text-slate-200">{session.title}</span>
                <Badge
                  variant={
                    session.type === 'Technical'
                      ? 'primary'
                      : session.type === 'System Design'
                      ? 'warning'
                      : 'secondary'
                  }
                  size="sm"
                >
                  {session.type}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {session.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {session.durationMinutes} mins
                </span>
                <span className="text-slate-400">{session.role}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <Award className="w-4 h-4 text-brand-400" />
                  <span className="text-base font-bold text-slate-100">{session.score}%</span>
                </div>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end">
                  <CheckCircle2 className="w-3 h-3" />
                  Evaluated
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
