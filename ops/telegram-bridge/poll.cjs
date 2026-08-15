'use strict';

/**
 * Inbound half of the Telegram bridge (THEA-20): long-poll getUpdates and
 * route replies back into Paperclip via POST
 * /api/issues/{issueId}/interactions/{interactionId}/respond.
 *
 * This is the part that needs a continuously-running host — Paperclip
 * agents run as heartbeats, not persistent services (see ../README.md).
 * Do not deploy this as-is against a real bot token until that decision is
 * made and the token lives in a secrets store, not an env file in a repo
 * checkout.
 *
 * THEA-28: every routed update now gets a Telegram-side reply — a ✅ ack on
 * success, a short hint on a known routing failure — so success and
 * failure no longer look identical to the sender (see routeUpdate below).
 *
 * Required env:
 *   TELEGRAM_BOT_TOKEN
 *   PAPERCLIP_API_URL
 *   PAPERCLIP_API_KEY
 */

const os = require('node:os');

const { mapReplyToInteraction } = require('./mapUpdate.cjs');
const { detectSecondConsumer } = require('./singleConsumerGuard.cjs');
const {
  getPendingMap,
  removePending,
  getUpdateOffset,
  setUpdateOffset,
  getLastPoller,
  recordPoller,
} = require('./pendingStore.cjs');

// Failure reasons that mean "a human sent something we couldn't route" —
// worth a short hint. Reasons like `not_a_message` (non-text update, e.g. a
// sticker or channel post) or `empty_text` don't get one; there's nothing
// useful to tell the sender and some of those aren't even messages a human
// typed.
const HINT_REASONS = new Set(['no_pending_match', 'not_a_reply', 'unsupported_interaction_kind']);
const HINT_TEXT = "Couldn't match that — please use Reply on the question message.";
const RESPOND_FAILURE_TEXT = 'Got your reply but could not save it — please try again in a bit.';

async function pollOnce({ offset, timeoutSeconds = 30, fetchImpl = fetch, env = process.env } = {}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');

  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set('timeout', String(timeoutSeconds));
  if (offset != null) url.searchParams.set('offset', String(offset));

  const res = await fetchImpl(url.toString());
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram getUpdates failed: ${body.description || res.status}`);
  return body.result;
}

async function sendTelegramReply(text, { chatId, replyToMessageId, token, fetchImpl }) {
  if (!token || chatId == null) return; // no way to reply — e.g. in a unit test with no token
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
    }),
  });
  const body = await res.json();
  if (!body.ok) {
    console.warn('[telegram-bridge] ack sendMessage failed', body.description || res.status);
  }
}

async function routeUpdate(update, { fetchImpl = fetch, env = process.env, storePath } = {}) {
  const pending = await getPendingMap({ storePath });
  const routed = mapReplyToInteraction(update, pending);

  const message = update && update.message;
  const chatId = message && message.chat && message.chat.id;
  const replyToMessageId = message && message.message_id;
  const token = env.TELEGRAM_BOT_TOKEN;
  const ack = (text) => sendTelegramReply(text, { chatId, replyToMessageId, token, fetchImpl });

  if (!routed.ok) {
    if (HINT_REASONS.has(routed.reason)) await ack(HINT_TEXT);
    return routed;
  }

  const apiBase = String(env.PAPERCLIP_API_URL || '').replace(/\/$/, '').replace(/\/api$/, '');
  const res = await fetchImpl(
    `${apiBase}/api/issues/${routed.issueId}/interactions/${routed.interactionId}/respond`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAPERCLIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        answers: [
          {
            questionId: routed.questionId,
            optionIds: [routed.freeTextOptionId],
            otherText: routed.responseText,
          },
        ],
      }),
    }
  );
  if (!res.ok) {
    await ack(RESPOND_FAILURE_TEXT);
    return { ok: false, reason: `paperclip_respond_failed_${res.status}` };
  }

  // Drop the entry so it stops counting toward the "exactly one pending"
  // fallback in mapUpdate.cjs once it's actually been answered.
  if (routed.pendingMessageId != null) await removePending(routed.pendingMessageId, { storePath });

  await ack(`✅ Got it — routed to ${routed.issueTitle || routed.issueId}`);
  return { ok: true, issueId: routed.issueId, interactionId: routed.interactionId };
}

/**
 * Warn (never block) if this poll looks like it's racing a second consumer
 * of the same bot token / store — see singleConsumerGuard.cjs and README
 * "Single-poller guarantee". Records this poll as `lastPoller` either way.
 */
async function guardSingleConsumer({ storePath, env, now }) {
  const instanceId = env.TELEGRAM_BRIDGE_INSTANCE_ID || `${os.hostname()}:${process.pid}`;
  const lastPoller = await getLastPoller({ storePath });
  if (detectSecondConsumer({ lastPoller, instanceId, now })) {
    console.warn(
      `[telegram-bridge] possible second poller detected: "${lastPoller.instanceId}" polled ${now - lastPoller.at}ms ago, ` +
        `this poll is "${instanceId}". Telegram getUpdates is single-consumer — running more than one poller against ` +
        'the same bot token silently drops replies. Only the VPS cron should run runBridgeTick; see README "Single-poller guarantee".'
    );
  }
  await recordPoller(instanceId, now, { storePath });
}

async function runForever() {
  let offset;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const updates = await pollOnce({ offset });
    for (const update of updates) {
      offset = update.update_id + 1;
      const result = await routeUpdate(update);
      if (!result.ok && result.reason !== 'not_a_reply' && result.reason !== 'not_a_message') {
        console.warn('[telegram-bridge] unrouted update', update.update_id, result.reason);
      }
    }
  }
}

/**
 * One scheduled-routine tick of the inbound half: fetch whatever Telegram
 * updates have arrived since the offset persisted last tick, route each,
 * persist the new offset. Short `timeoutSeconds` (not the 30s used by
 * `runForever`'s literal long-poll) so a single tick doesn't eat the whole
 * per-minute execution budget waiting on Telegram.
 */
async function pollAndRouteTick({ fetchImpl = fetch, env = process.env, storePath, timeoutSeconds = 20, now = Date.now() } = {}) {
  await guardSingleConsumer({ storePath, env, now });

  const offset = await getUpdateOffset({ storePath });
  const updates = await pollOnce({ offset: offset ?? undefined, timeoutSeconds, fetchImpl, env });

  const results = [];
  let nextOffset = offset;
  for (const update of updates) {
    nextOffset = update.update_id + 1;
    const result = await routeUpdate(update, { fetchImpl, env, storePath });
    if (!result.ok && result.reason !== 'not_a_reply' && result.reason !== 'not_a_message') {
      console.warn('[telegram-bridge] unrouted update', update.update_id, result.reason);
    }
    results.push({ updateId: update.update_id, ...result });
  }
  if (nextOffset !== offset) await setUpdateOffset(nextOffset, { storePath });
  return results;
}

if (require.main === module) {
  runForever().catch((err) => {
    console.error('[telegram-bridge] poll loop crashed', err);
    process.exit(1);
  });
}

module.exports = { pollOnce, routeUpdate, runForever, pollAndRouteTick };
