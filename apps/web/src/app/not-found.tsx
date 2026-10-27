import Link from 'next/link';
import { InstrumentArt } from '@/components/instruments/states';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <InstrumentArt className="size-32" />
      <p className="label-mono mt-8 text-signal">ERROR 404 · OFF COURSE</p>
      <h1 className="mt-3 text-[34px] font-medium">This page is not on the chart.</h1>
      <p className="mt-2 max-w-md text-muted">The link may be old, or the item belongs to another account.</p>
      <Button asChild variant="primary" className="mt-6">
        <Link href="/app">Back to the flight deck</Link>
      </Button>
    </main>
  );
}
