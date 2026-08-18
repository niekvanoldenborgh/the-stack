// Argon2id password hashing (server README design principle 3 / THEA-87
// schema: `auth_identities.password_hash` is "Argon2id encoded hash
// (algorithm + params + salt + hash in one string)"). `argon2.hash` already
// returns that self-describing PHC string, so there is nothing else to store
// alongside it — no separate salt/params columns to keep in sync.
import argon2 from 'argon2';

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed/foreign hash (e.g. a future migration away from argon2)
    // fails closed rather than throwing into the caller's control flow.
    return false;
  }
}
