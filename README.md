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

## Author

**Sheetal Khadanga** — QA Engineer
[LinkedIn](https://www.linkedin.com/in/sheetal-khadanga) ·
[GitHub](https://github.com/SheetalK01) ·
[Portfolio](https://sheetalk01.github.io)

## License

Copyright © 2026 Sheetal Khadanga. All rights reserved. See [LICENSE](LICENSE).
