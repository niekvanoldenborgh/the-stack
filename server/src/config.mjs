// Central env-var reader. `server/README.md` documents what a real deploy
// needs; this is the code-level mirror of that list — one place that throws
// loudly at boot if something required is missing, instead of a route
// discovering it mid-request.
export function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Missing required env var: JWT_SECRET (used to sign access tokens)');
  }
  return {
    jwtSecret,
    // Server-side pepper for `sessions.ip_hash` (tokens.mjs#hashIp). Optional
    // by design: without it we simply don't store an ip_hash for the session
    // rather than falling back to an unsalted digest (see tokens.mjs).
    sessionIpPepper: env.SESSION_IP_PEPPER || null,
    // Which privacy-policy/ToS version new consent rows are stamped with.
    // Coordinate with whatever THEA-91/THEA-93 version their document as —
    // this is a placeholder default, not a real version identifier.
    tosPolicyVersion: env.TOS_POLICY_VERSION || 'unversioned',
    port: Number(env.PORT ?? 3001),
  };
}
