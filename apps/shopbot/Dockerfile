# syntax=docker/dockerfile:1.7
# ShopBot demo target. Build from the repo root:  docker build -f apps/shopbot/Dockerfile .
ARG NODE_IMAGE=node:20.20.2-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
# npm 10.8 (bundled with Node 20) drops dependencies that have overrides; npm 11 does not.
RUN npm install -g npm@11.21.1 --no-audit --no-fund
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
COPY packages packages
COPY apps/shopbot apps/shopbot
RUN npm run build -w @evalpilot/shared \
 && npm run build -w @evalpilot/sdk \
 && npm run build -w @evalpilot/shared -w @evalpilot/sdk -w @evalpilot/shopbot

FROM deps AS prod-deps
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @evalpilot/shared -w @evalpilot/sdk -w @evalpilot/shopbot

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
COPY --from=prod-deps --chown=node:node /repo/node_modules node_modules
COPY --from=build --chown=node:node /repo/packages/shared/package.json packages/shared/
COPY --from=build --chown=node:node /repo/packages/shared/dist packages/shared/dist
# Versions that differ from the hoisted ones live next to the package (e.g. ajv for shared).
COPY --from=prod-deps --chown=node:node /repo/packages/shared/node_modules packages/shared/node_modules
COPY --from=build --chown=node:node /repo/packages/sdk/package.json packages/sdk/
COPY --from=build --chown=node:node /repo/packages/sdk/dist packages/sdk/dist
COPY --from=build --chown=node:node /repo/apps/shopbot/package.json apps/shopbot/
COPY --from=build --chown=node:node /repo/apps/shopbot/dist apps/shopbot/dist
USER node
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.SHOPBOT_PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["tini", "--"]
CMD ["node", "apps/shopbot/dist/main.js"]
