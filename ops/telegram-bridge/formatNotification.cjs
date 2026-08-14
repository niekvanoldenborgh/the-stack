'use strict';

/**
 * Pure formatting for outbound Telegram notifications.
 *
 * Input shape (subset of what the Paperclip issues/interactions API returns —
 * kept intentionally loose so callers can pass either an interaction payload
 * or a `blocked` issue payload without translation):
 *
 *   {
 *     issueId: string,
 *     issueKey?: string,        // e.g. "THEA-20", shown if present
 *     issueTitle: string,
 *     reason: 'interaction' | 'blocked',
 *     kind?: string,            // interaction kind, e.g. 'ask_user_questions'
 *     summary?: string,         // what's needed, human-readable
 *     unblockOwner?: string,    // for reason: 'blocked'
 *     url: string,              // deep link back to the issue/interaction
 *   }
 *
 * Returns { text } where text is Telegram MarkdownV2-safe plain text (no
 * markdown entities used, so no escaping is required).
 */
function buildNotificationMessage(event) {
  if (!event || typeof event !== 'object') {
    throw new TypeError('buildNotificationMessage: event is required');
  }
  const { issueId, issueKey, issueTitle, reason, kind, summary, unblockOwner, url } = event;
  if (!issueId) throw new TypeError('buildNotificationMessage: event.issueId is required');
  if (!issueTitle) throw new TypeError('buildNotificationMessage: event.issueTitle is required');
  if (!url) throw new TypeError('buildNotificationMessage: event.url is required');

  const label = issueKey ? `${issueKey}: ${issueTitle}` : issueTitle;
  const lines = [`🔔 Needs your input — ${label}`];

  if (reason === 'blocked') {
    lines.push(`Status: blocked${unblockOwner ? ` (owner: ${unblockOwner})` : ''}`);
  } else {
    lines.push(`Interaction: ${kind || 'human input requested'}`);
  }

  if (summary) lines.push(summary);
  lines.push(url);

  return { text: lines.join('\n\n') };
}

module.exports = { buildNotificationMessage };
