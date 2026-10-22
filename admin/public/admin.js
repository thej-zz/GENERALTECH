(() => {
  const MAX_FILES = 20, MAX_BYTES = 15 * 1024 * 1024;
  const $ = s => document.querySelector(s);
  const view = $('#view');
  let overview = [];
  let hero = { custom: false, url: '/site/hero' };

  /* ---------- helpers ---------- */
  const ICONS = {
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m10 6 6 6-6 6"/>',
    swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>'
  };
  const icon = n => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.6');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = ICONS[n]; return s;
  };
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }
  const bytes = n => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
  const photos = n => `${n} ${n === 1 ? 'photo' : 'photos'}`;
  const label = key => overview.find(c => c.key === key)?.label || key;

  async function api(path, opts = {}) {
    const headers = { 'X-Requested-With': 'fetch', ...opts.headers };
    if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch('/admin/api' + path, { ...opts, headers });
    if (res.status === 401) { location.reload(); throw new Error('Signed out'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  function toast(msg, type = '') {
    const t = h('div', { class: 'toast ' + type }, msg);
    $('#toasts').append(t);
    setTimeout(() => t.remove(), type === 'error' ? 6000 : 3200);
  }

  function confirmDialog({ title, body, img, action }) {
    return new Promise(resolve => {
      const done = v => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = e => e.key === 'Escape' && done(false);
      const cancel = h('button', { class: 'btn ghost', type: 'button', onclick: () => done(false) }, 'Cancel');
      const ov = h('div', { class: 'overlay', onclick: e => e.target === ov && done(false) },
        h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
          img && h('img', { src: img, alt: '' }),
          h('h3', {}, title), h('p', {}, body),
          h('div', { class: 'row' }, cancel,
            h('button', { class: 'btn danger', type: 'button', onclick: () => done(true) }, action))));
      document.body.append(ov); document.addEventListener('keydown', onKey); cancel.focus();
    });
  }

  function openLightbox(src, caption) {
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => e.key === 'Escape' && close();
    const ov = h('div', { class: 'overlay lb', onclick: close },
      h('figure', {}, h('img', { src, alt: caption || '' }), h('figcaption', {}, caption || '')));
    document.body.append(ov); document.addEventListener('keydown', onKey);
  }

  /* ---------- sidebar ---------- */
  function renderNav() {
    const route = currentRoute();
    const link = (hash, text, count) => h('a', { class: 'nav-link', href: hash, 'aria-current': route === hash.slice(2) ? 'page' : null },
      h('span', {}, text), count != null && h('span', { class: 'pill' }, count));
    $('#nav').replaceChildren(
      link('#/', 'Overview'),
      h('div', { class: 'nav-label' }, 'Website sections'),
      link('#/homepage', 'Homepage banner'),
      ...overview.map(c => link('#/' + c.key, c.label, c.count)));
  }

  async function loadOverview() {
    [overview, hero] = await Promise.all([api('/overview'), api('/site/hero')]);
    renderNav();
  }
  const currentRoute = () => location.hash.replace(/^#\/?/, '');

  /* ---------- overview page ---------- */
  function renderOverview() {
    const totalCount = overview.reduce((a, c) => a + c.count, 0);
    const totalBytes = overview.reduce((a, c) => a + c.bytes, 0);
    view.replaceChildren(
      h('div', { class: 'page-head' }, h('div', {},
        h('h1', {}, 'Your work, live online'),
        h('p', {}, 'Photos, captions and the homepage banner you change here appear on the website straight away. Pick a section to manage it.'))),
      h('div', { class: 'tiles' },
        h('a', { class: 'tile', href: '#/homepage' },
          h('div', { class: 'mosaic single' }, h('img', { src: hero.url, alt: '', loading: 'lazy' })),
          h('div', { class: 'tile-body' }, h('h2', {}, 'Homepage banner'),
            h('span', {}, hero.custom ? 'Your own photo' : 'Original photo'))),
        ...overview.map(c => h('a', { class: 'tile', href: '#/' + c.key },
        h('div', { class: 'mosaic' }, c.previews.length
          ? c.previews.map(src => h('img', { src, alt: '', loading: 'lazy' }))
          : h('div', { class: 'none' }, 'No photos yet')),
        h('div', { class: 'tile-body' }, h('h2', {}, c.label),
          h('span', {}, `${photos(c.count)}, ${bytes(c.bytes)}`))))),
      h('p', { class: 'total' }, h('b', {}, totalCount), ` photos across ${overview.length} pages, ${bytes(totalBytes)} stored in the database.`));
  }

  /* ---------- section page ---------- */
  async function renderSection(key) {
    view.replaceChildren(h('div', { class: 'spinner' }, h('i')));
    let items;
    try { items = await api('/images?category=' + key); }
    catch (e) { view.replaceChildren(h('p', {}, e.message)); return; }

    let staged = [];
    const meta = h('p');
    const grid = h('div', { class: 'grid' });
    const hint = h('p', { class: 'hint' }, 'Drag the grip, or use the arrows, to change the order. Type in a caption, then press Enter or click away to save it. Hover a photo to replace or delete it.');
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const stage = h('section', { class: 'stage', hidden: true });
    const drop = h('div', { class: 'drop' }, icon('upload'),
      h('span', {}, 'Drop photos here, or '),
      h('button', { class: 'link-btn', type: 'button', onclick: () => input.click() }, 'browse your files'),
      h('span', { style: 'color:var(--mist)' }, 'Up to 20 at a time, 15 MB each.'));
    const empty = h('div', { class: 'empty', hidden: true },
      h('h3', {}, 'Nothing here yet'),
      h('p', {}, `Add your first photo and it will show on the ${label(key)} page.`));

    function updateMeta() {
      const n = grid.children.length;
      meta.textContent = n ? `${photos(n)} shown on the ${label(key)} page.` : `No photos on the ${label(key)} page yet.`;
      empty.hidden = n > 0; hint.hidden = n < 2;
      const c = overview.find(o => o.key === key); if (c) { c.count = n; renderNav(); }
    }

    /* grid cards */
    let saveTimer;
    const saveOrder = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => api('/order', { method: 'PUT', body: JSON.stringify({ category: key, ids: [...grid.children].map(c => +c.dataset.id) }) })
        .catch(e => toast(e.message, 'error')), 400);
    };
    let dragging = null;
    function card(it) {
      const cap = h('textarea', { class: 'cap', rows: 2, placeholder: 'Add a caption', maxlength: 300, 'aria-label': 'Caption' }, it.description);
      let saved = it.description;
      cap.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); cap.blur(); }          // Enter saves
        else if (e.key === 'Escape') { cap.value = saved; cap.blur(); }     // Esc cancels
      });
      cap.addEventListener('change', async () => {
        try { const r = await api('/images/' + it.id, { method: 'PATCH', body: JSON.stringify({ description: cap.value }) }); saved = r.description; cap.value = saved; toast('Caption saved', 'ok'); }
        catch (e) { cap.value = saved; toast(e.message, 'error'); }
      });
      const swapInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
      swapInput.addEventListener('change', async () => {
        const f = swapInput.files[0]; swapInput.value = '';
        if (!f) return;
        if (!f.type.startsWith('image/')) return toast(`${f.name} is not an image.`, 'error');
        if (f.size > MAX_BYTES) return toast(`${f.name} is over 15 MB.`, 'error');
        el.classList.add('busy');
        try {
          const fd = new FormData(); fd.append('image', f);
          const r = await api('/images/' + it.id + '/file', { method: 'PUT', body: fd });
          it.thumb = r.thumb; it.full = r.full;
          el.querySelector('.thumb img').src = r.thumb;
          toast('Photo replaced', 'ok');
        } catch (e) { toast(e.message, 'error'); }
        finally { el.classList.remove('busy'); }
      });
      const el = h('article', { class: 'card', 'data-id': it.id },
        h('button', { class: 'thumb', type: 'button', 'aria-label': 'View larger', onclick: () => openLightbox(it.full, cap.value) },
          h('img', { src: it.thumb, alt: cap.value, loading: 'lazy' })),
        h('div', { class: 'tools' },
          h('div', {},
            h('span', { class: 'icon-btn handle', title: 'Drag to reorder', onmousedown: () => { el.draggable = true; } }, icon('grip')),
            h('button', { class: 'icon-btn', type: 'button', title: 'Move earlier', 'aria-label': 'Move earlier', onclick: () => { el.previousElementSibling?.before(el); saveOrder(); } }, icon('left')),
            h('button', { class: 'icon-btn', type: 'button', title: 'Move later', 'aria-label': 'Move later', onclick: () => { el.nextElementSibling?.after(el); saveOrder(); } }, icon('right'))),
          h('div', {},
            h('button', { class: 'icon-btn', type: 'button', title: 'Replace this photo', 'aria-label': 'Replace photo', onclick: () => swapInput.click() }, icon('swap')),
            h('button', { class: 'icon-btn del', type: 'button', title: 'Delete', 'aria-label': 'Delete photo', onclick: () => remove(it, el, cap.value) }, icon('trash')))),
        cap, swapInput);
      el.addEventListener('dragstart', e => { dragging = el; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id); });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); el.draggable = false; dragging = null; saveOrder(); });
      return el;
    }
    grid.addEventListener('dragover', e => {
      if (!dragging) return;
      e.preventDefault();
      const over = e.target.closest('.card');
      if (!over || over === dragging) return;
      const kids = [...grid.children];
      kids.indexOf(dragging) < kids.indexOf(over) ? over.after(dragging) : over.before(dragging);
    });

    async function remove(it, el, caption) {
      const ok = await confirmDialog({ title: 'Delete this photo?', body: `${caption ? '“' + caption + '” will be' : 'It will be'} removed from the website. This cannot be undone.`, img: it.thumb, action: 'Delete photo' });
      if (!ok) return;
      try {
        await api('/images/' + it.id, { method: 'DELETE' });
        el.classList.add('removing');
        setTimeout(() => { el.remove(); updateMeta(); }, 280);
        toast('Photo deleted', 'ok');
      } catch (e) { toast(e.message, 'error'); }
    }

    /* staging + upload */
    function addFiles(list) {
      for (const f of list) {
        if (!f.type.startsWith('image/')) { toast(`${f.name} is not an image.`, 'error'); continue; }
        if (f.size > MAX_BYTES) { toast(`${f.name} is over 15 MB.`, 'error'); continue; }
        if (staged.length >= MAX_FILES) { toast('You can add 20 photos at a time.', 'error'); break; }
        staged.push({ file: f, url: URL.createObjectURL(f), desc: '' });
      }
      renderStage();
    }
    function clearStage() { staged.forEach(s => URL.revokeObjectURL(s.url)); staged = []; renderStage(); }

    function renderStage() {
      stage.hidden = !staged.length;
      if (!staged.length) return;
      const same = h('input', { placeholder: 'Caption for every photo', 'aria-label': 'Caption for every photo' });
      const bar = h('i'), status = h('span', { class: 'progress-text' });
      const progress = h('div', { class: 'progress', hidden: true }, bar);
      const go = h('button', { class: 'btn', type: 'button' }, icon('upload'), `Add ${photos(staged.length)}`);
      const clear = h('button', { class: 'btn ghost', type: 'button', onclick: clearStage }, 'Clear');

      go.addEventListener('click', () => {
        const fd = new FormData();
        fd.append('category', key);
        staged.forEach(s => { fd.append('images', s.file); fd.append('descriptions', s.desc); });
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/admin/api/images');
        xhr.setRequestHeader('X-Requested-With', 'fetch');
        [go, clear].forEach(b => b.disabled = true);
        progress.hidden = false; status.textContent = 'Uploading…';
        xhr.upload.onprogress = e => {
          if (!e.lengthComputable) return;
          const p = Math.round(e.loaded / e.total * 100);
          bar.style.width = p + '%'; status.textContent = p < 100 ? `Uploading ${p}%` : 'Optimising…';
        };
        xhr.onload = async () => {
          if (xhr.status === 401) return location.reload();
          let r = {}; try { r = JSON.parse(xhr.responseText); } catch {}
          const okCount = r.created?.length || 0;
          (r.errors || []).forEach(er => toast(`${er.file}: ${er.error}`, 'error'));
          if (xhr.status >= 400 && !okCount && !r.errors?.length) toast(r.error || 'Upload failed.', 'error');
          if (okCount) toast(`Added ${photos(okCount)}`, 'ok');
          if (okCount) { clearStage(); await loadOverview(); renderSection(key); }
          else { [go, clear].forEach(b => b.disabled = false); progress.hidden = true; status.textContent = ''; }
        };
        xhr.onerror = () => { toast('Network error. Check your connection and try again.', 'error'); [go, clear].forEach(b => b.disabled = false); progress.hidden = true; };
        xhr.send(fd);
      });

      stage.replaceChildren(
        h('div', { class: 'stage-head' },
          h('h3', {}, `Ready to add ${photos(staged.length)}`),
          h('div', { class: 'same' }, same,
            h('button', { class: 'btn ghost', type: 'button', onclick: () => { staged.forEach(s => s.desc = same.value); renderStage(); } }, 'Apply'))),
        h('div', { class: 'stage-grid' }, staged.map((s, i) => h('div', { class: 'stage-item' },
          h('img', { src: s.url, alt: '' }),
          h('button', { class: 'x', type: 'button', 'aria-label': 'Remove', onclick: () => { URL.revokeObjectURL(s.url); staged.splice(i, 1); renderStage(); } }, '×'),
          h('input', { value: s.desc, placeholder: 'Caption (optional)', maxlength: 300, 'aria-label': 'Caption', oninput: e => { s.desc = e.target.value; } })))),
        h('div', { class: 'stage-actions' }, go, clear, progress, status));
    }

    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
    drop.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });

    items.forEach(it => grid.append(card(it)));
    view.replaceChildren(
      h('div', { class: 'page-head' },
        h('div', {}, h('h1', {}, label(key)), meta),
        h('div', { class: 'head-actions' },
          h('a', { class: 'btn ghost', href: `/works/${key}.html`, target: '_blank', rel: 'noopener' }, icon('external'), 'View page'),
          h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, icon('upload'), 'Add photos'))),
      input, drop, stage, hint, grid, empty);
    updateMeta();
  }


  /* ---------- homepage banner page ---------- */
  function renderHomepage() {
    const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const img = h('img', { src: hero.url, alt: 'Current homepage banner' });
    const badge = h('span', { class: 'badge' });
    const restore = h('button', { class: 'btn ghost', type: 'button' }, 'Use the original photo');
    const pick = h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, icon('upload'), 'Choose a new banner photo');
    const preview = h('div', { class: 'hero-preview' }, img, badge);

    function paint() {
      img.src = hero.url;
      badge.textContent = hero.custom ? 'Your own photo' : 'Original photo';
      restore.hidden = !hero.custom;
    }
    async function send(f) {
      if (!f) return;
      if (!f.type.startsWith('image/')) return toast(`${f.name} is not an image.`, 'error');
      if (f.size > MAX_BYTES) return toast(`${f.name} is over 15 MB.`, 'error');
      preview.classList.add('busy'); pick.disabled = restore.disabled = true;
      try {
        const fd = new FormData(); fd.append('image', f);
        hero = await api('/site/hero', { method: 'PUT', body: fd });
        paint(); toast('Homepage banner updated', 'ok');
      } catch (e) { toast(e.message, 'error'); }
      finally { preview.classList.remove('busy'); pick.disabled = restore.disabled = false; }
    }
    restore.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Use the original banner?', body: 'Your uploaded banner photo will be removed and the website will show the original photo again.', action: 'Use original' });
      if (!ok) return;
      try { hero = await api('/site/hero', { method: 'DELETE' }); paint(); toast('Original banner restored', 'ok'); }
      catch (e) { toast(e.message, 'error'); }
    });
    input.addEventListener('change', () => { send(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => preview.addEventListener(ev, e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); preview.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach(ev => preview.addEventListener(ev, () => preview.classList.remove('over')));
    preview.addEventListener('drop', e => { e.preventDefault(); send(e.dataTransfer.files[0]); });

    view.replaceChildren(
      h('div', { class: 'page-head' },
        h('div', {}, h('h1', {}, 'Homepage banner'),
          h('p', {}, 'The large photo at the very top of your website’s home page.')),
        h('div', { class: 'head-actions' },
          h('a', { class: 'btn ghost', href: '/', target: '_blank', rel: 'noopener' }, icon('external'), 'View website'))),
      h('div', { class: 'hero-card' },
        preview,
        h('div', { class: 'hero-actions' }, pick, restore),
        h('p', { class: 'hint', style: 'margin:0;padding:0 20px 20px' },
          'Tip: use a wide, landscape photo at least 1600 pixels across. The website darkens it a little so the white text stays easy to read. You can also drag a photo onto the preview.')),
      input);
    paint();
  }

  /* ---------- router ---------- */
  function route() {
    $('#side').classList.remove('open'); $('#scrim').hidden = true;
    renderNav();
    const r = currentRoute();
    if (r === 'homepage') renderHomepage();
    else if (overview.some(c => c.key === r)) renderSection(r);
    else renderOverview();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', async () => {
    // Overview page needs fresh thumbnails/counts each time you return to it.
    if (!overview.some(c => c.key === currentRoute())) await loadOverview().catch(() => {});  // overview + banner pages need fresh data
    route();
  });

  $('#menu').addEventListener('click', () => { $('#side').classList.add('open'); $('#scrim').hidden = false; });
  $('#scrim').addEventListener('click', () => { $('#side').classList.remove('open'); $('#scrim').hidden = true; });
  $('#logout').addEventListener('click', async () => { await api('/logout', { method: 'POST' }).catch(() => {}); location.reload(); });

  loadOverview().then(route).catch(e => { view.replaceChildren(h('p', {}, e.message)); });
})();