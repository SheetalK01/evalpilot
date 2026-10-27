import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DesignSystem } from '@/components/design/design-system';

export const metadata: Metadata = { title: 'Design system' };

/** Development (and visual tests) only. */
export default function DesignPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DESIGN_PAGE !== 'true') notFound();
  return <DesignSystem />;
}
