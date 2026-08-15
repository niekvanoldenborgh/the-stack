'use strict';

/**
 * Outbound half of `runBridgeTick`: find issues/interactions that need a
 * human and haven't been notified yet, send one Telegram message each.
 *
 * Fetch shape: Paperclip's `/api/companies/{companyId}/attention` endpoint
 * (the purpose-built aggregate feed for this) requires Board access this
 * agent doesn't have — confirmed live, see README. So this walks
 * `/api/companies/{companyId}/issues` (works for an agent) and calls
 * `/api/issues/{id}/interactions` per non-terminal issue. That's an N+1
 * fetch, acceptable at this company's issue count (~20s); if that stops
 * being true, add a per-issue `updatedAt` watermark to skip unchanged
 * issues before adding real pagination/filtering.
 *
 * Required env:
 *   PAPERCLIP_API_URL, PAPERCLIP_API_KEY  — same credentials the agent uses
 *   PAPERCLIP_COMPANY_ID
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  — passed through to notify.cjs
 *   PAPERCLIP_APP_BASE_URL                — optional; see buildIssueUrl
 */

const { sendNotification } = require('./notify.cjs');
const { computeAutoRoute } = require('./interactionRoute.cjs');
const { findNotifiableEvents } = require('./notifiableEvents.cjs');
const { getNotifiedState, markInteractionNotified, markBlockedIssueNotified } = require('./pendingStore.cjs');

const TERMINAL_STATUSES = new Set(['done', 'cancelled']);

function apiBase(env) {
  return String(env.PAPERCLIP_API_URL || '').replace(/\/$/, '').replace(/\/api$/, '');
}

async function fetchCompanyIssues({ env, fetchImpl }) {
  const res = await fetchImpl(`${apiBase(env)}/api/companies/${env.PAPERCLIP_COMPANY_ID}/issues`, {
    headers: { Authorization: `Bearer ${env.PAPERCLIP_API_KEY}` },
  });
  if (!res.ok) throw new Error(`fetchCompanyIssues failed: ${res.status}`);
  return res.json();
}

async function fetchIssueInteractions(issueId, { env, fetchImpl }) {
  const res = await fetchImpl(`${apiBase(env)}/api/issues/${issueId}/interactions`, {
    headers: { Authorization: `Bearer ${env.PAPERCLIP_API_KEY}` },
  });
  if (!res.ok) throw new Error(`fetchIssueInteractions failed for ${issueId}: ${res.status}`);
  return res.json();
}

/**
 * Deep link back to the issue. Paperclip's dashboard URL isn't exposed by
 * any API this agent can reach, so this is a best-effort guess
 * (`PAPERCLIP_APP_BASE_URL` env, e.g. the Board's dashboard origin) with a
 * fallback to the API URL itself — clickable, but resolves to JSON rather
 * than the issue page until the real base URL is confirmed and set. Flagged
 * in README as a go-live gap, not invented as fact.
 */
function buildIssueUrl(issue, env) {
  const base = String(env.PAPERCLIP_APP_BASE_URL || apiBase(env)).replace(/\/$/, '');
  return `${base}/issues/${issue.identifier || issue.id}`;
}

function describeUnblockOwner(unblockDescriptor) {
  const owner = unblockDescriptor && unblockDescriptor.owner;
  if (!owner) return undefined;
  return owner.userId || owner.name || owner.email || 'owner';
}

function buildEventPayload(event, env) {
  const { issue } = event;
  const base = {
    issueId: issue.id,
    issueKey: issue.identifier,
    issueTitle: issue.title,
    url: buildIssueUrl(issue, env),
  };

  if (event.type === 'interaction') {
    const { interaction } = event;
    const route = computeAutoRoute(interaction);
    return {
      ...base,
      interactionId: interaction.id,
      reason: 'interaction',
      kind: interaction.kind,
      summary: interaction.summary || interaction.title,
      ...(route ? { route } : {}),
    };
  }

  return {
    ...base,
    interactionId: undefined,
    reason: 'blocked',
    unblockOwner: describeUnblockOwner(issue.unblockDescriptor),
  };
}

async function scanAndNotify({ env = process.env, fetchImpl = fetch, storePath } = {}) {
  const issues = (await fetchCompanyIssues({ env, fetchImpl })).filter((issue) => !TERMINAL_STATUSES.has(issue.status));

  const interactionsByIssueId = {};
  for (const issue of issues) {
    interactionsByIssueId[issue.id] = await fetchIssueInteractions(issue.id, { env, fetchImpl });
  }

  const notified = await getNotifiedState({ storePath });
  const events = findNotifiableEvents({ issues, interactionsByIssueId, notified });

  const sent = [];
  for (const event of events) {
    const payload = buildEventPayload(event, env);
    const { messageId } = await sendNotification(payload, { fetchImpl, env, storePath });
    if (event.type === 'interaction') {
      await markInteractionNotified(event.interaction.id, { storePath });
    } else {
      await markBlockedIssueNotified(event.issue.id, { storePath });
    }
    sent.push({ type: event.type, issueId: event.issue.id, interactionId: event.interaction && event.interaction.id, messageId });
  }
  return sent;
}

module.exports = { scanAndNotify, fetchCompanyIssues, fetchIssueInteractions, buildEventPayload, buildIssueUrl };
