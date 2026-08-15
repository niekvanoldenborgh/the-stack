'use strict';

/**
 * Pure logic for routing an inbound Telegram reply back to a Paperclip
 * issue-thread interaction.
 *
 * Primary routing rule: a reply maps to an interaction if it is a Telegram
 * "reply" (reply_to_message) to the exact message the bridge sent for that
 * interaction. We deliberately do NOT guess when 2+ interactions are
 * pending in the chat — that would silently misroute a human's answer to
 * the wrong issue, which is worse than dropping an unmatched message and
 * asking them to retry.
 *
 * Fallback (THEA-28): when the message is NOT a reply at all and exactly
 * ONE interaction is pending, route it there anyway. A plain typed message
 * used to be dropped outright (`not_a_reply`), which read as "nothing
 * happened" to the sender even on the common one-question-outstanding
 * case. This is safe now that routeUpdate() always sends a Telegram ack or
 * hint (THEA-28 #1) — a wrong match is reported, not silent — and
 * `poll.cjs` removes an entry from the pending store as soon as it's
 * routed, so "exactly one" reflects what's genuinely still awaiting an
 * answer, not just what was ever sent.
 *
 * `pendingByMessageId` is a Map (or plain object) of
 *   telegramMessageId (number|string) -> { issueId, interactionId,
 *     issueTitle, kind, questionId?, freeTextOptionId? }
 * populated by notify.cjs when it sends the original notification.
 */

function pendingEntries(pendingByMessageId) {
  if (pendingByMessageId instanceof Map) return Array.from(pendingByMessageId.entries());
  return Object.entries(pendingByMessageId || {});
}

function lookupPending(pendingByMessageId, messageId) {
  return pendingByMessageId instanceof Map
    ? pendingByMessageId.get(messageId)
    : pendingByMessageId && pendingByMessageId[messageId];
}

// The Paperclip respond API takes structured answers (questionId +
// optionIds), not free text — we can only auto-route a reply when the
// interaction was a single question with a free-text option, which is what
// notify.cjs records as `kind: 'ask_user_questions_freetext'`. Anything
// else (multi-question, request_confirmation, ...) is real engineering
// scope we haven't built — surface it rather than guess.
function routeToPending(pending, text, pendingMessageId) {
  if (pending.kind !== 'ask_user_questions_freetext') {
    return { ok: false, reason: 'unsupported_interaction_kind', pending };
  }

  return {
    ok: true,
    issueId: pending.issueId,
    interactionId: pending.interactionId,
    issueTitle: pending.issueTitle,
    questionId: pending.questionId,
    freeTextOptionId: pending.freeTextOptionId,
    responseText: text,
    pendingMessageId,
  };
}

function mapReplyToInteraction(update, pendingByMessageId) {
  const message = update && update.message;
  if (!message) return { ok: false, reason: 'not_a_message' };

  const replyTo = message.reply_to_message;
  const text = typeof message.text === 'string' ? message.text.trim() : '';

  if (replyTo && replyTo.message_id != null) {
    if (!text) return { ok: false, reason: 'empty_text' };
    const pending = lookupPending(pendingByMessageId, replyTo.message_id);
    if (!pending) return { ok: false, reason: 'no_pending_match' };
    return routeToPending(pending, text, replyTo.message_id);
  }

  // Not a reply. Fall back only when exactly one interaction is pending —
  // with 2+ pending, keep dropping it (`not_a_reply`) rather than guess.
  const entries = pendingEntries(pendingByMessageId);
  if (entries.length === 1) {
    if (!text) return { ok: false, reason: 'empty_text' };
    const [pendingMessageId, pending] = entries[0];
    return routeToPending(pending, text, pendingMessageId);
  }

  return { ok: false, reason: 'not_a_reply' };
}

module.exports = { mapReplyToInteraction };
