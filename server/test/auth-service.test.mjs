import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadConfig } from '../src/config.mjs';
import { ApiError } from '../src/lib/errors.mjs';
import {
  getSessionUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  requireHealthConsent,
} from '../src/auth/service.mjs';
import { createFakeAuthStore } from './fakeAuthStore.mjs';

function testConfig(overrides = {}) {
  return loadConfig({ JWT_SECRET: 'test-secret', ...overrides });
}

const VALID_REGISTER = {
  email: 'new-user@example.com',
  password: 'a-strong-password',
  tosAccepted: true,
  healthDataConsent: true,
};

test('registerUser creates a user, issues tokens, and records both consents', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  const result = await registerUser(store, config, VALID_REGISTER);

  assert.equal(result.user.email, 'new-user@example.com');
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.equal(result.expiresIn, 15 * 60);

  const purposes = store._debug.consents.filter((c) => c.user_id === result.user.id).map((c) => c.purpose);
  assert.deepEqual(new Set(purposes), new Set(['account', 'health_data_processing']));
  assert.ok(store._debug.consents.every((c) => c.granted === true));
});

test('registerUser normalizes email case/whitespace', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  const result = await registerUser(store, config, { ...VALID_REGISTER, email: '  New-User@Example.com  ' });
  assert.equal(result.user.email, 'new-user@example.com');
});

test('registerUser rejects an invalid email', async () => {
  const store = createFakeAuthStore();
  await assert.rejects(
    () => registerUser(store, testConfig(), { ...VALID_REGISTER, email: 'not-an-email' }),
    (err) => err instanceof ApiError && err.status === 400 && err.code === 'invalid_email',
  );
});

test('registerUser rejects a short password', async () => {
  const store = createFakeAuthStore();
  await assert.rejects(
    () => registerUser(store, testConfig(), { ...VALID_REGISTER, password: 'short' }),
    (err) => err instanceof ApiError && err.status === 400 && err.code === 'invalid_password',
  );
});

test('registerUser rejects missing ToS acceptance', async () => {
  const store = createFakeAuthStore();
  await assert.rejects(
    () => registerUser(store, testConfig(), { ...VALID_REGISTER, tosAccepted: false }),
    (err) => err instanceof ApiError && err.status === 400 && err.code === 'tos_not_accepted',
  );
});

test('registerUser rejects missing health-data consent, even with ToS accepted', async () => {
  const store = createFakeAuthStore();
  await assert.rejects(
    () => registerUser(store, testConfig(), { ...VALID_REGISTER, healthDataConsent: false }),
    (err) => err instanceof ApiError && err.status === 400 && err.code === 'health_consent_required',
  );
});

test('registerUser rejects a duplicate email with 409', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  await registerUser(store, config, VALID_REGISTER);
  await assert.rejects(
    () => registerUser(store, config, VALID_REGISTER),
    (err) => err instanceof ApiError && err.status === 409 && err.code === 'email_already_registered',
  );
});

test('registerUser never stores the plaintext password anywhere reachable', async () => {
  const store = createFakeAuthStore();
  await registerUser(store, testConfig(), VALID_REGISTER);
  const identity = store._debug.identitiesByEmail.get('new-user@example.com');
  assert.notEqual(identity.password_hash, VALID_REGISTER.password);
  assert.match(identity.password_hash, /^\$argon2id\$/);
});

test('loginUser succeeds with the correct password', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  await registerUser(store, config, VALID_REGISTER);
  const result = await loginUser(store, config, { email: VALID_REGISTER.email, password: VALID_REGISTER.password });
  assert.equal(result.user.email, 'new-user@example.com');
  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
});

test('loginUser rejects a wrong password with a generic message', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  await registerUser(store, config, VALID_REGISTER);
  await assert.rejects(
    () => loginUser(store, config, { email: VALID_REGISTER.email, password: 'totally-wrong' }),
    (err) => err instanceof ApiError && err.status === 401 && err.code === 'invalid_credentials',
  );
});

test('loginUser rejects an unknown email with the SAME message as a wrong password (no enumeration)', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  await registerUser(store, config, VALID_REGISTER);

  let unknownEmailMessage;
  let wrongPasswordMessage;
  try {
    await loginUser(store, config, { email: 'nobody@example.com', password: 'whatever1' });
  } catch (err) {
    unknownEmailMessage = err.message;
  }
  try {
    await loginUser(store, config, { email: VALID_REGISTER.email, password: 'wrong-password' });
  } catch (err) {
    wrongPasswordMessage = err.message;
  }
  assert.equal(unknownEmailMessage, wrongPasswordMessage);
});

test('loginUser records a login_failed audit entry on wrong password', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  await registerUser(store, config, VALID_REGISTER);
  store._debug.auditLog.length = 0;
  await assert.rejects(() => loginUser(store, config, { email: VALID_REGISTER.email, password: 'nope-nope-nope' }));
  assert.ok(store._debug.auditLog.some((e) => e.eventType === 'login_failed'));
});

test('refreshSession rotates the refresh token: old token stops working, new one works', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  const { refreshToken: firstToken } = await registerUser(store, config, VALID_REGISTER);

  const refreshed = await refreshSession(store, config, { refreshToken: firstToken });
  assert.ok(refreshed.accessToken);
  assert.notEqual(refreshed.refreshToken, firstToken);

  await assert.rejects(
    () => refreshSession(store, config, { refreshToken: firstToken }),
    (err) => err instanceof ApiError && err.status === 401 && err.code === 'invalid_refresh_token',
  );

  const refreshedAgain = await refreshSession(store, config, { refreshToken: refreshed.refreshToken });
  assert.ok(refreshedAgain.accessToken);
});

test('refreshSession rejects a garbage token', async () => {
  const store = createFakeAuthStore();
  await assert.rejects(
    () => refreshSession(store, testConfig(), { refreshToken: 'not-a-real-token' }),
    (err) => err instanceof ApiError && err.status === 401 && err.code === 'invalid_refresh_token',
  );
});

test('logoutSession revokes the session so a later refresh fails', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  const { refreshToken } = await registerUser(store, config, VALID_REGISTER);

  await logoutSession(store, { refreshToken });

  await assert.rejects(
    () => refreshSession(store, config, { refreshToken }),
    (err) => err instanceof ApiError && err.code === 'invalid_refresh_token',
  );
});

test('logoutSession is a silent no-op for an unknown/missing token (idempotent)', async () => {
  const store = createFakeAuthStore();
  await logoutSession(store, {});
  await logoutSession(store, { refreshToken: 'never-issued' });
});

test('getSessionUser resolves a valid access token and reports both consent flags', async () => {
  const store = createFakeAuthStore();
  const config = testConfig();
  const { accessToken } = await registerUser(store, config, VALID_REGISTER);

  const user = await getSessionUser(store, config, accessToken);
  assert.equal(user.email, 'new-user@example.com');
  assert.equal(user.tosAccepted, true);
  assert.equal(user.healthDataConsent, true);
});

test('getSessionUser rejects a missing/invalid/expired-shaped token', async () => {
  await assert.rejects(
    () => getSessionUser(createFakeAuthStore(), testConfig(), null),
    (err) => err instanceof ApiError && err.status === 401,
  );
  await assert.rejects(
    () => getSessionUser(createFakeAuthStore(), testConfig(), 'garbage'),
    (err) => err instanceof ApiError && err.status === 401,
  );
});

test('requireHealthConsent throws 403 for a user with no consent row', async () => {
  const store = createFakeAuthStore();
  await assert.rejects(
    () => requireHealthConsent(store, 'user-with-no-consent-rows'),
    (err) => err instanceof ApiError && err.status === 403 && err.code === 'health_consent_required',
  );
});

test('requireHealthConsent resolves for a user who granted health-data consent', async () => {
  const store = createFakeAuthStore();
  const { user } = await registerUser(store, testConfig(), VALID_REGISTER);
  await requireHealthConsent(store, user.id); // does not throw
});

test('requireHealthConsent throws again after a consent is revoked (later row wins)', async () => {
  const store = createFakeAuthStore();
  const { user } = await registerUser(store, testConfig(), VALID_REGISTER);
  await store.recordConsents(user.id, [
    { purpose: 'health_data_processing', granted: false, legalBasis: 'consent', policyVersion: 'v1' },
  ]);
  await assert.rejects(
    () => requireHealthConsent(store, user.id),
    (err) => err instanceof ApiError && err.status === 403,
  );
});
