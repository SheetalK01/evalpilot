'use client';

import type { ReactNode } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';

/** Asks before anything destructive. The confirm button names the action ("Revoke key"). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        {children}
        <DialogFooter className={children ? undefined : 'mt-0 border-t-0 pt-0'}>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending} data-testid="confirm-button">
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
