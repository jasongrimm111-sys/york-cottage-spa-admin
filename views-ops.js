/* Day-to-day screens: Today, Calendar, Day, Bookings, Booking, booking editor, Waitlist. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, gbp, fd, fdy, ft, today, uid, PCOL, PINK, DAYS } = A;
  const V = A.views;
  const live = () => A.DB().bookings.filter(E.live);
  const onDate = d => live().filter(b => b.date === d || (b.nights && b.date < d && d < E.addD(b.date, b.nights)) || (b.nights && E.addD(b.date, b.nights) === d));
  const arrivals = d => live().filter(b => b.date === d);
  const inHouse = d => live().filter(b => b.nights && b.date <= d && d < E.addD(b.date, b.nights));
  const departs = d => live().filter(b => b.nights && E.addD(b.date, b.nights) === d);
  const arriveTime = b => { const cfg = A.cfg(), p = cfg.products[b.product]; if (p.kind === 'session' || p.kind === 'private') { const s = E.session(cfg, b.sessionId); return s ? (s.arrive || s.start) : ''; } if (p.kind === 'treat') return (b.items || []).map(i => i.start).sort()[0] || ''; const t = E.stayTimes(cfg, b.product, b.date, b.nights); return t ? t.checkIn : ''; };
  const consultDue = b => (b.guestList || []).filter((g, i) => (b.items || []).some(it => it.guest === i) && g.consult !== 'done').length;
  A.consultDue = consultDue;
  const due = b => Math.round(((b.quote || {}).total - E.paid(b)) * 100) / 100;
  A.due = due;
  const colEv = k => `background:${PCOL[k]};color:${PINK[k] || '#fff'}`;
  A.colEv = colEv;
  const ref = () => { const DB = A.DB(); let r; do r = 'YC-' + Math.floor(Math.random() * 36 ** 6).toString(36).toUpperCase().padStart(6, '0'); while (DB.bookings.some(b => b.ref === r)); return r; };
  const findB = id => A.DB().bookings.find(b => b.id === id || b.ref === id);

  // ---------- emails ----------
  A.siteURL = () => (A.cfg().business.siteUrl || 'https://jasongrimm111-sys.github.io/york-cottage-spa/').replace(/\/?$/, '/');
  A.payURL = (b, amount) => A.siteURL() + `pay.html?ref=${encodeURIComponent(b.ref)}&amt=${(+amount).toFixed(2)}`;
  A.details = b => {
    const cfg = A.cfg(), p = cfg.products[b.product], lines = [`${p.name} · ${A.whenText(b)}`, `${b.guests} guest${b.guests === 1 ? '' : 's'}`];
    const t = p.times ? E.stayTimes(cfg, b.product, b.date, b.nights) : null;
    if (t) lines.push(`Check-in from ${t.checkIn}${t.spa ? ` · spa ${t.spa[0]}–${t.spa[1]}` : ''} · check-out ${t.checkOut}`);
    const s = E.session(cfg, b.sessionId); if (s) lines.push(`Please arrive at ${s.arrive || s.start}`);
    const multiDay = (b.items || []).some(i => i.date && i.date !== b.date);
    if ((b.items || []).length) {
      lines.push('', 'Your treatment times:');
      (b.guestList || []).forEach((g, gi) => {
        const its = (b.items || []).filter(i => i.guest === gi).sort((a, c) => (a.date + a.start).localeCompare(c.date + c.start));
        if (!its.length) return;
        if (b.guests > 1) lines.push(`${g.name || (gi === 0 ? (b.customer || {}).first || 'Guest 1' : 'Guest ' + (gi + 1))}:`);
        its.forEach(i => lines.push(`  ${multiDay ? fd(i.date) + ' ' : ''}${i.start} ${A.tname(i.tid)} (${i.min} min)`));
      });
    }
    return lines.join('\n');
  };
  A.renderEmail = (key, b, extra = {}) => {
    const cfg = A.cfg(), tp = cfg.emails.templates[key]; if (!tp) return null;
    const q = b.quote || E.quote(cfg, b), paid = E.paid(b);
    const vals = { first: (b.customer || {}).first || '', name: A.cust(b), ref: b.ref, product: A.pname(b.product), when: A.whenText(b), details: A.details(b), total: gbp(q.total, 2), paid: gbp(paid, 2),
      due: gbp(extra.amount != null ? extra.amount : due(b), 2), balanceLine: q.balance && paid < q.total ? `\nBalance ${gbp(q.total - paid, 2)} due by ${fdy(q.balanceDue)}` : '', payLink: extra.link || A.payURL(b, extra.amount != null ? extra.amount : due(b)),
      dueDate: q.balanceDue ? fdy(q.balanceDue) : '', reviewLink: cfg.business.googleReviewUrl || cfg.business.website, consultLink: cfg.business.consultUrl || '(we’ll send your consultation form separately)', refundLine: extra.refund ? `\nWe’ve refunded ${gbp(extra.refund, 2)} to your original payment method.` : '', ...extra };
    const fill = s => s.replace(/\{(\w+)\}/g, (m, k) => vals[k] != null ? vals[k] : m);
    return { to: (b.customer || {}).email, subject: fill(tp.subject), body: fill(tp.body) };
  };
  // queue an email (the data repo's GitHub Action sends it); in the demo it is shown instead
  A.sendEmail = async (key, b, extra = {}, show = true) => {
    const m = A.renderEmail(key, b, extra); if (!m || !m.to) { A.toast('No email address on this booking'); return null; }
    const job = St.queue({ type: key === 'pay' || key === 'balance' ? 'paylink' : 'email', template: key, bookingId: b.id, ref: b.ref, amount: extra.amount, ...m });
    (b.emails = b.emails || []).push({ at: job.at, template: key, subject: m.subject, outbox: job.id });
    if (show && St.S.mode === 'demo') await A.modal({ title: 'Email preview', size: 'wide', ok: 'Done', cancel: '', body: `<div class="note info">Demo: in the live portal this is sent by email${key === 'pay' || key === 'balance' ? ', with a real Stripe payment link once Stripe is connected' : ''}.</div><div class="kv"><dt>To</dt><dd>${esc(m.to)}</dd><dt>Subject</dt><dd><b>${esc(m.subject)}</b></dd></div><pre style="white-space:pre-wrap;font-family:inherit;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px">${esc(m.body)}</pre>` });
    return job;
  };

  // ============ TODAY ============
  V.today = (d) => {
    const real = today(), t = /^\d{4}-\d\d-\d\d$/.test(d || '') ? d : real, DB = A.DB(), cfg = A.cfg(), isToday = t === real;
    const rel = isToday ? 'Today' : t < real ? (E.between(t, real) === 1 ? 'Yesterday' : `${E.between(t, real)} days ago`) : (E.between(real, t) === 1 ? 'Tomorrow' : `In ${E.between(real, t)} days`);
    const arr = arrivals(t).sort((a, b) => arriveTime(a).localeCompare(arriveTime(b)));
    const dep = departs(t), house = inHouse(t);
    const items = live().flatMap(b => (b.items || []).filter(i => (i.date || b.date) === t).map(i => ({ ...i, b })));
    const guests = arr.reduce((n, b) => n + b.guests, 0) + house.filter(b => b.date !== t).reduce((n, b) => n + b.guests, 0);
    const roomsUsed = new Set(house.flatMap(b => b.product === 'house' ? cfg.rooms.map(r => r.id) : b.rooms || [])).size, roomsAll = cfg.rooms.filter(r => r.active !== false).length;
    const takings = DB.bookings.flatMap(b => b.payments || []).filter(p => (p.at || '').slice(0, 10) === t).reduce((a, p) => a + p.amount, 0);
    const pend = DB.bookings.filter(b => b.status === 'pending' && b.date >= t);
    const foods = {}; arr.forEach(b => (b.guestList || []).forEach(g => { if (g.food) foods[g.food] = (foods[g.food] || 0) + 1; }));
    arr.filter(b => cfg.products[b.product].foodsIncluded).forEach(b => cfg.products[b.product].foodsIncluded.forEach(f => foods[f] = (foods[f] || 0) + b.guests));
    const bfast = departs(t).concat(house.filter(b => b.date !== t)).filter(b => b.breakfast).reduce((n, b) => n + b.guests, 0);
    // staff today
    const staffToday = cfg.staff.filter(s => E.staffDay(cfg, s, t));
    const next7 = Array.from({ length: 7 }, (_, i) => E.addD(t, i)).map(d => ({ d, n: arrivals(d).reduce((a, b) => a + b.guests, 0) + inHouse(d).filter(b => b.date !== d).reduce((a, b) => a + b.guests, 0) }));
    const mx = Math.max(1, ...next7.map(x => x.n));
    const closedToday = E.closures(cfg, t, ['all', 'spa', 'rooms', 'treatments']);
    const row = b => `<a class="li" href="#/booking/${b.id}"><span class="when">${arriveTime(b) || '—'}</span>${A.prodDot(b.product)}<span class="grow"><b>${esc(A.cust(b))} · ${b.guests} guest${b.guests > 1 ? 's' : ''}</b><span class="small muted">${A.pname(b.product)}${b.rooms && b.rooms.length ? ' · ' + b.rooms.map(r => (cfg.rooms.find(x => x.id === r) || {}).name).join(', ') : ''}${b.notes ? ' · ' + esc(b.notes.slice(0, 60)) : ''}</span></span>${consultDue(b) ? `<span class="badge warn" title="Consultation forms still to complete">${consultDue(b)} form${consultDue(b) > 1 ? 's' : ''}</span>` : ''}${A.statusBadge(b)}${A.arrivalCell(b, t)}</a>`;
    return { html: `<div class="vh"><div><div class="eyebrow">${rel}</div><h1>${isToday ? 'Today' : fdy(t)}</h1>${isToday ? `<p>${fdy(t)}</p>` : ''}</div><div class="acts"><a class="btn" href="#/today/${E.addD(t, -1)}" title="Previous day">${A.ic.left}</a><input type="date" class="inp" id="todayPick" value="${t}" style="width:auto" aria-label="Choose a day"><a class="btn" href="#/today/${E.addD(t, 1)}" title="Next day">${A.ic.right}</a>${isToday ? '' : `<a class="btn" href="#/today">Back to today</a>`}<a class="btn" href="#/day/${t}">${A.ic.cal} Day view</a><a class="btn" href="#/day/${t}/print">${A.ic.print} Run sheet</a></div></div>
      ${closedToday.length ? `<div class="note warn" style="margin-bottom:14px">Closed ${isToday ? 'today' : 'this day'}: ${closedToday.map(c => esc(c.reason || 'closure')).join(', ')}</div>` : ''}
      <div class="grid g4 kpi-side" style="margin-bottom:14px">
        <div class="kpi"><small>Guests ${isToday ? 'today' : 'this day'}</small><b>${guests}</b><span>${arr.length} arrival${arr.length === 1 ? '' : 's'} · ${dep.length} departure${dep.length === 1 ? '' : 's'}</span></div>
        <div class="kpi"><small>Treatments ${isToday ? 'today' : 'this day'}</small><b>${items.length}</b><span>${staffToday.length} therapist${staffToday.length === 1 ? '' : 's'} working</span></div>
        <div class="kpi"><small>Rooms ${isToday ? 'tonight' : 'that night'}</small><b>${roomsUsed}<span style="font-size:20px;color:var(--muted)"> / ${roomsAll}</span></b><span>${Math.round(roomsUsed / roomsAll * 100)}% occupied</span></div>
        <div class="kpi"><small>Taken ${isToday ? 'today' : 'that day'}</small><b>${gbp(takings)}</b><span>${pend.length} booking${pend.length === 1 ? '' : 's'} awaiting payment</span></div>
      </div>
      <div class="grid g-side">
        <div>
          <div class="card"><div class="card-h"><h3>${isToday ? 'Arrivals & sessions' : 'Arrivals & sessions'}</h3><span class="muted small">${arr.length} booking${arr.length === 1 ? '' : 's'}</span></div>
            ${arr.length ? `<div class="list">${arr.map(row).join('')}</div>` : `<div class="empty"><b>No arrivals ${isToday ? 'today' : 'this day'}</b>${isToday ? 'Enjoy the quiet.' : ''}</div>`}</div>
          ${dep.length ? `<div class="card"><div class="card-h"><h3>Departures</h3><span class="muted small">check-out by ${(E.stayTimes(cfg, dep[0].product, dep[0].date, dep[0].nights) || {}).checkOut || '11:00'}</span></div><div class="list">${dep.map(b => `<a class="li" href="#/booking/${b.id}">${A.prodDot(b.product)}<span class="grow"><b>${esc(A.cust(b))}</b><span class="small muted">${A.pname(b.product)} · ${(b.product === 'house' ? ['Whole house'] : (b.rooms || []).map(r => (cfg.rooms.find(x => x.id === r) || {}).name)).join(', ')}</span></span>${due(b) > 0 ? `<span class="badge warn">${gbp(due(b))} to pay</span>` : ''}</a>`).join('')}</div></div>` : ''}
          <div class="card"><div class="card-h"><h3>Treatments</h3><a class="btn sm" href="#/day/${t}">Timeline</a></div>
            ${staffToday.length ? staffToday.map(s => { const mine = items.filter(i => i.staff === s.id).sort((a, b) => a.start.localeCompare(b.start)), d = E.staffDay(cfg, s, t);
              return `<div style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span class="av" style="background:${s.colour}">${A.initials(s.name)}</span><b>${esc(s.name)}</b><span class="muted small">${d.spans.map(x => E.HM(x[0]) + '–' + E.HM(x[1])).join(', ')} · ${mine.length} treatment${mine.length === 1 ? '' : 's'}</span><a class="btn sm ghost" style="margin-left:auto" href="#/staffday/${s.id}/${t}">Their day</a></div>
                ${mine.length ? mine.map(i => `<a class="li" href="#/booking/${i.b.id}" style="padding:6px 0 6px 38px"><span class="when">${i.start}</span><span class="grow"><b>${esc(A.tname(i.tid))}</b><span class="small muted">${esc((i.b.guestList[i.guest] || {}).name || A.cust(i.b))} · ${i.min} min · ${(cfg.treatRooms.find(r => r.id === i.troom) || {}).name || ''}</span></span>${(i.date || i.b.date) >= today() ? `<button class="btn sm" data-mv="${i.b.id}|${i.key}" title="Move to another time or hand to another therapist">Move or hand over</button>` : ''}</a>`).join('') : '<p class="muted small" style="padding-left:38px">Nothing booked yet</p>'}</div>`; }).join('') : `<div class="empty"><b>No therapists working ${isToday ? 'today' : 'that day'}</b></div>`}
          </div>
        </div>
        <div>
          ${(() => { const td = A.todoItems(), n = A.todoCount(); return `<div class="card"><div class="card-h"><h3>To do</h3><a class="badge ${n ? 'warn' : 'ok'}" href="#/todo">${n}</a></div>${td.length ? `<div class="list">${td.slice(0, 5).map(x => `<a class="li" href="${x.href}"><span class="dot" style="background:var(--${x.level === 'ok' ? 'ok' : x.level === 'bad' ? 'bad' : x.level === 'warn' ? 'warn' : 'info'})"></span><span class="grow small"><b>${esc(x.title)}</b></span></a>`).join('')}</div>` : '<p class="muted">Nothing needs attention.</p>'}<a class="btn sm" style="margin-top:10px" href="#/todo">Open the to-do list</a></div>`; })()}
          <div class="card"><div class="card-h"><h3>Food ${isToday ? 'today' : 'that day'}</h3></div>
            ${Object.keys(foods).length || bfast ? `<div class="list">${Object.entries(foods).map(([f, n]) => `<div class="li"><span class="grow">${esc((cfg.foods.find(x => x.id === f) || {}).name || f)}</span><b class="tnum">${n}</b></div>`).join('')}${bfast ? `<div class="li"><span class="grow">Continental breakfast</span><b class="tnum">${bfast}</b></div>` : ''}</div>` : '<p class="muted">No food orders.</p>'}
            <a class="btn sm" style="margin-top:10px" href="#/reports/food">Food orders for the next 2 weeks</a></div>
          <div class="card"><div class="card-h"><h3>The next 7 days</h3><a class="btn sm ghost" href="#/calendar">Calendar</a></div>
            ${next7.map(x => `<a class="hbar" href="#/day/${x.d}" style="text-decoration:none"><span>${fd(x.d)}</span><span class="bar"><i style="width:${x.n / mx * 100}%"></i></span><b>${x.n}</b></a>`).join('')}<p class="small muted">Guests visiting or staying each day</p></div>
        </div>
      </div>`,
      wire: el => { A.wireMove(el); const tp = $('#todayPick', el); if (tp) tp.onchange = () => { if (tp.value) location.hash = '#/today/' + tp.value; }; A.wireArrive(el); } };
  };

  // ============ CALENDAR (month) ============
  V.calendar = (ym) => {
    const cfg = A.cfg(), t = today(); ym = ym || t.slice(0, 7);
    const [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), startW = (first.getDay() + 6) % 7, dim = new Date(y, m, 0).getDate();
    const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1), ymS = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // filter by any mix of booking types (?p=day,break)
    const fl = ((location.hash.split('?p=')[1]) || '').split(',').filter(k => A.cfg().products[k]);
    const show = k => !fl.length || fl.includes(k);
    const toggle = k => { const n = fl.includes(k) ? fl.filter(x => x !== k) : fl.concat([k]); return `#/calendar/${ym}${n.length ? '?p=' + n.join(',') : ''}`; };
    const roomsAll = cfg.rooms.filter(r => r.active !== false).length;
    let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dw">${d}</div>`).join('');
    for (let i = 0; i < startW; i++) cells += '<div class="d out"></div>';
    for (let i = 1; i <= dim; i++) {
      const d = `${ym}-${String(i).padStart(2, '0')}`, arr = arrivals(d).filter(b => show(b.product)), house = inHouse(d).filter(b => show(b.product));
      const closed = E.closedAllDay(cfg, d, ['all']) || !E.hours(cfg, d);
      const cls = E.closures(cfg, d, ['all', 'spa', 'rooms', 'treatments']);
      const evs = [];
      house.filter(b => b.product === 'house').forEach(b => evs.push(`<span class="ev x">Whole house · ${esc(A.cust(b))}</span>`));
      arr.filter(b => cfg.products[b.product].kind === 'private' || b.product === 'group').forEach(b => evs.push(`<span class="ev" style="${colEv(b.product)}">${A.pname(b.product)} · ${b.guests}</span>`));
      const spaG = arr.filter(b => ['session'].includes(cfg.products[b.product].kind)).reduce((n, b) => n + b.guests, 0);
      if (spaG) evs.push(`<span class="ev">${spaG} spa guest${spaG > 1 ? 's' : ''}</span>`);
      const stays = arr.filter(b => b.product === 'break').length; if (stays) evs.push(`<span class="ev stay">${stays} break${stays > 1 ? 's' : ''} arriving</span>`);
      const tr = arr.filter(b => b.product === 'treat').length; if (tr) evs.push(`<span class="ev" style="background:#ebe8f8;color:#3c3290">${tr} treatment booking${tr > 1 ? 's' : ''}</span>`);
      cls.forEach(c => evs.push(`<span class="ev cl">${esc(c.reason || 'Closed')}${c.start ? ' ' + c.start + '–' + c.end : ''}</span>`));
      const roomsUsed = new Set(house.flatMap(b => b.product === 'house' ? cfg.rooms.map(r => r.id) : b.rooms || [])).size;
      const sesPlaces = (cfg.sessions || []).filter(s => s.product === 'day' && s.active !== false && (!s.days || s.days.includes(E.dow(d)))).reduce((n, s) => n + s.cap, 0);
      const ix = A._calIx || null;
      const total = arr.length + house.filter(b => b.date !== d).length;
      cells += `<a class="d ${d === t ? 'today' : ''} ${closed ? 'closed' : ''}" href="#/day/${d}"><span class="n">${i}</span>${evs.slice(0, 4).join('')}${evs.length > 4 ? `<span class="small muted">+${evs.length - 4} more</span>` : ''}<span class="cntm">${total || ''}</span>
        <span class="occ" title="Spa (Day Spa places) · Rooms"><span><i style="width:${sesPlaces ? Math.min(100, spaG / sesPlaces * 100) : 0}%"></i></span><span><i style="width:${roomsUsed / roomsAll * 100}%;background:#9d8fc0"></i></span></span></a>`;
    }
    const tail = (7 - (startW + dim) % 7) % 7; for (let i = 0; i < tail; i++) cells += '<div class="d out"></div>';
    const prods = Object.entries(cfg.products);
    return { html: `<div class="vh"><div><div class="eyebrow">Calendar</div><h1>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h1></div>
      <div class="acts"><a class="btn" href="#/calendar/${ymS(prev)}${fl.length ? '?p=' + fl.join(',') : ''}">${A.ic.left}</a><a class="btn" href="#/calendar/${t.slice(0, 7)}${fl.length ? '?p=' + fl.join(',') : ''}">This month</a><a class="btn" href="#/calendar/${ymS(next)}${fl.length ? '?p=' + fl.join(',') : ''}">${A.ic.right}</a><a class="btn" href="#/rooms/planner">${A.ic.bed} Room planner</a><a class="btn" href="#/rota">${A.ic.rota} Rota</a></div></div>
      <div class="chips" style="margin-bottom:12px;align-items:center"><span class="small muted" style="margin-right:4px">Show:</span><a class="chip ${!fl.length ? 'on' : ''}" href="#/calendar/${ym}">Everything</a>${prods.map(([k, p]) => `<a class="chip ${fl.includes(k) ? 'on' : ''}" href="${toggle(k)}" title="${fl.includes(k) ? 'Hide' : 'Show'} ${esc(p.name)}">${A.prodDot(k)} ${esc(p.name)}</a>`).join('')}${fl.length ? '<span class="small muted" style="margin-left:6px">Tap a type to add or remove it</span>' : ''}</div>
      <div class="mcal">${cells}</div>
      <div class="legend"><span><i style="background:var(--sage)"></i>Day Spa places used</span><span><i style="background:#9d8fc0"></i>Bedrooms used</span><span><i style="background:var(--forest)"></i>Exclusive use</span><span><i style="background:var(--bad-bg);border:1px solid var(--bad)"></i>Closure</span></div>` };
  };

  // ============ DAY ============
  V.day = (d, mode) => {
    const cfg = A.cfg(), DB = A.DB(); d = d || today();
    const ix = E.index(cfg, DB.bookings), arr = arrivals(d), house = inHouse(d), dep = departs(d);
    const prevD = E.addD(d, -1), nextD = E.addD(d, 1);
    const h = E.hours(cfg, d), closures = E.closures(cfg, d, ['all', 'spa', 'rooms', 'treatments']);
    // sessions
    const ses = (cfg.sessions || []).filter(s => s.active !== false && (!s.days || s.days.includes(E.dow(d))));
    const sesCards = Object.keys(cfg.products).filter(k => ses.some(s => s.product === k)).map(k => {
      const list = E.sessions(cfg, ix, k, d, 0);
      return list.map(s => { const bk = arr.filter(b => b.sessionId === s.id), n = bk.reduce((a, b) => a + b.guests, 0), cap = (cfg.sessions.find(x => x.id === s.id) || {}).cap;
        if (cfg.products[k].kind === 'private' && !bk.length) return '';
        return `<div class="ses-card"><div style="display:flex;justify-content:space-between;gap:8px">${A.prodDot(k)}<b style="flex:1">${A.pname(k)} · ${s.name}</b><span class="muted small">${s.start}–${s.end}</span></div>
          <div class="bar"><i style="width:${Math.min(100, n / cap * 100)}%;background:${PCOL[k]}"></i></div><div class="small muted">${n} of ${cap} booked${s.ok ? ` · ${s.left} left` : ` · ${esc(s.why)}`}</div>
          ${bk.map(b => `<a class="li" href="#/booking/${b.id}" style="padding:6px 0"><span class="grow"><b>${esc(A.cust(b))} · ${b.guests}</b></span>${A.statusBadge(b)}</a>`).join('')}</div>`; }).join('');
    }).join('');
    // stays
    const roomName = id => (cfg.rooms.find(r => r.id === id) || {}).name || id;
    const stayRow = (b, tag) => `<a class="li" href="#/booking/${b.id}">${A.prodDot(b.product)}<span class="grow"><b>${esc(A.cust(b))} · ${b.guests}</b><span class="small muted">${A.pname(b.product)} · ${(b.product === 'house' ? ['All rooms'] : (b.rooms || []).map(roomName)).join(', ')}</span></span><span class="badge">${tag}</span></a>`;
    const stays = [...arr.filter(b => b.nights).map(b => stayRow(b, 'Arriving ' + ((E.stayTimes(cfg, b.product, b.date, b.nights) || {}).checkIn || ''))), ...house.filter(b => b.date !== d).map(b => stayRow(b, 'Staying')), ...dep.map(b => stayRow(b, 'Leaving'))];
    // therapist timeline
    const staff = cfg.staff.filter(s => s.active !== false && (E.staffDay(cfg, s, d) || (ix.staff[d] || {})[s.id]));
    const items = live().flatMap(b => (b.items || []).filter(i => (i.date || b.date) === d).map(i => ({ ...i, b })));
    const unassigned = items.filter(i => !i.staff);
    const allT = items.map(i => E.T(i.start)).concat(staff.flatMap(s => { const x = E.staffDay(cfg, s, d); return x ? [x.start, x.end] : []; }));
    const t0 = Math.floor((Math.min(9 * 60, ...allT) - 30) / 60) * 60, t1 = Math.ceil((Math.max(18 * 60, ...allT.map(x => x + 60)) + 30) / 60) * 60, PX = 1.15;
    const y = m => (m - t0) * PX, H = (t1 - t0) * PX;
    const cols = staff.map(s => ({ s, items: items.filter(i => i.staff === s.id), day: E.staffDay(cfg, s, d) })).concat(unassigned.length ? [{ s: { id: '', name: 'No therapist', colour: '#b0413e' }, items: unassigned, day: null }] : []);
    const lines = []; for (let m = t0; m <= t1; m += 30) lines.push(`<div class="tl-line ${m % 60 ? 'half' : ''}" style="top:${y(m)}px"></div>`);
    const nowM = d === today() ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
    const colHtml = c => {
      let o = '';
      if (c.day) {
        let last = t0; for (const sp of c.day.spans) { if (sp[0] > last) o += `<div class="tl-off" style="top:${y(last)}px;height:${(sp[0] - last) * PX}px"></div>`; last = sp[1]; }
        if (last < t1) o += `<div class="tl-off" style="top:${y(last)}px;height:${(t1 - last) * PX}px"></div>`;
        c.day.breaks.forEach(b => o += `<div class="tl-brk" style="top:${y(b[0])}px;height:${(b[1] - b[0]) * PX}px">Break</div>`);
      } else if (c.s.id) o += `<div class="tl-off" style="top:0;height:${H}px"></div>`;
      c.items.forEach(i => { const s = E.T(i.start); o += `<a class="tl-ev" href="#/booking/${i.b.id}" style="top:${y(s)}px;height:${(i.min + (i.buffer || 0)) * PX - 2}px;${colEv(i.b.product)}" title="${esc(A.tname(i.tid))} · ${esc(A.cust(i.b))}"><b>${i.start} ${esc(A.tname(i.tid))}</b>${esc((i.b.guestList[i.guest] || {}).name || A.cust(i.b))} · ${i.min} min<span class="buf" style="height:${(i.buffer || 0) * PX}px"></span>${(i.date || i.b.date) >= today() ? `<button class="tl-mv" data-mv="${i.b.id}|${i.key}" title="Move or hand over" aria-label="Move or hand over">⇄</button>` : ''}</a>`; });
      return o;
    };
    const tl = cols.length ? `<div class="tl"><div class="tl-grid" style="grid-template-columns:56px repeat(${cols.length},minmax(150px,1fr))">
        <div class="tl-head"></div>${cols.map(c => `<div class="tl-head"><span class="av" style="background:${c.s.colour};width:24px;height:24px;font-size:10px">${A.initials(c.s.name)}</span>${esc(c.s.name)}${c.s.id ? `<a class="btn sm ghost" style="margin-left:auto" href="#/staffday/${c.s.id}/${d}">Day sheet</a>` : ''}</div>`).join('')}
        <div class="tl-hours" style="height:${H}px">${Array.from({ length: (t1 - t0) / 60 + 1 }, (_, i) => `<span style="top:${i * 60 * PX}px">${E.HM(t0 + i * 60)}</span>`).join('')}</div>
        ${cols.map(c => `<div class="tl-col" style="height:${H}px">${lines.join('')}${colHtml(c)}${nowM >= t0 && nowM <= t1 ? `<div class="tl-now" style="top:${y(nowM)}px"></div>` : ''}</div>`).join('')}
      </div></div>` : '<div class="empty"><b>No therapists working</b>Add shifts in the rota.</div>';
    const foods = {}; arr.forEach(b => (b.guestList || []).forEach(g => { if (g.food) foods[g.food] = (foods[g.food] || 0) + 1; }));
    const html = `<div class="vh"><div><div class="eyebrow">${d === today() ? 'Today' : 'Day'}</div><h1>${fdy(d)}</h1>${h ? `<p>Spa open ${h.start}–${h.end}</p>` : '<p>Spa closed</p>'}</div>
      <div class="acts"><a class="btn" href="#/day/${prevD}">${A.ic.left}</a><input type="date" class="inp" id="dayPick" value="${d}" style="width:auto"><a class="btn" href="#/day/${nextD}">${A.ic.right}</a><a class="btn" href="#/day/${today()}">Today</a><button class="btn" onclick="print()">${A.ic.print} Print</button>${d >= today() ? `<a class="btn pri" href="#/new?date=${d}">${A.ic.plus} Book this day</a>` : ''}</div></div>
      ${closures.length ? `<div class="note warn" style="margin-bottom:14px">${closures.map(c => `<b>${esc(c.reason || 'Closed')}</b> (${c.scope.map(s => s.replace('product:', '')).join(', ')}${c.start ? ' ' + c.start + '–' + c.end : ''})`).join(' · ')}</div>` : ''}
      <div class="grid g-side">
        <div><h3 style="margin-bottom:10px">Therapists</h3>${tl}</div>
        <div>
          <div class="card"><div class="card-h"><h3>Spa sessions</h3></div>${sesCards ? `<div class="grid" style="gap:10px">${sesCards}</div>` : '<p class="muted">No spa sessions today.</p>'}</div>
          <div class="card"><div class="card-h"><h3>Stays</h3><a class="btn sm ghost" href="#/rooms/planner">Planner</a></div>${stays.length ? `<div class="list">${stays.join('')}</div>` : '<p class="muted">No stays.</p>'}</div>
          ${(() => { const out = dep.map(b => ({ b, kind: 'out' })).concat(arr.filter(b => b.nights).map(b => ({ b, kind: 'in' }))); if (!out.length) return '';
            const rooms = x => x.b.product === 'house' ? cfg.rooms.filter(r => r.active !== false).map(r => r.id) : (x.b.rooms || []);
            return `<div class="card"><div class="card-h"><h3>Housekeeping</h3><span class="small muted">tick when done</span></div>${out.flatMap(x => rooms(x).map(r => `<label class="li chk" style="cursor:pointer"><input type="checkbox" data-hk="${x.b.id}|${x.kind}|${r}" ${((x.b.hk || {})[x.kind + r]) ? 'checked' : ''}> <span class="grow"><b>${esc(roomName(r))}</b><span class="small muted">${x.kind === 'out' ? 'Clean after check-out' : 'Ready for ' + esc(A.cust(x.b)) + ' by ' + ((E.stayTimes(cfg, x.b.product, x.b.date, x.b.nights) || {}).checkIn || '')}</span></span></label>`)).join('')}</div>`; })()}
          <div class="card"><div class="card-h"><h3>Treatments only</h3></div>${arr.filter(b => b.product === 'treat').map(b => `<a class="li" href="#/booking/${b.id}"><span class="when">${arriveTime(b)}</span><span class="grow"><b>${esc(A.cust(b))}</b><span class="small muted">${(b.items || []).map(i => esc(A.tname(i.tid))).join(', ')}</span></span>${A.statusBadge(b)}</a>`).join('') || '<p class="muted">None.</p>'}</div>
          <div class="card"><div class="card-h"><h3>Food</h3></div>${Object.entries(foods).map(([f, n]) => `<div class="li"><span class="grow">${esc((cfg.foods.find(x => x.id === f) || {}).name || f)}</span><b>${n}</b></div>`).join('') || '<p class="muted">No food orders.</p>'}</div>
        </div>
      </div>`;
    return { html, wire: el => { A.wireMove(el); $$('[data-hk]', el).forEach(c => c.onchange = () => { const [id, kind, r] = c.dataset.hk.split('|'), b = A.DB().bookings.find(x => x.id === id); b.hk = b.hk || {}; b.hk[kind + r] = c.checked; A.change('booking', b, `Housekeeping: ${roomName(r)} ${kind === 'out' ? 'cleaned' : 'ready'}`); }); $('#dayPick', el).onchange = e => { if (e.target.value) location.hash = '#/day/' + e.target.value; }; if (mode === 'print') setTimeout(() => print(), 300); } };
  };

  // ============ BOOKINGS list ============
  V.bookings = () => {
    const cfg = A.cfg(), DB = A.DB(), t = today();
    const F = A._bf = A._bf || { q: '', when: 'upcoming', status: '', product: '', source: '' };
    const match = b => {
      if (F.when === 'today' && b.date !== t) return false;
      if (F.when === 'upcoming' && b.date < t) return false;
      if (F.when === 'past' && b.date >= t) return false;
      if (F.when === 'week' && (b.date < t || b.date > E.addD(t, 7))) return false;
      if (F.status === 'pending' && b.status !== 'pending') return false;
      if (F.status === 'cancelled' && b.status !== 'cancelled') return false;
      if (F.status === 'owing' && !(E.live(b) && due(b) > 0.009)) return false;
      if (F.status === 'enquiry' && b.status !== 'enquiry') return false;
      if (F.product && b.product !== F.product) return false;
      if (F.source && b.source !== F.source) return false;
      if (F.q) { const s = [b.ref, A.cust(b), b.customer && b.customer.email, b.customer && b.customer.phone, b.notes].join(' ').toLowerCase(); if (!s.includes(F.q.toLowerCase())) return false; }
      return true;
    };
    const list = DB.bookings.filter(match).sort((a, b) => F.when === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date) || arriveTime(a).localeCompare(arriveTime(b)));
    const shown = list.slice(0, 300);
    const sum = list.filter(E.live).reduce((a, b) => a + (b.quote || {}).total, 0);
    const sel = (k, opts) => `<select class="inp" data-f="${k}" style="width:auto">${opts.map(([v, tx]) => `<option value="${v}" ${F[k] === v ? 'selected' : ''}>${tx}</option>`).join('')}</select>`;
    return { html: `<div class="vh"><div><div class="eyebrow">Bookings</div><h1>Bookings</h1><p>${list.length} booking${list.length === 1 ? '' : 's'} · ${gbp(sum)} booked</p></div>
      <div class="acts"><button class="btn" id="bCsv">${A.ic.dl} Export CSV</button><a class="btn pri" href="#/new">${A.ic.plus} New booking</a></div></div>
      <div class="card" style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <input class="inp" data-f="q" placeholder="Name, email, phone or reference" value="${esc(F.q)}" style="flex:1;min-width:200px">
        ${sel('when', [['upcoming', 'Upcoming'], ['today', 'Today'], ['week', 'Next 7 days'], ['past', 'Past'], ['all', 'All dates']])}
        ${sel('status', [['', 'Any status'], ['pending', 'Awaiting payment'], ['owing', 'Money owed'], ['enquiry', 'Enquiries'], ['cancelled', 'Cancelled']])}
        ${sel('product', [['', 'All types'], ...Object.entries(cfg.products).map(([k, p]) => [k, p.name])])}
        ${sel('source', [['', 'Any source'], ['web', 'Website'], ['phone', 'Phone'], ['email', 'Email'], ['walk-in', 'Walk-in'], ['admin', 'Admin']])}
      </div>
      <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Booking</th><th>Guest</th><th class="r">Guests</th><th class="r">Total</th><th class="r">To pay</th><th>Status</th></tr></thead><tbody>
      ${shown.map(b => `<tr class="click" data-go="${b.id}"><td class="tnum"><b>${fd(b.date)}</b><br><span class="small muted">${arriveTime(b)}${b.nights ? ' · ' + b.nights + 'n' : ''}</span></td><td>${A.prodDot(b.product)} ${esc(A.pname(b.product))}<br><span class="small muted">${b.ref}${b.source && b.source !== 'web' ? ' · ' + b.source : ''}</span></td><td>${b.customer && b.customer.email ? `<a class="guest-link" href="#/customer/${encodeURIComponent(b.customer.email.toLowerCase())}" title="See all their bookings">${esc(A.cust(b))}</a>` : `<b>${esc(A.cust(b))}</b>`}<br><span class="small muted">${esc((b.customer || {}).email || '')}</span></td><td class="r">${b.guests}</td><td class="r tnum">${gbp((b.quote || {}).total)}</td><td class="r tnum">${E.live(b) && due(b) > 0.009 ? gbp(due(b)) : '—'}</td><td>${A.statusBadge(b)}</td></tr>`).join('') || '<tr><td colspan="7"><div class="empty"><b>No bookings match</b>Try other filters.</div></td></tr>'}
      </tbody></table></div></div>${list.length > shown.length ? `<p class="small muted" style="margin-top:8px">Showing the first ${shown.length}. Narrow the filters or export to see all.</p>` : ''}`,
      wire: el => {
        $$('[data-f]', el).forEach(i => { i[i.tagName === 'INPUT' ? 'oninput' : 'onchange'] = () => { F[i.dataset.f] = i.value; clearTimeout(A._bfT); A._bfT = setTimeout(() => { A.refresh(); const q = $('[data-f=q]'); if (i.dataset.f === 'q') { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, i.tagName === 'INPUT' ? 250 : 0); }; });
        $$('[data-go]', el).forEach(r => r.onclick = e => { if (e.target.closest('a')) return; location.hash = '#/booking/' + r.dataset.go; });
        $('#bCsv', el).onclick = () => A.csv(`bookings-${t}.csv`, [['Reference', 'Status', 'Type', 'Date', 'Nights', 'Session', 'Guests', 'First name', 'Last name', 'Email', 'Phone', 'Total', 'Paid', 'To pay', 'Source', 'Created', 'Notes'],
          ...list.map(b => [b.ref, b.status, A.pname(b.product), b.date, b.nights || '', (E.session(cfg, b.sessionId) || {}).name || '', b.guests, (b.customer || {}).first, (b.customer || {}).last, (b.customer || {}).email, (b.customer || {}).phone, (b.quote || {}).total, E.paid(b), due(b), b.source, (b.created || '').slice(0, 10), b.notes || ''])]);
      } };
  };

  // ============ ONE BOOKING ============
  V.booking = id => {
    const b = findB(id); if (!b) return '<div class="empty"><b>Booking not found</b><a href="#/bookings">Back to bookings</a></div>';
    const cfg = A.cfg(), p = cfg.products[b.product], q = b.quote || E.quote(cfg, b), paid = E.paid(b), owe = Math.round((q.total - paid) * 100) / 100;
    const times = p.times ? E.stayTimes(cfg, b.product, b.date, b.nights) : null, ses = E.session(cfg, b.sessionId);
    const roomName = id => (cfg.rooms.find(r => r.id === id) || {}).name || id;
    const emails = A.DB().outbox.filter(o => o.bookingId === b.id);
    const other = A.DB().bookings.filter(x => x.id !== b.id && x.customer && b.customer && x.customer.email && x.customer.email.toLowerCase() === (b.customer.email || '').toLowerCase());
    const isPast = E.addD(b.date, b.nights || 0) < today(), custLink = b.customer && b.customer.email ? '#/customer/' + encodeURIComponent(b.customer.email.toLowerCase()) : '';
    const html = `<div class="vh"><div><div class="eyebrow">${b.ref} · ${esc(p.name)}${isPast ? ' · past visit' : ''}</div><h1>${custLink ? `<a href="${custLink}" class="h1-link" title="See all their bookings">${esc(A.cust(b)) || 'Booking'}</a>` : esc(A.cust(b)) || 'Booking'}</h1><p>${A.whenText(b)} · ${b.guests} guest${b.guests === 1 ? '' : 's'} &nbsp;${A.statusBadge(b)}${b.arrived ? ' <span class="badge ok">Arrived</span>' : ''}</p></div>
      <div class="acts">${b.status !== 'cancelled' ? `<a class="btn" href="#/edit/${b.id}">${A.ic.edit} Edit or move</a>${owe > 0.009 ? `<button class="btn pri" id="takePay">Take payment</button><button class="btn" id="payLink">${A.ic.mail} Send payment link</button>` : ''}${paid > 0 ? '<button class="btn" id="refund">Refund</button>' : ''}${isPast ? '' : '<button class="btn danger" id="cancelB">Cancel booking</button>'}` : `${isPast ? '' : '<button class="btn" id="reinstate">Reinstate</button>'}${paid > 0 ? '<button class="btn" id="refund">Refund</button>' : ''}`}
        <button class="btn" id="dupB">${A.ic.copy} Book again</button><button class="btn" onclick="print()">${A.ic.print}</button></div></div>
      ${b.sample ? '<div class="note" style="margin-bottom:14px">Sample booking for the demo. Remove all sample data in Settings → Backup & data.</div>' : ''}
      ${b.status === 'pending' ? `<div class="note warn" style="margin-bottom:14px">Waiting for payment${b.payLink ? ` · link sent ${ft(b.payLink.sent)}` : ''}. The space is held.${b.payLink && b.payLink.expires ? ` The link expires ${fdy(b.payLink.expires)}.` : ''}</div>` : ''}
      ${b.status === 'enquiry' ? '<div class="note info" style="margin-bottom:14px">An enquiry: it doesn’t hold the space. Edit it and choose “Confirm” or send a payment link to book it.</div>' : ''}
      ${b.status === 'cancelled' && b.cancelled ? `<div class="note bad" style="margin-bottom:14px">Cancelled ${ft(b.cancelled.at)}${b.cancelled.reason ? ' · ' + esc(b.cancelled.reason) : ''}${b.cancelled.by ? ' · by ' + esc(b.cancelled.by) : ''}</div>` : ''}
      <div class="grid g-side">
        <div>
          <div class="card"><div class="card-h"><h3>The visit</h3></div><dl class="kv">
            <dt>Booking</dt><dd>${A.prodDot(b.product)} ${esc(p.name)}</dd>
            <dt>When</dt><dd>${A.whenText(b)}</dd>
            ${ses ? `<dt>Arrive</dt><dd>${ses.arrive || ses.start} · session ${ses.start}–${ses.end}</dd>` : ''}
            ${times ? `<dt>Times</dt><dd>Check-in from ${times.checkIn}${times.spa ? ` · spa ${times.spa[0]}–${times.spa[1]}` : ''}${times.food ? ` · food ${times.food}` : ''} · check-out ${times.checkOut}</dd>` : ''}
            ${b.nights ? `<dt>Rooms</dt><dd>${b.product === 'house' ? 'The whole house (all rooms)' : (b.rooms || []).map(roomName).join(', ') || '<span class="badge bad">No rooms</span>'}</dd>` : ''}
            ${b.breakfast ? `<dt>Breakfast</dt><dd>Continental, ${b.guests} × ${b.nights} morning${b.nights > 1 ? 's' : ''}</dd>` : ''}
            ${b.blueLight ? '<dt>Blue Light Card</dt><dd>Included treatments upgraded to 30 minutes · check the card on arrival</dd>' : ''}
            ${b.tags && b.tags.length ? `<dt>Tags</dt><dd>${b.tags.map(t => `<span class="badge">${esc(t)}</span>`).join(' ')}</dd>` : ''}
            ${b.notes ? `<dt>Guest notes</dt><dd>${esc(b.notes)}</dd>` : ''}
            ${b.internal ? `<dt>Staff notes</dt><dd>${esc(b.internal)}</dd>` : ''}
            <dt>Source</dt><dd>${esc(b.source || 'admin')} · made ${ft(b.created)}</dd></dl></div>
          <div class="card"><div class="card-h"><h3>Guests & treatments</h3><span class="small muted">Tick consultation forms as they come in</span></div>
            ${(b.guestList || []).map((g, i) => { const its = (b.items || []).filter(x => x.guest === i).sort((a, c) => a.start.localeCompare(c.start));
              return `<div class="gcard"><div class="gcard-h"><span class="av" style="background:var(--sage)">${i + 1}</span><b style="flex:1">${esc(g.name || (i === 0 ? A.cust(b) : 'Guest ' + (i + 1)))}</b>${g.food ? `<span class="badge">${esc((cfg.foods.find(f => f.id === g.food) || {}).name || g.food)}</span>` : ''}
                ${its.length ? `<label class="chk small"><input type="checkbox" data-consult="${i}" ${g.consult === 'done' ? 'checked' : ''}> Consultation form done</label>` : ''}</div>
                ${its.map(it => `<div class="li" style="padding:6px 0"><span class="when">${it.start}</span><span class="grow"><b>${esc(A.tname(it.tid))}</b><span class="small muted">${it.min} min · ${it.staff ? `<span class="dot" style="background:${A.scol(it.staff)}"></span> ${esc(A.sname(it.staff))}` : '<span class="badge bad">No therapist</span>'} · ${esc((cfg.treatRooms.find(r => r.id === it.troom) || {}).name || '')}</span></span>${!/-inc/.test(it.key) && E.tr(cfg, it.tid) ? `<span class="tnum">${gbp(E.tr(cfg, it.tid).price)}</span>` : '<span class="small muted">included</span>'}</div>`).join('') || '<p class="small muted">No treatments</p>'}</div>`; }).join('')}
          </div>
          <div class="card"><div class="card-h"><h3>Payments</h3><span>${paid ? gbp(paid, 2) + ' paid' : 'Nothing paid yet'}</span></div>
            ${(b.payments || []).length ? `<table class="tbl"><tbody>${b.payments.map(x => `<tr><td>${ft(x.at)}</td><td>${x.amount < 0 ? 'Refund' : 'Payment'} · ${esc(x.method || '')}${x.note ? ' · ' + esc(x.note) : ''}${x.by ? `<br><span class="small muted">by ${esc(x.by)}</span>` : ''}</td><td class="r tnum"><b>${gbp(x.amount, 2)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No payments recorded.</p>'}</div>
          <div class="card"><div class="card-h"><h3>Emails</h3>${b.customer && b.customer.email ? `<button class="btn sm" id="resend">Send confirmation</button>` : ''}</div>
            ${emails.length ? `<div class="list">${emails.slice().reverse().map(o => `<div class="li"><span class="grow"><b>${esc(o.subject || o.template)}</b><span class="small muted">${ft(o.at)} · ${esc(o.by || '')}</span></span><span class="badge ${o.status === 'sent' ? 'ok' : o.status === 'failed' ? 'bad' : 'info'}">${o.status === 'demo' ? 'Demo' : o.status}</span></div>`).join('')}</div>` : '<p class="muted">No emails yet.</p>'}</div>
          <div class="card"><div class="card-h"><h3>History</h3></div><div class="list">${(b.history || []).slice().reverse().map(x => `<div class="li small"><span class="grow">${esc(x.what)}</span><span class="muted">${ft(x.at)} · ${esc(x.by || '')}</span></div>`).join('')}</div></div>
        </div>
        <div>
          <div class="card be-sum"><div class="card-h"><h3>Price</h3></div><div class="lines">${q.lines.map(l => `<div><span>${esc(l.label)}</span><span class="tnum">${gbp(l.amount, 2)}</span></div>`).join('')}</div>
            <div class="tot"><span>Total</span><b>${gbp(q.total, 2)}</b></div>
            <div class="lines" style="margin-top:6px"><div><span>Paid</span><span class="tnum">${gbp(paid, 2)}</span></div>${b.status !== 'cancelled' ? `<div><b>${owe < 0 ? 'Refund due' : 'Still to pay'}</b><b class="tnum">${gbp(Math.abs(owe), 2)}</b></div>` : ''}
              ${q.balance && q.balanceDue && owe > 0 ? `<div class="small muted"><span>${q.deposit < q.total ? `Deposit ${gbp(q.deposit)} · balance due ${fdy(q.balanceDue)}` : ''}</span></div>` : ''}${q.damage ? `<div class="small muted"><span>£${q.damage} damage deposit to pre-authorise before arrival</span></div>` : ''}</div>
            ${b.status !== 'cancelled' && b.date >= today() ? `<p class="small muted" style="margin-top:10px">If cancelled now: ${esc(E.cancelTerms(cfg, b).text.replace(/^Cancelling /, '').replace(/^on the day/i, 'on the day'))}</p>` : ''}</div>
          <div class="card"><div class="card-h"><h3>Guest</h3>${b.customer && b.customer.email ? `<a class="btn sm ghost" href="#/customer/${encodeURIComponent(b.customer.email.toLowerCase())}">Profile</a>` : ''}</div>
            <dl class="kv" style="grid-template-columns:70px 1fr"><dt>Name</dt><dd>${esc(A.cust(b))}</dd><dt>Email</dt><dd>${b.customer && b.customer.email ? `<a href="mailto:${esc(b.customer.email)}">${esc(b.customer.email)}</a>` : '—'}</dd><dt>Phone</dt><dd>${b.customer && b.customer.phone ? `<a href="tel:${esc(b.customer.phone)}">${esc(b.customer.phone)}</a>` : '—'}</dd></dl>
            ${other.length ? `<a class="btn sm" style="margin-top:10px" href="${custLink}">See their ${other.length} other booking${other.length > 1 ? 's' : ''}</a>` : '<p class="small muted" style="margin-top:8px">First booking with us</p>'}</div>
          ${b.status !== 'cancelled' ? `<div class="card"><div class="fld"><span>Arrival</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${A.arrivalCell(b)}</div></div>
            ${b.date <= today() && !b.arrived ? `<label class="sw" style="margin-top:10px"><input type="checkbox" id="noShowT" ${b.noShow ? 'checked' : ''}> Didn’t turn up (no-show)</label><p class="small muted" style="margin-top:4px">Keeps the payment under the terms and shows in the reports.</p>` : ''}
            ${q.damage ? `<div class="hr"></div><div class="fld"><span>£${q.damage} damage deposit</span><select class="inp" id="dmgS"><option value="">Not taken yet</option><option value="held" ${(b.damage || {}).status === 'held' ? 'selected' : ''}>Pre-authorised on their card</option><option value="released" ${(b.damage || {}).status === 'released' ? 'selected' : ''}>Released after check-out</option><option value="charged" ${(b.damage || {}).status === 'charged' ? 'selected' : ''}>Charged (damage)</option></select><small>Release within 48 hours of check-out.</small></div>` : ''}</div>` : ''}
        </div>
      </div>`;
    return { html, wire: el => {
      const save = what => { b.updated = new Date().toISOString(); (b.history = b.history || []).push({ at: b.updated, by: St.S.user.name, what }); A.change('booking', b, what + ' · ' + b.ref); A.refresh(); };
      $$('[data-consult]', el).forEach(c => c.onchange = () => { b.guestList[+c.dataset.consult].consult = c.checked ? 'done' : 'needed'; save(`Consultation form ${c.checked ? 'done' : 'not done'} for guest ${+c.dataset.consult + 1}`); });
      A.wireArrive(el);
      const ns = $('#noShowT', el); if (ns) ns.onchange = () => { b.noShow = ns.checked; save(ns.checked ? 'Marked as a no-show' : 'No-show removed'); };
      const dm = $('#dmgS', el); if (dm) dm.onchange = () => { b.damage = { status: dm.value, at: new Date().toISOString() }; save('Damage deposit: ' + (dm.selectedOptions[0].textContent)); };
      const tp = $('#takePay', el); if (tp) tp.onclick = () => A.takePayment(b);
      const pl = $('#payLink', el); if (pl) pl.onclick = () => A.payLinkDialog(b);
      const rf = $('#refund', el); if (rf) rf.onclick = () => A.refundDialog(b);
      const cb = $('#cancelB', el); if (cb) cb.onclick = () => A.cancelDialog(b);
      const rs = $('#resend', el); if (rs) rs.onclick = async () => { await A.sendEmail('confirm', b); save('Confirmation emailed'); A.toast('Confirmation queued'); };
      const ri = $('#reinstate', el); if (ri) ri.onclick = async () => {
        const chk = E.dateCheck(A.cfg(), E.index(A.cfg(), A.DB().bookings, b.id), { product: b.product, date: b.date, nights: b.nights, guests: b.guests, admin: true });
        if (!chk.ok && !(await A.confirm('Space may be taken', `The date check says: ${chk.why}. Reinstate anyway?`, 'Reinstate'))) return;
        b.status = E.paid(b) >= (b.quote || {}).total ? 'confirmed' : 'pending'; delete b.cancelled; save('Booking reinstated');
      };
      $('#dupB', el).onclick = () => { A._dup = b; location.hash = '#/new?dup=' + b.id; };
    } };
  };

  // arrival: a clear status, and one button that says what it does
  A.arrivalCell = (b, day) => {
    const t = today();
    if (b.noShow) return '<span class="arr-st bad">No-show</span>';
    if (b.arrived) return `<span class="arr-st ok">✓ Arrived${b.arrivedAt ? ' ' + new Date(b.arrivedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</span>${(day || b.date) >= E.addD(t, -1) ? `<button class="btn sm ghost" data-arr="${b.id}" title="Mark as not arrived">Undo</button>` : ''}`;
    if (b.date > t) return '<span class="arr-st">Due ' + fd(b.date) + '</span>';
    if (b.date < t) return `<span class="arr-st wait">Not marked</span><button class="btn sm" data-arr="${b.id}">Arrived</button><button class="btn sm ghost" data-ns="${b.id}" title="Didn’t turn up">No-show</button>`;
    return `<span class="arr-st wait">Not arrived yet</span><button class="btn sm pri" data-arr="${b.id}">Mark as arrived</button>`;
  };
  A.wireArrive = el => { $$('[data-ns]', el).forEach(btn => btn.onclick = e => { e.preventDefault(); e.stopPropagation(); const b = findB(btn.dataset.ns); b.noShow = true; (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: 'Marked as a no-show' }); A.change('booking', b, 'No-show: ' + b.ref); A.refresh(); }); wireArr(el); };
  const wireArr = el => $$('[data-arr]', el).forEach(btn => btn.onclick = e => { e.preventDefault(); e.stopPropagation(); const b = findB(btn.dataset.arr); b.arrived = !b.arrived; b.arrivedAt = b.arrived ? new Date().toISOString() : null; if (b.arrived) b.noShow = false; (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: b.arrived ? 'Marked as arrived' : 'Arrival undone' }); A.change('booking', b, (b.arrived ? 'Arrived: ' : 'Arrival undone: ') + b.ref); A.refresh(); });
  // move / hand over buttons on Today, the day timeline and day sheets
  A.wireMove = el => $$('[data-mv]', el).forEach(btn => btn.onclick = e => { e.preventDefault(); e.stopPropagation(); const [bid, key] = btn.dataset.mv.split('|'); A.moveItem(A.DB().bookings.find(x => x.id === bid), key); });

  // ---------- payments ----------
  A.takePayment = async (b, preset) => {
    const cfg = A.cfg(), owe = due(b), q = b.quote;
    const sug = q.deposit < q.total && E.paid(b) < q.deposit ? q.deposit - E.paid(b) : owe;
    const r = await A.modal({ title: 'Take a payment', body: `<p class="muted">${esc(A.cust(b))} · ${b.ref} · still to pay ${gbp(owe, 2)}</p>
      <div class="row r2">${A.f.money('amount', 'Amount', (preset && preset.amount) || Math.round(sug * 100) / 100)}${A.f.sel('method', 'Paid by', 'card terminal', [['card terminal', 'Card machine'], ['cash', 'Cash'], ['bank transfer', 'Bank transfer'], ['card', 'Card online (Stripe)'], ['klarna', 'Klarna'], ['voucher', 'Gift voucher'], ['cheque', 'Cheque']])}</div>
      <div id="vRow" hidden>${A.f.text('voucher', 'Voucher code', '', { ph: 'YCV-…' })}<small class="muted" id="vInfo"></small></div>${A.f.text('note', 'Note', '', { ph: 'Optional, e.g. terminal receipt number' })}`,
      ok: 'Record payment', onOpen: m => { const s = $('[data-k=method]', m), vr = $('#vRow', m); s.onchange = () => vr.hidden = s.value !== 'voucher'; const vi = $('[data-k=voucher]', m); vi.oninput = () => { const v = A.DB().vouchers.find(x => x.code.toUpperCase() === vi.value.trim().toUpperCase()); $('#vInfo', m).textContent = v ? `${v.name} · ${gbp(v.balance)} left · ${v.status}${v.expires < today() ? ' · EXPIRED ' + v.expires : ''}` : vi.value.length > 4 ? 'No voucher with that code' : ''; }; },
      onOk: m => { const v = A.read(m); if (!(v.amount > 0)) throw new Error('Enter an amount');
        if (v.method === 'voucher') { const vo = A.DB().vouchers.find(x => x.code.toUpperCase() === (v.voucher || '').toUpperCase()); if (!vo) throw new Error('Voucher not found'); if (vo.status !== 'active') throw new Error('That voucher is ' + vo.status); if (vo.balance < v.amount) throw new Error(`The voucher only has ${gbp(vo.balance)} left`); vo.balance = Math.round((vo.balance - v.amount) * 100) / 100; (vo.uses = vo.uses || []).push({ at: new Date().toISOString(), amount: v.amount, ref: b.ref }); if (!vo.balance) vo.status = 'used'; A.change('vouchers', null, `Voucher ${vo.code}: ${gbp(v.amount)} used on ${b.ref}`); v.note = (v.note ? v.note + ' · ' : '') + vo.code; }
        return v; } });
    if (!r) return;
    const at = new Date().toISOString();
    (b.payments = b.payments || []).push({ id: uid('pay'), at, amount: r.amount, method: r.method, note: r.note, kind: 'payment', by: St.S.user.name });
    const wasPending = b.status === 'pending' || b.status === 'enquiry';
    if (wasPending) b.status = 'confirmed';
    (b.history = b.history || []).push({ at, by: St.S.user.name, what: `Payment ${gbp(r.amount, 2)} (${r.method})` });
    A.change('booking', b, `Payment ${gbp(r.amount, 2)} on ${b.ref}`);
    if (wasPending && b.customer && b.customer.email && A.cfg().emails.templates.confirm.on && await A.confirm('Send the confirmation?', `Email the booking confirmation to ${esc(b.customer.email)}?`, 'Send it', false)) await A.sendEmail('confirm', b);
    A.toast('Payment recorded'); A.refresh();
  };
  A.payLinkDialog = async b => {
    const owe = due(b), q = b.quote, sug = q.deposit < q.total && E.paid(b) < q.deposit ? q.deposit - E.paid(b) : owe;
    if (!b.customer || !b.customer.email) { A.toast('Add an email address to the booking first'); return; }
    const r = await A.modal({ title: 'Send a payment link', body: `<p class="muted">We’ll email ${esc(b.customer.email)} a secure Stripe link (card, Apple Pay, Google Pay or Klarna).</p>${A.f.money('amount', 'Amount to ask for', Math.round(sug * 100) / 100, { hint: `Still to pay: ${gbp(owe, 2)}` })}${A.f.sel('days', 'Link works for', '7', [['2', '2 days'], ['7', '7 days'], ['14', '14 days']])}`, ok: 'Send link', onOk: m => { const v = A.read(m); if (!(v.amount > 0)) throw new Error('Enter an amount'); return v; } });
    if (!r) return;
    b.payLink = { sent: new Date().toISOString(), amount: r.amount, expires: E.addD(today(), +r.days) };
    if (b.status === 'enquiry') b.status = 'pending';
    (b.history = b.history || []).push({ at: b.payLink.sent, by: St.S.user.name, what: `Payment link sent for ${gbp(r.amount, 2)}` });
    await A.sendEmail('pay', b, { amount: r.amount, days: r.days });
    A.change('booking', b, `Payment link sent: ${b.ref}`); A.toast('Payment link queued'); A.refresh();
  };
  A.refundDialog = async b => {
    const paid = E.paid(b), stripe = (b.payments || []).some(p => p.method === 'card' || p.method === 'klarna');
    const r = await A.modal({ title: 'Refund', body: `<p class="muted">${gbp(paid, 2)} paid on ${b.ref}.</p><div class="row r2">${A.f.money('amount', 'Refund amount', Math.max(0, -due(b)) || paid)}${A.f.sel('method', 'Refund to', stripe ? 'card' : 'card terminal', [['card', 'Original card / Klarna (Stripe)'], ['card terminal', 'Card machine'], ['cash', 'Cash'], ['bank transfer', 'Bank transfer'], ['voucher', 'Gift voucher credit']])}</div>${A.f.text('note', 'Reason', '')}`,
      ok: 'Refund', danger: true, onOk: m => { const v = A.read(m); if (!(v.amount > 0)) throw new Error('Enter an amount'); if (v.amount > paid + 0.001) throw new Error(`You can refund up to ${gbp(paid, 2)}`); return v; } });
    if (!r) return; A.doRefund(b, r.amount, r.method, r.note); A.toast('Refund recorded'); A.refresh();
  };
  A.doRefund = (b, amount, method, note) => {
    const at = new Date().toISOString();
    b.payments.push({ id: uid('ref'), at, amount: -amount, method, note, kind: 'refund', by: St.S.user.name });
    if (method === 'card') St.queue({ type: 'refund', bookingId: b.id, ref: b.ref, amount, payments: b.payments.filter(p => p.stripe).map(p => p.stripe) });
    if (method === 'voucher') { const code = 'YCV-' + Math.floor(Math.random() * 36 ** 6).toString(36).toUpperCase().padStart(6, '0'); A.DB().vouchers.push({ id: uid('v'), code, product: 'credit', name: 'Credit from ' + b.ref, paid: 0, value: amount, balance: amount, buyer: A.cust(b), recipient: A.cust(b), sold: today(), expires: E.addD(today(), 365), status: 'active', uses: [] }); A.change('vouchers', null, `Credit voucher ${code} for ${gbp(amount)}`); note = (note ? note + ' · ' : '') + 'credit voucher ' + code; b.payments[b.payments.length - 1].note = note; }
    (b.history = b.history || []).push({ at, by: St.S.user.name, what: `Refund ${gbp(amount, 2)} (${method})${note ? ' · ' + note : ''}` });
    A.change('booking', b, `Refund ${gbp(amount, 2)} on ${b.ref}`);
  };
  A.cancelDialog = async b => {
    const cfg = A.cfg(), t = E.cancelTerms(cfg, b);
    const r = await A.modal({ title: 'Cancel this booking?', body: `<div class="note">${esc(t.text)}. Under the terms: refund <b>${gbp(t.refund, 2)}</b>, keep ${gbp(t.keep, 2)}.</div>
      <div class="row r2">${A.f.money('refund', 'Refund now', t.refund, { hint: `Paid so far: ${gbp(E.paid(b), 2)}` })}${A.f.sel('method', 'Refund to', 'card', [['card', 'Original card / Klarna (Stripe)'], ['card terminal', 'Card machine'], ['cash', 'Cash'], ['bank transfer', 'Bank transfer'], ['voucher', 'Gift voucher credit']])}</div>
      ${A.f.sel('reason', 'Reason', 'Guest cancelled', ['Guest cancelled', 'Illness', 'Moved to another date', 'No-show', 'Spa closed', 'Duplicate booking', 'Other'])}
      ${b.customer && b.customer.email ? A.f.chk('email', 'Email the guest that it’s cancelled', true) : ''}`, ok: 'Cancel booking', cancel: 'Keep it', danger: true,
      onOk: m => { const v = A.read(m); if (v.refund > E.paid(b) + 0.001) throw new Error(`You can refund up to ${gbp(E.paid(b), 2)}`); return v; } });
    if (!r) return;
    b.status = 'cancelled'; b.cancelled = { at: new Date().toISOString(), reason: r.reason, by: St.S.user.name };
    (b.history = b.history || []).push({ at: b.cancelled.at, by: St.S.user.name, what: 'Cancelled · ' + r.reason });
    if (r.refund > 0) A.doRefund(b, r.refund, r.method, 'Refund on cancellation');
    A.change('booking', b, 'Cancelled ' + b.ref);
    if (r.email) await A.sendEmail('cancel', b, { refund: r.refund });
    const wl = A.DB().waitlist.filter(w => w.status === 'waiting' && w.date === b.date);
    A.toast(wl.length ? `Cancelled. ${wl.length} on the waitlist for that day.` : 'Booking cancelled');
    A.refresh();
  };

  // ============ BOOKING EDITOR ============
  V.edit = id => editor(findB(id));
  V.new = () => {
    const qs = new URLSearchParams(location.hash.split('?')[1] || '');
    const dup = qs.get('dup') && findB(qs.get('dup'));
    return editor(null, { date: qs.get('date'), product: qs.get('product'), guests: +qs.get('guests') || null, dup, wl: qs.get('wl') && A.DB().waitlist.find(w => w.id === qs.get('wl')), email: qs.get('email') });
  };
  function editor(orig, pre = {}) {
    const cfg = A.cfg(), DB = A.DB(), t = today();
    if (orig === undefined) return '<div class="empty"><b>Booking not found</b></div>';
    const clone = o => JSON.parse(JSON.stringify(o));
    let B;
    if (orig) B = clone(orig);
    else {
      const src = pre.dup || null, wl = pre.wl;
      B = { id: uid('b'), ref: ref(), status: 'confirmed', product: (src && src.product) || (wl && wl.product) || pre.product || 'day', date: (wl && wl.date) || pre.date || null, nights: 0, sessionId: null, guests: (src && src.guests) || (wl && wl.guests) || pre.guests || 2,
        rooms: [], guestList: [], items: [], payments: [], history: [], source: 'phone', tags: [], customer: src ? clone(src.customer) : wl ? { first: wl.name.replace(/^Sample: /, '').split(' ')[0], last: wl.name.split(' ').slice(1).join(' '), email: wl.email, phone: wl.phone } : { first: '', last: '', email: pre.email || '', phone: '' } };
      if (wl) B._wl = wl.id;
    }
    const st = { month: (B.date || t).slice(0, 7), lock: !!orig, override: false, payMode: orig ? null : 'link', pay: { method: 'card terminal', amount: null }, promoMsg: '' };
    const p = () => cfg.products[B.product];
    const ix = () => E.index(cfg, DB.bookings, B.id);
    const fixGuests = () => {
      const P = p(); B.guests = Math.max(1, Math.min(P.max || 16, B.guests || 1));
      while (B.guestList.length < B.guests) B.guestList.push({ name: '', food: null, included: null, extras: [], consult: 'needed' });
      B.guestList.length = B.guests;
      const foods = cfg.foods.filter(f => f.active !== false && f.products.includes(B.product));
      const inc = E.includedFor(cfg, B.product);
      B.guestList.forEach(g => { if (P.food && foods.length && !foods.some(f => f.id === g.food)) g.food = foods[0].id; if (!P.food) g.food = null; if (inc.length && !inc.some(t => t.id === g.included)) g.included = inc[0].id; if (!inc.length) g.included = null; });
      if (P.kind === 'stay' && !(P.nights || []).includes(B.nights)) B.nights = (P.nights || [1])[0];
      if (P.kind === 'house' && !(B.nights >= P.minN)) B.nights = P.minN;
      if (P.kind !== 'stay' && P.kind !== 'house') B.nights = 0;
      
      if (!P.breakfast) B.breakfast = false;
    };
    // works out rooms and treatment times; keeps manual times unless asked to re-plan
    const plan = () => {
      const P = p(), I = ix(), out = { problems: [] };
      if (!B.date) return out;
      const chk = E.dateCheck(cfg, I, { product: B.product, date: B.date, nights: B.nights, guests: B.guests, admin: true });
      out.chk = chk;
      if (!chk.ok && !st.override) out.problems.push(chk.why);
      if (P.kind === 'session' || P.kind === 'private') { const s = (chk.sessions || []).find(x => x.id === B.sessionId); if (!B.sessionId) out.problems.push('Choose a session'); else if (s && !s.ok && !st.override) out.problems.push(`${s.name}: ${s.why}`); }
      if (P.kind === 'stay' || P.kind === 'house') { const r = E.pickRooms(cfg, I, B.product, B.date, B.nights, B.guests, B.rooms); if (r) B.rooms = r; else if (!st.override) out.problems.push('Not enough rooms free'); }
      const needs = E.treatmentNeeds(cfg, B);
      if (P.kind === 'treat') { out.slots = E.treatSlots(cfg, I, B); if (B.treatStart && !out.slots.some(x => x.time === B.treatStart) && !st.lock) out.problems.push(`${B.treatStart} is no longer free`); if (!B.treatStart) out.problems.push('Choose a start time'); }
      if (needs.length && (P.kind !== 'treat' || B.treatStart)) {
        const keep = st.lock && B.items.length && needs.every(n => B.items.some(i => i.key === n.key && i.tid === n.tid));
        if (keep) { B.items = B.items.filter(i => needs.some(n => n.key === i.key)); out.conflicts = checkItems(I); }
        else {
          const sch = E.plan(cfg, I, B);
          if (sch.ok) B.items = sch.items.map(i => ({ ...i }));
          else { B.items = sch.items; out.problems.push(`Can’t fit ${sch.fail.name || 'every treatment'}: ${sch.fail.why}`); out.unfit = sch.fail; }
          st.lock = false;
        }
      } else B.items = [];
      return out;
    };
    // check hand-set times against therapists, rooms and the guest's other treatments
    const checkItems = I => B.items.map(it => [it.key, E.itemCheck(cfg, I, B, it, { date: it.date, start: it.start, staff: it.staff, troom: it.troom })]).filter(x => x[1]);
    fixGuests();
    const render = () => {
      const P = p(), I = ix(); fixGuests(); const pl = plan(); B.quote = E.quote(cfg, B);
      const q = B.quote, paid = E.paid(B);
      const prods = Object.entries(cfg.products).filter(([, x]) => x.active !== false);
      // calendar
      const [yy, mm] = st.month.split('-').map(Number), f1 = new Date(yy, mm - 1, 1), sw = (f1.getDay() + 6) % 7, dim = new Date(yy, mm, 0).getDate();
      let cal = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="dw">${x}</span>`).join('') + '<span></span>'.repeat(sw);
      for (let i = 1; i <= dim; i++) {
        const d = `${st.month}-${String(i).padStart(2, '0')}`, c = E.dateCheck(cfg, I, { product: B.product, date: d, nights: B.nights, guests: B.guests, admin: true });
        const end = B.nights ? E.addD(B.date || '0000', B.nights) : null;
        cal += `<button type="button" data-day="${d}" class="${d === B.date ? 'on' : ''} ${B.date && end && d > B.date && d < end ? 'in' : ''} ${d === t ? 'today' : ''}" ${c.ok || st.override || d === (orig && orig.date) ? '' : 'disabled'} title="${esc(c.ok ? 'Available' : c.why)}">${i}</button>`;
      }
      const sessions = pl.chk && pl.chk.sessions || (B.date && (P.kind === 'session' || P.kind === 'private') ? E.sessions(cfg, I, B.product, B.date, B.guests) : []);
      const foods = cfg.foods.filter(f => f.active !== false && f.products.includes(B.product));
      const extrasAll = cfg.treatments.filter(x => E.sellable(x)), incList = E.includedFor(cfg, B.product), incAll = E.includedPick(cfg, B.product) === 'all';
      const conflicts = pl.conflicts || [];
      const probs = pl.problems.concat(conflicts.map(c => c[1]));
      const itemRow = it => {
        const tr = E.tr(cfg, it.tid), slots = [], wins = E.windows(cfg, B), win = wins.find(w => w[0] === it.date) || wins[0] || [B.date, '09:00', '22:00'];
        const tt = E.treatTimes(cfg, win[0]);
        for (let m = Math.max(E.T(win[1]), E.T(tt.first)); m + it.min <= E.T(win[2]) && m <= E.T(tt.last); m += cfg.rules.slotStep || 15) slots.push(E.HM(m));
        if (!slots.includes(it.start)) slots.unshift(it.start);
        const c = conflicts.filter(x => x[0] === it.key);
        return `<div style="${c.length ? 'background:var(--bad-bg)' : ''}"><b style="min-width:150px">${esc(tr ? tr.name : it.tid)}</b><span class="muted">${it.min} min</span>
          ${wins.length > 1 ? `<select class="inp" data-it="${it.key}" data-fld="date">${wins.map(w => `<option value="${w[0]}" ${w[0] === it.date ? 'selected' : ''}>${fd(w[0])}</option>`).join('')}</select>` : ''}
          <select class="inp" data-it="${it.key}" data-fld="start">${slots.map(s => `<option ${s === it.start ? 'selected' : ''}>${s}</option>`).join('')}</select>
          <select class="inp" data-it="${it.key}" data-fld="staff">${cfg.staff.filter(s => s.active !== false).map(s => `<option value="${s.id}" ${s.id === it.staff ? 'selected' : ''}>${esc(s.name)}${E.canDo(s, it.tid) ? '' : ' (not trained)'}</option>`).join('')}</select>
          <select class="inp" data-it="${it.key}" data-fld="troom">${cfg.treatRooms.filter(r => r.active !== false).map(r => `<option value="${r.id}" ${r.id === it.troom ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
          ${c.map(x => `<span class="badge bad">${esc(x[1])}</span>`).join('')}</div>`;
      };
      const html = `<div class="vh"><div><div class="eyebrow">${orig ? 'Edit ' + B.ref : 'New booking'}</div><h1>${orig ? esc(A.cust(B)) || 'Edit booking' : 'New booking'}</h1></div><div class="acts"><a class="btn" href="${orig ? '#/booking/' + orig.id : '#/bookings'}">Cancel</a></div></div>
      <div class="be">
        <div>
          <div class="card"><div class="card-h"><h3>1 · What are they booking?</h3></div><div class="pick">${prods.map(([k, x]) => `<button type="button" data-prod="${k}" class="${B.product === k ? 'on' : ''}">${A.prodDot(k)} <b>${esc(x.name)}</b><small>${x.kind === 'house' ? '£' + x.night + '/night' : x.priceN ? '£' + x.priceN[1] + ' pp' : x.price ? '£' + x.price + ' pp' : 'priced by treatment'}</small></button>`).join('')}</div></div>
          <div class="card"><div class="card-h"><h3>2 · Guests${P.kind === 'stay' || P.kind === 'house' ? ' & nights' : ''}</h3></div>
            <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end">
              <div class="fld"><span>Guests</span><div style="display:flex;align-items:center;gap:8px"><button type="button" class="btn" data-g="-1">−</button><b style="font-size:22px;min-width:34px;text-align:center" class="tnum">${B.guests}</b><button type="button" class="btn" data-g="1">+</button></div><small>${B.date ? `Minimum ${E.minGuests(cfg, B.product, B.date)}` : `Minimum ${P.min}`}, maximum ${P.max}</small></div>
              ${P.kind === 'stay' ? `<div class="fld"><span>Nights</span><div class="seg">${(P.nights || [1]).map(n => `<button type="button" data-n="${n}" class="${B.nights === n ? 'on' : ''}">${n} night${n > 1 ? 's' : ''}</button>`).join('')}</div></div>` : ''}
              ${P.kind === 'house' ? `<div class="fld" style="max-width:140px"><span>Nights</span><input class="inp" type="number" id="hn" min="${P.minN}" max="${P.maxN}" value="${B.nights}"></div>` : ''}
              ${P.breakfast ? `<label class="sw"><input type="checkbox" id="bfast" ${B.breakfast ? 'checked' : ''}> Breakfast (£${cfg.breakfastPrice} pp per morning)</label>` : ''}
              ${incList.length && cfg.rules.blueLight ? `<label class="sw"><input type="checkbox" id="blue" ${B.blueLight ? 'checked' : ''}> Blue Light Card (30-minute treatments)</label>` : ''}
            </div></div>
          <div class="card"><div class="card-h"><h3>3 · Date${P.kind === 'session' || P.kind === 'private' ? ' & session' : P.kind === 'treat' ? ' & time of day' : ''}</h3><label class="sw small"><input type="checkbox" id="ovr" ${st.override ? 'checked' : ''}> Ignore availability</label></div>
            <div style="display:flex;flex-wrap:wrap;gap:24px">
              <div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;max-width:360px"><button type="button" class="icon-btn" data-mo="-1">${A.ic.left}</button><b>${f1.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><button type="button" class="icon-btn" data-mo="1">${A.ic.right}</button></div><div class="minical">${cal}</div></div>
              <div style="flex:1;min-width:240px">
                ${B.date ? `<p style="margin-bottom:10px"><b>${fdy(B.date)}</b>${B.nights ? ` → ${fdy(E.addD(B.date, B.nights))}` : ''}</p>` : '<p class="muted">Pick a date. Greyed-out days aren’t available (hover to see why).</p>'}
                ${sessions.length ? `<div class="pick">${sessions.map(s => `<button type="button" data-ses="${s.id}" class="${B.sessionId === s.id ? 'on' : ''}" ${s.ok || st.override || s.id === (orig && orig.sessionId) ? '' : 'disabled'}><b>${esc(s.name)}</b><small>${s.start}–${s.end} · arrive ${s.arrive || s.start}</small>${s.ok ? `<small>${s.left} place${s.left === 1 ? '' : 's'} left</small>` : `<span class="why">${esc(s.why)}</span>`}</button>`).join('')}</div>` : ''}
                ${P.kind === 'treat' && B.date ? (pl.slots && pl.slots.length ? `<div class="fld"><span>Start time (free times for these treatments)</span><div class="chips">${pl.slots.map(x => `<button type="button" class="chip ${B.treatStart === x.time ? 'on' : ''}" data-tstart="${x.time}" title="Finishes about ${x.end}">${x.time}</button>`).join('')}</div><small>Add each guest’s treatments below first; the times update to match.</small></div>` : '<p class="note warn">No free times for these treatments on this day.</p>') : ''}
                ${(P.kind === 'stay' || P.kind === 'house') && B.date ? `<div class="fld" style="margin-top:12px"><span>Rooms</span><div class="chips">${cfg.rooms.filter(r => r.active !== false).map(r => { const free = E.freeRooms(cfg, I, B.date, B.nights, B.product).some(x => x.id === r.id); return `<button type="button" class="chip ${B.rooms.includes(r.id) ? 'on' : ''}" data-room="${r.id}" ${free || B.rooms.includes(r.id) ? '' : 'disabled style="opacity:.4"'} title="${esc(r.bed)} · ${r.people} people">${esc(r.name)}</button>`; }).join('')}</div><small>${B.product === 'house' ? 'The whole house uses every room.' : 'Picked automatically. Tap to change.'}</small></div>` : ''}
                ${P.times && B.date ? (() => { const tt = E.stayTimes(cfg, B.product, B.date, B.nights); return `<p class="small muted" style="margin-top:10px">Check-in from ${tt.checkIn}${tt.spa ? ` · spa ${tt.spa[0]}–${tt.spa[1]}` : ''} · check-out ${tt.checkOut}</p>`; })() : ''}
              </div></div></div>
          <div class="card"><div class="card-h"><h3>4 · Each guest</h3>${B.guests > 1 ? '<button type="button" class="btn sm" id="sameAll">Same as guest 1 for everyone</button>' : ''}</div>
            ${B.guestList.map((g, i) => `<div class="gcard"><div class="gcard-h"><span class="av" style="background:var(--sage)">${i + 1}</span><input class="inp" data-gn="${i}" placeholder="${i === 0 ? 'Lead guest (from the contact below)' : 'Guest ' + (i + 1) + ' name (optional)'}" value="${esc(g.name)}" style="max-width:300px"></div>
              <div class="row">
                ${incList.length ? (incAll || incList.length === 1 ? `<div class="fld"><span>Included</span><span class="small" style="padding-top:9px">${incList.map(t => esc(t.name)).join(' + ')}</span></div>` : `<label class="fld"><span>Included treatment (choose one)</span><select class="inp" data-gi="${i}" data-gf="included">${incList.map(t => `<option value="${t.id}" ${g.included === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`) : ''}
                ${P.food && foods.length ? `<label class="fld"><span>Food</span><select class="inp" data-gi="${i}" data-gf="food">${foods.map(f => `<option value="${f.id}" ${g.food === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>` : ''}
                <label class="fld"><span>Add a treatment</span><select class="inp" data-addx="${i}"><option value="">Choose…</option>${[...new Set(extrasAll.map(x => x.cat))].map(c => `<optgroup label="${esc(c)}">${extrasAll.filter(x => x.cat === c).map(x => `<option value="${x.id}">${esc(x.name)} · ${x.min} min · £${x.price}</option>`).join('')}</optgroup>`).join('')}</select></label>
              </div>
              ${g.extras.length ? `<div class="chips" style="margin-top:8px">${g.extras.map((x, j) => `<span class="chip on">${esc(A.tname(x))} <button type="button" data-rmx="${i}:${j}" aria-label="Remove" style="color:#fff;margin-left:4px">×</button></span>`).join('')}</div>` : ''}
              ${B.items.some(it => it.guest === i) ? `<div class="sched">${B.items.filter(it => it.guest === i).sort((a, c) => a.start.localeCompare(c.start)).map(itemRow).join('')}</div>` : ''}
            </div>`).join('')}
            ${E.treatmentNeeds(cfg, B).length ? `<div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap"><button type="button" class="btn sm" id="replan">Re-plan times automatically</button>${B.guests > 1 ? `<label class="sw small"><input type="checkbox" id="together" ${(B.together != null ? B.together : E.alignFor(cfg, B)) ? 'checked' : ''}> Treat guests at the same time where possible</label>` : ''}<span class="small muted">${P.kind === 'treat' ? 'Times follow the start time chosen above.' : 'The booking system sets the times: the earliest free slots, so therapists finish early.'} You can change any time, therapist or room above.</span></div>` : ''}
          </div>
          <div class="card"><div class="card-h"><h3>5 · Contact</h3></div>
            <div class="row r2">${A.f.text('customer.first', 'First name', B.customer.first, { ac: 'off' })}${A.f.text('customer.last', 'Last name', B.customer.last)}${A.f.text('customer.email', 'Email', B.customer.email, { type: 'email', list: 'custList' })}${A.f.text('customer.phone', 'Phone', B.customer.phone, { type: 'tel' })}</div>
            <datalist id="custList">${Object.values(A.customers()).slice(0, 400).map(c => `<option value="${esc(c.email)}">${esc(c.name)}</option>`).join('')}</datalist>
            <div class="row r2" style="margin-top:12px">${A.f.sel('source', 'How they booked', B.source, [['phone', 'Phone'], ['email', 'Email'], ['walk-in', 'In person'], ['web', 'Website'], ['admin', 'Other']])}${A.f.chips('tags', 'Tags', B.tags, ['VIP', 'Birthday', 'Anniversary', 'Hen party', 'Corporate', 'Pregnant guest', 'Access needs', 'Returning'], { sm: true })}</div>
            <div class="row r2" style="margin-top:12px">${A.f.area('notes', 'Notes the guest gave (dietary, celebrations)', B.notes, { rows: 2 })}${A.f.area('internal', 'Staff notes (never shown to the guest)', B.internal, { rows: 2 })}</div></div>
          <div class="card"><div class="card-h"><h3>6 · Price</h3></div>
            <div class="row r3">
              <label class="fld"><span>Discount code</span><span style="display:flex;gap:6px"><input class="inp" id="promo" value="${esc((B.promo || {}).code || '')}" placeholder="Code"><button type="button" class="btn sm" id="promoGo">${B.promo ? 'Remove' : 'Apply'}</button></span><small class="${st.promoMsg && !B.promo ? '' : 'muted'}" style="${st.promoMsg && !B.promo ? 'color:var(--bad)' : ''}">${esc(st.promoMsg || (B.promo ? 'Applied: ' + (B.promo.label || B.promo.code) : ''))}</small></label>
              <label class="fld"><span>Manual discount</span><span style="display:flex;gap:6px"><select class="inp" id="dType" style="width:80px"><option value="amt" ${(B.discount || {}).type !== 'pct' ? 'selected' : ''}>£</option><option value="pct" ${(B.discount || {}).type === 'pct' ? 'selected' : ''}>%</option></select><input class="inp" id="dVal" type="number" min="0" step="0.01" value="${(B.discount || {}).value || ''}" placeholder="0"></span></label>
              ${A.f.text('discount.reason', 'Discount reason', (B.discount || {}).reason || '', { ph: 'e.g. Birthday, apology, staff' })}
            </div>
            <div class="fld" style="margin-top:12px"><span>Extras (add a line)</span>${(B.addOns || []).map((a, i) => `<div style="display:flex;gap:6px;margin-bottom:6px"><input class="inp" data-ao="${i}" data-aof="label" value="${esc(a.label)}" placeholder="e.g. Prosecco on arrival"><input class="inp" data-ao="${i}" data-aof="amount" type="number" step="0.01" value="${a.amount}" style="width:120px"><button type="button" class="icon-btn" data-aorm="${i}">${A.ic.x}</button></div>`).join('')}<button type="button" class="btn sm" id="aoAdd" style="align-self:flex-start">${A.ic.plus} Add an extra</button></div>
            <div class="row r3" style="margin-top:12px"><label class="fld"><span>Set the total yourself</span><span class="inp-pre"><b>£</b><input class="inp" id="ovT" type="number" step="0.01" value="${B.totalOverride ?? ''}" placeholder="Leave blank to use prices"></span><small>Overrides everything above</small></label></div>
          </div>
        </div>
        <div class="be-sum">
          <div class="card"><div class="card-h"><h3>Summary</h3></div>
            <p><b>${A.prodDot(B.product)} ${esc(P.name)}</b><br><span class="small muted">${B.date ? A.whenText(B) : 'No date yet'} · ${B.guests} guest${B.guests > 1 ? 's' : ''}</span></p>
            <div class="lines" style="margin-top:10px">${q.lines.map(l => `<div><span>${esc(l.label)}</span><span class="tnum">${gbp(l.amount, 2)}</span></div>`).join('')}</div>
            <div class="tot"><span>Total</span><b>${gbp(q.total, 2)}</b></div>
            ${q.deposit < q.total ? `<p class="small muted">Deposit ${gbp(q.deposit, 2)} now · balance by ${fdy(q.balanceDue)}</p>` : ''}
            ${orig && B.customer.email && cfg.emails.templates.changed && cfg.emails.templates.changed.on ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="mailChg" ${st.mailChg !== false ? 'checked' : ''}> <span>Email the guest the updated booking</span></label>` : ''}
            ${orig ? `<div class="lines" style="margin-top:8px"><div><span>Paid so far</span><span>${gbp(paid, 2)}</span></div><div><b>${q.total - paid < 0 ? 'Refund due' : 'Still to pay'}</b><b>${gbp(Math.abs(q.total - paid), 2)}</b></div></div>` : ''}
            ${probs.length ? `<div class="note bad" style="margin-top:12px">${probs.map(esc).join('<br>')}</div>` : B.date ? '<div class="note ok" style="margin-top:12px">Everything fits.</div>' : ''}
            ${!orig ? `<div class="hr"></div><div class="fld"><span>Then</span>
              <label class="chk"><input type="radio" name="pm" value="link" ${st.payMode === 'link' ? 'checked' : ''}> <span>Email a payment link (${gbp(q.deposit, 2)})</span></label>
              <label class="chk"><input type="radio" name="pm" value="paid" ${st.payMode === 'paid' ? 'checked' : ''}> <span>They’ve paid now</span></label>
              ${st.payMode === 'paid' ? `<div class="row r2" style="margin:4px 0 4px 26px"><select class="inp" id="pmM">${[['card terminal', 'Card machine'], ['cash', 'Cash'], ['bank transfer', 'Bank transfer'], ['voucher', 'Gift voucher']].map(([v, tx]) => `<option value="${v}" ${st.pay.method === v ? 'selected' : ''}>${tx}</option>`).join('')}</select><input class="inp" id="pmA" type="number" step="0.01" value="${st.pay.amount ?? q.deposit}"></div>` : ''}
              <label class="chk"><input type="radio" name="pm" value="hold" ${st.payMode === 'hold' ? 'checked' : ''}> <span>Confirm now, pay later or on arrival</span></label>
              <label class="chk"><input type="radio" name="pm" value="enquiry" ${st.payMode === 'enquiry' ? 'checked' : ''}> <span>Save as an enquiry (doesn’t hold the space)</span></label></div>` : ''}
            <button class="btn pri" id="saveB" style="width:100%;justify-content:center;margin-top:12px">${orig ? 'Save changes' : st.payMode === 'link' ? 'Book & send payment link' : st.payMode === 'enquiry' ? 'Save enquiry' : 'Make the booking'}</button>
            <p class="small muted" id="saveMsg" style="margin-top:8px;color:var(--bad)"></p>
          </div></div>
      </div>`;
      return { html, probs };
    };
    let lastProbs = [];
    const view = el => {
      const r = render(); el.innerHTML = r.html; lastProbs = r.probs; wire(el);
    };
    const wire = el => {
      const re = () => { const y = scrollY; view(el); scrollTo(0, y); };
      $$('[data-prod]', el).forEach(b => b.onclick = () => { if (B.product !== B.product) return; B.product = b.dataset.prod; B.sessionId = null; B.rooms = []; B.guests = Math.max(B.guests, cfg.products[B.product].min); B.guestList.forEach(g => g.extras = g.extras || []); st.lock = false; re(); });
      $$('[data-g]', el).forEach(b => b.onclick = () => { B.guests += +b.dataset.g; st.lock = false; re(); });
      $$('[data-n]', el).forEach(b => b.onclick = () => { B.nights = +b.dataset.n; B.rooms = []; re(); });
      const hn = $('#hn', el); if (hn) hn.onchange = () => { B.nights = Math.max(p().minN, Math.min(p().maxN, +hn.value || p().minN)); re(); };
      const bf = $('#bfast', el); if (bf) bf.onchange = () => { B.breakfast = bf.checked; re(); };
      const bl = $('#blue', el); if (bl) bl.onchange = () => { B.blueLight = bl.checked; st.lock = false; re(); };
      $('#ovr', el).onchange = e => { st.override = e.target.checked; re(); };
      $$('[data-mo]', el).forEach(b => b.onclick = () => { const [y, m] = st.month.split('-').map(Number), d = new Date(y, m - 1 + +b.dataset.mo, 1); st.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; re(); });
      $$('[data-day]', el).forEach(b => b.onclick = () => { B.date = b.dataset.day; B.rooms = []; st.lock = false; const s = E.sessions(cfg, ix(), B.product, B.date, B.guests).filter(x => x.ok); if (!s.some(x => x.id === B.sessionId)) B.sessionId = s.length === 1 ? s[0].id : null; re(); });
      $$('[data-ses]', el).forEach(b => b.onclick = () => { B.sessionId = b.dataset.ses; st.lock = false; re(); });
      $$('[data-part]', el).forEach(b => b.onclick = () => { B.part = b.dataset.part; st.lock = false; re(); });
      $$('[data-tstart]', el).forEach(b => b.onclick = () => { B.treatStart = b.dataset.tstart; st.lock = false; re(); });
      $$('[data-room]', el).forEach(b => b.onclick = () => { const id = b.dataset.room; B.rooms = B.rooms.includes(id) ? B.rooms.filter(x => x !== id) : [...B.rooms, id]; re(); });
      $$('[data-gn]', el).forEach(i => i.oninput = () => B.guestList[+i.dataset.gn].name = i.value);
      $$('[data-gf]', el).forEach(s => s.onchange = () => { B.guestList[+s.dataset.gi][s.dataset.gf] = s.value; if (s.dataset.gf === 'included') st.lock = false; re(); });
      $$('[data-addx]', el).forEach(s => s.onchange = () => { if (s.value) { B.guestList[+s.dataset.addx].extras.push(s.value); st.lock = false; re(); } });
      $$('[data-rmx]', el).forEach(b => b.onclick = () => { const [i, j] = b.dataset.rmx.split(':').map(Number); B.guestList[i].extras.splice(j, 1); st.lock = false; re(); });
      $$('[data-it]', el).forEach(s => s.onchange = () => { const it = B.items.find(x => x.key === s.dataset.it); it[s.dataset.fld] = s.value; if (s.dataset.fld === 'troom' || s.dataset.fld === 'staff') {} st.lock = true; re(); });
      const rp = $('#replan', el); if (rp) rp.onclick = () => { st.lock = false; re(); };
      const tg = $('#together', el); if (tg) tg.onchange = () => { B.together = tg.checked; st.lock = false; re(); };
      const sa = $('#sameAll', el); if (sa) sa.onclick = () => { const g0 = B.guestList[0]; B.guestList.forEach((g, i) => { if (i) { g.food = g0.food; g.included = g0.included; g.extras = [...g0.extras]; } }); st.lock = false; re(); };
      // contact & notes: keep values without re-drawing
      $$('[data-k]', el).forEach(i => { const ev = i.classList.contains('chips') ? 'change' : 'input'; i.addEventListener(ev, () => { const v = A.read(el.querySelector('.be > div')); B.customer = { ...B.customer, ...v.customer }; B.source = v.source; B.tags = v.tags; B.notes = v.notes; B.internal = v.internal; if (v.discount) B.discount = { ...(B.discount || { type: 'amt', value: 0 }), reason: v.discount.reason }; }); });
      const em = $('[data-k="customer.email"]', el); if (em) em.onchange = () => { const c = A.customers()[em.value.trim().toLowerCase()]; if (c && !B.customer.first) { B.customer.first = c.first; B.customer.last = c.last; B.customer.phone = c.phone; re(); A.toast('Filled in from their last booking'); } };
      $('#promoGo', el).onclick = () => {
        if (B.promo) { B.promo = null; st.promoMsg = ''; re(); return; }
        const code = $('#promo', el).value.trim().toUpperCase(), pr = (cfg.promos || []).find(x => x.code.toUpperCase() === code);
        const why = pr ? E.promoCheck(cfg, pr, B) : 'No code with that name';
        if (why) { st.promoMsg = why; re(); return; }
        B.promo = { code: pr.code, id: pr.id, type: pr.type, value: pr.value, on: pr.on, label: pr.label }; st.promoMsg = ''; re();
      };
      const dv = () => { const v = +$('#dVal', el).value; B.discount = v ? { type: $('#dType', el).value, value: v, reason: (B.discount || {}).reason || $('[data-k="discount.reason"]', el).value } : null; re(); };
      $('#dVal', el).onchange = dv; $('#dType', el).onchange = dv;
      $('#ovT', el).onchange = e => { B.totalOverride = e.target.value === '' ? null : +e.target.value; re(); };
      $('#aoAdd', el).onclick = () => { (B.addOns = B.addOns || []).push({ label: '', amount: 0 }); re(); };
      $$('[data-ao]', el).forEach(i => i.onchange = () => { const a = B.addOns[+i.dataset.ao]; a[i.dataset.aof] = i.dataset.aof === 'amount' ? +i.value || 0 : i.value; re(); });
      $$('[data-aorm]', el).forEach(b => b.onclick = () => { B.addOns.splice(+b.dataset.aorm, 1); re(); });
      $$('input[name=pm]', el).forEach(r => r.onchange = () => { st.payMode = r.value; re(); });
      const pm = $('#pmM', el); if (pm) pm.onchange = () => st.pay.method = pm.value;
      const pa = $('#pmA', el); if (pa) pa.oninput = () => st.pay.amount = +pa.value;
      const mc = $('#mailChg', el); if (mc) mc.onchange = () => st.mailChg = mc.checked;
      $('#saveB', el).onclick = () => save(el);
    };
    const save = async el => {
      const msg = $('#saveMsg', el), P = p();
      Object.assign(B, (() => { const v = A.read(el.querySelector('.be > div')); return { customer: { ...B.customer, ...v.customer }, source: v.source, tags: v.tags, notes: v.notes, internal: v.internal }; })());
      if (!B.date) { msg.textContent = 'Choose a date'; return; }
      if ((P.kind === 'session' || P.kind === 'private') && !B.sessionId) { msg.textContent = 'Choose a session'; return; }
      if (!B.customer.first && !B.customer.last) { msg.textContent = 'Add the guest’s name'; return; }
      if (st.payMode === 'link' && !orig && !/^\S+@\S+\.\S+$/.test(B.customer.email || '')) { msg.textContent = 'A payment link needs an email address'; return; }
      if (lastProbs.length && !(await A.confirm('Book anyway?', `There ${lastProbs.length === 1 ? 'is a problem' : 'are problems'}:<br>${lastProbs.map(esc).join('<br>')}<br><br>Save it anyway?`, 'Save anyway'))) return;
      if (B.items.some(i => !i.staff)) B.items.forEach(i => { if (!i.staff) i.staff = null; });
      const now = new Date().toISOString(), by = St.S.user.name;
      B.quote = E.quote(cfg, B); B.updated = now;
      delete B._wl;
      if (orig) {
        const changes = [];
        if (orig.date !== B.date) changes.push(`moved ${orig.date} → ${B.date}`);
        if (orig.sessionId !== B.sessionId) changes.push('session changed');
        if (orig.guests !== B.guests) changes.push(`guests ${orig.guests} → ${B.guests}`);
        const tKey = x => (x.items || []).map(i => [i.key, i.tid, i.date, i.start, i.staff].join()).sort().join('|');
        if (tKey(orig) !== tKey(B)) changes.push('treatment times changed');
        if ((orig.quote || {}).total !== B.quote.total) changes.push(`total ${gbp((orig.quote || {}).total, 2)} → ${gbp(B.quote.total, 2)}`);
        B.history.push({ at: now, by, what: 'Edited' + (changes.length ? ': ' + changes.join(', ') : '') });
        B._oldMonth = St.month(orig);
        Object.keys(orig).forEach(k => delete orig[k]); Object.assign(orig, B);
        A.change('booking', orig, `Edited ${orig.ref}`);
        if (changes.length && st.mailChg !== false && orig.customer.email && cfg.emails.templates.changed && cfg.emails.templates.changed.on) { await A.sendEmail('changed', orig); A.change('booking', orig); }
        A.toast('Booking saved');
        const owe = due(orig);
        location.hash = '#/booking/' + orig.id;
        if (owe > 0.009 && orig.status !== 'pending' && E.paid(orig) > 0) setTimeout(() => A.toast(`The guest now owes ${gbp(owe, 2)}`), 400);
        if (owe < -0.009) setTimeout(() => A.toast(`You owe the guest a refund of ${gbp(-owe, 2)}`), 400);
        return;
      }
      B.created = now; B.createdBy = by;
      B.history.push({ at: now, by, what: 'Booking made in the admin portal' });
      B.status = st.payMode === 'link' ? 'pending' : st.payMode === 'enquiry' ? 'enquiry' : 'confirmed';
      if (st.payMode === 'paid') B.payments.push({ id: uid('pay'), at: now, amount: st.pay.amount ?? B.quote.deposit, method: st.pay.method, kind: 'payment', by });
      if (B.promo) { const pr = cfg.promos.find(x => x.id === B.promo.id); if (pr) { pr.used = (pr.used || 0) + 1; A.change('cfg'); } }
      DB.bookings.push(B);
      const wl = pre.wl; if (wl) { wl.status = 'booked'; wl.booking = B.ref; A.change('waitlist'); }
      A.change('booking', B, `New booking ${B.ref} (${P.name}, ${B.date})`);
      if (B.customer.email) { const c = DB.customers[B.customer.email.toLowerCase()] = DB.customers[B.customer.email.toLowerCase()] || { marketing: false, notes: '', tags: [] }; A.change('customers'); }
      location.hash = '#/booking/' + B.id;
      if (st.payMode === 'link') { B.payLink = { sent: now, amount: B.quote.deposit, expires: E.addD(today(), 7) }; await A.sendEmail('pay', B, { amount: B.quote.deposit }); A.change('booking', B); }
      else if (B.status === 'confirmed' && B.customer.email && cfg.emails.templates.confirm.on && await A.confirm('Send the confirmation?', `Email the booking confirmation to ${esc(B.customer.email)}?`, 'Send it', false)) { await A.sendEmail('confirm', B); A.change('booking', B); }
      A.toast('Booking made · ' + B.ref); A.refresh();
    };
    return { html: '<div id="beRoot"></div>', wire: el => view($('#beRoot', el)) };
  }

  // ============ WAITLIST ============
  V.waitlist = () => {
    const cfg = A.cfg(), DB = A.DB(), t = today(), ix = E.index(cfg, DB.bookings);
    const list = DB.waitlist.filter(w => w.status === 'waiting').sort((a, b) => a.date.localeCompare(b.date));
    const done = DB.waitlist.filter(w => w.status !== 'waiting').slice(-30).reverse();
    return { html: `<div class="vh"><div><div class="eyebrow">Waitlist</div><h1>Waitlist</h1><p>People waiting for a space. When one frees up, they’re marked “Space free”.</p></div><div class="acts"><button class="btn pri" id="wlAdd">${A.ic.plus} Add to waitlist</button></div></div>
      <div class="card flush"><table class="tbl"><thead><tr><th>Wanted</th><th>Who</th><th>Guests</th><th>Note</th><th>Now</th><th></th></tr></thead><tbody>
      ${list.map(w => { const c = w.date >= t ? E.dateCheck(cfg, ix, { product: w.product, date: w.date, guests: w.guests, nights: w.nights, admin: true }) : { ok: false, why: 'Date passed' };
        return `<tr><td><b>${fd(w.date)}</b><br><span class="small muted">${A.prodDot(w.product)} ${esc(A.pname(w.product))}</span></td><td><b>${esc(w.name)}</b><br><span class="small muted">${esc(w.email || '')} ${esc(w.phone || '')}</span></td><td>${w.guests}</td><td class="small">${esc(w.note || '')}</td><td>${c.ok ? '<span class="badge ok bdot">Space free</span>' : `<span class="badge">${esc(c.why)}</span>`}</td>
          <td class="r" style="white-space:nowrap">${c.ok ? `<a class="btn sm pri" href="#/new?wl=${w.id}">Book</a> ${w.email ? `<button class="btn sm" data-wlmail="${w.id}">Email</button>` : ''}` : ''} <button class="btn sm ghost" data-wldone="${w.id}">Remove</button></td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty"><b>Nobody waiting</b>Add people when a day is full.</div></td></tr>'}
      </tbody></table></div>
      ${done.length ? `<h3 style="margin:22px 0 8px">Recently closed</h3><div class="card flush"><table class="tbl"><tbody>${done.map(w => `<tr><td>${fd(w.date)}</td><td>${esc(w.name)}</td><td>${esc(A.pname(w.product))}</td><td>${w.status === 'booked' ? `<span class="badge ok">Booked ${w.booking || ''}</span>` : '<span class="badge">Removed</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}`,
      wire: el => {
        $('#wlAdd', el).onclick = async () => {
          const r = await A.modal({ title: 'Add to the waitlist', body: `<div class="row r2">${A.f.sel('product', 'Wants', 'day', Object.entries(cfg.products).map(([k, p]) => [k, p.name]))}${A.f.date('date', 'Date', E.addD(t, 1))}${A.f.num('guests', 'Guests', 2)}${A.f.num('nights', 'Nights (stays)', '')}</div><div class="row r2">${A.f.text('name', 'Name', '')}${A.f.text('phone', 'Phone', '', { type: 'tel' })}</div>${A.f.text('email', 'Email', '', { type: 'email' })}${A.f.text('note', 'Note', '', { ph: 'e.g. any session, flexible by a day' })}`,
            onOk: m => { const v = A.read(m); if (!v.name || !v.date) throw new Error('Add a name and a date'); return v; } });
          if (!r) return; DB.waitlist.push({ id: uid('w'), at: new Date().toISOString(), status: 'waiting', ...r }); A.change('waitlist', null, `Waitlist: ${r.name} for ${r.date}`); A.refresh();
        };
        $$('[data-wldone]', el).forEach(b => b.onclick = () => { const w = DB.waitlist.find(x => x.id === b.dataset.wldone); w.status = 'removed'; A.change('waitlist', null, 'Waitlist entry removed: ' + w.name); A.refresh(); });
        $$('[data-wlmail]', el).forEach(b => b.onclick = async () => {
          const w = DB.waitlist.find(x => x.id === b.dataset.wlmail);
          const body = `Hello ${w.name.replace(/^Sample: /, '').split(' ')[0]},\n\nGood news: a space has come up for ${A.pname(w.product)} on ${fdy(w.date)}. Reply to this email or call 01933 580 100 to book it.\n\nYork Cottage Spa`;
          St.queue({ type: 'email', to: w.email, subject: 'A space has come up at York Cottage', body });
          if (St.S.mode === 'demo') await A.modal({ title: 'Email preview', ok: 'Done', cancel: '', body: `<div class="kv"><dt>To</dt><dd>${esc(w.email)}</dd></div><pre style="white-space:pre-wrap;font-family:inherit;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px">${esc(body)}</pre>` });
          w.emailed = new Date().toISOString(); A.change('waitlist'); A.toast('Email queued');
        });
      } };
  };
})();
