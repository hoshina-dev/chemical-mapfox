# AGENTS.md

Conventions and gotchas for working in this repo (pnpm + Turborepo monorepo:
Next.js App Router + Mantine, with shared `@repo/*` packages).

## ⚠️ Mantine + React Server Components

**Mantine components are Client Components.** A Server Component (the default in
the App Router — any `page.tsx`/`layout.tsx` without `"use client"`, especially
`async` ones) may _render_ Mantine components, but must **never pass a
function-valued prop across the server→client boundary**. Doing so throws at
runtime:

> Functions cannot be passed directly to Client Components unless you explicitly
> expose it by marking it with "use server".

The most common offender is the polymorphic **`component={Link}`** prop (and
event handlers like `onClick`) on Mantine elements (`Button`, `Anchor`, `Card`,
`NavLink`, …) — `Link` is a function, so it cannot be handed to a Mantine client
component from a server component.

**Do:**

- Use the shared client wrappers in `apps/web/src/components/links.tsx`
  (`LinkButton`, `LinkAnchor`) which keep `component={Link}` on the client side.
  Server Components pass only serializable props (`href`, strings, …).
- Or extract the interactive piece into its own `"use client"` component (e.g.
  `components/admin/AdminNav.tsx`).
- Or wrap with Next's `<Link>` directly (`<Link href><Card …/></Link>`) when a
  plain anchor wrapper is acceptable.

**Don't:** write `<Button component={Link} …>` / `<Card component={Link} …>` /
`onClick={…}` directly inside a Server Component.

Rule of thumb: if a Mantine element needs `component={Link}`, an `onClick`, or
any other function prop, that element belongs in a `"use client"` component.

## Schema source of truth

`packages/forms/experiment-template.schema.json` (JSON Schema) is the source of
truth the backend matches. The Zod schemas in `packages/forms/src/schema.ts`
are hand-written to mirror it and kept in sync **manually** (accepted tech debt
— the schema rarely changes). Change one, change the other. See
`packages/forms/README.md`.

## Routes (current & planned)

The full route map — client-facing and staff (`/internal/*`), with what's
implemented vs. planned — is in [`docs/routes.md`](docs/routes.md). Check it
before adding or moving a page.

## Access control

`/internal/*` is admin-only. It's gated by the middleware (`apps/web/src/proxy.ts`)
**and** a server-side backstop layout (`apps/web/src/app/internal/layout.tsx`
via `requireAdmin()`). App role mapping: mapfox `admin` ⇒ lab `technician`,
everyone else ⇒ `client` (`apps/web/src/lib/auth/appRole.ts`).

## API clients

`@repo/api-client` holds generated clients (custapi, ticketing) and
experiment-manager types (`experiment-manager.d.ts`, used as the
`ExperimentManager.*` type namespace). Regenerate with
`pnpm --filter @repo/api-client codegen` (runs via `pnpm dlx`; skips services
that are unreachable). Generated dirs are committed and excluded from eslint.

## Collaborative editing (staff workspace)

The lab-form tab of `/internal/experiment/{contextId}` is a live multi-staff editor
(SSE + POST + Redis pub/sub, all in `apps/web` — no new service). Requires `REDIS_URL`
(local Redis via `docker compose -f docker-compose.dev.yml up -d`). Identity is keyed
by a per-tab `connectionId` (distinct from `userId`); locks are advisory + last-write-wins;
clearing a field sends explicit `null`. Full design + key files:
[`docs/collaborative-editing.md`](docs/collaborative-editing.md).

## Known backend issues / workarounds

Open issues in the `experiment-manager` backend (with the frontend workarounds
that should be removed once each is fixed) are tracked in
[`docs/experiment-manager-issues.md`](docs/experiment-manager-issues.md). Check
it before adding new client-side patches for backend quirks.

## Design context (Impeccable)

UI design work for the web app is governed by Impeccable context files under
`apps/web/`:

- [`apps/web/PRODUCT.md`](apps/web/PRODUCT.md) — register (`product`), users,
  brand personality, anti-references, strategic design principles.
- [`apps/web/DESIGN.md`](apps/web/DESIGN.md) — visual tokens, typography,
  components, elevation, do's/don'ts (Mantine 9 + ChemFox staff/client shells).

Run Impeccable commands scoped to the web app, e.g.
`node .agents/skills/impeccable/scripts/context.mjs --target apps/web`.

## Before you finish

Run from the repo root: `pnpm check-types` and `pnpm lint` (Turborepo pipelines
every workspace). For app-facing changes, `pnpm --filter web build`. For the
collaborative-editing layer, `pnpm --filter web test:coverage` (browser tests
need a one-time `pnpm --filter web exec playwright install chromium`; CI runs
the same suite via `.github/workflows/ci.yml`).
