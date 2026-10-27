'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlay =
  'fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] data-[state=open]:animate-[row-in_150ms_ease-out]';

/** Centered dialog with a mono header strip. `side="right"` makes it a drawer. */
export function DialogContent({
  title,
  description,
  children,
  side = 'center',
  className,
  ...props
}: {
  title: string;
  description?: string;
  children: ReactNode;
  side?: 'center' | 'right';
  className?: string;
} & Omit<DialogPrimitive.DialogContentProps, 'title'>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        {...props}
        className={cn(
          'panel fixed z-50 flex flex-col focus:outline-none',
          side === 'center'
            ? 'top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 crosshair'
            : 'top-0 right-0 h-dvh w-full max-w-xl rounded-none border-y-0 border-r-0 data-[state=open]:animate-[row-in_180ms_ease-out]',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="space-y-1">
            <DialogPrimitive.Title className="font-display text-lg font-medium">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="-mr-2 rounded-sm p-1.5 text-muted transition-colors hover:bg-panel-2 hover:text-text"
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.5} />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end',
        className,
      )}
    >
      {children}
    </div>
  );
}
