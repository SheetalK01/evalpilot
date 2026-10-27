'use client';

import { InstrumentArt } from '@/components/instruments/states';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <InstrumentArt className="size-32" />
      <p className="label-mono mt-8 text-fail">SOMETHING BROKE</p>
      <h1 className="mt-3 text-[30px] font-medium">The instruments lost their signal.</h1>
      <p className="mt-2 max-w-md text-muted">{error.message || 'An unexpected error happened.'}</p>
      {error.digest ? <p className="num mt-2 text-[12px] text-muted">ref {error.digest}</p> : null}
      <Button variant="primary" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
