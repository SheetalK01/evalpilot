import { ArrowRight, Check, Minus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FlightStrip, type StripStatus } from '../instruments/flight-strip';
import { LatencyBar } from '../instruments/latency-bar';
import { ThreatRadar } from '../instruments/threat-radar';
import { GithubMark } from '../icons';
import { Logo } from '../logo';
import { Button } from '../ui/button';
import { ThemeToggle } from '../shell/theme-toggle';

export const LINKS = {
  github: 'https://github.com/SheetalK01/evalpilot',
  portfolio: 'https://sheetalk01.github.io',
  linkedin: 'https://www.linkedin.com/in/sheetal-khadanga',
};

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-saturate-150">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link href="/" aria-label="EvalPilot home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {[
            ['#product', 'Product'],
            ['#how', 'How it works'],
            ['#developers', 'Developers'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="label-mono text-muted transition-colors hover:text-text">
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/register">Start testing</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
  id,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  id?: string;
}) {
  return (
    <div className="max-w-2xl space-y-3" id={id}>
      <p className="label-mono text-signal">{eyebrow}</p>
      <h2 className="text-[32px] font-medium sm:text-[40px]">{title}</h2>
      {text ? <p className="text-[16px] text-muted">{text}</p> : null}
    </div>
  );
}

const STRIP: StripStatus[] = [
  'PASSED',
  'PASSED',
  'PASSED',
  'FAILED',
  'PASSED',
  'PASSED',
  'PASSED',
  'PASSED',
  'PASSED',
  'FAILED',
  'PASSED',
  'PASSED',
  'PASSED',
  'PASSED',
];

const FEATURES: { n: string; title: string; text: string; visual: ReactNode }[] = [
  {
    n: '01',
    title: 'Test suites',
    text: 'Write inputs and the behaviour you expect: contains, regex, JSON schema, latency, refusal, or an AI judge with your own criteria.',
    visual: (
      <div className="flex flex-wrap gap-1.5">
        {[
          'contains "30 days"',
          'regex /3–5 days/',
          'json_schema',
          'latency ≤ 3s',
          'refusal',
          'llm_judge ≥ 7',
        ].map((chip) => (
          <span
            key={chip}
            className="rounded-xs border border-line bg-bg px-2 py-1 font-mono text-[11px] text-muted"
          >
            {chip}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: '02',
    title: 'Live runs & diffs',
    text: 'Results land case by case while the run is in flight. Compare any two runs to see exactly which cases regressed.',
    visual: (
      <div className="space-y-3">
        <FlightStrip statuses={STRIP} size="sm" className="w-full" label="Example flight strip" />
        <div className="num space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span className="text-text">Refund window</span>
            <span className="text-fail">PASS → FAIL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text">Shipping time</span>
            <span className="text-pass">FAIL → PASS</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    n: '03',
    title: 'Red-team',
    text: '26 attacks in six categories: prompt injection, jailbreaks, prompt leaks, PII leaks, harmful and off-topic requests. Every finding comes with a fix.',
    visual: (
      <ThreatRadar
        className="mx-auto max-w-[300px]"
        points={[
          { category: 'PROMPT_INJECTION', score: 46, vulnerable: 2 },
          { category: 'JAILBREAK', score: 16, vulnerable: 1 },
          { category: 'SYSTEM_PROMPT_LEAK', score: 28, vulnerable: 1 },
          { category: 'PII_LEAK', score: 19, vulnerable: 1 },
          { category: 'HARMFUL_CONTENT', score: 17, vulnerable: 1 },
          { category: 'OFF_TOPIC', score: 0, vulnerable: 0 },
        ]}
      />
    ),
  },
  {
    n: '04',
    title: 'Production traces',
    text: 'A 7 KB SDK records every real call: latency, tokens, cost and errors, streaming into a flight-recorder feed.',
    visual: (
      <div className="num space-y-2 text-[12px]">
        {[
          ['shopbot.chat', 212],
          ['shopbot.chat', 486],
          ['shopbot.refund', 1290],
          ['shopbot.chat', 174],
        ].map(([name, ms], i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr] items-center gap-3">
            <span className="truncate text-muted">{name}</span>
            <LatencyBar ms={Number(ms)} max={1300} />
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '05',
    title: 'CI gate',
    text: 'One command in your pipeline. It exits 1 when the pass rate drops below your threshold, so a bad prompt cannot be merged.',
    visual: (
      <div className="rounded-xs border border-line bg-bg p-3 font-mono text-[12px] leading-6">
        <div className="text-muted">$ evalpilot run --suite core --threshold 0.9</div>
        <div className="text-text">Pass rate 75% (6/8) · threshold 90%</div>
        <div className="text-fail">✗ FAILED · exit 1</div>
      </div>
    ),
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6" aria-labelledby="product">
      <SectionHeading
        id="product"
        eyebrow="WHAT IT DOES"
        title="One instrument panel for AI quality."
        text="EvalPilot treats your chatbot like an aircraft: test it on the ground, watch every flight, and stop take-off when a reading is off."
      />
      <ol className="mt-14 border-t border-line">
        {FEATURES.map((feature) => (
          <li
            key={feature.n}
            className="grid gap-6 border-b border-line py-9 md:grid-cols-[84px_minmax(0,1fr)_minmax(0,360px)] md:items-center md:gap-10"
          >
            <span className="num text-[13px] text-muted">{feature.n}</span>
            <div className="max-w-md space-y-2">
              <h3 className="text-[22px] font-medium">{feature.title}</h3>
              <p className="text-muted">{feature.text}</p>
            </div>
            <div className="panel p-4">{feature.visual}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    ['CONNECT', 'Point EvalPilot at any HTTP chatbot, or use the built-in ShopBot demo.'],
    ['TEST', 'Run suites and the red-team library. Results stream in live.'],
    ['GATE', 'Block regressions in CI and watch real traffic with the SDK.'],
  ];
  return (
    <section className="border-y border-line bg-panel/50" aria-labelledby="how">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading id="how" eyebrow="HOW IT WORKS" title="Connect. Test. Gate." />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3">
          {steps.map(([title, text], index) => (
            <li key={title} className="relative bg-panel p-6">
              <div className="flex items-center gap-3">
                <span className="num flex size-7 items-center justify-center rounded-xs border border-line-strong text-[12px] text-signal">
                  {index + 1}
                </span>
                <span className="label-mono text-text">{title}</span>
                {index < steps.length - 1 ? (
                  <ArrowRight className="ml-auto hidden size-4 text-muted md:block" strokeWidth={1.5} />
                ) : null}
              </div>
              <p className="mt-4 text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const K = ({ children }: { children: ReactNode }) => <span className="text-signal">{children}</span>;
const S = ({ children }: { children: ReactNode }) => <span className="text-text">{children}</span>;
const C = ({ children }: { children: ReactNode }) => <span className="text-muted">{children}</span>;

function CodeBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="panel crosshair min-w-0 overflow-hidden">
      <figcaption className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="label-mono ml-2">{title}</span>
      </figcaption>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-6 text-muted">{children}</pre>
    </figure>
  );
}

export function Developers() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="developers">
      <SectionHeading
        id="developers"
        eyebrow="FOR DEVELOPERS"
        title="Two lines in your app. One line in CI."
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <CodeBlock title="SDK · shopbot.ts">
          <code>
            <K>import</K> {'{ EvalPilot }'} <K>from</K> <S>{"'@evalpilot/sdk'"}</S>;{'\n\n'}
            <K>const</K> ep = <K>new</K> EvalPilot({'{'} apiKey: process.env.EVALPILOT_API_KEY {'}'});{'\n\n'}
            <C>{'// Latency, tokens, cost and errors, batched in the background.'}</C>
            {'\n'}
            <K>const</K> answer = <K>await</K> ep.trace(<S>{"'shopbot.chat'"}</S>, {'{ input, model }'}, ()
            =&gt;{'\n'}
            {'  '}callLLM(input),{'\n'});
          </code>
        </CodeBlock>
        <CodeBlock title="CI · github actions">
          <code>
            <C>$</C> <S>npx evalpilot run --suite core-support --threshold 0.9</S>
            {'\n'}
            <C>EvalPilot ▸ run 0143 started for commit 5e6f7a8</C>
            {'\n\n'}
            <C>CASE STATUS LATENCY</C>
            {'\n'}
            <S>Refund window is 30 days </S>
            <span className="text-fail">FAIL</span>
            <S> 232 ms</S>
            {'\n'}
            <S>Standard shipping time </S>
            <span className="text-fail">FAIL</span>
            <S> 236 ms</S>
            {'\n'}
            <S>Order status lookup </S>
            <span className="text-pass">PASS</span>
            <S> 167 ms</S>
            {'\n\n'}
            <S>Pass rate 75% (6/8) · threshold 90% · </S>
            <span className="text-fail">✗ FAILED</span>
            {'\n'}
            <C>Error: Process completed with exit code 1.</C>
          </code>
        </CodeBlock>
      </div>
    </section>
  );
}

const COMPARISON: [string, string][] = [
  ['Prompt changes ship on a hunch', 'Every change runs the whole suite'],
  ['Customers find the regressions', 'Regressions block the merge'],
  ['Jailbreaks show up on social media', '26 attacks run before launch'],
  ['Nobody knows what an answer costs', 'Cost and p95 latency for every call'],
];

export function BeforeAfter() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="compare">
      <SectionHeading id="compare" eyebrow="BEFORE / AFTER" title="Stop guessing how your AI behaves." />
      <div className="panel mt-12 overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line">
          <div className="label-mono px-5 py-3">WITHOUT EVALPILOT</div>
          <div className="label-mono border-l border-line px-5 py-3 text-signal">WITH EVALPILOT</div>
        </div>
        {COMPARISON.map(([before, after]) => (
          <div key={before} className="grid grid-cols-2 border-b border-line last:border-b-0">
            <div className="flex items-start gap-3 px-5 py-4 text-muted">
              <Minus className="mt-1 size-4 shrink-0 text-fail" strokeWidth={1.5} />
              {before}
            </div>
            <div className="flex items-start gap-3 border-l border-line px-5 py-4">
              <Check className="mt-1 size-4 shrink-0 text-pass" strokeWidth={1.5} />
              {after}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="panel crosshair flex flex-col items-start gap-6 p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h2 className="text-[28px] font-medium sm:text-[34px]">Ready for take-off?</h2>
          <p className="text-muted">Run the ShopBot demo in under a minute. Mock AI mode is free.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary" size="lg">
            <Link href="/register">Start testing</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/login?demo=1">Open the demo</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-muted">Test your AI before your users do. Built by Sheetal Khadanga.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            [LINKS.github, 'GitHub'],
            [LINKS.portfolio, 'Portfolio'],
            [LINKS.linkedin, 'LinkedIn'],
          ].map(([href, label]) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'label-mono inline-flex items-center gap-1.5 text-muted transition-colors hover:text-text',
              )}
            >
              {label === 'GitHub' ? <GithubMark className="size-3.5" /> : null}
              {label}
            </a>
          ))}
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="num mx-auto max-w-6xl px-4 py-4 text-[11px] text-muted sm:px-6">
          © 2026 SHEETAL KHADANGA · ALL RIGHTS RESERVED
        </p>
      </div>
    </footer>
  );
}
