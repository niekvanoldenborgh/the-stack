# the-stack — backend account/health schema (THEA-84a / THEA-87)

This directory is the MySQL side of THEA-84 ("Backend Development"). It is
**not** part of the Expo app — nothing here is imported by `app/` or `src/`,
and it ships its own `package.json` so `mysql2` never touches the client
bundle. See `AGENTS.md` for why `src/domain`/`src/engine` stay backend-free;
this is the mirror rule in the other direction.

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
  package.json          — isolated deps (mysql2); npm install here, not at repo root
  db/migrations/
    001_init.sql         — full DDL, see inline comments for rationale
  scripts/migrate.mjs    — applies migrations/*.sql in order, tracked in schema_migrations
```

Run it (once the DB is actually reachable from wherever you run it):

```bash
cd server
npm install
DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... npm run migrate
```

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
9. **Art. 8 (children) has schema support, not yet an enforced policy.**
   AGENTS.md documents shipped under-18/21/25 handling in the recommendation
   engine, so minors are a known user segment — but the account schema had
   no age-of-consent gate at all (THEA-86 review item 2). `users.date_of_birth`
   (verified, distinct from the self-reported, editable
   `user_health_profiles.age`) and `guardian_consents` (verifiable
   parental/guardian consent, kept separate from `consents` because it
   carries a second person's identifying data) now exist so the schema can
   support whichever minimum-age policy gets decided. **The actual number,
   and how the API layer enforces it at signup, is a pending CEO/product
   decision — not invented here.** Tracked in THEA-95.

## GDPR mechanics this schema supports directly

- **Right of access (Art. 15) / erasure (Art. 17) / portability (Art. 20):**
  `data_subject_requests` is an audit trail of each request and its
  resolution. Actually serving an export or performing the purge is API-layer
  work, not built here.
- **Records of consent (Art. 7(1)):** `consents`, append-only, keyed by
  purpose and policy version.
- **Security logging:** `audit_log` — login attempts, password changes,
  consent changes, exports, erasures.
- **Children/minors (Art. 8):** `users.date_of_birth` + `guardian_consents`
  give the API layer somewhere to enforce an age-of-consent gate and
  verified guardian consent below it. The gate itself — the minimum age and
  the enforcement rule — is a pending product/legal decision (THEA-95), not
  something this schema decides.

## What this migration deliberately does not do

- Does not implement the API/auth server itself (login endpoints, JWT/session
  issuance, Argon2id hashing call site, OAuth callback handlers) — this
  ticket (THEA-87 / THEA-84a) is schema only, per its title.
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
- Does not enforce the `health_data_processing` consent gate or the (not yet
  decided) Art. 8 minimum-age gate — both are explicitly application-layer
  work, called out as hard preconditions on whichever ticket writes to the
  tables they gate (see design principles 5 and 9 above).
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
