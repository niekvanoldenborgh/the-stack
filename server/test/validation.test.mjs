import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MIN_PASSWORD_LENGTH, isValidEmail, isValidPassword, normalizeEmail } from '../src/lib/validation.mjs';

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Test@Example.COM  '), 'test@example.com');
});

test('normalizeEmail returns empty string for non-string input', () => {
  assert.equal(normalizeEmail(undefined), '');
  assert.equal(normalizeEmail(null), '');
});

test('isValidEmail accepts a plausible address', () => {
  assert.equal(isValidEmail('a@example.com'), true);
});

test('isValidEmail rejects missing @ / domain', () => {
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail(''), false);
});

test(`isValidPassword requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
  assert.equal(isValidPassword('short'), false);
  assert.equal(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1)), false);
  assert.equal(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH)), true);
});

test('isValidPassword rejects non-string input', () => {
  assert.equal(isValidPassword(undefined), false);
  assert.equal(isValidPassword(12345678), false);
});
