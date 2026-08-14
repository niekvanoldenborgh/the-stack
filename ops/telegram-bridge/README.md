# Telegram bridge for human-review notifications (THEA-20)

Orchestration/notification infra for the Paperclip issue-thread workflow —
**not** part of the Expo app. Kept out of `app/` and `src/` deliberately so
it can't re-block THEA-4.

Bot + chat validated working 2026-08-14 (group "paperclip - the stack",
chat `-5399152677`). **That token was pasted in plaintext in the THEA-4
thread and must be regenerated via BotFather once it's read from a real
secrets store** — do not reuse it as-is.

## What's built (this heartbeat)

Pure, unit-tested logic with no dependency on the two decisions below:

- `formatNotification.cjs` — composes the outbound Telegram message for an
  interaction or a `blocked` issue.
- `mapUpdate.cjs` — routes an inbound Telegram reply (a Telegram *reply* to
  the bot's notification message) back to `{issueId, interactionId}`.
- `notify.cjs` — thin wrapper: calls Telegram `sendMessage`, records the
  Telegram `message_id` → interaction mapping via `pendingStore.cjs`.
- `poll.cjs` — thin wrapper: long-polls Telegram `getUpdates`, calls
  `mapUpdate`, then `POST /api/issues/{id}/interactions/{interactionId}/respond`.
- `pendingStore.cjs` — **placeholder** file-based persistence for the
  message-id → interaction mapping. Explicitly not the final design (see
  Decision 2).
- `tests/telegram-bridge.test.cjs` — covers formatting and routing,
  including the "don't guess" cases (no reply-to, unmatched message,
  unsupported interaction shape).

Routing only auto-resolves for a **single-question `ask_user_questions`
interaction with a free-text option** — Paperclip's `respond` endpoint takes
structured `{questionId, optionIds, otherText}`, not raw text, so a reply to
a multi-question or `request_confirmation` interaction is reported as
`unsupported_interaction_kind` rather than mapped by guesswork (e.g.
sniffing "yes"/"no" out of free text). Extending coverage to those is
follow-up scope once the two decisions below are made.

## Two decisions still needed (owner) — blocking a real deployment

I checked what's actually available under this agent's permissions before
listing options; both need Board/owner-level access I don't have as the
Developer agent.

### 1. Where do `TELEGRAM_BOT_TOKEN` / chat id live?

Paperclip already has a secrets pipeline that fits this:
- `POST /api/companies/{companyId}/secrets` — company-level secret, then
  reference it as `secret_ref` in an agent's `adapterConfig.env` (this is
  exactly how this agent's own `DB_PASSWORD` is delivered today).
- `POST /api/agents/me/secret-proposals` — an agent can *propose* a secret
  for Board approval, which fits a Developer agent's permission level
  better than direct `POST .../secrets` (confirmed: that endpoint returns
  `"Board access required"` for this agent).

**Recommendation:** store both as company secrets via the proposal flow,
delivered as env to whichever agent/host runs `poll.cjs`. Needs Board
approval either way — I can submit the proposal once host (below) is
decided, since the delivery target depends on it.

### 2. Where does the inbound poller run continuously?

Confirmed via `/api/plugins`, `/api/adapters` (both `"Board access
required"` for this agent) that installing new runtime surfaces is a
Board-only action. Options found in the platform, for the owner to pick
from:

- **Paperclip plugin** — `/api/plugins/{pluginId}/jobs` and
  `/api/plugins/{pluginId}/webhooks/{endpointKey}` exist, suggesting a
  plugin can host either a recurring job (polling) or a webhook target
  (if Telegram is switched from long-poll to `setWebhook`). Needs a Board
  member to install/configure the plugin.
- **External always-on host** — a small always-on process (existing infra
  outside Paperclip) running `poll.cjs`, calling back into the Paperclip
  API with an API key scoped to this. Simplest to reason about, but is
  infra this team would need to already operate.
- **Paperclip routine trigger** — `/api/routine-triggers` looked like
  scheduled/periodic execution rather than a true persistent long-poll;
  would mean trading Telegram long-polling for short-interval scheduled
  `getUpdates` calls (still correct, just not literally "persistent").

I did not pick one — this determines where `pendingStore.cjs` gets
replaced with real persistence, and who holds the bot token, so it's the
owner's call.

## Not yet built

- Real persistence for the pending-message map (currently a single JSON
  file next to the code — fine for local testing, not for a live bridge).
- Routing for `request_confirmation` / multi-question interactions.
- Wiring `notify.cjs` to actually fire when an interaction is created or an
  issue goes `blocked` (needs the host decision first — nothing to attach
  it to yet).
