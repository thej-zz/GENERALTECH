const express = require('express');
const multer = require('multer');
const path = require('path');
const { pool } = require('../db');
const { processImage } = require('../image');
const CATEGORIES = require('../categories');
const auth = require('../auth');

const router = express.Router();
const PUB = path.join(__dirname, 'public');
const valid = new Set(CATEGORIES.map(c => c.key));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 }
});

// Never cache or index anything under /admin.
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin'
  });
  next();
});

// Static assets for the login/dashboard UI (no secrets in these).
router.use('/static', express.static(PUB, { index: false, setHeaders: r => r.set('Cache-Control', 'no-cache') }));

// The dashboard HTML is only ever sent to a signed-in admin.
router.get('/', (req, res) => {
  res.sendFile(path.join(PUB, auth.isAuthed(req) ? 'dashboard.html' : 'login.html'));
});

router.use('/api', express.json({ limit: '10kb' }), auth.requireXhr);

router.post('/api/login', (req, res) => {
  if (!auth.configured) return res.status(503).json({ error: 'Admin is not configured on the server.' });
  if (auth.throttled(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const { username, password } = req.body || {};
  if (!auth.checkCredentials(username, password)) {
    auth.recordFail(req.ip);
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  auth.recordSuccess(req.ip);
  auth.issue(req, res);
  res.json({ ok: true });
});

router.post('/api/logout', (req, res) => { auth.clear(res); res.json({ ok: true }); });

// ---- everything below requires a valid session ----
router.use('/api', auth.requireAuth);

router.get('/api/overview', async (req, res, next) => {
  try {
    const [stats, prev] = await Promise.all([
      pool.query(`
        SELECT category, COUNT(*)::int AS count,
               COALESCE(SUM(octet_length(data) + octet_length(thumb)), 0)::float8 AS bytes
        FROM work_images GROUP BY category`),
      pool.query(`
        SELECT category, id FROM (
          SELECT category, id,
                 ROW_NUMBER() OVER (PARTITION BY category ORDER BY sort_order, id) AS rn
          FROM work_images) t
        WHERE rn <= 3 ORDER BY category, rn`)
    ]);
    const by = Object.fromEntries(stats.rows.map(r => [r.category, r]));
    res.json(CATEGORIES.map(c => ({
      key: c.key, label: c.label,
      count: by[c.key]?.count || 0,
      bytes: by[c.key]?.bytes || 0,
      previews: prev.rows.filter(r => r.category === c.key).map(r => `/media/${r.id}/thumb`)
    })));
  } catch (e) { next(e); }
});

router.get('/api/images', async (req, res, next) => {
  const { category } = req.query;
  if (!valid.has(category)) return res.status(400).json({ error: 'Unknown category' });
  try {
    const { rows } = await pool.query(
      `SELECT id, description, created_at FROM work_images
       WHERE category = $1 ORDER BY sort_order, id`, [category]);
    res.json(rows.map(r => ({ ...r, thumb: `/media/${r.id}/thumb`, full: `/media/${r.id}` })));
  } catch (e) { next(e); }
});

router.post('/api/images', upload.array('images', 20), async (req, res, next) => {
  try {
    const category = req.body.category;
    if (!valid.has(category)) return res.status(400).json({ error: 'Unknown category' });
    if (!req.files?.length) return res.status(400).json({ error: 'No images received' });

    const descs = [].concat(req.body.descriptions ?? []);
    const { rows } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM work_images WHERE category = $1', [category]);
    let order = Number(rows[0].m);

    const created = [], errors = [];
    for (const [i, file] of req.files.entries()) {
      try {
        const img = await processImage(file.buffer);
        const description = String(descs[i] ?? '').trim().slice(0, 300);
        const r = await pool.query(
          `INSERT INTO work_images (category, description, mime, data, thumb, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [category, description, img.mime, img.data, img.thumb, ++order]);
        created.push(r.rows[0].id);
      } catch (e) {
        errors.push({ file: file.originalname, error: e.message });
      }
    }
    res.status(created.length ? 201 : 422).json({ created, errors });
  } catch (e) { next(e); }
});

router.patch('/api/images/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.sendStatus(404);
  try {
    const description = String(req.body?.description ?? '').trim().slice(0, 300);
    const r = await pool.query('UPDATE work_images SET description = $1 WHERE id = $2', [description, id]);
    if (!r.rowCount) return res.sendStatus(404);
    res.json({ ok: true, description });
  } catch (e) { next(e); }
});

router.delete('/api/images/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.sendStatus(404);
  try {
    const r = await pool.query('DELETE FROM work_images WHERE id = $1', [id]);
    if (!r.rowCount) return res.sendStatus(404);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/api/order', async (req, res, next) => {
  const { category, ids } = req.body || {};
  if (!valid.has(category) || !Array.isArray(ids) || !ids.every(Number.isInteger)) {
    return res.status(400).json({ error: 'Bad request' });
  }
  try {
    await pool.query(
      `UPDATE work_images w SET sort_order = v.ord
       FROM unnest($1::int[]) WITH ORDINALITY AS v(id, ord)
       WHERE w.id = v.id AND w.category = $2`, [ids, category]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.use('/api', (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be under 15 MB.'
              : err.code === 'LIMIT_FILE_COUNT' ? 'Upload at most 20 images at a time.' : err.message;
    return res.status(400).json({ error: msg });
  }
  console.error('[admin]', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

module.exports = router;
