# EvalPilot

**Test your AI before your users do.**

EvalPilot is a platform to test, red-team and monitor AI chatbots and assistants:
test suites with rule-based and AI-judge checks, live test runs, a red-team attack library,
production traces through a small SDK, and a CLI that gates CI on AI quality.

> 🚧 In active development. The full specification is in [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md).

**Stack:** Next.js 15 · NestJS 11 · TypeScript · Prisma + MySQL · BullMQ + Redis · Socket.IO ·
Claude API · Playwright · Jest · Vitest · Pact · k6 · Docker · GitHub Actions

## Implementation notes

Choices made where the spec left room (simplest standard option):

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
- **npm:** the lockfile is generated with npm 11 (npm 10.8 drops nested dependencies when
  `overrides` are used); `npm ci` / `npm install` work with npm 10 or 11. `npm run deps:check`
  verifies the installed tree.

## Author

**Sheetal Khadanga** — QA Engineer
[LinkedIn](https://www.linkedin.com/in/sheetal-khadanga) ·
[GitHub](https://github.com/SheetalK01) ·
[Portfolio](https://sheetalk01.github.io)

## License

Copyright © 2026 Sheetal Khadanga. All rights reserved. See [LICENSE](LICENSE).
