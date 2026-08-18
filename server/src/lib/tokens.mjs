// Access tokens are short-lived JWTs; refresh tokens are opaque random
// strings, only ever persisted as a SHA-256 hash (schema design principle 3
// — "no plaintext secrets... refresh tokens are stored as SHA-256 hashes").
// A DB read of `sessions` can never be replayed as a login on its own.
import { createHash, createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function signAccessToken({ userId, email }, secret) {
  return jwt.sign({ sub: userId, email }, secret, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

/** Throws (jsonwebtoken's `JsonWebTokenError`/`TokenExpiredError`) on any invalid/expired/tampered token. */
export function verifyAccessToken(token, secret) {
  return jwt.verify(token, secret);
}

export function generateRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * HMAC-SHA256(ip, pepper), never a bare digest — server/README.md design
 * principle 3 explains why an unsalted SHA-256 of an IPv4 address is brute
 * forceable offline. Returns null (not stored) when either input is
 * missing, rather than silently falling back to an unsalted hash.
 */
export function hashIp(ip, pepper) {
  if (!ip || !pepper) return null;
  return createHmac('sha256', pepper).update(ip, 'utf8').digest('hex');
}
