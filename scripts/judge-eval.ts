/**
 * LLM-judge quality check: how often the judge agrees with human labels, and how consistent it
 * is with itself across repeated calls.
 *
 *   npx tsx scripts/judge-eval.ts                 # mock judge (free, deterministic)
 *   AI_MODE=live ANTHROPIC_API_KEY=… npx tsx scripts/judge-eval.ts --repeat 3
 *
 * Run from the repo root. Needs `npm run build` (uses the worker's compiled judges). In live mode it exits 1 below --min
 * agreement (default 0.8). The mock judge is a keyword heuristic: its score is a baseline only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import type { Judge } from '../apps/worker/src/judge/judge';

interface Labelled {
  score: { criteria: string; prompt: string; output: string; pass: boolean }[];
  refusal: { prompt: string; output: string; refused: boolean }[];
}

const PASS_SCORE = 7;
const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const repeat = option('repeat', 1);
const minAgreement = option('min', 0.8);

async function createJudge(): Promise<Judge> {
  const root = cwd();
  if (process.env.AI_MODE === 'live') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('AI_MODE=live needs ANTHROPIC_API_KEY');
    const { AnthropicJudge } = (await import(`${root}/apps/worker/dist/judge/anthropic-judge.js`)) as {
      AnthropicJudge: new (options: {
        apiKey: string;
        model: string;
        effort: 'low' | 'medium' | 'high';
      }) => Judge;
    };
    return new AnthropicJudge({
      apiKey,
      model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
      effort: 'medium',
    });
  }
  const { MockJudge } = (await import(`${root}/apps/worker/dist/judge/mock-judge.js`)) as {
    MockJudge: new () => Judge;
  };
  return new MockJudge();
}

async function main(): Promise<void> {
  const data = JSON.parse(
    readFileSync(resolve(cwd(), 'scripts/judge-eval/labelled.json'), 'utf8'),
  ) as Labelled;
  const judge = await createJudge();
  let agree = 0;
  let total = 0;
  let consistent = 0;
  const misses: string[] = [];

  for (const item of data.score) {
    const verdicts: boolean[] = [];
    for (let i = 0; i < repeat; i++) verdicts.push((await judge.score(item)).score >= PASS_SCORE);
    if (verdicts.every((v) => v === verdicts[0])) consistent++;
    for (const verdict of verdicts) {
      total++;
      if (verdict === item.pass) agree++;
      else misses.push(`score  · expected ${item.pass ? 'pass' : 'fail'} · ${item.output.slice(0, 60)}`);
    }
  }
  for (const item of data.refusal) {
    const verdicts: boolean[] = [];
    for (let i = 0; i < repeat; i++) verdicts.push((await judge.classifyRefusal(item)).refused);
    if (verdicts.every((v) => v === verdicts[0])) consistent++;
    for (const verdict of verdicts) {
      total++;
      if (verdict === item.refused) agree++;
      else
        misses.push(
          `refusal · expected ${item.refused ? 'refused' : 'answered'} · ${item.output.slice(0, 60)}`,
        );
    }
  }

  const items = data.score.length + data.refusal.length;
  const agreement = agree / total;
  console.log(`Judge: ${judge.mode} · ${items} labelled items × ${repeat}`);
  console.log(`Agreement with labels: ${(agreement * 100).toFixed(1)}% (${agree}/${total})`);
  console.log(
    `Self-consistency:      ${((consistent / items) * 100).toFixed(1)}% of items gave the same verdict every time`,
  );
  for (const miss of [...new Set(misses)]) console.log(`  ✗ ${miss}`);
  if (judge.mode === 'live' && agreement < minAgreement) process.exit(1);
}

void main();
