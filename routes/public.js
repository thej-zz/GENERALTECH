const express = require('express');
const { pool } = require('../db');
const CATEGORIES = require('../categories');

const router = express.Router();
const valid = new Set(CATEGORIES.map(c => c.key));

// Gallery list for the public work pages.
// The ?v=rev on each URL changes when the admin replaces a photo, which is what
// lets /media/:id stay cached for a year without ever showing a stale picture.
router.get('/api/works/:category', async (req, res) => {
  if (!valid.has(req.params.category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    const { rows } = await pool.query(
      'SELECT id, description, rev FROM work_images WHERE category = $1 ORDER BY sort_order, id',
      [req.params.category]
    );
    res.set('Cache-Control', 'no-cache');
    res.json(rows.map(r => ({
      id: r.id,
      description: r.description,
      thumb: `/media/${r.id}/thumb?v=${r.rev}`,
      full: `/media/${r.id}?v=${r.rev}`
    })));
  } catch (err) {
    console.error('[works]', err.message);
    res.status(503).json({ error: 'Gallery temporarily unavailable' });
  }
});

// Image bytes. For a given id + rev the content never changes, so it can be cached for a year.
async function sendImage(col, req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.sendStatus(404);
  try {
    const { rows } = await pool.query(`SELECT mime, ${col} AS img FROM work_images WHERE id = $1`, [id]);
    if (!rows.length) return res.sendStatus(404);
    res.set({
      'Content-Type': rows[0].mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(rows[0].img);
  } catch (err) {
    console.error('[media]', err.message);
    res.sendStatus(503);
  }
}
router.get('/media/:id', (req, res) => sendImage('data', req, res));
router.get('/media/:id/thumb', (req, res) => sendImage('thumb', req, res));

// Homepage banner. Serves the photo uploaded in the dashboard, or falls back to the
// original file in /assets when none has been uploaded (or the database is down),
// so the homepage always has a banner.
const HERO_FALLBACK = '/assets/hero-bg.jpeg';
router.get('/site/hero', async (req, res) => {
  try {
    const meta = await pool.query("SELECT rev, mime FROM site_images WHERE key = 'hero'");
    if (!meta.rows.length) return res.redirect(302, HERO_FALLBACK);
    const { rev, mime } = meta.rows[0];
    // Always revalidate (so a new banner shows immediately) but answer 304 without
    // reading the image from the database when the browser already has this version.
    res.set({ 'Content-Type': mime, 'Cache-Control': 'no-cache', ETag: `"hero-${rev}"`, 'X-Content-Type-Options': 'nosniff' });
    if (req.fresh) return res.status(304).end();
    const { rows } = await pool.query("SELECT data FROM site_images WHERE key = 'hero'");
    if (!rows.length) return res.redirect(302, HERO_FALLBACK);
    res.send(rows[0].data);
  } catch (err) {
    console.error('[hero]', err.message);
    res.redirect(302, HERO_FALLBACK);
  }
});

module.exports = router;