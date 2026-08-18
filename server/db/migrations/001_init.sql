-- THEA-87 / THEA-84a — account/identity + health schema (GDPR-first, federated).
--
-- Design principles (see server/README.md for the full rationale):
--   * Identity and health data live in physically separate tables so an
--     access grant to one never implies access to the other.
--   * Every table that can hold personal data is keyed on `users.id` with
--     `ON DELETE CASCADE`, so deleting the `users` row (Art. 17 erasure)
--     removes everything without a hand-written fan-out query.
--   * No plaintext secrets: passwords are Argon2id hashes, refresh tokens
--     are SHA-256 hashes, IPs are HMAC-SHA256 with a server-side pepper —
--     never the raw value, and never an unsalted digest of it either.
--   * MySQL 8.0+, InnoDB, utf8mb4. All timestamps are UTC.
--   * Nested/computed snapshots (a Stack's generated items, its SafetyReport,
--     a WorkoutProgram's sessions) are stored as JSON verbatim rather than
--     re-normalised — that logic lives in src/engine and this schema must
--     not fork a second copy of it (AGENTS.md: safety logic doesn't live
--     in the data layer).
--   * `Dose` values always keep their unit alongside the number — no
--     mcg/mg/iu column is ever implicitly convertible (AGENTS.md invariant 8).

-- ---------------------------------------------------------------------------
-- Account / identity
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id                 CHAR(36) NOT NULL,
  email              VARCHAR(320) NOT NULL,
  email_normalized   VARCHAR(320) GENERATED ALWAYS AS (LOWER(email)) STORED,
  email_verified_at  DATETIME(3) NULL,
  -- 'deleted' is currently unreachable: the planned hard-purge is a literal
  -- `DELETE FROM users`, which removes the row rather than transitioning it
  -- to this status. It's reserved here in case the purge design lands on
  -- anonymize-in-place instead of true delete — whichever is decided when
  -- that job gets built determines whether this value is ever set (THEA-88
  -- review, item 5, non-blocking).
  status             ENUM('active','suspended','pending_deletion','deleted') NOT NULL DEFAULT 'active',
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- Soft-delete tombstone for an in-flight erasure request (Art. 17). A
  -- separate, documented hard-purge step later removes the row itself,
  -- which cascades to every table below. Not implemented in this migration.
  deleted_at         DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email_normalized (email_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per login method. Supports email+password today (owner chose
-- "ship email+password first" — THEA-84 interaction 89fc38e9) and Google /
-- Apple OIDC without a schema change once those dev accounts exist.
CREATE TABLE auth_identities (
  id                 CHAR(36) NOT NULL,
  user_id            CHAR(36) NOT NULL,
  provider           ENUM('password','google','apple') NOT NULL,
  -- 'password'      -> normalized email
  -- 'google'/'apple' -> the OIDC `sub` claim (stable, unique per IdP)
  provider_subject   VARCHAR(255) NOT NULL,
  -- Argon2id encoded hash (algorithm + params + salt + hash in one string).
  -- NULL for oauth providers, required for 'password'.
  password_hash      VARCHAR(255) NULL,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_used_at       DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_provider_subject (provider, provider_subject),
  UNIQUE KEY uq_auth_user_provider (user_id, provider),
  KEY idx_auth_identities_user (user_id),
  CONSTRAINT fk_auth_identities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_auth_password_hash CHECK (
    (provider = 'password' AND password_hash IS NOT NULL) OR
    (provider <> 'password' AND password_hash IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh-token sessions. The raw token is never stored, only its hash, so
-- a database read can't be replayed as a login.
CREATE TABLE sessions (
  id                   CHAR(36) NOT NULL,
  user_id              CHAR(36) NOT NULL,
  refresh_token_hash   CHAR(64) NOT NULL, -- SHA-256 hex of the refresh token
  user_agent           VARCHAR(255) NULL,
  -- HMAC-SHA256(ip, SESSION_IP_PEPPER) hex, never a bare SHA-256(ip) and
  -- never the raw IP. IPv4 space (~4.3B addresses) is small enough to brute
  -- force offline from an unsalted digest alone, so a server-side secret
  -- pepper (env var, not stored in this DB) is required for this column to
  -- actually pseudonymize the address rather than just obscure it. Set at
  -- the write site once the API layer exists (THEA-88 review, item 1).
  ip_hash              CHAR(64) NULL,
  created_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at           DATETIME(3) NOT NULL,
  revoked_at           DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token_hash (refresh_token_hash),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only consent log (never UPDATEd in place) so a grant/revoke history
-- can be produced on demand — Art. 7(1) requires the controller be able to
-- demonstrate consent, not just assert current state.
CREATE TABLE consents (
  id            CHAR(36) NOT NULL,
  user_id       CHAR(36) NOT NULL,
  -- 'health_data_processing' is the Art. 9(2)(a) explicit consent required
  -- before any row is written to the health tables below.
  purpose       ENUM('account','health_data_processing','marketing') NOT NULL,
  granted       BOOLEAN NOT NULL,
  legal_basis   ENUM('consent','contract','legal_obligation') NOT NULL DEFAULT 'consent',
  policy_version VARCHAR(32) NOT NULL, -- privacy-policy/ToS version this consent text corresponds to
  recorded_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_consents_user_purpose (user_id, purpose, recorded_at),
  CONSTRAINT fk_consents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- Art. 9(2)(a) requires *explicit consent* specifically for special-
  -- category (health) data — 'contract' or 'legal_obligation' aren't valid
  -- bases for this purpose the way they can be for 'account'/'marketing'.
  CONSTRAINT chk_consents_health_requires_consent CHECK (
    purpose <> 'health_data_processing' OR legal_basis = 'consent'
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Access / erasure / portability requests (Art. 15, 17, 20). This table is
-- itself the evidence trail proving those requests were made and resolved,
-- so unlike the other health/identity tables it must survive the user row
-- being hard-deleted rather than cascade away with it — that would destroy
-- the proof at the exact moment erasure completes. user_id -> NULL on
-- delete, same depersonalise-not-destroy pattern as `audit_log`.
CREATE TABLE data_subject_requests (
  id            CHAR(36) NOT NULL,
  user_id       CHAR(36) NULL,
  kind          ENUM('access','erasure','export') NOT NULL,
  status        ENUM('pending','completed','rejected') NOT NULL DEFAULT 'pending',
  requested_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at  DATETIME(3) NULL,
  note          VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_dsr_user (user_id),
  CONSTRAINT fk_dsr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Security/compliance audit trail. Survives a hard-delete of the user
-- (user_id -> NULL) so "an account existed and was erased on <date>" remains
-- provable without retaining any personal data.
CREATE TABLE audit_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      CHAR(36) NULL,
  -- e.g. 'login_success', 'login_failed', 'password_changed',
  -- 'consent_granted', 'consent_revoked', 'data_exported', 'account_erased'
  event_type   VARCHAR(64) NOT NULL,
  -- IDs, enums and counts only — NEVER personal data (an email, IP, name,
  -- free-text note, etc). This table is deliberately exempt from the
  -- cascade-on-delete that erases every other personal-data table (see
  -- fk_audit_user below), specifically so it can prove an account existed
  -- and was erased. That guarantee inverts if metadata ever holds PII: a
  -- hard-delete would no longer erase it. There is no DB-level way to
  -- constrain JSON shape here, so this is an API/logging-call-site
  -- discipline, not something this migration can enforce — e.g. a
  -- 'login_failed' event should log the resolved user_id (once known) or a
  -- generic failure reason code, never the raw email/IP that was attempted.
  metadata     JSON NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_event_type (event_type),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Health data (owner-authorised full scope — THEA-84 interaction 89fc38e9
-- answered "account + full peptide/dosing history server-side"). Every table
-- here holds special-category data under GDPR Art. 9 and must only be
-- written once a 'health_data_processing' consent row exists for the user;
-- that check belongs to the API layer, not this schema.
-- ---------------------------------------------------------------------------

-- Mirrors src/domain/types.ts `UserProfile`, 1:1 with users.
CREATE TABLE user_health_profiles (
  user_id                 CHAR(36) NOT NULL,
  age                     SMALLINT UNSIGNED NOT NULL,
  sex                     ENUM('male','female','other') NOT NULL,
  weight_kg               DECIMAL(5,2) NOT NULL,
  height_cm               DECIMAL(5,1) NOT NULL,
  body_fat_pct            DECIMAL(4,1) NULL,
  activity                ENUM('sedentary','light','moderate','high','athlete') NOT NULL,
  sleep_hours             DECIMAL(3,1) NOT NULL,
  sleep_quality           TINYINT UNSIGNED NOT NULL,
  training_days           TINYINT UNSIGNED NOT NULL,
  experience              ENUM('none','some','experienced') NOT NULL,
  risk_tolerance          TINYINT UNSIGNED NOT NULL,
  accepted_disclaimer_at  DATETIME(3) NULL,
  -- goals/health_flags/current_peptides are string-union arrays that mirror
  -- domain/types.ts 1:1 and aren't queried relationally anywhere today;
  -- goal_target is a small nested object (metricId/value/baseline/setAt).
  -- Kept as JSON rather than junction tables until a real query need shows up.
  goals                   JSON NOT NULL,
  health_flags            JSON NOT NULL,
  current_peptides        JSON NOT NULL,
  goal_target             JSON NULL,
  profile_created_at      DATETIME(3) NOT NULL, -- UserProfile.createdAt from the client
  updated_at              DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_health_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors src/domain/types.ts `Stack`.
CREATE TABLE stacks (
  id          CHAR(36) NOT NULL,
  user_id     CHAR(36) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  origin      ENUM('generated','custom') NOT NULL,
  goals       JSON NOT NULL,
  start_date  DATE NOT NULL,
  notes       VARCHAR(2000) NULL,
  -- `items` (StackItem[]: dose/schedule/rationale/score per compound) and
  -- `safety` (the SafetyReport, explicitly documented in domain/types.ts as
  -- "a snapshot of the safety report at creation time") are engine output,
  -- stored verbatim so this table can never drift from src/engine's own
  -- shape or quietly re-derive a second copy of dosing/safety logic.
  items       JSON NOT NULL,
  safety      JSON NOT NULL,
  created_at  DATETIME(3) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY idx_stacks_user (user_id),
  CONSTRAINT fk_stacks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users.active_stack_id added after `stacks` exists, to avoid a forward FK.
ALTER TABLE user_health_profiles
  ADD COLUMN active_stack_id CHAR(36) NULL AFTER goal_target,
  ADD CONSTRAINT fk_health_profiles_active_stack
    FOREIGN KEY (active_stack_id) REFERENCES stacks(id) ON DELETE SET NULL;

-- Mirrors the client's `Record<scheduledDoseId, DoseLog>`. scheduledDoseId is
-- deterministic (derived from stack/peptide/date/time), not a DB-generated id.
CREATE TABLE dose_logs (
  scheduled_dose_id  VARCHAR(191) NOT NULL,
  user_id            CHAR(36) NOT NULL,
  status             ENUM('taken','skipped') NOT NULL,
  logged_at          DATETIME(3) NOT NULL,
  -- Actual dose if the user deviated from the scheduled one. Unit travels
  -- with the value always (AGENTS.md invariant 8 — no implicit conversion).
  actual_dose_value  DECIMAL(10,4) NULL,
  actual_dose_unit   ENUM('mcg','mg','iu','pct') NULL,
  note               VARCHAR(500) NULL,
  PRIMARY KEY (user_id, scheduled_dose_id),
  CONSTRAINT fk_dose_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors `SideEffectLog`. Severity is the user's own 1-10 number, never
-- defaulted or derived (THEA-9 P&S sign-off) — this table just stores it.
CREATE TABLE side_effect_logs (
  id        CHAR(36) NOT NULL,
  user_id   CHAR(36) NOT NULL,
  log_date  DATE NOT NULL,
  label     VARCHAR(120) NOT NULL,
  severity  TINYINT UNSIGNED NOT NULL,
  note      VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_side_effect_logs_user (user_id),
  CONSTRAINT fk_side_effect_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors `InjectionLog`. Dose/site/pain are all user-entered — the app
-- never suggests or computes any of these (THEA-6 no-dosage boundary).
CREATE TABLE injection_logs (
  id            CHAR(36) NOT NULL,
  user_id       CHAR(36) NOT NULL,
  log_date      DATE NOT NULL,
  log_time      TIME NOT NULL,
  peptide_id    VARCHAR(64) NOT NULL,
  dose_value    DECIMAL(10,4) NOT NULL,
  dose_unit     ENUM('mcg','mg','iu','pct') NOT NULL,
  drawn_units   DECIMAL(6,2) NULL,
  site          ENUM(
    'abdomen_left','abdomen_right','thigh_left','thigh_right',
    'upper_arm_left','upper_arm_right','glute_left','glute_right'
  ) NOT NULL,
  pain_level    TINYINT UNSIGNED NOT NULL,
  note          VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_injection_logs_user (user_id),
  CONSTRAINT fk_injection_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors `Measurement` — self-reported goal-progress readings. The app
-- charts these and computes deltas but never judges or targets a value
-- itself (domain/types.ts doc comment on `Measurement`).
CREATE TABLE measurements (
  id            CHAR(36) NOT NULL,
  user_id       CHAR(36) NOT NULL,
  metric_id     VARCHAR(64) NOT NULL,
  custom_label  VARCHAR(120) NULL,
  custom_unit   VARCHAR(32) NULL,
  log_date      DATE NOT NULL,
  value         DECIMAL(10,3) NOT NULL,
  note          VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_measurements_user (user_id),
  CONSTRAINT fk_measurements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors `WorkoutProgram`. `sessions` (PlannedSession[]) is engine-generated
-- nested structure, stored verbatim for the same reason as `stacks.items`.
CREATE TABLE workout_programs (
  id                  CHAR(36) NOT NULL,
  user_id             CHAR(36) NOT NULL,
  name                VARCHAR(120) NOT NULL,
  days_per_week       TINYINT UNSIGNED NOT NULL,
  split               VARCHAR(64) NOT NULL,
  goals               JSON NOT NULL,
  deload_every_weeks  TINYINT UNSIGNED NOT NULL,
  sessions            JSON NOT NULL,
  rationale           JSON NOT NULL,
  created_at          DATETIME(3) NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  KEY idx_workout_programs_user (user_id),
  CONSTRAINT fk_workout_programs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors `WorkoutSessionLog`.
CREATE TABLE workout_logs (
  id                  CHAR(36) NOT NULL,
  user_id             CHAR(36) NOT NULL,
  program_id          CHAR(36) NULL,
  session_id          VARCHAR(64) NOT NULL,
  log_date            DATE NOT NULL,
  exercises           JSON NOT NULL, -- LoggedExercise[] snapshot
  duration_minutes    SMALLINT UNSIGNED NULL,
  perceived_effort    TINYINT UNSIGNED NULL,
  note                VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_workout_logs_user (user_id),
  CONSTRAINT fk_workout_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_workout_logs_program FOREIGN KEY (program_id) REFERENCES workout_programs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors `Settings`. Core display prefs get real columns; the rest
-- (per-slot time overrides, per-purpose notification toggles, section
-- order) are small nested/keyed structures kept as JSON.
CREATE TABLE user_settings (
  user_id                    CHAR(36) NOT NULL,
  reminders_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  mass_unit                  ENUM('kg','lb') NOT NULL DEFAULT 'kg',
  length_unit                ENUM('cm','ft') NOT NULL DEFAULT 'cm',
  theme                      ENUM('system','dark') NOT NULL DEFAULT 'system',
  alarm_offsets_min          JSON NOT NULL,
  notifications              JSON NOT NULL,
  custom_times               JSON NOT NULL,
  summary_order              JSON NOT NULL,
  pk_modal_acknowledged_at   DATETIME(3) NULL,
  updated_at                 DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
