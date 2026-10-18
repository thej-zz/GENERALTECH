// One-time import of the existing images in /assets into PostgreSQL.
//   npm run seed            -> imports categories that are still empty
//   npm run seed -- --force -> wipes and re-imports every category
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, init } = require('../db');
const { processImage } = require('../image');
const manifest = require('./manifest.json');

(async () => {
  const force = process.argv.includes('--force');
  await init();
  const root = path.join(__dirname, '..');
  const cats = [...new Set(manifest.map(m => m.category))];

  for (const cat of cats) {
    const { rows } = await pool.query('SELECT COUNT(*)::int n FROM work_images WHERE category=$1', [cat]);
    if (rows[0].n && !force) { console.log(`- ${cat}: already has ${rows[0].n} images, skipped`); continue; }
    if (force) await pool.query('DELETE FROM work_images WHERE category=$1', [cat]);

    let order = 0, ok = 0;
    for (const item of manifest.filter(m => m.category === cat)) {
      const file = path.join(root, item.file);
      if (!fs.existsSync(file)) { console.warn(`  ! missing ${item.file}`); continue; }
      const img = await processImage(fs.readFileSync(file));
      await pool.query(
        `INSERT INTO work_images (category, description, mime, data, thumb, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [cat, item.description, img.mime, img.data, img.thumb, ++order]);
      ok++; process.stdout.write('.');
    }
    console.log(`\n- ${cat}: imported ${ok}`);
  }
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
