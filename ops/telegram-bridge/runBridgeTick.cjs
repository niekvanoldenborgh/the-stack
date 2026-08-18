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
 * THEA-100: the two halves are independent — one failing (a Telegram
 * network hiccup, an expired API key, whatever) must not suppress the
 * other. Each half is run to completion and its outcome captured rather
 * than let a rejection from the first half skip the second one entirely.
 *
 * Required env — see README.md "Config" for the full list (Telegram token,
 * Paperclip API credentials, company id).
 */

const dns = require('node:dns');

const { pollAndRouteTick } = require('./poll.cjs');
const { scanAndNotify } = require('./scan.cjs');

// THEA-100: api.telegram.org resolves AAAA-first, and the VPS this runs on
// is old enough (Node < 20.6) that undici does not fall back to IPv4
// (Happy Eyeballs) when the AAAA answer has no IPv6 egress — every
// connection attempt hangs until it times out. Force IPv4 resolution for
// this whole process before any network call is made. Takes the `dns`
// module as a param so tests can assert this without touching the real
// process-wide resolver order.
function preferIpv4(dnsModule = dns) {
  dnsModule.setDefaultResultOrder('ipv4first');
}
preferIpv4();

/** Run one half, converting a throw into a captured outcome instead of letting it abort the tick. */
async function runHalf(fn) {
  try {
    return { ok: true, result: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

function summarizeHalf(outcome) {
  if (outcome.ok) {
    const count = Array.isArray(outcome.result) ? outcome.result.length : undefined;
    return count === undefined ? 'ok' : `ok items=${count}`;
  }
  const err = outcome.error;
  return `error: ${(err && err.message) || String(err)}`;
}

// THEA-100: one timestamped line per tick, not a stack trace per failure —
// 891 failed ticks previously grew tick.log to 759KB with no rotation.
// Full stacks are still available, gated behind TELEGRAM_BRIDGE_DEBUG, for
// when a one-line summary isn't enough to diagnose something new.
function logTickOutcome({ inbound, outbound, env = process.env, now = new Date() }) {
  console.log(`[telegram-bridge] ${now.toISOString()} tick inbound=${summarizeHalf(inbound)} outbound=${summarizeHalf(outbound)}`);
  if (env.TELEGRAM_BRIDGE_DEBUG) {
    if (!inbound.ok) console.error('[telegram-bridge] inbound stack', inbound.error);
    if (!outbound.ok) console.error('[telegram-bridge] outbound stack', outbound.error);
  }
}

async function runBridgeTick({ env = process.env, fetchImpl = fetch, storePath, now } = {}) {
  const inbound = await runHalf(() => pollAndRouteTick({ env, fetchImpl, storePath }));
  const outbound = await runHalf(() => scanAndNotify({ env, fetchImpl, storePath }));
  logTickOutcome({ inbound, outbound, env, ...(now ? { now } : {}) });
  return { inbound, outbound };
}

// Tiny, dependency-free .env parser for hosts on Node < 20.6 (no
// process.loadEnvFile). Ignores blank/`#` lines, splits on the first `=`,
// strips one layer of surrounding quotes, and never overwrites a key
// already present in the target env — the real process environment always
// wins over the file.
function parseDotEnv(contents) {
  const values = {};
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }
    values[key] = value;
  }
  return values;
}

// Load `.env` into `env`, using the native loader when available (Node
// 20.12+/21.7+) and falling back to `parseDotEnv` otherwise. A missing
// `.env` is a silent no-op: env may already be supplied by the process
// environment directly.
function loadDotEnv(filePath, { env = process.env } = {}) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(filePath);
    } catch {
      // no .env present — fall through to env as-is
    }
    return;
  }

  let contents;
  try {
    contents = require('node:fs').readFileSync(filePath, 'utf8');
  } catch {
    return; // no .env present — fall through to env as-is
  }

  const parsed = parseDotEnv(contents);
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in env)) env[key] = value;
  }
}

if (require.main === module) {
  // cron invokes this with a bare environment, so `.env` sitting beside this
  // script is never loaded by the shell — load it ourselves from the
  // script's own directory (not cwd) so `node runBridgeTick.cjs` works
  // regardless of where cron's `cd` lands.
  loadDotEnv(require('node:path').join(__dirname, '.env'));

  // Each half already captures its own failure (see runHalf/logTickOutcome
  // above) so this only fires for something outside both halves — a bug in
  // the tick harness itself, not a Telegram/Paperclip hiccup. A per-half
  // failure instead sets a non-zero exit code below, without a stack trace
  // unless TELEGRAM_BRIDGE_DEBUG is set.
  runBridgeTick().then(({ inbound, outbound }) => {
    if (!inbound.ok || !outbound.ok) process.exitCode = 1;
  }).catch((err) => {
    console.error(`[telegram-bridge] ${new Date().toISOString()} tick crashed`, process.env.TELEGRAM_BRIDGE_DEBUG ? err : (err && err.message) || err);
    process.exit(1);
  });
}

module.exports = { runBridgeTick, loadDotEnv, parseDotEnv, preferIpv4 };
