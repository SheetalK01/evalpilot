'use client';

import type { ProjectResponse } from '@evalpilot/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useDeleteProject, useUpdateProject } from '@/lib/queries';
import { ApiKeysPanel } from '../common/api-keys-panel';
import { ConfirmDialog } from '../common/confirm-dialog';
import { Panel } from '../instruments/panel';
import { Button } from '../ui/button';
import { Field, Input, Textarea } from '../ui/field';

export function SettingsTab({ project }: { project: ProjectResponse }) {
  const router = useRouter();
  const update = useUpdateProject(project.id);
  const remove = useDeleteProject();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [confirming, setConfirming] = useState(false);
  const dirty = name !== project.name || description !== (project.description ?? '');

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Panel title="PROJECT">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate(
                { name: name.trim(), description: description.trim() },
                { onSuccess: () => toast.success('Project saved'), onError: (e) => toast.error(e.message) },
              );
            }}
          >
            <Field id="project-settings-name" label="Name">
              <Input
                id="project-settings-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field id="project-settings-description" label="Description">
              <Textarea
                id="project-settings-description"
                rows={3}
                value={description}
                maxLength={500}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={!dirty || !name.trim() || update.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </Panel>
        <Panel title="DANGER ZONE" className="border-[color-mix(in_oklab,var(--fail)_35%,var(--line))]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-sm text-sm text-muted">
              Deletes the project with all its targets, suites, runs, red-team results, traces and API keys.
            </p>
            <Button variant="danger" onClick={() => setConfirming(true)} data-testid="project-delete">
              Delete project
            </Button>
          </div>
        </Panel>
      </div>
      <ApiKeysPanel projectId={project.id} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete “${project.name}”?`}
        description="Everything in this project is deleted permanently."
        confirmLabel="Delete project"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(project.id, {
            onSuccess: () => {
              toast.success('Project deleted');
              router.push('/app');
            },
            onError: (error) => toast.error(error.message),
          })
        }
      />
    </div>
  );
}
