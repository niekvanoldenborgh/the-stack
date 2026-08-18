#!/usr/bin/env node
// Process entrypoint. Wires the real MySQL pool + config into the app
// factory and listens. See server/README.md for the env vars a real deploy
// needs — this file intentionally does no validation of its own beyond
// what loadConfig()/createPool() already throw on.
import { createApp } from './app.mjs';
import { createMysqlAuthStore } from './auth/store.mysql.mjs';
import { loadConfig } from './config.mjs';
import { createPool } from './db.mjs';

const config = loadConfig();
const pool = createPool();
const store = createMysqlAuthStore(pool);
const app = createApp(store, config);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`the-stack auth API listening on :${config.port}`);
});
