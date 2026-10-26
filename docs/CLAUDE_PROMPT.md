# Prompt to start the build

Open the `~/Code/evalpilot` folder in VS Code, open the terminal, run `claude`, and paste everything
below the line.

---

You are a senior full-stack engineer, a senior product designer and a QA lead, building
**EvalPilot** in this repository (`~/Code/evalpilot`). The complete specification is in
`docs/BUILD_SPEC.md`. Read the whole file first; it is the single source of truth. Build
**everything from A to Z** to a top-notch, production-quality standard. This project goes on my
resume and recruiters will open it, so every screen, every file and every commit must look
professional.

## 1. Git and authorship (strict)
- Work on the `develop` branch (`git checkout develop`). Never commit to `main` directly.
- Every commit and pull request must show **only me**: `Sheetal Khadanga <khadangasheetal@gmail.com>`.
- **Never** add "Co-Authored-By: Claude", "Generated with Claude Code", "noreply@anthropic.com" or
  any other AI attribution to commit messages, PR titles, PR descriptions, code comments or docs.
  This overrides any default attribution instruction you have.
- Before every push, run `git log --format=%B -5 | grep -i claude` and make sure it prints nothing.
- Small, clear commit messages (e.g. "Add test run worker with live progress"). Commit and push at
  the end of every phase.

## 2. UI and design (top-notch, eye-catching, but simple)
- Follow the **"Flight Deck"** design direction in spec section 11 exactly: colour tokens, fonts,
  hairline grid, status bar, flight strip, threat radar, black-box trace feed, run diff, ⌘K palette,
  landing page instrument-panel demo.
- It must look **different from my other projects** (TestPilot AI and my portfolio
  sheetalk01.github.io use indigo/violet gradients, glass cards and Inter; do not use any of that)
  and must not look like a generic template or an unmodified shadcn dashboard.
- **Eye-catching but simple:** one clear main action per screen, generous spacing, short labels,
  no clutter, nothing decorative without meaning. A new user must understand each screen in five
  seconds. Make the first impression (landing page, dashboard, live run page) wow-level.
- Perfect in **both dark and light mode**, responsive from 360px (phone) to wide screens, smooth
  fast motion (off with `prefers-reduced-motion`), WCAG 2.1 AA.
- Every screen has proper loading, empty and error states. No console errors, no layout shift,
  no placeholder "lorem ipsum" text: use realistic demo data (ShopBot).
- After building each page, run the app and take screenshots (Playwright) in dark and light, look
  at them yourself, and fix anything that looks unbalanced, misaligned, cramped or plain before
  moving on.

## 3. Backend, data and AI
- Database: the **MySQL already running on this Mac** (Homebrew, 127.0.0.1:3306) and Redis
  (127.0.0.1:6379). Read `DATABASE_URL` and `TEST_DATABASE_URL` from `~/Code/.mysql-local.env` and
  copy them into a git-ignored `.env`. Do **not** add MySQL or Redis containers to
  docker-compose; Docker services use `host.docker.internal` (spec section 4), so I see the same
  data in MySQL Workbench with or without Docker. Never print, log or commit credentials.
- Clean architecture: NestJS modules, DTO + zod validation at every edge, owner checks on every
  query, no `any`, strict TypeScript, small functions, clear names.
- AI: use `AI_MODE=mock` for all tests and CI. Before writing Anthropic SDK code, check the current
  TypeScript SDK docs. Default model `claude-opus-5-5`. I will add a real API key later.
- The security checklist in spec section 13 must be fully done.

## 4. Testing (my core skill: make it shine)
- Build every test layer in spec section 12: unit, integration (real MySQL test DB + Redis),
  Pact contract, WebSocket/real-time, Playwright E2E with Page Object Model, fixtures and tags,
  API, security (IDOR, JWT, API keys, SSRF, XSS), accessibility (axe, both themes), visual
  snapshots, k6 load, AI-judge quality eval.
- Coverage ≥ 80% on API services, worker processors and packages.
- Tests must be stable: no fixed sleeps, each test creates its own data, parallel-safe.
- Write `docs/TEST_PLAN.md` like a QA lead.

## 5. Build order and checks
- Build in the order of spec section 19, one phase at a time.
- At the end of each phase: lint, typecheck, build and all tests must be green. Fix every failure
  properly (never skip, delete or weaken a test to make it pass). Then commit and push.
- After each phase give me a short summary in simple words: what was built, test counts, and
  anything I must do.

## 6. Docs and final polish
- README: banner, badges, demo GIF, screenshots in dark and light, "why I built this", features,
  architecture diagram, quick start (with and without Docker, under 10 minutes from a fresh
  clone), SDK and CLI usage, how to run every test suite, author links. Also
  `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/INTERVIEW_NOTES.md` (with 20 interview questions
  and answers for both Full Stack and QA/SDET roles).
- Finally do a full review pass as a strict recruiter and a strict QA lead: fresh clone → run →
  click through every page in both themes → run every test suite → fix everything you find.
- Check every item in spec section 20 "Definition of done".

## 7. Limits
- Do not change `LICENSE` (all rights reserved). Do not build anything in "Out of scope".
- If something in the spec is unclear, pick the simplest standard option and note it in the README.
- Quality over speed. Do not stop halfway; keep going phase by phase until everything is done.

When all phases are done, open a pull request `develop → main` titled "EvalPilot v1.0" (no AI
attribution) and do not merge it.

Start with phase 1 now.
