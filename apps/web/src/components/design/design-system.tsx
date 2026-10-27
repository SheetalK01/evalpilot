'use client';

import { Play, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { FlightStrip, MiniStrip, type StripStatus } from '../instruments/flight-strip';
import { LatencyBar } from '../instruments/latency-bar';
import { Panel, Readout } from '../instruments/panel';
import { RiskGauge } from '../instruments/risk-gauge';
import { RollingNumber } from '../instruments/rolling-number';
import { EmptyState, ErrorState, Scan, ScanRows } from '../instruments/states';
import { Led, SeverityTag, StatusTag, Tag } from '../instruments/status';
import { ThreatRadar } from '../instruments/threat-radar';
import { Logo, LogoMark } from '../logo';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Field, Input, Select, Textarea } from '../ui/field';
import { Kbd, Switch } from '../ui/misc';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

const TOKENS = [
  'bg',
  'panel',
  'panel-2',
  'line',
  'line-strong',
  'text',
  'muted',
  'signal',
  'pass',
  'fail',
  'warn',
  'info',
] as const;
const DONE: StripStatus[] = [
  'PASSED',
  'PASSED',
  'PASSED',
  'FAILED',
  'PASSED',
  'PASSED',
  'ERROR',
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
const LIVE: StripStatus[] = DONE.map((status, i) => (i < 9 ? status : null));

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="space-y-5">{children}</div>
    </Panel>
  );
}

/** Every token and component in one place, in the current theme. Used by the visual tests. */
export function DesignSystem() {
  return (
    <div className="space-y-6" data-testid="design-page">
      <PageHeader
        eyebrow="FLIGHT DECK · DESIGN SYSTEM"
        title="Instruments & tokens"
        description="Colour carries meaning only: signal is the brand and primary action, green passes, red fails, amber warns, cyan is live."
      />

      <Block title="COLOUR TOKENS">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {TOKENS.map((token) => (
            <div key={token} className="panel overflow-hidden">
              <div className="h-14 border-b border-line" style={{ background: `var(--${token})` }} />
              <div className="num px-2.5 py-2 text-[11px] text-muted">--{token}</div>
            </div>
          ))}
        </div>
      </Block>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="TYPOGRAPHY">
          <div className="space-y-3">
            <p className="font-display text-[40px] leading-none tracking-[-0.03em]">Space Grotesk display</p>
            <p className="text-[15px]">IBM Plex Sans for interface text: short labels, generous spacing.</p>
            <p className="num text-[15px]">IBM Plex Mono · 0123456789 · 412 ms · $0.0042</p>
            <p className="label-mono">LATENCY P95 · PASS RATE · RISK SCORE</p>
          </div>
        </Block>
        <Block title="BRAND">
          <div className="flex flex-wrap items-center gap-8">
            <Logo />
            <LogoMark className="size-12" />
            <Kbd>⌘K</Kbd>
            <Kbd>G D</Kbd>
          </div>
        </Block>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="BUTTONS">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">
              <Play /> Run suite
            </Button>
            <Button>
              <Plus /> Secondary
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">
              <Trash2 /> Delete
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary">
              Small
            </Button>
            <Button size="lg">Large</Button>
            <Button variant="link">Link</Button>
          </div>
        </Block>
        <Block title="FORM CONTROLS">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ds-input" label="Input">
              <Input id="ds-input" placeholder="ShopSphere Support" />
            </Field>
            <Field id="ds-select" label="Select">
              <Select id="ds-select" defaultValue="contains">
                <option value="contains">Contains</option>
                <option value="regex">Matches regex</option>
              </Select>
            </Field>
            <Field id="ds-error" label="With an error" error="Enter a project name">
              <Input id="ds-error" aria-invalid />
            </Field>
            <Field id="ds-text" label="Mono textarea" hint="{{input}} is replaced with the test input.">
              <Textarea id="ds-text" mono rows={2} defaultValue={'{"message": "{{input}}"}'} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <Switch defaultChecked aria-label="Example switch" /> Failed only
          </label>
          <Tabs defaultValue="suites">
            <TabsList>
              <TabsTrigger value="suites">Suites</TabsTrigger>
              <TabsTrigger value="targets">Targets</TabsTrigger>
              <TabsTrigger value="traces">Traces</TabsTrigger>
            </TabsList>
          </Tabs>
        </Block>
      </div>

      <Block title="STATUS">
        <div className="flex flex-wrap items-center gap-2">
          {['PASSED', 'FAILED', 'ERROR', 'RUNNING', 'QUEUED', 'CANCELLED'].map((status) => (
            <StatusTag key={status} status={status} />
          ))}
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((severity) => (
            <SeverityTag key={severity} severity={severity} />
          ))}
          <Tag tone="signal">SHOPBOT</Tag>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Led tone="pass" label="API" />
          <Led tone="pass" label="DB" />
          <Led tone="fail" label="WORKER" />
          <Led tone="info" pulse label="LIVE" />
          <Led tone="muted" label="UNKNOWN" />
        </div>
      </Block>

      <Block title="READOUTS">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4 [&>*]:bg-panel [&>*]:p-5">
          <Readout
            label="PASS RATE"
            value={<RollingNumber value="91.7%" />}
            tone="pass"
            sub="threshold 90%"
          />
          <Readout label="RISK SCORE" value={<RollingNumber value="22" />} tone="warn" sub="MEDIUM" />
          <Readout label="LATENCY P95" value={<RollingNumber value="401 ms" />} sub="avg 238 ms" />
          <Readout label="EST. COST" value={<RollingNumber value="$0.086" />} sub="24 cases" />
        </div>
      </Block>

      <Block title="FLIGHT STRIP">
        <div className="space-y-2">
          <div className="label-mono">LIVE · 9 OF 16</div>
          <FlightStrip statuses={LIVE} live />
        </div>
        <div className="space-y-2">
          <div className="label-mono">FINISHED</div>
          <FlightStrip statuses={DONE} />
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <MiniStrip strip="PPPFPPEPPPPF" total={12} />
          <div className="w-64">
            <LatencyBar ms={212} max={600} />
          </div>
          <div className="w-64">
            <LatencyBar ms={580} max={600} />
          </div>
        </div>
      </Block>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="THREAT RADAR · LIVE">
          <ThreatRadar
            live
            className="mx-auto max-w-sm"
            points={[
              { category: 'PROMPT_INJECTION', score: 46, vulnerable: 2 },
              { category: 'JAILBREAK', score: 16, vulnerable: 1 },
              { category: 'SYSTEM_PROMPT_LEAK', score: 28, vulnerable: 1 },
              { category: 'PII_LEAK', score: 19, vulnerable: 1 },
              { category: 'HARMFUL_CONTENT', score: 17, vulnerable: 1 },
              { category: 'OFF_TOPIC', score: 0, vulnerable: 0 },
            ]}
          />
        </Block>
        <Block title="RISK GAUGE">
          <div className="grid gap-6 sm:grid-cols-3">
            <RiskGauge score={8} level="LOW" />
            <RiskGauge score={22} level="MEDIUM" />
            <RiskGauge score={74} level="CRITICAL" />
          </div>
        </Block>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="EMPTY STATE">
          <EmptyState
            title="No test suites"
            text="Write the questions your users ask and what a good answer must contain."
            action={<Button variant="primary">New suite</Button>}
            className="py-6"
          />
        </Block>
        <Block title="ERROR & LOADING">
          <ErrorState
            error={
              new ApiError(
                500,
                'The run queue is unavailable. Is Redis running?',
                '3f1c2a9e-6f0a-4c39-9d6e-2b7f5a1c0e44',
              )
            }
            onRetry={() => undefined}
          />
          <ScanRows rows={3} />
          <Scan className="h-10" />
        </Block>
      </div>
    </div>
  );
}
