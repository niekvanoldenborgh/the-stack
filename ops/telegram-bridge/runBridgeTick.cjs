'use strict';

/**
 * Host-agnostic entrypoint for the Telegram bridge.
 *
 * A scheduled Paperclip routine (the decided runtime host, see README.md
 * "Decisions") calls this once per tick — each call is a separate process
 * execution, so all cross-tick state lives in `pendingStore.cjs`'s file,
 * not in memory here.
 *
 * One tick does both halves:
 *   1. inbound  — drain whatever Telegram replies arrived, route each to
 *      the Paperclip interaction it's a reply to (poll.cjs).
 *   2. outbound — scan for issues/interactions newly needing a human and
 *      not yet notified, send one Telegram message each (scan.cjs).
 *
 * Required env — see README.md "Config" for the full list (Telegram token,
 * Paperclip API credentials, company id).
 */

const { pollAndRouteTick } = require('./poll.cjs');
const { scanAndNotify } = require('./scan.cjs');

async function runBridgeTick({ env = process.env, fetchImpl = fetch, storePath } = {}) {
  const inbound = await pollAndRouteTick({ env, fetchImpl, storePath });
  const outbound = await scanAndNotify({ env, fetchImpl, storePath });
  return { inbound, outbound };
}

if (require.main === module) {
  runBridgeTick().catch((err) => {
    console.error('[telegram-bridge] tick failed', err);
    process.exit(1);
  });
}

module.exports = { runBridgeTick };
