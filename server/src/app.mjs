// Express app factory — separate from server.mjs (the process entrypoint)
// so tests can build an app against a fake store and drive it with `fetch`
// without ever binding a real port or touching MySQL.
import express from 'express';

import { authErrorHandler, createAuthRouter } from './auth/routes.mjs';

export function createApp(store, config) {
  const app = express();
  app.use(express.json());
  app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));
  app.use('/api/auth', createAuthRouter(store, config));
  app.use(authErrorHandler);
  return app;
}
