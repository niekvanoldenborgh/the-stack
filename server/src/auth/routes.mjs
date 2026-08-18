import { Router } from 'express';

import { ApiError } from '../lib/errors.mjs';
import { getSessionUser, loginUser, logoutSession, refreshSession, registerUser } from './service.mjs';

export function createAuthRouter(store, config) {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const result = await registerUser(store, config, {
        ...req.body,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const result = await loginUser(store, config, {
        ...req.body,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const result = await refreshSession(store, config, {
        ...req.body,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      await logoutSession(store, req.body ?? {});
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', async (req, res, next) => {
    try {
      const authHeader = req.get('authorization') ?? '';
      const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const user = await getSessionUser(store, config, accessToken);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// eslint-disable-next-line no-unused-vars
export function authErrorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // express.json() body-parser errors (malformed JSON) aren't ApiErrors —
  // map them to the same 400 shape rather than letting them fall to 500.
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Malformed request body.' } });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong.' } });
}
