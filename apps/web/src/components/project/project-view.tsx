'use client';

import { Plus, Radar } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useProject } from '@/lib/queries';
import { ErrorState, Scan } from '../instruments/states';
import { useCurrentProject } from '../shell/deck-context';
import { PageHeader } from '../shell/page-header';
import { TracesFeed } from '../traces/traces-view';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { RedteamTab, StartRedteamDialog } from './redteam-tab';
import { SettingsTab } from './settings-tab';
import { NewSuiteDialog, SuitesTab } from './suites-tab';
import { TargetDialog, TargetsTab } from './targets-tab';

const TABS = ['suites', 'targets', 'redteam', 'traces', 'settings'] as const;
type Tab = (typeof TABS)[number];
const LABELS: Record<Tab, string> = {
  suites: 'Suites',
  targets: 'Targets',
  redteam: 'Red-team',
  traces: 'Traces',
  settings: 'Settings',
};

export function ProjectView({ projectId }: { projectId: string }) {
  useCurrentProject(projectId);
  const project = useProject(projectId);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'suites';
  const [dialog, setDialog] = useState<'suite' | 'target' | 'redteam' | null>(null);
  const setTab = (next: string) =>
    router.replace(next === 'suites' ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  if (project.isLoading) {
    return (
      <div className="space-y-6">
        <Scan className="h-10 w-72" />
        <Scan className="h-10" />
        <Scan className="h-64" />
      </div>
    );
  }
  if (project.error || !project.data)
    return <ErrorState error={project.error} onRetry={() => void project.refetch()} />;
  const data = project.data;

  // One clear primary action per tab.
  const action = {
    suites: (
      <Button variant="primary" onClick={() => setDialog('suite')} data-testid="new-suite-button">
        <Plus /> New suite
      </Button>
    ),
    targets: (
      <Button variant="primary" onClick={() => setDialog('target')} data-testid="target-add">
        <Plus /> Add target
      </Button>
    ),
    redteam: (
      <Button
        variant="primary"
        onClick={() => setDialog('redteam')}
        data-testid="redteam-start"
        disabled={data.targetCount === 0}
      >
        <Radar /> Start red-team
      </Button>
    ),
    traces: null,
    settings: null,
  }[tab];

  return (
    <div className="space-y-6" data-testid="project-page">
      <PageHeader
        eyebrow={
          <>
            PROJECT · {data.suiteCount} {data.suiteCount === 1 ? 'SUITE' : 'SUITES'} · {data.targetCount}{' '}
            {data.targetCount === 1 ? 'TARGET' : 'TARGETS'}
          </>
        }
        title={data.name}
        description={data.description ?? undefined}
        actions={action}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Project sections">
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value} data-testid={`tab-${value}`}>
              {LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="pt-6">
          <TabsContent value="suites">
            <SuitesTab projectId={projectId} onNew={() => setDialog('suite')} />
          </TabsContent>
          <TabsContent value="targets">
            <TargetsTab projectId={projectId} onNew={() => setDialog('target')} />
          </TabsContent>
          <TabsContent value="redteam">
            <RedteamTab projectId={projectId} onNew={() => setDialog('redteam')} />
          </TabsContent>
          <TabsContent value="traces">
            <TracesFeed projectId={projectId} compact />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab project={data} />
          </TabsContent>
        </div>
      </Tabs>
      <NewSuiteDialog
        projectId={projectId}
        open={dialog === 'suite'}
        onOpenChange={(open) => setDialog(open ? 'suite' : null)}
      />
      {dialog === 'target' ? (
        <TargetDialog
          projectId={projectId}
          target={null}
          open
          onOpenChange={(open) => setDialog(open ? 'target' : null)}
        />
      ) : null}
      <StartRedteamDialog
        projectId={projectId}
        open={dialog === 'redteam'}
        onOpenChange={(open) => setDialog(open ? 'redteam' : null)}
      />
    </div>
  );
}
