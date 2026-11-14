import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className }) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    neutral: 'bg-stone-100 text-stone-700 border-stone-200',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase',
          variants[variant],
          className
        )
      )}
    >
      {children}
    </span>
  );
};

export function getStatusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (status.toUpperCase()) {
    case 'DELIVERED':
    case 'VALID':
    case 'COMPLETED':
      return 'success';
    case 'WARNING':
    case 'PARTIAL':
    case 'QUEUED':
    case 'PROCESSING':
    case 'RETRYING':
      return 'warning';
    case 'FAILED':
    case 'ERROR':
      return 'error';
    case 'SENT':
      return 'info';
    default:
      return 'neutral';
  }
}
