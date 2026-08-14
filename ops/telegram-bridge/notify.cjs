'use strict';

/**
 * Outbound half of the Telegram bridge (THEA-20).
 *
 * Sends one Telegram message for an issue-thread interaction / blocked
 * issue and records the resulting Telegram message id against the
 * interaction so an inbound reply can be routed back (see poll.cjs +
 * mapUpdate.cjs).
 *
 * Inbound routing only works automatically for the single-question,
 * free-text-option shape of `ask_user_questions` (Paperclip's respond API
 * takes structured questionId/optionIds, not raw text — see poll.cjs).
 * Pass `event.route` to describe that shape; omit it (or pass a
 * multi-question / request_confirmation interaction) and the notification
 * still sends, but a reply to it will be reported as unsupported rather
 * than silently mis-routed.
 *
 * NOT wired to run automatically yet — see ../README.md for the two
 * decisions (secret storage, runtime host) that block turning this into a
 * running bridge instead of a script.
 *
 * Required env (never hardcode these — see README):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 */

const { buildNotificationMessage } = require('./formatNotification.cjs');
const { recordPending } = require('./pendingStore.cjs');

async function sendNotification(event, { fetchImpl = fetch, env = process.env } = {}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID is not set');

  const { text } = buildNotificationMessage(event);

  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  });

  const body = await res.json();
  if (!body.ok) {
    throw new Error(`Telegram sendMessage failed: ${body.description || res.status}`);
  }

  const messageId = body.result.message_id;
  const pendingEntry = event.route
    ? {
        issueId: event.issueId,
        interactionId: event.interactionId,
        kind: 'ask_user_questions_freetext',
        questionId: event.route.questionId,
        freeTextOptionId: event.route.freeTextOptionId,
      }
    : { issueId: event.issueId, interactionId: event.interactionId, kind: 'unsupported' };
  await recordPending(messageId, pendingEntry);
  return { messageId };
}

module.exports = { sendNotification };
