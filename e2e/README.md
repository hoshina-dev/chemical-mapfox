# @repo/e2e — CucumberJS + Playwright acceptance tests

Black-box acceptance tests that drive the real `apps/web` app in a browser and
assert end-user-visible behaviour, one Gherkin feature per business capability.

The first delivered feature area is **Authentication & access control**; the
rest of the app's features (experiment request/lifecycle, collaborative editing,
finalization, template authoring, etc.) follow the same structure.

## How it works

The app is a **BFF**: it talks to its backends (custapi, ticketing-service,
experiment-manager) **server-side**, so browser-level request interception can't
mock them. Instead the harness:

1. Starts an in-process **stub HTTP server** (`features/support/stub-server.ts`)
   that answers all three backends from an in-memory fixture store
   (`features/support/fixtures.ts`). Step definitions seed data by mutating that
   store directly — no network round-trip.
2. Boots the Next.js app (`next dev`) on its own port (default **3100**, so it
   never clashes with your `pnpm dev` on 3000), with `CUSTAPI_URL` /
   `TICKETING_URL` / `EXPERIMENT_MANAGER_URL` pointed at the stub and a fixed
   `JWT_SECRET`.
3. Drives it with **Playwright** (Chromium). A fresh browser context per
   scenario; the fixture store is reset in a `Before` hook.

> The base URL uses `localhost` (not `127.0.0.1`) on purpose: Next 16's dev
> server blocks cross-origin `/_next/*` resources, and a `127.0.0.1` request
> against its `localhost` origin counts as cross-origin — which silently breaks
> client hydration (tabs, menus, etc. stop responding).

## Running

From the repo root (or this folder):

```bash
pnpm --filter @repo/e2e test          # headless
pnpm --filter @repo/e2e test:headed   # show the browser
```

First run downloads the Chromium build (`playwright install chromium`, wired as
a `pretest` hook). The managed `next dev` boot + on-demand route compilation
makes the first scenario take a few seconds; the whole auth suite runs in well
under a minute.

**Don't run a separate `pnpm dev` for `apps/web` at the same time** — two dev
servers sharing the same `.next` cache can corrupt each other. The harness
manages its own server.

### Useful environment overrides

| Variable                  | Default                  | Purpose                                             |
| ------------------------- | ------------------------ | --------------------------------------------------- |
| `HEADLESS`                | `true`                   | Set `false` to watch the browser.                   |
| `E2E_WEB_PORT`            | `3100`                   | Port the app under test listens on.                 |
| `E2E_STUB_PORT`           | `4555`                   | Port the backend stub listens on.                   |
| `E2E_BASE_URL`            | _(unset)_                | Point at an already-running app; harness won't spawn one (mocks then won't apply unless you wired the env yourself). |
| `E2E_JWT_SECRET`          | `e2e-test-secret`        | Session-cookie signing secret handed to the app.    |
| `E2E_WEB_BOOT_TIMEOUT_MS` | `180000`                 | How long to wait for the dev server to come up.     |

## Layout

```
e2e/
├── cucumber.mjs                     # Cucumber profile (TS via `node --import tsx`)
├── features/
│   ├── auth/                        # *.feature — Gherkin specs
│   │   ├── login.feature
│   │   ├── register.feature
│   │   ├── logout.feature
│   │   └── access-control.feature
│   ├── step_definitions/
│   │   ├── auth.steps.ts
│   │   └── navigation.steps.ts
│   └── support/
│       ├── config.ts                # ports, URLs, timeouts
│       ├── fixtures.ts              # in-memory users/orgs + wire serializers
│       ├── stub-server.ts           # custapi/ticketing/EM stub
│       ├── web-server.ts            # spawns + tears down `next dev`
│       ├── world.ts                 # Playwright-backed Cucumber World
│       └── hooks.ts                 # Before/After/BeforeAll/AfterAll
└── README.md
```

## Adding a new feature area

1. Write `features/<area>/<name>.feature` in Gherkin.
2. Reuse the shared steps (`I visit …`, `I should be on the … page`, `the
   following users exist:` …) and add area-specific steps under
   `features/step_definitions/`.
3. If the flow touches a backend the stub doesn't cover yet (e.g. ticketing
   ticket creation, experiment-manager samples/templates), extend
   `stub-server.ts` + `fixtures.ts` with the needed endpoints and seed helpers.

## TypeScript

There's no build step — the Cucumber binary is launched under
`node --import tsx`, so `.ts` support files and step definitions are transpiled
on the fly.
