const sharp = require('sharp');

const ALLOWED = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif']);

// Throws a friendly error unless the buffer is a real, supported image.
async function validate(buffer) {
  let meta;
  try { meta = await sharp(buffer).metadata(); }
  catch { throw new Error('Not a valid image file'); }
  if (!ALLOWED.has(meta.format)) throw new Error(`Unsupported format: ${meta.format}`);
}

const base = buffer => sharp(buffer, { animated: false }).rotate(); // honour EXIF orientation

// Gallery photos: an optimised full size copy and a small thumbnail (both WebP)
// so galleries load fast.
async function processImage(buffer) {
  await validate(buffer);
  const [data, thumb] = await Promise.all([
    base(buffer).resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 82 }).toBuffer(),
    base(buffer).resize({ width: 640, height: 480, fit: 'cover' })
                .webp({ quality: 74 }).toBuffer()
  ]);
  return { data, thumb, mime: 'image/webp' };
}

// Homepage banner: shown full-screen, so keep more resolution. No thumbnail needed.
async function processHero(buffer) {
  await validate(buffer);
  const data = await base(buffer)
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 }).toBuffer();
  return { data, mime: 'image/webp' };
}

module.exports = { processImage, processHero };