# syntax=docker/dockerfile:1.7
# EvalPilot worker (BullMQ). Build from the repo root:  docker build -f apps/worker/Dockerfile .
ARG NODE_IMAGE=node:20.20.2-bookworm-slim

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

FROM deps AS build
COPY tsconfig.base.json ./
COPY prisma prisma
COPY packages packages
COPY apps/worker apps/worker
RUN npx prisma generate --schema prisma/schema.prisma \
 && npm run build -w @evalpilot/shared \
 && npm run build -w @evalpilot/server-core \
 && npm run build -w @evalpilot/worker

FROM deps AS prod-deps
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @evalpilot/shared -w @evalpilot/server-core -w @evalpilot/worker --include-workspace-root

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
COPY --from=build --chown=node:node /repo/apps/worker/package.json apps/worker/
COPY --from=build --chown=node:node /repo/apps/worker/dist apps/worker/dist
COPY --chown=node:node docker/host-services.sh /usr/local/bin/host-services
USER node
# The worker has no HTTP port; it is healthy while its Redis heartbeat key is fresh.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD host-services node apps/worker/dist/healthcheck.js
ENTRYPOINT ["tini", "--", "host-services"]
CMD ["node", "apps/worker/dist/main.js"]
