# EvalPilot — Interview notes

Twenty questions I expect about this project, with the answers I would give. Ten lean
Full Stack, ten lean QA / test automation.

## Full Stack

**1. In one minute: what is EvalPilot?**
A test harness for LLM chatbots. You point it at your bot's HTTP endpoint, write test cases
with checks (contains, regex, JSON schema, latency, refusal, LLM-as-judge), and run them from the
UI or from CI with a CLI that fails the build below a pass-rate threshold. It also red-teams the
bot with 26 attacks and gives a risk score, and an SDK sends production traces that show up
live. Stack: Next.js, NestJS, BullMQ on Redis, Prisma on MySQL, Socket.IO.

**2. Why a separate worker instead of doing the work in the API?**
A run calls a slow, unreliable third party (the bot) and maybe an LLM judge for every case. Doing
that in a request would tie up the API and time out. So the API writes a `QUEUED` run, adds a
BullMQ job and returns `202` with the run id. The worker scales on its own, retries on its own,
and is the only process that makes outbound calls, so the SSRF guard lives in one place. The
API's own p95 stays in single-digit milliseconds.

**3. How do live results reach the browser?**
The worker publishes events to a Redis channel. Each API instance relays them to Socket.IO rooms
(`run:<id>`, `redteam:<id>`, `project:<id>`). The browser joins a room with an ack, and the
gateway checks ownership on every join. Because Redis sits in the middle, any API instance can
serve any socket, and the worker never needs to know who is connected.

**4. Cases run 4 at a time. How are events still in order?**
Results finish in any order, so the worker sends every event for a run through a small serial
queue (`apps/worker/src/serial.ts`). Progress is always 0, 1, 2… and `run.completed` is always
last. There is a Playwright test that checks this against a real worker run, not a mock.

**5. How do you share types between front end, back end, SDK and CLI?**
`packages/shared` holds zod schemas. The API validates bodies with them through nestjs-zod, which
also generates Swagger. The web forms use the same schemas through react-hook-form. The SDK has
zero dependencies, so it declares its own types, but a compile-time check fails if they drift
from the shared ones. Pact contracts guard the wire format on top of that.

**6. How does authentication work, and why two kinds?**
People get a JWT in an httpOnly, SameSite=Lax cookie; JavaScript can't read it, and mutations
also need an allowed `Origin`, which covers CSRF. Machines (SDK, CLI) use a project API key in
`Authorization: Bearer`. Keys are random, stored as SHA-256 hashes, shown once and revocable. The
CSRF check is skipped on key routes because they never read cookies.

**7. How do you stop one user from seeing another user's data?**
Every service method takes the current user and scopes the query through the project's owner.
Someone else's resource returns 404, exactly like a missing one, so ids can't be probed.
Integration tests check it per resource, and one E2E test hits 26 endpoints as an intruder and
then checks nothing changed. WebSocket joins use the same rule.

**8. A user can type any URL as a target. Isn't that SSRF?**
Yes, so the guard runs at connect time: a custom DNS lookup rejects private, loopback,
link-local (including 169.254.169.254), CGNAT and the IPv6 equivalents, including IPv4-mapped
and NAT64 forms. Because it checks the resolved address, DNS rebinding doesn't help. Redirects
are refused, and only http(s) is allowed. The built-in ShopBot is exempt because its URL comes
from server config, not user input.

**9. How are target secrets (API keys in headers) handled?**
They are encrypted at rest with AES-256-GCM using `TARGET_SECRET_KEY`, decrypted only in the
worker when it calls the target, and masked in every API response (last 4 characters at most).
pino redacts authorization headers in logs. A security test scans responses for the raw value.

**10. What would you change to run this at 100× scale?**
Usage charts aggregate traces in memory per request; I'd move that to SQL `GROUP BY` or an
hourly rollup table. Traces would get partitioning by month and a retention job. I'd run several
workers and give red-team jobs their own queue so they can't starve test runs. Sessions are
already stateless, and Redis pub/sub already lets the API scale out.

## QA / Test automation

**11. Walk me through your test strategy.**
A pyramid. About 520 unit tests on pure logic (check evaluators, risk score, cost, CSV, SSRF
rules, SDK retry). About 200 integration tests against real MySQL and Redis for the API's rules.
Pact contracts for the SDK, CLI and web against the compiled API. 77 Playwright tests for what
needs a running system (journeys, live updates, cookies, XSS, axe, visuals). k6 for the
performance targets. `docs/TEST_PLAN.md` maps every case to its spec file.

**12. Why real MySQL in integration tests instead of mocks or SQLite?**
The bugs I care about live at the boundary: unique constraints, cascade rules, collation
(case-insensitive search), JSON columns, transactions. SQLite or a mocked Prisma would pass where
MySQL fails. The test database is reset by migrations plus truncation, and the reset script
refuses any database whose name doesn't end in `_test`.

**13. How do you keep Playwright tests independent and parallel-safe?**
Each test registers its own user through the API (unique email) and builds its data through the
API, not the UI, so it's fast and isolated. Only the journey under test uses the UI. Read-only
suites (axe, visual) share one populated workspace per worker through a worker-scoped fixture.
The stack has its own ports, database and Redis prefix, so it runs next to the dev stack.

**14. How do you avoid flaky tests?**
No fixed sleeps anywhere: tests wait for UI state, use `expect.poll` against the API, or wait for
socket events. Where a race is inherent (joining a room after a run starts), the test fills the
gap from the REST API instead of hoping for good timing. CI retries once, and a test that needed
the retry counts as a flake to fix, not a pass. Traces and videos are kept on failure.

**15. Why both Pact and Playwright API tests? Isn't that duplication?**
They answer different questions. Pact asks "does the provider still give each consumer what it
relies on?", written from the consumer's side, so a breaking change fails before deployment.
Playwright API tests check the provider's own promises: status codes, error format, pagination,
rate limits, CSRF, validated against the shared zod schemas. Pact doesn't care about 429s; my
API tests do.

**16. How do you test something non-deterministic like an LLM?**
Two layers. In CI, `AI_MODE=mock`: a deterministic keyword judge and a deterministic ShopBot, so
tests are repeatable and free. The real judge is measured separately: `scripts/judge-eval.ts`
runs a labelled set and reports agreement with humans and self-consistency across repeats, with
an 80% gate in live mode. The mock baseline is 58%, which is the honest argument for the real
judge.

**17. What did your accessibility testing find?**
axe runs on 14 pages in both themes, and the build fails on any serious or critical issue. It
found four real ones: the logo link's accessible name didn't contain its visible text, same for
the account menu, scrollable code blocks weren't keyboard-focusable, and the light-theme "pass"
green was 4.33:1 on its tinted background, just under 4.5:1. All are fixed and now guarded.

**18. How do you handle visual regression without flakiness?**
Reduced motion, fixed viewport, and masks over anything that legitimately changes between runs
(clocks, relative times, charts, health LEDs). Baselines are per platform because font rendering
differs between macOS and Linux; CI records missing Linux baselines on its first run and uploads
them as an artifact to review and commit.

**19. Tell me about a bug your automation caught.**
CSV export worked when I clicked it by hand but failed in Playwright: the download never
started. The code created a blob URL, clicked a detached link and revoked the URL right away.
Chromium sometimes cancels the download when that happens. The fix was to attach the link and
revoke the URL a second later. Without the E2E test this would have been an intermittent
"export sometimes does nothing" bug report.

**20. What are your load test results and what do they prove?**
Trace ingestion at a constant 200 requests/s for 60 s: 12,001 requests, p95 3.1 ms, 0% errors
(target: p95 < 300 ms, < 1% errors). 20 runs started at once all finished, with a p95 of 1.5 s
end to end. It shows the "never block the request path" design works: ingestion is one indexed
insert plus a publish, and runs queue instead of piling up. A 10 s smoke version runs in CI.
