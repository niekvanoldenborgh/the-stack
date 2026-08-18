// SQL-backed implementation of the auth store interface (see
// test/fakeAuthStore.mjs for the in-memory twin used by the unit tests —
// the agent sandbox can't reach the live DB, see server/README.md "Infra").
// Every function here maps 1:1 onto a table from db/migrations/001_init.sql;
// none of it re-derives or re-shapes engine/domain logic.
import { randomUUID } from 'node:crypto';

export function createMysqlAuthStore(pool) {
  return {
    async findUserByEmail(emailNormalized) {
      const [rows] = await pool.execute(
        'SELECT id, email, status, deleted_at FROM users WHERE email_normalized = ? LIMIT 1',
        [emailNormalized],
      );
      return rows[0] ?? null;
    },

    async getUserById(id) {
      const [rows] = await pool.execute('SELECT id, email, status, deleted_at FROM users WHERE id = ? LIMIT 1', [id]);
      return rows[0] ?? null;
    },

    // Inserts `users` + `auth_identities` (provider='password') in one
    // transaction so a partial failure never leaves an identity-less user
    // row or a user-less identity row.
    async createUserWithPassword({ email, passwordHash }) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const userId = randomUUID();
        await conn.execute('INSERT INTO users (id, email) VALUES (?, ?)', [userId, email]);
        await conn.execute(
          `INSERT INTO auth_identities (id, user_id, provider, provider_subject, password_hash)
           VALUES (?, ?, 'password', ?, ?)`,
          [randomUUID(), userId, email, passwordHash],
        );
        await conn.commit();
        return { id: userId, email };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },

    async findPasswordIdentity(emailNormalized) {
      const [rows] = await pool.execute(
        `SELECT ai.user_id AS user_id, ai.password_hash AS password_hash, u.status AS status, u.deleted_at AS deleted_at
         FROM auth_identities ai
         JOIN users u ON u.id = ai.user_id
         WHERE ai.provider = 'password' AND ai.provider_subject = ?
         LIMIT 1`,
        [emailNormalized],
      );
      return rows[0] ?? null;
    },

    async touchPasswordIdentity(userId) {
      await pool.execute(
        `UPDATE auth_identities SET last_used_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND provider = 'password'`,
        [userId],
      );
    },

    async recordConsents(userId, consents) {
      for (const c of consents) {
        await pool.execute(
          `INSERT INTO consents (id, user_id, purpose, granted, legal_basis, policy_version)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [randomUUID(), userId, c.purpose, c.granted, c.legalBasis ?? 'consent', c.policyVersion],
        );
      }
    },

    // Latest row for the purpose wins — `consents` is append-only, so
    // "currently granted" means "most recent row for this purpose says so"
    // (server README design principle 5).
    async hasActiveConsent(userId, purpose) {
      const [rows] = await pool.execute(
        `SELECT granted FROM consents WHERE user_id = ? AND purpose = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`,
        [userId, purpose],
      );
      return rows.length > 0 && Boolean(rows[0].granted);
    },

    async createSession({ userId, refreshTokenHash, userAgent, ipHash, expiresAt }) {
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_hash, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, refreshTokenHash, userAgent ?? null, ipHash ?? null, expiresAt],
      );
      return { id };
    },

    async findSessionByTokenHash(hash) {
      const [rows] = await pool.execute(
        `SELECT id, user_id AS user_id, expires_at AS expires_at, revoked_at AS revoked_at FROM sessions WHERE refresh_token_hash = ? LIMIT 1`,
        [hash],
      );
      return rows[0] ?? null;
    },

    async revokeSession(id) {
      await pool.execute(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND revoked_at IS NULL`, [id]);
    },

    // `metadata` must only ever hold ids/enums/counts (schema comment on
    // `audit_log.metadata`) — never pass raw email/IP/free text here.
    async writeAuditLog({ userId, eventType, metadata }) {
      await pool.execute('INSERT INTO audit_log (user_id, event_type, metadata) VALUES (?, ?, ?)', [
        userId ?? null,
        eventType,
        metadata ? JSON.stringify(metadata) : null,
      ]);
    },
  };
}
