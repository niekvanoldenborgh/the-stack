# Telegram bridge for human-review notifications (THEA-20)

Orchestration/notification infra for the Paperclip issue-thread workflow —
**not** part of the Expo app. Kept out of `app/` and `src/` deliberately so
it can't re-block THEA-4.

Bot + chat validated working 2026-08-14 (group "paperclip - the stack",
chat `-5399152677`). **That token was pasted in plaintext in the THEA-4
thread and must be regenerated via BotFather** — the owner places the
regenerated token on the host (see Decisions below); do not reuse the old
one as-is.

## Decisions (owner, 2026-08-15)

1. **Runtime host = scheduled poll.** A Paperclip routine trigger calls
   `runBridgeTick.cjs` on a per-minute schedule — no plugin, no external
   always-on host. Each tick is a separate process execution.
2. **Token storage = owner-provided `.env` on the host.** Not the
   secret-proposal flow. The owner regenerates the token via BotFather and
   places `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` on whatever host runs the
   routine.

Still owner/Board for go-live (not blockers for this code): the owner
placing the token, and a Board member creating the routine trigger.

## Entrypoint

`runBridgeTick.cjs` is the one thing the scheduled routine calls:

```js
const { runBridgeTick } = require('./runBridgeTick.cjs');
await runBridgeTick(); // reads config from process.env
```

Each tick does both halves, in order:

1. **Inbound** (`poll.cjs` → `pollAndRouteTick`) — fetch whatever Telegram
   updates arrived since the last tick's persisted offset, route each reply
   to its Paperclip interaction via `mapUpdate.cjs`, `POST
   /api/issues/{id}/interactions/{interactionId}/respond` — then **always
   reply in Telegram**: a `✅ Got it — routed to <issue title>` ack on
   success, a short hint (`no_pending_match` / `not_a_reply` /
   `unsupported_interaction_kind`) or failure notice otherwise. Before
   THEA-28 nothing was sent either way, so a successful reply and a dropped
   one looked identical to the sender.
2. **Outbound** (`scan.cjs` → `scanAndNotify`) — walk company issues for
   ones newly needing a human (see "Human-only heuristics" below) and not
   already notified, send one Telegram message each via `notify.cjs`.

## Single-poller guarantee (THEA-28)

Telegram's `getUpdates` is single-consumer: it advances one shared offset
per bot token. If more than one process polls the same token — e.g. an
agent heartbeat running a tick *and* the VPS per-minute cron — they steal
each other's updates and a reply gets consumed by whichever process didn't
have the matching pending entry, and is silently dropped. The
message→interaction map also lives in one `pendingStore.cjs` file, so a
notification sent from one host is invisible to a poller on another host.

**Exactly one process — the VPS per-minute cron — may call
`runBridgeTick`/`pollAndRouteTick`, against exactly one `pendingStore.cjs`
file. Do NOT call `runBridgeTick` from an agent heartbeat**, even for a
one-off manual poll; it races the cron's offset and store.

`pollAndRouteTick` records `{ instanceId, at }` (`TELEGRAM_BRIDGE_INSTANCE_ID`
env, or `hostname:pid`) to the store on every call and warns via
`console.warn` (does not block) when a different instance polled inside the
last ~45s — see `singleConsumerGuard.cjs`. Treat that warning as a real
incident: it means two consumers are racing the same bot token right now,
not a false positive to silence.

Both halves read/write the same file-backed store (`pendingStore.cjs`) so
state — the Telegram update offset, the message→interaction map, and which
interactions/issues have already been notified — survives across ticks.
That file must live somewhere persistent across the routine's executions
(not a fresh checkout each run); if the routine's working directory isn't
stable, point `storePath` at a durable path instead of the module default.

## Module map

- `formatNotification.cjs` — pure: composes the outbound Telegram message.
- `mapUpdate.cjs` — pure: routes an inbound reply → `{issueId,
  interactionId}`. Prefers Telegram's reply-to threading; falls back to the
  single pending interaction in the chat when the message isn't a reply and
  exactly one is outstanding (THEA-28) — with 2+ pending it still refuses
  to guess.
- `interactionRoute.cjs` — pure: does a fetched interaction qualify for
  auto-routed replies (single question, free-text option)?
- `notifiableEvents.cjs` — pure: which issues/interactions need a Telegram
  notification, given already-notified ids.
- `singleConsumerGuard.cjs` — pure: does this poll look like it's racing a
  second consumer of the same store (THEA-28)?
- `notify.cjs` — sends one Telegram message, records the pending mapping.
- `poll.cjs` — `getUpdates` + `routeUpdate` (single update: routes it, acks
  or hints back in Telegram, clears the pending entry on success) +
  `pollAndRouteTick` (one tick: single-consumer guard, drain updates,
  persist offset).
- `scan.cjs` — fetches company issues + per-issue interactions, applies
  `notifiableEvents.cjs`, calls `notify.cjs`, marks each as sent.
- `pendingStore.cjs` — single JSON file backing all cross-tick state.
- `runBridgeTick.cjs` — the entrypoint the scheduled routine calls.
- `tests/telegram-bridge.test.cjs`,
  `tests/telegram-bridge-tick.test.cjs` — unit tests, fetch injected.

## Config (env)

| var | used by |
|---|---|
| `TELEGRAM_BOT_TOKEN` | inbound + outbound |
| `TELEGRAM_CHAT_ID` | outbound |
| `PAPERCLIP_API_URL` | inbound + outbound |
| `PAPERCLIP_API_KEY` | inbound + outbound |
| `PAPERCLIP_COMPANY_ID` | outbound (company-wide issue scan) |
| `PAPERCLIP_APP_BASE_URL` | outbound, optional — see gap below |
| `TELEGRAM_BRIDGE_INSTANCE_ID` | inbound, optional — identifies this poller for the single-consumer guard; defaults to `hostname:pid` |

## Human-only heuristics (worth re-checking, not a documented contract)

Detecting "this needs a human" was built from what this agent's API access
could actually see, not a confirmed spec:

- **Interaction**: `effectiveResolverPolicy === 'board_only'` — Paperclip's
  own statement that no agent, only a human/Board member, can resolve it.
- **Blocked issue**: `unblockDescriptor.owner` names a user
  (`owner.userId`/`owner.kind === 'user'`), not an agent (`owner.agentId`
  present → skipped, that's routing to another agent). Only one real
  example was available while building this (THEA-14, agent-owned), so the
  human-owned branch is unverified against a live example — re-check this
  the first time a real human-owned `blocked` issue shows up.

## Known gaps

- **Deep link URL.** Paperclip's dashboard URL isn't exposed by any API
  this agent can reach. `buildIssueUrl` falls back to the API base URL
  (clickable, but resolves to JSON, not the issue page) unless
  `PAPERCLIP_APP_BASE_URL` is set to the real dashboard origin.
- **N+1 fetch per tick.** `scan.cjs` calls `/api/issues/{id}/interactions`
  once per non-terminal company issue — fine at ~20 issues, would need a
  per-issue `updatedAt` watermark (skip issues unchanged since the last
  tick) before it'd be fine at issue-tracker scale. The purpose-built
  aggregate endpoint (`/api/companies/{id}/attention`) returns "Board access
  required" for this agent — confirmed live, not assumed.
- **Routing coverage.** Inbound auto-routing only covers single-question,
  free-text `ask_user_questions` (by reply-to-message, or by fallback when
  it's the only one pending — see "Single-poller guarantee"). Multi-question
  and `request_confirmation` interactions still notify outbound but report
  `unsupported_interaction_kind` on reply rather than guess — real
  engineering scope, not done here.
- **Single-poller enforcement is a warning, not a lock.** `pendingStore.cjs`
  is a plain read-modify-write JSON file — correct for one poller running
  at a time, not concurrent replicas. `singleConsumerGuard.cjs` detects and
  warns about a likely second consumer (see "Single-poller guarantee")
  after the fact; it can't prevent the race itself. The real guarantee is
  operational: only the VPS cron may run `runBridgeTick`.
