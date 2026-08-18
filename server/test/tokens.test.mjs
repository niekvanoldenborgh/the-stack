import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  generateRefreshToken,
  hashIp,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/lib/tokens.mjs';

test('signAccessToken / verifyAccessToken round-trip the payload', () => {
  const token = signAccessToken({ userId: 'u1', email: 'a@example.com' }, 'test-secret');
  const payload = verifyAccessToken(token, 'test-secret');
  assert.equal(payload.sub, 'u1');
  assert.equal(payload.email, 'a@example.com');
});

test('verifyAccessToken throws on a token signed with a different secret', () => {
  const token = signAccessToken({ userId: 'u1', email: 'a@example.com' }, 'secret-a');
  assert.throws(() => verifyAccessToken(token, 'secret-b'));
});

test('generateRefreshToken returns unique, reasonably long tokens', () => {
  const a = generateRefreshToken();
  const b = generateRefreshToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
});

test('hashRefreshToken is deterministic and does not return the raw token', () => {
  const token = generateRefreshToken();
  const hash1 = hashRefreshToken(token);
  const hash2 = hashRefreshToken(token);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, token);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test('hashIp returns null when the pepper is missing (never falls back to unsalted)', () => {
  assert.equal(hashIp('1.2.3.4', null), null);
  assert.equal(hashIp('1.2.3.4', ''), null);
  assert.equal(hashIp(null, 'pepper'), null);
});

test('hashIp is deterministic for the same ip+pepper and differs across peppers', () => {
  const a = hashIp('1.2.3.4', 'pepper-a');
  const b = hashIp('1.2.3.4', 'pepper-a');
  const c = hashIp('1.2.3.4', 'pepper-b');
  assert.equal(a, b);
  assert.notEqual(a, c);
});
