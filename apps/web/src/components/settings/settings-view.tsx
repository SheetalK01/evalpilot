'use client';

import { Moon, Monitor, Sun } from 'lucide-react';
import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { ThemeChoice } from '@/lib/theme';
import { useMe, useProjects, useSuites } from '@/lib/queries';
import { ApiKeysPanel } from '../common/api-keys-panel';
import { Panel } from '../instruments/panel';
import { EmptyState, Scan } from '../instruments/states';
import { useTheme } from '../providers';
import { PageHeader } from '../shell/page-header';
import { Label, Select } from '../ui/field';
import { CopyButton } from '../ui/misc';

function Snippet({ step, title, text, code }: { step: number; title: string; text: string; code: string }) {
  return (
    <li className="grid gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[40px_minmax(0,0.8fr)_minmax(0,1.4fr)] md:gap-5">
      <span className="num flex size-7 items-center justify-center rounded-xs border border-line-strong text-[12px] text-signal">
        {step}
      </span>
      <div className="space-y-1">
        <h3 className="text-[15px] font-medium">{title}</h3>
        <p className="text-sm text-muted">{text}</p>
      </div>
      <div className="relative min-w-0">
        <pre
          className="num overflow-x-auto rounded-sm border border-line bg-bg p-3 pr-20 text-[12px] leading-relaxed text-text"
          data-testid="ci-snippet"
        >
          {code}
        </pre>
        <CopyButton value={code} className="absolute top-2 right-2 bg-panel" />
      </div>
    </li>
  );
}

const THEMES: { value: ThemeChoice; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: 'dark', label: 'Night flight', icon: <Moon />, hint: 'Dark' },
  { value: 'light', label: 'Paper chart', icon: <Sun />, hint: 'Light' },
  { value: 'system', label: 'System', icon: <Monitor />, hint: 'Follows your OS' },
];

export function SettingsView() {
  const me = useMe();
  const projects = useProjects();
  const theme = useTheme();
  const [chosen, setChosen] = useState('');
  const projectId = chosen !== '' ? chosen : (projects.data?.[0]?.id ?? '');
  const suites = useSuites(projectId);
  const suiteId = suites.data?.[0]?.id ?? '<suite-id>';

  return (
    <div className="space-y-6" data-testid="settings-page">
      <PageHeader
        eyebrow="ACCOUNT"
        title="Settings"
        description="Your profile, appearance, API keys and how to add the EvalPilot gate to CI."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="PROFILE">
          {me.data ? (
            <div className="flex items-center gap-4">
              <span className="num flex size-14 items-center justify-center rounded-sm border border-line-strong bg-panel-2 text-lg text-text">
                {me.data.name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <dl className="grid min-w-0 gap-1">
                <dt className="sr-only">Name</dt>
                <dd className="text-[17px] text-text">{me.data.name}</dd>
                <dt className="sr-only">Email</dt>
                <dd className="num truncate text-[13px] text-muted">{me.data.email}</dd>
                <dt className="sr-only">Member since</dt>
                <dd className="num text-[12px] text-muted">member since {formatDate(me.data.createdAt)}</dd>
              </dl>
            </div>
          ) : (
            <Scan className="h-14" />
          )}
        </Panel>
        <Panel title="APPEARANCE">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
            {THEMES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={theme.choice === option.value}
                onClick={() => theme.setChoice(option.value)}
                data-testid={`theme-${option.value}`}
                className={cn(
                  'panel flex flex-col items-start gap-2 p-3 text-left transition-colors [&_svg]:size-4 [&_svg]:stroke-[1.5] [&_svg]:text-muted',
                  theme.choice === option.value ? 'border-signal' : 'hover:border-line-strong',
                )}
              >
                {option.icon}
                <span className="text-sm text-text">{option.label}</span>
                <span className="label-mono">{option.hint}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {projects.data?.length === 0 ? (
        <Panel title="API KEYS">
          <EmptyState
            title="No projects yet"
            text="API keys belong to a project. Create a project first."
            className="py-8"
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="settings-project">Project</Label>
            <Select
              id="settings-project"
              className="max-w-xs"
              value={projectId}
              onChange={(e) => setChosen(e.target.value)}
              data-testid="settings-project"
            >
              {projects.data?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
          {projectId ? <ApiKeysPanel projectId={projectId} /> : <Scan className="h-32" />}
        </div>
      )}

      <Panel title="CI SETUP GUIDE">
        <ol className="divide-y divide-line">
          <Snippet
            step={1}
            title="Store the key as a secret"
            text="Create an API key above, then add it to your CI secrets with your EvalPilot URL."
            code={`EVALPILOT_API_KEY=ep_live_…\nEVALPILOT_URL=${API_URL}`}
          />
          <Snippet
            step={2}
            title="Run the gate"
            text="The command exits 1 when the pass rate is below the threshold, which fails the build."
            code={`npx evalpilot run --suite ${suiteId} --threshold 0.9`}
          />
          <Snippet
            step={3}
            title="Add it to GitHub Actions"
            text="Runs on every pull request. The full example is in .github/workflows/evalpilot-gate.example.yml."
            code={`- name: EvalPilot gate\n  env:\n    EVALPILOT_API_KEY: \${{ secrets.EVALPILOT_API_KEY }}\n    EVALPILOT_URL: ${API_URL}\n  run: npx evalpilot run --suite ${suiteId} --threshold 0.9 --commit "$GITHUB_SHA"`}
          />
          <Snippet
            step={4}
            title="Trace production traffic"
            text="Wrap your model call. Traces are batched, retried and never throw into your app."
            code={`import { EvalPilot } from '@evalpilot/sdk';\n\nconst ep = new EvalPilot({ apiKey: process.env.EVALPILOT_API_KEY, baseUrl: '${API_URL}' });\nconst answer = await ep.trace('chat', { input, model }, () => callLLM(input));`}
          />
        </ol>
      </Panel>
    </div>
  );
}
