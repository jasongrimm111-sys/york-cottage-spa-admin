/* Staffing suggestions (user 2026-11-27): looks at the next six weeks and tells the owner where another therapist would help:
   days that are (nearly) full because of too few therapists, sessions that still have places but no therapist time for the
   included treatments, and therapists close to their daily hands-on limit. Shown on the Rota page and in the to-do list. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, fd, fdy, today } = A;
  const HM = m => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
  let memo = null;

  A.staffingSuggestions = (days = 42) => {
    const DB = A.DB(), cfg = A.cfg(), t = today();
    const key = t + '|' + DB.bookings.length + '|' + DB.bookings.reduce((a, b) => a + (b.updated || b.created || '').length + (b.items || []).length, 0) + '|' + JSON.stringify(cfg.staff).length + '|' + JSON.stringify(cfg.sessions || []).length;
    if (memo && memo.key === key && Date.now() - memo.at < 120000) return memo.out;
    const ix = E.index(cfg, DB.bookings.filter(E.live)), out = [], lim = st => st.maxHands || cfg.rules.maxHandsOn || 360;
    for (let i = 0; i < days; i++) {
      const d = E.addD(t, i), h = E.hours(cfg, d); if (!h) continue;
      const therapists = cfg.staff.filter(st => (st.treatments || []).length && E.staffDay(cfg, st, d));
      const reasons = [], level = { v: 0 }, wins = [];
      const bump = (n, text) => { reasons.push(text); level.v = Math.max(level.v, n); };
      // therapist time: how much is booked (treatments plus turnover) against what's rostered
      let cap = 0, used = 0;
      for (const st of therapists) {
        const day = E.staffDay(cfg, st, d), spans = day.spans.reduce((a, s) => a + s[1] - s[0], 0), br = day.breaks.reduce((a, b) => a + b[1] - b[0], 0);
        const list = (ix.staff[d] || {})[st.id] || [], hands = list.filter(x => x[3] !== 'duty').reduce((a, x) => a + (x[2] || 0), 0), busy = list.reduce((a, x) => a + (x[1] - x[0]), 0);
        cap += Math.max(0, spans - br); used += busy;
        if (hands >= lim(st) * 0.9) wins.push([day.start, day.end]);
        if (hands >= lim(st) * 0.9) bump(hands >= lim(st) ? 2 : 1, `${esc(st.name)} has ${HM(hands)} of treatments (daily limit ${HM(lim(st))})`);
      }
      const pct = cap ? Math.round(used / cap * 100) : 0;
      if (therapists.length && pct >= 85) wins.push([E.T(h.start), E.T(h.end)]);
      if (therapists.length && pct >= 85) bump(pct >= 95 ? 2 : 1, `Therapist time ${pct}% booked (${therapists.length} therapist${therapists.length > 1 ? 's' : ''} working)`);
      // sessions that still sell places but can't fit more treatments
      const stuck = [], tight = [];
      for (const [k, p] of Object.entries(cfg.products)) {
        if (p.active === false || !(p.kind === 'session' || p.kind === 'private')) continue;
        if (!E.includedFor(cfg, k).length) continue;
        for (const s of E.sessions(cfg, ix, k, d, 2).filter(x => x.ok)) {
          const room = E.treatRoom(cfg, ix, { product: k, date: d, sessionId: s.id, guests: 2 });
          if (room <= 0) wins.push([E.T(s.start || h.start), E.T(s.end || h.end)]);
          if (room < 0) stuck.push(`${p.name} ${s.name || ''}`.trim()); else if (room === 0) tight.push(`${p.name} ${s.name || ''}`.trim());
        }
      }
      if (stuck.length) bump(2, `${esc(stuck.join(', '))} still ${stuck.length > 1 ? 'have' : 'has'} places, but no therapist time is left for the included treatments, so ${stuck.length > 1 ? 'they' : 'it'} can’t be sold online`);
      if (tight.length) bump(1, `${esc(tight.join(', '))}: only the included treatments fit, so guests can’t add extras`);
      if (!therapists.length && Object.values(cfg.products).some(p => p.active !== false && (p.kind === 'session' || p.kind === 'private'))) bump(1, 'No therapists rostered while the spa is open');
      if (!reasons.length) continue;
      const win = wins.length ? [Math.min(...wins.map(w => w[0])), Math.max(...wins.map(w => w[1]))] : [E.T(h.start), E.T(h.end)];
      out.push({ date: d, level: level.v, reasons, pct, therapists: therapists.length, win });
    }
    memo = { key, at: Date.now(), out };
    return out;
  };

  const row = s => `<div class="li"><span class="dot" style="background:${s.level >= 2 ? 'var(--bad)' : 'var(--warn)'}"></span><span class="grow"><b>${fdy(s.date)} · ${s.level >= 2 ? 'add a therapist' : 'worth considering another therapist'}, ${E.HM(s.win[0])}–${E.HM(s.win[1])}</b>
      <span class="small muted" style="display:block">${s.reasons.join(' · ')}</span></span><span style="white-space:nowrap"><a class="btn sm" href="#/ahead/${s.date}">See the day</a> <button class="btn sm pri" data-cover="${s.date}|${E.HM(s.win[0])}|${E.HM(s.win[1])}">Add cover</button></span></div>`;
  const card0 = list => { const top = list.filter(s => s.level >= 2), rest = list.filter(s => s.level < 2), show = top.concat(rest.slice(0, Math.max(0, 6 - top.length))), more = list.filter(s => !show.includes(s));
    return `<div class="card staffing"><div class="card-h"><h3>Staffing suggestions</h3><span class="small muted">Next six weeks</span></div>
    ${list.length ? `<p class="muted" style="margin-bottom:8px">Days where another therapist would let you sell more, or take pressure off the team. Red: sales are being lost or someone is over their limit.</p>
      <div class="list">${show.sort((a, b) => a.date.localeCompare(b.date)).map(row).join('')}</div>${more.length ? `<details style="margin-top:8px"><summary class="small" style="cursor:pointer">${more.length} smaller suggestion${more.length > 1 ? 's' : ''}</summary><div class="list">${more.map(row).join('')}</div></details>` : ''}`
      : '<p class="muted">Nothing to suggest: there’s enough therapist time for what’s booked over the next six weeks.</p>'}</div>`; };
  const card = card0;
  A.staffingCard = () => card(A.staffingSuggestions());

  // ---------- add cover for a day (user 2026-11-27): an extra therapist just for that day, then share the day's treatments ----------
  const clone = o => JSON.parse(JSON.stringify(o));
  const COLS = ['#7a8f6a', '#b4785a', '#6d7fa0', '#a0708f', '#c09a4a', '#5f9c95'];
  // re-plan one day with every guest's times kept: only who does each treatment (and which room) can change
  A.rebalanceDay = (d) => {
    const cfg = A.cfg(), DB = A.DB(), cfg2 = clone(cfg); cfg2.rules.share = cfg.rules.share === 'week' ? 'week' : 'even';
    const onDay = it => (it.date || null);
    const live = DB.bookings.filter(E.live), dayB = live.filter(b => (b.items || []).some(it => (it.date || b.date) === d && it.start));
    if (!dayB.length) return [];
    const strip = b => ({ ...b, items: (b.items || []).filter(it => (it.date || b.date) !== d) });
    let ix = E.index(cfg2, live.filter(b => !dayB.includes(b)).concat(dayB.map(strip)));
    const first = b => Math.min(...b.items.filter(it => (it.date || b.date) === d).map(it => E.T(it.start)));
    const changes = [];
    for (const b of dayB.slice().sort((x, y) => first(x) - first(y))) {
      const mine = b.items.filter(it => (it.date || b.date) === d);
      const times = Object.fromEntries(b.items.map(it => [it.key, { date: it.date || b.date, start: it.start }]));
      const needs = E.treatmentNeeds(cfg2, { ...b, times }).filter(n => mine.some(it => it.key === n.key));
      let placed = mine;
      if (d >= today() && needs.length === mine.length) {
        const r = E.plan(cfg2, ix, { ...b, times }, { needs });
        if (r.ok && r.items.length === mine.length && r.items.every(n => { const o = mine.find(it => it.key === n.key); return o && o.start === n.start && (o.date || b.date) === (n.date || b.date); })) {
          placed = mine.map(o => { const n = r.items.find(x => x.key === o.key); return { ...o, staff: n.staff, troom: n.troom }; });
          placed.forEach(n => { const o = mine.find(it => it.key === n.key); if (o.staff !== n.staff) changes.push({ b, key: n.key, start: n.start, from: o.staff, to: n.staff, troom: n.troom, name: A.iname ? A.iname({ ...o, b }) : (E.tr(cfg, o.tid) || {}).name }); });
        }
      }
      ix = E.withItems(ix, placed.map(it => ({ ...it, date: it.date || b.date })));
    }
    return changes;
  };
  A.applyRebalance = async (d, changes) => {
    if (!changes.length) { A.toast('No treatments needed to move'); return; }
    const ok = await A.confirm(`Share ${fdy(d)}’s treatments?`, `${changes.length} treatment${changes.length > 1 ? 's' : ''} would move to another therapist. Guests keep the same times.<br><br>${changes.map(c => `${c.start} ${esc(c.name || '')}: ${esc(A.sname(c.from))} → <b>${esc(A.sname(c.to))}</b>`).join('<br>')}`, 'Move them');
    if (!ok) return;
    const byB = new Map(); changes.forEach(c => { (byB.get(c.b) || byB.set(c.b, []).get(c.b)).push(c); });
    for (const [b, cs] of byB) {
      cs.forEach(c => { const it = b.items.find(x => x.key === c.key); if (it) { it.staff = c.to; if (c.troom) it.troom = c.troom; } });
      (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: `Therapists rebalanced for ${d} (cover added): ${cs.map(c => `${c.start} ${A.sname(c.from)} → ${A.sname(c.to)}`).join(', ')}` });
      A.change('booking', b, `Therapists rebalanced · ${b.ref}`);
    }
    A.toast(`${changes.length} treatment${changes.length > 1 ? 's' : ''} moved`); A.refresh();
  };
  A.addCover = async (d, s0, e0) => {
    const cfg = A.cfg();
    const free = cfg.staff.filter(st => st.active !== false && (st.treatments || []).length && !E.staffDay(cfg, st, d)).sort((a, b) => !!b.cover - !!a.cover || a.name.localeCompare(b.name));
    const most = cfg.staff.slice().sort((a, b) => (b.treatments || []).length - (a.treatments || []).length)[0];
    const r = await A.modal({ title: `Add cover · ${fdy(d)}`, ok: 'Add cover', body: `
      <p class="muted" style="margin-bottom:10px">An extra therapist just for this day. Their usual week doesn’t change.</p>
      ${A.f.sel('who', 'Who', free[0] ? free[0].id : 'new', free.map(s => [s.id, s.name + (s.cover ? ' (cover)' : '')]).concat([['new', '+ Someone new (a cover therapist)']]))}
      <div id="newBox" ${free.length ? 'hidden' : ''}><div class="row r2" style="margin-top:10px">${A.f.text('name', 'Their name', '')}${A.f.text('email', 'Email (optional, for their schedule)', '', { type: 'email' })}</div>
        <p class="small muted">They’ll be able to do the same treatments as ${esc(most ? most.name : 'your other therapists')}. You can change that on the Staff page. They’re marked “cover only”, so they’re only booked when the regulars are full.</p></div>
      <div class="row r2" style="margin-top:10px">${A.f.time('start', 'From', s0 || '10:00')}${A.f.time('end', 'To', e0 || '17:00')}</div>
      <div style="margin-top:10px">${A.f.sw('rebal', 'Share the day’s booked treatments between everyone on shift (guests keep their times)', true)}</div>`,
      onOpen: m => { const w = $('[data-k=who]', m), nb = $('#newBox', m); if (w) w.onchange = () => nb.hidden = w.value !== 'new'; },
      onOk: m => { const v = A.read(m); if (!v.start || !v.end || v.end <= v.start) throw new Error('Choose their hours'); if (v.who === 'new' && !(v.name || '').trim()) throw new Error('Add their name'); return v; } });
    if (!r) return;
    let st;
    if (r.who === 'new') {
      st = { id: A.uid ? A.uid('s') : 's' + Date.now().toString(36), name: r.name.trim(), role: 'Cover therapist', cover: true, colour: COLS[cfg.staff.length % COLS.length], email: r.email || '', phone: '', active: true,
        treatments: most ? (most.treatments || []).slice() : [], duties: [], pattern: {}, shifts: {}, maxHands: cfg.rules.maxHandsOn || 360, holidayDays: 0 };
      cfg.staff.push(st);
    } else st = cfg.staff.find(s => s.id === r.who);
    (st.shifts = st.shifts || {})[d] = { shifts: [{ start: r.start, end: r.end }] };
    A.change('cfg', null, `Cover added: ${st.name} on ${d} ${r.start}–${r.end}`);
    A.toast(`${st.name} added for ${fdy(d)}`);
    if (r.rebal) await A.applyRebalance(d, A.rebalanceDay(d)); else A.refresh();
  };
  // a note on a day page (Today / Future days) when that day needs cover, plus links to the other days that do
  A.staffingNote = d => {
    if (!A.can('staff.edit')) return '';
    const all = A.staffingSuggestions(), s = all.find(x => x.date === d), next = all.filter(x => x.date > d && x.level >= 2).slice(0, 5);
    return (s ? `<div class="note ${s.level >= 2 ? 'bad' : 'warn'} staff-note"><span class="grow"><b>${s.level >= 2 ? 'Another therapist needed' : 'Worth considering another therapist'}, ${E.HM(s.win[0])}–${E.HM(s.win[1])}</b><br><span class="small">${s.reasons.join(' · ')}</span></span><button class="btn sm pri" data-cover="${d}|${E.HM(s.win[0])}|${E.HM(s.win[1])}">Add cover</button></div>` : '')
      + (next.length ? `<p class="small muted" style="margin:-6px 0 12px">Also needing cover: ${next.map(x => `<a href="#/ahead/${x.date}">${fd(x.date)}</a>`).join(' · ')}</p>` : '');
  };
  // one click handler for every "Add cover" button, wherever it is
  document.addEventListener('click', e => { const b = e.target.closest('[data-cover]'); if (!b) return; e.preventDefault(); const [d, s, en] = b.dataset.cover.split('|'); A.addCover(d, s, en); });
})();
