import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Consistent page header: mono eyebrow, display title, one primary action on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow ? <div className="label-mono flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
        <h1 className="truncate text-[28px] font-medium sm:text-[32px]">{title}</h1>
        {description ? <p className="max-w-2xl text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
