import Link from 'next/link';
import { InstrumentDemo } from '@/components/landing/instrument-demo';
import {
  BeforeAfter,
  Developers,
  Features,
  FinalCta,
  Footer,
  HowItWorks,
  LandingNav,
} from '@/components/landing/sections';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-14 lg:pt-24 lg:pb-16">
          <div className="space-y-7">
            <p className="label-mono text-signal">AI QUALITY · RED-TEAM · TRACES · CI GATE</p>
            <h1 className="text-[44px] leading-[1.02] font-medium tracking-[-0.035em] sm:text-[60px] lg:text-[68px]">
              Test your AI before your users do.
            </h1>
            <p className="max-w-xl text-[17px] text-muted">
              EvalPilot runs your chatbot through test suites and attack prompts, streams every result live,
              and fails the build when quality drops.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button asChild variant="primary" size="lg" data-testid="hero-start">
                <Link href="/register">Start testing</Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/login?demo=1">Open the live demo</Link>
              </Button>
            </div>
            <p className="num text-[12px] text-muted">
              Mock AI mode · free to run · works with any HTTP chatbot
            </p>
          </div>
          <InstrumentDemo />
        </section>
        <Features />
        <HowItWorks />
        <Developers />
        <BeforeAfter />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
