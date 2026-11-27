/* Time off and shift swaps (user 2026-11-27): therapists ask from their own page; a manager approves or declines.
   Approved time off goes on the staff member's record (the same check as adding it by hand shows any booked treatments
   it affects). An approved swap exchanges the two people's working hours for that day. Requests live in tasks.json (private). */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, fd, fdy, ft, today, uid } = A;
  const clone = o => JSON.parse(JSON.stringify(o));
  const list = () => { const DB = A.DB(); DB.tasks = DB.tasks || { items: [], hidden: {} }; return DB.tasks.requests = DB.tasks.requests || []; };
  const save = what => A.change('tasks', null, what);
  const sn = id => (A.cfg().staff.find(s => s.id === id) || {}).name || 'Someone';
  const KIND = { holiday: 'Holiday', sick: 'Sickness', training: 'Training', other: 'Other' };
  const canDecide = () => A.can('staff.edit');
  const shiftOn = (st, d) => (st.shifts && d in st.shifts) ? st.shifts[d] : (st.pattern || {})[E.dow(d)];
  const shiftText = (st, d) => { const sh = E.shiftsOf(shiftOn(st, d)); return sh.length ? sh.map(s => `${s.start}–${s.end}`).join(', ') : 'not working'; };
  const what = r => r.offKind === 'sick' ? `Off sick: ${fd(r.from)}${r.to && r.to !== r.from ? ' – ' + fd(r.to) : ''}${r.coverId ? ` · ${esc(sn(r.coverId))} has agreed to cover` : ''}` : r.kind === 'swap'
    ? `Swap ${fdy(r.date)} with ${esc(sn(r.withId))}`
    : `${KIND[r.offKind] || 'Time off'}: ${fd(r.from)}${r.to && r.to !== r.from ? ' – ' + fd(r.to) : ''}${r.start ? ` ${r.start}–${r.end}` : ''}`;
  const badge = r => r.status === 'pending' ? '<span class="badge warn">Waiting</span>' : r.status === 'approved' ? '<span class="badge ok">Approved</span>' : r.status === 'cancelled' ? '<span class="badge">Withdrawn</span>' : '<span class="badge bad">Declined</span>';
  A.pendingRequests = () => list().filter(r => r.status === 'pending');

  // the therapist asks
  async function askOff(sid) {
    const r = await A.modal({ title: 'Ask for time off', ok: 'Send request', body: `<div class="row r2">${A.f.date('from', 'From', E.addD(today(), 7))}${A.f.date('to', 'To (inclusive)', E.addD(today(), 7))}</div>
      <div class="row r2">${A.f.sel('offKind', 'Type', 'holiday', Object.entries(KIND))}${A.f.text('reason', 'Note for the manager', '')}</div>
      <div class="row r2">${A.f.time('start', 'Only part of the day: from', '', { hint: 'Leave blank for whole days' })}${A.f.time('end', 'to', '')}</div>`,
      onOk: m => { const v = A.read(m); if (!v.from) throw new Error('Choose the dates'); if (v.to && v.to < v.from) throw new Error('The end is before the start'); if (v.from < today()) throw new Error('That date has passed'); return v; } });
    if (!r) return;
    list().push({ id: uid('rq'), kind: 'off', staffId: sid, at: new Date().toISOString(), by: St.S.user.name, status: 'pending', from: r.from, to: r.to || r.from, offKind: r.offKind, reason: r.reason, ...(r.start && r.end ? { start: r.start, end: r.end } : {}) });
    save(`Time off requested by ${sn(sid)}: ${r.from} to ${r.to || r.from}`); A.toast('Request sent to the manager'); A.refresh();
  }
  // off sick (user 2026-11-27): goes straight to the manager; a colleague who has agreed to cover can be named
  async function askSick(sid) {
    const cfg = A.cfg(), me = cfg.staff.find(s => s.id === sid), others = cfg.staff.filter(s => s.id !== sid && s.active !== false && (s.treatments || []).length);
    const r = await A.modal({ title: 'I’m off sick', ok: 'Tell the manager', danger: true, body: `<div class="row r2">${A.f.date('from', 'From', today())}${A.f.date('to', 'Until (inclusive)', today())}</div>
      ${A.f.sel('coverId', 'A colleague who has agreed to cover (optional)', '', [['', 'Nobody yet: the manager will sort it']].concat(others.map(s => [s.id, s.name])))}
      ${A.f.text('reason', 'Anything the manager should know', '')}
      <p class="small muted" style="margin-top:8px">The manager is told straight away. Your booked treatments are handed to the colleague (or someone else) when it’s approved; guests keep their times where possible.</p>`,
      onOk: m => { const v = A.read(m); if (!v.from) throw new Error('Choose the dates'); if (v.to && v.to < v.from) throw new Error('The end is before the start'); return v; } });
    if (!r) return;
    list().push({ id: uid('rq'), kind: 'off', offKind: 'sick', urgent: true, staffId: sid, at: new Date().toISOString(), by: St.S.user.name, status: 'pending', from: r.from, to: r.to || r.from, reason: r.reason, coverId: r.coverId || null });
    save(`Off sick: ${sn(sid)} ${r.from}${r.to && r.to !== r.from ? ' to ' + r.to : ''}${r.coverId ? ', covered by ' + sn(r.coverId) : ''}`);
    await St.saveNow();   // so the manager hears about it at once
    A.toast('The manager has been told. Get well soon.'); A.refresh();
  }
  async function askSwap(sid) {
    const cfg = A.cfg(), others = cfg.staff.filter(s => s.id !== sid && s.active !== false);
    if (!others.length) { A.toast('There’s nobody to swap with'); return; }
    const r = await A.modal({ title: 'Ask to swap a shift', ok: 'Send request', body: `<div class="row r2">${A.f.date('date', 'Day', E.addD(today(), 7))}${A.f.sel('withId', 'Swap with', others[0].id, others.map(s => [s.id, s.name]))}</div>${A.f.text('reason', 'Note (e.g. agreed with them already)', '')}
      <p class="small muted" id="swInfo" style="margin-top:8px"></p>`,
      onOpen: m => { const upd = () => { const v = A.read(m), me = cfg.staff.find(s => s.id === sid), them = cfg.staff.find(s => s.id === v.withId); if (!v.date || !them) return; $('#swInfo', m).textContent = `That day: you ${shiftText(me, v.date)}; ${them.name} ${shiftText(them, v.date)}. A swap exchanges these.`; }; $$('input,select', m).forEach(x => x.addEventListener('change', upd)); upd(); },
      onOk: m => { const v = A.read(m); if (!v.date || v.date < today()) throw new Error('Choose a day from today on'); return v; } });
    if (!r) return;
    list().push({ id: uid('rq'), kind: 'swap', staffId: sid, at: new Date().toISOString(), by: St.S.user.name, status: 'pending', date: r.date, withId: r.withId, reason: r.reason });
    save(`Shift swap requested by ${sn(sid)}: ${r.date} with ${sn(r.withId)}`); A.toast('Request sent to the manager'); A.refresh();
  }

  // the manager decides
  async function decide(id, ok) {
    const r = list().find(x => x.id === id); if (!r || r.status !== 'pending') return;
    const cfg = A.cfg(), st = cfg.staff.find(s => s.id === r.staffId);
    let note = '';
    if (!ok) { const m = await A.modal({ title: 'Decline this request?', ok: 'Decline', danger: true, body: A.f.text('note', 'Reason (they’ll see this)', ''), onOk: m2 => A.read(m2) }); if (!m) return; note = m.note || ''; }
    else if (r.kind === 'off') {
      const o = { from: r.from, to: r.to || r.from, kind: r.offKind || 'holiday', reason: r.reason || 'Requested' }; if (r.start) { o.start = r.start; o.end = r.end; }
      const cfg2 = clone(cfg), s2 = cfg2.staff.find(s => s.id === st.id); (s2.off = s2.off || []).push(o);
      // a colleague who agreed to cover works the same hours on those days (if they aren't already working)
      const cover = r.coverId && cfg.staff.find(s => s.id === r.coverId), shifts = {};
      if (cover) for (let d = o.from; d <= o.to; d = E.addD(d, 1)) { const mine = shiftOn(st, d), c2 = cfg2.staff.find(s => s.id === cover.id); if (E.shiftsOf(mine).length && !E.staffDay(cfg, cover, d)) { shifts[d] = clone(mine); (c2.shifts = c2.shifts || {})[d] = clone(mine); } }
      if (!(await A.handleImpacts(cfg2, `${st.name}’s ${o.kind === 'sick' ? 'sick leave' : 'time off'}${cover ? ` (${cover.name} covering)` : ''}`, (b, it) => it.staff === st.id))) return;
      (st.off = st.off || []).push(o); if (cover) Object.entries(shifts).forEach(([d, sh]) => { (cover.shifts = cover.shifts || {})[d] = sh; });
      A.change('cfg', null, `${o.kind === 'sick' ? 'Sick leave' : 'Time off'} approved for ${st.name}: ${o.from} to ${o.to}${cover ? `; ${cover.name} covering ${Object.keys(shifts).length} day(s)` : ''}`);
    } else {
      const them = cfg.staff.find(s => s.id === r.withId); if (!them) { A.toast('That colleague no longer exists'); return; }
      const mine = clone(shiftOn(st, r.date) || null), theirs = clone(shiftOn(them, r.date) || null);
      const cfg2 = clone(cfg), a2 = cfg2.staff.find(s => s.id === st.id), b2 = cfg2.staff.find(s => s.id === them.id);
      (a2.shifts = a2.shifts || {})[r.date] = theirs; (b2.shifts = b2.shifts || {})[r.date] = mine;
      if (!(await A.handleImpacts(cfg2, `the swap on ${fdy(r.date)}`, (b, it) => (it.staff === st.id || it.staff === them.id) && (it.date || b.date) === r.date))) return;
      (st.shifts = st.shifts || {})[r.date] = theirs; (them.shifts = them.shifts || {})[r.date] = mine;
      A.change('cfg', null, `Shift swap approved: ${st.name} and ${them.name} on ${r.date}`);
    }
    Object.assign(r, { status: ok ? 'approved' : 'declined', decidedBy: St.S.user.name, decidedAt: new Date().toISOString(), note });
    save(`Request ${ok ? 'approved' : 'declined'}: ${sn(r.staffId)}`);
    // let them know by email (when we have their address)
    if (st && st.email) St.queue({ type: 'email', to: st.email, internal: true, template: 'request', subject: `Your ${r.kind === 'swap' ? 'shift swap' : 'time off'} request was ${ok ? 'approved' : 'declined'}`,
      body: `Hello ${st.name.split(' ')[0]},\n\n${what(r).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')}: ${ok ? 'approved' : 'declined'} by ${St.S.user.name}.${note ? '\n\n' + note : ''}\n\nYork Cottage Spa` });
    A.toast(ok ? 'Approved' : 'Declined'); A.refresh();
  }

  const rows = (rs, manage) => rs.length ? `<div class="list">${rs.map(r => `<div class="li"><span class="grow"><b>${manage ? esc(sn(r.staffId)) + ' · ' : ''}${what(r)}</b><span class="small muted" style="display:block">Asked ${ft(r.at)}${r.reason ? ' · “' + esc(r.reason) + '”' : ''}${r.decidedBy ? ` · ${r.status} by ${esc(r.decidedBy)}${r.note ? ': ' + esc(r.note) : ''}` : ''}</span>
    ${manage && r.kind === 'swap' && r.status === 'pending' ? (() => { const cfg = A.cfg(), a = cfg.staff.find(s => s.id === r.staffId), b = cfg.staff.find(s => s.id === r.withId); return a && b ? `<span class="small muted" style="display:block">That day: ${esc(a.name)} ${shiftText(a, r.date)}; ${esc(b.name)} ${shiftText(b, r.date)}</span>` : ''; })() : ''}</span>
    ${badge(r)}${manage && r.status === 'pending' && canDecide() ? ` <button class="btn sm pri" data-rqok="${r.id}">Approve</button> <button class="btn sm ghost" data-rqno="${r.id}">Decline</button>` : ''}${!manage && r.status === 'pending' ? ` <button class="btn sm ghost" data-rqx="${r.id}">Withdraw</button>` : ''}</div>`).join('')}</div>` : '<p class="muted">No requests.</p>';
  const wire = el => {
    $$('[data-rqok]', el).forEach(b => b.onclick = () => decide(b.dataset.rqok, true));
    $$('[data-rqno]', el).forEach(b => b.onclick = () => decide(b.dataset.rqno, false));
    $$('[data-rqx]', el).forEach(b => b.onclick = () => { const r = list().find(x => x.id === b.dataset.rqx); if (r) { r.status = 'cancelled'; save('Request withdrawn: ' + sn(r.staffId)); A.refresh(); } });
    $$('[data-askoff]', el).forEach(b => b.onclick = () => askOff(b.dataset.askoff));
    $$('[data-askswap]', el).forEach(b => b.onclick = () => askSwap(b.dataset.askswap));
    $$('[data-asksick]', el).forEach(b => b.onclick = () => askSick(b.dataset.asksick));
  };

  // on a therapist's own day page
  A.requestCard = sid => { const mine = list().filter(r => r.staffId === sid).slice().reverse().slice(0, 8);
    // the buttons sit in the page header (user 2026-11-27); the card only shows when there are requests to see
    return mine.length ? `<div class="card"><div class="card-h"><h3>Time off & shift swap requests</h3></div>${rows(mine, false)}</div>` : ''; };
  A.requestButtons = sid => `<button class="btn sm danger" data-asksick="${sid}">I’m off sick</button><button class="btn sm" data-askoff="${sid}">Ask for time off</button><button class="btn sm" data-askswap="${sid}">Ask to swap a shift</button>`;
  A.wireRequests = wire;

  // the manager's page
  A.views.requests = () => {
    const all = list().slice().reverse(), pend = all.filter(r => r.status === 'pending'), done = all.filter(r => r.status !== 'pending').slice(0, 40);
    const cfg = A.cfg(), t = today(), offNow = cfg.staff.flatMap(s => (s.off || []).filter(o => (o.to || o.from) >= t).map(o => ({ s, o }))).sort((a, b) => a.o.from.localeCompare(b.o.from));
    return { html: `<div class="vh"><div><div class="eyebrow">Team</div><h1>Time off, sickness & swaps</h1><p>Requests from the team, and anyone off now or coming up. Approving time off or sickness checks the booked treatments it affects, so you can hand them to someone else, move them or cancel them; a colleague covering can work the same hours.</p></div>
      ${canDecide() ? `<div class="acts"><select class="inp" id="sickWho" style="width:auto">${cfg.staff.filter(s => s.active !== false).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><button class="btn danger" id="sickGo">Record sickness</button><button class="btn" id="offGo">Add time off</button></div>` : ''}</div>
      <div class="card"><div class="card-h"><h3>Waiting for a decision</h3></div>${rows(pend, true)}</div>
      <div class="card"><div class="card-h"><h3>Off now and coming up</h3></div>${offNow.length ? `<div class="list">${offNow.map(({ s, o }) => `<div class="li"><span class="dot" style="background:${s.colour}"></span><span class="grow"><b>${esc(s.name)} · ${KIND[o.kind] || 'Time off'}</b><span class="small muted" style="display:block">${fd(o.from)}${o.to && o.to !== o.from ? ' – ' + fd(o.to) : ''}${o.start ? ` ${o.start}–${o.end}` : ''}${o.reason ? ' · ' + esc(o.reason) : ''}</span></span>${o.from >= t || o.kind === 'sick' ? `<button class="btn sm" data-cover="${o.from < t ? t : o.from}|10:00|17:00">Add cover</button>` : ''}</div>`).join('')}</div>` : '<p class="muted">Nobody is off.</p>'}</div>
      ${done.length ? `<div class="card"><div class="card-h"><h3>Decided</h3></div>${rows(done, true)}</div>` : ''}`, wire: el => { wire(el);
        const who = () => cfg.staff.find(s => s.id === ($('#sickWho', el) || {}).value);
        const sg = $('#sickGo', el); if (sg) sg.onclick = () => who() && A.timeOff(who(), { kind: 'sick' });
        const og = $('#offGo', el); if (og) og.onclick = () => who() && A.timeOff(who()); } };
  };
})();
