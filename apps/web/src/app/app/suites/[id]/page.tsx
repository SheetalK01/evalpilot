import type { Metadata } from 'next';
import { SuiteEditor } from '@/components/suite/suite-editor';

export const metadata: Metadata = { title: 'Suite' };

export default async function SuitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SuiteEditor suiteId={id} />;
}
