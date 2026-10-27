# EvalPilot — Test Plan

|              |                                                          |
| ------------ | -------------------------------------------------------- |
| Product      | EvalPilot v1.0 — test, red-team and monitor LLM chatbots |
| Owner        | Sheetal Khadanga (QA / Full Stack)                       |
| Status       | Active · all suites green locally                        |
| Last updated | 2026-10-27                                               |

## 1. Purpose

This plan describes how EvalPilot is tested: what we test, at which layer, in which environment,
when a build may ship, and where the main risks are. It is also the map of the test code. Every
case in §8 points to the spec file that automates it.

## 2. Strategy: the test pyramid

```
                 ┌───────────────┐
                 │  k6 load (2)  │  trace ingestion 200 rps · 20 concurrent runs
               ┌─┴───────────────┴─┐
               │ Playwright (77)   │  E2E · API · security · a11y · visual · realtime
             ┌─┴───────────────────┴─┐
             │ Contract — Pact (3)   │  SDK, CLI, web  ↔  API (provider verified)
           ┌─┴───────────────────────┴─┐
           │ Integration (Jest, ~200)  │  real MySQL test DB + Redis, Supertest, Socket.IO
         ┌─┴───────────────────────────┴─┐
         │ Unit (Jest / Vitest, ~520)    │  checks, risk, cost, CSV, SSRF, SDK, CLI, UI logic
         └───────────────────────────────┘
```

- **Push risk down.** Check evaluators, risk scoring, cost maths, CSV, SSRF rules and the SDK
  batching/retry logic are pure functions or small classes, so they are unit-tested exhaustively
  (fast, deterministic, ≥ 80 % coverage gate).
- **Integration tests own the API's rules:** ownership (IDOR → 404), validation, hashing, queue
  hand-off, worker processing against a fake target, red-team scoring, usage aggregation. They
  run against the real MySQL `evalpilot_test` database and Redis, not mocks.
- **Contracts lock the public surface.** Consumers (SDK, CLI, web) publish Pact files; the
  compiled API verifies all of them. A breaking change to `/v1/traces`, `/v1/runs` or the key
  endpoints fails CI before any E2E test runs.
- **Playwright covers what only a running system can show:** user journeys, live WebSocket
  updates, cookies/CSRF/JWT, rendered XSS, accessibility and visual regressions.
- **k6 proves the performance targets** in the spec, against the same stack.
- **AI is mocked by default** (`AI_MODE=mock`): deterministic judge, deterministic ShopBot. The
  live judge's quality is measured separately (§9).

## 3. Scope

**In scope:** auth (email/password, session cookie, GitHub button visibility), projects, targets
(HTTP + ShopBot, ping, SSRF guard, header encryption), suites and cases (CRUD, reorder, CSV
import/export), runs (queue, worker, checks, LLM judge, live results, compare, cancel), red-team
(attack library, detection, risk score, report), traces (SDK ingest, live feed, usage), API keys,
dashboard, CLI gate, SDK, theme, keyboard shortcuts, accessibility, security headers.

**Out of scope:** the features listed as out of scope in `docs/BUILD_SPEC.md` §2; the real
Anthropic API in CI (cost, non-determinism); browsers other than Chromium (the app uses no
engine-specific APIs; Firefox/WebKit are a cheap later addition in `playwright.config.ts`);
production infrastructure (no deployment in v1).

## 4. Environments

| Environment | Used by                                 | Database                                    | Redis                        | AI   | Ports                              |
| ----------- | --------------------------------------- | ------------------------------------------- | ---------------------------- | ---- | ---------------------------------- |
| Dev         | `scripts/dev-local.sh`                  | host MySQL `evalpilot`                      | host, prefix `evalpilot`     | mock | web 3000 · api 4000 · shopbot 4100 |
| Unit        | Jest / Vitest                           | none                                        | none                         | mock | —                                  |
| Integration | `npm run test:int`                      | host MySQL `evalpilot_test` (reset per run) | host, unique prefix per file | mock | random                             |
| Contract    | `npm run test:contract`                 | `evalpilot_test`                            | unique prefix                | mock | random + 9471                      |
| E2E / load  | `npm run test:e2e`, `npm run test:load` | `evalpilot_test` (reset + seeded at start)  | prefix `evalpilot-e2e`       | mock | web 3300 · api 4400 · shopbot 4500 |
| CI          | GitHub Actions                          | MySQL 8 service container                   | Redis service container      | mock | as above                           |

The E2E stack runs next to the dev stack on different ports, so testing never touches dev
data. `TEST_DATABASE_URL` must end in `_test`; every reset script refuses anything else.

**Test data:** each test creates its own user (unique email), project and resources through the
API, so tests are independent and run in parallel (6 Playwright workers locally). Read-only
suites (a11y, visual) share one populated workspace per worker. There are no fixed sleeps: tests
wait on UI state, `expect.poll` or WebSocket events.

## 5. Entry and exit criteria

**Entry (a build is testable):** `npm ci` succeeds and `npm ls --all` is clean; lint and
typecheck pass; migrations apply to an empty database; MySQL and Redis are reachable.

**Exit (a build may merge to `main`):**

- 100 % of unit, integration, contract, E2E, API, security, realtime and visual tests pass
  (one automatic retry in CI only; a test that needs the retry is a flake and gets a ticket).
- Coverage ≥ 80 % on API services, worker processors and packages.
- Zero serious/critical axe violations on every page in both themes.
- k6: trace ingestion p95 < 300 ms and < 1 % errors at 200 rps; 20 concurrent runs all finish.
- `npm audit` shows no known vulnerabilities; no secrets in the diff.

## 6. Risks and mitigations

| #   | Risk                                                           | Impact   | Mitigation                                                                                                                |
| --- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| R1  | A user reads or changes another user's data (IDOR)             | Critical | Owner checks in every service; integration tests per resource; one E2E test hits all 26 endpoints as an intruder (SEC-01) |
| R2  | SSRF: a target URL reaches internal services or cloud metadata | Critical | DNS-resolved IP check in the worker, private ranges incl. IPv6/mapped/NAT64; unit + E2E (SEC-05)                          |
| R3  | Secrets leak (target headers, API keys, password hashes)       | High     | AES-GCM at rest, masked responses, SHA-256 key hashes; response scans in SEC-06/07                                        |
| R4  | Stored XSS through case names or bot output                    | High     | React escaping only (no raw HTML); hostile payloads rendered in SEC-08                                                    |
| R5  | Live results arrive out of order or are lost                   | High     | Serial publisher per run; REALTIME-01 checks order against a real worker run                                              |
| R6  | LLM judge disagrees with humans                                | Medium   | Labelled-set eval in live mode (§9); judge reasons shown in the UI; deterministic checks first                            |
| R7  | Flaky tests from shared state or timing                        | Medium   | Own data per test, unique Redis prefixes, no sleeps, traces/videos kept on failure                                        |
| R8  | Ingestion slows down under production load                     | Medium   | k6 threshold gates (LOAD-01)                                                                                              |
| R9  | Visual baselines differ across operating systems               | Low      | Baselines per platform; CI creates missing ones on first run; dynamic regions masked                                      |
| R10 | Accessibility regressions in either theme                      | Medium   | axe on 14 pages × 2 themes in every run (A11Y-01)                                                                         |

## 7. Commands

| What                                 | Command                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Unit (all workspaces)                | `npm test`                                                                                        |
| Coverage                             | `npm run test:coverage`                                                                           |
| Integration                          | `npm run db:reset:test && npm run test:int`                                                       |
| Contract (Pact consumers + provider) | `npm run test:contract`                                                                           |
| Everything in Playwright             | `npm run test:e2e` (builds, then runs all projects)                                               |
| Only some tags                       | `npm run test:e2e:only -- --grep @smoke` (`@regression @security @a11y @visual @realtime @api`)   |
| Update visual baselines              | `npm run test:e2e:only -- --project=visual --update-snapshots`                                    |
| Playwright report                    | `npm run report -w @evalpilot/e2e`                                                                |
| Load                                 | `npm run test:load` (`SMOKE=1` for a 10 s check)                                                  |
| Judge quality                        | `npm run eval:judge` (mock) · `AI_MODE=live ANTHROPIC_API_KEY=… npm run eval:judge -- --repeat 3` |

Reports: `e2e/reports/html`, `e2e/reports/junit.xml`, `perf/results/*.json`, `coverage/` per
workspace.

## 8. Test cases

Priority: **P1** blocks release · **P2** must be fixed before the next release · **P3** nice to have.
All cases are automated.

### End-to-end (Playwright, `e2e/tests/e2e`)

| ID     | Title                                                                                                                                                          | Type       | Priority | Spec                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | ------------------- |
| E2E-01 | Register → empty dashboard → sign out → sign in                                                                                                                | smoke      | P1       | `auth.spec.ts`      |
| E2E-02 | Wrong password shows an error                                                                                                                                  | regression | P2       | `auth.spec.ts`      |
| E2E-03 | Registration form validates before sending                                                                                                                     | regression | P2       | `auth.spec.ts`      |
| E2E-04 | Signed-out visitor is redirected to login and back (`next`)                                                                                                    | smoke      | P1       | `auth.spec.ts`      |
| E2E-05 | Duplicate email cannot register                                                                                                                                | regression | P2       | `auth.spec.ts`      |
| E2E-06 | Project → ShopBot target (ping OK) → suite with 5 cases built in the UI → run → results stream live → failed-only filter → result detail → run again → compare | smoke      | P1       | `suite-run.spec.ts` |
| E2E-07 | Red-team against ShopBot: risk score, 26 findings, landed filter, finding detail                                                                               | regression | P1       | `redteam.spec.ts`   |
| E2E-08 | SDK traces appear live (no reload), inspector shows output, search filters                                                                                     | realtime   | P1       | `traces.spec.ts`    |
| E2E-09 | API key shown once, prefix only afterwards, revoke → key gets 401                                                                                              | regression | P1       | `api-keys.spec.ts`  |
| E2E-10 | CSV import (2 valid, 1 bad row reported) and export round-trip                                                                                                 | regression | P2       | `csv.spec.ts`       |
| E2E-11 | Theme toggle persists across reload                                                                                                                            | regression | P3       | `theme.spec.ts`     |
| E2E-12 | Command palette opens with ⌘K and navigates                                                                                                                    | regression | P3       | `theme.spec.ts`     |

### API (Playwright `request`, `e2e/tests/api`)

| ID     | Title                                                                     | Type       | Priority | Spec                |
| ------ | ------------------------------------------------------------------------- | ---------- | -------- | ------------------- |
| API-01 | Health is public, reports api/db/redis/worker, sets `x-request-id`        | smoke      | P1       | `contracts.spec.ts` |
| API-02 | register 201 → me 200 (no password hash) → logout 204 → me 401            | smoke      | P1       | `contracts.spec.ts` |
| API-03 | Every workspace resource matches its shared zod schema; run results too   | regression | P1       | `contracts.spec.ts` |
| API-04 | Cursor pagination walks every page once; limit > max → 400                | regression | P2       | `contracts.spec.ts` |
| API-05 | 401 in the standard error format                                          | smoke      | P1       | `contracts.spec.ts` |
| API-06 | 400 lists every field error by path                                       | regression | P2       | `contracts.spec.ts` |
| API-07 | 404 for unknown routes and ids                                            | regression | P2       | `contracts.spec.ts` |
| API-08 | Cross-origin cookie mutation → 403 (CSRF)                                 | security   | P1       | `contracts.spec.ts` |
| API-09 | Body over 1 MB → 413                                                      | security   | P2       | `contracts.spec.ts` |
| API-10 | Login limited per IP + email → 429 + Retry-After; other emails unaffected | security   | P1       | `contracts.spec.ts` |

### Security (`e2e/tests/security`)

| ID     | Title                                                                                            | Type     | Priority | Spec                            |
| ------ | ------------------------------------------------------------------------------------------------ | -------- | -------- | ------------------------------- |
| SEC-01 | Intruder gets 404 on 26 endpoints of another user's workspace; nothing changes                   | security | P1       | `idor.spec.ts`                  |
| SEC-02 | An API key cannot start runs in another project                                                  | security | P1       | `idor.spec.ts`                  |
| SEC-03 | Tampered, expired, wrong-secret, `alg: none` and garbage JWTs → 401                              | security | P1       | `auth-tokens.spec.ts`           |
| SEC-04 | Session cookie is httpOnly + SameSite=Lax; not readable from page scripts                        | security | P1       | `auth-tokens.spec.ts`           |
| SEC-05 | SSRF: loopback, metadata, private, IPv6 loopback, 0.0.0.0 never called; non-HTTP schemes refused | security | P1       | `api-keys-ssrf-secrets.spec.ts` |
| SEC-06 | Revoked, malformed or missing key → 401 on every `/v1` endpoint                                  | security | P1       | `api-keys-ssrf-secrets.spec.ts` |
| SEC-07 | Target header secrets masked; no hash or raw key in any response                                 | security | P1       | `api-keys-ssrf-secrets.spec.ts` |
| SEC-08 | XSS payloads in project, target, suite, case names and bot outputs render as text                | security | P1       | `xss.spec.ts`                   |
| SEC-09 | Security headers on API and web (nosniff, X-Frame-Options, no X-Powered-By)                      | security | P2       | `api-keys-ssrf-secrets.spec.ts` |

### Real-time (`e2e/tests/realtime`)

| ID    | Title                                                                    | Type     | Priority | Spec                 |
| ----- | ------------------------------------------------------------------------ | -------- | -------- | -------------------- |
| RT-01 | A real worker run streams progress 0→5 in order, completion last         | realtime | P1       | `run-events.spec.ts` |
| RT-02 | Cannot join another user's run, red-team or project room; no events leak | security | P1       | `run-events.spec.ts` |
| RT-03 | Sockets without a valid session are refused                              | security | P1       | `run-events.spec.ts` |

### Accessibility and visual

| ID      | Title                                                                                     | Type   | Priority | Spec                   |
| ------- | ----------------------------------------------------------------------------------------- | ------ | -------- | ---------------------- |
| A11Y-01 | 14 pages × dark/light: zero serious/critical axe violations (WCAG 2.2 AA tags)            | a11y   | P1       | `a11y/pages.spec.ts`   |
| A11Y-02 | Skip link moves focus to main content                                                     | a11y   | P2       | `a11y/pages.spec.ts`   |
| A11Y-03 | Login works with the keyboard alone                                                       | a11y   | P2       | `a11y/pages.spec.ts`   |
| VIS-01  | Landing, design system, dashboard, run view, red-team report × dark/light match baselines | visual | P2       | `visual/pages.spec.ts` |

### Contract, load and AI quality

| ID      | Title                                                                      | Type       | Priority | Spec                                  |
| ------- | -------------------------------------------------------------------------- | ---------- | -------- | ------------------------------------- |
| CON-01  | SDK ↔ `POST /v1/traces` (202, 401)                                         | contract   | P1       | `contracts/consumer/sdk.pact.test.ts` |
| CON-02  | CLI ↔ `/v1/suites/:id/runs`, `/v1/runs/:id`                                | contract   | P1       | `contracts/consumer/cli.pact.test.ts` |
| CON-03  | Web ↔ API key list/create/revoke + error body                              | contract   | P1       | `contracts/consumer/web.pact.test.ts` |
| CON-04  | The compiled API verifies all pacts                                        | contract   | P1       | `contracts/provider/api.pact.test.ts` |
| LOAD-01 | Trace ingestion 200 rps × 60 s: p95 < 300 ms, errors < 1 %                 | load       | P1       | `perf/traces.js`                      |
| LOAD-02 | 20 concurrent runs through queue + worker all finish                       | load       | P1       | `perf/runs.js`                        |
| AI-01   | Judge agreement with labelled set ≥ 80 % (live), self-consistency reported | AI quality | P2       | `scripts/judge-eval.ts`               |

Unit and integration suites are listed by file in each workspace's `src/**/*.spec.ts` and
`test/integration/*.int-spec.ts`; their names read as specifications (e.g. _"cannot list,
create or revoke keys in another user's project"_).

## 9. AI quality

`scripts/judge-eval.ts` grades a labelled set (`scripts/judge-eval/labelled.json`: 8
rubric-scored answers, 4 refusal cases) and reports agreement with the labels plus
self-consistency across `--repeat N` calls.

| Judge                    | Agreement               | Self-consistency | Notes                                                                                                                      |
| ------------------------ | ----------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Mock (keyword heuristic) | 58.3 % (7/12)           | 100 %            | Baseline only. It misses paraphrases ("3–5 business days" vs "shipping time"), which is exactly why the live judge exists. |
| Live (`claude-opus-5-5`) | run with `AI_MODE=live` | —                | Gate: ≥ 80 % agreement. Not run in CI (cost); run before changing judge prompts.                                           |

## 10. Latest results (local, 2026-10-27)

| Suite              | Result                                                |
| ------------------ | ----------------------------------------------------- |
| Unit + integration | 722 passed (coverage ≥ 80 % in every gated workspace) |
| Pact               | 3 consumers, provider verification passed             |
| Playwright         | 77 passed (chromium 57 · api 10 · visual 10)          |
| k6 traces          | 12 001 requests at 199 rps · p95 3.1 ms · 0 % errors  |
| k6 runs            | 20/20 finished · run p95 1.5 s · start p95 9 ms       |

Defects found by these suites while building them: CSV export cancelled in Chromium (blob URL
revoked too early); four accessibility issues (logo link and account menu names, scrollable code
blocks not keyboard-focusable, the light-theme pass colour at 4.33:1 contrast); "1 rows were
skipped" wording. All fixed.

## 11. `data-testid` reference

Every interactive element and list row has a stable `data-testid`. Page objects in `e2e/pages`
use only these. Toasts are rendered by Sonner and selected by its own `[data-sonner-toast]`
attribute (`BasePage.toasts`).

| Area            | Test ids                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing / auth  | `hero-start`, `login-email`, `login-password`, `login-submit`, `register-name`, `register-email`, `register-password`, `register-submit`, `auth-error`, `github-login`, `demo-fill`, `not-found`                                                                                                                                                                                             |
| Shell           | `health-leds`, `theme-toggle`, `user-menu`, `logout`, `command-palette`, `command-palette-open`, `nav-dashboard`, `nav-settings`, `nav-new-project`, `project-card`, `error-state`, `confirm-button`                                                                                                                                                                                         |
| Dashboard       | `dashboard`, `dashboard-empty`, `new-project-button`, `readout-pass-rate`, `readout-risk`, `readout-traces`, `readout-cost`, `risk-gauge`, `run-row`                                                                                                                                                                                                                                         |
| Project         | `project-page`, `tab-suites`, `tab-targets`, `tab-redteam`, `tab-traces`, `tab-settings`, `project-name`, `project-create-submit`, `project-delete`, `new-suite-button`, `suite-row`, `suite-link`, `suite-run`, `suite-name`, `suite-target`, `suite-create-submit`, `redteam-start`, `redteam-row`, `redteam-target`, `redteam-category-<CATEGORY>`, `redteam-start-submit`, `open-traces` |
| Targets         | `target-add`, `target-row`, `target-type-http`, `target-type-shopbot`, `target-name`, `target-url`, `target-header-add`, `target-body`, `target-save`, `target-ping`, `ping-result`                                                                                                                                                                                                          |
| Suite editor    | `suite-page`, `suite-target-select`, `suite-threshold`, `run-button`, `run-list`, `add-case-button`, `case-row`, `case-name-button`, `case-move-up`, `case-move-down`, `case-edit`, `case-delete`, `csv-import`, `csv-import-input`, `csv-export`                                                                                                                                            |
| Case drawer     | `case-drawer`, `case-name`, `case-input`, `case-tags`, `check-row`, `check-type-select`, `check-value`, `check-add`, `check-remove`, `case-save`                                                                                                                                                                                                                                             |
| Run view        | `run-page`, `run-status`, `run-progress`, `result-row`, `result-status`, `result-detail`, `check-result`, `filter-failed`, `compare-button`, `run-diff`, `diff-row`, `run-again`, `cancel-run`                                                                                                                                                                                               |
| Red-team        | `redteam-page`, `risk-score`, `threat-radar`, `finding-row` (`data-vulnerable`), `finding-detail`, `filter-landed`, `redteam-rerun`                                                                                                                                                                                                                                                          |
| Traces          | `traces-page`, `trace-row`, `trace-search`, `trace-filter-all`, `trace-filter-ok`, `trace-filter-errors`, `trace-inspector`, `range-24h`, `range-7d`, `range-30d`, `usage-requests`                                                                                                                                                                                                          |
| Settings / keys | `settings-page`, `settings-project`, `theme-light`, `theme-dark`, `theme-system`, `ci-snippet`, `api-key-create`, `api-key-name`, `api-key-create-submit`, `api-key-value`, `api-key-copy`, `api-key-row`, `api-key-revoke`                                                                                                                                                                  |
| Design system   | `design-page`                                                                                                                                                                                                                                                                                                                                                                                |
