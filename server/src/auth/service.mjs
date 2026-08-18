// Business logic for register/login/refresh/logout/session-lookup. Deals
// entirely in a `store` (see store.mysql.mjs / ../../test/fakeAuthStore.mjs)
// so this file has zero direct SQL and is fully unit-testable without a
// reachable database.
import { ApiError } from '../lib/errors.mjs';
import { hashPassword, verifyPassword } from '../lib/password.mjs';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
  generateRefreshToken,
  hashIp,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../lib/tokens.mjs';
import {
  MIN_ACCOUNT_AGE_YEARS,
  MIN_PASSWORD_LENGTH,
  ageFromDateOfBirth,
  isValidDateOfBirth,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
} from '../lib/validation.mjs';

/**
 * Consent purpose mapping — READ BEFORE CHANGING.
 *
 * The design spec (THEA-97, account-screens-spec §3) sketches the ToS/
 * Privacy checkbox as writing a `purpose='terms_of_service'` consent row,
 * as a placeholder. The THEA-87 schema's `consents.purpose` enum is only
 * `'account' | 'health_data_processing' | 'marketing'` — there is no
 * `terms_of_service` value, and adding one is a migration, not something an
 * API-layer ticket should invent unreviewed. ToS/Privacy acceptance is
 * recorded under `purpose='account'` instead, which is exactly what that
 * value denotes (general account-terms consent, not health processing).
 * `health_data_processing` is unchanged and matches the schema's Art. 9(2)(a)
 * gate exactly. Final purpose naming/copy is still Benji's call per the
 * spec — flag this mapping to him explicitly at review, it is not
 * self-evidently correct, just schema-compatible.
 */
const TOS_CONSENT_PURPOSE = 'account';
const HEALTH_CONSENT_PURPOSE = 'health_data_processing';

/**
 * THEA-95 age gate (A1–A4, THEA-90 review). Non-shaming per the review
 * brief: states the requirement plainly, names the mechanism (data-
 * protection age-of-consent rules, not a moral judgement), and explicitly
 * does not dead-end a rejected signup — the app's calculators and safety
 * features all work fully on-device with no account. Must not contradict
 * `terms-of-service` §2 Eligibility (rev 3), which makes the same two
 * points. Keep this in sync with that doc's copy and with the client-side
 * mirror in `app/settings/account.tsx`.
 */
const UNDER_AGE_MESSAGE =
  `Accounts require you to be ${MIN_ACCOUNT_AGE_YEARS} or older — this keeps health data tied to an account within ` +
  'data-protection age-of-consent rules. Every calculator and safety feature in this app still works fully on this ' +
  'device without an account.';

function issueTokens({ userId, email }, config) {
  return {
    accessToken: signAccessToken({ userId, email }, config.jwtSecret),
    refreshToken: generateRefreshToken(),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

async function persistSession(store, config, { userId, refreshToken, userAgent, ip }) {
  await store.createSession({
    userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
    ipHash: hashIp(ip, config.sessionIpPepper),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
}

export async function registerUser(store, config, input) {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw new ApiError(400, 'invalid_email', 'Enter a valid email address.');
  }
  if (!isValidPassword(input.password)) {
    throw new ApiError(400, 'invalid_password', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  // A1/A2 (THEA-95 via THEA-90 review) — a required, self-attested date of
  // birth, enforced server-side. The client may pre-validate for a cleaner
  // in-form message, but this is the actual enforcement point; do not trust
  // a client-side-only check for something GDPR Art. 8 hinges on.
  if (!isValidDateOfBirth(input.dateOfBirth)) {
    throw new ApiError(400, 'invalid_date_of_birth', 'Enter your date of birth.');
  }
  if (ageFromDateOfBirth(input.dateOfBirth) < MIN_ACCOUNT_AGE_YEARS) {
    throw new ApiError(400, 'under_18', UNDER_AGE_MESSAGE);
  }
  // Two separate, both-required flags — the design spec (§3.1, §4.2) is
  // explicit that these must stay two distinct controls, never one bundled
  // "I agree to everything" checkbox (GDPR Art. 7 unbundled-consent rule).
  if (input.tosAccepted !== true) {
    throw new ApiError(400, 'tos_not_accepted', 'You must agree to the Terms of Service and Privacy Policy.');
  }
  if (input.healthDataConsent !== true) {
    throw new ApiError(400, 'health_consent_required', 'You must consent to health-data processing to create an account.');
  }

  // Pre-check for a friendlier error path; the DB's unique constraint on
  // `email_normalized` (see store.mysql.mjs ER_DUP_ENTRY handling below) is
  // still the actual race-safe guarantee, this is just the common case.
  if (await store.findUserByEmail(email)) {
    throw new ApiError(409, 'email_already_registered', 'That email is already registered.');
  }

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await store.createUserWithPassword({ email, passwordHash, dateOfBirth: input.dateOfBirth });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'email_already_registered', 'That email is already registered.');
    }
    throw err;
  }

  const policyVersion = input.policyVersion || config.tosPolicyVersion;
  await store.recordConsents(user.id, [
    { purpose: TOS_CONSENT_PURPOSE, granted: true, legalBasis: 'consent', policyVersion },
    { purpose: HEALTH_CONSENT_PURPOSE, granted: true, legalBasis: 'consent', policyVersion },
  ]);

  await store.writeAuditLog({ userId: user.id, eventType: 'account_created', metadata: {} });
  await store.writeAuditLog({
    userId: user.id,
    eventType: 'consent_granted',
    metadata: { purpose: TOS_CONSENT_PURPOSE },
  });
  await store.writeAuditLog({
    userId: user.id,
    eventType: 'consent_granted',
    metadata: { purpose: HEALTH_CONSENT_PURPOSE },
  });

  const tokens = issueTokens({ userId: user.id, email: user.email }, config);
  await persistSession(store, config, { userId: user.id, refreshToken: tokens.refreshToken, userAgent: input.userAgent, ip: input.ip });
  await store.writeAuditLog({ userId: user.id, eventType: 'login_success', metadata: { via: 'register' } });

  return { user: { id: user.id, email: user.email }, ...tokens };
}

// Same generic failure and message for "no such email" and "wrong
// password" — deliberate auth-enumeration hygiene (design spec §4.4: "never
// reveal *which* is wrong"). Do not special-case the unknown-email branch.
const INVALID_CREDENTIALS = () => new ApiError(401, 'invalid_credentials', "That email or password isn't right.");

export async function loginUser(store, config, input) {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email) || typeof input.password !== 'string' || input.password.length === 0) {
    throw INVALID_CREDENTIALS();
  }

  const identity = await store.findPasswordIdentity(email);
  if (!identity || identity.status !== 'active' || identity.deleted_at) {
    throw INVALID_CREDENTIALS();
  }

  const ok = await verifyPassword(identity.password_hash, input.password);
  if (!ok) {
    await store.writeAuditLog({ userId: identity.user_id, eventType: 'login_failed', metadata: {} });
    throw INVALID_CREDENTIALS();
  }

  await store.touchPasswordIdentity(identity.user_id);
  const tokens = issueTokens({ userId: identity.user_id, email }, config);
  await persistSession(store, config, { userId: identity.user_id, refreshToken: tokens.refreshToken, userAgent: input.userAgent, ip: input.ip });
  await store.writeAuditLog({ userId: identity.user_id, eventType: 'login_success', metadata: { via: 'password' } });

  return { user: { id: identity.user_id, email }, ...tokens };
}

const INVALID_REFRESH = () => new ApiError(401, 'invalid_refresh_token', 'Session expired. Sign in again.');

export async function refreshSession(store, config, input) {
  if (typeof input.refreshToken !== 'string' || !input.refreshToken) {
    throw INVALID_REFRESH();
  }
  const session = await store.findSessionByTokenHash(hashRefreshToken(input.refreshToken));
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
    throw INVALID_REFRESH();
  }

  const user = await store.getUserById(session.user_id);
  if (!user || user.status !== 'active' || user.deleted_at) {
    throw INVALID_REFRESH();
  }

  // Rotate on every refresh: revoke the presented token and issue a new
  // one, so a captured-but-not-yet-used refresh token stops working the
  // moment the legitimate client refreshes.
  await store.revokeSession(session.id);
  const tokens = issueTokens({ userId: user.id, email: user.email }, config);
  await persistSession(store, config, { userId: user.id, refreshToken: tokens.refreshToken, userAgent: input.userAgent, ip: input.ip });
  await store.writeAuditLog({ userId: user.id, eventType: 'token_refreshed', metadata: {} });

  return { user: { id: user.id, email: user.email }, ...tokens };
}

export async function logoutSession(store, input) {
  if (typeof input.refreshToken !== 'string' || !input.refreshToken) return;
  const session = await store.findSessionByTokenHash(hashRefreshToken(input.refreshToken));
  if (!session) return;
  await store.revokeSession(session.id);
  await store.writeAuditLog({ userId: session.user_id, eventType: 'logout', metadata: {} });
}

export async function getSessionUser(store, config, accessToken) {
  if (!accessToken) throw new ApiError(401, 'unauthorized', 'Sign in required.');
  let payload;
  try {
    payload = verifyAccessToken(accessToken, config.jwtSecret);
  } catch {
    throw new ApiError(401, 'unauthorized', 'Sign in required.');
  }
  const user = await store.getUserById(payload.sub);
  if (!user || user.status !== 'active' || user.deleted_at) {
    throw new ApiError(401, 'unauthorized', 'Sign in required.');
  }
  const [tosAccepted, healthDataConsent] = await Promise.all([
    store.hasActiveConsent(user.id, TOS_CONSENT_PURPOSE),
    store.hasActiveConsent(user.id, HEALTH_CONSENT_PURPOSE),
  ]);
  return { id: user.id, email: user.email, tosAccepted, healthDataConsent };
}

/**
 * Reusable primitive for whichever future ticket implements writes to the
 * Art. 9 health tables (`user_health_profiles`/`stacks`/`dose_logs`/
 * `side_effect_logs`/`injection_logs`/`measurements`/`workout_programs`/
 * `workout_logs`). server/README.md and the THEA-90 brief both document a
 * live `health_data_processing` consent as a hard precondition on every
 * write to those tables — call this at the top of each such handler rather
 * than re-deriving the check per endpoint. Unused by this ticket's own
 * routes (register/login only touch users/auth_identities/consents).
 */
export async function requireHealthConsent(store, userId) {
  const granted = await store.hasActiveConsent(userId, HEALTH_CONSENT_PURPOSE);
  if (!granted) {
    throw new ApiError(403, 'health_consent_required', 'Health-data processing consent is required for this action.');
  }
}
