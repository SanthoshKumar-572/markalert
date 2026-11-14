import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={twMerge(
            clsx(
              'w-full px-3 py-2 bg-white border rounded-lg text-sm transition-colors text-stone-900 placeholder:text-stone-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              error
                ? 'border-rose-400 focus:ring-rose-500 focus:border-rose-500'
                : 'border-stone-300 focus:ring-[#7A1A2C] focus:border-[#7A1A2C]',
              'disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed',
              className
            )
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-rose-600 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-stone-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
