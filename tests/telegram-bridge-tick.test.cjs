'use strict';

const assert = require('node:assert/strict');
const { describe, it, afterEach } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  recordPending,
  getPendingMap,
  removePending,
  getUpdateOffset,
  setUpdateOffset,
  getNotifiedState,
  markInteractionNotified,
  markBlockedIssueNotified,
  getLastPoller,
  recordPoller,
} = require('../ops/telegram-bridge/pendingStore.cjs');
const { computeAutoRoute } = require('../ops/telegram-bridge/interactionRoute.cjs');
const { detectSecondConsumer } = require('../ops/telegram-bridge/singleConsumerGuard.cjs');
const { findNotifiableEvents, isHumanOnlyInteraction, isHumanUnblockOwner } = require('../ops/telegram-bridge/notifiableEvents.cjs');
const { scanAndNotify, buildEventPayload, buildIssueUrl } = require('../ops/telegram-bridge/scan.cjs');
const { pollAndRouteTick, routeUpdate } = require('../ops/telegram-bridge/poll.cjs');
const { runBridgeTick, loadDotEnv, parseDotEnv } = require('../ops/telegram-bridge/runBridgeTick.cjs');

const tmpStores = [];
function tmpStorePath() {
  const p = path.join(os.tmpdir(), `telegram-bridge-test-${tmpStores.length}-${process.pid}.json`);
  tmpStores.push(p);
  return p;
}
afterEach(() => {
  while (tmpStores.length) {
    const p = tmpStores.pop();
    fs.rmSync(p, { force: true });
  }
});

describe('pendingStore', () => {
  it('persists the pending message map across separate calls', async () => {
    const storePath = tmpStorePath();
    await recordPending(1, { issueId: 'i1', interactionId: 'x1', kind: 'ask_user_questions_freetext' }, { storePath });
    const map = await getPendingMap({ storePath });
    assert.deepEqual(map['1'], { issueId: 'i1', interactionId: 'x1', kind: 'ask_user_questions_freetext' });
  });

  it('persists the update offset across separate calls', async () => {
    const storePath = tmpStorePath();
    assert.equal(await getUpdateOffset({ storePath }), null);
    await setUpdateOffset(42, { storePath });
    assert.equal(await getUpdateOffset({ storePath }), 42);
  });

  it('tracks notified interaction and blocked-issue ids without duplicates', async () => {
    const storePath = tmpStorePath();
    await markInteractionNotified('int-1', { storePath });
    await markInteractionNotified('int-1', { storePath }); // idempotent
    await markBlockedIssueNotified('issue-1', { storePath });
    const state = await getNotifiedState({ storePath });
    assert.deepEqual(state.interactionIds, ['int-1']);
    assert.deepEqual(state.blockedIssueIds, ['issue-1']);
  });

  it('starts empty when no store file exists yet', async () => {
    const storePath = tmpStorePath();
    const state = await getNotifiedState({ storePath });
    assert.deepEqual(state, { interactionIds: [], blockedIssueIds: [] });
  });

  it('removes a pending entry once routed', async () => {
    const storePath = tmpStorePath();
    await recordPending(101, { issueId: 'i1', interactionId: 'x1', kind: 'ask_user_questions_freetext' }, { storePath });
    await removePending(101, { storePath });
    const map = await getPendingMap({ storePath });
    assert.equal(map['101'], undefined);
  });

  it('tracks the last poller instance and timestamp', async () => {
    const storePath = tmpStorePath();
    assert.equal(await getLastPoller({ storePath }), null);
    await recordPoller('host-a:123', 1000, { storePath });
    assert.deepEqual(await getLastPoller({ storePath }), { instanceId: 'host-a:123', at: 1000 });
  });
});

describe('singleConsumerGuard / detectSecondConsumer', () => {
  it('warns when a different instance polled recently', () => {
    const warn = detectSecondConsumer({
      lastPoller: { instanceId: 'host-a:1', at: 1000 },
      instanceId: 'host-b:2',
      now: 1000 + 10_000,
    });
    assert.equal(warn, true);
  });

  it('does not warn for the same instance polling again', () => {
    const warn = detectSecondConsumer({
      lastPoller: { instanceId: 'host-a:1', at: 1000 },
      instanceId: 'host-a:1',
      now: 1000 + 10_000,
    });
    assert.equal(warn, false);
  });

  it('does not warn once the guard window has passed', () => {
    const warn = detectSecondConsumer({
      lastPoller: { instanceId: 'host-a:1', at: 1000 },
      instanceId: 'host-b:2',
      now: 1000 + 100_000,
    });
    assert.equal(warn, false);
  });

  it('does not warn when there is no prior poller', () => {
    assert.equal(detectSecondConsumer({ lastPoller: null, instanceId: 'host-a:1', now: 1000 }), false);
  });
});

describe('interactionRoute / computeAutoRoute', () => {
  it('routes a single-question ask_user_questions interaction with a free-text option', () => {
    const interaction = {
      kind: 'ask_user_questions',
      payload: { questions: [{ id: 'q1', options: [{ id: 'other', freeText: true }] }] },
    };
    assert.deepEqual(computeAutoRoute(interaction), { questionId: 'q1', freeTextOptionId: 'other' });
  });

  it('does not route a multi-question interaction', () => {
    const interaction = {
      kind: 'ask_user_questions',
      payload: {
        questions: [
          { id: 'q1', options: [{ id: 'other', freeText: true }] },
          { id: 'q2', options: [{ id: 'other', freeText: true }] },
        ],
      },
    };
    assert.equal(computeAutoRoute(interaction), null);
  });

  it('does not route a question with no free-text option', () => {
    const interaction = { kind: 'ask_user_questions', payload: { questions: [{ id: 'q1', options: [{ id: 'yes' }] }] } };
    assert.equal(computeAutoRoute(interaction), null);
  });

  it('does not route request_confirmation', () => {
    assert.equal(computeAutoRoute({ kind: 'request_confirmation', payload: {} }), null);
  });
});

describe('notifiableEvents', () => {
  it('flags a pending board_only interaction as human-only', () => {
    assert.equal(isHumanOnlyInteraction({ status: 'pending', effectiveResolverPolicy: 'board_only' }), true);
    assert.equal(isHumanOnlyInteraction({ status: 'pending', effectiveResolverPolicy: 'agent_or_board' }), false);
    assert.equal(isHumanOnlyInteraction({ status: 'resolved', effectiveResolverPolicy: 'board_only' }), false);
  });

  it('flags a human-owned unblock descriptor, not an agent-owned one', () => {
    assert.equal(isHumanUnblockOwner({ owner: { userId: 'u1' } }), true);
    assert.equal(isHumanUnblockOwner({ owner: { agentId: 'a1' } }), false);
    assert.equal(isHumanUnblockOwner(null), false);
  });

  it('emits an event per new human-only interaction and skips already-notified ones', () => {
    const issues = [{ id: 'issue-1', status: 'in_progress' }];
    const interactionsByIssueId = {
      'issue-1': [
        { id: 'int-1', status: 'pending', effectiveResolverPolicy: 'board_only' },
        { id: 'int-2', status: 'pending', effectiveResolverPolicy: 'board_only' },
        { id: 'int-3', status: 'resolved', effectiveResolverPolicy: 'board_only' },
      ],
    };
    const events = findNotifiableEvents({
      issues,
      interactionsByIssueId,
      notified: { interactionIds: ['int-2'], blockedIssueIds: [] },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].interaction.id, 'int-1');
  });

  it('emits a blocked event only for a human owner, and only once', () => {
    const humanBlocked = { id: 'issue-2', status: 'blocked', unblockDescriptor: { owner: { userId: 'u1' } } };
    const agentBlocked = { id: 'issue-3', status: 'blocked', unblockDescriptor: { owner: { agentId: 'a1' } } };
    const events = findNotifiableEvents({
      issues: [humanBlocked, agentBlocked],
      interactionsByIssueId: {},
      notified: { interactionIds: [], blockedIssueIds: [] },
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].issue.id, 'issue-2');

    const alreadyNotified = findNotifiableEvents({
      issues: [humanBlocked],
      interactionsByIssueId: {},
      notified: { interactionIds: [], blockedIssueIds: ['issue-2'] },
    });
    assert.equal(alreadyNotified.length, 0);
  });
});

describe('scan / buildEventPayload + buildIssueUrl', () => {
  const env = { PAPERCLIP_API_URL: 'https://paper.example.test/api' };

  it('builds an interaction payload with an auto-detected route', () => {
    const event = {
      type: 'interaction',
      issue: { id: 'issue-1', identifier: 'THEA-1', title: 'Do the thing' },
      interaction: {
        id: 'int-1',
        kind: 'ask_user_questions',
        summary: 'Pick an option',
        payload: { questions: [{ id: 'q1', options: [{ id: 'other', freeText: true }] }] },
      },
    };
    const payload = buildEventPayload(event, env);
    assert.equal(payload.reason, 'interaction');
    assert.equal(payload.interactionId, 'int-1');
    assert.deepEqual(payload.route, { questionId: 'q1', freeTextOptionId: 'other' });
    assert.equal(payload.url, 'https://paper.example.test/issues/THEA-1');
  });

  it('builds a blocked payload with the described owner', () => {
    const event = {
      type: 'blocked',
      issue: { id: 'issue-2', identifier: 'THEA-2', title: 'Ship it', unblockDescriptor: { owner: { userId: 'owner@example.test' } } },
    };
    const payload = buildEventPayload(event, env);
    assert.equal(payload.reason, 'blocked');
    assert.equal(payload.unblockOwner, 'owner@example.test');
  });

  it('prefers PAPERCLIP_APP_BASE_URL for the deep link when set', () => {
    const issue = { id: 'issue-1', identifier: 'THEA-1' };
    assert.equal(
      buildIssueUrl(issue, { ...env, PAPERCLIP_APP_BASE_URL: 'https://dashboard.example.test' }),
      'https://dashboard.example.test/issues/THEA-1'
    );
  });
});

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('scanAndNotify (fetch injected)', () => {
  it('notifies once for a new human-only interaction, then skips it on a second tick', async () => {
    const storePath = tmpStorePath();
    const env = {
      PAPERCLIP_API_URL: 'https://paper.example.test/api',
      PAPERCLIP_COMPANY_ID: 'company-1',
      PAPERCLIP_API_KEY: 'key',
      TELEGRAM_BOT_TOKEN: 'token',
      TELEGRAM_CHAT_ID: 'chat',
    };
    const issue = { id: 'issue-1', identifier: 'THEA-1', title: 'Needs a human', status: 'in_progress' };
    const interaction = { id: 'int-1', status: 'pending', effectiveResolverPolicy: 'board_only', kind: 'ask_user_questions', summary: 's', payload: {} };

    let sendMessageCalls = 0;
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/api/companies/company-1/issues')) return jsonResponse([issue]);
      if (u.includes('/api/issues/issue-1/interactions')) return jsonResponse([interaction]);
      if (u.includes('api.telegram.org')) {
        sendMessageCalls += 1;
        return jsonResponse({ ok: true, result: { message_id: 555 } });
      }
      throw new Error(`unexpected fetch: ${u}`);
    };

    const first = await scanAndNotify({ env, fetchImpl, storePath });
    assert.equal(first.length, 1);
    assert.equal(sendMessageCalls, 1);

    const second = await scanAndNotify({ env, fetchImpl, storePath });
    assert.equal(second.length, 0);
    assert.equal(sendMessageCalls, 1); // not re-sent
  });

  it('excludes done/cancelled issues from the scan', async () => {
    const storePath = tmpStorePath();
    const env = { PAPERCLIP_API_URL: 'https://paper.example.test/api', PAPERCLIP_COMPANY_ID: 'company-1', PAPERCLIP_API_KEY: 'key' };
    const doneIssue = { id: 'issue-done', identifier: 'THEA-9', title: 'Old', status: 'done' };

    let interactionsFetched = false;
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/api/companies/company-1/issues')) return jsonResponse([doneIssue]);
      interactionsFetched = true;
      return jsonResponse([]);
    };

    const result = await scanAndNotify({ env, fetchImpl, storePath });
    assert.equal(result.length, 0);
    assert.equal(interactionsFetched, false);
  });
});

function telegramCallRouter(handlers) {
  return async (url, opts) => {
    const u = String(url);
    if (u.includes('/getUpdates')) return handlers.getUpdates(u);
    if (u.includes('/sendMessage')) return handlers.sendMessage(JSON.parse(opts.body));
    if (u.includes('/respond')) return handlers.respond(u, opts && JSON.parse(opts.body));
    throw new Error(`unexpected fetch: ${u}`);
  };
}

describe('pollAndRouteTick', () => {
  it('persists the update offset and routes a reply, using it on the next tick', async () => {
    const storePath = tmpStorePath();
    await recordPending(101, { issueId: 'issue-1', interactionId: 'int-1', issueTitle: 'Telegram bridge', kind: 'ask_user_questions_freetext', questionId: 'q1', freeTextOptionId: 'other' }, { storePath });

    const env = { TELEGRAM_BOT_TOKEN: 'token', PAPERCLIP_API_URL: 'https://paper.example.test/api', PAPERCLIP_API_KEY: 'key' };
    const update = {
      update_id: 9001,
      message: { message_id: 501, chat: { id: -1 }, text: 'Use the secrets store', reply_to_message: { message_id: 101 } },
    };

    const seenOffsets = [];
    const sendMessages = [];
    const fetchImpl = telegramCallRouter({
      getUpdates: (u) => {
        seenOffsets.push(new URL(u).searchParams.get('offset'));
        return jsonResponse({ ok: true, result: seenOffsets.length === 1 ? [update] : [] });
      },
      sendMessage: (body) => {
        sendMessages.push(body);
        return jsonResponse({ ok: true, result: { message_id: 900 } });
      },
      respond: () => jsonResponse({ ok: true }),
    });

    const first = await pollAndRouteTick({ env, fetchImpl, storePath });
    assert.equal(first.length, 1);
    assert.equal(first[0].ok, true);
    assert.equal(await getUpdateOffset({ storePath }), 9002);

    // Ack sent on success, threaded as a reply to the inbound message.
    assert.equal(sendMessages.length, 1);
    assert.match(sendMessages[0].text, /✅ Got it — routed to Telegram bridge/);
    assert.equal(sendMessages[0].reply_to_message_id, 501);

    // Routed entry is cleared so it stops counting as pending.
    assert.equal((await getPendingMap({ storePath }))['101'], undefined);

    await pollAndRouteTick({ env, fetchImpl, storePath });
    assert.equal(seenOffsets[1], '9002'); // second tick resumes from the persisted offset
  });

  it('sends a hint instead of an ack when the reply cannot be matched', async () => {
    const storePath = tmpStorePath();
    const env = { TELEGRAM_BOT_TOKEN: 'token', PAPERCLIP_API_URL: 'https://paper.example.test/api', PAPERCLIP_API_KEY: 'key' };
    const update = {
      update_id: 9001,
      message: { message_id: 501, chat: { id: -1 }, text: 'hi', reply_to_message: { message_id: 999 } },
    };

    const sendMessages = [];
    let firstPoll = true;
    const fetchImpl = telegramCallRouter({
      getUpdates: () => {
        const result = firstPoll ? [update] : [];
        firstPoll = false;
        return jsonResponse({ ok: true, result });
      },
      sendMessage: (body) => {
        sendMessages.push(body);
        return jsonResponse({ ok: true, result: { message_id: 900 } });
      },
      respond: () => jsonResponse({ ok: true }),
    });

    const results = await pollAndRouteTick({ env, fetchImpl, storePath });
    assert.equal(results[0].ok, false);
    assert.equal(results[0].reason, 'no_pending_match');
    assert.equal(sendMessages.length, 1);
    assert.match(sendMessages[0].text, /Couldn't match that/);
  });

  it('routes a plain reply when exactly one interaction is pending', async () => {
    const storePath = tmpStorePath();
    await recordPending(101, { issueId: 'issue-1', interactionId: 'int-1', issueTitle: 'Telegram bridge', kind: 'ask_user_questions_freetext', questionId: 'q1', freeTextOptionId: 'other' }, { storePath });

    const env = { TELEGRAM_BOT_TOKEN: 'token', PAPERCLIP_API_URL: 'https://paper.example.test/api', PAPERCLIP_API_KEY: 'key' };
    const update = {
      update_id: 9001,
      message: { message_id: 502, chat: { id: -1 }, text: 'Use the secrets store' }, // no reply_to_message
    };

    let firstPoll = true;
    const sendMessages = [];
    const fetchImpl = telegramCallRouter({
      getUpdates: () => {
        const result = firstPoll ? [update] : [];
        firstPoll = false;
        return jsonResponse({ ok: true, result });
      },
      sendMessage: (body) => {
        sendMessages.push(body);
        return jsonResponse({ ok: true, result: { message_id: 900 } });
      },
      respond: () => jsonResponse({ ok: true }),
    });

    const results = await pollAndRouteTick({ env, fetchImpl, storePath });
    assert.equal(results[0].ok, true);
    assert.match(sendMessages[0].text, /✅ Got it — routed to Telegram bridge/);
  });

  it('warns when a different instance polled inside the guard window', async () => {
    const storePath = tmpStorePath();
    await recordPoller('other-host:1', 1_000, { storePath });

    const env = { TELEGRAM_BOT_TOKEN: 'token', PAPERCLIP_API_URL: 'https://paper.example.test/api', PAPERCLIP_API_KEY: 'key', TELEGRAM_BRIDGE_INSTANCE_ID: 'this-host:2' };
    const fetchImpl = telegramCallRouter({
      getUpdates: () => jsonResponse({ ok: true, result: [] }),
      sendMessage: () => jsonResponse({ ok: true, result: { message_id: 1 } }),
      respond: () => jsonResponse({ ok: true }),
    });

    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      await pollAndRouteTick({ env, fetchImpl, storePath, now: 1_000 + 5_000 });
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(warnings.some((w) => w.includes('possible second poller detected')), true);
    assert.deepEqual(await getLastPoller({ storePath }), { instanceId: 'this-host:2', at: 6_000 });
  });
});

describe('loadDotEnv / parseDotEnv (Node < 20.6 fallback)', () => {
  it('parses key=value pairs, ignoring blank lines and comments, and strips quotes', () => {
    const parsed = parseDotEnv(
      ['# a comment', '', 'FOO=bar', 'QUOTED="has spaces"', "SINGLE='also quoted'", 'EMPTY=', 'malformed line without equals'].join('\n')
    );
    assert.deepEqual(parsed, { FOO: 'bar', QUOTED: 'has spaces', SINGLE: 'also quoted', EMPTY: '' });
  });

  it('loads a fixture .env into the target env without the native loader, and process env wins', () => {
    const envFilePath = path.join(os.tmpdir(), `telegram-bridge-dotenv-test-${process.pid}.env`);
    fs.writeFileSync(envFilePath, 'TELEGRAM_BOT_TOKEN=from-file\nNEW_KEY=hello\n');
    const originalLoader = process.loadEnvFile;
    try {
      delete process.loadEnvFile; // simulate Node < 20.6, which lacks this API entirely
      const targetEnv = { TELEGRAM_BOT_TOKEN: 'from-process' };
      loadDotEnv(envFilePath, { env: targetEnv });
      assert.equal(targetEnv.TELEGRAM_BOT_TOKEN, 'from-process'); // existing key untouched
      assert.equal(targetEnv.NEW_KEY, 'hello');
    } finally {
      if (originalLoader) process.loadEnvFile = originalLoader;
      fs.rmSync(envFilePath, { force: true });
    }
  });

  it('is a silent no-op when .env is absent', () => {
    const originalLoader = process.loadEnvFile;
    try {
      delete process.loadEnvFile;
      const targetEnv = { EXISTING: '1' };
      assert.doesNotThrow(() => loadDotEnv(path.join(os.tmpdir(), 'telegram-bridge-does-not-exist.env'), { env: targetEnv }));
      assert.deepEqual(targetEnv, { EXISTING: '1' });
    } finally {
      if (originalLoader) process.loadEnvFile = originalLoader;
    }
  });
});

describe('runBridgeTick', () => {
  it('runs both halves and returns their results', async () => {
    const storePath = tmpStorePath();
    const env = {
      TELEGRAM_BOT_TOKEN: 'token',
      TELEGRAM_CHAT_ID: 'chat',
      PAPERCLIP_API_URL: 'https://paper.example.test/api',
      PAPERCLIP_API_KEY: 'key',
      PAPERCLIP_COMPANY_ID: 'company-1',
    };
    const fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('api.telegram.org/bot')) return jsonResponse({ ok: true, result: [] });
      if (u.includes('/api/companies/company-1/issues')) return jsonResponse([]);
      throw new Error(`unexpected fetch: ${u}`);
    };
    const result = await runBridgeTick({ env, fetchImpl, storePath });
    assert.deepEqual(result, { inbound: [], outbound: [] });
  });
});
