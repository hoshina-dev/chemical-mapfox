# chemical-mapfox

Next.js + Mantine application organised as a
[pnpm](https://pnpm.io) + [Turborepo](https://turborepo.com) monorepo,
scaffolded with `create-turbo`.

## Layout

```
chemical-mapfox/
├── apps/
│   └── web/                      # Next.js (App Router) + Mantine app
└── packages/
    ├── ui/                       # @repo/ui — shared React component package
    ├── api-client/               # @repo/api-client — generated custapi REST client
    ├── eslint-config/            # @repo/eslint-config — shared ESLint configs
    └── typescript-config/        # @repo/typescript-config — shared tsconfig presets
```

## Getting started

```bash
pnpm install
pnpm dev          # runs the web app via turbo (on :3000)
```

Run a single app:

```bash
pnpm --filter web dev
```

## Tasks

All tasks are pipelined through Turborepo at the repo root:

| Command             | What it runs                          |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | `next dev` for every app in parallel  |
| `pnpm build`        | `next build` for every app            |
| `pnpm lint`         | ESLint across apps and packages       |
| `pnpm check-types`  | `tsc --noEmit` across the workspace   |
| `pnpm format`       | Prettier across the workspace         |

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

## Tech

- Next.js 16 (App Router, Turbopack)
- React 19, TypeScript 5
- Mantine 9 (`@mantine/core`, `@mantine/hooks`) wired through `postcss-preset-mantine`
- custapi client generated with OpenAPI Generator (`typescript-fetch`)
- pnpm workspaces + Turborepo 2
