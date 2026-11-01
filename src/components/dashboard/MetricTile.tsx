import React from 'react';
import { Card } from '../common/Card';
import { LucideIcon } from 'lucide-react';

interface MetricTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: string;
  iconColor?: string;
}

export const MetricTile: React.FC<MetricTileProps> = ({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  iconColor = 'text-brand-400 bg-brand-500/10 border-brand-500/20',
}) => {
  return (
    <Card className="flex items-center gap-4 border-slate-800/80 bg-surface-900/50 p-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400 truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-xl font-bold text-white tracking-tight">{value}</span>
          {trend && <span className="text-xs font-medium text-emerald-400">{trend}</span>}
        </div>
        {subValue && <p className="text-[11px] text-slate-400 truncate mt-0.5">{subValue}</p>}
      </div>
    </Card>
  );
};
