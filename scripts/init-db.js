import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
});

try {
  await pool.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  console.log('NVA-CRM PostgreSQL schema is ready');
} finally {
  await pool.end();
}
