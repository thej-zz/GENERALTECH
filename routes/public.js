const express = require('express');
const { pool } = require('../db');
const CATEGORIES = require('../categories');

const router = express.Router();
const valid = new Set(CATEGORIES.map(c => c.key));

// Gallery list for the public work pages.
router.get('/api/works/:category', async (req, res) => {
  if (!valid.has(req.params.category)) return res.status(404).json({ error: 'Unknown category' });
  try {
    const { rows } = await pool.query(
      'SELECT id, description FROM work_images WHERE category = $1 ORDER BY sort_order, id',
      [req.params.category]
    );
    res.set('Cache-Control', 'no-cache');
    res.json(rows.map(r => ({
      id: r.id,
      description: r.description,
      thumb: `/media/${r.id}/thumb`,
      full: `/media/${r.id}`
    })));
  } catch (err) {
    console.error('[works]', err.message);
    res.status(503).json({ error: 'Gallery temporarily unavailable' });
  }
});

// Image bytes. An id's content never changes, so it can be cached for a year.
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

module.exports = router;
