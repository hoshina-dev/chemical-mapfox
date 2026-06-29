# Self-contained acceptance-test runner.
#
# Builds the whole monorepo into an image whose default command runs the
# CucumberJS + Playwright suite. The suite is fully self-contained: it boots its
# own Next.js dev server and an in-process backend stub, so no external services
# are required (collaborative editing uses an in-memory Redis mock via
# E2E_REDIS_MOCK=1 — see apps/web/src/lib/redis/mock-client.ts).
#
# Based on the official Playwright image so the browser + system libraries match
# the `playwright` npm version (1.61.0) with no extra setup.
FROM mcr.microsoft.com/playwright:v1.61.0-noble

ENV CI=1 \
    HEADLESS=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Copy the monorepo (see Dockerfile.dockerignore) and install all workspaces.
COPY . .
RUN pnpm install --config.confirmModulesPurge=false

# Guarantee the exact matching Chromium build is present.
RUN pnpm --filter @repo/e2e exec playwright install chromium

WORKDIR /repo/e2e

# Run Cucumber directly (skip the `pretest` browser install — already done).
CMD ["node", "--import", "tsx", "./node_modules/@cucumber/cucumber/bin/cucumber.js"]
