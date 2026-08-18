// mysql2 pool factory. Separate from scripts/migrate.mjs's own connection
// helper (that one is a one-shot script; this is a long-lived pool for the
// API process) but reads the same env var names on purpose.
import mysql from 'mysql2/promise';

export function createPool(env = process.env) {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  return mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  });
}
