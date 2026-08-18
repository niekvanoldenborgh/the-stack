// In-memory twin of auth/store.mysql.mjs's interface, used by every test in
// this directory. The agent sandbox can't reach the live MySQL instance
// (server/README.md "Infra") so the service layer is exercised against this
// instead; the real SQL implementation is intentionally 1:1 with the same
// method names/shapes so there is nothing behavioural to diverge on besides
// "does the SQL actually run", which needs a real DB to verify.
import { randomUUID } from 'node:crypto';

export function createFakeAuthStore() {
  const usersById = new Map();
  const usersByEmail = new Map(); // email -> id
  const identitiesByEmail = new Map(); // email -> { user_id, password_hash, last_used_at }
  const consents = [];
  const sessionsById = new Map();
  const sessionsByHash = new Map(); // hash -> id
  const auditLog = [];
  let seq = 0;

  return {
    // Exposed for assertions in tests; not part of the real interface.
    _debug: { usersById, identitiesByEmail, consents, sessionsById, auditLog },

    async findUserByEmail(email) {
      const id = usersByEmail.get(email);
      return id ? { ...usersById.get(id) } : null;
    },

    async getUserById(id) {
      const user = usersById.get(id);
      return user ? { ...user } : null;
    },

    async createUserWithPassword({ email, passwordHash, dateOfBirth }) {
      if (usersByEmail.has(email)) {
        const err = new Error('Duplicate entry');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      const id = randomUUID();
      usersById.set(id, { id, email, status: 'active', deleted_at: null, date_of_birth: dateOfBirth });
      usersByEmail.set(email, id);
      identitiesByEmail.set(email, { user_id: id, password_hash: passwordHash, last_used_at: null });
      return { id, email };
    },

    async findPasswordIdentity(email) {
      const identity = identitiesByEmail.get(email);
      if (!identity) return null;
      const user = usersById.get(identity.user_id);
      return {
        user_id: identity.user_id,
        password_hash: identity.password_hash,
        status: user.status,
        deleted_at: user.deleted_at,
      };
    },

    async touchPasswordIdentity(userId) {
      for (const identity of identitiesByEmail.values()) {
        if (identity.user_id === userId) identity.last_used_at = new Date();
      }
    },

    async recordConsents(userId, list) {
      for (const c of list) {
        consents.push({
          id: randomUUID(),
          user_id: userId,
          purpose: c.purpose,
          granted: c.granted,
          legal_basis: c.legalBasis,
          policy_version: c.policyVersion,
          recorded_at: seq++,
        });
      }
    },

    async hasActiveConsent(userId, purpose) {
      const rows = consents
        .filter((c) => c.user_id === userId && c.purpose === purpose)
        .sort((a, b) => b.recorded_at - a.recorded_at);
      return rows.length > 0 && Boolean(rows[0].granted);
    },

    async createSession({ userId, refreshTokenHash, userAgent, ipHash, expiresAt }) {
      const id = randomUUID();
      const row = {
        id,
        user_id: userId,
        refresh_token_hash: refreshTokenHash,
        user_agent: userAgent,
        ip_hash: ipHash,
        expires_at: expiresAt,
        revoked_at: null,
      };
      sessionsById.set(id, row);
      sessionsByHash.set(refreshTokenHash, id);
      return { id };
    },

    async findSessionByTokenHash(hash) {
      const id = sessionsByHash.get(hash);
      return id ? { ...sessionsById.get(id) } : null;
    },

    async revokeSession(id) {
      const row = sessionsById.get(id);
      if (row && !row.revoked_at) row.revoked_at = new Date();
    },

    async writeAuditLog(entry) {
      auditLog.push({ ...entry, created_at: new Date() });
    },
  };
}
