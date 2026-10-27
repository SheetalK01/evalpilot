import type { Metadata } from 'next';
import { RedteamReport } from '@/components/redteam/redteam-report';

export const metadata: Metadata = { title: 'Red-team report' };

export default async function RedteamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RedteamReport redteamId={id} />;
}
