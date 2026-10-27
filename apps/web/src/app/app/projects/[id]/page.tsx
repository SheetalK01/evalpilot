import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProjectView } from '@/components/project/project-view';

export const metadata: Metadata = { title: 'Project' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ProjectView projectId={id} />
    </Suspense>
  );
}
