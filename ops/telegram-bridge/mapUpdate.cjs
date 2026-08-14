'use strict';

/**
 * Pure logic for routing an inbound Telegram reply back to a Paperclip
 * issue-thread interaction.
 *
 * Routing rule: a reply only maps to an interaction if it is a Telegram
 * "reply" (reply_to_message) to the exact message the bridge sent for that
 * interaction. We deliberately do NOT fall back to "most recent pending
 * interaction in the chat" — with multiple issues notifying concurrently,
 * that would silently misroute a human's answer to the wrong issue, which
 * is worse than dropping an unmatched message and asking them to retry.
 *
 * `pendingByMessageId` is a Map (or plain object) of
 *   telegramMessageId (number|string) -> { issueId, interactionId }
 * populated by notify.cjs when it sends the original notification.
 */
function mapReplyToInteraction(update, pendingByMessageId) {
  const message = update && update.message;
  if (!message) return { ok: false, reason: 'not_a_message' };

  const replyTo = message.reply_to_message;
  if (!replyTo || replyTo.message_id == null) {
    return { ok: false, reason: 'not_a_reply' };
  }

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text) return { ok: false, reason: 'empty_text' };

  const pending =
    pendingByMessageId instanceof Map
      ? pendingByMessageId.get(replyTo.message_id)
      : pendingByMessageId && pendingByMessageId[replyTo.message_id];

  if (!pending) return { ok: false, reason: 'no_pending_match' };

  // The Paperclip respond API takes structured answers (questionId +
  // optionIds), not free text — we can only auto-route a reply when the
  // interaction was a single question with a free-text option, which is
  // what notify.cjs records as `kind: 'ask_user_questions_freetext'`.
  // Anything else (multi-question, request_confirmation, ...) is real
  // engineering scope we haven't built — surface it rather than guess.
  if (pending.kind !== 'ask_user_questions_freetext') {
    return { ok: false, reason: 'unsupported_interaction_kind', pending };
  }

  return {
    ok: true,
    issueId: pending.issueId,
    interactionId: pending.interactionId,
    questionId: pending.questionId,
    freeTextOptionId: pending.freeTextOptionId,
    responseText: text,
  };
}

module.exports = { mapReplyToInteraction };
