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
    E.migrate(db.cfg); db.tasks = db.tasks || { items: [], hidden: {} };
    if (!db.tickets) db.tickets = (root.YCSeed.make().tickets || []);   // demos saved before Support existed
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
    if (E.migrate(cfg)) S.dirty.add('config.json');
    const files = (await gh.list(R, 'bookings')).filter(f => /\.json$/.test(f.name));
    const months = await Promise.all(files.map(f => get('bookings/' + f.name)));
    const bookings = months.flatMap(m => m || []);
    const [customers, vouchers, waitlist, audit, outbox, tasks, tickets, holds, campaigns] = await Promise.all(['customers.json', 'vouchers.json', 'waitlist.json', 'audit.json', 'outbox.json', 'tasks.json', 'support/tickets.json', 'holds/active.json', 'campaigns.json'].map(get));
    const db = { cfg, bookings, customers: customers || {}, vouchers: vouchers || [], waitlist: waitlist || [], audit: audit || [], outbox: outbox || [], tasks: tasks || { items: [], hidden: {} }, tickets: tickets || [], campaigns: campaigns || [], holds: (holds || []).filter(h => new Date(h.expires).getTime() > Date.now()) };
    if (firstRun) { S.dirty.add('config.json'); }
    return db;
  }

  function fileFor(part) { return part; }
  async function reloadTickets() {
    if (S.mode === 'demo') return S.DB.tickets || [];
    const cur = await S.gh.get(CONF.dataRepo, 'support/tickets.json'); if (!cur) return S.DB.tickets || [];
    S.sha['support/tickets.json'] = cur.sha;
    if (S.dirty.has('support/tickets.json')) return S.DB.tickets;   // our unsaved changes win until they're saved (and merged)
    S.DB.tickets = cur.data || []; return S.DB.tickets;
  }
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
    if (f === 'support/tickets.json') return DB.tickets || [];
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
        // support tickets: messages that arrived meanwhile (from the website) are kept, ours are added on top
        if (cur && f === 'support/tickets.json') {
          const sig = m => m.at + '|' + m.from + '|' + (m.text || '').slice(0, 40);
          for (const t of cur.data || []) { const mine = S.DB.tickets.find(x => x.id === t.id); if (!mine) { S.DB.tickets.push(t); continue; }
            const have = new Set(mine.messages.map(sig)); const extra = t.messages.filter(m => !have.has(sig(m)));
            if (extra.length) { mine.messages.push(...extra); mine.messages.sort((a, b) => a.at.localeCompare(b.at)); if (extra.some(m => m.from === 'guest')) { mine.needsReply = true; mine.status = 'open'; } } }
        }
        // gift vouchers: amounts used online meanwhile are kept and taken off our copy too (user 2026-11-27)
        if (cur && f === 'vouchers.json') {
          for (const sv of cur.data || []) { const mine = S.DB.vouchers.find(v => v.id === sv.id || v.code === sv.code); if (!mine) { S.DB.vouchers.push(sv); continue; }
            const have = new Set((mine.uses || []).map(u => u.at + '|' + u.amount));
            for (const u of sv.uses || []) if (!have.has(u.at + '|' + u.amount)) { (mine.uses = mine.uses || []).push(u); mine.balance = Math.max(0, Math.round((mine.balance - u.amount) * 100) / 100); if (!mine.balance) mine.status = 'used'; } }
        }
        // emails: the job's record of what was sent (status, from, time) wins; emails we queued meanwhile are kept (user 2026-11-27)
        if (cur && f === 'outbox.json') {
          const theirs = new Map((cur.data || []).map(o => [o.id, o]));
          S.DB.outbox = S.DB.outbox.map(o => { const t = theirs.get(o.id); if (!t) return o; theirs.delete(o.id); return t.status !== 'queued' || o.status === 'queued' ? { ...o, ...t, to: o.to === '' ? '' : t.to, body: o.body === '(erased on request)' ? o.body : t.body } : o; });
          for (const t of theirs.values()) S.DB.outbox.push(t);
          S.DB.outbox.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
        }
        // guests: an unsubscribe recorded by the email job wins over our older copy (user 2026-11-27)
        if (cur && f === 'customers.json') {
          for (const [k, c] of Object.entries(cur.data || {})) { const mine = S.DB.customers[k]; if (!mine) { S.DB.customers[k] = c; continue; }
            if (c.unsubscribedAt && (!mine.unsubscribedAt || c.unsubscribedAt > mine.unsubscribedAt)) { mine.unsubscribedAt = c.unsubscribedAt; mine.marketing = false; }
            if (c.unsubKey && !mine.unsubKey) mine.unsubKey = c.unsubKey; }
        }
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
    const c = JSON.parse(JSON.stringify(S.DB.cfg)); delete c.photos;   // profile pictures stay private
    c.staff = c.staff.map(s => ({ id: s.id, active: s.active, priority: s.priority, cover: !!s.cover, treatments: s.treatments, duties: s.duties, pattern: s.pattern, shifts: s.shifts, maxHands: s.maxHands, breakRules: s.breakRules, off: (s.off || []).map(o => ({ from: o.from, to: o.to, start: o.start, end: o.end })) }));
    c.promos = await Promise.all((c.promos || []).filter(p => p.active !== false).map(async p => { const o = { ...p, hash: await sha('yc:' + String(p.code).trim().toUpperCase()) }; delete o.code; delete o.used; if (p.banner && p.banner.on) o.show = p.code; return o; }));
    delete c.emails;
    if (c.consult) c.consult = { questions: c.consult.questions, endpoint: c.consult.endpoint, publicKey: c.consult.publicKey };
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
  /* vault.json (v2): { v:2, tokenBox:{iv,ct}, users:[{ id, name, role, staffId, added, box }] }
     The GitHub key is encrypted once with a random master key (tokenBox). Each user's box holds that master key,
     encrypted with their own email + password. So the GitHub key can be replaced without breaking anyone's login. */
  const rawKey = async k => new Uint8Array(await crypto.subtle.exportKey('raw', k));
  const importK = b => crypto.subtle.importKey('raw', unb64(b), 'AES-GCM', true, ['encrypt', 'decrypt']);
  async function boxWith(kB64, obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importK(kB64), te.encode(JSON.stringify(obj)))); return { iv: b64(iv), ct: b64(ct) }; }
  async function openWith(kB64, box) { return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, await importK(kB64), unb64(box.ct)))); }
  async function newMaster() { return b64(await rawKey(await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']))); }
  // the published copy (for signing in); when signed in, read it straight from GitHub so it's never out of date
  async function getVault() {
    if (S.gh && S.mode === 'live') { const r = await S.gh.get(CONF.adminRepo, 'vault.json').catch(() => null); if (r) return r.data; }
    for (const u of ['vault.json?' + Date.now(), `https://raw.githubusercontent.com/${CONF.owner}/${CONF.adminRepo}/${CONF.branch}/vault.json?${Date.now()}`]) {
      try { const r = await fetch(u, { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) {}
    }
    return null;
  }
  async function saveVault(v) {
    const gh = S.gh, cur = await gh.get(CONF.adminRepo, 'vault.json');
    await gh.put(CONF.adminRepo, 'vault.json', v, cur && cur.sha, 'Update sign-in vault (encrypted)');
  }
  async function signIn(email, pass, keep) {
    const v = await getVault(); if (!v) throw new Error('This portal hasn’t been set up yet');
    const id = await sha('u:' + norm(email)), u = (v.users || []).find(x => x.id === id);
    if (!u) throw new Error('That email or password isn’t right');
    let sec; try { sec = await unlock(email, pass, u.box); } catch (e) { throw new Error('That email or password isn’t right'); }
    const token = sec.k ? (await openWith(sec.k, v.tokenBox)).token : sec.token;
    const sess = { token, k: sec.k || null, user: { id, email: norm(email), name: u.name, role: u.role, staffId: u.staffId || null } };
    if (keep) await remember(sess); else sessionStorage.setItem('yc-admin-sess', JSON.stringify(sess));
    return start('live', sess);
  }
  const sessNow = async () => { let s = null; try { s = JSON.parse(sessionStorage.getItem('yc-admin-sess') || 'null'); } catch (e) {} return s || await recall(); };
  async function resume() {
    const sess = await sessNow();
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
    S.DB.cfg.staff = S.DB.cfg.staff || []; S.loadedAt = new Date();
    if (S.dirty.size) scheduleSave();
    return S;
  }
  // fetch the latest data (saves anything waiting first) (user 2026-11-27)
  async function reload() {
    if (S.dirty.size || S.status === 'saving' || S.status === 'unsaved') await saveNow();
    if (S.mode === 'live') S.DB = await loadLive(); else S.DB = await loadDemo();
    S.DB.cfg.staff = S.DB.cfg.staff || []; S.loadedAt = new Date(); set('status', S.status === 'error' ? 'error' : 'idle');
  }
  async function signOut() { await forget(); sessionStorage.removeItem('yc-admin-sess'); location.hash = ''; location.reload(); }
  // a key must reach all three repositories and be allowed to save
  async function checkToken(token) {
    const gh = GH(token);
    for (const r of [CONF.adminRepo, CONF.dataRepo, CONF.liveRepo]) {
      const info = await gh.repo(r).catch(e => { throw new Error('GitHub refused the key: ' + e.message); });
      if (!info) throw new Error(`The key can’t see the ${r} repository. Give it access to ${CONF.adminRepo}, ${CONF.dataRepo} and ${CONF.liveRepo}.`);
      if (info.permissions && !info.permissions.push) throw new Error(`The key can read ${r} but not save to it. Set Contents to “Read and write”.`);
    }
    return gh;
  }
  // first set-up: the owner's login; the settings start from the York Cottage defaults (no sample bookings)
  async function setup({ name, email, pass, token }) {
    S.gh = await checkToken(token); S.mode = 'live';
    if (await getVault()) throw new Error('This portal is already set up. Sign in instead.');
    const k = await newMaster(), id = await sha('u:' + norm(email));
    await saveVault({ v: 2, tokenBox: await boxWith(k, { token }), users: [{ id, name, role: 'owner', added: new Date().toISOString(), box: await lock(email, pass, { k }) }] });
    const sess = { token, k, user: { id, email: norm(email), name, role: 'owner' } };
    sessionStorage.setItem('yc-admin-sess', JSON.stringify(sess));
    const st = await start('live', sess); audit('Portal set up by ' + name); return st;
  }
  // admin users (owner): each user's own email + password unlocks the master key
  async function users() { return S.mode === 'live' ? (await getVault()) || { users: [] } : JSON.parse(localStorage.getItem('yc-admin-demo-users') || 'null') || { users: [{ id: 'demo', name: 'Demo manager', role: 'owner', added: new Date().toISOString() }] }; }
  async function addUser({ name, email, pass, role, staffId }) {
    if (S.mode === 'demo') { const v = await users(); v.users.push({ id: 'd' + Date.now(), name, email: norm(email), role, staffId: staffId || null, added: new Date().toISOString() }); localStorage.setItem('yc-admin-demo-users', JSON.stringify(v)); return; }
    const v = await getVault(), sess = await sessNow();
    if (!sess || !sess.k) throw new Error('Sign out and in again, then add the user');
    const id = await sha('u:' + norm(email)); v.users = v.users.filter(u => u.id !== id);
    v.users.push({ id, name, role, staffId: staffId || null, added: new Date().toISOString(), box: await lock(email, pass, { k: sess.k }) });
    await saveVault(v);
  }
  async function removeUser(id) {
    if (S.mode === 'demo') { const v = await users(); v.users = v.users.filter(u => u.id !== id); localStorage.setItem('yc-admin-demo-users', JSON.stringify(v)); return; }
    const v = await getVault();
    if (!v.users.some(u => u.id !== id && u.role === 'owner')) throw new Error('Keep at least one owner');
    v.users = v.users.filter(u => u.id !== id); await saveVault(v);
  }
  // rename a user; your own name also updates this session (user 2026-11-27)
  async function renameUser(id, name) {
    name = String(name || '').trim().replace(/\s+/g, ' '); if (name.length < 2) throw new Error('Add a name');
    if (S.mode === 'demo') { const v = await users(); const u = v.users.find(x => x.id === id); if (u) u.name = name; localStorage.setItem('yc-admin-demo-users', JSON.stringify(v)); }
    else { const v = await getVault(), u = (v.users || []).find(x => x.id === id); if (!u) throw new Error('That user wasn’t found'); u.name = name; await saveVault(v); }
    if (S.user && S.user.id === id) {
      S.user.name = name;
      try { const ss = JSON.parse(sessionStorage.getItem('yc-admin-sess') || 'null'); if (ss && ss.user) { ss.user.name = name; sessionStorage.setItem('yc-admin-sess', JSON.stringify(ss)); } } catch (e) {}
      try { const r = await recall(); if (r && r.user) { r.user.name = name; await remember(r); } } catch (e) {}
    }
    return name;
  }
  async function changePassword(cur, next) {
    if (S.mode === 'demo') return;
    const v = await getVault(), u = v.users.find(x => x.id === S.user.id);
    const sec = await unlock(S.user.email, cur, u.box).catch(() => { throw new Error('Your current password isn’t right'); });
    u.box = await lock(S.user.email, next, sec); await saveVault(v);
  }
  // swap the GitHub key (e.g. before it expires); every login keeps working
  async function replaceToken(token) {
    if (S.mode !== 'live') throw new Error('Only in the live portal');
    const sess = await sessNow(); if (!sess || !sess.k) throw new Error('Sign out and in again first');
    const gh = await checkToken(token), v = await getVault();
    v.tokenBox = await boxWith(sess.k, { token }); S.gh = gh; await saveVault(v);
    sess.token = token; if (localStorage.getItem('yc-admin-keep')) await remember(sess); else sessionStorage.setItem('yc-admin-sess', JSON.stringify(sess));
  }

  // ---------- consultation forms (encrypted end to end) ----------
  // the private key lives inside the sign-in vault, locked with the master key; demo: this browser only
  async function consultKey() {
    if (S.mode === 'demo') { try { return JSON.parse(localStorage.getItem('yc-admin-demo-ckey') || 'null'); } catch (e) { return null; } }
    const v = await getVault(), sess = await sessNow(); if (!v || !v.consultBox || !sess || !sess.k) return null;
    return (await openWith(sess.k, v.consultBox)).privateJwk;
  }
  async function makeConsultKey() {
    const keys = await root.YCConsult.genKeys();
    if (S.mode === 'demo') localStorage.setItem('yc-admin-demo-ckey', JSON.stringify(keys.privateJwk));
    else { const v = await getVault(), sess = await sessNow(); if (!sess || !sess.k) throw new Error('Sign out and in again first'); v.consultBox = await boxWith(sess.k, { privateJwk: keys.privateJwk }); await saveVault(v); }
    return keys.publicJwk;
  }
  const cpath = (b, g) => `consult/${month(b)}/${b.ref}-g${g}-${Date.now().toString(36)}.json`;
  async function saveConsult(b, g, sealed, via) {
    const rec = { ref: b.ref, bookingId: b.id, g, via, at: new Date().toISOString(), by: S.user.name, sealed };
    if (S.mode === 'demo') { (S.DB.consults = S.DB.consults || []).push({ path: cpath(b, g), ...rec }); localStorage.setItem(DEMO_KEY, JSON.stringify(S.DB)); return; }
    await S.gh.put(CONF.dataRepo, cpath(b, g), rec, null, `Consultation form for ${b.ref} (encrypted)`);
  }
  // forms for a booking: filed ones for its month + any still in the online inbox
  async function listConsults(b) {
    if (S.mode === 'demo') return (S.DB.consults || []).filter(c => c.ref === b.ref);
    const out = [];
    for (const dir of ['consult/' + month(b), 'consult/inbox']) {
      const files = (await S.gh.list(CONF.dataRepo, dir).catch(() => [])).filter(f => f.name.startsWith(b.ref + '-'));
      for (const f of files) { const r = await S.gh.get(CONF.dataRepo, dir + '/' + f.name).catch(() => null); if (r && (!r.data.t || r.data.t === b.consultToken || dir !== 'consult/inbox')) out.push({ path: dir + '/' + f.name, ...r.data }); }
    }
    return out.sort((a, c) => (a.at || '').localeCompare(c.at || ''));
  }

  // ---------- outbox: emails, payment links and refunds are carried out by the data repo's GitHub Action ----------
  function queue(job) {
    const o = { id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), by: S.user.name, status: S.mode === 'demo' ? 'demo' : 'queued', ...job };
    S.DB.outbox.push(o); S.DB.outbox = S.DB.outbox.slice(-8000); touch('outbox'); return o;
  }
  function audit(what, ref) { if (!what) return; S.DB.audit.push({ at: new Date().toISOString(), by: S.user ? S.user.name : 'Admin', what, ref: ref || '' }); }

  root.YCStore = { S, CONF, reloadTickets, signIn, resume, renameUser, reload, sessName: async () => { try { const x = await sessNow(); return x && x.user ? x.user.name : ''; } catch (e) { return ''; } }, startDemo, setup, signOut, users, addUser, removeUser, changePassword, replaceToken, consultKey, makeConsultKey, saveConsult, listConsults, touch, saveNow, publish, queue, audit, getVault, month, sha, loadDemo, DEMO_KEY,
    onChange: f => S.listeners.push(f) };
})(this);
