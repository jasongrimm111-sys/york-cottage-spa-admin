/* York Cottage admin: app shell, helpers and routing. Views live in views-*.js. */
(function () {
  const E = window.YCEngine, St = window.YCStore;
  const A = window.YCA = { views: {} };
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gbp = (n, dp) => (n < 0 ? '−' : '') + '£' + Math.abs(+n || 0).toLocaleString('en-GB', { minimumFractionDigits: dp != null ? dp : (Math.round(n * 100) % 100 ? 2 : 0), maximumFractionDigits: 2 });
  const dObj = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const fd = (iso, o) => iso ? dObj(iso).toLocaleDateString('en-GB', o || { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const fdy = iso => fd(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const ft = isoT => isoT ? new Date(isoT).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const today = () => E.localISO();
  const uid = p => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DAYS_L = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // product colours: the validated categorical palette, in fixed order
  const PCOL = { day: '#2a78d6', access: '#eb6834', private: '#1baf7a', break: '#eda100', group: '#e87ba4', house: '#008300', treat: '#6250d6' };
  const PINK = { break: '#0b0b0b' };
  Object.assign(A, { $, $$, esc, gbp, fd, fdy, ft, dObj, today, uid, DAYS, DAYS_L, PCOL, PINK });
  A.DB = () => St.S.DB; A.cfg = () => St.S.DB.cfg;
  A.pname = k => (A.cfg().products[k] || {}).name || k;
  A.tname = id => (E.tr(A.cfg(), id) || {}).name || id;
  A.iname = it => E.itemName ? E.itemName(A.cfg(), it) : A.tname(it.tid);   // a booked treatment, with any it was extended by
  A.sname = id => ((A.cfg().staff.find(s => s.id === id)) || {}).name || '—';
  A.scol = id => ((A.cfg().staff.find(s => s.id === id)) || {}).colour || '#8a9a85';
  A.initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  A.cust = b => b.customer ? `${b.customer.first || ''} ${b.customer.last || ''}`.trim() : '';

  // ---------- icons ----------
  const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  // the same day, three ways (user, 2026-11-26: the 'By therapist' page is gone): switching keeps the date (and the person, on a therapist's day)
  A.dayTabs = (d, cur, sid) => {
    if (!St.S.user || (A.isTher && A.isTher())) return '';
    const cfg = A.cfg(), who = sid || (cfg.staff.find(s => s.active !== false) || {}).id;
    const tabs = [['today', 'Overview', `#/today/${d}`], ['calendar', 'Calendar', `#/calendar/day/${d}`], ['person', 'Staff view', `#/today/${d}?as=${who}`]];
    return '';   // removed; kept as a no-op so older calls stay harmless
  };
  A.ic = {
    today: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    wait: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    staff: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>'),
    rota: I('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 4v17"/>'),
    cust: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    gift: I('<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S9 3 7 5s1 3 5 3c4 0 7-1 5-3s-5 3-5 3"/>'),
    tag: I('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>'),
    chart: I('<path d="M3 21h18M6 17V10M11 17V5M16 17v-7M21 17v-4"/>'),
    spa: I('<path d="M12 21c-5 0-8-3-8-7 3 0 6 1 8 4 2-3 5-4 8-4 0 4-3 7-8 7z"/><path d="M12 18c-2-3-2-8 0-12 2 4 2 9 0 12z"/>'),
    treat: I('<path d="M4 17c2-2 4-2 6 0s4 2 6 0 4-2 4-2M4 12c2-2 4-2 6 0s4 2 6 0 4-2 4-2M12 3v4"/>'),
    bed: I('<path d="M3 18V7M21 18v-5a3 3 0 0 0-3-3H10v8M3 14h18M6.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>'),
    box: I('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
    price: I('<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    cog: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'), x: I('<path d="M18 6 6 18M6 6l12 12"/>'), edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    left: I('<path d="m15 18-6-6 6-6"/>'), right: I('<path d="m9 18 6-6-6-6"/>'), print: I('<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>'),
    search: I('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'), menu: I('<path d="M4 6h16M4 12h16M4 18h16"/>'), dl: I('<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>'),
    copy: I('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'), trash: I('<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>'), check: I('<path d="m5 12 5 5L20 7"/>'),
    log: I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>')
  };

  // ---------- forms ----------
  // fields carry data-k="path.to.value" and data-t (num|bool|list|days|json); A.read() builds the object back
  const attr = o => Object.entries(o || {}).filter(([, v]) => v != null && v !== false).map(([k, v]) => v === true ? k : `${k}="${esc(v)}"`).join(' ');
  A.f = {
    text: (k, label, v, o = {}) => `<label class="fld ${o.cls || ''}"><span>${label}</span>${o.pre ? `<span class="inp-pre"><b>${o.pre}</b>` : ''}<input class="inp" data-k="${k}" ${o.t ? `data-t="${o.t}"` : ''} ${attr({ type: o.type || 'text', value: v ?? '', placeholder: o.ph, min: o.min, max: o.max, step: o.step, required: o.req, inputmode: o.im, list: o.list, autocomplete: o.ac || 'off', maxlength: o.maxlength })}>${o.pre ? '</span>' : ''}${o.hint ? `<small>${o.hint}</small>` : ''}</label>`,
    num: (k, label, v, o = {}) => A.f.text(k, label, v, { ...o, type: 'number', t: 'num', im: 'decimal', step: o.step || 'any' }),
    money: (k, label, v, o = {}) => A.f.text(k, label, v, { ...o, type: 'number', t: 'num', pre: '£', step: '0.01', im: 'decimal' }),
    time: (k, label, v, o = {}) => A.f.text(k, label, v, { ...o, type: 'time', step: 300 }),
    date: (k, label, v, o = {}) => A.f.text(k, label, v, { ...o, type: 'date' }),
    area: (k, label, v, o = {}) => `<label class="fld"><span>${label}</span><textarea class="inp" data-k="${k}" rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}">${esc(v || '')}</textarea>${o.hint ? `<small>${o.hint}</small>` : ''}</label>`,
    sel: (k, label, v, opts, o = {}) => `<label class="fld"><span>${label}</span><select class="inp" data-k="${k}" ${o.t ? `data-t="${o.t}"` : ''}>${opts.map(x => { const [val, txt] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}" ${String(val) === String(v ?? '') ? 'selected' : ''}>${esc(txt)}</option>`; }).join('')}</select>${o.hint ? `<small>${o.hint}</small>` : ''}</label>`,
    sw: (k, label, v, o = {}) => `<label class="sw ${o.cls || ''}"><input type="checkbox" data-k="${k}" data-t="bool" ${v ? 'checked' : ''}> ${label}</label>`,
    chk: (k, label, v) => `<label class="chk"><input type="checkbox" data-k="${k}" data-t="bool" ${v ? 'checked' : ''}> <span>${label}</span></label>`,
    // multi-pick chips: value is an array
    chips: (k, label, v, opts, o = {}) => `<div class="fld"><span>${label}</span><div class="chips" data-k="${k}" data-t="${o.num ? 'nlist' : 'list'}">${opts.map(x => { const [val, txt] = Array.isArray(x) ? x : [x, x]; return `<button type="button" class="chip ${o.sm ? 'sm' : ''} ${(v || []).map(String).includes(String(val)) ? 'on' : ''}" data-v="${esc(val)}">${esc(txt)}</button>`; }).join('')}</div>${o.hint ? `<small>${o.hint}</small>` : ''}</div>`,
    days: (k, label, v, o = {}) => A.f.chips(k, label, v, [1, 2, 3, 4, 5, 6, 0].map(d => [d, DAYS[d]]), { ...o, num: true, sm: true })
  };
  const setPath = (o, path, v) => { const ks = path.split('.'); let x = o; ks.slice(0, -1).forEach((k, i) => { if (x[k] == null || typeof x[k] !== 'object') x[k] = /^\d+$/.test(ks[i + 1]) && false ? [] : {}; x = x[k]; }); x[ks[ks.length - 1]] = v; };
  A.read = (root, into = {}) => {
    $$('[data-k]', root).forEach(el => {
      const t = el.dataset.t, k = el.dataset.k; let v;
      if (el.classList.contains('chips')) { v = $$('.chip.on', el).map(c => c.dataset.v); if (t === 'nlist') v = v.map(Number); }
      else if (t === 'bool') v = el.checked;
      else if (t === 'num') v = el.value === '' ? null : +el.value;
      else v = el.value.trim();
      setPath(into, k, v);
    });
    return into;
  };
  document.addEventListener('click', e => { const c = e.target.closest('.chips .chip'); if (c && !c.closest('[data-single]')) { c.classList.toggle('on'); c.closest('.chips').dispatchEvent(new Event('change', { bubbles: true })); } });

  // ---------- modal & toast ----------
  A.modal = ({ title, body, ok = 'Save', cancel = 'Cancel', size = '', danger, onOk, onOpen, foot = '' }) => new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="m-h"><h2>${title}</h2><button class="icon-btn" data-x aria-label="Close">${A.ic.x}</button></div><div class="m-b">${body}</div>
      <div class="m-f"><span class="msg"></span>${foot}${cancel ? `<button class="btn" data-x>${cancel}</button>` : ''}${ok ? `<button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${ok}</button>` : ''}</div></div>`;
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const m = $('.modal', ov), close = v => { ov.remove(); if (!$('.ov')) document.body.style.overflow = ''; res(v); };
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov._down = true; });
    ov.addEventListener('click', e => { if (e.target === ov && ov._down) close(null); if (e.target.closest('[data-x]')) close(null); });
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });
    const okB = $('[data-ok]', ov);
    if (okB) okB.onclick = async () => {
      const msg = $('.msg', ov); msg.textContent = '';
      try { const r = onOk ? await onOk(m, msg) : true; if (r !== false) close(r === undefined ? true : r); } catch (err) { msg.textContent = err.message; }
    };
    if (onOpen) onOpen(m, close);
    if (A.applyPerms) A.applyPerms(m);
    setTimeout(() => { const f = $('input:not([type=checkbox]),select,textarea', m); if (f && !A.touch) f.focus(); }, 30);
  });
  A.confirm = (title, text, ok = 'Yes', danger = true) => A.modal({ title, body: `<p>${text}</p>`, ok, danger });
  let toastT;
  A.toast = (msg, undo) => {
    $$('.toast').forEach(t => t.remove()); clearTimeout(toastT);
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Undo</button>' : ''}`;
    if (undo) $('button', t).onclick = () => { undo(); t.remove(); };
    document.body.appendChild(t); toastT = setTimeout(() => t.remove(), undo ? 7000 : 3200);
  };
  A.touch = matchMedia('(pointer:coarse)').matches;

  // ---------- saving ----------
  // change(part, b, what): marks the data changed, logs it, and saves
  A.change = (part, b, what, ref) => { if (what) St.audit(what, ref || (b && b.ref)); St.touch(part, b); };

  // ---------- CSV ----------
  A.csv = (name, rows) => {
    const s = rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + s], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  A.download = (name, data) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); a.download = name; a.click(); };

  // ---------- shell ----------
  const NAV = [
    ['Run the day', [['today', 'Today', 'today'], ['ahead', 'Future days', 'cal'], ['calendar', 'Calendar', 'cal'], ['roomcal', 'Room calendar', 'bed'], ['bookings', 'Bookings', 'list'], ['waitlist', 'Waitlist', 'wait']]],
    ['Team', [['staff', 'Staff', 'staff'], ['rota', 'Rota', 'rota']]],
    ['Guests & sales', [['support', 'Support', 'mail'], ['customers', 'Customers', 'cust'], ['vouchers', 'Gift vouchers', 'gift'], ['promos', 'Discount codes', 'tag'], ['reports', 'Reports', 'chart']]],
    ['Set-up', [['spa', 'Spa & sessions', 'spa'], ['treatments', 'Treatments', 'treat'], ['rooms', 'Rooms', 'bed'], ['products', 'Booking types', 'box'], ['rates', 'Date prices', 'price'], ['emails', 'Emails', 'mail'], ['rules', 'Rules', 'log'], ['settings', 'Settings', 'cog']]]
  ];
  A.isTher = () => !!(St.S.user && !A.can('staff.view') && A.myStaff());   // sees only their own day
  A.reshell = () => { shell(); route(); saveSt(); };
  function shell() {
    const S = St.S, ther = !A.can('view.today');
    // the menu follows the user's role; anyone linked to a staff member gets "My day"
    const nav = [...(A.myStaff() ? [['My work', [['staffday/' + A.myStaff(), 'My day', 'today']]]] : []), ...NAV.map(([h, items]) => [h, items.filter(([r]) => A.canRoute(r) && !(r === 'today' && false))])].filter(([, items]) => items.length);
    document.body.innerHTML = `<div class="app">
      <aside class="side" id="side"><a class="brand" href="#/${A.homeRoute()}"><i class="brand-lotus">${A.lotus()}</i><span><b>York Cottage</b><small>Spa admin</small></span></a>
        <nav class="nav">${nav.map(([h, items]) => `<div class="nav-h">${h}</div>` + items.map(([r, t, ic]) => `<a href="#/${r}" data-r="${r.split('/')[0]}">${A.ic[ic]}<span>${t}</span>${r === 'bookings' || r === 'waitlist' || r === 'todo' || r === 'support' ? `<span class="cnt" data-cnt="${r}" hidden></span>` : ''}</a>`).join('')).join('')}</nav>
        <div class="side-foot">${S.mode === 'demo' ? '<span class="demo-tag">OFFLINE DEMO</span><br>Changes here are kept in this browser only and aren’t saved to York Cottage’s data.<br><button class="btn sm" id="leaveDemo" style="margin-top:8px;color:var(--ink)">Go to the real portal</button>' : `Signed in as ${esc(S.user.name)}<br><span style="opacity:.7">Everything saves to York Cottage’s private data store</span>`}${S.realUser ? '<br><button class="btn sm" id="backMgr" style="margin-top:8px;color:var(--ink)">Back to the manager view</button>' : ''}</div></aside>
      <div class="main"><header class="top">
        <button class="burger" id="burger" aria-label="Menu">${A.ic.menu}</button>
        <div class="search">${A.ic.search}<input id="q" placeholder="${innerWidth < 600 ? 'Search guests, bookings…' : 'Search bookings, guests, references…'}" autocomplete="off" aria-label="Search" type="search" enterkeyhint="search"><div class="search-res" id="qres" hidden></div></div>
        <span style="flex:1"></span>
        ${A.can('view.today') ? `<a class="icon-btn bell" href="#/todo" title="To do" aria-label="To do"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg><span class="cnt" data-cnt="todo" hidden></span></a>` : ''}
        ${A.can('bookings.create') ? `<a class="btn pri" href="#/new">${A.ic.plus}<span>New booking</span></a>` : ''}
        <span class="save-st" id="saveSt"><i></i><span>Saved</span><button type="button" class="reload-btn" id="reloadBtn" title="Refresh: get the latest bookings and changes" aria-label="Refresh"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg></button></span>
        <div class="me"><button class="me-btn" id="meBtn"><i>${A.initials(S.user.name)}</i><b>${esc(S.user.name.split(' ')[0])}</b></button>
          <div class="me-menu" id="meMenu" hidden><a href="#/settings/users">Users & password</a><a href="#/settings/data">Backup & data</a>${S.mode === 'demo' ? '<button id="resetDemo">Reset the demo data</button>' : ''}<button id="signOut">Sign out</button></div></div>
      </header><main class="view" id="view"></main></div>
      <nav class="tabbar" aria-label="Main"><button id="tbMenu" type="button">${A.ic.menu}<span>Menu</span></button>${[...(A.can('view.today') ? [['today', 'Today', 'today'], ['ahead', 'Future', 'cal']] : A.myStaff() ? [['staffday/' + A.myStaff(), 'My day', 'today']] : []), ...(A.can('view.calendar') ? [['calendar', 'Calendar', 'cal']] : []), ...(A.can('view.bookings') ? [['bookings', 'Bookings', 'list']] : [])].slice(0, 4).map(([r, t, ic]) => `<a href="#/${r}" data-r="${r.split('/')[0]}">${A.ic[ic]}<span>${t}</span>${r === 'todo' ? '<i class="tb-cnt" data-cnt="todo2" hidden></i>' : ''}</a>`).join('')}</nav></div>`;
    $('#burger').onclick = () => document.body.classList.toggle('nav-open');
    $('#tbMenu').onclick = e => { e.stopPropagation(); document.body.classList.toggle('nav-open'); };
    $('#side').addEventListener('click', e => { if (e.target.closest('a')) document.body.classList.remove('nav-open'); });
    document.addEventListener('click', e => { if (document.body.classList.contains('nav-open') && !e.target.closest('#side') && !e.target.closest('#burger') && !e.target.closest('#tbMenu')) document.body.classList.remove('nav-open'); });
    $('#meBtn').onclick = e => { e.stopPropagation(); $('#meMenu').hidden = !$('#meMenu').hidden; };
    document.addEventListener('click', () => { const m = $('#meMenu'); if (m) m.hidden = true; });
    $('#signOut').onclick = async () => { await St.saveNow(); St.signOut(); };
    const ld = $('#leaveDemo'); if (ld) ld.onclick = () => { sessionStorage.removeItem('yc-admin-sess'); location.href = location.pathname; };
    const bm = $('#backMgr'); if (bm) bm.onclick = () => { S.user = S.realUser; delete S.realUser; A.reshell(); location.hash = '#/today'; };
    if (!A.can('view.bookings')) $('.search').style.visibility = 'hidden';
    const rd = $('#resetDemo'); if (rd) rd.onclick = async () => { if (await A.confirm('Reset the demo?', 'This replaces everything in the demo with fresh sample data.', 'Reset')) { localStorage.removeItem(St.DEMO_KEY); await St.startDemo(true); route(); A.toast('Demo reset'); } };
    St.onChange(k => { if (k === 'status') saveSt(); });
    const rb = $('#reloadBtn'); if (rb) rb.onclick = async () => { if (rb.classList.contains('spin')) return; rb.classList.add('spin');
      try { await St.reload(); A.refresh(); saveSt(); A.toast('Up to date'); } catch (e) { A.toast('Couldn’t refresh: ' + e.message); } finally { rb.classList.remove('spin'); } };
    search();
    addEventListener('beforeunload', e => { if (St.S.status === 'unsaved' || St.S.status === 'saving') { St.saveNow(); e.preventDefault(); e.returnValue = ''; } });
  }
  const hm = d => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  function saveSt() {
    const el = $('#saveSt'); if (!el) return; const s = St.S.status;
    el.className = 'save-st ' + s;
    $('span', el).textContent = s === 'saving' ? 'Saving…' : s === 'unsaved' ? 'Saving…' : s === 'error' ? 'Not saved: ' + St.S.lastError.slice(0, 60) : St.S.mode === 'demo' ? 'Demo only, not saved' : St.S.lastSaved && St.S.lastSaved >= (St.S.loadedAt || 0) ? `Saved ${hm(St.S.lastSaved)}` : `Up to date · ${hm(St.S.loadedAt || new Date())}`;
    el.title = St.S.lastError || '';
  }
  function counts() {
    const DB = A.DB(), t = today();
    const pend = DB.bookings.filter(b => b.status === 'pending' && b.date >= t).length;
    const wl = DB.waitlist.filter(w => w.status === 'waiting' && w.date >= t).length;
    const c1 = $('[data-cnt=bookings]'), c2 = $('[data-cnt=waitlist]'), c3 = $('[data-cnt=todo]');
    { const cs = $('[data-cnt=support]'); if (cs && A.ticketsNeedingReply) { const n = A.ticketsNeedingReply().length; cs.hidden = !n; cs.textContent = n; cs.classList.add('hot'); cs.title = n + ' message' + (n === 1 ? '' : 's') + ' need a reply'; } }
    if (c3 && A.todoCount) { const n = A.todoCount(); c3.hidden = !n; c3.textContent = n; c3.title = n + ' to do'; const c4 = $('[data-cnt=todo2]'); if (c4) { c4.hidden = !n; c4.textContent = n; } }
    if (c1) { c1.hidden = !pend; c1.textContent = pend; c1.title = pend + ' waiting for payment'; }
    if (c2) { c2.hidden = !wl; c2.textContent = wl; }
  }
  // ---------- search ----------
  function search() {
    const q = $('#q'), res = $('#qres'); let sel = 0, hits = [];
    const run = () => {
      const s = q.value.trim().toLowerCase(); if (s.length < 2) { res.hidden = true; return; }
      const DB = A.DB();
      hits = DB.bookings.filter(b => [b.ref, A.cust(b), b.customer && b.customer.email, b.customer && b.customer.phone, A.pname(b.product)].join(' ').toLowerCase().includes(s))
        .sort((a, b) => Math.abs(E.between(today(), a.date)) - Math.abs(E.between(today(), b.date))).slice(0, 8).map(b => ({ href: '#/booking/' + b.id, html: `<span><b>${esc(A.cust(b))}</b> · ${esc(A.pname(b.product))}<br><span class="small muted">${b.ref} · ${fdy(b.date)}</span></span>${A.statusBadge(b)}` }));
      const cs = Object.values(A.customers()).filter(c => (c.name + ' ' + c.email + ' ' + (c.phone || '')).toLowerCase().includes(s)).slice(0, 4).map(c => ({ href: '#/customer/' + encodeURIComponent(c.email), html: `<span><b>${esc(c.name)}</b><br><span class="small muted">${esc(c.email)} · ${c.visits} visit${c.visits === 1 ? '' : 's'}</span></span><span class="badge">Guest</span>` }));
      const vs = DB.vouchers.filter(v => v.code.toLowerCase().includes(s)).slice(0, 3).map(v => ({ href: '#/vouchers', html: `<span><b>${v.code}</b><br><span class="small muted">${esc(v.name)} · ${gbp(v.balance)} left</span></span><span class="badge">Voucher</span>` }));
      hits = [...hits, ...cs, ...vs]; sel = 0;
      res.innerHTML = hits.length ? hits.map((h, i) => `<a href="${h.href}" class="${i === 0 ? 'on' : ''}">${h.html}</a>`).join('') : '<div class="empty" style="padding:16px">Nothing found</div>';
      res.hidden = false;
    };
    q.oninput = run;
    q.onkeydown = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); $$('a', res).forEach((a, i) => a.classList.toggle('on', i === sel)); }
      if (e.key === 'Enter' && hits[sel]) { location.hash = hits[sel].href; q.value = ''; res.hidden = true; q.blur(); }
      if (e.key === 'Escape') { res.hidden = true; q.blur(); }
    };
    res.onclick = () => { q.value = ''; res.hidden = true; };
    document.addEventListener('click', e => { if (!e.target.closest('.search')) res.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } });
  }

  // ---------- shared bits ----------
  A.statusBadge = b => {
    if (b.status === 'cancelled') return '<span class="badge bad bdot">Cancelled</span>';
    if (b.status === 'enquiry') return '<span class="badge info bdot">Enquiry</span>';
    if (b.noShow) return '<span class="badge bad bdot">No-show</span>';
    if (b.status === 'pending') return '<span class="badge warn bdot">Awaiting payment</span>';
    const q = b.quote || {}, paid = E.paid(b);
    if (paid + 0.009 < (q.total || 0)) return paid > 0 ? '<span class="badge info bdot">Deposit paid</span>' : '<span class="badge warn bdot">Unpaid</span>';
    return '<span class="badge ok bdot">Paid</span>';
  };
  A.whenText = b => {
    const cfg = A.cfg(), p = cfg.products[b.product] || {};
    if (p.kind === 'session' || p.kind === 'private') { const s = E.session(cfg, b.sessionId); return `${fdy(b.date)}${s ? ` · ${s.name} ${s.start}–${s.end}` : ''}`; }
    if (p.kind === 'treat') { const st = (b.items || []).map(i => i.start).sort()[0]; return `${fdy(b.date)}${st ? ' · from ' + st : b.part ? ' · ' + b.part : ''}`; }
    return `${fdy(b.date)} → ${fd(E.addD(b.date, b.nights || 0))} · ${b.nights} night${b.nights === 1 ? '' : 's'}`;
  };
  A.prodDot = k => `<span class="dot" style="background:${PCOL[k] || '#999'}"></span>`;
  // customers, built from bookings + saved notes
  A.customers = () => {
    const DB = A.DB(), out = {};
    for (const b of DB.bookings) {
      if (!b.customer || !b.customer.email) continue;
      const k = b.customer.email.toLowerCase(), c = out[k] = out[k] || { email: k, name: '', first: '', last: '', phone: '', visits: 0, spend: 0, last: '', firstVisit: '', bookings: [] };
      c.first = b.customer.first; c.last = b.customer.last; c.name = A.cust(b); c.phone = b.customer.phone || c.phone;
      c.bookings.push(b);
      if (E.live(b)) { c.visits++; c.spend += E.paid(b); if (b.date > (c.lastVisit || '')) c.lastVisit = b.date; if (!c.firstVisit || b.date < c.firstVisit) c.firstVisit = b.date; }
    }
    for (const [k, v] of Object.entries(DB.customers || {})) { if (out[k]) Object.assign(out[k], { marketing: v.marketing, notes: v.notes, tags: v.tags || [] }); }
    return out;
  };

  // ---------- routing ----------
  let current = '';
  const TRAIL = 'yc-admin-trail';
  let trail = (() => { try { return JSON.parse(sessionStorage.getItem(TRAIL) || '[]'); } catch (e) { return []; } })(), lastHash = null, lastTitle = '', fromMenu = false;
  document.addEventListener('click', e => { if (e.target.closest('.nav a, .tabbar a')) fromMenu = true; }, true);
  const pageKey = x => (x || '').split('?')[0];
  function step(cur){
    if (fromMenu) { trail = []; fromMenu = false; }
    else if (lastHash && pageKey(lastHash) !== pageKey(cur)) {
      const i = trail.findIndex(t => t.h === cur);
      if (i >= 0) trail = trail.slice(0, i);   // went back (link or browser)
      else trail.push({ h: lastHash, t: lastTitle });
      trail = trail.slice(-12);
    }
    try { sessionStorage.setItem(TRAIL, JSON.stringify(trail)); } catch (e) {}
  }
  async function route() {
    step(location.hash);
    let h = location.hash.replace(/^#\/?/, '') || A.homeRoute();
    if (!A.canRoute(h.split('?')[0].split('/')[0])) h = A.homeRoute();
    const [name, ...rest] = h.split('?')[0].split('/');   // ?query stays in location.hash for the view to read
    const v = A.views[name] || A.views.today;
    // colours for booking types added later: the next validated palette slot
    const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
    Object.keys(A.cfg().products).forEach((k, i) => { if (!PCOL[k]) PCOL[k] = SLOTS[i % SLOTS.length]; });
    $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.r === name || (name === 'booking' && a.dataset.r === 'bookings') || (name === 'day' && a.dataset.r === 'calendar')));
    $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.r === name || (name === 'booking' && a.dataset.r === 'bookings') || (name === 'day' && a.dataset.r === 'calendar') || (name === 'customer' && a.dataset.r === 'customers') || (name === 'edit' && a.dataset.r === 'bookings')));
    const el = $('#view');
    const same = current === h; current = h;
    try {
      const out = v(...rest.map(decodeURIComponent));
      const back = trail.length ? `<a class="backbar" href="${esc(trail[trail.length - 1].h)}">${A.ic.left}<span>Back to ${esc(trail[trail.length - 1].t)}</span></a>` : '';
      if (out && typeof out === 'object' && 'html' in out) { el.innerHTML = back + out.html; if (out.wire) await out.wire(el); }
      else el.innerHTML = back + out;
      A.applyPerms(el);
    } catch (err) { console.error(err); el.innerHTML = `<div class="note bad">Something went wrong showing this page: ${esc(err.message)}</div>`; }
    if (!same) scrollTo(0, 0);
    counts();
    document.title = (($('.vh h1', el) || {}).textContent || 'Admin') + ' · York Cottage admin';
    // a main page is named as in the menu ("Back to Today"), anything else by its heading ("Back to Olivia Barker")
    { const on = $('.nav a.on'); lastHash = location.hash; lastTitle = ((on && on.dataset.r === name ? (on.querySelector('span') || {}).textContent : ($('.vh h1', el) || {}).textContent) || 'the last page').trim().slice(0, 40); }
  }
  A.route = route; A.refresh = () => { const y = scrollY; route(); scrollTo(0, y); };
  addEventListener('hashchange', route);

  A.lotus = (cls = '') => `<svg class="lotus ${cls}" viewBox="0 0 760 500" fill="none" stroke="currentColor" stroke-width="24" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M160 190 L160 45 C215 62 268 92 305 132"/><path d="M600 190 L600 45 C545 62 492 92 455 132"/><path d="M380 25 C455 115 515 215 515 325 C515 415 455 470 380 485 C305 470 245 415 245 325 C245 215 305 115 380 25 Z"/><path d="M10 180 C150 172 290 212 345 300 C368 337 380 360 380 385 L380 488 C235 488 125 455 82 382 C52 330 27 258 10 180 Z"/><path d="M750 180 C610 172 470 212 415 300 C392 337 380 360 380 385 L380 488 C525 488 635 455 678 382 C708 330 733 258 750 180 Z"/></svg>`;
  // ---------- sign-in screens ----------
  function authScreen(kind, msg) {
    const vaultMissing = kind === 'setup';
    document.body.innerHTML = `<div class="auth"><div class="auth-pic">${A.lotus('auth-lotus')}<div class="eyebrow" style="color:#f3c6ad">York Cottage Spa</div><h1>Admin portal</h1><p>Bookings, therapists, rooms, treatments, prices and reports in one place.</p></div>
      <div class="auth-box"><div class="auth-card">
      ${vaultMissing ? `<div class="eyebrow">First set-up</div><h2>Create the owner login</h2><p class="lead">This connects the portal to its private data store on GitHub and makes you the owner. You only do this once. It starts with York Cottage’s settings already in place (sessions, prices, rooms, treatments, two therapists), and no sample bookings.</p>
        <ol class="steps-list"><li>On GitHub, create a fine-grained access key with access to <b>${St.CONF.adminRepo}</b>, <b>${St.CONF.dataRepo}</b> and <b>${St.CONF.liveRepo}</b>, with <b>Contents: Read and write</b>.</li><li>Paste it below with your name, email and a strong password.</li><li>The key is saved only in encrypted form, unlocked by your password.</li></ol>
        <form id="setupF">${A.f.text('name', 'Your name', '', { ac: 'name' })}<div style="height:10px"></div>${A.f.text('email', 'Email', '', { type: 'email', ac: 'username' })}<div style="height:10px"></div>${A.f.text('pass', 'Password (10+ characters)', '', { type: 'password', ac: 'new-password' })}<div style="height:10px"></div>${A.f.text('token', 'GitHub access key', '', { type: 'password', ac: 'off' })}
        <div class="auth-msg" id="am"></div><button class="btn pri" type="submit">Set up the portal</button></form>`
      : `<div class="eyebrow">Welcome back</div><h2>Sign in</h2><p class="lead">For York Cottage staff only.</p>
        <form id="loginF"><div class="fld" style="margin-bottom:12px"><label for="le">Email</label><input class="inp" id="le" type="email" autocomplete="username" required></div>
        <div class="fld" style="margin-bottom:12px"><label for="lp">Password</label><input class="inp" id="lp" type="password" autocomplete="current-password" required></div>
        <label class="chk" style="margin-bottom:6px"><input type="checkbox" id="lk"> <span>Keep me signed in on this device for 30 days</span></label>
        <div class="auth-msg" id="am">${esc(msg || '')}</div><button class="btn pri" type="submit">Sign in</button></form>`}
      ${!vaultMissing && !/[?&]demo\b/.test(location.search) ? '' : `<div class="or">or</div><button class="btn" id="demoB" style="width:100%;justify-content:center">Explore the offline demo</button>
      <p class="small muted" style="margin-top:14px">The offline demo uses made-up guests and keeps everything in this browser only. Nothing is saved to York Cottage’s data.</p>`}
      </div></div></div>`;
    const db = $('#demoB'); if (db) db.onclick = async () => { await St.startDemo(); boot2(); };
    const lf = $('#loginF');
    if (lf) lf.onsubmit = async e => {
      e.preventDefault(); const am = $('#am'), btn = $('button[type=submit]', lf);
      const L = JSON.parse(localStorage.getItem('yc-admin-lock') || '{"n":0,"until":0}');
      if (L.until > Date.now()) { am.textContent = `Too many tries. Try again in ${Math.ceil((L.until - Date.now()) / 60000)} minutes.`; return; }
      btn.disabled = true; btn.textContent = 'Signing in…'; am.textContent = '';
      const ov = document.createElement('div'), t0 = Date.now(); ov.innerHTML = A.loader('Signing you in…', true); document.body.append(ov);
      try { await St.signIn($('#le').value, $('#lp').value, $('#lk').checked); localStorage.removeItem('yc-admin-lock'); await settle(t0, St.S.user && St.S.user.name); boot2(); }
      catch (err) { L.n++; if (L.n >= 5) { L.until = Date.now() + 15 * 60000; L.n = 0; } localStorage.setItem('yc-admin-lock', JSON.stringify(L)); ov.remove(); am.textContent = err.message; btn.disabled = false; btn.textContent = 'Sign in'; }
    };
    const sf = $('#setupF');
    if (sf) sf.onsubmit = async e => {
      e.preventDefault(); const v = A.read(sf), am = $('#am');
      if (!v.name || !/^\S+@\S+\.\S+$/.test(v.email)) { am.textContent = 'Please enter your name and email'; return; }
      if ((v.pass || '').length < 10) { am.textContent = 'Use a password of at least 10 characters'; return; }
      if (!v.token) { am.textContent = 'Paste the GitHub access key'; return; }
      am.textContent = 'Checking the key…';
      try { await St.setup(v); boot2(); } catch (err) { am.textContent = err.message; }
    };
  }
  function boot2() { shell(); route(); saveSt(); }
  // the loading screen: the lotus draws itself, then breathes (user 2026-11-27)
  const LOTUS = ['M160 190 L160 45 C215 62 268 92 305 132','M600 190 L600 45 C545 62 492 92 455 132','M380 25 C455 115 515 215 515 325 C515 415 455 470 380 485 C305 470 245 415 245 325 C245 215 305 115 380 25 Z','M10 180 C150 172 290 212 345 300 C368 337 380 360 380 385 L380 488 C235 488 125 455 82 382 C52 330 27 258 10 180 Z','M750 180 C610 172 470 212 415 300 C392 337 380 360 380 385 L380 488 C525 488 635 455 678 382 C708 330 733 258 750 180 Z'];
  const ORDER = [2, 3, 4, 0, 1];
  A.loader = (msg, overlay) => `<div class="yc-load${overlay ? ' over' : ''}" role="status" aria-live="polite"><div class="yl-mark"><span class="yl-ring"></span><svg viewBox="-20 -20 800 540" fill="none" stroke="currentColor" stroke-width="22" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${LOTUS.map((d, i) => `<path pathLength="1" d="${d}" style="--d:${ORDER.indexOf(i) * .22}s"/>`).join('')}</svg></div><b>York Cottage</b><small>${msg || 'Loading…'}</small></div>`;
  // keep the loading screen up long enough to read, and greet the person by name (user 2026-11-27)
  const LOAD_MIN = 2400, nap = ms => new Promise(r => setTimeout(r, ms));
  const greet = name => { const b = document.querySelector('.yc-load b'); const f = String(name || '').trim().split(/\s+/)[0]; if (b && f && !/^demo$/i.test(f)) { b.textContent = `Welcome, ${f}`; return true; } return false; };
  async function settle(t0, name) { const fresh = name && !(document.querySelector('.yc-load b') || {}).textContent.startsWith('Welcome') && greet(name); await nap(Math.max(LOAD_MIN - (Date.now() - t0), fresh ? 1400 : 0)); }
  async function boot() {
    const t0 = Date.now();
    document.body.innerHTML = A.loader('Loading…');
    St.sessName().then(greet);
    try { if (await St.resume()) { await settle(t0, St.S.user && St.S.user.name); return boot2(); } } catch (e) { console.error(e); }
    const v = await St.getVault();
    authScreen(v ? 'login' : 'setup');
  }
  A.boot = boot;
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTouch = 0; document.addEventListener('touchend', e => { const t = Date.now(); if (t - lastTouch < 300 && !e.target.closest('input,select,textarea')) e.preventDefault(); lastTouch = t; }, { passive: false });
})();
