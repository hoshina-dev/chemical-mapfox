FROM node:24-alpine
WORKDIR /repo
ENV CI=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/forms/package.json packages/forms/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY e2e/package.json e2e/package.json
RUN pnpm install --frozen-lockfile
COPY e2e/features/support e2e/features/support
COPY e2e/scripts/catalogue-preview.ts e2e/scripts/catalogue-preview.ts
WORKDIR /repo/e2e
USER node
CMD ["node", "--import", "tsx", "scripts/catalogue-preview.ts"]
