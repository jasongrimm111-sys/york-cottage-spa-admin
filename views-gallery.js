/* Picture library and website gallery (user 2026-11-27).
   cfg.gallery = [{ id, src, full, alt, tags: [], hidden }] - the website's gallery page shows the ones not hidden, in this order.
   Every picture (including ones only used in emails) lives here, with tags, so the email photo picker can find them.
   Uploads are resized in the browser and saved to the public website data (york-cottage-spa-live, img/m/). */
(function () {
  const A = window.YCA, St = window.YCStore;
  const { $, $$, esc, uid } = A;
  const lib = () => { const c = A.cfg(); return c.gallery = c.gallery || []; };
  A.picLibrary = lib;
  A.picTags = () => [...new Set(lib().flatMap(p => p.tags || []))].sort();

  // resize a picture file to at most `max` pixels on its long side, as a JPEG
  const resize = (file, max, q = .84) => new Promise((ok, no) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(u); ok(cv.toDataURL('image/jpeg', q)); };
    img.onerror = () => { URL.revokeObjectURL(u); no(new Error('That file isn’t a picture we can read (use JPG, PNG or WebP)')); };
    img.src = u; });
  // upload one picture; returns a library entry (not yet added)
  A.uploadPic = async (file, extra = {}) => {
    if (!/^image\//.test(file.type)) throw new Error(file.name + ' isn’t a picture');
    const id = uid('p'), big = await resize(file, 2000), small = await resize(file, 900, .8);
    const name = (file.name || 'picture').replace(/\.[^.]+$/, '');
    if (St.S.mode !== 'live') return { id, src: small, full: big, alt: '', tags: [], hidden: false, name, ...extra };   // demo: kept in this browser only
    const base = `https://raw.githubusercontent.com/${St.CONF.owner}/${St.CONF.liveRepo}/${St.CONF.branch}/`;
    await St.S.gh.putFile(St.CONF.liveRepo, `img/m/${id}.jpg`, big.split(',')[1], 'Picture: ' + name);
    await St.S.gh.putFile(St.CONF.liveRepo, `img/m/${id}-s.jpg`, small.split(',')[1], 'Picture (small): ' + name);
    return { id, src: base + `img/m/${id}-s.jpg`, full: base + `img/m/${id}.jpg`, alt: '', tags: [], hidden: false, name, ...extra };
  };
  // pick files and upload them; returns the new entries (added to the library)
  A.pickAndUpload = (extra = {}, multiple = true) => new Promise(done => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = multiple;
    inp.onchange = async () => {
      const files = [...inp.files]; if (!files.length) return done([]);
      const out = []; let i = 0;
      for (const f of files) { A.toast(`Uploading ${++i} of ${files.length}…`); try { out.push(await A.uploadPic(f, extra)); } catch (e) { A.toast(e.message); } }
      if (out.length) { lib().push(...out); A.change('cfg', null, `${out.length} picture${out.length === 1 ? '' : 's'} uploaded`); A.toast(`${out.length} picture${out.length === 1 ? '' : 's'} added`); }
      done(out); };
    inp.click(); });

  let tagF = '';
  A.views.gallery = () => {
    const all = lib(), tags = A.picTags(), shown = all.filter(p => !tagF || (p.tags || []).includes(tagF));
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Gallery &amp; pictures</h1><p>Every picture for the website gallery and for emails. Drag to change the order the website shows them in. <b>${all.filter(p => !p.hidden).length}</b> on the website.</p></div>
        <div class="acts"><a class="btn ghost" href="${A.siteURL()}gallery.html" target="_blank" rel="noopener">See the gallery page</a><button class="btn pri" id="gUp">${A.ic.plus} Upload pictures</button></div></div>
      ${tags.length ? `<div class="chips" style="margin-bottom:12px"><button class="chip ${tagF ? '' : 'on'}" data-tf="">All (${all.length})</button>${tags.map(t => `<button class="chip ${tagF === t ? 'on' : ''}" data-tf="${esc(t)}">${esc(t)} (${all.filter(p => (p.tags || []).includes(t)).length})</button>`).join('')}</div>` : ''}
      <div class="gal-adm" id="gGrid">${shown.map(p => `<div class="ga ${p.hidden ? 'off' : ''}" draggable="${tagF ? 'false' : 'true'}" data-g="${p.id}">
          <div class="ga-img"><img src="${esc(p.src)}" alt="" loading="lazy">${p.hidden ? '<span class="badge">Not on the website</span>' : ''}</div>
          <div class="ga-b"><div class="small muted">${esc(p.alt || 'No description')}</div>
            <div class="ga-tags">${(p.tags || []).map(t => `<span class="badge">${esc(t)}</span>`).join('') || '<span class="small muted">No tags</span>'}</div>
            <div class="ga-acts"><button class="btn sm" data-ge="${p.id}">Edit</button>${tagF ? '' : `<button class="icon-btn" data-gm="${p.id}" data-d="-1" aria-label="Earlier">↑</button><button class="icon-btn" data-gm="${p.id}" data-d="1" aria-label="Later">↓</button>`}</div></div></div>`).join('') || '<div class="empty"><b>No pictures</b>Upload some with Upload pictures.</div>'}</div>
      <p class="small muted" style="margin-top:12px">Pictures are resized automatically. Tags (for example <i>pool</i>, <i>treatments</i>, <i>christmas</i>) help you find pictures when you’re writing an email. Switch off “Show on the website” to keep a picture for emails only.</p>`,
      wire: el => {
        $('#gUp', el).onclick = async () => { const n = await A.pickAndUpload(tagF ? { tags: [tagF] } : {}); if (n.length) A.refresh(); };
        $$('[data-tf]', el).forEach(b => b.onclick = () => { tagF = b.dataset.tf; A.refresh(); });
        $$('[data-gm]', el).forEach(b => b.onclick = () => { const a = lib(), i = a.findIndex(p => p.id === b.dataset.gm), j = i + +b.dataset.d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; A.change('cfg', null, 'Gallery order changed'); A.refresh(); });
        $$('[data-ge]', el).forEach(b => b.onclick = () => edit(b.dataset.ge));
        // drag to reorder
        let drag = null;
        $$('.ga[draggable=true]', el).forEach(c => {
          c.ondragstart = e => { drag = c.dataset.g; c.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; };
          c.ondragend = () => { c.classList.remove('drag'); $$('.ga', el).forEach(x => x.classList.remove('over')); };
          c.ondragover = e => { e.preventDefault(); c.classList.add('over'); };
          c.ondragleave = () => c.classList.remove('over');
          c.ondrop = e => { e.preventDefault(); const a = lib(), from = a.findIndex(p => p.id === drag), to = a.findIndex(p => p.id === c.dataset.g); if (from < 0 || to < 0 || from === to) return;
            const [m] = a.splice(from, 1); a.splice(to, 0, m); A.change('cfg', null, 'Gallery order changed'); A.refresh(); };
        });
      } };
  };
  async function edit(id) {
    const p = lib().find(x => x.id === id); if (!p) return;
    const r = await A.modal({ title: 'Edit picture', size: 'wide', foot: '<button class="btn ghost danger" data-del style="margin-right:auto">Delete</button>',
      body: `<div class="grid g2" style="align-items:start"><img src="${esc(p.src)}" alt="" style="width:100%;border-radius:12px">
        <div>${A.f.text('alt', 'Description (read out by screen readers; helps Google too)', p.alt, { ph: 'e.g. The indoor pool with garden views' })}<div style="height:10px"></div>
          ${A.f.text('tags', 'Tags, separated by commas', (p.tags || []).join(', '), { ph: 'e.g. pool, winter, offers' })}
          ${A.picTags().length ? `<div class="small muted" style="margin-top:6px">Used so far: ${A.picTags().map(t => `<button type="button" class="chip sm" data-addtag="${esc(t)}">${esc(t)}</button>`).join(' ')}</div>` : ''}<div style="height:12px"></div>
          ${A.f.sw('show', 'Show on the website’s gallery page', !p.hidden)}</div></div>`,
      onOpen: (m, close) => {
        $$('[data-addtag]', m).forEach(b => b.onclick = () => { const i = $('[data-k=tags]', m), cur = i.value.split(',').map(x => x.trim()).filter(Boolean); if (!cur.includes(b.dataset.addtag)) cur.push(b.dataset.addtag); i.value = cur.join(', '); });
        $('[data-del]', m).onclick = async () => { if (!(await A.confirm('Delete this picture?', 'It comes off the website gallery and out of the picture library. Emails already sent keep showing it.', 'Delete'))) return; close('del'); };
      },
      onOk: m => A.read(m) });
    if (r === 'del') { A.cfg().gallery = lib().filter(x => x !== p); A.change('cfg', null, 'Picture deleted from the gallery'); A.refresh(); return; }
    if (!r || typeof r !== 'object') return;
    p.alt = (r.alt || '').trim(); p.tags = [...new Set(String(r.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean))]; p.hidden = !r.show;
    A.change('cfg', null, 'Picture details changed'); A.refresh();
  }
})();
