// Shared shape rules for email/password. Kept intentionally tiny — this is
// the server-side source of truth; the client (design spec §4.1) must not
// enforce anything stricter than this or a valid password could lock a user
// out of their own account.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server-enforced minimum. The create-account screen's helper copy quotes
 *  this number directly — keep them in sync if it ever changes. */
export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidEmail(email) {
  return typeof email === 'string' && email.trim().length <= 320 && EMAIL_RE.test(email.trim());
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

const DATE_OF_BIRTH_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Minimum age, in whole years, to create an account (THEA-95). This is the
 *  owner's Art. 8 GDPR mitigation for storing Art. 9 health data against an
 *  account — it gates account *creation* only, and is deliberately distinct
 *  from `UserProfile.age` (a self-reported, editable, on-device value the
 *  engine's under-18/21/25 safety notices key off, see
 *  `src/engine/safety.ts::buildAgeNotices`). Never conflate the two. */
export const MIN_ACCOUNT_AGE_YEARS = 18;

/** True for a syntactically real calendar date in `YYYY-MM-DD`, not in the
 *  future. Does not check age — see `ageFromDateOfBirth`/`MIN_ACCOUNT_AGE_YEARS`
 *  for that. */
export function isValidDateOfBirth(value) {
  if (typeof value !== 'string' || !DATE_OF_BIRTH_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // `Date` silently rolls invalid components forward (e.g. day 30 of
  // February becomes March 1/2) — comparing the parsed components back out
  // is what actually catches that, the regex alone does not.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  return date.getTime() <= Date.now();
}

/** Whole years between `dateOfBirth` (`YYYY-MM-DD`) and now, UTC. Caller
 *  must validate with `isValidDateOfBirth` first — this does not re-check. */
export function ageFromDateOfBirth(dateOfBirth) {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const hadBirthdayThisYear = now.getUTCMonth() > month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() >= day);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}
