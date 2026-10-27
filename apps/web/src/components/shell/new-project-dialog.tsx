'use client';

import { createProjectSchema } from '@evalpilot/shared';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useCreateProject } from '@/lib/queries';
import { zodResolver } from '@/lib/zod-resolver';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Field, Input, Textarea } from '../ui/field';
import { useDeck } from './deck-context';

export function NewProjectDialog() {
  const { newProjectOpen, setNewProjectOpen } = useDeck();
  const router = useRouter();
  const create = useCreateProject();
  const form = useForm({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: '', description: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (project) => {
        toast.success(`Project “${project.name}” created`);
        setNewProjectOpen(false);
        form.reset();
        router.push(`/app/projects/${project.id}`);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
      <DialogContent
        title="New project"
        description="A project holds the targets, suites, red-team runs and traces of one AI app."
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
          <Field id="project-name" label="Name" error={errors.name?.message}>
            <Input
              id="project-name"
              autoFocus
              placeholder="ShopSphere Support"
              data-testid="project-name"
              aria-invalid={Boolean(errors.name)}
              {...form.register('name')}
            />
          </Field>
          <Field id="project-description" label="Description (optional)" error={errors.description?.message}>
            <Textarea
              id="project-description"
              rows={3}
              placeholder="What does this assistant do?"
              {...form.register('description')}
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => setNewProjectOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={create.isPending}
              data-testid="project-create-submit"
            >
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
