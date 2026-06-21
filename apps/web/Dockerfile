# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/forms/package.json packages/forms/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter web build

FROM node:24-alpine AS runner
WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder --chown=nextjs:nextjs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /repo/apps/web/public ./apps/web/public

USER nextjs
WORKDIR /app/apps/web
EXPOSE 3000

CMD ["node", "server.js"]
