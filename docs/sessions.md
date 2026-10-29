# Sessions

Login sessions are stored server-side in Redis (`apps/web/src/lib/auth/sessionStore.ts`).
The `session` cookie holds only a random 256-bit token. Redis stores its SHA-256
hash, so a copy of Redis contains no usable cookies.

## Keys

| Key | Value | TTL |
|---|---|---|
| `session:{sha256(token)}` | JSON: user id, name, email, avatar, role, org, `createdAt`, `lastSeenAt`, `roleCheckedAt` | 7 days, renewed while active |
| `user:{userId}:sessions` | set of that user's session hashes | renewed with the sessions |

## Lifetime

- **Idle:** a session expires after 7 days without a request. Activity renews the
  TTL at most every 5 minutes, to avoid a write on every request.
- **Absolute:** 30 days after login, however active the user is.
- **Role:** custapi owns roles, and this app is never told when one changes. So
  `resolveSession` re-reads the user from custapi when the last check is over
  60 s old (`ROLE_CHECK_INTERVAL_MS`). That is the longest a revoked admin keeps
  access.
  - custapi says 404: every session of that user is revoked.
  - custapi unreachable: the stored role is kept for up to 1 hour
    (`ROLE_STALE_MAX_MS`), then requests are treated as signed out until custapi
    answers again.

## Ending sessions

- **Logout** deletes the current session.
- **Password change** deletes all of the user's sessions, then gives the current
  browser a new one.
- **Settings → Sign out on all devices** deletes all of the user's sessions,
  including the current one.

Session writes use `SET … XX`, so a request already in flight can't bring back a
session that was revoked while it ran.

## Where the session is checked

- `proxy.ts` on every page request (redirects only).
- `getSession()` / `requireSession()` / `requireAdmin()` in `lib/auth/dal.ts`:
  the authority for pages, server actions and route handlers.
- The collab SSE stream re-checks on its 25 s heartbeat and closes when the
  session is gone or no longer admin.

## Failure mode

Redis is required. If it is down, `resolveSession` logs the error and treats the
request as signed out, and login fails. A Redis restart without persistence
logs everyone out.

In e2e (`E2E_REDIS_MOCK=1`), sessions live in the same in-memory mock as the
collab layer.
