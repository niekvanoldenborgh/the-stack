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
 * Required env:
 *   TELEGRAM_BOT_TOKEN
 *   PAPERCLIP_API_URL
 *   PAPERCLIP_API_KEY
 */

const { mapReplyToInteraction } = require('./mapUpdate.cjs');
const { getPendingMap } = require('./pendingStore.cjs');

async function pollOnce({ offset, fetchImpl = fetch, env = process.env } = {}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');

  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set('timeout', '30');
  if (offset != null) url.searchParams.set('offset', String(offset));

  const res = await fetchImpl(url.toString());
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram getUpdates failed: ${body.description || res.status}`);
  return body.result;
}

async function routeUpdate(update, { fetchImpl = fetch, env = process.env } = {}) {
  const pending = await getPendingMap();
  const routed = mapReplyToInteraction(update, pending);
  if (!routed.ok) return routed;

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
    return { ok: false, reason: `paperclip_respond_failed_${res.status}` };
  }
  return { ok: true, issueId: routed.issueId, interactionId: routed.interactionId };
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

if (require.main === module) {
  runForever().catch((err) => {
    console.error('[telegram-bridge] poll loop crashed', err);
    process.exit(1);
  });
}

module.exports = { pollOnce, routeUpdate, runForever };
