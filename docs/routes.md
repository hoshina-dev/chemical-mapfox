# Routes — current & planned

The app's route map for the experiment workflow, split into **client-facing**
and **staff (`/internal/*`)** sections. Status legend:

- ✅ **implemented** — page exists under `apps/web/src/app/`
- 🚧 **planned** — designed, not yet built

Placeholders: `{expcontext:id}` = an experiment **context** id (a created/running
experiment), `{exptemplate:id}` = an experiment **template** id, `{sampleId}` =
a specimen/sample id.

Access control: everything under `/internal/*` is **admin-only**, gated by the
middleware (`apps/web/src/proxy.ts`) and the server-side backstop layout
(`apps/web/src/app/internal/layout.tsx`). See [`../AGENTS.md`](../AGENTS.md).

---

## Client-facing

All client routes live under `apps/web/src/app/experiment/` and share a layout
(`experiment/layout.tsx`) that requires a signed-in user (any role) and renders
the client nav (`components/experiment/ClientNav.tsx`). Data loaders are in
`lib/experiment/data.ts`; path helpers in `lib/experiment/routes.ts`.

### `/experiment/listing` ✅

- Lists every experiment the **current user** requested, presented like a
  Linear board (cards grouped into lifecycle lanes). Sourced from the
  **ticketing-service** (`listMyExperiments(userId)`), including the card title
  from the ticket `name`.
- Each card links to its read-only detail page.
- Page: `apps/web/src/app/experiment/listing/page.tsx` →
  `components/experiment/MyExperimentsBoard.tsx`.

### `/experiment/listing/{expcontext:id}` ✅ (read-only)

- **Read-only** experiment detail for the requester. Reuses
  `getExperimentWorkspace()` + the `@repo/forms` renderer (via
  `ExperimentStateView`), with a lifecycle timeline. **Ownership-checked**: a
  ticket owned by another user returns `notFound()`.
- While the ticket is **`REQUESTED`** (sample not yet received) it shows a
  **printable QR sample label** (`components/experiment/SampleLabel.tsx`) the
  requester attaches to their shipping box. The QR encodes the absolute
  staff check-in URL (`getRequestOrigin()` + `experimentCheckinPath()`); a
  "Print label" button and a copyable raw URL are included.
- Page: `apps/web/src/app/experiment/listing/[contextId]/page.tsx`.

### `/experiment/request/listing` ✅

- Lists the specimens (samples) the labs support as expandable **Accordion**
  groups; each group lists the **current** version of its templates. Searchable.
- Each template links to its onboarding page.
- Page: `apps/web/src/app/experiment/request/listing/page.tsx` →
  `components/experiment/request/RequestCatalog.tsx` (`listRequestCatalog()`).

### `/experiment/request/{exptemplate:id}` ✅

- Onboarding flow for a new experiment from a template (accepts `?sampleId=` to
  load the template directly; falls back to a specimen sweep). Renders the
  template's **client intake form** (`@repo/forms` renderer).
- On submit (`requestExperimentAction`) it creates the **ticket** (the context),
  best-effort seeds the experiment-manager context with the template snapshot +
  intake answers, then **redirects to `/experiment/listing/{expcontext:id}`**.
- Page: `apps/web/src/app/experiment/request/[templateId]/page.tsx` →
  `components/experiment/request/RequestExperimentForm.tsx`.

---

## Staff — `/internal/*` (admin only)

### `/internal/experiment/listing` ✅

- Sortable list of all experiments from **ticketing-service**, using the ticket
  `name` as the experiment title and joined with the requester's email/avatar
  (custapi).
- Columns: experiment title, requester, status, created, updated, and a
  copyable context id. Searchable (context id / experiment / requester),
  filterable by status, every column sortable.
- Click a row to open `/internal/experiment/{expcontext:id}`.
- Implemented: `apps/web/src/app/internal/experiment/listing/page.tsx` →
  `lib/internal/experiments.ts` (the ticketing+custapi join, best-effort) +
  `components/internal/ExperimentListingTable.tsx` (client search/sort/filter).
  Ticketing client: `apps/web/src/lib/ticketing/`.

### `/internal/experiment/checkin/{expcontext:id}` ✅

- **Sample check-in** — the target of the QR label printed by the requester.
  Lab staff scan it on arrival; the page shows brief ticket info + a read-only
  experiment detail (`ExperimentStateView`) and a **Check in sample** button
  (`components/internal/CheckInButton.tsx` → `checkInSampleAction`) that
  transitions the ticket **`REQUESTED → PENDING`** ("Sample received"), then
  forwards to the workspace. If the sample was already received it shows that
  and links to the workspace instead.
- Page: `apps/web/src/app/internal/experiment/checkin/[contextId]/page.tsx`.
  (Static `checkin` segment; sits beside the `[contextId]` workspace route.)

### `/internal/experiment/{expcontext:id}` ✅ (collaborative editing)

- Lab technician's workspace for an experiment. The lab form is editable **only
  while the ticket is `EXPERIMENTING`**; other stages render it read-only:
  - **`REQUESTED`** — a notice that the sample hasn't been received, linking to
    the check-in page.
  - **`PENDING`** ("Sample received") — a **Start experiment** button
    (`components/internal/StartExperimentButton.tsx` → `startExperimentAction`)
    that transitions `PENDING → EXPERIMENTING` and unlocks the editor.
- **Lab form** is a live collaborative editor (`ExperimentStateView` →
  `components/internal/collab/LabFormEditor.tsx`): multiple staff edit at once,
  see each other's presence (avatar + hover name, per-editor color via
  `lib/collab/colors.ts`), a soft field-lock highlights/disables the box someone
  else is editing, and edits stream live + autosave to experiment-manager.
  **Submit to final stage** transitions the ticket `EXPERIMENTING → FINALIZING`.
  Client intake + calculations stay read-only.
- **Transport:** SSE push + POST events + Redis pub/sub (no new service; stateless
  BFF). Routes: `collab/stream/route.ts` (SSE) and `collab/event/route.ts` (POST);
  shared state in `lib/collab/room.ts` + Redis; fan-out in `lib/collab/sse-hub.ts`.
  Requires `REDIS_URL`.
- Read-only state join still via `getExperimentWorkspace()`
  (`lib/internal/experiments.ts`); each source is best-effort.
  Page: `apps/web/src/app/internal/experiment/[contextId]/page.tsx`.

### `/internal/experiment/{expcontext:id}/raw` ✅

- Raw-JSON diagnostic view of an experiment: the ticket (ticketing-service) and
  the experiment (experiment-manager) payloads, pretty-printed and copyable, for
  debugging. Reached by clicking the copyable context id anywhere it appears
  (the listing's Context ID column and the workspace header).
- Page: `apps/web/src/app/internal/experiment/[contextId]/raw/page.tsx`.

### `/internal/experiment/onboarding` ✅

- **Samples-first.** Lists the samples (specimen types) as cards with their
  template counts; **Register sample** opens a modal (`createSampleAction`,
  experiment-manager `POST /api/samples`) and redirects to the new sample's
  page. Open a sample to manage its templates.
- Implemented under `apps/web/src/app/internal/experiment/onboarding/`:
  - `onboarding/page.tsx` — samples list + register-sample
    (`components/experiment/RegisterSampleButton.tsx`)
  - `onboarding/[sampleId]/page.tsx` — templates **scoped to one sample**
    (experiment-manager `GET /api/samples/{id}` + `…/experiments`)
  - `onboarding/new/page.tsx` — create a new template; accepts `?sampleId=` to
    pre-select the sample and jump straight to the builder
  - `onboarding/[sampleId]/[templateId]/page.tsx` — template builder/editor

> Path helpers live in `apps/web/src/lib/experiment-manager/routes.ts`
> (`sampleOnboardingPath`, `newTemplatePath(sampleId?)`, …).

### `/internal/docs` ✅ and `/internal/docs/[type]` ✅

- Component reference for form authors: one page per question type with a live
  preview and the generated schema fields. Imports from `@repo/forms`. See
  [`../README.md`](../README.md).

---

## Other implemented routes

- `/` ✅ — landing / login (`apps/web/src/app/page.tsx`)

There is **no separate hub/dashboard page**. After login each role is sent
straight to its primary workspace and navigates from there using the nav chrome
(`AdminNav` / `ClientNav`):

- lab staff (mapfox admins) → `/admin` (the staff **Experiments** listing)
- everyone else → `/experiment/listing` (their **My experiments** board)

The single source of truth for this is `landingPathForRole()`
(`apps/web/src/lib/auth/appRole.ts`), used by the login/register actions,
the `/` redirect, and the middleware (`proxy.ts`).

---

## Note on the onboarding path discrepancy

The client spec puts experiment onboarding at
`/experiment/request/{exptemplate:id}`, while template authoring/onboarding is
**currently** implemented only under `/internal/experiment/onboarding/...`
(staff). The client-facing request flow is still 🚧 — reconcile the two paths
when it's built.
