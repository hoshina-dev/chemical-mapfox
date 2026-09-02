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

## Internationalization (i18n)

The web app uses **`next-intl`** with **no locale URL prefixes**. Locales:
`en`, `pl`. English is the **message catalog source of truth**, merge fallback,
and default when `Accept-Language` matches nothing. Preference is the
`NEXT_LOCALE` cookie (set by `apps/web/src/proxy.ts` from `Accept-Language` on
first visit; changed via `setLocaleAction` + `LanguageSwitcher`). Config:
`apps/web/src/i18n/` (`config.ts`, `request.ts`, `mergeMessages.ts`).

### Message catalogs

- **Source of truth:** `apps/web/messages/en.json` — every user-facing string
  belongs here first.
- **Translations:** `apps/web/messages/pl.json` must mirror the **same nested
  key tree**. Incomplete locales are deep-merged onto English at runtime
  (`mergeMessages`), but **do not rely on that** — when you add or change a
  key, update **both** files in the same change.
- Top-level namespaces (pick the closest; add a nested group rather than a new
  top-level unless nothing fits): `meta`, `common`, `landing`, `auth`, `status`,
  `experiment`, `staff`, `builder`, `pdfEditor`, `docs`, `forms`.

### When adding or changing UI copy

1. **No hardcoded English** in JSX, alerts, buttons, placeholders, `aria-label`s,
   `confirm()`, Zod/`message:` validation, or server-action user errors.
2. Add the key to `en.json`, then an accurate `pl` translation (same
   placeholders and ICU shape).
3. Wire the UI:
   - Client components: `useTranslations("namespace")` from `next-intl`.
   - Server Components / server actions: `getTranslations("namespace")` from
     `next-intl/server`.
4. Prefer existing keys under `common.*` (cancel, copy, save, emDash, …) over
   duplicating shared chrome.

### ICU / rich text

- Interpolation: `{name}`, `{count}`, `{brand}`, … — keep placeholder names
  identical across locales.
- Counts: use ICU plurals, e.g.
  `"{count, plural, one {# method} other {# methods}}"`. Polish may use
  `one`/`few`/`many`/`other` — preserve a valid plural block.
- Embedding React (e.g. `<LocalDateTime />`): use **rich-text tags** in the
  message (`"… <date></date> …"`) and `t.rich("key", { date: () => <… /> })`.
  Do **not** pass a raw React element as a `{date}` value.
- Literal braces in copy (e.g. `{{variables}}`) must be ICU-escaped:
  `'{{'variables'}}'`.

### Do not translate

- Brand / legal names, emails, phones, street addresses (unless the catalog
  already localizes a related label).
- ISO / accreditation codes (`ISO/IEC 17025`, `GLP`, …).
- Backend/API content (ticket titles, template question labels, org names).
- Technical identifiers and code (`clientForm`, formula examples, schema field
  names shown as code).

### Tests

`apps/web/test/render.tsx` wraps RTL in `NextIntlClientProvider` with English
messages. Prefer that helper for component tests. Mock
`@/app/actions/locale` / `next/navigation` if the tree includes
`LanguageSwitcher`.

**Acceptance / Cucumber e2e (`e2e/`):** assert against **English** UI copy only
(Gherkin steps and Playwright locators use `en.json` strings). Do not write
locale-parameterized scenarios or assert Polish labels in e2e — **except**
the dedicated language-switch feature (`e2e/features/i18n/`), which must verify
localized copy and the `NEXT_LOCALE` cookie. Locale coverage for PL otherwise
is via message catalogs + manual/spot checks. Hooks set `NEXT_LOCALE=en` so the
rest of the suite stays English (Playwright `Accept-Language` is typically
English too).

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

## Testing formulas during onboarding

The template builder's Live preview drawer ends with a calculation tester
(`CalculationTester.tsx`) that runs the draft's formulas through
experiment-manager's real calculation engine via the stateless
`POST /api/calculations/evaluate` — no template or experiment has to exist and
nothing is persisted. It reports each formula's own status, so a typo'd
`values['question_id']` surfaces during authoring instead of after a technician
has entered real measurements.

Because the endpoint never fails on a bad formula, `testCalculationsAction`
returning `success: false` means the *request* failed; per-formula problems
arrive inside a successful response. The e2e double lives in
`e2e/features/support/stub/modules/calculation-dry-run.ts` and mirrors the
contract, not Python semantics — engine behaviour is experiment-manager's own
test suite's job.

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
  components, elevation, do's/don'ts (Mantine 9 + Harper Anslitics staff/client shells).

Run Impeccable commands scoped to the web app, e.g.
`node .agents/skills/impeccable/scripts/context.mjs --target apps/web`.

## Before you finish

Run from the repo root: `pnpm check-types` and `pnpm lint` (Turborepo pipelines
every workspace). For app-facing changes, `pnpm --filter web build`. For the
collaborative-editing layer, `pnpm --filter web test:coverage` (browser tests
need a one-time `pnpm --filter web exec playwright install chromium`; CI runs
the same suite via `.github/workflows/ci.yml`).
