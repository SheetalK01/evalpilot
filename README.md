<p align="center"><img src="docs/banner.svg" alt="EvalPilot — test your AI before your users do" width="100%"></p>

<p align="center">
  <a href="https://github.com/SheetalK01/evalpilot/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/SheetalK01/evalpilot/actions/workflows/ci.yml/badge.svg?branch=develop"></a>
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6">
  <img alt="Node 20" src="https://img.shields.io/badge/node-20.17%2B-3c873a">
  <img alt="Tests" src="https://img.shields.io/badge/tests-800%2B-3ddc97">
  <img alt="Coverage" src="https://img.shields.io/badge/coverage-%E2%89%A580%25-3ddc97">
  <img alt="axe" src="https://img.shields.io/badge/a11y-0%20serious%2Fcritical-3ddc97">
  <img alt="License" src="https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey">
</p>

**EvalPilot tests, red-teams and monitors AI chatbots.** Write test suites with rule-based and
LLM-judge checks, watch runs stream in live, attack your bot with a 26-prompt red-team library,
see production traces arrive from a tiny SDK, and fail the build in CI when quality drops.

<p align="center"><img src="docs/demo.gif" alt="Signing in, running a suite live and opening the red-team report" width="900"></p>

## Why I built this

I'm a QA engineer. Every team I've seen ship an LLM feature tested it the same way: someone
types ten questions into the chat box before the release and says "looks good". A prompt tweak,
a model upgrade or a "cheaper" system prompt can silently break refunds, leak the system prompt
or start answering off-topic, and nobody finds out until a customer does.

Traditional test tools don't fit: the output is free text, "correct" is fuzzy, and the failure
modes (jailbreaks, prompt injection, PII leaks) are adversarial. EvalPilot brings the habits of
good QA (repeatable suites, a regression gate in CI, security testing, production monitoring)
to AI features, and it is itself built and tested the way I'd want a product to be.

## Screenshots

|                 | Dark                                                            | Light                                                             |
| --------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Dashboard       | ![Dashboard, dark](docs/screenshots/dashboard-dark-desktop.jpg) | ![Dashboard, light](docs/screenshots/dashboard-light-desktop.jpg) |
| Live run        | ![Run, dark](docs/screenshots/run-dark-desktop.jpg)             | ![Run, light](docs/screenshots/run-light-desktop.jpg)             |
| Red-team report | ![Red-team, dark](docs/screenshots/redteam-dark-desktop.jpg)    | ![Red-team, light](docs/screenshots/redteam-light-desktop.jpg)    |
| Suite editor    | ![Suite, dark](docs/screenshots/suite-dark-desktop.jpg)         | ![Suite, light](docs/screenshots/suite-light-desktop.jpg)         |
| Live traces     | ![Traces, dark](docs/screenshots/traces-dark-desktop.jpg)       | ![Traces, light](docs/screenshots/traces-light-desktop.jpg)       |
| Landing         | ![Landing, dark](docs/screenshots/landing-dark-desktop.jpg)     | ![Landing, light](docs/screenshots/landing-light-desktop.jpg)     |

More in [`docs/screenshots`](docs/screenshots) (project, settings, phone widths).

## Features

- **Test suites** for any HTTP chatbot (templated request body, JSONPath to the answer, encrypted
  headers) or the built-in ShopBot demo.
- **Checks:** contains / not contains / equals, regex (ReDoS-safe), JSON schema, max length,
  latency, refusal, and **LLM-as-judge** with criteria and a minimum score.
- **Live runs:** results stream in over WebSockets, in order; filter failures, open any result to
  see each check's verdict, compare two runs case by case (fixed / regressed).
- **Red-team:** 26 attacks in 6 categories (prompt injection, jailbreak, system-prompt leak, PII
  leak, harmful content, off-topic), deterministic detectors, a 0–100 risk score and a threat radar.
- **Production traces:** a zero-dependency SDK batches traces; they appear live with usage, p95
  latency, tokens and cost.
- **CI gate:** `evalpilot run --suite <id>` exits 1 below the suite's threshold. Example workflow
  in [`.github/workflows/evalpilot-gate.example.yml`](.github/workflows/evalpilot-gate.example.yml).
- **Mock AI mode:** deterministic judge and bot, so everything runs free and offline; switch to
  `AI_MODE=live` for the real judge (`claude-opus-5-5`).
- **Flight Deck UI:** an instrument-panel design in dark and light, keyboard-first (⌘K, `/`),
  WCAG AA, reduced-motion aware, down to 360 px.
- **Security:** owner-scoped everything (404 for others), SSRF guard, hashed API keys, encrypted
  secrets, CSRF origin check, rate limits, request ids.

## Architecture

```mermaid
flowchart LR
    U[Browser] --> W[Next.js web]
    W -- REST + Socket.IO --> A[NestJS API]
    A -- Prisma --> DB[(MySQL · host)]
    A -- enqueue --> R[(Redis · BullMQ)]
    R --> K[NestJS worker]
    K -- HTTP, SSRF-guarded --> T[Target bot · ShopBot]
    K -- Anthropic SDK --> C[LLM judge]
    K -- events --> R -- relay --> A
    T -- SDK traces --> A
    CLI[evalpilot CLI in CI] -- API key --> A
```

The API never calls a target or the LLM in the request path: it queues a job and answers `202`.
The worker does the slow work and publishes events through Redis; the API relays them to
Socket.IO rooms. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · API reference:
[docs/API.md](docs/API.md) (Swagger at `/api/docs`).

**Stack:** Next.js 15 · React 19 · Tailwind 4 · NestJS 11 · TypeScript (strict) · Prisma 6 + MySQL ·
BullMQ + Redis · Socket.IO · Anthropic SDK · Fastify · Jest · Vitest · Playwright · Pact · k6 ·
Docker · GitHub Actions

## Quick start

You need **Node 20.17+**, **MySQL 8+** and **Redis 7+** running on your machine (EvalPilot uses
them directly; there are no database containers). About 5 minutes.

```bash
git clone https://github.com/SheetalK01/evalpilot.git && cd evalpilot
cp .env.example .env
```

Create the databases once (MySQL Workbench or `mysql -u root -p`):

```sql
CREATE DATABASE evalpilot;  CREATE DATABASE evalpilot_test;
CREATE USER 'evalpilot'@'%' IDENTIFIED BY 'choose-a-password';
GRANT ALL ON evalpilot.* TO 'evalpilot'@'%';  GRANT ALL ON evalpilot_test.* TO 'evalpilot'@'%';
```

Put that password into `DATABASE_URL` and `TEST_DATABASE_URL` in `.env`. Then pick one:

### Without Docker (hot reload)

```bash
npm ci
bash scripts/dev-local.sh      # generates secrets, migrates, seeds, starts everything
```

### With Docker

```bash
bash scripts/dev-local.sh --env-only   # generates the local secrets in .env, nothing else
docker compose up --build              # api, worker, web, shopbot — on your host's MySQL and Redis
```

The containers reach your MySQL and Redis through `host.docker.internal`; `127.0.0.1` URLs in
`.env` are rewritten for them, and the API container applies migrations and seeds on start.

Open **http://localhost:3000** and sign in with **`demo@evalpilot.dev` / `evalpilot-demo-2026`**:
two weeks of history, a passing suite, a regression and a red-team report are already there. Check
the whole stack with `npm run smoke`.

| Service               | URL                            |
| --------------------- | ------------------------------ |
| Web                   | http://localhost:3000          |
| API + Swagger         | http://localhost:4000/api/docs |
| ShopBot (demo target) | http://localhost:4100/health   |

**See a regression:** restart ShopBot with `SHOPBOT_PROMPT_VERSION=v2` and run the demo suite
again; two cases fail and the CLI gate exits 1.

## SDK

```ts
import { EvalPilot } from '@evalpilot/sdk';

const ep = new EvalPilot({ apiKey: process.env.EVALPILOT_API_KEY, baseUrl: 'http://localhost:4000' });

// Measures the call, records input/output/latency/errors, returns exactly what your function returns.
const answer = await ep.trace('chat', { input: question, model: 'claude-opus-5-5' }, () =>
  callMyBot(question),
);

// Or record something you measured yourself.
ep.record({ name: 'refund', input, output, latencyMs: 420, inputTokens: 120, outputTokens: 80 });

await ep.shutdown(); // flush before exit
```

Batched (≤ 100 per request), retried with back-off on 429/5xx, bounded memory, never throws into
your app. Create a key in **Settings → API keys**.

## CLI (CI gate)

```bash
npm run build
EVALPILOT_API_KEY=ep_live_… EVALPILOT_URL=http://localhost:4000 \
  npm run cli -- run --suite <suite-id> --commit "$GITHUB_SHA"
```

Exit codes: **0** passed · **1** below the suite's threshold · **2** error. It prints a table of
results and a link to the run.

## Testing

| Layer                                           | Command                                     | What                                                                      |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| Unit                                            | `npm test`                                  | ~520 tests: checks, risk score, cost, CSV, SSRF, SDK retry, CLI, UI logic |
| Coverage                                        | `npm run test:coverage`                     | ≥ 80 % gate on API services, worker processors and packages               |
| Integration                                     | `npm run db:reset:test && npm run test:int` | ~200 tests on the real `evalpilot_test` DB + Redis                        |
| Contract                                        | `npm run test:contract`                     | Pact: SDK, CLI and web consumers, verified against the compiled API       |
| E2E + API + security + a11y + visual + realtime | `npm run test:e2e`                          | 77 Playwright tests on an isolated stack (ports 3300/4400/4500)           |
| By tag                                          | `npm run test:e2e:only -- --grep @security` | `@smoke @regression @security @a11y @visual @realtime @api`               |
| Load                                            | `npm run test:load`                         | k6: 200 traces/s for 60 s (p95 3 ms), 20 concurrent runs                  |
| Judge quality                                   | `npm run eval:judge`                        | agreement with a labelled set (gate 80 % in live mode)                    |
| Stack smoke                                     | `npm run smoke`                             | signs in, runs the demo suite and a red-team run                          |

The full strategy (scope, environments, entry/exit criteria, risks, every test case and every
`data-testid`) is in **[docs/TEST_PLAN.md](docs/TEST_PLAN.md)**.

## Project structure

```
apps/
  api/        NestJS API: auth, projects, targets, suites, runs, red-team, traces, realtime gateway
  worker/     NestJS + BullMQ: runs suites and red-team attacks, pings targets
  web/        Next.js App Router: the Flight Deck UI
  shopbot/    Fastify demo support bot (deliberately a little vulnerable)
packages/
  shared/     zod schemas, check evaluators, attack library, risk score, SSRF rules, CSV, costs
  server-core/ NestJS modules shared by API and worker (config, Prisma, Redis, queues, crypto)
  sdk/        @evalpilot/sdk — tracing, zero dependencies
  cli/        evalpilot — CI gate
prisma/       schema, migrations, seed (attack library + demo workspace + history)
e2e/          Playwright: pages/ (POM), fixtures/, tests/{e2e,api,security,a11y,visual,realtime}
contracts/    Pact consumers (SDK, CLI, web) + provider verification
perf/         k6 scripts
docker/       container entrypoints
docs/         ARCHITECTURE, API, TEST_PLAN, INTERVIEW_NOTES, BUILD_SPEC, screenshots
scripts/      dev-local.sh, reset-test-db, smoke, screenshots, demo recording, judge eval
```

## Roadmap

- Scheduled runs (nightly) and Slack/email alerts on regressions
- Multi-turn conversation test cases
- Datasets from production traces ("turn this trace into a test case")
- Team workspaces and roles
- Firefox/WebKit in the Playwright matrix
- Free hosting (a plan is in the spec; nothing is deployed in v1)

## Design decisions

Choices made where the spec left room (the simplest standard option each time). The _why_ behind the
big ones is in [docs/INTERVIEW_NOTES.md](docs/INTERVIEW_NOTES.md).

- **Tool versions** are pinned for Node 20: TypeScript 5.9, ESLint 9, Vitest 4.1, lint-staged 16,
  Prisma 6.19 (stable and CommonJS-friendly for NestJS 11). Two `overrides` in `package.json` pull in
  patched `deepmerge-ts` and `esbuild` so `npm audit` reports 0 vulnerabilities.
- **ShopBot target URL** is not stored in the database; the worker reads `SHOPBOT_URL`, so the same
  data works with and without Docker.
- **History stays readable:** `test_results.case_name` snapshots the case name and
  `test_case_id` becomes `NULL` if a case is deleted. Deleting a target unlinks its suites
  (`target_id = NULL`) instead of deleting them.
- **Red-team run status** uses `QUEUED | RUNNING | COMPLETED | ERROR | CANCELLED`.
- **Test database reset** = `prisma migrate deploy` + truncate every table in `evalpilot_test`
  (`npm run db:reset:test`). The script refuses any database whose name does not end in `_test`.
- **Shadow database:** `npm run db:migrate` (schema changes) needs a shadow DB. If your MySQL
  user cannot create databases, create `evalpilot_shadow` once and set `SHADOW_DATABASE_URL`
  (see `.env.example`). Applying existing migrations (`npm run db:deploy`) does not need it.

- **Validation:** request bodies are validated with the shared zod schemas through `nestjs-zod`
  DTOs (instead of class-validator), so the API, web app, SDK and CLI share one definition, and
  Swagger is generated from the same schemas.
- **CSRF:** session cookies are `SameSite=Lax`, and every cookie-authenticated `POST/PATCH/DELETE`
  must carry an allow-listed `Origin` (or `Referer`). API-key requests are exempt (no cookies).
- **Rate limits:** login/register are limited per IP + email (10/min by default), `/v1/*` per API
  key, everything else per IP. All limits are configurable (`RATE_LIMIT_*`).
- **Header masking:** target header values show only their last 4 characters, and only when the
  value is at least 12 characters long; shorter values are fully masked.
- **Pagination** (`?cursor=&limit=`, max 100) is used on lists that grow without bound (projects,
  suites, runs, traces, red-team runs). Targets, API keys and test cases are returned in full;
  a suite holds at most 500 cases.
- **`POST /targets/:id/ping`** is built with the worker in phase 3, so the API itself never calls
  a target (spec section 5).
- **`packages/server-core`** (not in the spec's layout) holds the NestJS modules the API and the
  worker share: config, Prisma, Redis, queues, the realtime publisher and the response mappers.
  This is how "the worker shares the domain modules" (spec section 3) is done without one app
  importing another's source.
- **Queues:** BullMQ 5 (stable; BullMQ 6 is a new major with pluggable backends). Every Redis key,
  queue and channel lives under `REDIS_PREFIX` (default `evalpilot`); each test file uses a random
  prefix, so tests never collide with each other or with a running dev worker.
- **Live judge:** `claude-opus-5-5` through `client.beta.messages.parse` with a zod schema
  (structured JSON output), `effort` from `JUDGE_EFFORT` (default `medium`), and server-side refusal
  fallbacks (`fallbacks: "default"`) on models that support them. Answers are fenced in tags and
  the judge is told to treat them as data (prompt-injection resistant). In live mode, `refusal`
  checks are decided by the judge; in mock mode by a heuristic.
- **SSRF guard** works at connect time: a custom DNS lookup rejects any private address the host
  resolves to (so DNS rebinding does not help), literal private IPs are rejected before the call,
  and redirects are refused for user-defined targets. The built-in ShopBot is exempt (its URL is
  server config, not user input).
- **Cancelling** a running run stops it before its next test case; cases already in flight
  (at most 4) finish and are kept.
- **SDK** (`@evalpilot/sdk`) has no runtime dependencies (about 7 KB). Its `TraceInput` type is
  declared in the SDK and checked against `@evalpilot/shared` at compile time, so it cannot drift
  from the API. Each trace gets an `externalId`, so retried batches are never stored twice.
- **CLI** exit codes: `0` passed, `1` below threshold, `2` error (bad usage, API error, run
  `ERROR`/`CANCELLED`, timeout). Until the CLI is published, run it with
  `npm run cli -- run --suite <id>` (after `npm run build`).
- **ShopBot** (Fastify) is deliberately vulnerable in mock mode to 6 of the 26 attacks (risk
  score 22, MEDIUM), so the red-team report has findings. `SHOPBOT_PROMPT_VERSION=v2` switches
  to a "cheaper" prompt that drops the 30-day refund window and the 3–5 day shipping time: the
  demo suite goes from 8/8 to 6/8 and the CI gate fails. ShopBot's tests check the seeded demo
  suite and the attack library against its answers, so the demo can never silently break.
- **Local SDK key:** if `EVALPILOT_API_KEY` is set, the seed registers it (hash only) on the demo
  project, so ShopBot's traces show up without manual setup.
- **CSRF check** is skipped on API-key routes (`/v1/*`): they never read cookies, and a missing
  key should give a clear `401`, not `403 Missing Origin header`.
- **Usage charts** are aggregated in memory from a project's traces in the selected range; at
  scale this would move to SQL `GROUP BY` or a rollup table.
- **Pact** 16.5 (17.x needs Node 22). The SDK, CLI and web app are consumers. Provider verification boots the compiled API on the test database and
  sets up each provider state with Prisma.
- **npm:** the lockfile is generated with npm 11 (npm 10.8 drops nested dependencies when
  `overrides` are used); `npm ci` / `npm install` work with npm 10 or 11. `npm run deps:check`
  verifies the installed tree.

## Author

**Sheetal Khadanga** — QA Engineer · Full Stack
[LinkedIn](https://www.linkedin.com/in/sheetal-khadanga) ·
[GitHub](https://github.com/SheetalK01) ·
[Portfolio](https://sheetalk01.github.io)

## License

Copyright © 2026 Sheetal Khadanga. **All rights reserved.** Published for portfolio and
evaluation purposes only; see [LICENSE](LICENSE).
