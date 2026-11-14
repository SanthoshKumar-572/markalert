import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx('bg-white border border-stone-200/80 rounded-xl shadow-xs overflow-hidden', className)
      )}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, description, action, className }) => {
  return (
    <div
      className={twMerge(
        clsx(
          'px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-4',
          className
        )
      )}
    >
      <div>
        <h3 className="text-base font-bold text-stone-900 tracking-tight">{title}</h3>
        {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return <div className={twMerge(clsx('p-6', className))}>{children}</div>;
};

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx('px-6 py-3.5 bg-stone-50/70 border-t border-stone-100 flex items-center', className)
      )}
    >
      {children}
    </div>
  );
};
