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

### `/experiment/listing` 🚧

- Lists every experiment the user requested, across stages, with dates.
- Sourced from the **ticketing-service**; presented like a Linear board.
- Each item links to its (read-only) detail page.

### `/experiment/listing/{expcontext:id}` 🚧

- **Read-only** experiment detail.
- Live experiment values streamed from **experiment-manager**.

### `/experiment/request/listing` 🚧

- Lists all specimens supported by the labs, **grouped by specimen type**
  (expandable groups).
- Each specimen/template links to its onboarding page.

### `/experiment/request/{exptemplate:id}` 🚧

- Onboarding flow for a new experiment from a template.
- On success it creates a context and **redirects to
  `/experiment/listing/{expcontext:id}`**.

---

## Staff — `/internal/*` (admin only)

### `/internal/experiment/listing` ✅

- Sortable list of all experiments from **ticketing-service**, joined with the
  experiment title + sample type (experiment-manager) and the requester's
  email/avatar (custapi).
- Columns: experiment (title + sample type), requester, status, created,
  updated, and a copyable context id. Searchable (context id / experiment /
  requester), filterable by status, every column sortable.
- Click a row to open `/internal/experiment/{expcontext:id}`.
- Implemented: `apps/web/src/app/internal/experiment/listing/page.tsx` →
  `lib/internal/experiments.ts` (the ticketing+EM+custapi join, best-effort) +
  `components/internal/ExperimentListingTable.tsx` (client search/sort/filter).
  Ticketing client: `apps/web/src/lib/ticketing/`.

### `/internal/experiment/{expcontext:id}` ✅ (read-only; realtime pending)

- Lab technician's workspace for an experiment.
- **Current:** full read-only view of the experiment's current state — lab +
  client forms rendered read-only with the entered `values` (via the
  `@repo/forms` renderer), calculations with results, requester card, lifecycle
  timeline, and report status. Data joined in `getExperimentWorkspace()`
  (`lib/internal/experiments.ts`); each source is best-effort.
  Page: `apps/web/src/app/internal/experiment/[contextId]/page.tsx`.
- **Planned (realtime only):** WebSocket sync with editor-name highlighting on
  input fields (Google-Docs-style collaborative editing).

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
- `/dashboard` ✅ — post-login dashboard; surfaces technician tools for admins
  (`apps/web/src/app/dashboard/page.tsx`)

---

## Note on the onboarding path discrepancy

The client spec puts experiment onboarding at
`/experiment/request/{exptemplate:id}`, while template authoring/onboarding is
**currently** implemented only under `/internal/experiment/onboarding/...`
(staff). The client-facing request flow is still 🚧 — reconcile the two paths
when it's built.
