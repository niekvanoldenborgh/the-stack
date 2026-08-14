'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { buildNotificationMessage } = require('../ops/telegram-bridge/formatNotification.cjs');
const { mapReplyToInteraction } = require('../ops/telegram-bridge/mapUpdate.cjs');

describe('telegram-bridge / formatNotification', () => {
  it('formats an interaction notification with kind and summary', () => {
    const { text } = buildNotificationMessage({
      issueId: 'issue-1',
      issueKey: 'THEA-20',
      issueTitle: 'Telegram bridge',
      reason: 'interaction',
      kind: 'ask_user_questions',
      summary: 'Where should the token live?',
      url: 'https://example.test/issues/issue-1',
    });
    assert.match(text, /THEA-20: Telegram bridge/);
    assert.match(text, /ask_user_questions/);
    assert.match(text, /Where should the token live\?/);
    assert.match(text, /https:\/\/example\.test\/issues\/issue-1/);
  });

  it('formats a blocked-issue notification with the unblock owner', () => {
    const { text } = buildNotificationMessage({
      issueId: 'issue-2',
      issueTitle: 'Ship the thing',
      reason: 'blocked',
      unblockOwner: 'owner@example.test',
      url: 'https://example.test/issues/issue-2',
    });
    assert.match(text, /blocked/);
    assert.match(text, /owner@example\.test/);
  });

  it('requires issueId, issueTitle, and url', () => {
    assert.throws(() => buildNotificationMessage({ issueTitle: 'x', url: 'y' }), TypeError);
    assert.throws(() => buildNotificationMessage({ issueId: 'x', url: 'y' }), TypeError);
    assert.throws(() => buildNotificationMessage({ issueId: 'x', issueTitle: 'y' }), TypeError);
  });
});

describe('telegram-bridge / mapReplyToInteraction', () => {
  const pending = new Map([
    [
      101,
      {
        issueId: 'issue-1',
        interactionId: 'int-1',
        kind: 'ask_user_questions_freetext',
        questionId: 'q1',
        freeTextOptionId: 'other',
      },
    ],
    [102, { issueId: 'issue-2', interactionId: 'int-2', kind: 'unsupported' }],
  ]);

  it('routes a reply to the matching pending interaction', () => {
    const update = {
      message: { text: 'Use the Paperclip secrets store', reply_to_message: { message_id: 101 } },
    };
    const result = mapReplyToInteraction(update, pending);
    assert.deepEqual(result, {
      ok: true,
      issueId: 'issue-1',
      interactionId: 'int-1',
      questionId: 'q1',
      freeTextOptionId: 'other',
      responseText: 'Use the Paperclip secrets store',
    });
  });

  it('rejects a non-reply message rather than guessing the target', () => {
    const update = { message: { text: 'hello' } };
    assert.equal(mapReplyToInteraction(update, pending).ok, false);
    assert.equal(mapReplyToInteraction(update, pending).reason, 'not_a_reply');
  });

  it('rejects a reply with no matching pending message', () => {
    const update = { message: { text: 'hi', reply_to_message: { message_id: 999 } } };
    const result = mapReplyToInteraction(update, pending);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_pending_match');
  });

  it('rejects an unsupported interaction kind instead of mis-routing free text', () => {
    const update = { message: { text: 'yes', reply_to_message: { message_id: 102 } } };
    const result = mapReplyToInteraction(update, pending);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unsupported_interaction_kind');
  });

  it('rejects an update with no message', () => {
    assert.equal(mapReplyToInteraction({}, pending).reason, 'not_a_message');
  });

  it('accepts a plain-object pending map, not just a Map', () => {
    const update = { message: { text: 'ok', reply_to_message: { message_id: 101 } } };
    const plainPending = { 101: pending.get(101) };
    assert.equal(mapReplyToInteraction(update, plainPending).ok, true);
  });
});
