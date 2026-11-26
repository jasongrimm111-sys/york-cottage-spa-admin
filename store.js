/* Storage and sign-in for the York Cottage admin portal.
   Live mode: data is kept in a PRIVATE GitHub repository (york-cottage-spa-data). The GitHub key that reaches it is
   stored only encrypted (vault.json, AES-GCM with a key made from each admin's email + password, PBKDF2 310,000 rounds).
   The website reads a cut-down public copy (no names, emails or payments) from york-cottage-spa-live.
   Demo mode: sample data kept in this browser only. */
(function (root) {
  const CONF = root.YC_ADMIN_CONF = Object.assign({
    owner: 'jasongrimm111-sys', adminRepo: 'york-cottage-spa-admin', dataRepo: 'york-cottage-spa-data', liveRepo: 'york-cottage-spa-live', branch: 'main'
  }, root.YC_ADMIN_CONF || {});
  const E = root.YCEngine;
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = u8 => { let s = ''; u8.forEach(c => s += String.fromCharCode(c)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const utf8b64 = str => b64(te.encode(str));
  const sha = async s => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)))).replace(/=+$/, '');
  const norm = e => String(e || '').trim().toLowerCase();
  const ITER = 310000;

  // ---------- encryption ----------
  async function keyFrom(email, pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(norm(email) + '\n' + pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function lock(email, pass, secret) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(email, pass, salt, ITER), te.encode(JSON.stringify(secret))));
    return { kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  async function unlock(email, pass, box) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, await keyFrom(email, pass, unb64(box.salt), box.iter), unb64(box.ct));
    return JSON.parse(td.decode(pt));
  }
  // "keep me signed in": the token is re-encrypted with a random key that can't leave this browser (IndexedDB)
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('yc-admin', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const idbDo = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('k', mode), st = tx.objectStore('k'), q = fn(st); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); }); };
  async function remember(sess) {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(sess))));
    await idbDo('readwrite', st => st.put(key, 'key'));
    localStorage.setItem('yc-admin-keep', JSON.stringify({ iv: b64(iv), ct: b64(ct), until: Date.now() + 30 * 864e5 }));
  }
  async function recall() {
    try {
      const o = JSON.parse(localStorage.getItem('yc-admin-keep') || 'null'); if (!o || o.until < Date.now()) return null;
      const key = await idbDo('readonly', st => st.get('key')); if (!key) return null;
      return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, key, unb64(o.ct))));
    } catch (e) { return null; }
  }
  async function forget() { try { localStorage.removeItem('yc-admin-keep'); await idbDo('readwrite', st => st.delete('key')); } catch (e) {} }

  // ---------- GitHub ----------
  function GH(token) {
    const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    const url = (repo, path) => `https://api.github.com/repos/${CONF.owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    const api = async (u, o = {}) => { const r = await fetch(u, { ...o, headers: { ...H, ...(o.headers || {}) }, cache: 'no-store' }); if (r.status === 404) return null; if (!r.ok) { const e = new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`); e.status = r.status; throw e; } return r.status === 204 ? {} : r.json(); };
    return {
      repo: repo => api(`https://api.github.com/repos/${CONF.owner}/${repo}`),
      get: async (repo, path) => {
        const r = await api(url(repo, path) + `?ref=${CONF.branch}&t=${Date.now()}`); if (!r) return null;
        let text = r.content ? td.decode(unb64(r.content.replace(/\n/g, ''))) : null;
        if (text == null) { const raw = await fetch(url(repo, path) + `?ref=${CONF.branch}`, { headers: { ...H, Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' }); text = await raw.text(); }
        return { sha: r.sha, data: JSON.parse(text) };
      },
      put: (repo, path, data, sha, message) => api(url(repo, path), { method: 'PUT', body: JSON.stringify({ message: message || 'Update ' + path, content: utf8b64(JSON.stringify(data, null, 1)), sha: sha || undefined, branch: CONF.branch }) }),
      del: (repo, path, sha, message) => api(url(repo, path), { method: 'DELETE', body: JSON.stringify({ message: message || 'Remove ' + path, sha, branch: CONF.branch }) }),
      list: async (repo, dir) => (await api(url(repo, dir) + `?ref=${CONF.branch}&t=${Date.now()}`)) || []
    };
  }

  // ---------- the data ----------
  // DB = { cfg, bookings[], customers{}, vouchers[], waitlist[], audit[], outbox[] }
  const S = { mode: null, user: null, gh: null, DB: null, sha: {}, dirty: new Set(), listeners: [], status: 'idle', lastSaved: null, lastError: '' };
  const month = b => (b.date || '0000-00').slice(0, 7);
  const set = (k, v) => { S[k] = v; S.listeners.forEach(f => f(k)); };

  const DEMO_KEY = 'yc-admin-demo-v1';
  async function loadDemo(fresh) {
    let db = null;
    if (!fresh) try { db = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) {}
    if (!db) { db = root.YCSeed.make(); db.audit = [{ at: new Date().toISOString(), by: 'System', what: 'Demo created with sample data' }]; db.outbox = []; }
    // settings added after a demo was saved
    db.cfg = deepFill(db.cfg, root.YC_DEFAULTS);
    return db;
  }
  // add any settings missing from saved data (new features) without touching saved values
  function deepFill(o, d) {
    if (o == null) return JSON.parse(JSON.stringify(d));
    if (Array.isArray(d) || typeof d !== 'object' || d === null) return o;
    for (const k of Object.keys(d)) if (!(k in o)) o[k] = JSON.parse(JSON.stringify(d[k])); else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && k !== 'shifts' && k !== 'hoursOverride') o[k] = deepFill(o[k], d[k]);
    return o;
  }

  async function loadLive() {
    const gh = S.gh, R = CONF.dataRepo;
    const get = async p => { const r = await gh.get(R, p); if (r) S.sha[p] = r.sha; return r ? r.data : null; };
    let cfg = await get('config.json');
    const firstRun = !cfg;
    cfg = deepFill(cfg || JSON.parse(JSON.stringify(root.YC_DEFAULTS)), root.YC_DEFAULTS);
    const files = (await gh.list(R, 'bookings')).filter(f => /\.json$/.test(f.name));
    const months = await Promise.all(files.map(f => get('bookings/' + f.name)));
    const bookings = months.flatMap(m => m || []);
    const [customers, vouchers, waitlist, audit, outbox] = await Promise.all(['customers.json', 'vouchers.json', 'waitlist.json', 'audit.json', 'outbox.json'].map(get));
    const db = { cfg, bookings, customers: customers || {}, vouchers: vouchers || [], waitlist: waitlist || [], audit: audit || [], outbox: outbox || [] };
    if (firstRun) { S.dirty.add('config.json'); }
    return db;
  }

  function fileFor(part) { return part; }
  // mark what changed: 'cfg', 'booking' (with the booking), 'customers', 'vouchers', 'waitlist', 'outbox'
  function touch(part, b) {
    if (part === 'cfg') S.dirty.add('config.json');
    else if (part === 'booking') { S.dirty.add('bookings/' + month(b) + '.json'); if (b._oldMonth && b._oldMonth !== month(b)) S.dirty.add('bookings/' + b._oldMonth + '.json'); delete b._oldMonth; }
    else S.dirty.add(part + '.json');
    S.dirty.add('audit.json');
    scheduleSave();
  }
  let saveT = null, saving = null;
  function scheduleSave() { clearTimeout(saveT); set('status', 'unsaved'); saveT = setTimeout(saveNow, 900); }
  async function saveNow() {
    clearTimeout(saveT);
    if (saving) { await saving; if (!S.dirty.size) return; }
    saving = (async () => {
      const files = [...S.dirty]; S.dirty.clear(); set('status', 'saving');
      try {
        if (S.mode === 'demo') { localStorage.setItem(DEMO_KEY, JSON.stringify(S.DB)); }
        else {
          for (const f of files) await writeFile(f);
          publishSoon();
        }
        S.lastSaved = new Date(); S.lastError = ''; set('status', 'saved');
      } catch (e) { files.forEach(f => S.dirty.add(f)); S.lastError = e.message; set('status', 'error'); console.error(e); }
      saving = null;
    })();
    return saving;
  }
  function contentOf(f) {
    const DB = S.DB;
    if (f === 'config.json') return DB.cfg;
    if (f.startsWith('bookings/')) { const m = f.slice(9, 16); return DB.bookings.filter(b => month(b) === m); }
    if (f === 'audit.json') return DB.audit.slice(-3000);
    return DB[f.replace('.json', '')];
  }
  async function writeFile(f, tries = 0) {
    const data = contentOf(f), by = S.user ? S.user.name : 'Admin';
    try {
      const r = await S.gh.put(CONF.dataRepo, f, data, S.sha[f], `${by}: update ${f}`);
      S.sha[f] = r.content.sha;
    } catch (e) {
      if ((e.status === 409 || e.status === 422) && tries < 3) {
        // someone else saved first: take their copy, re-apply ours on top (bookings merge by id), then save again
        const cur = await S.gh.get(CONF.dataRepo, f); S.sha[f] = cur && cur.sha;
        if (cur && f.startsWith('bookings/')) {
          const mine = new Map(data.map(b => [b.id, b]));
          for (const b of cur.data) if (!mine.has(b.id) && !S.DB.bookings.some(x => x.id === b.id)) S.DB.bookings.push(b);
        }
        return writeFile(f, tries + 1);
      }
      throw e;
    }
  }

  // ---------- the public copy for the website ----------
  let pubT = null;
  function publishSoon() { clearTimeout(pubT); pubT = setTimeout(() => publish().catch(e => { S.lastError = 'Website update: ' + e.message; set('status', 'error'); }), 4000); }
  async function publicConfig() {
    const c = JSON.parse(JSON.stringify(S.DB.cfg));
    c.staff = c.staff.map(s => ({ id: s.id, active: s.active, treatments: s.treatments, duties: s.duties, pattern: s.pattern, shifts: s.shifts, maxHands: s.maxHands, breakRules: s.breakRules, off: (s.off || []).map(o => ({ from: o.from, to: o.to, start: o.start, end: o.end })) }));
    c.promos = await Promise.all((c.promos || []).filter(p => p.active !== false).map(async p => { const o = { ...p, hash: await sha('yc:' + String(p.code).trim().toUpperCase()) }; delete o.code; delete o.used; if (p.banner && p.banner.on) o.show = p.code; return o; }));
    delete c.emails;
    c.business = { ...c.business, vatNumber: undefined };
    return c;
  }
  async function publish() {
    if (S.mode !== 'live') return;
    const R = CONF.liveRepo, gh = S.gh;
    const busy = E.busy(S.DB.cfg, S.DB.bookings);
    for (const [path, data] of [['config.json', await publicConfig()], ['busy.json', busy]]) {
      const cur = await gh.get(R, path).catch(() => null);
      if (cur && JSON.stringify({ ...cur.data, at: 0 }) === JSON.stringify({ ...data, at: 0 })) continue;
      await gh.put(R, path, data, cur && cur.sha, 'Website availability update');
    }
    S.lastPublished = new Date(); set('published', S.lastPublished);
  }

  // ---------- sign-in ----------
  async function getVault() { try { const r = await fetch('vault.json?' + Date.now(), { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (e) { return null; } }
  async function saveVault(v) {
    const gh = S.gh, cur = await gh.get(CONF.adminRepo, 'vault.json');
    await gh.put(CONF.adminRepo, 'vault.json', v, cur && cur.sha, 'Update sign-in vault (encrypted)');
  }
  async function signIn(email, pass, keep) {
    const v = await getVault(); if (!v) throw new Error('This portal hasn’t been set up yet');
    const id = await sha('u:' + norm(email)), u = (v.users || []).find(x => x.id === id);
    if (!u) throw new Error('That email or password isn’t right');
    let sec; try { sec = await unlock(email, pass, u.box); } catch (e) { throw new Error('That email or password isn’t right'); }
    const sess = { token: sec.token, user: { id, email: norm(email), name: u.name, role: u.role, staffId: u.staffId || null } };
    if (keep) await remember(sess); else sessionStorage.setItem('yc-admin-sess', JSON.stringify(sess));
    return start('live', sess);
  }
  async function resume() {
    let sess = null; try { sess = JSON.parse(sessionStorage.getItem('yc-admin-sess') || 'null'); } catch (e) {}
    sess = sess || await recall();
    if (sess && sess.demo) return start('demo', sess);
    if (sess && sess.token) { try { return await start('live', sess); } catch (e) { await forget(); sessionStorage.removeItem('yc-admin-sess'); } }
    return null;
  }
  async function startDemo(fresh) {
    const sess = { demo: true, user: { id: 'demo', email: 'demo', name: 'Demo manager', role: 'owner' } };
    sessionStorage.setItem('yc-admin-sess', JSON.stringify(sess));
    return start('demo', sess, fresh);
  }
  async function start(mode, sess, fresh) {
    S.mode = mode; S.user = sess.user;
    if (mode === 'live') { S.gh = GH(sess.token); S.DB = await loadLive(); }
    else S.DB = await loadDemo(fresh);
    S.DB.cfg.staff = S.DB.cfg.staff || [];
    if (S.dirty.size) scheduleSave();
    return S;
  }
  async function signOut() { await forget(); sessionStorage.removeItem('yc-admin-sess'); location.hash = ''; location.reload(); }
  // first set-up: checks the key reaches the repositories, then writes the encrypted vault
  async function setup({ name, email, pass, token }) {
    const gh = GH(token);
    for (const r of [CONF.adminRepo, CONF.dataRepo, CONF.liveRepo]) {
      const info = await gh.repo(r).catch(e => { throw new Error('GitHub refused the key: ' + e.message); });
      if (!info) throw new Error(`The key can’t see the ${r} repository. Give it access to ${CONF.adminRepo}, ${CONF.dataRepo} and ${CONF.liveRepo}.`);
      if (info.permissions && !info.permissions.push) throw new Error(`The key can read ${r} but not save to it. Set Contents to “Read and write”.`);
    }
    S.gh = gh;
    const id = await sha('u:' + norm(email));
    await saveVault({ v: 1, users: [{ id, name, role: 'owner', added: new Date().toISOString(), box: await lock(email, pass, { token }) }] });
    sessionStorage.setItem('yc-admin-sess', JSON.stringify({ token, user: { id, email: norm(email), name, role: 'owner' } }));
    return start('live', { token, user: { id, email: norm(email), name, role: 'owner' } });
  }
  // admin users (owner only): each user's own email + password unlocks the same key
  async function users() { const v = S.mode === 'live' ? await getVault() : JSON.parse(localStorage.getItem('yc-admin-demo-users') || 'null') || { users: [{ id: 'demo', name: 'Demo manager', role: 'owner', added: new Date().toISOString() }] }; return v; }
  async function addUser({ name, email, pass, role, staffId }) {
    if (S.mode === 'demo') { const v = await users(); v.users.push({ id: 'd' + Date.now(), name, email: norm(email), role, staffId: staffId || null, added: new Date().toISOString() }); localStorage.setItem('yc-admin-demo-users', JSON.stringify(v)); return; }
    const v = await getVault(), token = S.gh && JSON.parse(sessionStorage.getItem('yc-admin-sess') || 'null')?.token || (await recall())?.token;
    if (!token) throw new Error('Sign out and in again first');
    const id = await sha('u:' + norm(email)); v.users = v.users.filter(u => u.id !== id);
    v.users.push({ id, name, role, staffId: staffId || null, added: new Date().toISOString(), box: await lock(email, pass, { token }) });
    await saveVault(v);
  }
  async function removeUser(id) {
    if (S.mode === 'demo') { const v = await users(); v.users = v.users.filter(u => u.id !== id); localStorage.setItem('yc-admin-demo-users', JSON.stringify(v)); return; }
    const v = await getVault(); v.users = v.users.filter(u => u.id !== id); await saveVault(v);
  }
  async function changePassword(cur, next) {
    if (S.mode === 'demo') return;
    const v = await getVault(), u = v.users.find(x => x.id === S.user.id);
    const sec = await unlock(S.user.email, cur, u.box).catch(() => { throw new Error('Your current password isn’t right'); });
    u.box = await lock(S.user.email, next, sec); await saveVault(v);
  }

  // ---------- outbox: emails, payment links and refunds are carried out by the data repo's GitHub Action ----------
  function queue(job) {
    const o = { id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), by: S.user.name, status: S.mode === 'demo' ? 'demo' : 'queued', ...job };
    S.DB.outbox.push(o); S.DB.outbox = S.DB.outbox.slice(-1500); touch('outbox'); return o;
  }
  function audit(what, ref) { S.DB.audit.push({ at: new Date().toISOString(), by: S.user ? S.user.name : 'Admin', what, ref: ref || '' }); }

  root.YCStore = { S, CONF, signIn, resume, startDemo, setup, signOut, users, addUser, removeUser, changePassword, touch, saveNow, publish, queue, audit, getVault, month, sha, loadDemo, DEMO_KEY,
    onChange: f => S.listeners.push(f) };
})(this);
