import { createApi } from './api';
import { parseCliArgs, USAGE } from './args';
import { COLORS, NO_COLORS } from './format';
import { runSuite } from './run';
import { EXIT } from './types';

export const VERSION = '0.1.0';

export interface MainIo {
  argv: string[];
  env: Record<string, string | undefined>;
  out: (line: string) => void;
  err: (line: string) => void;
  isTty: boolean;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export async function main(io: MainIo): Promise<number> {
  const args = parseCliArgs(io.argv, io.env);
  switch (args.command) {
    case 'help':
      io.out(USAGE);
      return EXIT.passed;
    case 'version':
      io.out(VERSION);
      return EXIT.passed;
    case 'invalid':
      io.err(`evalpilot: ${args.message}\n\n${USAGE}`);
      return EXIT.error;
    case 'run': {
      const apiKey = io.env.EVALPILOT_API_KEY;
      if (!apiKey) {
        io.err('evalpilot: set EVALPILOT_API_KEY to a project API key (create one in Settings › API keys)');
        return EXIT.error;
      }
      const colors = io.isTty && !io.env.NO_COLOR ? COLORS : NO_COLORS;
      return runSuite(args, {
        api: createApi(io.env.EVALPILOT_URL ?? 'http://localhost:4000', apiKey, io.fetch),
        out: io.out,
        err: io.err,
        colors,
        now: () => Date.now(),
        sleep: io.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      });
    }
  }
}
