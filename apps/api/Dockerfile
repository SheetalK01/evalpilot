# syntax=docker/dockerfile:1.7
# EvalPilot API. Build from the repo root:  docker build -f apps/api/Dockerfile -t evalpilot-api .
ARG NODE_IMAGE=node:20.20.2-bookworm-slim

# ── deps: install the whole workspace once (lockfile-exact) ─────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
# npm 10.8 (bundled with Node 20) drops dependencies that have overrides; npm 11 does not.
RUN npm install -g npm@11.21.1 --no-audit --no-fund
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server-core/package.json packages/server-core/
COPY packages/sdk/package.json packages/sdk/
COPY packages/cli/package.json packages/cli/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/shopbot/package.json apps/shopbot/
COPY apps/web/package.json apps/web/
COPY contracts/package.json contracts/
COPY e2e/package.json e2e/
RUN npm ci --ignore-scripts --no-audit --no-fund

# ── build: compile shared packages, the API and the seed script ─────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY prisma prisma
COPY packages packages
COPY apps/api apps/api
RUN npx prisma generate --schema prisma/schema.prisma \
 && npm run build -w @evalpilot/shared \
 && npm run build -w @evalpilot/server-core \
 && npm run build -w @evalpilot/api \
 && npx esbuild prisma/seed.ts --bundle --platform=node --target=node20 --format=cjs \
      --external:@prisma/client --external:bcryptjs --outfile=prisma/seed.cjs

# ── prod-deps: runtime dependencies only ────────────────────────────────────
FROM deps AS prod-deps
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @evalpilot/shared -w @evalpilot/server-core -w @evalpilot/api --include-workspace-root \
 && npm install --no-save --ignore-scripts --no-audit --no-fund prisma@6.19.3

# ── runtime ─────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini && rm -rf /var/lib/apt/lists/*
COPY --from=prod-deps --chown=node:node /repo/node_modules node_modules
COPY --from=build --chown=node:node /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build --chown=node:node /repo/packages/shared/package.json packages/shared/
COPY --from=build --chown=node:node /repo/packages/shared/dist packages/shared/dist
# Versions that differ from the hoisted ones live next to the package (e.g. ajv for shared).
COPY --from=prod-deps --chown=node:node /repo/packages/shared/node_modules packages/shared/node_modules
COPY --from=build --chown=node:node /repo/packages/server-core/package.json packages/server-core/
COPY --from=build --chown=node:node /repo/packages/server-core/dist packages/server-core/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json apps/api/
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /repo/prisma/schema.prisma /repo/prisma/seed.cjs prisma/
COPY --from=build --chown=node:node /repo/prisma/migrations prisma/migrations
COPY --chown=node:node docker/host-services.sh /usr/local/bin/host-services
COPY --chown=node:node docker/api-entrypoint.sh /usr/local/bin/api-entrypoint
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["tini", "--", "host-services", "api-entrypoint"]
