'use client';

import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiKeyResponse,
  AttackCategory,
  AttackResponse,
  CreatedApiKeyResponse,
  CreateTargetInput,
  CsvImportResultResponse,
  DashboardResponse,
  HealthResponse,
  Paginated,
  PingResultResponse,
  ProjectResponse,
  PublicUserResponse,
  RedteamCreatedResponse,
  RedteamReportResponse,
  RedteamRunResponse,
  RunCreatedResponse,
  RunDiffResponse,
  RunListItemResponse,
  RunResponse,
  SuiteResponse,
  TargetResponse,
  TestCaseResponse,
  TestResultResponse,
  TraceListItemResponse,
  TraceResponse,
  UsageRange,
  UsageResponse,
} from '@evalpilot/shared';
import { api } from './api';

export const keys = {
  me: ['me'] as const,
  providers: ['providers'] as const,
  health: ['health'] as const,
  dashboard: ['dashboard'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  targets: (projectId: string) => ['targets', projectId] as const,
  suites: (projectId: string) => ['suites', projectId] as const,
  suite: (id: string) => ['suite', id] as const,
  cases: (suiteId: string) => ['cases', suiteId] as const,
  runs: (suiteId: string) => ['runs', suiteId] as const,
  run: (id: string) => ['run', id] as const,
  results: (runId: string) => ['results', runId] as const,
  compare: (head: string, base: string) => ['compare', head, base] as const,
  attacks: ['attacks'] as const,
  redteamRuns: (projectId: string) => ['redteam-runs', projectId] as const,
  redteam: (id: string) => ['redteam', id] as const,
  traces: (projectId: string, status: string, search: string) =>
    ['traces', projectId, status, search] as const,
  trace: (id: string) => ['trace', id] as const,
  usage: (projectId: string, range: UsageRange) => ['usage', projectId, range] as const,
  apiKeys: (projectId: string) => ['api-keys', projectId] as const,
};

// ─── Session ────────────────────────────────────────────────────────────────

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: () => api<PublicUserResponse>('/auth/me'), retry: false });
export const useProviders = () =>
  useQuery({ queryKey: keys.providers, queryFn: () => api<{ github: boolean }>('/auth/providers') });

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<PublicUserResponse>('/auth/login', { method: 'POST', body }),
    onSuccess: (user) => client.setQueryData(keys.me, user),
  });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string }) =>
      api<PublicUserResponse>('/auth/register', { method: 'POST', body }),
    onSuccess: (user) => client.setQueryData(keys.me, user),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<undefined>('/auth/logout', { method: 'POST' }),
    onSuccess: () => client.clear(),
  });
}

/** Health LEDs for the status bar; a failed call means the API itself is down. */
export const useHealth = () =>
  useQuery({
    queryKey: keys.health,
    queryFn: () => api<HealthResponse>('/health').catch(() => null),
    refetchInterval: 10_000,
  });

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api<DashboardResponse>('/dashboard') });

// ─── Projects ───────────────────────────────────────────────────────────────

export const useProjects = () =>
  useQuery({
    queryKey: keys.projects,
    queryFn: () => api<Paginated<ProjectResponse>>('/projects?limit=100').then((page) => page.items),
  });

export const useProject = (id: string) =>
  useQuery({
    queryKey: keys.project(id),
    enabled: Boolean(id),
    queryFn: () => api<ProjectResponse>(`/projects/${id}`),
  });

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api<ProjectResponse>('/projects', { method: 'POST', body }),
    onSuccess: () => invalidate(client, [keys.projects, keys.dashboard]),
  });
}

export function useUpdateProject(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; description?: string }) =>
      api<ProjectResponse>(`/projects/${id}`, { method: 'PATCH', body }),
    onSuccess: () => invalidate(client, [keys.projects, keys.project(id)]),
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(client, [keys.projects, keys.dashboard]),
  });
}

// ─── Targets ────────────────────────────────────────────────────────────────

export const useTargets = (projectId: string) =>
  useQuery({
    queryKey: keys.targets(projectId),
    enabled: Boolean(projectId),
    queryFn: () => api<TargetResponse[]>(`/projects/${projectId}/targets`),
  });

export function useSaveTarget(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CreateTargetInput | Record<string, unknown> }) =>
      id
        ? api<TargetResponse>(`/targets/${id}`, { method: 'PATCH', body })
        : api<TargetResponse>(`/projects/${projectId}/targets`, { method: 'POST', body }),
    onSuccess: () => invalidate(client, [keys.targets(projectId), keys.project(projectId)]),
  });
}

export function useDeleteTarget(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/targets/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      invalidate(client, [keys.targets(projectId), keys.suites(projectId), keys.project(projectId)]),
  });
}

export const usePingTarget = () =>
  useMutation({
    mutationFn: (id: string) => api<PingResultResponse>(`/targets/${id}/ping`, { method: 'POST' }),
  });

// ─── Suites & cases ─────────────────────────────────────────────────────────

export const useSuites = (projectId: string) =>
  useQuery({
    queryKey: keys.suites(projectId),
    enabled: Boolean(projectId),
    queryFn: () =>
      api<Paginated<SuiteResponse>>(`/projects/${projectId}/suites?limit=100`).then((p) => p.items),
  });

export const useSuite = (id: string) =>
  useQuery({
    queryKey: keys.suite(id),
    enabled: Boolean(id),
    queryFn: () => api<SuiteResponse>(`/suites/${id}`),
  });

export function useCreateSuite(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; targetId?: string; passThreshold?: number }) =>
      api<SuiteResponse>(`/projects/${projectId}/suites`, { method: 'POST', body }),
    onSuccess: () => invalidate(client, [keys.suites(projectId), keys.project(projectId), keys.dashboard]),
  });
}

export function useUpdateSuite(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      description?: string;
      targetId?: string | null;
      passThreshold?: number;
    }) => api<SuiteResponse>(`/suites/${id}`, { method: 'PATCH', body }),
    onSuccess: (suite) => {
      client.setQueryData(keys.suite(id), suite);
      void client.invalidateQueries({ queryKey: keys.suites(suite.projectId) });
    },
  });
}

export const useCases = (suiteId: string) =>
  useQuery({
    queryKey: keys.cases(suiteId),
    enabled: Boolean(suiteId),
    queryFn: () => api<TestCaseResponse[]>(`/suites/${suiteId}/cases`),
  });

export function useSaveCase(suiteId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: object }) =>
      id
        ? api<TestCaseResponse>(`/cases/${id}`, { method: 'PATCH', body })
        : api<TestCaseResponse>(`/suites/${suiteId}/cases`, { method: 'POST', body }),
    onSuccess: () => invalidate(client, [keys.cases(suiteId), keys.suite(suiteId)]),
  });
}

export function useDeleteCase(suiteId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/cases/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(client, [keys.cases(suiteId), keys.suite(suiteId)]),
  });
}

export function useReorderCases(suiteId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<TestCaseResponse[]>(`/suites/${suiteId}/cases/reorder`, { method: 'POST', body: { ids } }),
    onMutate: async (ids) => {
      // Optimistic: reorder immediately, roll back on error.
      await client.cancelQueries({ queryKey: keys.cases(suiteId) });
      const previous = client.getQueryData<TestCaseResponse[]>(keys.cases(suiteId));
      if (previous) {
        const byId = new Map(previous.map((c) => [c.id, c]));
        const reordered = ids.flatMap((id, position) => {
          const testCase = byId.get(id);
          return testCase ? [{ ...testCase, position }] : [];
        });
        client.setQueryData(keys.cases(suiteId), reordered);
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(keys.cases(suiteId), context.previous);
    },
    onSuccess: (cases) => client.setQueryData(keys.cases(suiteId), cases),
  });
}

export function useImportCases(suiteId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      api<CsvImportResultResponse>(`/suites/${suiteId}/import`, {
        method: 'POST',
        body: csv,
        contentType: 'text/csv',
      }),
    onSuccess: () => invalidate(client, [keys.cases(suiteId), keys.suite(suiteId)]),
  });
}

// ─── Runs ───────────────────────────────────────────────────────────────────

export const useSuiteRuns = (suiteId: string) =>
  useQuery({
    queryKey: keys.runs(suiteId),
    enabled: Boolean(suiteId),
    queryFn: () =>
      api<Paginated<RunListItemResponse>>(`/suites/${suiteId}/runs?limit=20`).then((p) => p.items),
  });

export function useStartRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (suiteId: string) =>
      api<RunCreatedResponse>(`/suites/${suiteId}/runs`, { method: 'POST', body: {} }),
    onSuccess: (_run, suiteId) => invalidate(client, [keys.runs(suiteId), keys.dashboard]),
  });
}

export const useRun = (id: string) =>
  useQuery({ queryKey: keys.run(id), enabled: Boolean(id), queryFn: () => api<RunResponse>(`/runs/${id}`) });
export const useRunResults = (id: string) =>
  useQuery({
    queryKey: keys.results(id),
    enabled: Boolean(id),
    queryFn: () => api<TestResultResponse[]>(`/runs/${id}/results`),
  });

export function useCancelRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<RunResponse>(`/runs/${id}/cancel`, { method: 'POST' }),
    onSuccess: (run) => client.setQueryData(keys.run(run.id), run),
  });
}

export const useCompare = (head: string, base: string | null) =>
  useQuery({
    queryKey: keys.compare(head, base ?? ''),
    queryFn: () => api<RunDiffResponse>(`/runs/${head}/compare/${base ?? ''}`),
    enabled: Boolean(base),
  });

// ─── Red-team ───────────────────────────────────────────────────────────────

export const useAttacks = () =>
  useQuery({
    queryKey: keys.attacks,
    queryFn: () => api<AttackResponse[]>('/attacks'),
    staleTime: 5 * 60_000,
  });

export const useRedteamRuns = (projectId: string) =>
  useQuery({
    queryKey: keys.redteamRuns(projectId),
    enabled: Boolean(projectId),
    queryFn: () =>
      api<Paginated<RedteamRunResponse>>(`/projects/${projectId}/redteam-runs?limit=50`).then((p) => p.items),
  });

export const useRedteamReport = (id: string) =>
  useQuery({
    queryKey: keys.redteam(id),
    enabled: Boolean(id),
    queryFn: () => api<RedteamReportResponse>(`/redteam-runs/${id}`),
  });

export function useStartRedteam(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, categories }: { targetId: string; categories?: AttackCategory[] }) =>
      api<RedteamCreatedResponse>(`/targets/${targetId}/redteam`, {
        method: 'POST',
        body: categories ? { categories } : {},
      }),
    onSuccess: () => invalidate(client, [keys.redteamRuns(projectId), keys.dashboard]),
  });
}

// ─── Traces ─────────────────────────────────────────────────────────────────

export const useTraces = (projectId: string, status: '' | 'OK' | 'ERROR', search: string) =>
  useQuery({
    queryKey: keys.traces(projectId, status, search),
    enabled: Boolean(projectId),
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      return api<Paginated<TraceListItemResponse>>(`/projects/${projectId}/traces?${params.toString()}`).then(
        (p) => p.items,
      );
    },
  });

export const useTrace = (id: string | null) =>
  useQuery({
    queryKey: keys.trace(id ?? ''),
    queryFn: () => api<TraceResponse>(`/traces/${id ?? ''}`),
    enabled: Boolean(id),
  });

export const useUsage = (projectId: string, range: UsageRange) =>
  useQuery({
    queryKey: keys.usage(projectId, range),
    enabled: Boolean(projectId),
    queryFn: () => api<UsageResponse>(`/projects/${projectId}/usage?range=${range}`),
    refetchInterval: 30_000,
  });

// ─── API keys ───────────────────────────────────────────────────────────────

export const useApiKeys = (projectId: string) =>
  useQuery({
    queryKey: keys.apiKeys(projectId),
    queryFn: () => api<ApiKeyResponse[]>(`/projects/${projectId}/api-keys`),
    enabled: Boolean(projectId),
  });

export function useCreateApiKey(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<CreatedApiKeyResponse>(`/projects/${projectId}/api-keys`, { method: 'POST', body: { name } }),
    onSuccess: () => invalidate(client, [keys.apiKeys(projectId)]),
  });
}

export function useRevokeApiKey(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(client, [keys.apiKeys(projectId)]),
  });
}

function invalidate(client: QueryClient, queryKeys: readonly (readonly unknown[])[]): void {
  for (const queryKey of queryKeys) void client.invalidateQueries({ queryKey });
}
