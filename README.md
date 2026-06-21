# chemical-mapfox

Next.js + Mantine application organised as a
[pnpm](https://pnpm.io) + [Turborepo](https://turborepo.com) monorepo,
scaffolded with `create-turbo`.

## Layout

```
chemical-mapfox/
├── apps/
│   └── web/                      # Next.js (App Router) + Mantine app
│                                 #   /internal/docs — component reference for form authors
└── packages/
    ├── forms/                    # @repo/forms — JSON/Zod form schema + Mantine renderer
    ├── ui/                       # @repo/ui — shared React component package
    ├── api-client/               # @repo/api-client — generated custapi REST client
    ├── eslint-config/            # @repo/eslint-config — shared ESLint configs
    └── typescript-config/        # @repo/typescript-config — shared tsconfig presets
```

### `@repo/forms` and the docs section

`@repo/forms` carries the form **schema** and **renderer** for JSON-driven lab
forms. Its `experiment-template.schema.json` (JSON Schema) is the **source of
truth** matched by the backend; the Zod schemas in `src/schema.ts` are
hand-written to mirror it and kept in sync manually — accepted tech debt since
the schema rarely changes. See [`packages/forms/README.md`](packages/forms/README.md).

The web app's **`/internal/docs`** section imports the components and schema from
`@repo/forms` to render a component reference for lab technicians building forms
(one page per question type, with a live preview and the generated schema
fields). It lives under `apps/web/src/app/internal/docs/` and is gated by the
same auth middleware as the rest of the app.

## Getting started

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Redis on :6379 (see below)
pnpm dev          # runs the web app via turbo (on :3000)
```

Run a single app:

```bash
pnpm --filter web dev   # docs are at http://localhost:3000/internal/docs
```

### Redis (collaborative editing)

The staff experiment workspace supports **live collaborative editing** of the lab
form (presence, soft field locks, autosave) backed by Redis. `docker-compose.dev.yml`
provides a local Redis; set `REDIS_URL` (see `apps/web/.env.example`). Architecture:
[`docs/collaborative-editing.md`](docs/collaborative-editing.md).

## Tasks

All tasks are pipelined through Turborepo at the repo root:

| Command             | What it runs                          |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | `next dev` for every app in parallel  |
| `pnpm build`        | `next build` for every app            |
| `pnpm lint`         | ESLint across apps and packages       |
| `pnpm check-types`  | `tsc --noEmit` across the workspace   |
| `pnpm format`       | Prettier across the workspace         |
| `pnpm --filter web test` | Vitest unit + browser-mode component tests |

Scope a task to one package with `pnpm --filter <name> <task>`, e.g.
`pnpm --filter web check-types`.

## custapi integration

`chemical-mapfox` talks to [custapi](../custapi) (users & organizations) server-side
only, following the same BFF pattern as `form-poc`.

- **`@repo/api-client`** holds the `typescript-fetch` client generated from custapi's
  OpenAPI/Swagger doc. Regenerate it with `pnpm --filter @repo/api-client codegen`
  (set `CUSTAPI_DOC_URL` to override the source; generation is skipped if the server
  is unreachable). The generated `src/custapi/**` is committed and marked
  `linguist-generated`.
- **`apps/web/src/lib/custapi/client.ts`** is a `server-only` module that builds the
  configured `usersApi` / `organizationsApi` singletons. The base URL comes from
  `CUSTAPI_URL` (see `apps/web/.env.example`).

### Local development & integration testing

There is no local custapi mock — point `CUSTAPI_URL` at the **custapi QA environment**:

```bash
cp apps/web/.env.example apps/web/.env.local
# edit CUSTAPI_URL to the QA base URL, e.g. http://custapi.qa.../api/v1
pnpm --filter web dev
```

## Deployment

`.github/workflows/deploy.yml` builds `apps/web/Dockerfile` from the repository
root for `linux/amd64` and `linux/arm64` on every push to `main` (and via
`workflow_dispatch`), then pushes the multi-arch image to
`ghcr.io/<owner>/chemical-mapfox-web` (tagged `latest` and the short commit SHA).
The app runs the Next.js `output: "standalone"` Node server on port `3000`.

At runtime supply the env vars from [`apps/web/.env.example`](apps/web/.env.example) —
notably `JWT_SECRET` (required) and `REDIS_URL` (collaborative editing). Per the
BFF pattern, all backend URLs are server-side only.

Build and run the image locally from the repository root:

```bash
docker build -f apps/web/Dockerfile -t chemical-mapfox-web .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET=dev-secret \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  chemical-mapfox-web
```

## Tech

- Next.js 16 (App Router, Turbopack)
- React 19, TypeScript 5
- Mantine 9 (`@mantine/core`, `@mantine/hooks`) wired through `postcss-preset-mantine`
- custapi client generated with OpenAPI Generator (`typescript-fetch`)
- Redis (`ioredis`) backing collaborative lab-form editing (SSE + pub/sub)
- Vitest (unit + browser mode) for the collaborative-editing layer
- pnpm workspaces + Turborepo 2
