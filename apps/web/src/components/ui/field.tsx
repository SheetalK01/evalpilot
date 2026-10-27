import * as LabelPrimitive from '@radix-ui/react-label';
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-sm border border-line bg-bg text-text placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus-visible:border-signal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal aria-[invalid=true]:border-fail disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  ({ className, mono, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(control, 'h-9 px-3 text-sm', mono && 'num text-[13px]', className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }
>(({ className, mono, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      control,
      'min-h-24 px-3 py-2 text-sm leading-relaxed',
      mono && 'num text-[13px]',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

/** Native select: fully accessible and keyboard friendly, styled to match. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        control,
        'h-9 appearance-none bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8 pl-3 text-sm',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%237c877f' stroke-width='1.5'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Label({ className, ...props }: LabelPrimitive.LabelProps) {
  return <LabelPrimitive.Root className={cn('label-mono block', className)} {...props} />;
}

/** Label + control + hint/error, with the error linked for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-fail">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
