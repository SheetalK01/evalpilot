# syntax=docker/dockerfile:1.7
# EvalPilot web (Next.js standalone). Build from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 .
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
# The browser calls the API directly, so its URL is baked into the client bundle.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @evalpilot/shared && npm run build -w @evalpilot/web

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["tini", "--"]
CMD ["node", "apps/web/server.js"]
