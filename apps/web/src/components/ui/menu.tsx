'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, ...props }: Menu.DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={6}
        align="end"
        className={cn('panel z-50 min-w-48 p-1', className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: Menu.DropdownMenuItemProps) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-xs px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-panel-2 [&_svg]:size-4 [&_svg]:stroke-[1.5] [&_svg]:text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: Menu.DropdownMenuLabelProps) {
  return <Menu.Label className={cn('px-2.5 py-2 text-[13px] text-muted', className)} {...props} />;
}

export const DropdownMenuSeparator = () => <Menu.Separator className="my-1 h-px bg-line" />;
