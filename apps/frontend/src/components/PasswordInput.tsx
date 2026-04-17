'use client';

import { useState, forwardRef } from 'react';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  wrapperClassName?: string;
  toggleAriaLabel?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { wrapperClassName = '', className = '', toggleAriaLabel, autoComplete, autoCapitalize, autoCorrect, spellCheck, style, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete ?? 'current-password'}
        autoCapitalize={autoCapitalize ?? 'off'}
        autoCorrect={autoCorrect ?? 'off'}
        spellCheck={spellCheck ?? false}
        className={className}
        style={{ paddingRight: '2.75rem', ...(style || {}) }}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={toggleAriaLabel ?? (visible ? 'Hide password' : 'Show password')}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute top-1/2 -translate-y-1/2 right-1 w-11 h-11 flex items-center justify-center text-white/40 hover:text-white/70 transition rounded-lg"
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.55 19.55 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.55 19.55 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
});

export default PasswordInput;
