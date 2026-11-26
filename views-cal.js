/* Calendars: Day / Week / Month (like a mail app's calendar) and the Room calendar. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, gbp, fd, fdy, today, PCOL, PINK } = A;
  const V = A.views;
  const live = () => A.DB().bookings.filter(E.live);
  const mon = d => { while (E.dow(d) !== 1) d = E.addD(d, -1); return d; };
  const ymOf = d => d.slice(0, 7);
  const monthName = d => A.dObj(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const narrow = () => innerWidth < 760;
  const fl = () => ((location.hash.split('?p=')[1]) || '').split(',').filter(k => A.cfg().products[k]);
  const qs = () => { const f = fl(); return f.length ? '?p=' + f.join(',') : ''; };
  const show = k => { const f = fl(); return !f.length || f.includes(k); };

  // what happens on a day: timed events (sessions, treatments) and all-day ones (stays)
  function dayEvents(d) {
    const cfg = A.cfg(), out = [];
    for (const b of live()) {
      if (!show(b.product)) continue;
      const p = cfg.products[b.product]; if (!p) continue;
      if (p.kind === 'stay' || p.kind === 'house') {
        if (b.date <= d && d < E.addD(b.date, b.nights)) out.push({ b, allDay: true, first: b.date === d });
        else if (E.addD(b.date, b.nights) === d) out.push({ b, allDay: true, leaving: true });
        continue;
      }
      if (b.date !== d) continue;
      let s, e;
      if (p.kind === 'treat') { const its = (b.items || []).filter(i => (i.date || b.date) === d); if (!its.length) continue; s = Math.min(...its.map(i => E.T(i.start))); e = Math.max(...its.map(i => E.T(i.start) + i.min)); }
      else { const ses = E.session(cfg, b.sessionId); if (!ses) continue; s = E.T(ses.start); e = E.T(ses.end); }
      out.push({ b, s, e });
    }
    return out;
  }
  // put overlapping events side by side
  // side by side only within a group of overlapping events (like Outlook): a lone event gets the full width
  const lanes = evs => { evs.sort((a, b) => a.s - b.s || b.e - a.e); let cluster = [], end = -1;
    const flush = () => { const ends = []; cluster.forEach(ev => { let l = ends.findIndex(x => x <= ev.s); if (l < 0) { l = ends.length; ends.push(0); } ends[l] = ev.e; ev.lane = l; }); cluster.forEach(ev => ev.lanes = ends.length); cluster = []; };
    evs.forEach(ev => { if (ev.s >= end) { flush(); end = -1; } cluster.push(ev); end = Math.max(end, ev.e); }); flush(); return evs; };
  const label = b => `${A.cust(b)} · ${b.guests}`;
  const evStyle = k => `background:${PCOL[k] || '#8a9a85'};color:${PINK[k] || '#fff'}`;

  // ---------- shared toolbar (mail-app style) ----------
  function toolbar(mode, d, title) {
    const step = mode === 'day' ? 1 : mode === 'week' ? 7 : 0;
    const prev = mode === 'month' ? ymOf(E.addD(d.slice(0, 8) + '01', -1)) + '-01' : E.addD(d, -step);
    const next = mode === 'month' ? ymOf(E.addD(d.slice(0, 8) + '01', 32)) + '-01' : E.addD(d, step);
    const prods = Object.entries(A.cfg().products), f = fl();
    const tog = k => { const n = f.includes(k) ? f.filter(x => x !== k) : f.concat([k]); return `#/calendar/${mode}/${d}${n.length ? '?p=' + n.join(',') : ''}`; };
    return `<div class="cal-bar"><div class="cal-bar-l"><a class="btn" href="#/calendar/${mode}/${today()}${qs()}">Today</a><a class="icon-btn" href="#/calendar/${mode}/${prev}${qs()}" title="Previous" aria-label="Previous">${A.ic.left}</a><a class="icon-btn" href="#/calendar/${mode}/${next}${qs()}" title="Next" aria-label="Next">${A.ic.right}</a><h1 class="cal-title">${title}</h1></div>
      <div class="seg cal-modes">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([m, t]) => `<a href="#/calendar/${m}/${d}${qs()}" class="${m === mode ? 'on' : ''}">${t}</a>`).join('')}</div></div>
      <div class="chips cal-filter"><span class="small muted">Show:</span><a class="chip sm ${!f.length ? 'on' : ''}" href="#/calendar/${mode}/${d}">Everything</a>${prods.map(([k, p]) => `<a class="chip sm ${f.includes(k) ? 'on' : ''}" href="${tog(k)}">${A.prodDot(k)} ${esc(p.name)}</a>`).join('')}</div>`;
  }
  // little month on the left
  function mini(d, mode) {
    const first = d.slice(0, 8) + '01', sw = (E.dow(first) + 6) % 7, dim = new Date(+d.slice(0, 4), +d.slice(5, 7), 0).getDate(), t = today();
    const wk = mon(d), inWeek = x => mode === 'week' && x >= wk && x <= E.addD(wk, 6);
    let h = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="dw">${x}</span>`).join('') + '<span></span>'.repeat(sw);
    for (let i = 1; i <= dim; i++) { const x = first.slice(0, 8) + String(i).padStart(2, '0'), busy = live().some(b => b.date === x && show(b.product)); h += `<a href="#/calendar/${mode === 'month' ? 'day' : mode}/${x}${qs()}" class="${x === t ? 'today' : ''} ${x === d && mode === 'day' ? 'on' : ''} ${inWeek(x) ? 'wk' : ''}">${i}${busy ? '<i></i>' : ''}</a>`; }
    const pm = ymOf(E.addD(first, -1)) + '-01', nm = ymOf(E.addD(first, 32)) + '-01';
    return `<div class="mini-cal"><div class="mini-h"><a class="icon-btn" href="#/calendar/${mode}/${pm}${qs()}">${A.ic.left}</a><b>${monthName(d)}</b><a class="icon-btn" href="#/calendar/${mode}/${nm}${qs()}">${A.ic.right}</a></div><div class="mini-g">${h}</div></div>
      <a class="btn pri" style="width:100%;justify-content:center;margin-top:12px" href="#/new?date=${d >= t ? d : t}">${A.ic.plus} New booking</a>
      <div class="legend" style="flex-direction:column;gap:6px;margin-top:14px">${Object.entries(A.cfg().products).map(([k, p]) => `<span><i style="background:${PCOL[k]}"></i>${esc(p.name)}</span>`).join('')}</div>
      <a class="btn sm ghost" style="margin-top:10px" href="#/roomcal">${A.ic.bed} Room calendar</a>`;
  }

  // ---------- time grid (day and week) ----------
  function timeGrid(days, mode) {
    const cfg = A.cfg(), t = today(), PX = 0.9;
    // week view: one block per session (with a count) so busy days stay readable; day view: one block per booking
    const group = evs => { if (mode !== 'week') return evs; const out = [], by = {}; for (const ev of evs) { const k = ev.b.sessionId ? ev.b.product + '|' + ev.b.sessionId : null; if (!k) { out.push(ev); continue; } if (!by[k]) out.push(by[k] = { ...ev, list: [] }); by[k].list.push(ev.b); } return out; };
    const all = days.map(d => ({ d, evs: lanes(group(dayEvents(d).filter(x => !x.allDay))), stays: dayEvents(d).filter(x => x.allDay) }));
    const times = all.flatMap(x => x.evs.flatMap(e => [e.s, e.e]));
    const t0 = Math.floor((Math.min(9 * 60, ...times) - 30) / 60) * 60, t1 = Math.ceil((Math.max(18 * 60, ...times) + 30) / 60) * 60, H = (t1 - t0) * PX;
    const y = m => (m - t0) * PX, nowM = new Date().getHours() * 60 + new Date().getMinutes();
    const head = all.map(x => `<a class="tg-dh ${x.d === t ? 'today' : ''}" href="#/calendar/day/${x.d}${qs()}"><small>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][E.dow(x.d)]}</small><b>${+x.d.slice(8)}</b></a>`).join('');
    const allDay = all.map(x => `<div class="tg-ad ${x.d === t ? 'today' : ''}">${x.stays.map(s => `<a class="ev-ad" href="#/booking/${s.b.id}" style="${evStyle(s.b.product)}" title="${esc(A.pname(s.b.product))} · ${esc(A.cust(s.b))}">${s.leaving ? '↩ ' : s.first ? '' : '· '}${esc(A.cust(s.b))}${s.first ? ' · arrives' : s.leaving ? ' leaves' : ''}</a>`).join('')}</div>`).join('');
    const lines = []; for (let m = t0; m <= t1; m += 60) lines.push(`<div class="tl-line" style="top:${y(m)}px"></div>`);
    const cols = all.map(x => `<div class="tg-col ${x.d === t ? 'today' : ''}" data-day="${x.d}" style="height:${H}px">${lines.join('')}
      ${x.evs.map(ev => { const grp = ev.list && ev.list.length > 1, n = grp ? ev.list.reduce((a, b) => a + b.guests, 0) : ev.b.guests, ses = E.session(cfg, ev.b.sessionId);
        const its = (grp ? ev.list : [ev.b]).flatMap(b => (b.items || []).filter(i => (i.date || b.date) === x.d).map(i => ({ ...i, b })));
        const tick = its.map(i => { const top = (E.T(i.start) - ev.s) * PX; return `<span class="tg-tr" style="top:${top}px;height:${Math.max(10, i.min * PX - 1)}px" title="${i.start} ${esc(A.tname(i.tid))} · ${esc(A.sname(i.staff))}${grp ? ' · ' + esc(A.cust(i.b)) : ''}"><em>${i.start}</em> ${esc(A.tname(i.tid).replace(/^20-minute /, '20m '))}<i>${A.initials(A.sname(i.staff))}</i></span>`; }).join('');
        return `<a class="tg-ev ${its.length ? 'has-tr' : ''}" href="${grp ? `#/calendar/day/${x.d}${qs()}` : '#/booking/' + ev.b.id}" style="top:${y(ev.s)}px;height:${Math.max(22, (ev.e - ev.s) * PX - 2)}px;left:calc(${ev.lane / ev.lanes * 100}% + 2px);width:calc(${100 / ev.lanes}% - 4px);${evStyle(ev.b.product)}" title="${esc(A.pname(ev.b.product))}${grp ? ` · ${ev.list.length} bookings` : ' · ' + esc(A.cust(ev.b))}"><b>${E.HM(ev.s)} ${grp ? `${n} guests` : esc(label(ev.b))}</b><span>${esc(A.pname(ev.b.product))}${ses ? ' · ' + esc(ses.name) : ''}${grp ? ` · ${ev.list.length} bookings` : ''}</span><span class="tg-trs">${tick}</span></a>`; }).join('')}
      ${x.d === t && nowM >= t0 && nowM <= t1 ? `<div class="tl-now" style="top:${y(nowM)}px"></div>` : ''}</div>`).join('');
    return `<div class="tg" style="--n:${days.length}"><div class="tg-head"><div class="tg-gut"></div>${head}</div>
      <div class="tg-allday"><div class="tg-gut small muted">Stays</div>${allDay}</div>
      <div class="tg-body"><div class="tg-hours" style="height:${H}px">${Array.from({ length: (t1 - t0) / 60 + 1 }, (_, i) => `<span style="top:${i * 60 * PX}px">${E.HM(t0 + i * 60)}</span>`).join('')}</div>${cols}</div></div>`;
  }
  // phones: an agenda list instead of a 7-column grid
  function agenda(days) {
    const t = today();
    return `<div class="agenda">${days.map(d => { const evs = dayEvents(d).sort((a, b) => (a.allDay ? -1 : a.s) - (b.allDay ? -1 : b.s));
      return `<div class="ag-day ${d === t ? 'today' : ''}"><a class="ag-dh" href="#/calendar/day/${d}${qs()}"><b>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][E.dow(d)]} ${+d.slice(8)}</b><span>${d === t ? 'Today' : fd(d, { month: 'short' })}</span></a>
        <div class="ag-list">${evs.length ? evs.map(ev => `<a class="ag-ev" href="#/booking/${ev.b.id}"><span class="ag-t">${ev.allDay ? (ev.first ? 'Arrives' : ev.leaving ? 'Leaves' : 'Staying') : E.HM(ev.s)}</span><i style="background:${PCOL[ev.b.product]}"></i><span class="grow"><b>${esc(A.cust(ev.b))}</b><small>${esc(A.pname(ev.b.product))} · ${ev.b.guests} guest${ev.b.guests > 1 ? 's' : ''}</small></span></a>`).join('') : '<p class="small muted" style="padding:6px 0">Nothing booked</p>'}</div></div>`; }).join('')}</div>`;
  }
  // ---------- month ----------
  function month(d) {
    const cfg = A.cfg(), t = today(), first = d.slice(0, 8) + '01', sw = (E.dow(first) + 6) % 7, dim = new Date(+d.slice(0, 4), +d.slice(5, 7), 0).getDate();
    const roomsAll = cfg.rooms.filter(r => r.active !== false).length || 1;
    let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<div class="dw">${x}</div>`).join('') + '<div class="d out"></div>'.repeat(sw);
    for (let i = 1; i <= dim; i++) {
      const x = first.slice(0, 8) + String(i).padStart(2, '0'), evs = dayEvents(x), timed = evs.filter(e => !e.allDay).sort((a, b) => a.s - b.s), stays = evs.filter(e => e.allDay && !e.leaving);
      const closed = E.closedAllDay(cfg, x, ['all']) || !E.hours(cfg, x), cls = E.closures(cfg, x, ['all', 'spa', 'rooms', 'treatments']);
      const rows = [...cls.map(c => `<span class="ev cl">${esc(c.reason || 'Closed')}</span>`), ...stays.filter(s => s.first || s.b.product === 'house').map(s => `<span class="ev" style="${evStyle(s.b.product)}">${esc(A.cust(s.b))} · ${s.b.product === 'house' ? 'whole house' : 'stay'}</span>`), ...timed.map(e => `<span class="ev ev-t"><i style="background:${PCOL[e.b.product]}"></i>${E.HM(e.s)} ${esc(A.cust(e.b))}</span>`)];
      const roomsUsed = new Set(live().filter(b => b.nights && b.date <= x && x < E.addD(b.date, b.nights)).flatMap(b => b.product === 'house' ? cfg.rooms.map(r => r.id) : b.rooms || [])).size;
      cells += `<a class="d ${x === t ? 'today' : ''} ${closed ? 'closed' : ''}" href="#/calendar/day/${x}${qs()}"><span class="n">${i}</span>${rows.slice(0, 4).join('')}${rows.length > 4 ? `<span class="small muted">+${rows.length - 4} more</span>` : ''}<span class="cntm">${evs.length || ''}</span><span class="occ" title="Bedrooms used"><span><i style="width:${roomsUsed / roomsAll * 100}%;background:#9d8fc0"></i></span></span></a>`;
    }
    cells += '<div class="d out"></div>'.repeat((7 - (sw + dim) % 7) % 7);
    return `<div class="mcal">${cells}</div>`;
  }

  // #/calendar/<day|week|month>/<date>
  const old = V.calendar;
  V.calendar = (mode, d) => {
    if (mode && /^\d{4}-\d\d$/.test(mode)) { d = mode + '-01'; mode = 'month'; }   // old links
    mode = ['day', 'week', 'month'].includes(mode) ? mode : (narrow() ? 'day' : 'week');
    d = /^\d{4}-\d\d-\d\d$/.test(d || '') ? d : today();
    let title, body;
    if (mode === 'day') { title = (d === today() ? 'Today · ' : '') + fdy(d); body = timeGrid([d], 'day') + `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="#/day/${d}">Therapist timeline for this day</a><a class="btn sm" href="#/today/${d}">This day’s dashboard</a></div>`; }
    if (mode === 'week') { const m = mon(d), days = Array.from({ length: 7 }, (_, i) => E.addD(m, i)); title = `${fd(m, { day: 'numeric', month: 'short' })} – ${fd(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`; body = narrow() ? agenda(days) : timeGrid(days, 'week'); }
    if (mode === 'month') { title = monthName(d); body = month(d); }
    return { html: `<div class="cal-wrap"><aside class="cal-side">${mini(d, mode)}</aside><div class="cal-main">${toolbar(mode, d, title)}${body}</div></div>`,
      wire: el => { $$('.tg-col', el).forEach(c => c.addEventListener('dblclick', e => { if (e.target.closest('.tg-ev')) return; const dd = c.dataset.day; if (dd >= today()) location.hash = '#/new?date=' + dd; })); } };
  };

  // ---------- Room calendar: rooms down the side, nights across ----------
  V.roomcal = (start, span) => {
    const cfg = A.cfg(), t = today();
    span = [7, 14, 31].includes(+span) ? +span : (narrow() ? 7 : 14);
    start = /^\d{4}-\d\d-\d\d$/.test(start || '') ? start : E.addD(t, -1);
    const days = Array.from({ length: span }, (_, i) => E.addD(start, i));
    const bks = live().filter(b => b.nights && b.date <= days[days.length - 1] && E.addD(b.date, b.nights) > days[0]);
    const rooms = cfg.rooms.filter(r => r.active !== false);
    const rowsHtml = rooms.map(r => { let tds = '', i = 0;
      while (i < days.length) { const d = days[i];
        const b = bks.find(x => (x.product === 'house' || (x.rooms || []).includes(r.id)) && x.date <= d && d < E.addD(x.date, x.nights));
        if (b) { let n = 1; while (i + n < days.length && days[i + n] < E.addD(b.date, b.nights)) n++; tds += `<td colspan="${n}" class="${days.slice(i, i + n).includes(t) ? 'tcol' : ''}"><a class="rc-bk ${b.date < d ? 'cont' : ''}" href="#/booking/${b.id}" style="${evStyle(b.product)}" title="${esc(A.cust(b))} · ${esc(A.pname(b.product))} · ${fd(b.date)} → ${fd(E.addD(b.date, b.nights))}">${esc(A.cust(b))}<small>${esc(A.pname(b.product))}</small></a></td>`; i += n; continue; }
        const cl = E.closedAllDay(cfg, d, ['rooms', 'room:' + r.id]);
        tds += `<td class="${cl ? 'cl' : 'free'} ${d === t ? 'tcol' : ''}" ${!cl && d >= t ? `data-free="${d}"` : ''} title="${cl ? 'Closed' : d >= t ? 'Free · tap to book' : ''}"></td>`; i++; }
      return `<tr><th class="rn"><b>${esc(r.name)}</b><small>${esc(r.bed)} · sleeps ${r.people}</small></th>${tds}</tr>`; }).join('');
    const occ = days.map(d => { const used = new Set(bks.filter(b => b.date <= d && d < E.addD(b.date, b.nights)).flatMap(b => b.product === 'house' ? rooms.map(r => r.id) : b.rooms || [])).size; return `<td class="${d === t ? 'tcol' : ''}"><span class="small ${used === rooms.length ? 'full' : ''}">${used}/${rooms.length}</span></td>`; }).join('');
    const html = `<div class="cal-bar"><div class="cal-bar-l"><a class="btn" href="#/roomcal/${E.addD(t, -1)}/${span}">Today</a><a class="icon-btn" href="#/roomcal/${E.addD(start, -span)}/${span}" aria-label="Earlier">${A.ic.left}</a><a class="icon-btn" href="#/roomcal/${E.addD(start, span)}/${span}" aria-label="Later">${A.ic.right}</a><h1 class="cal-title">Room calendar</h1><span class="muted small">${fd(days[0])} – ${fdy(days[days.length - 1])}</span></div>
        <div class="seg cal-modes">${[[7, 'Week'], [14, '2 weeks'], [31, 'Month']].map(([n, l]) => `<a href="#/roomcal/${start}/${n}" class="${n === span ? 'on' : ''}">${l}</a>`).join('')}</div></div>
      <p class="muted small" style="margin:-4px 0 10px">Each block is a booking’s nights in that room. Tap a free night to book a stay from that date.</p>
      <div class="roomcal card flush"><table><thead><tr><th class="rn">Room</th>${days.map(d => `<th class="${d === t ? 'tcol today' : ''} ${E.dow(d) === 5 || E.dow(d) === 6 ? 'we' : ''}"><small>${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][E.dow(d)]}</small><b>${+d.slice(8)}</b></th>`).join('')}</tr></thead><tbody>${rowsHtml}<tr class="occ-row"><th class="rn"><small>Rooms used</small></th>${occ}</tr></tbody></table></div>
      <div class="legend">${Object.entries(cfg.products).filter(([, p]) => p.kind === 'stay' || p.kind === 'house').map(([k, p]) => `<span><i style="background:${PCOL[k]}"></i>${esc(p.name)}</span>`).join('')}<span><i style="background:repeating-linear-gradient(-45deg,#fff,#fff 3px,#f4e3e1 3px,#f4e3e1 6px);border:1px solid #e3c9c6"></i>Closed</span></div>`;
    return { html, wire: el => $$('[data-free]', el).forEach(c => c.onclick = () => { if (!A.can || A.can('bookings.create')) location.hash = `#/new?date=${c.dataset.free}&product=break`; }) };
  };
  // the old planner tab now lives here
  const oldRooms = V.rooms; V.rooms = (tab, ...rest) => tab === 'planner' ? (location.hash = '#/roomcal', '') : oldRooms(tab, ...rest);
})();
