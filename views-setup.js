/* Team and set-up screens: Staff, Rota, a therapist's day, Treatments, Spa & sessions, Rooms, Booking types, Date prices. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, gbp, fd, fdy, today, uid, DAYS, DAYS_L, PCOL } = A;
  const V = A.views;
  const clone = o => JSON.parse(JSON.stringify(o));
  const tabs = (base, list, cur) => `<div class="tabs">${list.map(([k, t]) => `<button onclick="location.hash='#/${base}/${k}'" class="${cur === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const hrs = m => (Math.round(m / 6) / 10) + ' h';

  // ============ IMPACT: when a change to staff or closures breaks booked treatments ============
  // returns [{ b, it, why }] for future treatments that no longer fit under cfg2
  A.impacts = (cfg2, filter) => {
    const t = today(), DB = A.DB(), out = [];
    for (const b of DB.bookings.filter(E.live)) {
      if (!(b.items || []).length) continue;
      const last = (b.items || []).reduce((m, i) => (i.date || b.date) > m ? (i.date || b.date) : m, b.date);
      if (last < t) continue;
      const ix = E.index(cfg2, DB.bookings, b.id);
      for (const it of b.items) {
        if ((it.date || b.date) < t || (filter && !filter(b, it))) continue;
        const why = it.staff ? E.itemCheck(cfg2, ix, b, it, { date: it.date || b.date, start: it.start, staff: it.staff, troom: it.troom }) : 'No therapist';
        if (why) out.push({ b, it, why });
      }
    }
    return out;
  };
  // ways to fix one: other therapists at the same time, then other times in the guest's visit
  A.fixOptions = (cfg2, b, it) => {
    const ix = E.index(cfg2, A.DB().bookings, b.id), opts = [];
    for (const st of cfg2.staff.filter(s => s.active !== false && s.id !== it.staff)) {
      for (const r of [it.troom, ...cfg2.treatRooms.map(x => x.id)]) { if (!E.itemCheck(cfg2, ix, b, it, { date: it.date || b.date, start: it.start, staff: st.id, troom: r })) { opts.push({ label: `Hand to ${st.name} at ${it.start}`, date: it.date || b.date, start: it.start, staff: st.id, troom: r }); break; } }
    }
    const step = cfg2.rules.slotStep || 15;
    for (const w of E.windows(cfg2, b)) {
      for (let m = E.T(w[1]); m + it.min <= E.T(w[2]) && opts.length < 8; m += step) {
        if (w[0] === (it.date || b.date) && E.HM(m) === it.start) continue;
        for (const st of cfg2.staff.filter(s => s.active !== false)) {
          const room = cfg2.treatRooms.find(r => !E.itemCheck(cfg2, ix, b, it, { date: w[0], start: E.HM(m), staff: st.id, troom: r.id }));
          if (room) { opts.push({ label: `Move to ${w[0] !== b.date ? fd(w[0]) + ' ' : ''}${E.HM(m)} with ${st.name}`, date: w[0], start: E.HM(m), staff: st.id, troom: room.id }); break; }
        }
      }
    }
    return opts;
  };
  // show the problems and let the user choose; resolves true when the change can go ahead
  A.handleImpacts = async (cfg2, what, filter) => {
    const list = A.impacts(cfg2, filter);
    if (!list.length) return true;
    const rows = list.map((x, i) => ({ ...x, i, opts: A.fixOptions(cfg2, x.b, x.it) }));
    const r = await A.modal({ title: `${list.length} booked treatment${list.length > 1 ? 's' : ''} affected`, size: 'xl', ok: 'Apply and save', cancel: 'Don’t make the change',
      body: `<div class="note warn">${esc(what)} clashes with treatments already booked. Choose what to do with each one. Guests whose times change can be emailed.</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Treatment</th><th>Guest</th><th>Problem</th><th>Do this</th></tr></thead><tbody>
        ${rows.map(x => `<tr><td><b>${fd(x.it.date || x.b.date)} ${x.it.start}</b></td><td>${esc(A.tname(x.it.tid))}<br><span class="small muted">${esc(A.sname(x.it.staff))}</span></td><td><a href="#/booking/${x.b.id}" target="_blank">${esc(A.cust(x.b))}</a><br><span class="small muted">${x.b.ref}</span></td><td class="small">${esc(x.why)}</td>
          <td><select class="inp" data-fix="${x.i}">${x.opts.map((o, j) => `<option value="${j}">${esc(o.label)}</option>`).join('')}${/-inc/.test(x.it.key) ? '' : '<option value="cancel">Cancel this extra treatment (refund it if paid)</option>'}<option value="keep">Leave it and sort it out myself</option><option value="none">Remove the therapist (shows as “No therapist”)</option></select>${x.opts.length ? '' : '<small class="muted">No free therapist or time found</small>'}</td></tr>`).join('')}
        </tbody></table></div>${A.f.chk('mail', 'Email guests whose treatment times change', true)}`,
      onOk: m => ({ choices: $$('[data-fix]', m).map(s => s.value), mail: $('[data-k=mail]', m).checked }) });
    if (!r) return false;
    const touched = new Set();
    rows.forEach((x, i) => {
      const c = r.choices[i]; if (c === 'keep') return;
      if (c === 'cancel') {
        const b = x.b, g = (b.guestList || [])[x.it.guest]; b.items = (b.items || []).filter(i => i !== x.it);
        if (g && g.extras) { const k = g.extras.indexOf(x.it.tid); if (k >= 0) g.extras.splice(k, 1); }
        const was = (b.quote || {}).total; b.quote = E.quote(A.cfg(), b); touched.add(b);
        (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: `Extra treatment ${A.tname(x.it.tid)} at ${x.it.start} cancelled (${what})${was != null && b.quote.total < was ? `: price down ${gbp(was - b.quote.total, 2)}, refund if already paid` : ''}` });
        A.change('booking', b, `Cancelled a treatment on ${b.ref} after: ${what}`); return;
      }
      if (c === 'none') { x.it.staff = null; }
      else { const o = x.opts[+c]; const moved = o.start !== x.it.start || o.date !== (x.it.date || x.b.date); Object.assign(x.it, { date: o.date, start: o.start, staff: o.staff, troom: o.troom }); if (moved) touched.add(x.b); }
      (x.b.history = x.b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: `Treatment ${A.tname(x.it.tid)} ${c === 'none' ? 'left without a therapist' : 'changed to ' + x.it.start + ' with ' + A.sname(x.it.staff)} (${what})` });
      A.change('booking', x.b, `Fixed ${x.b.ref} after: ${what}`);
    });
    if (r.mail) for (const b of touched) if (b.customer && b.customer.email) await A.sendEmail('changed', b, {}, false);
    if (touched.size && r.mail) A.toast(`${touched.size} guest${touched.size > 1 ? 's' : ''} emailed the new times`);
    return true;
  };

  // ============ STAFF ============
  const weekMins = st => Object.values(st.pattern || {}).reduce((a, d) => a + E.shiftsOf(d).reduce((x, s) => x + E.T(s.end) - E.T(s.start), 0), 0);
  const holidayUsed = (st, year) => (st.off || []).filter(o => o.kind === 'holiday' && !o.start).reduce((n, o) => { let c = 0; for (let d = o.from; d <= (o.to || o.from); d = E.addD(d, 1)) if (d.startsWith(year) && E.shiftsOf((st.pattern || {})[E.dow(d)]).length) c++; return n + c; }, 0);
  V.staff = () => {
    const cfg = A.cfg(), t = today(), y = t.slice(0, 4);
    return { html: `<div class="vh"><div><div class="eyebrow">Team</div><h1>Staff</h1><p>Therapists and the team: what they can do, when they work, their breaks and time off.</p></div><div class="acts"><a class="btn" href="#/rota">${A.ic.rota} Rota</a><button class="btn pri" id="addSt">${A.ic.plus} Add a person</button></div></div>
      <div class="grid g3">${cfg.staff.slice().sort(E.byPriority).map(st => { const tr = (st.treatments || []).length, all = cfg.treatments.filter(x => x.active !== false).length, wk = weekMins(st);
        return `<div class="card" style="${st.active === false ? 'opacity:.55' : ''}"><div style="display:flex;gap:12px;align-items:center"><span class="av" style="${A.avStyle(st, 'width:44px;height:44px;font-size:15px')}">${A.initials(st.name)}</span><div style="flex:1"><h3>${esc(st.name)}</h3><span class="muted small">${esc(st.role || '')}${st.active === false ? ' · inactive' : ''}</span></div></div>
          <div class="hr"></div><dl class="kv" style="grid-template-columns:110px 1fr;font-size:13.5px"><dt>Fill order</dt><dd>${st.cover ? 'Cover only (when the others are full)' : (cfg.rules.share || 'fill') === 'fill' ? (() => { const ord = cfg.staff.filter(s => s.active !== false && !s.cover && (s.treatments || []).length).sort(E.byPriority), i = ord.findIndex(s => s.id === st.id); return i < 0 ? 'Not booked online (no treatments)' : i === 0 ? 'First: their day is filled before anyone else’s' : `${['', '2nd', '3rd'][i] || (i + 1) + 'th'}: once ${esc(ord[i - 1].name)} is full`; })() : 'Shared ' + (cfg.rules.share === 'week' ? 'fairly across the week' : 'evenly on the day')}</dd><dt>Treatments</dt><dd>${tr === all ? 'All treatments' : tr ? tr + ' of ' + all : 'None (not a therapist)'}</dd><dt>Duties</dt><dd>${(st.duties || ['food']).includes('food') ? 'Food service' : '—'}</dd>
          <dt>Usual week</dt><dd>${[1, 2, 3, 4, 5, 6, 0].filter(d => E.shiftsOf((st.pattern || {})[d]).length).map(d => DAYS[d]).join(' ') || 'No set days'} · ${hrs(wk)}</dd><dt>Holiday ${y}</dt><dd>${holidayUsed(st, y)} of ${st.holidayDays || 28} days booked</dd>${A.can('users') ? `<dt>Sign-in</dt><dd class="signin" data-signin="${st.id}"><span class="muted">Checking…</span></dd>` : ''}</dl>
          <div class="staff-acts"><button class="btn sm" data-edit="${st.id}">${A.ic.edit} Edit</button><button class="btn sm" data-off="${st.id}">Time off</button><a class="btn sm" href="#/staffday/${st.id}/${t}">${A.ic.today} Their day</a></div></div>`; }).join('')}</div>`,
      wire: el => {
        if (A.can('users')) St.users().then(v => { const us = (v && v.users) || []; $$('[data-signin]', el).forEach(sp => { const sid = sp.dataset.signin, u = us.find(x => x.staffId === sid), st = A.cfg().staff.find(x => x.id === sid) || {};
          sp.innerHTML = u ? `<span class="badge ok" title="Signs in as ${esc(u.name)}">✓ Can sign in</span>` : `<span class="muted">Not set up</span> · <button type="button" class="linkbtn" data-mkuser="${sid}">Set up their sign-in</button>`;
          const b = sp.querySelector('[data-mkuser]'); if (b) b.onclick = () => A.addUserDialog({ name: st.name, email: st.email || '', role: 'therapist', staffId: sid }); }); }).catch(() => {});
        $('#addSt', el).onclick = () => editStaff(null);
        $$('[data-edit]', el).forEach(b => b.onclick = () => editStaff(cfg.staff.find(s => s.id === b.dataset.edit)));
        $$('[data-off]', el).forEach(b => b.onclick = () => timeOff(cfg.staff.find(s => s.id === b.dataset.off)));
      } };
  };
  const PALETTE = ['#b4785a', '#5d7a63', '#7c6a9a', '#4f7c8a', '#a0603a', '#6b7f3a', '#8a5a7a', '#3e6a6a'];
  const patternEditor = (st) => `<div class="fld"><span>Usual working week</span><small>Add more than one shift for split days. Lunch and breaks follow the break rules (set breaks are optional).</small></div>
    <div class="tbl-wrap"><table class="tbl" id="patT"><tbody>${[1, 2, 3, 4, 5, 6, 0].map(d => { const day = (st.pattern || {})[d], sh = E.shiftsOf(day);
      return `<tr data-dow="${d}"><td style="width:60px"><label class="sw"><input type="checkbox" class="pOn" ${sh.length ? 'checked' : ''}> ${DAYS[d]}</label></td><td><div class="pShifts" style="display:flex;flex-direction:column;gap:6px">${(sh.length ? sh : [{ start: '09:00', end: '17:00' }]).map(x => `<div class="pSh" style="display:flex;gap:6px;align-items:center"><input type="time" class="inp" style="width:120px" value="${x.start}" step="300"><span>to</span><input type="time" class="inp" style="width:120px" value="${x.end}" step="300"><button type="button" class="icon-btn pRm" title="Remove this shift">${A.ic.x}</button></div>`).join('')}</div><button type="button" class="btn sm ghost pAdd" style="margin-top:4px">+ another shift</button></td>
        <td style="width:220px"><div class="pBr">${(day && day.breaks || []).map(b => `<div class="pB" style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><span class="small">Break</span><input type="time" class="inp" style="width:110px" value="${b.start}" step="300"><input type="number" class="inp" style="width:70px" value="${b.min}" min="5"><span class="small">min</span><button type="button" class="icon-btn pBrm">${A.ic.x}</button></div>`).join('')}</div><button type="button" class="btn sm ghost pBadd">+ set break</button></td></tr>`; }).join('')}</tbody></table></div>`;
  const wirePattern = m => {
    m.addEventListener('click', e => {
      const add = e.target.closest('.pAdd'); if (add) { const box = $('.pShifts', add.closest('td')); box.insertAdjacentHTML('beforeend', `<div class="pSh" style="display:flex;gap:6px;align-items:center"><input type="time" class="inp" style="width:120px" value="17:00" step="300"><span>to</span><input type="time" class="inp" style="width:120px" value="21:00" step="300"><button type="button" class="icon-btn pRm">${A.ic.x}</button></div>`); }
      const rm = e.target.closest('.pRm'); if (rm) { const box = rm.closest('.pShifts'); if ($$('.pSh', box).length > 1) rm.closest('.pSh').remove(); else rm.closest('tr').querySelector('.pOn').checked = false; }
      const ba = e.target.closest('.pBadd'); if (ba) $('.pBr', ba.closest('td')).insertAdjacentHTML('beforeend', `<div class="pB" style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><span class="small">Break</span><input type="time" class="inp" style="width:110px" value="13:00" step="300"><input type="number" class="inp" style="width:70px" value="30" min="5"><span class="small">min</span><button type="button" class="icon-btn pBrm">${A.ic.x}</button></div>`);
      const br = e.target.closest('.pBrm'); if (br) br.closest('.pB').remove();
    });
  };
  const readPattern = m => { const out = {}; $$('#patT tr', m).forEach(tr => { if (!$('.pOn', tr).checked) return; const shifts = $$('.pSh', tr).map(x => { const [a, b] = $$('input', x); return { start: a.value, end: b.value }; }).filter(x => x.start && x.end && x.end > x.start); const breaks = $$('.pB', tr).map(x => { const [a, b] = $$('input', x); return { start: a.value, min: +b.value || 30 }; }).filter(x => x.start); if (shifts.length) out[tr.dataset.dow] = { shifts, breaks }; }); return out; };
  // legal & practical checks on a working pattern
  A.patternWarnings = (cfg, st) => {
    const w = [], r = E.breakRules(cfg, st), P = st.pattern || {};
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const sh = E.shiftsOf(P[d]); if (!sh.length) continue;
      const len = sh.reduce((a, s) => a + E.T(s.end) - E.T(s.start), 0); total += len;
      const first = Math.min(...sh.map(s => E.T(s.start))), last = Math.max(...sh.map(s => E.T(s.end)));
      if (len > 360 && E.T(r.lunchTo) - E.T(r.lunchFrom) < r.lunchMin) w.push(`${DAYS_L[d]}: over 6 hours needs a break of at least 20 minutes`);
      if (len > 360 && (last <= E.T(r.lunchFrom) || first >= E.T(r.lunchTo))) w.push(`${DAYS_L[d]}: over 6 hours, but the shift is outside the lunch window (${r.lunchFrom}–${r.lunchTo})`);
      const nx = E.shiftsOf(P[(d + 1) % 7]); if (nx.length) { const ns = Math.min(...nx.map(s => E.T(s.start))); if (ns + 1440 - last < 660) w.push(`${DAYS_L[d]} to ${DAYS_L[(d + 1) % 7]}: less than 11 hours’ rest between shifts`); }
    }
    if (total > 48 * 60) w.push(`${hrs(total)} a week is over the 48-hour average limit (unless they’ve opted out in writing)`);
    return w;
  };
  async function editStaff(st0) {
    const cfg = A.cfg(), st = st0 ? clone(st0) : { id: uid('s'), name: '', role: 'Spa therapist', colour: PALETTE[cfg.staff.length % PALETTE.length], email: '', phone: '', active: true, treatments: cfg.treatments.map(t => t.id), duties: ['food'], pattern: {}, holidayDays: 28, maxHands: cfg.rules.maxHandsOn };
    const cats = [...new Set(cfg.treatments.map(t => t.cat))];
    const br = st.breakRules || {};
    const r = await A.modal({ title: st0 ? 'Edit ' + esc(st0.name) : 'Add a person', size: 'xl', body: `
      <div class="row r4">${A.f.text('name', 'Name', st.name)}${A.f.text('role', 'Job title', st.role)}${A.f.text('email', 'Email', st.email, { type: 'email' })}${A.f.text('phone', 'Phone', st.phone, { type: 'tel' })}</div>
      <div class="row r4"><div class="fld"><span>Picture</span><span style="display:flex;gap:8px;align-items:center"><span class="av" id="stPh" style="${A.avStyle(st, 'width:40px;height:40px')}">${A.initials(st.name || '?')}</span><button type="button" class="btn sm" id="stPhUp">Upload</button>${A.staffPhoto(st) ? '<button type="button" class="btn sm ghost" id="stPhRm">Remove</button>' : ''}</span></div><div class="fld">${A.f.sw('cover', 'Cover only: book them just when the regular therapists are full (e.g. someone you bring in for busy days)', !!st.cover)}</div><label class="fld"><span>Colour</span><input type="color" class="inp" data-k="colour" value="${st.colour}" style="height:38px;padding:3px"></label>${A.f.num('maxHands', 'Most hands-on minutes a day', st.maxHands || cfg.rules.maxHandsOn, { hint: '4–6 hours (240–360) is good practice' })}${A.f.num('holidayDays', 'Holiday days a year', st.holidayDays || 28, { hint: '28 = 5.6 weeks full time' })}<div class="fld"><span>&nbsp;</span>${A.f.sw('active', 'Active', st.active !== false)}</div></div>
      <div class="fld"><span>Treatments they can do</span><div style="display:flex;gap:8px;margin-bottom:6px"><button type="button" class="btn sm" id="trAll">All</button><button type="button" class="btn sm" id="trNone">None</button></div>
        ${cats.map(c => `<div style="margin-bottom:8px"><div class="small muted" style="margin-bottom:4px">${esc(c)}</div><div class="chips" data-k="tr_${c.replace(/\W/g, '')}" data-t="list">${cfg.treatments.filter(t => t.cat === c).map(t => `<button type="button" class="chip sm ${(st.treatments || []).includes(t.id) ? 'on' : ''}" data-v="${t.id}">${esc(t.name)}</button>`).join('')}</div></div>`).join('')}</div>
      ${A.f.chips('duties', 'Other duties', st.duties || ['food'], [['food', 'Food service (spa lunch, grazing boards)']])}
      ${patternEditor(st)}
      <details ${st.breakRules ? 'open' : ''}><summary class="btn sm ghost" style="display:inline-flex">Their own break rules (leave blank to use Settings)</summary>
        <div class="row r4" style="margin-top:10px">${A.f.num('br.lunchMin', 'Lunch: shortest (min)', br.lunchMin)}${A.f.num('br.lunchMax', 'Lunch: longest (min)', br.lunchMax)}${A.f.time('br.lunchFrom', 'Lunch window from', br.lunchFrom || '')}${A.f.time('br.lunchTo', 'Lunch window to', br.lunchTo || '')}
        ${A.f.num('br.breakMin', 'Break: shortest (min)', br.breakMin)}${A.f.num('br.breakMax', 'Break: longest (min)', br.breakMax)}${A.f.num('br.maxWithoutBreak', 'Most minutes without a break', br.maxWithoutBreak)}</div></details>
      <div id="pw"></div>`,
      foot: st0 ? '<button class="btn danger" data-del style="margin-right:auto">Remove</button>' : '',
      onOpen: (m, close) => {
        { const up = $('#stPhUp', m), rm = $('#stPhRm', m), av = $('#stPh', m);
          if (up) up.onclick = async () => { const d = await A.pickPhoto(); if (!d) return; A.setPhoto('staff:' + st.id, d, 'Profile picture updated: ' + (st.name || 'staff')); av.style.backgroundImage = `url(${d})`; av.style.backgroundSize = 'cover'; av.style.color = 'transparent'; };
          if (rm) rm.onclick = () => { A.setPhoto('staff:' + st.id, null, 'Profile picture removed: ' + (st.name || 'staff')); av.style.backgroundImage = ''; av.style.color = ''; rm.remove(); }; }
        wirePattern(m);
        $('#trAll', m).onclick = () => $$('[data-k^=tr_] .chip', m).forEach(c => c.classList.add('on'));
        $('#trNone', m).onclick = () => $$('[data-k^=tr_] .chip', m).forEach(c => c.classList.remove('on'));
        const warn = () => { const tmp = { ...st, pattern: readPattern(m) }; const w = A.patternWarnings(cfg, tmp); $('#pw', m).innerHTML = w.length ? `<div class="note warn">${w.map(esc).join('<br>')}</div>` : ''; };
        m.addEventListener('change', warn); m.addEventListener('click', () => setTimeout(warn)); warn();
        const del = $('[data-del]', m); if (del) del.onclick = async () => {
          const used = A.DB().bookings.filter(b => E.live(b) && b.date >= today() && (b.items || []).some(i => i.staff === st.id));
          if (used.length) { A.toast(`${st0.name} has ${used.length} future booking${used.length > 1 ? 's' : ''}. Make them inactive instead, then reassign.`); return; }
          if (await A.confirm('Remove ' + esc(st0.name) + '?', 'Their past treatments keep their name in the history.', 'Remove')) { cfg.staff = cfg.staff.filter(s => s.id !== st.id); A.change('cfg', null, 'Staff removed: ' + st0.name); close(); A.refresh(); }
        };
      },
      onOk: m => { const v = A.read(m); if (!v.name) throw new Error('Add their name');
        const tr = Object.keys(v).filter(k => k.startsWith('tr_')).flatMap(k => v[k]);
        const brv = Object.fromEntries(Object.entries(v.br || {}).filter(([, x]) => x !== null && x !== ''));
        return { ...st, cover: !!v.cover, name: v.name, role: v.role, email: v.email, phone: v.phone, colour: v.colour, maxHands: v.maxHands, holidayDays: v.holidayDays, active: v.active, treatments: tr, duties: v.duties, pattern: readPattern(m), breakRules: Object.keys(brv).length ? brv : undefined }; } });
    if (!r) return;
    const cfg2 = clone(cfg); const i = cfg2.staff.findIndex(s => s.id === r.id); if (i >= 0) cfg2.staff[i] = r; else cfg2.staff.push(r);
    if (!(await A.handleImpacts(cfg2, `Changing ${r.name}’s details`, (b, it) => it.staff === r.id))) return;
    const j = cfg.staff.findIndex(s => s.id === r.id); if (j >= 0) cfg.staff[j] = r; else cfg.staff.push(r);
    A.change('cfg', null, (st0 ? 'Staff updated: ' : 'Staff added: ') + r.name); A.toast('Saved'); A.refresh();
  }
  async function timeOff(st, pre = {}) {
    const cfg = A.cfg(), list = st.off || [], others = cfg.staff.filter(s => s.id !== st.id && s.active !== false && (s.treatments || []).length);
    const r = await A.modal({ title: 'Time off · ' + esc(st.name), size: 'wide', ok: 'Add time off', body: `
      ${list.length ? `<table class="tbl"><tbody>${list.slice().sort((a, b) => b.from.localeCompare(a.from)).map((o, i) => `<tr><td>${fd(o.from)}${o.to && o.to !== o.from ? ' – ' + fd(o.to) : ''}${o.start ? ` ${o.start}–${o.end}` : ''}</td><td><span class="badge">${esc(o.kind || 'other')}</span> ${esc(o.reason || '')}</td><td class="r"><button type="button" class="btn sm ghost" data-rmoff="${list.indexOf(o)}">Remove</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No time off booked.</p>'}
      <div class="hr"></div><div class="row r4">${A.f.date('from', 'From', today())}${A.f.date('to', 'To (inclusive)', today())}${A.f.sel('kind', 'Type', pre.kind || 'holiday', [['holiday', 'Holiday'], ['sick', 'Sickness'], ['training', 'Training'], ['other', 'Other']])}${A.f.text('reason', 'Note', '')}</div>
      <div class="row r4">${A.f.time('start', 'Part of the day: from', '', { hint: 'Leave blank for whole days' })}${A.f.time('end', 'to', '')}</div>
      <div class="row r2">${A.f.sel('coverId', 'A colleague covering (works the same hours on those days)', '', [['', 'Nobody: I’ll sort the treatments next']].concat(others.map(s => [s.id, s.name + (s.cover ? ' (cover)' : '')])))}</div>
      <p class="small muted">${holidayUsed(st, today().slice(0, 4))} of ${st.holidayDays || 28} holiday days booked this year.</p>`,
      onOpen: (m, close) => $$('[data-rmoff]', m).forEach(b => b.onclick = () => { st.off.splice(+b.dataset.rmoff, 1); A.change('cfg', null, 'Time off removed: ' + st.name); close(); timeOff(st); }),
      onOk: m => { const v = A.read(m); if (!v.from) throw new Error('Choose the dates'); if (v.to && v.to < v.from) throw new Error('The end is before the start'); return v; } });
    if (!r) return;
    const o = { from: r.from, to: r.to || r.from, kind: r.kind, reason: r.reason }; if (r.start && r.end) { o.start = r.start; o.end = r.end; }
    const cfg2 = clone(cfg); const s2 = cfg2.staff.find(s => s.id === st.id); (s2.off = s2.off || []).push(o);
    // a colleague covering works the same hours on those days (if they aren't already working), so treatments can go straight to them
    const cover = r.coverId && cfg.staff.find(s => s.id === r.coverId), shifts = {};
    if (cover && !o.start) for (let d = o.from; d <= o.to; d = E.addD(d, 1)) { const mine = st.shifts && d in st.shifts ? st.shifts[d] : (st.pattern || {})[E.dow(d)], c2 = cfg2.staff.find(s => s.id === cover.id); if (E.shiftsOf(mine).length && !E.staffDay(cfg, cover, d)) { shifts[d] = clone(mine); (c2.shifts = c2.shifts || {})[d] = clone(mine); } }
    if (!(await A.handleImpacts(cfg2, `${st.name}’s ${o.kind === 'sick' ? 'sick leave' : 'time off'}${cover ? ` (${cover.name} covering)` : ''}`, (b, it) => it.staff === st.id))) return;
    (st.off = st.off || []).push(o); if (cover) Object.entries(shifts).forEach(([d, sh]) => { (cover.shifts = cover.shifts || {})[d] = sh; });
    A.change('cfg', null, `${o.kind === 'sick' ? 'Sickness' : 'Time off'} for ${st.name}: ${o.from} to ${o.to}${cover ? `; ${cover.name} covering` : ''}`); A.toast(o.kind === 'sick' ? 'Sickness recorded' : 'Time off added'); A.refresh();
  }
  A.timeOff = timeOff;

  // ============ ROTA (week) ============
  V.rota = (start) => {
    const cfg = A.cfg(), DB = A.DB(), t = today();
    let mon = start || t; while (E.dow(mon) !== 1) mon = E.addD(mon, -1);
    const days = Array.from({ length: 7 }, (_, i) => E.addD(mon, i)), ixAll = E.index(cfg, DB.bookings);
    const me = !A.can('staff.view') ? A.myStaff() : null;
    const staff = cfg.staff.filter(s => s.active !== false && (!me || s.id === me));
    const cell = (st, d) => {
      const day = E.staffDay(cfg, st, d), list = (ixAll.staff[d] || {})[st.id] || [], hands = list.filter(x => x[3] !== 'duty').reduce((a, x) => a + (x[2] || 0), 0), duty = list.filter(x => x[3] === 'duty');
      const off = (st.off || []).find(o => o.from <= d && d <= (o.to || o.from) && !o.start), over = st.shifts && d in st.shifts;
      if (!day) return `<td class="off" data-cell="${st.id}|${d}">${off ? `<span class="badge">${esc(off.kind)}</span>` : 'Off'}${list.length ? '<br><span class="badge bad">Has bookings!</span>' : ''}</td>`;
      const cap = st.maxHands || cfg.rules.maxHandsOn;
      const needed = list.length > 0;
      return `<td data-cell="${st.id}|${d}" class="${d < t ? 'past' : ''} ${needed ? '' : 'notneeded'}" style="cursor:pointer" title="${d < t ? 'This day has passed' : 'Change hours for this day'}"><span class="sh">${day.spans.map(s => E.HM(s[0]) + '–' + E.HM(s[1])).join('<br>')}</span>${over ? ' <span class="badge info" title="Changed for this day">changed</span>' : ''}<span class="need ${needed ? 'yes' : ''}">${needed ? 'Needed' : 'Not needed yet'}</span>
        <span class="ld"><i style="width:${Math.min(100, hands / cap * 100)}%;background:${hands > cap * .9 ? 'var(--warn)' : st.colour}"></i></span><span class="small muted">${hrs(hands)} treatments${duty.length ? ' · food service' : ''}</span></td>`;
    };
    return { html: `<div class="vh"><div><div class="eyebrow">Team</div><h1>Rota</h1><p>Week of ${fdy(mon)}. ${me ? '' : 'Click a day to change someone’s hours just for that day.'}</p></div>
      <div class="acts"><a class="btn" href="#/rota/${E.addD(mon, -7)}">${A.ic.left}</a><a class="btn" href="#/rota">This week</a><a class="btn" href="#/rota/${E.addD(mon, 7)}">${A.ic.right}</a><button class="btn" onclick="print()">${A.ic.print}</button></div></div>
      ${!me && A.staffingCard && A.can('staff.edit') ? A.staffingCard() : ''}
      <div class="rota card flush"><table><thead><tr><th>Who</th>${days.map(d => `<th${d === t ? ' style="color:var(--clay)"' : ''}>${fd(d)}</th>`).join('')}<th>Week</th></tr></thead><tbody>
      ${!me ? `<tr class="need-row"><td><b>Therapists needed</b><br><span class="small muted">with treatments or food cover</span></td>${days.map(d => { const working = staff.filter(st => E.staffDay(cfg, st, d)).length, needed = staff.filter(st => ((ixAll.staff[d] || {})[st.id] || []).length).length; return `<td><b>${needed}</b> <span class="small muted">of ${working} working</span>${d >= t && A.coverChip ? A.coverChip(d) : ''}</td>`; }).join('')}<td></td></tr>` : ''}
      ${staff.slice().sort(E.byPriority).map(st => { const tot = days.reduce((a, d) => { const x = E.staffDay(cfg, st, d); return a + (x ? x.spans.reduce((y, s) => y + s[1] - s[0], 0) : 0); }, 0);
        return `<tr><td><span class="dot" style="background:${st.colour}"></span> <b>${esc(st.name)}</b><br><span class="small muted">${esc(st.role || '')}</span></td>${days.map(d => cell(st, d)).join('')}<td class="tnum">${hrs(tot)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <h3 style="margin:22px 0 8px">Food service cover</h3><div class="card flush"><table class="tbl"><thead><tr><th>Service</th>${days.map(d => `<th>${fd(d)}</th>`).join('')}</tr></thead><tbody>
      ${(cfg.services || []).filter(s => s.active !== false).map(sv => `<tr><td><b>${esc(sv.name)}</b></td>${days.map(d => { const who = ((ixAll.duty[d] || {})[sv.id]), n = ((ixAll.food[d] || {})[sv.id]) || 0; return `<td class="small">${n ? `${n} guest${n > 1 ? 's' : ''}<br>${who && who.length ? who.map(A.sname).map(esc).join(', ') : '<span class="badge bad">Nobody free</span>'}` : '<span class="muted">—</span>'}${!me && n ? `<br><button class="btn sm ghost" data-duty="${sv.id}|${d}">Change</button>` : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>`,
      wire: el => {
        if (!me) $$('[data-cell]', el).forEach(c => c.onclick = () => { const [sid, d] = c.dataset.cell.split('|'); A.dayShift(cfg.staff.find(s => s.id === sid), d); });
        $$('[data-duty]', el).forEach(b => b.onclick = () => { const [sv, d] = b.dataset.duty.split('|'); A.pickDuty(sv, d); });
      } };
  };
  // change one person's hours for one date (or give them the day off)
  A.dayShift = async (st, d) => {
    if (d < today()) { A.toast('That day has passed. Hours can only be changed for today and later.'); return; }
    const cfg = A.cfg(), cur = st.shifts && d in st.shifts ? st.shifts[d] : (st.pattern || {})[E.dow(d)];
    const tmp = { pattern: { [E.dow(d)]: cur } };
    // one day only (user 2026-11-27): working or off, the hours, and what's booked; their usual week is untouched
    const usual = (st.pattern || {})[E.dow(d)], changed = !!(st.shifts && d in st.shifts), sh = E.shiftsOf(cur), brk = (cur && cur.breaks) || [];
    const hrs = x => E.shiftsOf(x).map(y => `${y.start}–${y.end}`).join(' and ') || 'not working';
    const booked = A.DB().bookings.filter(E.live).flatMap(b => (b.items || []).filter(it => it.staff === st.id && (it.date || b.date) === d)).length;
    const row = (a = '', b = '') => `<div class="ds-sh"><input type="time" class="inp" value="${a}" step="300"><span>to</span><input type="time" class="inp" value="${b}" step="300"><button type="button" class="btn sm ghost ds-x" aria-label="Remove">✕</button></div>`;
    const r = await A.modal({ title: `${esc(st.name)} · ${fdy(d)}`, ok: booked ? 'Next' : 'Save', body: `
      <p class="muted" style="margin-bottom:12px">Changes this date only. Usually ${E.shiftsOf(usual).length ? 'works ' + hrs(usual) : 'off'} on ${E.DAYS_L ? '' : ''}${fdy(d).split(',')[0]}s.${changed ? ' <b>This day has already been changed.</b>' : ''}</p>
      <div class="ds-pick" id="dsPick"><button type="button" data-m="work" class="${sh.length ? 'on' : ''}"><b>Working</b><small>Set the hours</small></button><button type="button" data-m="off" class="${sh.length ? '' : 'on'}"><b>Day off</b><small>Not working this day</small></button></div>
      <div id="dsWork" ${sh.length ? '' : 'hidden'}><div class="ds-lbl">Hours</div><div id="dsShifts">${(sh.length ? sh : [{ start: '09:00', end: '17:00' }]).map(x => row(x.start, x.end)).join('')}</div>
        <button type="button" class="btn sm ghost" id="dsAdd">+ Split the day (add another shift)</button>
        <div class="ds-lbl" style="margin-top:12px">Set break <span class="muted" style="font-weight:400">(optional; otherwise breaks follow the break rules)</span></div>
        <div class="ds-sh"><input type="time" class="inp" id="dsB" value="${(brk[0] || {}).start || ''}" step="300"><span>for</span><input type="number" class="inp" id="dsBm" value="${(brk[0] || {}).min || 30}" min="10" max="90" style="width:80px"><span>minutes</span></div></div>
      ${booked ? `<p class="note warn" style="margin-top:12px">${booked} treatment${booked > 1 ? 's' : ''} booked with ${esc(st.name.split(' ')[0])} this day. If the new hours clash, you’ll choose what to do with ${booked > 1 ? 'them' : 'it'} on the next screen before anything is saved.</p>` : ''}
      <p class="small" style="margin-top:12px">Off sick or on holiday? <a href="#" id="dsOff">Record time off instead</a>, so it shows on their record.${changed ? ` · <a href="#" id="dsReset">Go back to their usual hours</a>` : ''}</p>`,
      onOpen: (m, close) => {
        let mode = sh.length ? 'work' : 'off';
        $$('#dsPick button', m).forEach(b => b.onclick = () => { mode = b.dataset.m; $$('#dsPick button', m).forEach(x => x.classList.toggle('on', x === b)); $('#dsWork', m).hidden = mode !== 'work'; });
        const wireX = () => $$('.ds-x', m).forEach(x => x.onclick = () => { if ($$('#dsShifts .ds-sh', m).length > 1) x.closest('.ds-sh').remove(); });
        $('#dsAdd', m).onclick = () => { $('#dsShifts', m).insertAdjacentHTML('beforeend', row()); wireX(); }; wireX();
        $('#dsOff', m).onclick = e => { e.preventDefault(); close(); A.timeOff(st, {}); };
        const rs = $('#dsReset', m); if (rs) rs.onclick = e => { e.preventDefault(); m._reset = true; $('[data-ok]', m.closest('.modal') || m) ? $('[data-ok]', m.closest('.modal') || m).click() : null; };
        m._mode = () => m._reset ? 'reset' : mode;
      },
      onOk: m => { const mode = m._mode(); if (mode === 'reset') return { reset: true }; if (mode === 'off') return { day: null };
        const shifts = $$('#dsShifts .ds-sh', m).map(x => { const [a, b] = $$('input', x); return { start: a.value, end: b.value }; }).filter(x => x.start || x.end);
        if (!shifts.length || shifts.some(x => !x.start || !x.end || x.end <= x.start)) throw new Error('Check the hours: each shift needs a start and a later end');
        const sorted = shifts.slice().sort((a, b) => a.start.localeCompare(b.start)); if (sorted.some((x, k) => k && x.start < sorted[k - 1].end)) throw new Error('The shifts overlap');
        const b0 = $('#dsB', m).value, breaks = b0 ? [{ start: b0, min: +$('#dsBm', m).value || 30 }] : [];
        return { day: { shifts: sorted, breaks } }; } });
    if (!r) return;
    const cfg2 = clone(cfg), s2 = cfg2.staff.find(s => s.id === st.id); s2.shifts = s2.shifts || {};
    if (r.reset) delete s2.shifts[d]; else s2.shifts[d] = r.day;
    if (!(await A.handleImpacts(cfg2, `Changing ${st.name}’s hours on ${fd(d)}`, (b, it) => it.staff === st.id && (it.date || b.date) === d))) return;
    st.shifts = st.shifts || {}; if (r.reset) delete st.shifts[d]; else st.shifts[d] = r.day;
    A.change('cfg', null, `Hours for ${st.name} on ${d} ${r.reset ? 'reset' : r.day ? 'changed' : 'set to a day off'}`); A.toast('Saved'); A.refresh();
  };
  A.pickDuty = async (svId, d) => {
    const cfg = A.cfg(), sv = E.service(cfg, svId, d), ix = E.index(cfg, A.DB().bookings), cur = (ix.duty[d] || {})[svId] || [];
    const cands = cfg.staff.filter(s => s.active !== false && E.staffDay(cfg, s, d));
    const r = await A.modal({ title: `${esc(sv.name)} · ${fd(d)}`, body: `<p class="muted">${sv.start}–${sv.end}. At least ${Math.max(1, sv.staff || 1)} person. Whoever serves can’t be booked for treatments then.</p>${A.f.chips('who', 'Who serves', cur, cands.map(s => [s.id, s.name]))}${A.f.chk('auto', 'Let the system choose (least busy person)', !(((cfg.serviceAssign || {})[d] || {})[svId]))}`,
      onOk: m => { const v = A.read(m); if (!v.auto && v.who.length < Math.max(1, sv.staff || 1)) throw new Error(`Choose at least ${Math.max(1, sv.staff || 1)}`); return v; } });
    if (!r) return;
    const cfg2 = clone(cfg); cfg2.serviceAssign = cfg2.serviceAssign || {}; cfg2.serviceAssign[d] = cfg2.serviceAssign[d] || {};
    if (r.auto) delete cfg2.serviceAssign[d][svId]; else cfg2.serviceAssign[d][svId] = r.who;
    if (!(await A.handleImpacts(cfg2, `${sv.name} cover on ${fd(d)}`, (b, it) => (it.date || b.date) === d))) return;
    cfg.serviceAssign = cfg2.serviceAssign; A.change('cfg', null, `${sv.name} on ${d}: ${r.auto ? 'automatic' : r.who.map(A.sname).join(', ')}`); A.refresh();
  };

  // ============ A THERAPIST'S DAY (therapists can move and hand over their own treatments) ============

  // ---------- a therapist's own to-do list for a day (user, 2026-11-26) ----------
  // food service called out first, then "pick up <guest> for <treatment> in <room>" in time order. Ticks are saved
  // with the team's tasks (tasks.json, under ticks), so they're the same on every device.
  A.myDay = (sid, d) => {
    const cfg = A.cfg(), DB = A.DB(), st = cfg.staff.find(s => s.id === sid); if (!st) return null;
    const ix = E.index(cfg, DB.bookings), list = (ix.staff[d] || {})[sid] || [];
    const duty = list.filter(x => x[3] === 'duty').map(x => { const sv = E.service(cfg, x[4], d) || {}; return { key: 'duty-' + x[4], s: x[0], e: x[1], name: sv.name || 'Food service', guests: ((ix.food[d] || {})[x[4]]) || 0 }; });
    const room = id => (cfg.treatRooms.find(r => r.id === id) || {}).name || 'the treatment room';
    const who = i => (i.b.guestList[i.guest] || {}).name || (i.guest === 0 ? A.cust(i.b) : `Guest ${i.guest + 1} of ${A.cust(i.b)}`);
    const treats = DB.bookings.filter(E.live).flatMap(b => (b.items || []).filter(i => i.staff === sid && (i.date || b.date) === d).map(i => ({ ...i, b })));
    const todo = [
      ...duty.map(x => ({ key: x.key, at: x.s, text: `${x.name}: serve ${x.guests} guest${x.guests === 1 ? '' : 's'}, ${E.HM(x.s)}–${E.HM(x.e)}`, food: x.key.replace(/^duty-/, ''), sub: A.foodList ? A.foodList(d, x.key.replace(/^duty-/, '')).summary : '' })),
      ...treats.map(i => ({ key: i.b.id + '|' + i.key, at: E.T(i.start), text: `Pick up ${who(i)} for ${A.iname(i)} in ${room(i.troom)}`, sub: `${i.min} min${(i.b.guestList[i.guest] || {}).consult === 'done' ? '' : ' · consultation form needed'}${(i.b.tags || []).length ? ' · ' + i.b.tags.join(', ') : ''}`, bid: i.b.id })),
    ].sort((a, b) => a.at - b.at);
    const T = DB.tasks = DB.tasks || { items: [], hidden: {} }; T.ticks = T.ticks || {};
    return { st, duty, todo, ticks: T.ticks[sid + '|' + d] || {} };
  };
  A.myDayCard = (sid, d, { self = false } = {}) => {
    const m = A.myDay(sid, d); if (!m) return '';
    const you = self ? 'You’re' : `${esc(m.st.name)} is`, left = m.todo.filter(x => !m.ticks[x.key]).length;
    return `${m.duty.length ? `<div class="note warn food-call" style="margin-bottom:12px"><b>🍽 ${you} on food service ${d === today() ? 'today' : 'this day'}:</b> ${m.duty.map(x => `${esc(x.name)} ${E.HM(x.s)}–${E.HM(x.e)} for ${x.guests} guest${x.guests === 1 ? '' : 's'}`).join('; ')}. No treatments are booked for ${self ? 'you' : 'them'} during it.</div>` : ''}
      <div class="card myday" data-myday="${sid}|${d}"><div class="card-h"><h3>${self ? 'My to-do list' : `${esc(m.st.name)}’s to-do list`}</h3><span class="muted small">${m.todo.length ? `${left} of ${m.todo.length} left` : ''}</span></div>
        ${m.todo.length ? `<div class="list">${m.todo.map(x => `<label class="li md-item ${m.ticks[x.key] ? 'done' : ''} ${x.food ? 'food' : ''}"><input type="checkbox" data-tick="${esc(x.key)}" ${m.ticks[x.key] ? 'checked' : ''}><span class="when">${E.HM(x.at)}</span><span class="grow"><b>${esc(x.text)}</b>${x.sub ? `<span class="small muted" style="display:block">${esc(x.sub)}</span>` : ''}</span>${x.bid ? `<a class="btn sm ghost" href="#/booking/${x.bid}">Booking</a>` : ''}${x.food ? `<button type="button" class="btn sm" data-food="${d}|${x.food}">See who’s having what</button>` : ''}</label>`).join('')}</div>`
          : `<div class="empty"><b>Nothing to do ${d === today() ? 'today' : 'this day'}</b>No treatments or food service.</div>`}</div>`;
  };
  A.wireMyDay = el => $$('[data-myday]', el).forEach(card => { const [sid, d] = card.dataset.myday.split('|');
    $$('[data-tick]', card).forEach(c => c.onchange = () => { const T = A.DB().tasks; T.ticks = T.ticks || {}; const k = sid + '|' + d; T.ticks[k] = T.ticks[k] || {};
      if (c.checked) T.ticks[k][c.dataset.tick] = new Date().toISOString(); else delete T.ticks[k][c.dataset.tick];
      // keep only the last 60 days of ticks
      const old = E.addD(today(), -60); Object.keys(T.ticks).forEach(x => { if (x.split('|')[1] < old) delete T.ticks[x]; });
      A.change('tasks', null, ''); A.refresh(); }); });

  V.staffday = (sid, d, opt = {}) => {
    // opt.fromToday: shown inside Today's "View as", so the day arrows stay on Today
    const cfg = A.cfg(), DB = A.DB(); d = d || today();
    if (A.isTher() && sid !== St.S.user.staffId) sid = St.S.user.staffId;
    const st = cfg.staff.find(s => s.id === sid) || cfg.staff[0]; if (!st) return '<div class="empty"><b>No staff yet</b></div>';
    const ix = E.index(cfg, DB.bookings), day = E.staffDay(cfg, st, d), list = (ix.staff[d] || {})[st.id] || [];
    const mine = DB.bookings.filter(E.live).flatMap(b => (b.items || []).filter(i => i.staff === st.id && (i.date || b.date) === d).map(i => ({ ...i, b }))).sort((a, b) => a.start.localeCompare(b.start));
    const duty = list.filter(x => x[3] === 'duty'), hands = mine.reduce((a, i) => a + i.min, 0), cap = st.maxHands || cfg.rules.maxHandsOn;
    const breaks = E.suggestBreaks(cfg, st, d, ix);
    const timeline = [...mine.map(i => ({ s: E.T(i.start), e: E.T(i.start) + i.min, kind: 'treat', i })), ...duty.map(x => ({ s: x[0], e: x[1], kind: 'duty', sv: x[4] })), ...breaks.filter(b => b.kind !== 'Free').map(b => ({ ...b, kind: 'break', label: b.kind }))].sort((a, b) => a.s - b.s);
    const canEdit = true, dayLink = x => opt.fromToday ? (x <= today() ? `#/today?as=${st.id}` : `#/ahead/${x}?as=${st.id}`) : `#/staffday/${st.id}/${x}`;
    return { html: `${opt.fromToday ? '' : A.dayTabs(d, 'person', st.id)}<div class="vh"><div><div class="eyebrow">${opt.fromToday ? `Staff view · ${esc(st.name)}` : A.isTher() ? 'My day' : 'Day sheet'}</div><h1>${esc(st.name)}</h1><p>${fdy(d)} · ${day ? day.spans.map(s => E.HM(s[0]) + '–' + E.HM(s[1])).join(' and ') : 'Not working'} · ${mine.length} treatment${mine.length === 1 ? '' : 's'}, ${hrs(hands)} hands-on of ${hrs(cap)}</p></div>
      <div class="acts"><a class="btn" href="${dayLink(E.addD(d, -1))}">${A.ic.left}</a><a class="btn" href="${dayLink(today())}">Today</a><a class="btn" href="${dayLink(E.addD(d, 1))}">${A.ic.right}</a><button class="btn" onclick="print()">${A.ic.print} Print</button>
        ${!A.isTher() && !opt.fromToday ? `<select class="inp" id="who" style="width:auto">${cfg.staff.map(s => `<option value="${s.id}" ${s.id === st.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}</div></div>
      ${!day ? '<div class="note">Not working this day.</div>' : ''}
      ${day ? A.myDayCard(st.id, d, { self: St.S.user && St.S.user.staffId === st.id }) : ''}
      ${A.requestCard && ((St.S.user && St.S.user.staffId === st.id) || A.can('staff.edit')) && !opt.fromToday ? A.requestCard(st.id) : ''}
      <div class="card"><div class="card-h"><h3>Timeline</h3></div><div class="list">${timeline.map(x => x.kind === 'treat' ? `<div class="li tl-click" data-it="${x.i.b.id}|${x.i.key}" style="align-items:flex-start;cursor:pointer"><span class="when">${x.i.start}</span><span class="dot" style="background:${PCOL[x.i.b.product]};margin-top:6px"></span>
          <span class="grow"><b>${esc(A.iname(x.i))} · ${x.i.min} min</b><span class="small muted" style="display:block">${esc((x.i.b.guestList[x.i.guest] || {}).name || (x.i.guest === 0 ? A.cust(x.i.b) : 'Guest ' + (x.i.guest + 1) + ' of ' + A.cust(x.i.b)))} · ${A.pname(x.i.b.product)} · ${esc((cfg.treatRooms.find(r => r.id === x.i.troom) || {}).name || '')} · ends ${E.HM(x.e)}${x.i.buffer ? `, room ready ${E.HM(x.e + x.i.buffer)}` : ''}</span>
          ${(x.i.b.tags || []).length ? (x.i.b.tags || []).map(t => `<span class="badge ${/Pregnant|Access/.test(t) ? 'warn' : ''}">${esc(t)}</span>`).join(' ') + ' ' : ''}${(x.i.b.guestList[x.i.guest] || {}).consult === 'done' ? `<span class="badge ok">Consultation done</span> <button class="btn sm ghost" data-cview="${x.i.b.id}|${x.i.guest}">View form</button>` : '<span class="badge warn">Consultation form needed</span>'}${x.i.b.notes ? `<span class="small" style="display:block;margin-top:4px">Note: ${esc(x.i.b.notes)}</span>` : ''}</span>
          ${canEdit && (x.i.date || x.i.b.date) >= today() ? `<button class="btn sm" data-move="${x.i.b.id}|${x.i.key}">Move or hand over</button>` : ''}</div>`
        : x.kind === 'duty' ? `<div class="li svc-li"><span class="when">${E.HM(x.s)}</span><span class="dot" style="background:var(--clay)"></span><span class="grow"><b>🍽 ${esc((E.service(cfg, x.sv, d) || {}).name || 'Food service')}</b><span class="small muted" style="display:block">until ${E.HM(x.e)} · ${((ix.food[d] || {})[x.sv]) || 0} guests${A.foodList ? ' · ' + esc(A.foodList(d, x.sv).summary) : ''}</span></span><button type="button" class="btn sm" data-food="${d}|${x.sv}">See who’s having what</button></div>`
        : `<div class="li"><span class="when">${E.HM(x.s)}</span><span class="dot" style="background:var(--stone)"></span><span class="grow"><b>${x.label}</b><span class="small muted">until ${E.HM(x.e)}${x.fixed ? '' : ' (suggested: a free gap)'}</span></span></div>`).join('') || '<div class="empty"><b>Nothing booked</b></div>'}</div></div>
      <p class="small muted" style="margin-top:10px">${d >= today() ? 'You can move a treatment to any free time inside the guest’s visit, or hand it to a colleague who’s free. The guest is emailed the new time.' : 'This day has passed, so its treatments can’t be moved.'}</p>`,
      wire: el => {
        const w = $('#who', el); if (w) w.onchange = () => A.goDay(`#/staffday/${w.value}/${d}`); A.wireMyDay(el); if (A.wireRequests) A.wireRequests(el); if (A.wireCalClicks) A.wireCalClicks(el);
        $$('[data-cview]', el).forEach(b => b.onclick = () => { const [bid, g] = b.dataset.cview.split('|'); A.viewConsults(DB.bookings.find(x => x.id === bid), +g); });
        $$('[data-move]', el).forEach(b => b.onclick = () => { const [bid, key] = b.dataset.move.split('|'); A.moveItem(DB.bookings.find(x => x.id === bid), key); });
      } };
  };
  A.moveItem = async (b, key) => {
    if ((b.items.find(i => i.key === key) || {}).date < today()) { A.toast('That treatment has already happened, so it can’t be moved'); return; }
    const cfg = A.cfg(), it = b.items.find(i => i.key === key), ix = E.index(cfg, A.DB().bookings, b.id), step = cfg.rules.slotStep || 15;
    const wins = E.windows(cfg, b);
    const freeTimes = (date, staff) => { const w = wins.find(x => x[0] === date); if (!w) return []; const out = []; for (let m = E.T(w[1]); m + it.min <= E.T(w[2]); m += step) { const r = cfg.treatRooms.find(r => !E.itemCheck(cfg, ix, b, it, { date, start: E.HM(m), staff, troom: r.id })); if (r) out.push([E.HM(m), r.id]); } return out; };
    const r = await A.modal({ title: 'Move or hand over', size: 'wide', ok: 'Save', body: `<p><b>${esc(A.iname(it))}</b> · ${it.min} min · ${esc(A.cust(b))} (${b.ref})<br><span class="small muted">Now ${fd(it.date || b.date)} ${it.start} with ${esc(A.sname(it.staff))}. The guest is here ${wins.map(w => `${fd(w[0])} ${w[1]}–${w[2]}`).join(', ')}.</span></p>
      <div class="row r3">${wins.length > 1 ? A.f.sel('date', 'Day', it.date || b.date, wins.map(w => [w[0], fd(w[0])])) : `<input type="hidden" data-k="date" value="${it.date || b.date}">`}${A.f.sel('staff', 'Therapist', it.staff, cfg.staff.filter(s => s.active !== false && E.canDo(s, it.tid)).map(s => [s.id, s.name]))}<label class="fld"><span>Free times</span><select class="inp" data-k="slot" id="slotSel"></select></label></div>
      <div id="slotMsg" class="small muted"></div>${b.customer && b.customer.email ? A.f.chk('mail', 'Email the guest the new time', true) : ''}`,
      onOpen: m => { const fill = () => { const v = A.read(m), list = freeTimes(v.date, v.staff); $('#slotSel', m).innerHTML = list.map(([t, rm]) => `<option value="${t}|${rm}" ${t === it.start && v.staff === it.staff ? 'selected' : ''}>${t}${t === it.start ? ' (same time)' : ''}</option>`).join(''); $('#slotMsg', m).textContent = list.length ? `${list.length} free time${list.length > 1 ? 's' : ''}` : 'No free times for this therapist on this day.'; };
        $$('[data-k=date],[data-k=staff]', m).forEach(s => s.onchange = fill); fill(); },
      onOk: m => { const v = A.read(m); if (!v.slot) throw new Error('No free time chosen'); const [start, troom] = v.slot.split('|'); return { ...v, start, troom }; } });
    if (!r) return;
    const before = `${fd(it.date || b.date)} ${it.start} with ${A.sname(it.staff)}`;
    const moved = r.start !== it.start || r.date !== (it.date || b.date);
    Object.assign(it, { date: r.date, start: r.start, staff: r.staff, troom: r.troom });
    (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: `${A.iname(it)} moved from ${before} to ${fd(it.date)} ${it.start} with ${A.sname(it.staff)}` });
    A.change('booking', b, `Treatment moved on ${b.ref}`);
    if (r.mail && moved) await A.sendEmail('changed', b, {}, St.S.mode === 'demo');
    A.toast(moved ? 'Moved' + (r.mail ? ' and the guest emailed' : '') : 'Handed over'); A.refresh();
  };

  // ============ TREATMENTS ============
  V.treatments = () => {
    const cfg = A.cfg(), cats = [...new Set(cfg.treatments.map(t => t.cat))];
    const who = id => cfg.staff.filter(s => s.active !== false && E.canDo(s, id));
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Treatments</h1><p>Length, turnover time (room reset and a pause before the next guest), price, who can do each one, which booking types include it, and whether guests can book it on the website.</p></div><div class="acts"><button class="btn pri" id="addT">${A.ic.plus} Add a treatment</button></div></div>
      ${cats.map(c => `<h3 style="margin:18px 0 8px">${esc(c)}</h3><div class="card flush"><div class="tbl-wrap"><table class="tbl tr-tbl"><colgroup><col><col style="width:90px"><col style="width:100px"><col style="width:110px"><col style="width:130px"><col style="width:200px"><col style="width:44px"></colgroup><thead><tr><th>Treatment</th><th class="r">Length</th><th class="r">Turnover</th><th class="r">Price</th><th>Who can do it</th><th title="Whether guests can book it on the website">Bookable on the website</th><th></th></tr></thead><tbody>
        ${cfg.treatments.filter(t => t.cat === c).map(t => `<tr class="click" data-t="${t.id}" style="${t.active === false ? 'opacity:.5' : ''}"><td><b>${esc(t.name)}</b>${t.head ? ' <span class="badge">head spa offer</span>' : ''}${(t.roomIds || []).length ? ` <span class="badge">${t.roomIds.map(id => esc((cfg.treatRooms.find(r => r.id === id) || {}).name || id)).join(', ')}</span>` : ''}${t.rooms && t.rooms.length ? ` <span class="badge info">needs ${t.rooms.join(', ')} room</span>` : ''}<br><span class="small muted">${esc(t.desc || '')}</span>${(t.includedWith || []).length ? `<div style="margin-top:5px"><span class="badge info" style="white-space:normal">Included with ${t.includedWith.map(k => esc(A.pname(k))).join(', ')}</span></div>` : ''}</td><td class="r">${t.min} min</td><td class="r">${t.buffer || 0} min</td><td class="r">${t.sell === false ? '<span class="small muted">not sold alone</span>' : gbp(t.price)}</td><td>${who(t.id).map(s => `<span class="dot" title="${esc(s.name)}" style="background:${s.colour}"></span>`).join(' ')} <span class="small muted">${who(t.id).length}</span></td><td>${t.sell === false ? '<span class="small muted">only as part of a package</span>' : t.online === false ? '<span class="badge">No: staff book it</span>' : '<span class="badge ok">Yes</span>'}</td><td class="r">${A.ic.edit}</td></tr>`).join('')}
      </tbody></table></div></div>`).join('')}`,
      wire: el => { $('#addT', el).onclick = () => editTreat(null); $$('[data-t]', el).forEach(r => r.onclick = () => editTreat(cfg.treatments.find(t => t.id === r.dataset.t))); } };
  };
  async function editTreat(t0) {
    const cfg = A.cfg(), t = t0 ? clone(t0) : { id: uid('t'), cat: 'Massage', name: '', min: 30, buffer: 15, price: 50, active: true, desc: '' };
    const tags = [...new Set(cfg.treatRooms.flatMap(r => r.tags || []))];
    const r = await A.modal({ title: t0 ? 'Edit treatment' : 'Add a treatment', size: 'wide', body: `
      <div class="row r3">${A.f.text('name', 'Name', t.name)}<label class="fld"><span>Category</span><select class="inp" id="catSel">${[...new Set(cfg.treatments.map(x => x.cat).concat(t.cat ? [t.cat] : []))].map(c => `<option ${c === t.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__new">New category…</option></select><small>Groups treatments on the menu and in the booking screens</small></label><label class="fld" id="catNewF" hidden><span>New category name</span><input class="inp" id="catNew" placeholder="e.g. Body treatments"></label></div>
      <div class="row r4">${A.f.num('min', 'Length (minutes)', t.min)}${A.f.num('buffer', 'Turnover after (minutes)', t.buffer, { hint: 'Room reset and the therapist’s pause' })}${A.f.money('price', 'Price', t.price)}<div class="fld"><span>&nbsp;</span>${A.f.sw('active', 'Active', t.active !== false)}</div></div>
      ${A.f.area('desc', 'Description (shown on the website)', t.desc)}
      ${A.f.chips('includedWith', 'Included free with these booking types', t.includedWith || [], Object.entries(cfg.products).filter(([, p]) => p.kind !== 'treat').map(([k, p]) => [k, p.name]), { hint: 'Guests on these bookings get this treatment as part of the price. Each booking type chooses whether guests pick one of its included treatments or get them all.' })}
      <div class="row r3">${A.f.sw('sell', 'Sold on its own (as an extra or treatments only)', t.sell !== false)}${A.f.sw('head', `Gets the head spa offer (${cfg.rules.headSpaOff}% off with a session or stay)`, !!t.head)}${A.f.sw('online', 'Guests can book it on the website (off = only staff can book it)', t.online !== false)}</div>
      ${A.f.chips('roomIds', 'Can be done in these treatment rooms (none ticked = any room)', t.roomIds || [], cfg.treatRooms.filter(r => r.active !== false).map(r => [r.id, `${r.name}${r.beds > 1 ? ' · ' + r.beds + ' beds' : ''}`]), { hint: 'A room is never double-booked: each bed takes one treatment at a time, including the handover time.' })}
      ${tags.length ? A.f.chips('rooms', 'Needs equipment', t.rooms || [], tags) : ''}
      ${A.f.chips('who', 'Who can do it', cfg.staff.filter(s => E.canDo(s, t.id)).map(s => s.id), cfg.staff.map(s => [s.id, s.name]))}`,
      foot: t0 ? '<button class="btn danger" data-del style="margin-right:auto">Remove</button>' : '',
      onOpen: (m, close) => { const cs = $('#catSel', m); cs.onchange = () => { $('#catNewF', m).hidden = cs.value !== '__new'; if (cs.value === '__new') $('#catNew', m).focus(); };
        const del = $('[data-del]', m); if (del) del.onclick = async () => { const used = A.DB().bookings.some(b => E.live(b) && b.date >= today() && (b.items || []).some(i => i.tid === t.id)); if (used) { A.toast('It’s in future bookings. Make it inactive instead.'); return; } if (await A.confirm('Remove this treatment?', esc(t.name), 'Remove')) { cfg.treatments = cfg.treatments.filter(x => x.id !== t.id); cfg.staff.forEach(s => s.treatments = (s.treatments || []).filter(x => x !== t.id)); A.change('cfg', null, 'Treatment removed: ' + t.name); close(); A.refresh(); } }; },
      onOk: m => { const v = A.read(m); if (!v.name) throw new Error('Add a name'); if (!(v.min > 0)) throw new Error('Add the length'); const cs = $('#catSel', m).value; v.cat = cs === '__new' ? $('#catNew', m).value.trim() : cs; if (!v.cat) throw new Error('Name the new category'); return v; } });
    if (!r) return;
    const { who, ...rest } = r; Object.assign(t, rest);
    const cfg2 = clone(cfg); const i = cfg2.treatments.findIndex(x => x.id === t.id); if (i >= 0) cfg2.treatments[i] = t; else cfg2.treatments.push(t);
    cfg2.staff.forEach(s => { s.treatments = (s.treatments || []).filter(x => x !== t.id); if (who.includes(s.id)) s.treatments.push(t.id); });
    if (!(await A.handleImpacts(cfg2, `Changing ${t.name}`, (b, it) => it.tid === t.id))) return;
    const j = cfg.treatments.findIndex(x => x.id === t.id); if (j >= 0) cfg.treatments[j] = t; else cfg.treatments.push(t);
    cfg.staff.forEach(s => { s.treatments = (s.treatments || []).filter(x => x !== t.id); if (who.includes(s.id)) s.treatments.push(t.id); });
    A.change('cfg', null, (t0 ? 'Treatment updated: ' : 'Treatment added: ') + t.name); A.refresh();
  }

  // ============ SPA & SESSIONS ============
  V.spa = (tab = 'hours') => {
    const cfg = A.cfg(), t = today();
    const T = tabs('spa', [['hours', 'Opening hours'], ['closures', 'Closures'], ['sessions', 'Sessions'], ['times', 'Treatment times'], ['food', 'Food service'], ['capacity', 'Capacity']], tab);
    let body = '';
    if (tab === 'hours') body = `<div class="card"><div class="card-h"><h3>Usual hours</h3><button class="btn pri" id="saveH">Save</button></div><table class="tbl"><tbody>${[1, 2, 3, 4, 5, 6, 0].map(d => { const h = cfg.hours[d]; return `<tr data-h="${d}"><td style="width:140px"><label class="sw"><input type="checkbox" class="hOn" ${h ? 'checked' : ''}> ${DAYS_L[d]}</label></td><td><input type="time" class="inp hS" value="${h ? h.start : '09:30'}" style="width:130px"> to <input type="time" class="inp hE" value="${h ? h.end : '22:00'}" style="width:130px"></td></tr>`; }).join('')}</tbody></table></div>
      <div class="card"><div class="card-h"><h3>Different hours on a date</h3><button class="btn sm" id="addHO">${A.ic.plus} Add a date</button></div>${Object.keys(cfg.hoursOverride || {}).length ? `<table class="tbl"><tbody>${Object.entries(cfg.hoursOverride).sort().map(([d, h]) => `<tr><td><b>${fdy(d)}</b></td><td>${h ? h.start + '–' + h.end : 'Closed'}</td><td class="r"><button class="btn sm ghost" data-rmho="${d}">Remove</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">None. Use this for Christmas Eve, New Year’s Eve and so on.</p>'}</div>`;
    if (tab === 'closures') body = `<div class="card"><div class="card-h"><h3>Closures</h3><button class="btn pri" id="addCl">${A.ic.plus} Add a closure</button></div><p class="muted" style="margin-bottom:10px">Close everything, or just the spa, rooms, treatments, one booking type or one room. Part days too.</p>
      ${(cfg.closures || []).length ? `<table class="tbl"><thead><tr><th>Dates</th><th>What’s closed</th><th>Why</th><th></th></tr></thead><tbody>${cfg.closures.slice().sort((a, b) => b.from.localeCompare(a.from)).map(c => `<tr class="click" data-cl="${c.id}" style="${(c.to || c.from) < t ? 'opacity:.5' : ''}"><td><b>${fd(c.from)}${c.to && c.to !== c.from ? ' – ' + fdy(c.to) : ''}</b>${c.start ? `<br><span class="small">${c.start}–${c.end}</span>` : ''}</td><td>${c.scope.map(s => `<span class="badge">${esc(scopeName(cfg, s))}</span>`).join(' ')}</td><td>${esc(c.reason || '')}</td><td class="r">${A.ic.edit}</td></tr>`).join('')}</tbody></table>` : '<div class="empty"><b>No closures</b></div>'}</div>`;
    if (tab === 'sessions') body = Object.entries(cfg.products).filter(([, p]) => p.kind === 'session' || p.kind === 'private').map(([k, p]) => `<div class="card"><div class="card-h"><h3>${A.prodDot(k)} ${esc(p.name)}</h3><button class="btn sm" data-addses="${k}">${A.ic.plus} Add a session</button></div>
      <table class="tbl"><thead><tr><th>Session</th><th>Times</th><th>Arrive</th><th class="r">Places</th><th>Days</th><th></th></tr></thead><tbody>${cfg.sessions.filter(s => s.product === k).map(s => `<tr class="click" data-ses="${s.id}" style="${s.active === false ? 'opacity:.5' : ''}"><td><b>${esc(s.name)}</b></td><td>${s.start}–${s.end}</td><td>${s.arrive || s.start}</td><td class="r">${s.cap}</td><td>${(s.days || []).length === 7 ? 'Every day' : [1, 2, 3, 4, 5, 6, 0].filter(d => (s.days || []).includes(d)).map(d => DAYS[d]).join(' ')}</td><td class="r">${A.ic.edit}</td></tr>`).join('')}</tbody></table></div>`).join('');
    if (tab === 'times') { const tt = cfg.treatTimes || { default: {} };
      body = `<div class="card"><div class="card-h"><h3>When treatments can start</h3><button class="btn pri" id="saveTT">Save</button></div><p class="muted" style="margin-bottom:12px">Guests arrive at 09:30, so the first treatment is usually 10:00. Set the first and last start times; a day can be different.</p>
        <table class="tbl"><tbody><tr data-tt="default"><td style="width:140px"><b>Every day</b></td><td>First <input type="time" class="inp ttF" value="${(tt.default || {}).first || '10:00'}" style="width:120px"> &nbsp; last <input type="time" class="inp ttL" value="${(tt.default || {}).last || '21:00'}" style="width:120px"></td></tr>
        ${[1, 2, 3, 4, 5, 6, 0].map(d => `<tr data-tt="${d}"><td>${DAYS_L[d]}</td><td>First <input type="time" class="inp ttF" value="${(tt[d] || {}).first || ''}" style="width:120px"> &nbsp; last <input type="time" class="inp ttL" value="${(tt[d] || {}).last || ''}" style="width:120px"> <span class="small muted">blank = every day’s times</span></td></tr>`).join('')}</tbody></table></div>`; }
    if (tab === 'food') body = `<div class="card"><div class="card-h"><h3>Food service</h3><button class="btn sm" id="addSv">${A.ic.plus} Add a service</button></div><p class="muted" style="margin-bottom:12px">On days with food, at least one person is kept free to serve it and can’t be booked for treatments then. Morning and afternoon spa guests eat together, between the sessions. Choose who serves on a given day from the rota.</p>
      <table class="tbl"><thead><tr><th>Service</th><th>Time</th><th>For</th><th class="r">People needed</th><th></th></tr></thead><tbody>${(cfg.services || []).map(sv => `<tr class="click" data-sv="${sv.id}" style="${sv.active === false ? 'opacity:.5' : ''}"><td><b>${esc(sv.name)}</b></td><td>${sv.start}–${sv.end}${Object.keys(sv.byDay || {}).length ? `<br><span class="small muted">${Object.entries(sv.byDay).map(([d, x]) => DAYS[d] + ' ' + x.start + '–' + x.end).join(', ')}</span>` : ''}</td><td>${(sv.products || []).map(k => esc(A.pname(k))).join(', ')}</td><td class="r">${Math.max(1, sv.staff || 1)}</td><td class="r">${A.ic.edit}</td></tr>`).join('')}</tbody></table></div>`;
    if (tab === 'capacity') body = `<div class="card" style="max-width:720px"><div class="card-h"><h3>Spa capacity</h3><button class="btn pri" id="saveCap">Save</button></div>
      <div class="row r2">${A.f.num('capacity', 'Most people in the spa at once (normal bookings)', cfg.spa.capacity, { hint: 'Day Spa, Spa Access and spa breaks share this' })}${A.f.num('changeover', 'Changeover overlap allowed (minutes)', cfg.spa.changeover || 0, { hint: 'One session leaving as the next arrives' })}</div>
      <div class="note" style="margin-top:12px">Private Spa, Group Spa Breaks, the Whole House and spa breaks of ${cfg.products.break.exclusiveFrom || 6}+ guests have the spa to themselves. They can go above this number, but only when nobody else is booked in the spa then, and nothing else can be booked alongside them.</div></div>`;
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Spa & sessions</h1></div></div>${T}${body}`, wire: el => wireSpa(el, tab) };
  };
  const scopeName = (cfg, s) => s === 'all' ? 'Everything' : s === 'spa' ? 'Spa' : s === 'rooms' ? 'All bedrooms' : s === 'treatments' ? 'Treatments' : s.startsWith('product:') ? A.pname(s.slice(8)) : s.startsWith('room:') ? (cfg.rooms.find(r => r.id === s.slice(5)) || {}).name || s : s.startsWith('troom:') ? (cfg.treatRooms.find(r => r.id === s.slice(6)) || {}).name || s : s;
  function wireSpa(el, tab) {
    const cfg = A.cfg();
    if (tab === 'hours') {
      $('#saveH', el).onclick = async () => { const h2 = {}; $$('[data-h]', el).forEach(tr => { h2[tr.dataset.h] = $('.hOn', tr).checked ? { start: $('.hS', tr).value, end: $('.hE', tr).value } : null; }); const cfg2 = clone(cfg); cfg2.hours = h2; if (!(await A.handleImpacts(cfg2, 'Changing opening hours'))) return; cfg.hours = h2; A.change('cfg', null, 'Opening hours changed'); A.toast('Saved'); };
      $('#addHO', el).onclick = async () => { const r = await A.modal({ title: 'Different hours on a date', body: `<div class="row r3">${A.f.date('date', 'Date', today())}${A.f.time('start', 'Opens', '09:30')}${A.f.time('end', 'Closes', '16:00')}</div>${A.f.chk('closed', 'Closed all day', false)}`, onOk: m => A.read(m) }); if (!r || !r.date) return; const cfg2 = clone(cfg); (cfg2.hoursOverride = cfg2.hoursOverride || {})[r.date] = r.closed ? null : { start: r.start, end: r.end }; if (!(await A.handleImpacts(cfg2, 'Hours on ' + fd(r.date)))) return; cfg.hoursOverride = cfg2.hoursOverride; A.change('cfg', null, 'Hours changed for ' + r.date); A.refresh(); };
      $$('[data-rmho]', el).forEach(b => b.onclick = () => { delete cfg.hoursOverride[b.dataset.rmho]; A.change('cfg', null, 'Hours override removed'); A.refresh(); });
    }
    if (tab === 'closures') {
      const edit = async c0 => {
        const c = c0 ? clone(c0) : { id: uid('c'), from: today(), to: today(), scope: ['all'], reason: '' };
        const scopes = [['all', 'Everything'], ['spa', 'Spa'], ['rooms', 'All bedrooms'], ['treatments', 'Treatments'], ...Object.entries(cfg.products).map(([k, p]) => ['product:' + k, p.name]), ...cfg.rooms.map(r => ['room:' + r.id, r.name]), ...cfg.treatRooms.map(r => ['troom:' + r.id, r.name])];
        const r = await A.modal({ title: c0 ? 'Edit closure' : 'Add a closure', size: 'wide', body: `<div class="row r3">${A.f.date('from', 'From', c.from)}${A.f.date('to', 'To (inclusive)', c.to || c.from)}${A.f.text('reason', 'Reason', c.reason, { ph: 'e.g. Christmas, maintenance' })}</div>${A.f.chips('scope', 'What’s closed', c.scope, scopes)}<div class="row r3">${A.f.time('start', 'Part of the day: from', c.start || '', { hint: 'Blank = all day' })}${A.f.time('end', 'to', c.end || '')}</div>`,
          foot: c0 ? '<button class="btn danger" data-del style="margin-right:auto">Remove</button>' : '', onOpen: (m, close) => { const d = $('[data-del]', m); if (d) d.onclick = () => { cfg.closures = cfg.closures.filter(x => x.id !== c.id); A.change('cfg', null, 'Closure removed'); close(); A.refresh(); }; },
          onOk: m => { const v = A.read(m); if (!v.scope.length) throw new Error('Choose what’s closed'); if (v.to && v.to < v.from) throw new Error('The end is before the start'); return v; } });
        if (!r) return; Object.assign(c, r); if (!c.start) { delete c.start; delete c.end; }
        const cfg2 = clone(cfg); cfg2.closures = (cfg2.closures || []).filter(x => x.id !== c.id).concat([c]);
        const clash = A.DB().bookings.filter(b => E.live(b) && b.date >= c.from && b.date <= (c.to || c.from) && (c.scope.includes('all') || c.scope.includes('product:' + b.product) || (c.scope.includes('spa') && cfg.products[b.product].kind !== 'treat') || (c.scope.includes('rooms') && b.nights)));
        let mailClash = null;
        if (clash.length) {
          const ok = await A.modal({ title: `${clash.length} booking${clash.length > 1 ? 's' : ''} on those dates`, size: 'wide', ok: 'Save closure', body: `<p>${clash.slice(0, 10).map(b => `<a href="#/booking/${b.id}" target="_blank">${esc(A.cust(b))}</a> · ${A.pname(b.product)} · ${fd(b.date)}`).join('<br>')}${clash.length > 10 ? '<br>…' : ''}</p><p class="muted">The closure doesn’t cancel them. Open each to move or cancel it, or email them all now.</p>${A.f.chk('mail', 'Email these guests', false)}${A.f.area('msg', 'Message', `We’re very sorry, but York Cottage will be closed on your date (${c.reason || 'unforeseen circumstances'}). We’ll be in touch to move your booking, or reply to this email and we’ll sort it out with you.`, { rows: 3 })}`, onOk: m => A.read(m) });
          if (!ok) return; if (ok.mail) mailClash = ok.msg;
        }
        if (!(await A.handleImpacts(cfg2, 'The closure', (b, it) => (it.date || b.date) >= c.from && (it.date || b.date) <= (c.to || c.from)))) return;
        cfg.closures = cfg2.closures; A.change('cfg', null, `Closure ${c.from}–${c.to}: ${c.reason}`);
        if (mailClash) { clash.filter(b => b.customer && b.customer.email).forEach(b => { St.queue({ type: 'email', template: 'closure', bookingId: b.id, ref: b.ref, to: b.customer.email, subject: `About your York Cottage booking ${b.ref}`, body: `Hello ${b.customer.first},\n\n${mailClash}\n\nYour booking: ${A.pname(b.product)} on ${fdy(b.date)}.\n\nYork Cottage Spa · 01933 580 100` }); (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: 'Emailed about the closure' }); A.change('booking', b); }); A.toast(`Emails queued for ${clash.length} guest${clash.length > 1 ? 's' : ''}`); }
        A.refresh();
      };
      $('#addCl', el).onclick = () => edit(null);
      $$('[data-cl]', el).forEach(r => r.onclick = () => edit(cfg.closures.find(c => c.id === r.dataset.cl)));
    }
    if (tab === 'sessions') {
      const edit = async (s0, product) => {
        const s = s0 ? clone(s0) : { id: uid('ses'), product, name: '', start: '09:30', end: '13:30', arrive: '09:15', cap: 6, days: [0, 1, 2, 3, 4, 5, 6], active: true };
        const r = await A.modal({ title: (s0 ? 'Edit session · ' : 'Add a session · ') + esc(A.pname(s.product)), size: 'wide', body: `<div class="row r4">${A.f.text('name', 'Name', s.name, { ph: 'Morning' })}${A.f.time('arrive', 'Guests arrive (check-in)', s.arrive || s.start)}${A.f.time('start', 'Starts', s.start)}${A.f.time('end', 'Ends (check-out)', s.end)}</div><div class="row r4">${A.f.num('cap', 'Places', s.cap)}<div class="fld"><span>&nbsp;</span>${A.f.sw('active', 'Active', s.active !== false)}</div></div>${A.f.days('days', 'Runs on', s.days)}`,
          foot: s0 ? '<button class="btn danger" data-del style="margin-right:auto">Remove</button>' : '', onOpen: (m, close) => { const d = $('[data-del]', m); if (d) d.onclick = async () => { if (A.DB().bookings.some(b => E.live(b) && b.sessionId === s.id && b.date >= today())) { A.toast('It has future bookings. Make it inactive instead.'); return; } cfg.sessions = cfg.sessions.filter(x => x.id !== s.id); A.change('cfg', null, 'Session removed'); close(); A.refresh(); }; },
          onOk: m => { const v = A.read(m); if (!v.name) throw new Error('Name the session'); if (v.end <= v.start) throw new Error('It ends before it starts'); return v; } });
        if (!r) return; Object.assign(s, r);
        const cfg2 = clone(cfg); cfg2.sessions = cfg2.sessions.filter(x => x.id !== s.id).concat([s]);
        if (!(await A.handleImpacts(cfg2, `Changing the ${s.name} session`, b => b.sessionId === s.id))) return;
        cfg.sessions = cfg2.sessions; A.change('cfg', null, `Session ${A.pname(s.product)} ${s.name} saved`); A.refresh();
      };
      $$('[data-addses]', el).forEach(b => b.onclick = () => edit(null, b.dataset.addses));
      $$('[data-ses]', el).forEach(r => r.onclick = () => edit(cfg.sessions.find(s => s.id === r.dataset.ses)));
    }
    if (tab === 'times') $('#saveTT', el).onclick = async () => {
      const tt = { dates: (cfg.treatTimes || {}).dates || {} };
      $$('[data-tt]', el).forEach(tr => { const f = $('.ttF', tr).value, l = $('.ttL', tr).value; if (f || l) tt[tr.dataset.tt] = { ...(f ? { first: f } : {}), ...(l ? { last: l } : {}) }; });
      const cfg2 = clone(cfg); cfg2.treatTimes = tt; if (!(await A.handleImpacts(cfg2, 'Changing treatment start times'))) return;
      cfg.treatTimes = tt; A.change('cfg', null, 'Treatment start times changed'); A.toast('Saved');
    };
    if (tab === 'food') {
      const edit = async s0 => {
        const s = s0 ? clone(s0) : { id: uid('sv'), name: '', start: '13:00', end: '14:00', products: ['day'], staff: 1, active: true, byDay: {} };
        const sun = (s.byDay || {})[0] || {};
        const r = await A.modal({ title: s0 ? 'Edit food service' : 'Add a food service', size: 'wide', body: `<div class="row r4">${A.f.text('name', 'Name', s.name)}${A.f.time('start', 'From', s.start)}${A.f.time('end', 'To', s.end)}${A.f.num('staff', 'People needed (at least 1)', Math.max(1, s.staff || 1), { min: 1 })}</div>${A.f.chips('products', 'For guests on', s.products, Object.entries(cfg.products).map(([k, p]) => [k, p.name]))}
          <div class="row r4">${A.f.time('sunS', 'Sunday from (optional)', sun.start || '')}${A.f.time('sunE', 'Sunday to', sun.end || '')}<div class="fld"><span>&nbsp;</span>${A.f.sw('active', 'Active', s.active !== false)}</div></div>`,
          onOk: m => { const v = A.read(m); if (!v.name) throw new Error('Name it'); if ((v.staff || 0) < 1) throw new Error('At least 1 person is needed'); return v; } });
        if (!r) return;
        Object.assign(s, { name: r.name, start: r.start, end: r.end, staff: Math.max(1, r.staff), products: r.products, active: r.active });
        s.byDay = s.byDay || {}; if (r.sunS && r.sunE) s.byDay[0] = { start: r.sunS, end: r.sunE }; else delete s.byDay[0];
        const cfg2 = clone(cfg); cfg2.services = (cfg2.services || []).filter(x => x.id !== s.id).concat([s]);
        if (!(await A.handleImpacts(cfg2, `Changing the ${s.name}`))) return;
        cfg.services = cfg2.services; A.change('cfg', null, 'Food service saved: ' + s.name); A.refresh();
      };
      $('#addSv', el).onclick = () => edit(null);
      $$('[data-sv]', el).forEach(r => r.onclick = () => edit(cfg.services.find(s => s.id === r.dataset.sv)));
    }
    if (tab === 'capacity') $('#saveCap', el).onclick = () => { const v = A.read(el); cfg.spa.capacity = v.capacity; cfg.spa.changeover = v.changeover; A.change('cfg', null, 'Spa capacity changed'); A.toast('Saved'); };
  }

  // ============ ROOMS ============
  V.rooms = (tab = 'bedrooms') => {
    const cfg = A.cfg(), t = today();
    const T = tabs('rooms', [['bedrooms', 'Bedrooms'], ['treatment', 'Treatment rooms']], tab);
    let body = '';
    if (tab === 'bedrooms') body = `<div class="card flush"><div class="card-h" style="padding:16px 18px 0"><h3>Bedrooms</h3><button class="btn sm" id="addR">${A.ic.plus} Add a room</button></div><table class="tbl"><thead><tr><th>Room</th><th>Bed</th><th class="r">Sleeps</th><th>Ensuite</th><th>Spa breaks</th><th></th></tr></thead><tbody>${cfg.rooms.map(r => `<tr class="click" data-r="${r.id}" style="${r.active === false ? 'opacity:.5' : ''}"><td><b>${esc(r.name)}</b></td><td>${esc(r.bed)}</td><td class="r">${r.people}</td><td>${r.ensuite ? 'Yes' : 'No'}</td><td>${r.forBreaks ? 'Yes' : 'Groups & whole house only'}</td><td class="r">${A.ic.edit}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><div class="card-h"><h3>Check-in & check-out times</h3><a class="btn sm" href="#/products">Edit in Booking types</a></div>${['break', 'group', 'house'].map(k => { const tt = cfg.products[k].times || {}; return `<p><b>${esc(A.pname(k))}</b>: check-in ${tt.default.checkIn}${tt[0] && tt[0].checkIn ? ` (Sunday ${tt[0].checkIn})` : ''} · check-out ${tt.default.checkOut}</p>`; }).join('')}</div>`;
    if (tab === 'treatment') body = `<div class="card flush"><div class="card-h" style="padding:16px 18px 0"><h3>Treatment rooms</h3><button class="btn sm" id="addTR">${A.ic.plus} Add a room</button></div><table class="tbl"><thead><tr><th>Room</th><th class="r">Beds</th><th>Equipment tags</th><th></th></tr></thead><tbody>${cfg.treatRooms.map(r => `<tr class="click" data-tr="${r.id}" style="${r.active === false ? 'opacity:.5' : ''}"><td><b>${esc(r.name)}</b></td><td class="r">${r.beds}</td><td>${(r.tags || []).map(x => `<span class="badge">${esc(x)}</span>`).join(' ') || '—'}</td><td class="r">${A.ic.edit}</td></tr>`).join('')}</tbody></table><p class="small muted" style="padding:0 18px 16px">A room with 2 beds lets two therapists each treat one guest side by side (for example a couple). A therapist only ever treats one guest at a time, however many beds a room has. Tags let a treatment need a room with certain equipment, like the head spa bed.</p></div>`;
    if (tab === 'planner') {
      const start = (location.hash.split('?d=')[1] || t), days = Array.from({ length: 21 }, (_, i) => E.addD(start, i));
      const bks = A.DB().bookings.filter(b => E.live(b) && b.nights && b.date <= days[20] && E.addD(b.date, b.nights) > days[0]);
      body = `<div style="display:flex;gap:8px;margin-bottom:10px"><a class="btn" href="#/rooms/planner?d=${E.addD(start, -14)}">${A.ic.left}</a><a class="btn" href="#/rooms/planner">Today</a><a class="btn" href="#/rooms/planner?d=${E.addD(start, 14)}">${A.ic.right}</a></div>
      <div class="planner"><table><thead><tr><th class="rn">Room</th>${days.map(d => `<th class="${E.dow(d) === 5 || E.dow(d) === 6 ? 'we' : ''}">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][E.dow(d)]}<br>${+d.slice(8)}</th>`).join('')}</tr></thead><tbody>
      ${cfg.rooms.filter(r => r.active !== false).map(r => { let tds = '', i = 0; while (i < days.length) { const d = days[i];
        const b = bks.find(x => (x.product === 'house' || (x.rooms || []).includes(r.id)) && x.date <= d && d < E.addD(x.date, x.nights));
        if (b) { let span = 1; while (i + span < days.length && days[i + span] < E.addD(b.date, b.nights)) span++; tds += `<td colspan="${span}"><a class="bk" href="#/booking/${b.id}" style="${A.colEv(b.product)}" title="${esc(A.cust(b))} · ${A.pname(b.product)}">${esc(A.cust(b))}</a></td>`; i += span; continue; }
        const cl = E.closedAllDay(cfg, d, ['rooms', 'room:' + r.id]); tds += `<td class="${cl ? 'cl' : ''}" ${cl ? 'title="Closed"' : ''}></td>`; i++; }
        return `<tr><td class="rn">${esc(r.name)}<br><span class="small muted" style="font-weight:400">${esc(r.bed)}</span></td>${tds}</tr>`; }).join('')}
      </tbody></table></div><p class="small muted" style="margin-top:8px">Each block is a night. Click one to open the booking.</p>`;
    }
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Rooms</h1></div></div>${T}${body}`, wire: el => {
      const editR = async r0 => { const r = r0 ? clone(r0) : { id: uid('r'), name: 'Room ' + (cfg.rooms.length + 1), bed: 'King', people: 2, ensuite: true, forBreaks: true, active: true };
        const v = await A.modal({ title: r0 ? 'Edit room' : 'Add a room', body: `<div class="row r3">${A.f.text('name', 'Name', r.name)}${A.f.text('bed', 'Bed', r.bed)}${A.f.num('people', 'Sleeps', r.people)}</div><div class="row" style="margin-top:10px">${A.f.text('photo', 'Photo web address (shown when guests choose rooms)', r.photo || '', { hint: 'Paste the address of a photo of this room. Leave it empty for no photo.' })}</div>${r.photo ? `<img src="${esc(r.photo)}" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin:8px 0">` : ''}${A.f.sw('ensuite', 'Ensuite', r.ensuite)}${A.f.sw('forBreaks', 'Used for overnight spa breaks', r.forBreaks)}${A.f.sw('active', 'Active', r.active !== false)}`, onOk: m => A.read(m) });
        if (!v) return; Object.assign(r, v); const i = cfg.rooms.findIndex(x => x.id === r.id); if (i >= 0) cfg.rooms[i] = r; else cfg.rooms.push(r); A.change('cfg', null, 'Room saved: ' + r.name); A.refresh(); };
      const editTR = async r0 => { const r = r0 ? clone(r0) : { id: uid('tr'), name: 'Treatment room ' + (cfg.treatRooms.length + 1), beds: 1, tags: [], active: true };
        const v = await A.modal({ title: r0 ? 'Edit treatment room' : 'Add a treatment room', body: `<div class="row r2">${A.f.text('name', 'Name', r.name)}${A.f.num('beds', 'Beds (one therapist per bed)', r.beds, { hint: '2 beds = two therapists can work in here at the same time, one guest each.' })}</div>${A.f.text('tags', 'Equipment tags (comma separated)', (r.tags || []).join(', '), { ph: 'headspa' })}${A.f.sw('active', 'Active', r.active !== false)}`, onOk: m => { const x = A.read(m); x.tags = x.tags.split(',').map(s => s.trim()).filter(Boolean); return x; } });
        if (!v) return; Object.assign(r, v); const cfg2 = clone(cfg); const i2 = cfg2.treatRooms.findIndex(x => x.id === r.id); if (i2 >= 0) cfg2.treatRooms[i2] = r; else cfg2.treatRooms.push(r);
        if (!(await A.handleImpacts(cfg2, 'Changing ' + r.name, (b, it) => it.troom === r.id))) return;
        cfg.treatRooms = cfg2.treatRooms; A.change('cfg', null, 'Treatment room saved: ' + r.name); A.refresh(); };
      const a = $('#addR', el); if (a) a.onclick = () => editR(null); $$('[data-r]', el).forEach(x => x.onclick = () => editR(cfg.rooms.find(r => r.id === x.dataset.r)));
      const b = $('#addTR', el); if (b) b.onclick = () => editTR(null); $$('[data-tr]', el).forEach(x => x.onclick = () => editTR(cfg.treatRooms.find(r => r.id === x.dataset.tr)));
    } };
  };

  // ============ BOOKING TYPES (products), food, policies ============
  V.products = (tab = 'types') => {
    const cfg = A.cfg();
    const T = tabs('products', [['types', 'Booking types'], ['foods', 'Food choices']], tab);
    let body = '';
    if (tab === 'types') body = `<div class="grid g2">${Object.entries(cfg.products).map(([k, p]) => `<div class="card" style="${p.active === false ? 'opacity:.6' : ''}"><div class="card-h"><h3>${A.prodDot(k)} ${esc(p.name)}</h3><button class="btn sm" data-p="${k}">${A.ic.edit} Edit</button></div><p class="small muted">${esc(p.blurb || '')}</p>
      <dl class="kv" style="grid-template-columns:120px 1fr;margin-top:10px;font-size:13.5px"><dt>Price</dt><dd>${p.kind === 'house' ? gbp(p.night) + ' a night' : p.priceN ? Object.entries(p.priceN).map(([n, v]) => `${n} night${n > 1 ? 's' : ''} ${gbp(v)} pp`).join(' · ') : p.kind === 'treat' ? 'By treatment' : gbp(p.price) + ' pp'}</dd><dt>Guests</dt><dd>${p.min}–${p.max}${p.minByDay && p.minByDay[0] ? ` (Sunday min ${p.minByDay[0]})` : ''}</dd>
        ${E.includedFor(cfg, k).length ? `<dt>Included</dt><dd>${E.includedFor(cfg, k).map(t => esc(t.name)).join(E.includedPick(cfg, k) === 'all' ? ' + ' : ' or ')}</dd>` : ''}${(p.benefits || []).length ? `<dt>Benefits</dt><dd>${p.benefits.map(esc).join(' · ')}</dd>` : ''}${p.times ? `<dt>Times</dt><dd>Check-in ${p.times.default.checkIn} · check-out ${p.times.default.checkOut}</dd>` : ''}
        <dt>Payment</dt><dd>${(p.pay || {}).deposit < 100 ? `${p.pay.deposit}% deposit, balance ${(p.pay.balanceDays / 7)} weeks before` : 'In full when booking'}</dd><dt>Website</dt><dd>${p.active === false ? 'Off' : p.online === false ? 'Admin only' : 'Bookable online'}</dd></dl></div>`).join('')}</div>`;
    if (tab === 'foods') body = `<div class="card flush"><div class="card-h" style="padding:16px 18px 0"><h3>Food choices</h3><button class="btn sm" id="addF">${A.ic.plus} Add a choice</button></div><table class="tbl"><thead><tr><th>Choice</th><th>Offered with</th><th>Vegan option</th><th></th></tr></thead><tbody>${cfg.foods.map(f => `<tr class="click" data-f="${f.id}" style="${f.active === false ? 'opacity:.5' : ''}"><td><b>${esc(f.name)}</b><br><span class="small muted">${esc(f.desc || '')}</span></td><td>${f.products.map(k => esc(A.pname(k))).join(', ')}</td><td>${f.vegan ? 'Yes' : 'No'}</td><td class="r">${A.ic.edit}</td></tr>`).join('')}</tbody></table></div>
      <div class="card" style="max-width:520px"><div class="card-h"><h3>Breakfast</h3><button class="btn sm pri" id="saveBf">Save</button></div>${A.f.money('breakfastPrice', 'Continental breakfast, per person per morning', cfg.breakfastPrice)}</div>`;
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Booking types</h1><p>What guests can book: prices, guest numbers, what’s included, times, payment, cancellation rules and the policy shown to guests.</p></div></div></div><div class="note" style="margin-bottom:14px">Need a new kind of booking? New booking types are set up for you on request, so their rules, times and treatments fit how York Cottage runs. You can still change everything about the existing ones below.</div>${T}${body}`, wire: el => {

      $$('[data-p]', el).forEach(b => b.onclick = () => editProduct(b.dataset.p));
      const af = $('#addF', el); if (af) { const ed = async f0 => { const f = f0 ? clone(f0) : { id: uid('f'), name: '', desc: '', products: ['day'], vegan: true, active: true }; const v = await A.modal({ title: f0 ? 'Edit food choice' : 'Add a food choice', body: `${A.f.text('name', 'Name', f.name)}${A.f.text('desc', 'Description', f.desc)}${A.f.chips('products', 'Offered with', f.products, Object.entries(cfg.products).map(([k, p]) => [k, p.name]))}${A.f.sw('vegan', 'Vegan option available', f.vegan)}${A.f.sw('active', 'Active', f.active !== false)}`, onOk: m => { const x = A.read(m); if (!x.name) throw new Error('Name it'); return x; } }); if (!v) return; Object.assign(f, v); const i = cfg.foods.findIndex(x => x.id === f.id); if (i >= 0) cfg.foods[i] = f; else cfg.foods.push(f); A.change('cfg', null, 'Food choice saved: ' + f.name); A.refresh(); };
        af.onclick = () => ed(null); $$('[data-f]', el).forEach(r => r.onclick = () => ed(cfg.foods.find(f => f.id === r.dataset.f))); $('#saveBf', el).onclick = () => { cfg.breakfastPrice = A.read(el).breakfastPrice; A.change('cfg', null, 'Breakfast price changed'); A.toast('Saved'); }; }
    } };
  };
  async function editProduct(k) {
    const cfg = A.cfg(), p = clone(cfg.products[k]), tt = p.times || null;
    const timesRow = (key, label, o) => `<tr><td><b>${label}</b></td><td><input type="time" class="inp" data-k="times.${key}.checkIn" value="${(o || {}).checkIn || ''}" style="width:110px"></td><td><input type="time" class="inp" data-k="times.${key}.spaFrom" value="${(o || {}).spa ? o.spa[0] : ''}" style="width:110px">–<input type="time" class="inp" data-k="times.${key}.spaTo" value="${(o || {}).spa ? o.spa[1] : ''}" style="width:110px"></td><td><input type="time" class="inp" data-k="times.${key}.food" value="${(o || {}).food || ''}" style="width:110px"></td><td><input type="time" class="inp" data-k="times.${key}.checkOut" value="${(o || {}).checkOut || ''}" style="width:110px"></td></tr>`;
    const cancel = (p.cancel && p.cancel.rules) || [];
    const used = A.DB().bookings.some(b => b.product === k && E.live(b) && b.date >= today());
    const r = await A.modal({ title: 'Edit ' + esc(p.name), size: 'xl', foot: p.custom ? '<button class="btn danger" data-del style="margin-right:auto">Delete this booking type</button>' : '',
      onOpen: (m, close) => { const d = $('[data-del]', m); if (d) d.onclick = async () => { if (used) { A.toast('It has future bookings. Switch “Offered” off instead.'); return; } if (!(await A.confirm('Delete ' + esc(p.name) + '?', 'Its sessions go too. Past bookings keep their history.', 'Delete'))) return; delete cfg.products[k]; cfg.sessions = cfg.sessions.filter(s => s.product !== k); (cfg.services || []).forEach(sv => sv.products = (sv.products || []).filter(x => x !== k)); cfg.foods.forEach(f => f.products = f.products.filter(x => x !== k)); cfg.treatments.forEach(t => t.includedWith = (t.includedWith || []).filter(x => x !== k)); A.change('cfg', null, 'Booking type deleted: ' + p.name); close(); A.refresh(); };
        const np = $('#nightPick', m); if (np) np.addEventListener('click', e => { const c = e.target.closest('[data-n]'); if (!c) return; c.classList.toggle('on'); $(`[data-nrow="${c.dataset.n}"]`, m).hidden = !c.classList.contains('on'); });
        const ca = $('#canAdd', m); if (ca) ca.onclick = () => $('#canT tbody', m).insertAdjacentHTML('beforeend', `<tr><td>Cancelled at least <input type="number" class="inp cMin" value="0" style="width:80px"> days before:</td><td><select class="inp cKeep"><option value="0">Full refund</option><option value="deposit">Keep the deposit</option><option value="50">Keep 50%</option><option value="100" selected>No refund</option></select></td></tr>`); },
      body: `
      <div class="row r3">${A.f.text('name', 'Name', p.name)}<div class="fld"><span>&nbsp;</span>${A.f.sw('active', 'Offered', p.active !== false)}</div><div class="fld"><span>&nbsp;</span>${A.f.sw('online', 'Bookable on the website', p.online !== false)}</div></div>
      ${A.f.area('blurb', 'Description (shown when choosing)', p.blurb, { rows: 2 })}
      ${A.f.area('policy', 'Policy shown to guests before they pay', p.policy || '', { rows: 3, hint: 'Payment, refunds and moving dates, in plain words. The refunds the portal suggests come from the cancellation rules below.' })}
      <div class="row r4">${p.kind === 'house' ? A.f.money('night', 'Price a night', p.night) + A.f.num('minN', 'Minimum nights', p.minN) + A.f.num('maxN', 'Maximum nights', p.maxN) : p.kind === 'stay' ? '' : p.kind !== 'treat' ? A.f.money('price', 'Price per person', p.price) : ''}
        ${A.f.num('min', 'Fewest guests', p.min)}${A.f.num('max', 'Most guests', p.max)}${p.kind === 'private' ? A.f.num('minSun', 'Fewest guests on Sundays', (p.minByDay || {})[0] || '') : ''}${p.kind === 'stay' && k === 'break' ? A.f.num('exclusiveFrom', 'Groups this big get the spa to themselves', p.exclusiveFrom) : ''}</div>
      ${p.kind !== 'treat' ? `<div class="fld"><span>Included treatments</span><p class="small">${E.includedFor(cfg, k).map(t => esc(t.name)).join(', ') || 'None'} · <a href="#/treatments" onclick="document.querySelector('.ov [data-x]').click()">change in Treatments</a></p></div>${A.f.sel('includedPick', 'With more than one included treatment', E.includedPick(cfg, k), [['one', 'Each guest chooses one'], ['all', 'Each guest has all of them']])}` : ''}
      ${A.f.area('benefits', 'What’s included (one per line, shown on the website and in emails)', (p.benefits || []).join('\n'), { rows: 4, hint: 'e.g. Towel, robe & slippers · Hot & cold drinks' })}
      ${p.kind === 'stay' ? `<div class="fld"><span>Nights guests can book</span><small>Tick each length of stay you offer. Each one has its own price per person and arrival days.</small>
        <div class="chips" id="nightPick" data-single>${[1, 2, 3, 4, 5, 6, 7].map(n => `<button type="button" class="chip ${(p.nights || []).includes(n) ? 'on' : ''}" data-n="${n}">${n} night${n > 1 ? 's' : ''}</button>`).join('')}</div></div>
        <table class="tbl" id="nightT"><thead><tr><th>Stay</th><th>Price per person</th><th>Can arrive on</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6, 7].map(n => `<tr data-nrow="${n}" ${(p.nights || []).includes(n) ? '' : 'hidden'}><td><b>${n} night${n > 1 ? 's' : ''}</b></td><td style="width:170px">${A.f.money('priceN.' + n, '', (p.priceN || {})[n] ?? '')}</td><td>${A.f.days('arrive.' + n, '', (p.arriveDays || {})[n] || [0, 1, 2, 3, 4, 5, 6])}</td></tr>`).join('')}</tbody></table>` : ''}
      ${true ? A.f.num('maxExtras', 'Most extra treatments one guest can book online', p.maxExtras || '', { hint: p.kind === 'stay' || p.kind === 'house' ? 'Blank = 3 a day of the stay. Staff can always add more in the portal.' : 'Blank = 3. Staff can always add more in the portal.', min: 1 }) : ''}
      ${p.breakfast !== undefined || p.kind === 'stay' ? A.f.sw('breakfast', 'Offer breakfast', !!p.breakfast) : ''}
      ${A.f.sel('together', 'Groups: treat guests at the same time, with different therapists, where possible', p.together == null ? '' : p.together ? 'yes' : 'no', [['', `Same as the main setting (Settings → Booking rules, now ${cfg.rules.groupTogether ? 'Yes' : 'No'})`], ['yes', 'Yes, for this booking type'], ['no', 'No, one after another for this booking type']], { hint: 'For bookings of 2 or more guests. Changing the main setting changes every booking type left on “Same as the main setting”.' })}
      ${tt ? `<div class="fld"><span>Times</span><table class="tbl"><thead><tr><th></th><th>Check-in</th><th>Spa</th><th>Food</th><th>Check-out</th></tr></thead><tbody>${timesRow('default', 'Every day', tt.default)}${[1, 2, 3, 4, 5, 6, 0].map(d => timesRow(String(d), DAYS_L[d], tt[d])).join('')}</tbody></table><small><b>Every day</b> is the normal timetable. Fill in a weekday only where that day is different (for example Sundays, when the spa-break evening runs later). Leave a day blank to use the normal times. Spa is when these guests use the spa; treatments can be any time between check-in and check-out.</small></div>` : ''}
      <div class="row r3">${A.f.num('pay.deposit', 'Paid when booking (%)', (p.pay || {}).deposit ?? 100, { hint: '100 = in full' })}${A.f.num('pay.balanceDays', 'Balance due (days before)', (p.pay || {}).balanceDays || '', { hint: 'Within this, pay in full' })}${A.f.money('pay.damage', 'Damage deposit (pre-authorised)', (p.pay || {}).damage || '')}</div>
      <div class="fld"><span>Cancellation rules (the portal suggests refunds from these)</span><table class="tbl" id="canT"><tbody>${cancel.map(c => `<tr><td>Cancelled at least <input type="number" class="inp cMin" value="${c.minDays}" style="width:80px"> days before:</td><td><select class="inp cKeep"><option value="0" ${c.keepPct === 0 ? 'selected' : ''}>Full refund</option><option value="deposit" ${c.keepDeposit ? 'selected' : ''}>Keep the deposit</option><option value="50" ${c.keepPct === 50 ? 'selected' : ''}>Keep 50%</option><option value="100" ${c.keepPct === 100 ? 'selected' : ''}>No refund</option></select></td></tr>`).join('')}</tbody></table>
        <button type="button" class="btn sm ghost" id="canAdd">+ add a rule</button>${A.f.num('moveDays', 'Guests can move their date with at least this many days’ notice', (p.cancel || {}).moveDays ?? '')}</div>`,
      onOk: m => { const v = A.read(m);
        if ($('#nightPick', m)) { v.nightsOpt = $$('#nightPick .chip.on', m).map(c => +c.dataset.n); if (!v.nightsOpt.length) throw new Error('Choose at least one length of stay'); for (const n of v.nightsOpt) { if (!(v.priceN && v.priceN[n] > 0)) throw new Error(`Add the price for ${n} night${n > 1 ? 's' : ''}`); if (!(v.arrive && v.arrive[n] && v.arrive[n].length)) throw new Error(`Choose the arrival days for ${n} night${n > 1 ? 's' : ''}`); } }
        v.cancelRules = $$('#canT tr', m).map(tr => { const keep = $('.cKeep', tr).value; return { minDays: +$('.cMin', tr).value || 0, ...(keep === 'deposit' ? { keepDeposit: true } : { keepPct: +keep }) }; }).sort((a, b) => b.minDays - a.minDays); if (!v.cancelRules.length || v.cancelRules[v.cancelRules.length - 1].minDays !== 0) throw new Error('Add a rule for 0 days (the last-minute rule)'); return v; } });
    if (!r) return;
    const q = cfg.products[k];
    q.name = r.name; q.active = r.active; q.online = r.online; q.blurb = r.blurb; q.policy = r.policy; q.min = r.min; q.max = r.max;
    if (r.night != null) q.night = r.night; if (r.minN) q.minN = r.minN; if (r.maxN) q.maxN = r.maxN; if (r.price != null) q.price = r.price; if (r.nightsOpt) { q.nights = r.nightsOpt; q.priceN = Object.fromEntries(r.nightsOpt.map(n => [n, r.priceN[n]])); q.arriveDays = Object.fromEntries(r.nightsOpt.map(n => [n, r.arrive[n]])); } else if (r.priceN) q.priceN = { ...q.priceN, ...r.priceN };
    if (r.minSun != null) q.minByDay = r.minSun ? { 0: r.minSun } : {};
    if (r.exclusiveFrom != null) q.exclusiveFrom = r.exclusiveFrom;
    q.maxExtras = r.maxExtras || undefined;
    if (r.includedPick) q.includedPick = r.includedPick;
    q.benefits = (r.benefits || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (r.arrive && !r.nightsOpt) q.arriveDays = { ...q.arriveDays, ...r.arrive };
    if (r.breakfast != null && (q.kind === 'stay')) q.breakfast = r.breakfast;
    q.together = r.together === '' ? undefined : r.together === 'yes';
    if (r.times) { const conv = o => { if (!o) return null; const x = {}; ['checkIn', 'food', 'checkOut'].forEach(f => { if (o[f]) x[f] = o[f]; }); if (o.spaFrom && o.spaTo) x.spa = [o.spaFrom, o.spaTo]; return Object.keys(x).length ? x : null; }; const d0 = conv(r.times.default); q.times = { ...q.times, default: { ...q.times.default, ...d0 } }; for (let d = 0; d < 7; d++) { const x = conv(r.times[String(d)]); if (x) q.times[d] = x; else delete q.times[d]; } }
    q.pay = { ...q.pay, deposit: r.pay.deposit ?? 100, balanceDays: r.pay.balanceDays || undefined, damage: r.pay.damage || undefined };
    q.cancel = { ...(q.cancel || {}), rules: r.cancelRules, moveDays: r.moveDays ?? undefined };
    A.change('cfg', null, 'Booking type saved: ' + q.name); A.toast('Saved'); A.refresh();
  }
  // new booking types copy their starting settings from an existing one of the same kind
  const KINDS = [['session', 'Spa session', 'Shared spa sessions with places, like the Day Spa or Spa Access'], ['private', 'Private spa hire', 'The spa just for one group for a session'], ['stay', 'Overnight stay', 'Nights in the bedrooms with spa time, like the spa breaks'], ['house', 'Whole house', 'Exclusive use of the house and spa'], ['treat', 'Treatments only', 'Treatments with no spa session or room']];
  async function addType() {
    const cfg = A.cfg();
    const r = await A.modal({ title: 'Add a booking type', size: 'wide', ok: 'Create', body: `${A.f.text('name', 'Name', '', { ph: 'e.g. Twilight Spa, Mother & Daughter Day' })}
      <div class="fld"><span>What kind of booking is it?</span><div class="pick" id="kindPick">${KINDS.map(([k, n, d], i) => `<button type="button" data-kind="${k}" class="${i === 0 ? 'on' : ''}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>
      <label class="fld"><span>Start from the settings of</span><select class="inp" id="tplSel"></select><small>Prices, guests, times and rules are copied, and you can change them next.</small></label>`,
      onOpen: m => { let kind = 'session'; const fill = () => { const opts = Object.entries(cfg.products).filter(([, p]) => p.kind === kind); $('#tplSel', m).innerHTML = opts.map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join(''); }; $$('[data-kind]', m).forEach(b => b.onclick = () => { kind = b.dataset.kind; $$('[data-kind]', m).forEach(x => x.classList.toggle('on', x === b)); fill(); }); fill(); m._kind = () => kind; },
      onOk: m => { const v = A.read(m); if (!v.name) throw new Error('Name it'); const tpl = $('#tplSel', m).value; if (!tpl) throw new Error('Choose one to copy'); return { name: v.name, kind: m._kind(), tpl }; } });
    if (!r) return;
    let key = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'type'; while (cfg.products[key]) key += '-2';
    const src = cfg.products[r.tpl], np = clone(src); np.name = r.name; np.custom = true; np.active = true; np.online = false;
    cfg.products[key] = np;
    // copy its sessions, food service, foods, and the treatments included with it
    cfg.sessions.filter(s => s.product === r.tpl).forEach(s => cfg.sessions.push({ ...clone(s), id: uid('ses'), product: key }));
    (cfg.services || []).forEach(sv => { if ((sv.products || []).includes(r.tpl)) sv.products.push(key); });
    cfg.foods.forEach(f => { if ((f.products || []).includes(r.tpl)) f.products.push(key); });
    cfg.treatments.forEach(t => { if ((t.includedWith || []).includes(r.tpl)) t.includedWith.push(key); });
    A.change('cfg', null, `Booking type added: ${r.name} (copied from ${src.name})`);
    A.toast('Created. It’s hidden from the website until you switch “Bookable on the website” on.');
    A.refresh(); setTimeout(() => editProduct(key), 200);
  }
  A.addType = addType;

  // ============ DATE PRICES ============
  V.rates = () => {
    const cfg = A.cfg(), t = today();
    const list = (cfg.rates || []).slice().sort((a, b) => a.from.localeCompare(b.from));
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Date prices</h1><p>Peak prices, special rates, minimum stays and stop-sells for date ranges. The last matching rule wins.</p></div><div class="acts"><button class="btn pri" id="addRt">${A.ic.plus} Add a rule</button></div></div>
      <div class="card flush"><table class="tbl"><thead><tr><th>Dates</th><th>Booking type</th><th>Days</th><th>Price</th><th>Rules</th><th></th></tr></thead><tbody>
      ${list.map(r => `<tr class="click" data-rt="${r.id}" style="${(r.to || r.from) < t ? 'opacity:.5' : ''}"><td><b>${fd(r.from)} – ${fdy(r.to || r.from)}</b>${r.label ? `<br><span class="small muted">${esc(r.label)}</span>` : ''}</td><td>${r.product === 'all' ? 'Everything' : esc(A.pname(r.product))}</td><td>${(r.days || []).length ? r.days.map(d => DAYS[d]).join(' ') : 'Every day'}</td><td>${r.night != null ? gbp(r.night) + '/night' : r.priceN ? Object.entries(r.priceN).filter(([, v]) => v != null).map(([n, v]) => `${n}n ${gbp(v)}`).join(', ') : r.price != null ? gbp(r.price) + ' pp' : '—'}</td><td>${r.stopSell ? '<span class="badge bad">Not for sale</span> ' : ''}${r.minNights ? `<span class="badge">${r.minNights}-night minimum</span>` : ''}</td><td class="r">${A.ic.edit}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty"><b>No date prices</b>Normal prices apply every day.</div></td></tr>'}
      </tbody></table></div>`,
      wire: el => {
        const edit = async r0 => {
          const r = r0 ? clone(r0) : { id: uid('rt'), product: 'house', from: today(), to: today(), days: [], label: '' };
          const v = await A.modal({ title: r0 ? 'Edit date price' : 'Add a date price', size: 'wide', body: `<div class="row r3">${A.f.sel('product', 'Booking type', r.product, [['all', 'Everything'], ...Object.entries(cfg.products).map(([k, p]) => [k, p.name])])}${A.f.date('from', 'From', r.from)}${A.f.date('to', 'To (inclusive)', r.to)}</div>${A.f.days('days', 'Only on these days (none = every day)', r.days || [])}
            <div class="row r4">${A.f.money('price', 'Price per person', r.price ?? '')}${A.f.money('n1', '1 night pp', (r.priceN || {})[1] ?? '')}${A.f.money('n2', '2 nights pp', (r.priceN || {})[2] ?? '')}${A.f.money('night', 'Whole house a night', r.night ?? '')}</div>
            <div class="row r3">${A.f.num('minNights', 'Minimum nights', r.minNights || '')}${A.f.text('label', 'Label', r.label, { ph: 'e.g. Valentine’s weekend' })}<div class="fld"><span>&nbsp;</span>${A.f.sw('stopSell', 'Not for sale on these dates', !!r.stopSell)}</div></div><p class="small muted">Leave a price blank to keep the normal price.</p>`,
            foot: r0 ? '<button class="btn danger" data-del style="margin-right:auto">Remove</button>' : '', onOpen: (m, close) => { const d = $('[data-del]', m); if (d) d.onclick = () => { cfg.rates = cfg.rates.filter(x => x.id !== r.id); A.change('cfg', null, 'Date price removed'); close(); A.refresh(); }; },
            onOk: m => A.read(m) });
          if (!v) return;
          Object.assign(r, { product: v.product, from: v.from, to: v.to || v.from, days: v.days, label: v.label, stopSell: v.stopSell, minNights: v.minNights || undefined, price: v.price ?? undefined, night: v.night ?? undefined, priceN: v.n1 != null || v.n2 != null ? { 1: v.n1 ?? undefined, 2: v.n2 ?? undefined } : undefined });
          cfg.rates = (cfg.rates || []).filter(x => x.id !== r.id).concat([r]); A.change('cfg', null, `Date price ${r.from}–${r.to} saved`); A.refresh();
        };
        $('#addRt', el).onclick = () => edit(null);
        $$('[data-rt]', el).forEach(x => x.onclick = () => edit(cfg.rates.find(r => r.id === x.dataset.rt)));
      } };
  };
})();
