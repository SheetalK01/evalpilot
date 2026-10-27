'use client';

import type { ApiKeyResponse, CreatedApiKeyResponse } from '@evalpilot/shared';
import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatRelative } from '@/lib/format';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/lib/queries';
import { Panel } from '../instruments/panel';
import { EmptyState, ErrorState, ScanRows } from '../instruments/states';
import { Tag } from '../instruments/status';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Field, Input } from '../ui/field';
import { CopyButton } from '../ui/misc';
import { ConfirmDialog } from './confirm-dialog';

/** Project API keys: create (shown once), list by prefix only, revoke. Used by the SDK and CLI. */
export function ApiKeysPanel({ projectId }: { projectId: string }) {
  const keys = useApiKeys(projectId);
  const create = useCreateApiKey(projectId);
  const revoke = useRevokeApiKey(projectId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedApiKeyResponse | null>(null);
  const [toRevoke, setToRevoke] = useState<ApiKeyResponse | null>(null);

  const submit = () =>
    create.mutate(name.trim() || 'CI', {
      onSuccess: (key) => {
        setCreated(key);
        setCreating(false);
        setName('');
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <Panel
      title="API KEYS"
      bodyClassName="p-0"
      action={
        <Button size="sm" variant="primary" onClick={() => setCreating(true)} data-testid="api-key-create">
          <Plus /> Create key
        </Button>
      }
    >
      {keys.isLoading ? (
        <ScanRows className="p-4" rows={2} />
      ) : keys.error ? (
        <ErrorState className="m-4" error={keys.error} onRetry={() => void keys.refetch()} />
      ) : keys.data?.length === 0 ? (
        <EmptyState
          title="No API keys"
          text="Create a key for the SDK (traces) or the CLI (CI gate). You will see it once."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-line">
          {keys.data?.map((key) => (
            <li
              key={key.id}
              data-testid="api-key-row"
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <KeyRound className="size-4 text-muted" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-text">{key.name}</div>
                <div className="num text-[12px] text-muted">
                  {key.prefix}…{'  '}· created {formatRelative(key.createdAt)} ·{' '}
                  {key.lastUsedAt ? `used ${formatRelative(key.lastUsedAt)}` : 'never used'}
                </div>
              </div>
              {key.revokedAt ? (
                <Tag>REVOKED</Tag>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setToRevoke(key)}
                  data-testid="api-key-revoke"
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent title="Create API key" description="Give the key a name so you know where it is used.">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Field id="api-key-name" label="Name">
              <Input
                id="api-key-name"
                autoFocus
                value={name}
                placeholder="GitHub Actions"
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                data-testid="api-key-name"
              />
            </Field>
            <DialogFooter>
              <Button onClick={() => setCreating(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="primary"
                disabled={create.isPending}
                data-testid="api-key-create-submit"
              >
                Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent
          title="Copy your API key"
          description="This is the only time the full key is shown. Store it as a secret."
        >
          <div className="panel flex items-center gap-2 bg-bg p-3">
            <code
              className="num min-w-0 flex-1 break-all text-[13px] text-signal"
              data-testid="api-key-value"
            >
              {created?.key}
            </code>
            <CopyButton value={created?.key ?? ''} testId="api-key-copy" />
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Use it as <code className="num text-text">EVALPILOT_API_KEY</code> for the SDK and the CLI.
          </p>
          <DialogFooter>
            <Button variant="primary" onClick={() => setCreated(null)}>
              I stored it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(open) => !open && setToRevoke(null)}
        title={`Revoke “${toRevoke?.name ?? ''}”?`}
        description="Anything using this key (SDK, CI) stops working at once. This cannot be undone."
        confirmLabel="Revoke key"
        pending={revoke.isPending}
        onConfirm={() =>
          toRevoke &&
          revoke.mutate(toRevoke.id, {
            onSuccess: () => {
              toast.success('Key revoked');
              setToRevoke(null);
            },
            onError: (error) => toast.error(error.message),
          })
        }
      />
    </Panel>
  );
}
