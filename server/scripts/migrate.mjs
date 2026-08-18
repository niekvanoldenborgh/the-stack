#!/usr/bin/env node
// Applies server/db/migrations/*.sql, in filename order, tracked in a
// `schema_migrations` table so re-running is a no-op once applied.
//
// Reads connection details from env vars (same names the Paperclip runtime
// already exposes): DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
//
// Usage:
//   cd server && npm install && npm run migrate

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
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) NOT NULL,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [appliedRows] = await connection.query('SELECT id FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.id));

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      console.log(`apply ${file}`);
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      for (const statement of splitStatements(sql)) {
        await connection.query(statement);
      }
      await connection.query('INSERT INTO schema_migrations (id) VALUES (?)', [file]);
      console.log(`done  ${file}`);
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
