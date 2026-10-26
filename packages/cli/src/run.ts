import { ApiError, type EvalPilotApi } from './api';
import type { RunCommand } from './args';
import { type Colors, jsonSummary, resultsTable, verdictLine } from './format';
import { EXIT, FINAL_STATUSES, type CliRun } from './types';

export interface RunDeps {
  api: EvalPilotApi;
  out: (line: string) => void;
  err: (line: string) => void;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  colors: Colors;
  pollIntervalMs?: number;
}

/** Starts the run, waits for it and decides the exit code. */
export async function runSuite(command: RunCommand, deps: RunDeps): Promise<number> {
  const { api, out, err, colors } = deps;
  const log = command.json ? () => undefined : out;
  try {
    const { runId } = await api.startRun(command.suiteId, command.commitSha);
    log(
      `${colors.bold('EvalPilot')} ▸ run ${runId} started${command.commitSha ? ` for commit ${command.commitSha.slice(0, 7)}` : ''}`,
    );
    if (!command.wait) {
      if (command.json) out(JSON.stringify({ runId, status: 'QUEUED' }));
      return EXIT.passed;
    }

    const deadline = deps.now() + command.timeoutSeconds * 1000;
    let run: CliRun = await api.getRun(runId);
    let lastProgress = -1;
    while (!FINAL_STATUSES.includes(run.status)) {
      if (deps.now() >= deadline) {
        err(`Timed out after ${command.timeoutSeconds}s waiting for run ${runId} (status ${run.status})`);
        return EXIT.error;
      }
      if (run.results.length !== lastProgress) {
        lastProgress = run.results.length;
        log(colors.dim(`  ${run.status.toLowerCase()} · ${run.results.length}/${run.total} cases`));
      }
      await deps.sleep(deps.pollIntervalMs ?? 2000);
      run = await api.getRun(runId);
    }

    if (run.status === 'ERROR' || run.status === 'CANCELLED') {
      err(`Run ${runId} ended with ${run.status}${run.error ? `: ${run.error}` : ''}`);
      return EXIT.error;
    }

    const threshold = command.threshold ?? run.passThreshold;
    const passed = run.passRate !== null && run.passRate >= threshold;
    if (command.json) {
      out(JSON.stringify(jsonSummary(run, threshold, passed), null, 2));
    } else {
      out('');
      out(resultsTable(run.results, colors));
      out('');
      out(verdictLine(run, threshold, passed, colors));
    }
    return passed ? EXIT.passed : EXIT.belowThreshold;
  } catch (error) {
    err(error instanceof ApiError || error instanceof Error ? error.message : String(error));
    return EXIT.error;
  }
}
