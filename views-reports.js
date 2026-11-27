/* Reports: money, spa, rooms, treatments, therapists, guests, and food orders. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, gbp, fd, fdy, today, DAYS, PCOL } = A;
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
  const hrs = m => Math.round(m / 6) / 10;
  const PERIODS = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['month', 'This month'], ['last', 'Last month'], ['next30', 'Next 30 days'], ['year', 'This year'], ['custom', 'Custom']];
  const range = (F, t) => {
    if (F.p === '30') return [E.addD(t, -29), t]; if (F.p === '90') return [E.addD(t, -89), t]; if (F.p === 'next30') return [t, E.addD(t, 29)];
    if (F.p === 'month') return [t.slice(0, 8) + '01', E.addD(E.addD(t.slice(0, 8) + '01', 32).slice(0, 8) + '01', -1)];
    if (F.p === 'last') { const f = E.addD(t.slice(0, 8) + '01', -1).slice(0, 8) + '01'; return [f, E.addD(t.slice(0, 8) + '01', -1)]; }
    if (F.p === 'year') return [t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31'];
    return [F.from || E.addD(t, -29), F.to || t];
  };
  const days = (a, b) => { const o = []; for (let d = a; d <= b; d = E.addD(d, 1)) o.push(d); return o; };
  // simple accessible bar chart (stacked by product), with hover titles
  const stacked = (buckets, keys, fmt) => {
    const W = 720, H = 200, pad = 62, mx = Math.max(1, ...buckets.map(b => keys.reduce((a, k) => a + (b.v[k] || 0), 0)));
    const bw = Math.max(4, (W - pad - 8) / buckets.length - 4);
    let g = `<line x1="${pad}" y1="${H - 20}" x2="${W}" y2="${H - 20}" stroke="#e1e0d9"/>`;
    [0.5, 1].forEach(f => g += `<line x1="${pad}" y1="${(H - 20) - (H - 34) * f}" x2="${W}" y2="${(H - 20) - (H - 34) * f}" stroke="#e1e0d9" stroke-dasharray="2 3"/><text x="${pad - 4}" y="${(H - 20) - (H - 34) * f + 4}" text-anchor="end">${fmt(mx * f)}</text>`);
    buckets.forEach((b, i) => {
      const x = pad + 4 + i * (bw + 4); let y = H - 20;
      keys.forEach(k => { const v = b.v[k] || 0; if (!v) return; const h = (H - 34) * v / mx; g += `<rect x="${x}" y="${y - h + 1}" width="${bw}" height="${Math.max(0, h - 2)}" rx="2" fill="${PCOL[k] || '#8a9a85'}"><title>${esc(b.label)} · ${esc(A.pname(k))}: ${fmt(v)}</title></rect>`; y -= h; });
      if (buckets.length <= 16 || i % Math.ceil(buckets.length / 12) === 0) g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(b.short)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chart">${g}</svg><div class="legend">${keys.filter(k => buckets.some(b => b.v[k])).map(k => `<span><i style="background:${PCOL[k]}"></i>${esc(A.pname(k))}</span>`).join('')}</div>`;
  };
  const hbars = (rows, fmt, colour) => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.map(r => `<div class="hbar"><span>${r[2] ? A.prodDot(r[2]) + ' ' : ''}${esc(r[0])}</span><span class="bar"><i style="width:${r[1] / mx * 100}%;background:${r[2] ? PCOL[r[2]] : colour || 'var(--forest)'}"></i></span><b>${fmt(r[1])}</b></div>`).join('') || '<p class="muted">No data</p>'; };

  // a booking's total, worked out if it was saved without one (one missing total made the whole sum show £0)
  const qt = b => { const q = b.quote && b.quote.total != null ? b.quote : (() => { try { return E.quote(A.cfg(), b); } catch (e) { return null; } })(); return (q && +q.total) || 0; };
  A.views.reports = (tab = 'overview') => {
    if (tab === 'food') return food();
    const cfg = A.cfg(), DB = A.DB(), t = today(), F = A._rf = A._rf || { p: '30' };
    const [from, to] = range(F, t), dl = days(from, to);
    const inP = b => b.date >= from && b.date <= to;
    const all = DB.bookings.filter(inP), live = all.filter(E.live), canc = all.filter(b => b.status === 'cancelled');
    const total = live.reduce((a, b) => a + qt(b), 0), guests = live.reduce((a, b) => a + b.guests, 0);
    const payIn = DB.bookings.flatMap(b => (b.payments || []).map(p => ({ ...p, b }))).filter(p => (p.at || '').slice(0, 10) >= from && (p.at || '').slice(0, 10) <= to);
    const taken = payIn.filter(p => p.amount > 0).reduce((a, p) => a + p.amount, 0), refunds = -payIn.filter(p => p.amount < 0).reduce((a, p) => a + p.amount, 0);
    // previous period for comparison
    const len = dl.length, pf = E.addD(from, -len), pt = E.addD(from, -1);
    const prevLive = DB.bookings.filter(b => E.live(b) && b.date >= pf && b.date <= pt), prevTotal = prevLive.reduce((a, b) => a + qt(b), 0);
    const delta = (a, b) => b ? `<span class="${a >= b ? 'up' : 'down'}">${a >= b ? '▲' : '▼'} ${Math.abs(pct(a - b, b))}%</span> vs the ${len} days before` : '';
    const prods = Object.keys(cfg.products);
    // buckets: by day (<= 31 days), else by week
    const byWeek = dl.length > 45;
    const bk = []; for (let i = 0; i < dl.length; i += byWeek ? 7 : 1) { const d0 = dl[i], d1 = dl[Math.min(dl.length - 1, i + (byWeek ? 6 : 0))]; const v = {}; live.filter(b => b.date >= d0 && b.date <= d1).forEach(b => v[b.product] = (v[b.product] || 0) + qt(b)); bk.push({ label: byWeek ? `Week of ${fd(d0)}` : fdy(d0), short: byWeek ? fd(d0, { day: 'numeric', month: 'short' }) : String(+d0.slice(8)), v }); }
    const byProd = prods.map(k => [cfg.products[k].name, live.filter(b => b.product === k).reduce((a, b) => a + qt(b), 0), k]).filter(r => r[1]).sort((a, b) => b[1] - a[1]);
    // spa sessions fill
    const fill = prods.filter(k => cfg.products[k].kind === 'session').map(k => { let cap = 0, used = 0; dl.forEach(d => { if (!E.hours(cfg, d) || E.closedAllDay(cfg, d, ['spa', 'product:' + k])) return; cfg.sessions.filter(s => s.product === k && s.active !== false && (!s.days || s.days.includes(E.dow(d)))).forEach(s => cap += s.cap); }); used = live.filter(b => b.product === k).reduce((a, b) => a + b.guests, 0); return [cfg.products[k].name, pct(used, cap), k, used, cap]; });
    // rooms
    const roomsN = cfg.rooms.filter(r => r.active !== false).length; let roomNights = 0, roomRev = 0;
    DB.bookings.filter(b => E.live(b) && b.nights).forEach(b => { const ns = E.nightsOf(b), inside = ns.filter(n => n >= from && n <= to).length; if (!inside) return; const rn = b.product === 'house' ? roomsN : (b.rooms || []).length; roomNights += rn * inside; const base = ((b.quote || {}).lines || []).filter(l => l.k === 'base').reduce((a, l) => a + l.amount, 0); roomRev += base * inside / ns.length; });
    const availRN = roomsN * dl.filter(d => !E.closedAllDay(cfg, d, ['rooms'])).length;
    // treatments
    const items = live.flatMap(b => (b.items || []).map(i => ({ ...i, b })));
    const extras = items.filter(i => !/-inc/.test(i.key));
    const trRev = live.reduce((a, b) => a + ((b.quote || {}).lines || []).filter(l => l.k === 'treat' || l.k === 'headoff').reduce((x, l) => x + l.amount, 0), 0);
    const attach = live.filter(b => cfg.products[b.product].kind !== 'treat').length ? pct(live.filter(b => cfg.products[b.product].kind !== 'treat' && (b.guestList || []).some(g => (g.extras || []).length)).length, live.filter(b => cfg.products[b.product].kind !== 'treat').length) : 0;
    const topT = Object.entries(extras.reduce((o, i) => (o[i.tid] = (o[i.tid] || 0) + 1, o), {})).map(([k, n]) => [A.tname(k), n]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let roomMins = 0; dl.forEach(d => { const h = E.hours(cfg, d); if (h) roomMins += cfg.treatRooms.filter(r => r.active !== false).reduce((a, r) => a + (r.beds || 1), 0) * (E.T(h.end) - E.T(h.start)); });
    const trMins = items.reduce((a, i) => a + i.min, 0);
    const revpath = roomMins ? (trRev + live.filter(b => b.product === 'treat').reduce((a, b) => a + 0, 0)) / (roomMins / 60) : 0;
    const ther = cfg.staff.filter(s => s.active !== false).map(s => { let avail = 0; dl.forEach(d => { const x = E.staffDay(cfg, s, d); if (x) avail += x.spans.reduce((a, sp) => a + sp[1] - sp[0], 0); }); const used = items.filter(i => i.staff === s.id).reduce((a, i) => a + i.min, 0); return [s.name, pct(used, avail), null, used, avail, s.colour]; });
    // guests
    const firstSeen = {}; DB.bookings.filter(E.live).forEach(b => { const e = ((b.customer || {}).email || '').toLowerCase(); if (e && (!firstSeen[e] || b.date < firstSeen[e])) firstSeen[e] = b.date; });
    const custs = [...new Set(live.map(b => ((b.customer || {}).email || '').toLowerCase()).filter(Boolean))];
    const newC = custs.filter(e => firstSeen[e] >= from).length;
    const leadBins = [['Same week', 0, 7], ['1–2 weeks', 8, 14], ['2–4 weeks', 15, 28], ['1–2 months', 29, 60], ['2+ months', 61, 9999]].map(([l, a, b]) => [l, live.filter(x => x.created && (() => { const d = E.between(x.created.slice(0, 10), x.date); return d >= a && d <= b; })()).length]);
    const dow = [1, 2, 3, 4, 5, 6, 0].map(d => [DAYS[d], live.filter(b => E.dow(b.date) === d).reduce((a, b) => a + b.guests, 0)]);
    const src = Object.entries(all.reduce((o, b) => (o[b.source || 'admin'] = (o[b.source || 'admin'] || 0) + 1, o), {})).map(([k, n]) => [k === 'web' ? 'Website' : k[0].toUpperCase() + k.slice(1), n]).sort((a, b) => b[1] - a[1]);
    const meth = Object.entries(payIn.filter(p => p.amount > 0).reduce((o, p) => (o[p.method] = (o[p.method] || 0) + p.amount, o), {})).map(([k, n]) => [k, n]).sort((a, b) => b[1] - a[1]);
    const reasons = Object.entries(canc.reduce((o, b) => (o[(b.cancelled || {}).reason || 'Not given'] = (o[(b.cancelled || {}).reason || 'Not given'] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]);
    const promos = (cfg.promos || []).map(p => { const u = live.filter(b => b.promo && b.promo.code === p.code); return [p.code, u.length, u.reduce((a, b) => a - ((b.quote || {}).lines || []).filter(l => l.k === 'promo').reduce((x, l) => x + l.amount, 0), 0), u.reduce((a, b) => a + b.quote.total, 0)]; }).filter(r => r[1]);
    const vLiab = DB.vouchers.filter(v => v.status === 'active' && v.expires >= t).reduce((a, v) => a + v.balance, 0);

    const sel = `<div class="card" style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select class="inp" id="rp" style="width:auto">${PERIODS.map(([v, x]) => `<option value="${v}" ${F.p === v ? 'selected' : ''}>${x}</option>`).join('')}</select>${F.p === 'custom' ? `<input type="date" class="inp" id="rf" value="${from}" style="width:auto"> to <input type="date" class="inp" id="rt" value="${to}" style="width:auto">` : ''}<span class="muted small">${fdy(from)} – ${fdy(to)} · by visit date</span><span style="flex:1"></span><button class="btn sm" id="rCsv">${A.ic.dl} Export</button></div>`;
    const kpi = (l, v, s) => `<div class="kpi"><small>${l}</small><b>${v}</b><span>${s || ''}</span></div>`;
    const tip = s => `<span class="small muted" style="display:block;margin-top:2px">${s}</span>`;
    // income by month (user 2026-11-27): the last 12 months and the next 3, booked value by type, and money actually taken
    const monthly = () => {
      const ms = []; let m = t.slice(0, 7); for (let i = 0; i < 11; i++) m = E.addD(m + '-01', -1).slice(0, 7);
      for (let i = 0; i < 15; i++) { ms.push(m); m = E.addD(m + '-28', 5).slice(0, 7); }
      const used = prods.filter(k => DB.bookings.some(b => E.live(b) && b.product === k));
      const val = (mo, k) => DB.bookings.filter(b => E.live(b) && b.date.slice(0, 7) === mo && (!k || b.product === k)).reduce((a, b) => a + (qt(b) || 0), 0);
      const took = mo => DB.bookings.flatMap(b => b.payments || []).filter(p => (p.at || '').slice(0, 7) === mo).reduce((a, p) => a + (+p.amount || 0), 0);
      const vsold = mo => DB.vouchers.filter(v => (v.sold || '').slice(0, 7) === mo).reduce((a, v) => a + (+v.paid || 0), 0);
      const nm = mo => new Date(mo + '-15').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const rows = ms.map(mo => `<tr${mo === t.slice(0, 7) ? ' style="background:var(--cream)"' : ''}><td style="white-space:nowrap"><b>${nm(mo)}</b>${mo > t.slice(0, 7) ? ' <span class="small muted">ahead</span>' : ''}</td>${used.map(k => `<td class="r tnum">${val(mo, k) ? gbp(val(mo, k)) : '<span class="muted">—</span>'}</td>`).join('')}<td class="r tnum"><b>${gbp(val(mo))}</b></td><td class="r tnum">${gbp(took(mo))}</td><td class="r tnum">${vsold(mo) ? gbp(vsold(mo)) : '<span class="muted">—</span>'}</td></tr>`).join('');
      return `<div class="card" style="margin-top:14px"><div class="card-h"><h3>Income by month</h3><span class="small muted">Booked value by visit month · money taken by payment date</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th>${used.map(k => `<th class="r">${esc(A.pname(k))}</th>`).join('')}<th class="r">Booked</th><th class="r">Taken</th><th class="r">Vouchers sold</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    };
    const html = `<div class="vh"><div><div class="eyebrow">Reports</div><h1>Reports</h1><p>How the spa is doing, using the measures spas and hotels compare themselves on.</p></div><div class="acts"><a class="btn" href="#/reports/food">Food orders</a></div></div>${sel}
      <div class="grid g4" style="margin-bottom:14px">${kpi('Booked value', gbp(total), delta(total, prevTotal))}${kpi('Bookings', live.length, `${guests} guests · ${gbp(live.length ? total / live.length : 0)} average`)}${kpi('Money taken', gbp(taken), `${gbp(refunds)} refunded`)}${kpi('Spend per guest', gbp(guests ? total / guests : 0), `${canc.length} cancelled (${pct(canc.length, all.length)}%)`)}</div>
      <div class="card"><div class="card-h"><h3>Booked value ${byWeek ? 'by week' : 'by day'}</h3></div>${stacked(bk, prods, v => gbp(v))}</div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><div class="card-h"><h3>By booking type</h3></div>${hbars(byProd, v => gbp(v))}</div>
        <div class="card"><div class="card-h"><h3>Spa sessions filled</h3></div>${hbars(fill.map(f => [f[0] + ` (${f[3]} of ${f[4]})`, f[1], f[2]]), v => v + '%')}${tip('Places booked as a share of places on offer, for days the spa was open.')}</div>
      </div>
      ${monthly()}
      <h2 style="margin:24px 0 10px">Rooms</h2>
      <div class="grid g4">${kpi('Occupancy', pct(roomNights, availRN) + '%', `${roomNights} of ${availRN} room nights`)}${kpi('ADR', gbp(roomNights ? roomRev / roomNights : 0), 'average room-night rate')}${kpi('RevPAR', gbp(availRN ? roomRev / availRN : 0), 'stay revenue per available room night')}${kpi('Stays', live.filter(b => b.nights).length, `${live.filter(b => b.product === 'house').length} whole-house`)}</div>
      <h2 style="margin:24px 0 10px">Treatments & therapists</h2>
      <div class="grid g4">${kpi('Extra treatments', extras.length, gbp(trRev) + ' revenue')}${kpi('Add-on rate', attach + '%', 'spa days & stays with an extra treatment')}${kpi('RevPATH', gbp(revpath, 2), 'treatment revenue per available treatment-bed hour')}${kpi('Treatment rooms used', pct(trMins, roomMins) + '%', `${hrs(trMins)} of ${hrs(roomMins)} bed hours`)}</div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><div class="card-h"><h3>Therapist utilisation</h3></div>${ther.map(r => `<div class="hbar"><span><span class="dot" style="background:${r[5]}"></span> ${esc(r[0])}</span><span class="bar"><i style="width:${Math.min(100, r[1])}%;background:${r[1] > 80 ? 'var(--warn)' : r[5]}"></i></span><b>${r[1]}%</b></div><p class="small muted" style="margin:-2px 0 6px">${hrs(r[3])} h treatments of ${hrs(r[4])} h working</p>`).join('')}${tip('Treatment time as a share of working time. Consistently over 80% means it’s time to recruit.')}</div>
        <div class="card"><div class="card-h"><h3>Most booked extras</h3></div>${hbars(topT, v => v)}</div>
      </div>
      <h2 style="margin:24px 0 10px">Guests</h2>
      <div class="grid g4">${kpi('Guests', custs.length, `${newC} new · ${custs.length - newC} returning`)}${kpi('Returning', pct(custs.length - newC, custs.length) + '%', 'had visited before')}${kpi('Gift vouchers owed', gbp(vLiab), 'value left on live vouchers')}${kpi('Codes used', promos.reduce((a, p) => a + p[1], 0), gbp(promos.reduce((a, p) => a + p[2], 0)) + ' given in discounts')}</div>
      <div class="grid g3" style="margin-top:14px">
        <div class="card"><div class="card-h"><h3>Busiest days</h3></div>${hbars(dow, v => v)}${tip('Guests by day of the week')}</div>
        <div class="card"><div class="card-h"><h3>How far ahead they book</h3></div>${hbars(leadBins, v => v)}</div>
        <div class="card"><div class="card-h"><h3>How they booked</h3></div>${hbars(src, v => v)}<div class="hr"></div><h3 style="font-size:17px;margin-bottom:6px">Paid by</h3>${hbars(meth, v => gbp(v))}</div>
      </div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><div class="card-h"><h3>Cancellations</h3><span class="muted small">${canc.length} · ${gbp(canc.reduce((a, b) => a - (b.payments || []).filter(p => p.amount < 0).reduce((x, p) => x + p.amount, 0), 0))} refunded</span></div>${hbars(reasons, v => v, 'var(--bad)')}</div>
        <div class="card"><div class="card-h"><h3>Discount codes</h3></div>${promos.length ? `<table class="tbl"><thead><tr><th>Code</th><th class="r">Bookings</th><th class="r">Discount</th><th class="r">Booked value</th></tr></thead><tbody>${promos.map(p => `<tr><td><b>${esc(p[0])}</b></td><td class="r">${p[1]}</td><td class="r">${gbp(p[2])}</td><td class="r">${gbp(p[3])}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No codes used in this period.</p>'}</div>
      </div>`;
    return { html, wire: el => {
      $('#rp', el).onchange = e => { F.p = e.target.value; A.refresh(); };
      const rf = $('#rf', el); if (rf) { rf.onchange = () => { F.from = rf.value; A.refresh(); }; $('#rt', el).onchange = e => { F.to = e.target.value; A.refresh(); }; }
      $('#rCsv', el).onclick = () => A.csv(`report-${from}-to-${to}.csv`, [['Measure', 'Value'], ['Booked value', total], ['Bookings', live.length], ['Guests', guests], ['Money taken', taken], ['Refunds', refunds], ['Cancelled bookings', canc.length], ['Room occupancy %', pct(roomNights, availRN)], ['ADR', roomNights ? roomRev / roomNights : 0], ['RevPAR', availRN ? roomRev / availRN : 0], ['Extra treatments', extras.length], ['Treatment revenue', trRev], ['RevPATH', revpath], ['Treatment room utilisation %', pct(trMins, roomMins)], ...ther.map(r => [`Utilisation ${r[0]} %`, r[1]]), ...byProd.map(r => [`Booked value ${r[0]}`, r[1]]), ['New guests', newC], ['Returning guests', custs.length - newC], ['Gift voucher balance owed', vLiab]]);
    } };
  };

  // food orders for the next 14 days (for the supplier)
  function food() {
    const cfg = A.cfg(), DB = A.DB(), t = today(), dl = days(t, E.addD(t, 13));
    const live = DB.bookings.filter(E.live);
    const rows = dl.map(d => { const o = {}; live.filter(b => b.date === d).forEach(b => { (b.guestList || []).forEach(g => { if (g.food) o[g.food] = (o[g.food] || 0) + 1; }); (cfg.products[b.product].foodsIncluded || []).forEach(f => o[f] = (o[f] || 0) + b.guests); });
      const bf = live.filter(b => b.breakfast && b.nights && b.date < d && d <= E.addD(b.date, b.nights)).reduce((a, b) => a + b.guests, 0); if (bf) o.breakfast = bf;
      const notes = live.filter(b => b.date === d && b.notes && /vegan|veg|gluten|allerg|dairy|nut|coeliac|halal|kosher/i.test(b.notes)).map(b => `${A.cust(b)}: ${b.notes}`); return { d, o, notes }; });
    const keys = [...cfg.foods.map(f => f.id), 'breakfast'];
    const name = k => k === 'breakfast' ? 'Breakfast' : (cfg.foods.find(f => f.id === k) || {}).name || k;
    return { html: `<div class="vh"><div><div class="eyebrow">Reports</div><h1>Food orders</h1><p>What to order for the next 14 days, with dietary notes guests gave.</p></div><div class="acts"><a class="btn" href="#/reports">Back to reports</a><button class="btn" id="fCsv">${A.ic.dl} Export</button><button class="btn" onclick="print()">${A.ic.print} Print</button><button class="btn pri" id="fMail">${A.ic.mail} Email the supplier</button></div></div>
      <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Day</th>${keys.map(k => `<th class="r">${esc(name(k))}</th>`).join('')}<th>Dietary notes</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${fd(r.d)}</b></td>${keys.map(k => `<td class="r tnum">${r.o[k] || '<span class="muted">—</span>'}</td>`).join('')}<td class="small">${r.notes.map(esc).join('<br>')}</td></tr>`).join('')}
      <tr><td><b>Total</b></td>${keys.map(k => `<td class="r"><b>${rows.reduce((a, r) => a + (r.o[k] || 0), 0)}</b></td>`).join('')}<td></td></tr></tbody></table></div></div>`,
      wire: el => {
        $('#fCsv', el).onclick = () => A.csv(`food-orders-${t}.csv`, [['Day', ...keys.map(name), 'Dietary notes'], ...rows.map(r => [r.d, ...keys.map(k => r.o[k] || 0), r.notes.join(' | ')])]);
        $('#fMail', el).onclick = async () => {
          const r = await A.modal({ title: 'Email the food order', body: `${A.f.text('to', 'Supplier email', cfg.business.foodSupplierEmail || '', { type: 'email', ph: 'orders@…' })}<p class="small muted">Sends the table for the next 14 days.</p>`, ok: 'Send', onOk: m => { const v = A.read(m); if (!/^\S+@\S+\.\S+$/.test(v.to)) throw new Error('Add the email'); return v; } });
          if (!r) return; cfg.business.foodSupplierEmail = r.to; A.change('cfg');
          const body = `Hello,\n\nHere is York Cottage’s food order for the next two weeks:\n\n${rows.filter(x => Object.keys(x.o).length).map(x => `${fdy(x.d)}: ${Object.entries(x.o).map(([k, n]) => `${n} × ${name(k)}`).join(', ')}${x.notes.length ? '\n  Dietary: ' + x.notes.join('; ') : ''}`).join('\n')}\n\nThank you,\nYork Cottage Spa`;
          St.queue({ type: 'email', to: r.to, subject: 'York Cottage food order', body });
          if (St.S.mode === 'demo') await A.modal({ title: 'Email preview', ok: 'Done', cancel: '', size: 'wide', body: `<pre style="white-space:pre-wrap;font-family:inherit;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px">${esc(body)}</pre>` }); else A.toast('Order queued');
        };
      } };
  }
})();
