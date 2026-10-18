const sharp = require('sharp');

const ALLOWED = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif']);

// Validates that the buffer is a real image, then produces an optimised full
// size copy and a small thumbnail (both WebP) so galleries load fast.
async function processImage(buffer) {
  let meta;
  try { meta = await sharp(buffer).metadata(); }
  catch { throw new Error('Not a valid image file'); }
  if (!ALLOWED.has(meta.format)) throw new Error(`Unsupported format: ${meta.format}`);

  const base = () => sharp(buffer, { animated: false }).rotate(); // honour EXIF orientation
  const [data, thumb] = await Promise.all([
    base().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 }).toBuffer(),
    base().resize({ width: 640, height: 480, fit: 'cover' })
          .webp({ quality: 74 }).toBuffer()
  ]);
  return { data, thumb, mime: 'image/webp' };
}

module.exports = { processImage };