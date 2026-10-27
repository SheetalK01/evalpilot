'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}
      {...props}
    />
  );
}

/** Mono tab label with a signal underline on the active tab. */
export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'label-mono relative -mb-px shrink-0 border-b-2 border-transparent px-3 py-3 transition-colors hover:text-text data-[state=active]:border-signal data-[state=active]:text-text',
        className,
      )}
      {...props}
    />
  );
}
