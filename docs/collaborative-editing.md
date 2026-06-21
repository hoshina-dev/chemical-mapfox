# Collaborative lab-form editing

Live, multi-staff editing of an experiment's **lab form** in the staff workspace
(`/internal/experiment/{contextId}`), Google-Docs style: presence, per-field soft
locks with editor colors, character-by-character live updates, and continuous
autosave to experiment-manager. The client's read-only view
(`/experiment/listing/{contextId}`) reflects the same stored state.

## Transport — SSE + POST + Redis (no new service)

The realtime layer lives entirely in `apps/web` (no extra microservice) and keeps
the BFF **stateless** — all authoritative state is in Redis.

```
browser ──(EventSource)──>  GET  /internal/experiment/{id}/collab/stream   (SSE push)
browser ──(fetch POST)───>  POST /internal/experiment/{id}/collab/event     (focus/blur/edit/heartbeat)

POST handler ──> mutate Redis ──> PUBLISH room:{id} ──┐
                                                      ├─> every pod's Redis subscriber
SSE stream  <── fan-out (sse-hub) <───────────────────┘   relays to its connections
debounced flush ──> updateExperiment() (experiment-manager)
```

- **SSE** (`collab/stream/route.ts`, `runtime=nodejs`): sends an initial `snapshot`,
  then relays `edit`/`lock`/`unlock`/`presence`. Heartbeat comment every ~25s keeps
  the connection alive through Cloudflare's ~100s idle timeout; headers include
  `Cache-Control: no-cache, no-transform`.
- **POST** (`collab/event/route.ts`): applies focus/blur/edit/heartbeat to Redis and
  publishes to `room:{id}`.
- **Fan-out** (`lib/collab/sse-hub.ts`): one Redis subscriber per pod routes messages
  to that pod's local SSE connections. Pods hold only connections (rebuilt on
  reconnect), never authoritative state — so single-pod today, scale-ready tomorrow.

### Redis model (`lib/collab/room.ts`)

```
template:{ctx}            JSON template snapshot              (hydrate, TTL ~1h)
values:{ctx}             HASH field -> JSON value             (the live value buffer)
presence:{ctx}:{connId}  JSON {connectionId,userId,name,…}    EX 30  (heartbeat-refreshed)
lock:{ctx}:{field}       {connectionId}                       PX 15s (soft field lock)
dirty:{ctx} / flush:{ctx}  flush bookkeeping (NX single-flight guard)
pub/sub: room:{ctx}
```

## Connection identity (multi-tab / multi-device)

Each editing session (tab/device) gets a random **`connectionId`**, distinct from
`userId`. Locks, presence, and echo-suppression are keyed by `connectionId`;
presence is **displayed deduped by `userId`** (one avatar per person). So a user's
two tabs don't steal each other's locks, see each other's edits live, and drop
presence independently. The SSE stream takes `?cid=` to drop only that session.

## Soft field locks

Advisory (UI-cooperative), not hard-enforced — the server applies edits
last-write-wins, which also sidesteps the repeatable-group case (locked by group id,
edited by child id).

- **focus** → `SET lock NX PX 15s`; presence is published **before** the lock so the
  owner is known when the lock arrives. While focused, the client re-sends `focus`
  every ~10s to keep the lock alive (and `heartbeat` every ~20s for presence).
- A locked field is **`disabled`** for everyone else (non-interactive, accessible,
  uniform across field types) but kept **full-contrast** via the shared
  `readableFields.module.css` so its value stays legible as it updates live — same
  treatment as the client read-only view. The owner's avatar "pins" to the field's
  left edge (absolutely positioned, so it never shifts the input).
- **Stale-lock safety:** the client only shows a field locked if the owner is still
  **present**. On disconnect, `handleDisconnect` releases the connection's locks and
  broadcasts `unlock`; on a hard crash, presence TTL (≤30s) clears it. Either way a
  field never gets stuck "locked, nobody editing".

## Live edits, clearing, and the three cadences

- **Live broadcast**: immediate, lightly throttled (~80ms) → character-by-character.
- **Heartbeat**: ~25s SSE keepalive (no data).
- **EM flush**: debounced ~10s, **plus on blur**, plus on submit.

**Clearing a field** sends an explicit `null` (not `undefined`, which `JSON.stringify`
drops — and Zod 4's `z.unknown()` rejects a missing key). `null` → buffer `HDEL`,
broadcast `value:null` → others clear live, and the flush PUT omits the field.

## Persistence & read-only consistency

- Flush calls the existing `updateExperiment()` (`templateToExperimentUpdate`), which
  already satisfies experiment-manager's schema validation. **EM replaces `values`
  wholesale on PUT**, so deletions persist.
- On (re)connect the SSE `snapshot` **replaces** local values with the authoritative
  buffer (doesn't merge over stale initial props), so cleared fields stay cleared.
- Read-only views (`ExperimentStateView`, both staff fallback + client page) render
  with `fillDefaults={false}` so unfilled fields show **empty** (matching the editor)
  instead of fabricated defaults, and use the same `readable` styling.

## Submit to final stage

`submitExperimentAction` (`app/actions/experiment.ts`) force-flushes the buffer to EM,
then transitions the ticket **`EXPERIMENTING → FINALIZING`** (the calc/PDF stage) via
`apiV1TicketsIdStatusPatch`. Canonical statuses live in `ticketing-service`
(`REQUESTED → PENDING → EXPERIMENTING → FINALIZING → CLOSED`).

## Environment & local dev

Requires **`REDIS_URL`** (see `apps/web/.env.example`). For local development:

```bash
docker compose -f docker-compose.dev.yml up -d   # Redis on :6379
pnpm --filter web dev
```

## Key files

| Concern | Path |
| --- | --- |
| Redis client | `apps/web/src/lib/redis/{config,client}.ts` |
| Room state / locks / presence / flush | `apps/web/src/lib/collab/room.ts` |
| Events + Zod | `apps/web/src/lib/collab/events.ts` |
| Editor colors | `apps/web/src/lib/collab/colors.ts` |
| SSE fan-out | `apps/web/src/lib/collab/sse-hub.ts` |
| Routes | `apps/web/src/app/internal/experiment/[contextId]/collab/{stream,event}/route.ts` |
| Submit action | `apps/web/src/app/actions/experiment.ts` |
| Client hook + UI | `apps/web/src/components/internal/collab/{useCollab,CollaborativeFormRenderer,PresenceBar,LabFormEditor}.tsx` |
| Readable disabled style | `apps/web/src/components/internal/readableFields.module.css` |

## Testing

Vitest (introduced for this feature): unit (`*.test.ts`, Node, Redis via
`ioredis-mock`) + browser-mode component tests (`*.test.tsx`). Run with
`pnpm --filter web test`. Browser tests need a one-time
`pnpm --filter web exec playwright install chromium`.
