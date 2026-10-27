'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Altimeter-style counter: each digit rolls on its own drum to the new value. Non-digit
 * characters (%, ms, $, .) stay put. Screen readers get the plain value.
 */
export function RollingNumber({ value, className }: { value: string; className?: string }) {
  // Start from zeros, then roll to the real value after mount.
  const [shown, setShown] = useState(() => value.replace(/\d/g, '0'));
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={cn('num inline-flex', className)} aria-label={value} role="img">
      {Array.from(shown).map((char, index) =>
        /\d/.test(char) ? (
          <span
            key={index}
            aria-hidden
            className="relative inline-block h-[1em] overflow-hidden leading-none"
            style={{ width: '0.62em' }}
          >
            <span
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translateY(-${Number(char)}em)`, transitionDelay: `${index * 35}ms` }}
            >
              {DIGITS.map((digit) => (
                <span key={digit} className="h-[1em] text-center">
                  {digit}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={index} aria-hidden className="leading-none">
            {char}
          </span>
        ),
      )}
    </span>
  );
}
