import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants = {
      primary: 'bg-[#7A1A2C] text-white hover:bg-[#621422] focus:ring-[#7A1A2C] active:bg-[#4d101b] shadow-sm',
      secondary: 'bg-stone-200 text-stone-800 hover:bg-stone-300 focus:ring-stone-400 active:bg-stone-400',
      outline: 'border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 focus:ring-[#7A1A2C]',
      danger: 'bg-rose-700 text-white hover:bg-rose-800 focus:ring-rose-700 shadow-sm',
      ghost: 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 focus:ring-stone-400',
    };

    const sizes = {
      sm: 'px-2.5 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-5 py-2.5 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
