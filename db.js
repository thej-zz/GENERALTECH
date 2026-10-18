const { Pool } = require('pg');
const CATEGORIES = require('./categories');

const url = process.env.DATABASE_URL;
const isLocal = !url || /@(localhost|127\.0\.0\.1)/.test(url);

const pool = new Pool({
  connectionString: url,
  // Hosted Postgres (Render, Neon, Supabase...) needs SSL; local dev doesn't.
  ssl: isLocal || process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10
});
pool.on('error', err => console.error('[db] idle client error:', err.message));

const keys = CATEGORIES.map(c => `'${c.key}'`).join(',');

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_images (
      id          SERIAL PRIMARY KEY,
      category    TEXT NOT NULL CHECK (category IN (${keys})),
      description TEXT NOT NULL DEFAULT '',
      mime        TEXT NOT NULL,
      data        BYTEA NOT NULL,
      thumb       BYTEA NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS work_images_cat_order
      ON work_images (category, sort_order, id);
  `);
}

module.exports = { pool, init };