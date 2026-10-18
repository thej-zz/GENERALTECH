const crypto = require('crypto');

const COOKIE = 'gt_admin';
const TTL_MS = 12 * 60 * 60 * 1000;
const { ADMIN_USER = 'admin', ADMIN_PASSWORD, SESSION_SECRET } = process.env;

// Secure by default: without real credentials the admin area stays locked.
const configured = Boolean(ADMIN_PASSWORD && SESSION_SECRET && SESSION_SECRET.length >= 16);
if (!configured) {
  console.warn('[admin] ADMIN_PASSWORD / SESSION_SECRET (16+ chars) not set - admin login is DISABLED.');
}

const sign = v => crypto.createHmac('sha256', SESSION_SECRET || 'x').update(v).digest('base64url');
const digest = v => crypto.createHash('sha256').update(String(v)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

function checkCredentials(user, pass) {
  // Evaluate both so timing doesn't reveal which one was wrong.
  const u = safeEqual(user || '', ADMIN_USER);
  const p = safeEqual(pass || '', ADMIN_PASSWORD || '');
  return configured && u && p;
}

function issue(req, res) {
  const exp = String(Date.now() + TTL_MS);
  res.cookie(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/admin', maxAge: TTL_MS
  });
}
const clear = res => res.clearCookie(COOKIE, { path: '/admin' });

function isAuthed(req) {
  if (!configured) return false;
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const token = decodeURIComponent(raw.slice(COOKIE.length + 1));
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

// Login throttling: 6 failed attempts per IP per 15 minutes.
const fails = new Map();
const WINDOW = 15 * 60 * 1000, MAX_FAILS = 6;
function throttled(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW) { fails.delete(ip); return false; }
  return f.n >= MAX_FAILS;
}
function recordFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > WINDOW) fails.set(ip, { n: 1, first: Date.now() });
  else f.n++;
}
const recordSuccess = ip => fails.delete(ip);

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Not signed in' });
}

// Cookies are SameSite=Strict; this header additionally blocks cross-site form posts.
function requireXhr(req, res, next) {
  if (req.method === 'GET' || req.get('x-requested-with') === 'fetch') return next();
  res.status(403).json({ error: 'Forbidden' });
}

module.exports = { configured, checkCredentials, issue, clear, isAuthed, throttled, recordFail, recordSuccess, requireAuth, requireXhr };