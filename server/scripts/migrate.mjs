#!/usr/bin/env node
// Applies server/db/migrations/*.sql, in filename order, tracked per-statement
// (not per-file) in a `schema_migrations` table so a mid-file failure can be
// safely retried: the run resumes at the first unapplied statement instead of
// re-running (and dying on) statements that already landed.
//
// Reads connection details from env vars (same names the Paperclip runtime
// already exposes): DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
//
// Usage:
//   cd server && npm install && npm run migrate

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

function splitStatements(sql) {
  // Strips `--` line comments, then splits on `;` at statement end. None of
  // the migrations in this repo use `;` inside a string/JSON literal, so a
  // naive split is safe; revisit with a real SQL splitter if that changes.
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(Boolean);
}

function checksum(statement) {
  return createHash('sha256').update(statement, 'utf8').digest('hex');
}

async function main() {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  try {
    // Tracking granularity is per-statement, not per-file: a row is written
    // the moment its statement succeeds, so a crash mid-file leaves an
    // accurate record of exactly how far the file got. The next run resumes
    // at the first unrecorded statement rather than replaying the whole file
    // (and dying on a `CREATE TABLE` that already exists).
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_file   VARCHAR(255) NOT NULL,
        statement_index  INT UNSIGNED NOT NULL,
        checksum         CHAR(64) NOT NULL, -- sha256 hex of the statement text, drift-detection
        applied_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (migration_file, statement_index)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const [appliedRows] = await connection.query(
        'SELECT statement_index, checksum FROM schema_migrations WHERE migration_file = ?',
        [file]
      );
      const applied = new Map(appliedRows.map((row) => [row.statement_index, row.checksum]));

      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const statements = splitStatements(sql);

      let ranAny = false;
      for (const [index, statement] of statements.entries()) {
        const stmtChecksum = checksum(statement);
        const appliedChecksum = applied.get(index);

        if (appliedChecksum !== undefined) {
          if (appliedChecksum !== stmtChecksum) {
            // The file was edited after one of its statements already ran
            // against this database — resuming would silently apply a
            // different statement than the one the checksum was recorded
            // for. Refuse rather than guess; a new migration file is the
            // correct fix, not editing history.
            throw new Error(
              `${file}: statement ${index} changed after being applied ` +
                `(recorded checksum ${appliedChecksum}, file now has ${stmtChecksum}). ` +
                `Add a new migration instead of editing an applied one.`
            );
          }
          continue; // already applied, unchanged — skip
        }

        console.log(`apply ${file} [${index + 1}/${statements.length}]`);
        await connection.query(statement);
        await connection.query(
          'INSERT INTO schema_migrations (migration_file, statement_index, checksum) VALUES (?, ?, ?)',
          [file, index, stmtChecksum]
        );
        ranAny = true;
      }

      console.log(ranAny ? `done  ${file}` : `skip  ${file} (already applied)`);
    }

    console.log('All migrations applied.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
