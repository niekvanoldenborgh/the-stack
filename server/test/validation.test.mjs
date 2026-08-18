import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MIN_ACCOUNT_AGE_YEARS,
  MIN_PASSWORD_LENGTH,
  ageFromDateOfBirth,
  isValidDateOfBirth,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
} from '../src/lib/validation.mjs';

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

test('isValidDateOfBirth accepts a real past date', () => {
  assert.equal(isValidDateOfBirth('1990-06-15'), true);
});

test('isValidDateOfBirth rejects wrong shape, non-strings, and missing values', () => {
  assert.equal(isValidDateOfBirth('06/15/1990'), false);
  assert.equal(isValidDateOfBirth('1990-6-15'), false);
  assert.equal(isValidDateOfBirth(undefined), false);
  assert.equal(isValidDateOfBirth(null), false);
  assert.equal(isValidDateOfBirth(''), false);
});

test('isValidDateOfBirth rejects a calendar date that does not exist', () => {
  assert.equal(isValidDateOfBirth('1990-02-30'), false);
  assert.equal(isValidDateOfBirth('1990-13-01'), false);
});

test('isValidDateOfBirth rejects a date in the future', () => {
  const nextYear = new Date();
  nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
  assert.equal(isValidDateOfBirth(nextYear.toISOString().slice(0, 10)), false);
});

test(`ageFromDateOfBirth computes whole years, accounting for whether this year's birthday has passed`, () => {
  const now = new Date();
  const turnedThirtyToday = new Date(Date.UTC(now.getUTCFullYear() - 30, now.getUTCMonth(), now.getUTCDate()));
  assert.equal(ageFromDateOfBirth(turnedThirtyToday.toISOString().slice(0, 10)), 30);

  // One day before the 30th birthday: still 29.
  const oneDayBeforeThirtieth = new Date(turnedThirtyToday.getTime() + 24 * 60 * 60 * 1000);
  assert.equal(ageFromDateOfBirth(oneDayBeforeThirtieth.toISOString().slice(0, 10)), 29);
});

test('MIN_ACCOUNT_AGE_YEARS is 18 (THEA-95 owner decision)', () => {
  assert.equal(MIN_ACCOUNT_AGE_YEARS, 18);
});
