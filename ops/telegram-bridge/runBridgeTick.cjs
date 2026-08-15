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

  runBridgeTick().catch((err) => {
    console.error('[telegram-bridge] tick failed', err);
    process.exit(1);
  });
}

module.exports = { runBridgeTick, loadDotEnv, parseDotEnv };
