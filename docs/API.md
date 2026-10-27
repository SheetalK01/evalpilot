# EvalPilot — API reference

Base URL: `http://localhost:4000/api`. Interactive docs with every schema: **`/api/docs`**
(Swagger, generated from the same zod schemas the API validates with).

## Authentication

| Caller                  | How                                                                                              | Used for                  |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| People (web app)        | `ep_session` cookie (JWT, httpOnly, SameSite=Lax), set by `POST /auth/login` or `/auth/register` | everything except `/v1/*` |
| Machines (SDK, CLI, CI) | `Authorization: Bearer ep_live_…` (project API key)                                              | `/v1/*` only              |

Cookie-authenticated `POST`, `PATCH` and `DELETE` requests must send an allowed `Origin` header
(browsers do this automatically); otherwise **403**. API keys are scoped to one project.

## Conventions

- JSON in and out; ids are cuids; times are ISO 8601 UTC.
- **Lists that grow** are paginated: `?limit=` (1–100, default 20) and `?cursor=`; the response
  is `{ "items": [...], "nextCursor": "…" | null }`.
- **Errors** always look like this:

  ```json
  {
    "statusCode": 400,
    "message": "Validation failed",
    "errors": [{ "path": "passThreshold", "message": "Too big: expected number to be <=1" }],
    "path": "/api/projects/abc/suites",
    "requestId": "3f1c3a9e-5d1b-4a63-9f7e-1a2b3c4d5e6f",
    "timestamp": "2026-10-27T10:00:00.000Z"
  }
  ```

  Every response carries `x-request-id`; quote it when reporting a problem.

- **Ownership:** a resource that belongs to someone else returns **404**, exactly like one that
  does not exist.
- **Rate limits** (per minute, configurable): auth 10 per IP + email, `/v1/*` 1200 per key,
  everything else 300 per IP. Over the limit: **429** with `Retry-After-<bucket>`.
- Body limits: 1 MB JSON, 2 MB CSV.

## Endpoints

### Auth

| Method | Path                                    | Body                                                         | Success                               |
| ------ | --------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| POST   | `/auth/register`                        | `{ name, email, password }` (8+ chars, a letter and a digit) | 201 user + cookie                     |
| POST   | `/auth/login`                           | `{ email, password }`                                        | 200 user + cookie                     |
| POST   | `/auth/logout`                          | —                                                            | 204                                   |
| GET    | `/auth/me`                              | —                                                            | 200 user                              |
| GET    | `/auth/providers`                       | —                                                            | 200 `{ github: boolean }`             |
| GET    | `/auth/github`, `/auth/github/callback` | —                                                            | OAuth redirect (only when configured) |

### Projects, targets, API keys

| Method               | Path                            | Notes                                                                                                       |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET / POST           | `/projects`                     | paginated list / create `{ name, description? }`                                                            |
| GET / PATCH / DELETE | `/projects/:id`                 | delete cascades to everything in the project                                                                |
| GET / POST           | `/projects/:projectId/targets`  | `HTTP` (url, method, headers, bodyTemplate with `{{input}}`, responsePath JSONPath, timeoutMs) or `SHOPBOT` |
| GET / PATCH / DELETE | `/targets/:id`                  | header values are masked in every response                                                                  |
| POST                 | `/targets/:id/ping`             | 200 `{ ok, latencyMs, status, error }`; sent by the worker through the SSRF guard                           |
| GET / POST           | `/projects/:projectId/api-keys` | create returns the raw `key` **once**; lists show the prefix only                                           |
| DELETE               | `/api-keys/:id`                 | 204, revokes (idempotent)                                                                                   |

### Suites and test cases

| Method               | Path                             | Notes                                                                       |
| -------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| GET / POST           | `/projects/:projectId/suites`    | `{ name, description?, targetId?, passThreshold (0–1, default 0.9) }`       |
| GET / PATCH / DELETE | `/suites/:id`                    |                                                                             |
| GET / POST           | `/suites/:suiteId/cases`         | `{ name, input, checks[], tags[] }`, max 500 cases per suite                |
| POST                 | `/suites/:suiteId/cases/reorder` | `{ ids: [...] }` in the new order                                           |
| PATCH / DELETE       | `/cases/:id`                     |                                                                             |
| GET                  | `/suites/:id/export.csv`         | columns `name,input,checks,tags` (checks as JSON)                           |
| POST                 | `/suites/:id/import`             | raw `text/csv` or `{ csv }`; 200 `{ imported, errors: [{ row, message }] }` |

**Checks** (a case passes when all its checks pass):

| type                        | fields                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| `contains` / `not_contains` | `value`, `caseSensitive?`                                                |
| `equals`                    | `value`, `caseSensitive?`                                                |
| `regex`                     | `pattern`, `flags?` (patterns are checked for catastrophic backtracking) |
| `json_schema`               | `schema` (the answer must be JSON matching it)                           |
| `max_length`                | `chars`                                                                  |
| `latency`                   | `maxMs`                                                                  |
| `refusal`                   | `expected: true` (must refuse) or `false` (must answer)                  |
| `llm_judge`                 | `criteria`, `threshold` (minimum score, 1–10)                            |

### Runs

| Method | Path                         | Notes                                                              |
| ------ | ---------------------------- | ------------------------------------------------------------------ |
| POST   | `/suites/:suiteId/runs`      | **202** `{ runId, status: "QUEUED" }`                              |
| GET    | `/suites/:suiteId/runs`      | paginated history                                                  |
| GET    | `/runs/:id`                  | status, totals, pass rate, cost, p95 latency                       |
| GET    | `/runs/:id/results`          | per case: output, latency, tokens, each check's verdict and reason |
| POST   | `/runs/:id/cancel`           | stops before the next case                                         |
| GET    | `/runs/:id/compare/:otherId` | per-case diff: fixed, regressed, unchanged, added, removed         |

### Red-team

| Method | Path                                | Notes                                                                   |
| ------ | ----------------------------------- | ----------------------------------------------------------------------- |
| GET    | `/attacks`                          | the attack library (26 attacks, 6 categories)                           |
| POST   | `/targets/:targetId/redteam`        | `{ categories? }` → **202** `{ redteamRunId }`                          |
| GET    | `/projects/:projectId/redteam-runs` | paginated                                                               |
| GET    | `/redteam-runs/:id`                 | report: risk score + level, per-category scores, findings with evidence |

### Traces and usage

| Method | Path                          | Notes                 |
| ------ | ----------------------------- | --------------------- |
| GET    | `/projects/:projectId/traces` | `?status=OK           | ERROR&search=` (name, model, input), newest first |
| GET    | `/traces/:id`                 | full input and output |
| GET    | `/projects/:projectId/usage`  | `?range=24h           | 7d                                                | 30d`: totals and buckets (requests, errors, p95, tokens, cost) |

### Dashboard and health

| Method | Path         | Notes                                                                        |
| ------ | ------------ | ---------------------------------------------------------------------------- |
| GET    | `/dashboard` | readouts, pass-rate trend, latest risk, recent runs, 14-day cost and latency |
| GET    | `/health`    | public; `{ status, checks: { api, db, redis, worker } }`                     |

### Machine API (`/v1`, API key)

| Method | Path                       | Notes                                                                                                     |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/traces`               | one trace or `{ traces: [...] }` (≤ 100) → **202** `{ accepted }`; duplicates by `externalId` are ignored |
| POST   | `/v1/suites/:suiteId/runs` | `{ commitSha? }` → **202** `{ runId }` (the CLI)                                                          |
| GET    | `/v1/runs/:id`             | run with results, for CI gates                                                                            |

```bash
curl -X POST http://localhost:4000/api/v1/traces \
  -H "Authorization: Bearer $EVALPILOT_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"chat","input":"Where is my order?","output":"It shipped.","latencyMs":420,"model":"claude-opus-5-5"}'
```

## Realtime (Socket.IO)

Connect to `ws://localhost:4000/realtime` with the session cookie, then join rooms with an ack:

```ts
const socket = io('http://localhost:4000/realtime', { withCredentials: true });
const ack = await socket.emitWithAck('room.join', { room: `run:${runId}` }); // { ok: true } | { ok: false, error }
socket.on('result.created', ({ result }) => …);
socket.on('run.progress', ({ done, total }) => …);
socket.on('run.completed', ({ run }) => …);
```

| Room           | Events                                            |
| -------------- | ------------------------------------------------- |
| `run:<id>`     | `run.progress`, `result.created`, `run.completed` |
| `redteam:<id>` | `redteam.finding`, `redteam.completed`            |
| `project:<id>` | `trace.created`                                   |

Rooms of other users answer `{ ok: false, error: "Not found" }`.
