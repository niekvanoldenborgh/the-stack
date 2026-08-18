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
