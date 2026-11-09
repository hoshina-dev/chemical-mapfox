# MCP connector for lab staff

Lab staff can use the lab workspace from **Claude (claude.ai)** or **ChatGPT**
by adding this site as a custom connector. The connector is a remote MCP
server inside `apps/web`; each staff member signs in as themselves through a
built-in OAuth 2.1 authorization server, so every action is attributed to a
real person and loses access exactly when their session would.

Only mapfox **admins** (app role `technician`) can connect. Clients see a
"staff only" page on the consent screen.

## Endpoints

| Path | Purpose |
|---|---|
| `POST /api/mcp` | MCP Streamable HTTP. Tool calls are stateless JSON responses |
| `GET /api/mcp` | Standalone SSE stream Cursor opens after initialize. No notifications are sent on it |
| `DELETE /api/mcp` | 405. Stateless mode never issues a session id |
| `GET /.well-known/oauth-protected-resource[/api/mcp]` | RFC 9728 resource metadata |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 server metadata |
| `POST /oauth/register` | RFC 7591 dynamic client registration (public clients) |
| `GET /oauth/authorize` | Consent screen (page; requires sign-in, admin only) |
| `POST /oauth/authorize/decision` | Consent form target; same-origin only, answers 303 to the client |
| `POST /oauth/token` | `authorization_code` (PKCE S256 required) and `refresh_token` |
| `POST /oauth/revoke` | RFC 7009 revocation |

The machine endpoints are excluded from `proxy.ts`; `/oauth/authorize` is a
normal page, and signed-out visitors go through `/login?next=…` (only
`/oauth/authorize` is accepted as `next`, see `lib/auth/returnTo.ts`).

## Tokens and revocation

State lives in Redis next to sessions (`lib/oauth/store.ts`); tokens are
stored only as SHA-256 hashes.

| Key | Value | TTL |
|---|---|---|
| `oauth:client:{id}` | registered client | 30 days, renewed on each token issue |
| `oauth:code:{hash}` | auth code (client, redirect, PKCE challenge, user) | 60 s, single use |
| `oauth:grant:{id}` | one user's connection to one client | 30 days idle, 90 days absolute |
| `oauth:at:{hash}` | access token → grant | 1 hour |
| `oauth:rt:{hash}` | refresh token → grant | 30 days |
| `user:{userId}:grants` | that user's grant ids | renewed with grants |

- Refresh tokens rotate. Presenting an already-rotated one revokes the grant.
- Every token resolves through its grant, so deleting the grant kills all of
  them at once.
- The role is re-read from custapi at most every 60 s, shared with sessions
  (`lib/auth/userRefresh.ts`). A non-admin token gets 403.
- `revokeUserSessions` also revokes grants: **Sign out on all devices**, a
  password change and custapi reporting the user gone all disconnect the apps.
- Staff can see and disconnect apps in **Settings → Connected apps**.

Registration accepts any HTTPS redirect URI (plus loopback HTTP for local
tools). Hosts other than `claude.ai` and `chatgpt.com` get a warning on the
consent screen rather than a rejection.

## Tools

Defined in `lib/mcp/server.ts`; every call is logged (`op: "mcp.tool"`) with
the user, client and context id.

| Tool | Stage | Notes |
|---|---|---|
| `list_experiments` | any | filter by status / text |
| `get_experiment` | any | ticket, requester, intake answers, lab form questions + values, calculations, report |
| `record_lab_values` | EXPERIMENTING, FINALIZING | see below |
| `check_in_sample` | REQUESTED → PENDING | |
| `start_experiment` | PENDING → EXPERIMENTING | |
| `submit_experiment` | EXPERIMENTING → FINALIZING | full validation; irreversible |
| `run_calculations` | FINALIZING | |
| `generate_report` | FINALIZING | async; poll via `get_experiment` |
| `get_report_download_url` | report generated | |
| `close_ticket` | FINALIZING → CLOSED | irreversible |
| `list_samples` / `list_templates` / `get_template` | onboarding | what is already set up |
| `create_sample` | onboarding | `onboard_template` also creates a sample by name |
| `test_template_calculations` | onboarding | dry run, nothing saved |
| `onboard_template` | onboarding | create or revise a method from forms + formulas |

The connector does not fetch spreadsheets. The assistant reads the file the
staff member gives it, then calls `onboard_template`.

## Formulas

Formulas are the Python subset experiment-manager evaluates
(`app/services/calculation_service.py`, builtins in `app/form_schema.py`).
An answer is `values['question_id']`. Another calculation is a bare name,
ordered by dependency. Builtins are `round`, `abs`, `min`, `max`, `sum`,
`len`, `zip`, `mean`, `median`, `stdev`, plus the `math` module. A
repeatable-group child is a list. `onboard_template` refuses to save when
that check fails.

The lifecycle tools call the same functions as the workspace's server actions
(`lib/staff/workflow.ts`); the actions only add the cookie-session check.

`record_lab_values` (`lib/staff/labValues.ts`) is all-or-nothing:

- **EXPERIMENTING:** values are validated (`validateField`, submit rules minus
  `required`) and written through the collaborative editor's Redis buffer and
  pub/sub as connection `mcp:{grantId}`, so staff with the workspace open see
  them live. A field someone currently holds a soft lock on is refused instead
  of overwritten. The buffer is flushed to experiment-manager immediately.
- **FINALIZING:** merged with the stored values and written through the same
  "fix values" path as the workspace (calculation results are cleared).

## Trying it locally

You don't need real backends or an AI subscription:

1. Start the local catalogue stack
   ([`catalogue-local-testing.md`](catalogue-local-testing.md)): real
   experiment-manager plus a ticketing double that runs the full lifecycle.
   Request an experiment as `client@example.com` to have something to work on.
2. Run the MCP Inspector: `npx @modelcontextprotocol/inspector`, choose
   *Streamable HTTP*, URL `http://localhost:55441/api/mcp`, and use
   *Open Auth Settings → Quick OAuth Flow*. Sign in as `admin@example.com` and
   allow access (localhost isn't Claude or ChatGPT, so expect the warning).
3. List tools and call `list_experiments`.

On that stack, `get_report_download_url` returns a URL on the S3 double's
Docker hostname (`object-storage:5000`), which the host can't resolve.

The acceptance suite (`e2e/features/mcp/`) runs the same flow headlessly.

## Connecting Claude or ChatGPT

Both connect from their own cloud, so the site needs a **public HTTPS URL**.
For a trial, a Cloudflare quick tunnel works:
`cloudflared tunnel --url http://localhost:3000`, then set `APP_ORIGIN` to the
tunnel URL so the OAuth issuer and resource URLs match.

- **Claude:** Settings → Connectors → Add custom connector →
  `https://<host>/api/mcp`. On Team/Enterprise an owner adds it for the org.
- **ChatGPT:** enable Developer mode, then Settings → Apps → Create, with the
  same URL and OAuth. On Business/Enterprise an admin publishes it.

Plan names and menus change; check each vendor's current docs. Prefer plans
that exclude conversations from training, since experiment data is client
data.
