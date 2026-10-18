require('dotenv').config();
const express = require('express');
const path = require('path');
const { init } = require('./db');
const app = express();
const PORT = process.env.PORT || 10000;
app.set('trust proxy', 1);
app.disable('x-powered-by');
['home.html', 'home.css', 'home.js', 'gallery.css', 'gallery.js'].forEach(f =>
  app.get('/' + f, (req, res) => res.sendFile(path.join(__dirname, f))));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '7d' }));
app.use('/works', express.static(path.join(__dirname, 'works')));
app.get('/ping', (req, res) => res.send('Server is alive ✅'));
app.use(require('./routes/public'));
app.use('/admin', require('./admin/routes'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

(async function connect() {
  try { await init(); console.log('[db] ready'); }
  catch (err) { console.error('[db] init failed, retrying in 10s:', err.message); setTimeout(connect, 10000); }
})();