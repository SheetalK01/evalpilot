# Prompt to start the build

Open a terminal in `~/Code/evalpilot`, start Claude Code, and paste everything below the line.

---

You are building **EvalPilot** in this repository (`~/Code/evalpilot`). The complete specification is
in `docs/BUILD_SPEC.md`. Read the whole file first; it is the single source of truth.

Rules:
1. Work on the `develop` branch (`git checkout develop`). Never commit to `main` directly.
2. Build in the order of section 19, one phase at a time. At the end of each phase run lint,
   typecheck and all tests; fix everything until green; then commit with a clear message and push.
3. **Commits and pull requests must NOT contain "Co-Authored-By: Claude", "Generated with Claude
   Code" or any other AI attribution.** The author is only `Sheetal Khadanga <khadangasheetal@gmail.com>`.
4. UI: follow the "Flight Deck" design direction in spec section 11 exactly. It must not look like a
   generic template or like TestPilot AI. Polish every screen in both themes.
5. Database: use the **MySQL already running on this Mac** (Homebrew, 127.0.0.1:3306) and Redis
   (127.0.0.1:6379). Read `DATABASE_URL` and `TEST_DATABASE_URL` from `~/Code/.mysql-local.env` and
   copy them into a git-ignored `.env`. Do **not** add MySQL or Redis containers to docker-compose;
   Docker services use `host.docker.internal` (spec section 4). Never print, log or commit credentials.
6. Use `AI_MODE=mock` for all tests and CI. Before writing Anthropic SDK code, check the current
   TypeScript SDK docs. Default model: `claude-opus-5-5`.
7. Do not change `LICENSE` (all rights reserved). Do not build anything in "Out of scope".
8. Quality over speed. If something in the spec is unclear, pick the simplest standard option and
   note it in the README.
9. Give me a short summary after each phase: what was built, test counts, anything I must do.
10. When all phases are done, open a pull request `develop → main` titled "EvalPilot v1.0"
   (no AI attribution) and do not merge it.

Start with phase 1 now.
