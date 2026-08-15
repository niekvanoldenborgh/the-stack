'use strict';

/**
 * Durable state for the Telegram bridge, shared by both halves of
 * `runBridgeTick` (inbound poll+route, outbound scan+notify).
 *
 * Each scheduled routine tick is a separate process execution — nothing
 * held in memory survives to the next tick — so this has to be a file the
 * next tick can re-read. Single JSON file, read-modify-write; correct for
 * one poller instance at a time (the runtime-host decision was a single
 * scheduled routine, not multiple replicas — see README.md).
 *
 * Sections:
 *   pendingByMessageId    — Telegram message_id -> { issueId, interactionId,
 *                            issueTitle, kind, questionId?,
 *                            freeTextOptionId? }, written by notify.cjs, read
 *                            by poll.cjs to route replies, and deleted by
 *                            poll.cjs once a reply is routed (THEA-28) so the
 *                            single-pending fallback in mapUpdate.cjs reflects
 *                            what's actually still awaiting an answer.
 *   updateOffset          — last-processed Telegram update_id + 1, so a tick
 *                            doesn't re-fetch updates it already routed.
 *   notifiedInteractionIds — interaction ids already notified, so scan.cjs
 *                            doesn't re-notify every tick.
 *   notifiedBlockedIssueIds — same, for `blocked`-issue notifications.
 *   lastPoller             — { instanceId, at } for the most recent
 *                            pollAndRouteTick call, so a second concurrent
 *                            poller against the same store can be detected
 *                            (THEA-28 #3) — see singleConsumerGuard.cjs.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PATH = path.join(__dirname, '.pending-store.json');

const EMPTY_STORE = () => ({
  pendingByMessageId: {},
  updateOffset: null,
  notifiedInteractionIds: [],
  notifiedBlockedIssueIds: [],
  lastPoller: null,
});

function load(storePath) {
  try {
    const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return { ...EMPTY_STORE(), ...data };
  } catch (err) {
    if (err.code === 'ENOENT') return EMPTY_STORE();
    throw err;
  }
}

function save(storePath, data) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

async function recordPending(messageId, entry, { storePath = DEFAULT_PATH } = {}) {
  const data = load(storePath);
  data.pendingByMessageId[String(messageId)] = entry;
  save(storePath, data);
}

async function getPendingMap({ storePath = DEFAULT_PATH } = {}) {
  return load(storePath).pendingByMessageId;
}

/** Drop a routed (or otherwise resolved) entry so it stops counting as pending. */
async function removePending(messageId, { storePath = DEFAULT_PATH } = {}) {
  const data = load(storePath);
  delete data.pendingByMessageId[String(messageId)];
  save(storePath, data);
}

async function getUpdateOffset({ storePath = DEFAULT_PATH } = {}) {
  return load(storePath).updateOffset;
}

async function setUpdateOffset(offset, { storePath = DEFAULT_PATH } = {}) {
  const data = load(storePath);
  data.updateOffset = offset;
  save(storePath, data);
}

async function isInteractionNotified(interactionId, { storePath = DEFAULT_PATH } = {}) {
  return load(storePath).notifiedInteractionIds.includes(interactionId);
}

/** One-read snapshot of both notified-id sets, for callers checking many ids at once. */
async function getNotifiedState({ storePath = DEFAULT_PATH } = {}) {
  const data = load(storePath);
  return { interactionIds: data.notifiedInteractionIds, blockedIssueIds: data.notifiedBlockedIssueIds };
}

async function markInteractionNotified(interactionId, { storePath = DEFAULT_PATH } = {}) {
  const data = load(storePath);
  if (!data.notifiedInteractionIds.includes(interactionId)) {
    data.notifiedInteractionIds.push(interactionId);
    save(storePath, data);
  }
}

async function isBlockedIssueNotified(issueId, { storePath = DEFAULT_PATH } = {}) {
  return load(storePath).notifiedBlockedIssueIds.includes(issueId);
}

async function markBlockedIssueNotified(issueId, { storePath = DEFAULT_PATH } = {}) {
  const data = load(storePath);
  if (!data.notifiedBlockedIssueIds.includes(issueId)) {
    data.notifiedBlockedIssueIds.push(issueId);
    save(storePath, data);
  }
}

async function getLastPoller({ storePath = DEFAULT_PATH } = {}) {
  return load(storePath).lastPoller;
}

async function recordPoller(instanceId, at, { storePath = DEFAULT_PATH } = {}) {
  const data = load(storePath);
  data.lastPoller = { instanceId, at };
  save(storePath, data);
}

module.exports = {
  DEFAULT_PATH,
  recordPending,
  getPendingMap,
  removePending,
  getUpdateOffset,
  setUpdateOffset,
  isInteractionNotified,
  getNotifiedState,
  markInteractionNotified,
  isBlockedIssueNotified,
  markBlockedIssueNotified,
  getLastPoller,
  recordPoller,
};
