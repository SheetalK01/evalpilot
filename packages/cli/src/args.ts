import { parseArgs } from 'node:util';

export const USAGE = `Usage: evalpilot run --suite <id> [options]

Runs an EvalPilot test suite and fails when its pass rate is below the threshold.

Options:
  --suite <id>         Suite to run (required)
  --threshold <0-1>    Minimum pass rate; defaults to the suite's own threshold
  --wait / --no-wait   Wait for the result (default: wait)
  --json               Print a JSON summary instead of the table
  --commit <sha>       Commit to record (default: $GITHUB_SHA)
  --timeout <seconds>  Give up waiting after this long (default: 600)
  -h, --help           Show this help
  -v, --version        Show the version

Environment:
  EVALPILOT_API_KEY    Project API key (ep_live_…), required
  EVALPILOT_URL        EvalPilot API URL (default: http://localhost:4000)

Exit codes: 0 passed · 1 below threshold · 2 error (config, API, run error or timeout)`;

export interface RunCommand {
  command: 'run';
  suiteId: string;
  threshold: number | null;
  wait: boolean;
  json: boolean;
  commitSha: string | null;
  timeoutSeconds: number;
}

export type ParsedArgs =
  RunCommand | { command: 'help' } | { command: 'version' } | { command: 'invalid'; message: string };

/** Parses argv (without node and script). Never throws: problems come back as `invalid`. */
export function parseCliArgs(argv: string[], env: Record<string, string | undefined> = {}): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      allowNegative: true,
      options: {
        suite: { type: 'string' },
        threshold: { type: 'string' },
        wait: { type: 'boolean', default: true },
        json: { type: 'boolean', default: false },
        commit: { type: 'string' },
        timeout: { type: 'string', default: '600' },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (error) {
    return { command: 'invalid', message: error instanceof Error ? error.message : String(error) };
  }
  const { values, positionals } = parsed;
  if (values.help) return { command: 'help' };
  if (values.version) return { command: 'version' };
  const [command, ...rest] = positionals;
  if (command !== 'run')
    return { command: 'invalid', message: command ? `Unknown command "${command}"` : 'Missing command' };
  if (rest.length > 0) return { command: 'invalid', message: `Unexpected argument "${rest[0] ?? ''}"` };
  if (!values.suite) return { command: 'invalid', message: '--suite is required' };

  let threshold: number | null = null;
  if (values.threshold !== undefined) {
    threshold = Number(values.threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
      return { command: 'invalid', message: '--threshold must be a number from 0 to 1' };
  }
  const timeoutSeconds = Number(values.timeout);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0)
    return { command: 'invalid', message: '--timeout must be a positive whole number of seconds' };

  const commit = values.commit ?? env.GITHUB_SHA ?? null;
  return {
    command: 'run',
    suiteId: values.suite,
    threshold,
    wait: values.wait,
    json: values.json,
    commitSha: commit && /^[0-9a-f]{7,40}$/i.test(commit) ? commit.toLowerCase() : null,
    timeoutSeconds,
  };
}
