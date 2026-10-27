import type { Metadata } from 'next';
import { TracesView } from '@/components/traces/traces-view';

export const metadata: Metadata = { title: 'Traces' };

export default async function TracesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TracesView projectId={id} />;
}
