import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-800/80 bg-surface-900/70 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 ${
        hoverable ? 'hover:border-slate-700 hover:bg-surface-850 hover:shadow-md cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
