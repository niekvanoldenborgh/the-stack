# the-stack — backend account/health schema + auth API (THEA-84a/THEA-87, THEA-84c/THEA-90)

This directory is the MySQL + API side of THEA-84 ("Backend Development"). It
is **not** part of the Expo app — nothing here is imported by `app/` or
`src/`, and it ships its own `package.json` so `mysql2`/`express`/`argon2`
never touch the client bundle. See `AGENTS.md` for why `src/domain`/
`src/engine` stay backend-free; this is the mirror rule in the other
direction.

## Scope (owner-decided, THEA-84 interaction `89fc38e9`, answered 2026-08-18)

- **Data scope: full.** Account/auth identity *and* the complete peptide/
  dosing history move server-side — not auth-only. That data is
  special-category under GDPR Art. 9, so it's held in physically separate
  tables from identity data (see below), never merged into one blob.
- **Infra:** the owner has a MySQL instance already running; this run's env
  vars (`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_NAME`/`DB_PASSWORD`) log in as
  `ai_dev`. **From this agent sandbox that host is unreachable** —
  `server/scripts/migrate.mjs` fails with `ECONNREFUSED 127.0.0.1:3306`, and
  there's no `mysqld` listening locally either. That's a network-reachability
  gap in the *agent runtime*, not a schema problem — the tooling below is
  ready to run the moment it's executed somewhere with a real path to that
  host (e.g. the owner's own machine, or a future deploy step).
- **Auth methods:** ship email + password first (owner chose "email first").
  Google and Apple sign-in need developer accounts the owner hasn't created
  yet — the schema already supports both (`auth_identities.provider`) so
  adding them later needs zero migration.

## What's here

```
server/
  package.json          — isolated deps (mysql2, express, argon2, jsonwebtoken);
                           npm install here, not at repo root
  db/migrations/
    001_init.sql         — full DDL, see inline comments for rationale
  scripts/migrate.mjs    — applies migrations/*.sql in order, tracked in schema_migrations
  src/
    config.mjs            — env-var loader (throws at boot if something required is missing)
    db.mjs                 — mysql2 pool factory
    app.mjs                — express app factory (no listen() — used directly by tests)
    server.mjs             — process entrypoint: real pool + config + app.listen()
    lib/
      errors.mjs            — ApiError(status, code, message)
      validation.mjs        — email/password shape rules (server-side source of truth)
      password.mjs          — Argon2id hash/verify
      tokens.mjs            — access-token JWT + refresh-token hashing + ip_hash HMAC
    auth/
      service.mjs           — register/login/refresh/logout/session-lookup business logic
      store.mysql.mjs       — SQL implementation of the store interface service.mjs depends on
      routes.mjs            — Express router + error handler mapping ApiError -> HTTP
  test/
    fakeAuthStore.mjs      — in-memory twin of store.mysql.mjs, same method names/shapes
    *.test.mjs              — unit + HTTP-integration tests, run against the fake store
```

Migrate (once the DB is actually reachable from wherever you run it):

```bash
cd server
npm install
DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... npm run migrate
```

## Running the API

```bash
cd server
npm install
cp .env.example .env   # fill in DB_*, JWT_SECRET, SESSION_IP_PEPPER
npm start               # node src/server.mjs, listens on PORT (default 3001)
```

```bash
npm test                 # node --test "test/**/*.test.mjs" — no DB needed, see "Infra" below
```

### Endpoints (THEA-90, email+password only — see "Scope" above)

All under `/api/auth`. Every error response is `{ "error": { "code": "...", "message": "..." } }`
with a stable `code` the client can switch on (the create-account/sign-in
screen's `Callout` copy, THEA-97 §4.4, is keyed off these).

| Method & path | Body | Notes |
|---|---|---|
| `POST /register` | `{ email, password, dateOfBirth, tosAccepted, healthDataConsent }` | Both consent flags must be `true` — two separate `consents` rows, not one bundled checkbox (see `service.mjs` consent-purpose-mapping comment for why `tosAccepted` lands under `purpose='account'`, not a `'terms_of_service'` value the schema doesn't have). `dateOfBirth` is `YYYY-MM-DD`, required, self-attested, server-enforced 18+ (THEA-95 — see design principle 9 below); 400 `invalid_date_of_birth` / `under_18`. 201 + `{ user, accessToken, refreshToken, expiresIn }`. 409 `email_already_registered` on duplicate. |
| `POST /login` | `{ email, password }` | 401 `invalid_credentials` for both "no such user" and "wrong password" — same message, deliberately (auth-enumeration hygiene). |
| `POST /refresh` | `{ refreshToken }` | Rotates: the presented token is revoked and a new one issued, so a captured-but-unused refresh token stops working the moment the real client refreshes. 401 `invalid_refresh_token` if expired/revoked/unknown. |
| `POST /logout` | `{ refreshToken }` | Revokes that session. 204, silently a no-op for an unknown token. |
| `GET /me` | — (`Authorization: Bearer <accessToken>`) | 200 `{ user: { id, email, tosAccepted, healthDataConsent } }`, 401 `unauthorized` otherwise. |

Access tokens are JWTs (`JWT_SECRET`, 15 min TTL). Refresh tokens are opaque
random strings; only their SHA-256 hash is ever persisted (`sessions.refresh_token_hash`),
matching design principle 3 below. `service.mjs` also exports
`requireHealthConsent(store, userId)` — unused by these routes (register/
login only touch `users`/`auth_identities`/`consents`) but ready for
whichever future ticket writes to the Art. 9 health tables; see that
function's doc comment and design principle 5.

### Running it with Docker (THEA-84d)

```bash
cp .env.example .env   # fill in DB_*, JWT_SECRET, SESSION_IP_PEPPER
cd ..                  # docker-compose.yml lives at the repo root
docker compose up --build
```

Two services, one image (`server/Dockerfile`):

- `migrate` runs `node scripts/migrate.mjs` and exits. It's idempotent at
  statement granularity (see below), so re-running `docker compose up` after
  the schema is already current applies nothing and exits 0 immediately —
  safe to leave in the startup path rather than a manual step someone has
  to remember.
- `api` runs `node src/server.mjs` and only starts once `migrate` exits 0
  (`depends_on: condition: service_completed_successfully`), so the API can
  never come up pointed at an unmigrated schema. It exposes `GET /healthz`
  as its container healthcheck.

This still does not run MySQL itself — see "Scope" above, the owner's
instance is external. `DB_HOST` in `server/.env` has to resolve from
wherever the containers run; `docker compose up` on a host with no network
path to that instance fails at the `migrate` step with the same
`ECONNREFUSED`/timeout this doc already describes for the non-Docker case.

### What a real deploy still needs (open infra gaps, docker-compose does not solve these)

1. **A host to run `docker compose up` on** that also has network access to
   the owner's MySQL instance — docker-compose packages the *how*, not a
   place to run it. The agent sandbox this was built in has neither Docker
   nor a path to that DB, so this stack is untested against a live database;
   `server/test/` covers behaviour, not deployability.
2. **Env vars**: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`,
   `JWT_SECRET` (required — boot fails without it), `SESSION_IP_PEPPER`
   (optional but should be set — see design principle 3), `TOS_POLICY_VERSION`,
   `PORT`. Full list + generation hints in `.env.example`; `docker-compose.yml`
   reads them from `server/.env` via `env_file`.
3. **The app's base URL**: `EXPO_PUBLIC_API_BASE_URL` (`src/lib/api/auth.ts`)
   now has a documented, gitignored home — root `.env.example` — but it is
   still a value someone has to point at wherever `api` actually ends up
   reachable (LAN IP for a simulator/device talking to a local
   `docker compose up`, a real domain once one exists). Nothing computes
   this automatically.
4. **Not yet decided/built, still flagged, still not solved by this ticket**:
   TLS termination / reverse proxy in front of the API (`api` is plain HTTP
   on `:3001`), and CORS — `app.mjs` sets no `Access-Control-*` headers at
   all, so an Expo *web* build calling this cross-origin will be blocked by
   the browser until an explicit allowed-origins policy is decided (native
   iOS/Android callers are unaffected; CORS is a browser-only mechanism).

It's idempotent at **statement** granularity, not just file granularity —
`schema_migrations` records one row per successfully-applied statement
(`migration_file`, `statement_index`), written immediately after that
statement runs. A failure partway through a file leaves an accurate record
of exactly how far it got; re-running resumes at the first unrecorded
statement instead of replaying (and dying on) statements that already
landed. If a file is edited after one of its statements was already applied,
the checksum recorded for that statement won't match and the run refuses
rather than silently applying a different statement under the same index —
add a new migration file instead of editing an applied one.

## Design principles

1. **Identity and health data are physically separate tables.** `users`,
   `auth_identities`, `sessions`, `consents` hold nothing medical. Everything
   in `user_health_profiles`, `stacks`, `dose_logs`, `side_effect_logs`,
   `injection_logs`, `measurements`, `workout_programs`, `workout_logs` is
   special-category (Art. 9) and keyed on `user_id`. A future API/access-
   control layer can grant identity access without implying health access.
2. **Federated identity, not a password column on `users`.** `auth_identities`
   is one row per login method (`password` / `google` / `apple`), each
   uniquely keyed on `(provider, provider_subject)`. `provider_subject` is the
   normalized email for password auth and the OIDC `sub` claim for Google/
   Apple — stable across email or profile-name changes on the IdP side.
3. **No plaintext secrets.** Passwords are Argon2id-encoded hashes (never
   in this schema as plaintext, never reversible). Refresh tokens are stored
   as SHA-256 hashes. Client IPs are stored as `HMAC-SHA256(ip, pepper)`,
   not a bare digest — IPv4 space (~4.3B addresses) is small enough to brute
   force offline from an unsalted SHA-256 alone, so `sessions.ip_hash`
   requires a server-side secret pepper (an env var, set at the API-layer
   write site, never stored in this DB) to actually pseudonymize the address
   rather than just obscure it.
4. **Erasure is one `DELETE`.** Every personal-data table has
   `ON DELETE CASCADE` back to `users.id`. Deleting the user row removes
   everything (Art. 17) without a hand-maintained fan-out list to keep in
   sync as tables get added. `audit_log` and `data_subject_requests` are the
   two exceptions (`ON DELETE SET NULL`) — both keep a depersonalised trail
   (that an account existed and was erased; that an Art. 15/17/20 request
   was made and resolved) without retaining the personal data itself.
   `audit_log.metadata` must only ever hold ids/enums/counts, never PII —
   otherwise a hard-delete would no longer erase it, since this table is
   deliberately exempt from cascade. `users.deleted_at` is a soft-delete
   tombstone for the in-flight request; the hard purge (the actual
   `DELETE FROM users`) is a follow-up this migration doesn't implement.
5. **Consent is an append-only log, not a flag.** `consents` never updates a
   row in place — every grant/revoke is a new row, so "prove this user
   consented to X on date Y" (Art. 7(1)) is a query, not an assumption.
   `purpose = 'health_data_processing'` is the Art. 9(2)(a) explicit consent
   gate that the API layer must check before writing to any health table —
   this migration defines the column, it does not enforce the check; that's
   application logic, out of scope for a schema. It does enforce one narrower
   rule at the DB level (`chk_consents_health_requires_consent`): a
   `health_data_processing` row can't be recorded under `legal_basis =
   'contract'`/`'legal_obligation'`, since Art. 9(2)(a) requires consent
   specifically, not just any lawful basis.
6. **No re-derived dosing/safety logic.** `stacks.items` and `stacks.safety`
   are stored as JSON, verbatim from what `src/engine` computed
   (`domain/types.ts` already documents `Stack.safety` as "a snapshot of the
   safety report at creation time"). Same for `workout_programs.sessions`.
   Re-normalising engine output into relational columns would create a
   second copy of dosing/safety logic outside `src/engine` — exactly what
   AGENTS.md's safety invariants forbid.
7. **Units never travel alone.** Every dose column pairs a numeric value with
   its unit (`dose_unit ENUM('mcg','mg','iu','pct')`) — mirrors AGENTS.md
   invariant 8 (no implicit mg↔mcg conversion) at the schema level.
8. **Data minimisation.** No name, address, or phone number is collected
   anywhere in this schema — the app never asked for them client-side either,
   and the account model doesn't invent a reason to start.
9. **Art. 8 (children): 18+ accounts, enforced at signup (THEA-95).** AGENTS.md
   documents shipped under-18/21/25 handling in the recommendation engine, so
   minors are a known user segment — but the account schema originally had no
   age-of-consent gate at all (THEA-86 review item 2). The owner's THEA-95
   decision was a flat 18+ minimum, self-attested: `registerUser`
   (`auth/service.mjs`) now rejects registration below that age, computed
   from the required `dateOfBirth` field against `users.date_of_birth`
   (verified-at-signup, distinct from the self-reported, editable
   `user_health_profiles.age`). Because 18+ removes the need for a
   below-threshold path, `guardian_consents` stays in the schema unused
   rather than being wired up — there is no verifiable-parental-consent flow
   to build. Rejection copy is deliberately non-shaming and names the
   account-free calculator (`app/settings/account.tsx`, `service.mjs`'s
   `UNDER_AGE_MESSAGE`) so a rejected signup is never a dead end.

## GDPR mechanics this schema supports directly

- **Right of access (Art. 15) / erasure (Art. 17) / portability (Art. 20):**
  `data_subject_requests` is an audit trail of each request and its
  resolution. Actually serving an export or performing the purge is API-layer
  work, not built here.
- **Records of consent (Art. 7(1)):** `consents`, append-only, keyed by
  purpose and policy version.
- **Security logging:** `audit_log` — login attempts, password changes,
  consent changes, exports, erasures.
- **Children/minors (Art. 8):** enforced — `registerUser` rejects
  registration under 18 (THEA-95), computed from the required, self-attested
  `dateOfBirth` and persisted to `users.date_of_birth`. `guardian_consents`
  remains schema-only and unused; the 18+ policy has no below-threshold path
  that needs it.

## What this migration deliberately does not do

- Register/login/refresh/logout/session-lookup are now implemented — see
  "Running the API" above (THEA-90/THEA-84c). OAuth (Google/Apple) callback
  handlers are still not built; the schema supports them
  (`auth_identities.provider`) but no dev accounts exist yet to build against.
- Does not implement the hard-purge job that actually removes a
  `deleted_at`-tombstoned user after the retention window.
- Does not implement column-level encryption for the health tables. If the
  hosting environment can't guarantee disk-level encryption at rest for
  special-category data, that's an infra decision for whoever stands up the
  live server, not something a migration file can decide.
- Does not define a retention/storage-limitation policy (Art. 5(1)(e)) for
  `audit_log` or any other append-only log table — there's currently no
  upper bound on how long a login/consent/erasure event stays queryable.
  Flagged by the THEA-86 review as non-blocking; needs a decision (a
  retention window + a purge job) before this schema should be treated as
  fully compliant, not just "not actively violating" Art. 5.
- Does not enforce the `health_data_processing` consent gate itself — that is
  explicitly application-layer work, called out as a hard precondition on
  whichever ticket writes to the tables it gates (see design principle 5
  above). The Art. 8 minimum-age gate (design principle 9) **is** enforced,
  as of THEA-90/THEA-95.
- Was not applied to the live database — see "Infra" above. Needs a re-run
  from an environment that can actually reach `DB_HOST`.

## Next step

**THEA-86 (THEA-84b, Benji)** GDPR/compliance review of this schema
found three blocking issues (migrate.mjs partial-failure idempotency, no
Art. 8 provision, unenforced consent gate) and several non-blocking ones.
Remediation is split across two tickets because the review process filed it
twice against the same schema before the duplication was caught:

- **THEA-92** (this ticket) — migrate.mjs per-statement idempotency (fixed),
  Art. 8 schema support (fixed, policy decision escalated to **THEA-95**),
  consent-gate enforcement documented as a hard precondition + flagged on
  THEA-90 (the ticket that will actually implement writes), `users.status`/
  `deleted_at` drift closed with a `CHECK` constraint, retention-policy gap
  documented above (not fixed — needs its own decision, not filed as its own
  ticket yet).
- **THEA-94** — `ip_hash` HMAC pepper, `data_subject_requests` `SET NULL`
  fix, `audit_log.metadata` PII-after-erasure guardrail. Tracked and worked
  separately; not duplicated here.
