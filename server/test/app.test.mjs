import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApp } from '../src/app.mjs';
import { loadConfig } from '../src/config.mjs';
import { createFakeAuthStore } from './fakeAuthStore.mjs';

// Full HTTP round-trip over the fake store, so this catches wiring bugs
// (route paths, status codes, JSON shapes, the body-parser/error-handler
// chain) that the service-layer unit tests never see because they call
// service functions directly.
async function withServer(t) {
  const app = createApp(createFakeAuthStore(), loadConfig({ JWT_SECRET: 'test-secret' }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${port}`;
}

const VALID_REGISTER = {
  email: 'app-test@example.com',
  password: 'a-strong-password',
  tosAccepted: true,
  healthDataConsent: true,
};

test('GET /healthz', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('register -> me round trip', async (t) => {
  const base = await withServer(t);

  const registerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(VALID_REGISTER),
  });
  assert.equal(registerRes.status, 201);
  const registered = await registerRes.json();
  assert.equal(registered.user.email, VALID_REGISTER.email);

  const meRes = await fetch(`${base}/api/auth/me`, {
    headers: { authorization: `Bearer ${registered.accessToken}` },
  });
  assert.equal(meRes.status, 200);
  const me = await meRes.json();
  assert.equal(me.user.email, VALID_REGISTER.email);
});

test('register with missing consent returns 400 with a stable error code', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...VALID_REGISTER, healthDataConsent: false }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'health_consent_required');
});

test('login with wrong password returns 401', async (t) => {
  const base = await withServer(t);
  await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(VALID_REGISTER),
  });
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: VALID_REGISTER.email, password: 'wrong' }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'invalid_credentials');
});

test('GET /api/auth/me with no Authorization header returns 401', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/api/auth/me`);
  assert.equal(res.status, 401);
});

test('malformed JSON body returns 400 invalid_json, not a 500', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not valid json',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'invalid_json');
});

test('refresh -> logout -> refresh with the old token fails', async (t) => {
  const base = await withServer(t);
  const registerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(VALID_REGISTER),
  });
  const { refreshToken } = await registerRes.json();

  const refreshRes = await fetch(`${base}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  assert.equal(refreshRes.status, 200);
  const { refreshToken: rotated } = await refreshRes.json();

  const logoutRes = await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: rotated }),
  });
  assert.equal(logoutRes.status, 204);

  const secondRefreshRes = await fetch(`${base}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: rotated }),
  });
  assert.equal(secondRefreshRes.status, 401);
});
