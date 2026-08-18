import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hashPassword, verifyPassword } from '../src/lib/password.mjs';

test('hashPassword produces an argon2id PHC string', async () => {
  const hash = await hashPassword('correct-horse-battery-staple');
  assert.match(hash, /^\$argon2id\$/);
});

test('verifyPassword accepts the matching password', async () => {
  const hash = await hashPassword('correct-horse-battery-staple');
  assert.equal(await verifyPassword(hash, 'correct-horse-battery-staple'), true);
});

test('verifyPassword rejects a wrong password', async () => {
  const hash = await hashPassword('correct-horse-battery-staple');
  assert.equal(await verifyPassword(hash, 'wrong-password'), false);
});

test('verifyPassword fails closed on a malformed hash instead of throwing', async () => {
  assert.equal(await verifyPassword('not-a-real-hash', 'anything'), false);
});

test('two hashes of the same password are not equal (salted)', async () => {
  const a = await hashPassword('same-password');
  const b = await hashPassword('same-password');
  assert.notEqual(a, b);
});
