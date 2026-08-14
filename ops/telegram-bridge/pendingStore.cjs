'use strict';

/**
 * Placeholder persistence for "which Telegram message maps to which
 * Paperclip interaction". File-based JSON, single process only.
 *
 * This is a stand-in, not the final design: once the runtime-host decision
 * (README.md) is made, this should become whatever storage that host
 * naturally offers (e.g. a plugin's own data store, a DB table) so state
 * survives restarts and works across replicas. Swap the implementation
 * here; callers only use recordPending/getPending.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PATH = path.join(__dirname, '.pending-store.json');

function load(storePath) {
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function recordPending(messageId, entry, { storePath = DEFAULT_PATH } = {}) {
  const data = load(storePath);
  data[String(messageId)] = entry;
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

async function getPendingMap({ storePath = DEFAULT_PATH } = {}) {
  return load(storePath);
}

module.exports = { recordPending, getPendingMap, DEFAULT_PATH };
