import React from 'react';
import {
  Mic,
  MessageSquareText,
  Code2,
  FileText,
  BookOpen,
  History,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { FeatureCardItem } from '../../types';

interface FeatureCardProps {
  feature: FeatureCardItem;
  onLaunch: (id: FeatureCardItem['id']) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Mic,
  MessageSquareText,
  Code2,
  FileText,
  BookOpen,
  History,
};

export const FeatureCard: React.FC<FeatureCardProps> = ({ feature, onLaunch }) => {
  const IconComponent = ICON_MAP[feature.iconName] || BookOpen;

  return (
    <Card
      hoverable
      onClick={() => onLaunch(feature.id)}
      className="group relative flex flex-col justify-between h-full border-slate-800/80 bg-surface-900/60 hover:border-brand-500/50 hover:bg-surface-850/90 transition-all duration-200"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:bg-brand-500/20 group-hover:scale-105 transition-all">
            <IconComponent className="w-5 h-5" />
          </div>
          {feature.badge && (
            <Badge
              variant={feature.isReadyInPhase1 ? 'secondary' : 'mock'}
              size="sm"
            >
              {feature.badge}
            </Badge>
          )}
        </div>

        <h3 className="text-base font-semibold text-slate-100 group-hover:text-brand-300 transition-colors mb-2">
          {feature.title}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          {feature.description}
        </p>
      </div>

      <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-brand-300">
        <span className="text-[11px] font-mono text-slate-400">
          {feature.category}
        </span>
        <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          <span>Launch</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Card>
  );
};
