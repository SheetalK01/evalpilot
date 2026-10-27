'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Check, Copy } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-panel-2 px-1 font-mono text-[11px] text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-xs border border-line bg-bg p-0.5 transition-colors data-[state=checked]:border-signal data-[state=checked]:bg-[color-mix(in_oklab,var(--signal)_18%,transparent)]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-3.5 rounded-[1px] bg-muted transition-transform duration-150 data-[state=checked]:translate-x-4 data-[state=checked]:bg-signal" />
    </SwitchPrimitive.Root>
  );
}

/** Copies text and briefly confirms. Used for API keys, request ids and snippets. */
export function CopyButton({
  value,
  label = 'Copy',
  className,
  testId,
}: {
  value: string;
  label?: string;
  className?: string;
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={copied ? 'Copied' : label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs px-1.5 py-1 font-mono text-[11px] text-muted transition-colors hover:bg-panel-2 hover:text-text',
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-pass" strokeWidth={1.5} />
      ) : (
        <Copy className="size-3.5" strokeWidth={1.5} />
      )}
      <span>{copied ? 'COPIED' : label.toUpperCase()}</span>
    </button>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-line', className)} />;
}
