/* York Cottage booking engine: availability, therapist + room scheduling, prices and cancellation terms.
   One copy runs in the admin portal and the same file runs on the public website, so both follow the same rules.
   Times are minutes from midnight; dates are 'YYYY-MM-DD' (UK local dates). */
(function (root) {
  const E = {};
  const T = s => { if (typeof s === 'number') return s; const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
  const HM = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(Math.round(n % 60)).padStart(2, '0');
  const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const isoU = d => d.toISOString().slice(0, 10);
  const addD = (s, n) => { const d = pd(s); d.setUTCDate(d.getUTCDate() + n); return isoU(d); };
  const dow = s => pd(s).getUTCDay();
  const between = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
  const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const overlap = (a, b, c, d) => a < d && c < b;
  Object.assign(E, { T, HM, addD, dow, between, localISO, pd });

  const LIVE = b => b && b.status !== 'cancelled' && b.status !== 'draft' && b.status !== 'enquiry' && b.status !== 'expired';
  E.live = LIVE;
  E.prod = (cfg, k) => cfg.products[k];
  E.tr = (cfg, id) => cfg.treatments.find(t => t.id === id);

  // ---------- opening, closures, rates ----------
  E.hours = (cfg, date) => {
    if (cfg.hoursOverride && date in cfg.hoursOverride) return cfg.hoursOverride[date];
    return cfg.hours[dow(date)] || null;
  };
  const scopeHit = (c, scopes) => c.scope.includes('all') || scopes.some(s => c.scope.includes(s));
  // closures covering a date for any of the scopes ('spa', 'rooms', 'treatments', 'product:day', 'room:r1', 'troom:tr1')
  E.closures = (cfg, date, scopes) => (cfg.closures || []).filter(c => c.from <= date && date <= (c.to || c.from) && scopeHit(c, scopes));
  // a closure with start/end times only blocks part of the day
  const fullDay = c => !c.start;
  E.closedAllDay = (cfg, date, scopes) => E.closures(cfg, date, scopes).some(fullDay);
  E.closedBetween = (cfg, date, scopes, s, e) => E.closures(cfg, date, scopes).some(c => fullDay(c) || overlap(s, e, T(c.start), T(c.end)));

  E.rate = (cfg, product, date) => {
    let r = null;
    for (const x of cfg.rates || []) if ((x.product === product || x.product === 'all') && x.from <= date && date <= (x.to || x.from) && (!x.days || !x.days.length || x.days.includes(dow(date)))) r = x;
    return r;
  };
  E.stopSell = (cfg, product, date) => { const r = E.rate(cfg, product, date); return !!(r && r.stopSell); };

  // ---------- what a booking uses ----------
  E.stayTimes = (cfg, product, date, nights) => {
    const p = cfg.products[product]; if (!p || !p.times) return null;
    const t = { ...(p.times.default || {}), ...(p.times[dow(date)] || {}) };
    if (nights > 1 && t.spa2) t.spa = t.spa2;
    return t;
  };
  E.session = (cfg, id) => (cfg.sessions || []).find(s => s.id === id);

  // spa use: [{date, s, e, n, x (exclusive), ses}]
  E.spaUse = (cfg, b) => {
    const p = cfg.products[b.product]; if (!p) return [];
    if (p.kind === 'session' || p.kind === 'private') {
      const s = E.session(cfg, b.sessionId); if (!s) return [];
      return [{ date: b.date, s: T(s.start), e: T(s.end), n: b.guests, x: p.kind === 'private', ses: s.id }];
    }
    if (p.kind === 'stay') {
      const out = [];
      for (let i = 0; i < (b.nights || 1); i++) {
        const d = addD(b.date, i), t = E.stayTimes(cfg, b.product, d, b.nights);
        if (t && t.spa) out.push({ date: d, s: T(t.spa[0]), e: T(t.spa[1]), n: b.guests, x: !!(p.exclusive || (p.exclusiveFrom && b.guests >= p.exclusiveFrom)) });
      }
      return out;
    }
    if (p.kind === 'house') {
      const t = E.stayTimes(cfg, 'house', b.date, b.nights), out = [];
      for (let i = 0; i <= b.nights; i++) {
        const d = addD(b.date, i);
        out.push({ date: d, s: i === 0 ? Math.max(0, T(t.checkIn) - 120) : 0, e: i === b.nights ? T(t.checkOut) + 60 : 1440, n: b.guests, x: true, house: true });
      }
      return out;
    }
    return [];
  };
  E.nightsOf = b => { const out = []; for (let i = 0; i < (b.nights || 0); i++) out.push(addD(b.date, i)); return out; };

  // ---------- the busy index (also published, without names, for the website) ----------
  E.index = (cfg, bookings, excludeId) => {
    const ix = { spa: {}, ses: {}, rooms: {}, house: {}, staff: {}, troom: {}, guest: {}, food: {}, duty: {} };
    for (const b of bookings || []) {
      if (!LIVE(b) || (excludeId && b.id === excludeId)) continue;
      E.addToIndex(cfg, ix, b);
    }
    return ix;
  };
  E.addToIndex = (cfg, ix, b) => {
    const p = cfg.products[b.product];
    for (const u of E.spaUse(cfg, b)) {
      (ix.spa[u.date] = ix.spa[u.date] || []).push([u.s, u.e, u.n, u.x ? 1 : 0]);
      if (u.ses) { const k = ix.ses[u.date] = ix.ses[u.date] || {}; k[u.ses] = (k[u.ses] || 0) + u.n; }
      if (u.house) ix.house[u.date] = 1;
    }
    const rooms = p && p.kind === 'house' ? cfg.rooms.map(r => r.id) : (b.rooms || []);
    for (const d of E.nightsOf(b)) { const r = ix.rooms[d] = ix.rooms[d] || []; for (const id of rooms) if (!r.includes(id)) r.push(id); }
    for (const it of b.items || []) {
      if (!it.staff || it.start == null) continue;
      const d = it.date || b.date, s = T(it.start), e = s + it.min, eb = e + (it.buffer || 0);
      ((ix.staff[d] = ix.staff[d] || {})[it.staff] = ix.staff[d][it.staff] || []).push([s, eb, it.min]);
      if (it.troom) ((ix.troom[d] = ix.troom[d] || {})[it.troom] = ix.troom[d][it.troom] || []).push(it.pair ? [s, eb, it.pair] : [s, eb]);
    }
    // food service: count who eats, then make sure someone is on duty to serve it
    for (const sv of E.servicesFor(cfg, b)) { ix.food = ix.food || {}; const f = ix.food[sv.date] = ix.food[sv.date] || {}; f[sv.id] = (f[sv.id] || 0) + b.guests; E.ensureDuty(cfg, ix, sv.date, sv.id); }
  };

  // ---------- food service (lunch between the morning and afternoon sessions, grazing boards on stays) ----------
  // cfg.services: [{ id, name, start, end, products:[], staff: how many people (at least 1), byDay:{ 0:{start,end} }, active }]
  // Whoever is on duty can't be booked for treatments during the service.
  E.service = (cfg, id, date) => { const sv = (cfg.services || []).find(x => x.id === id); return sv ? { ...sv, ...((sv.byDay || {})[dow(date)] || {}) } : null; };
  E.servicesFor = (cfg, b) => {
    const p = cfg.products[b.product], out = []; if (!p) return out;
    const eats = (p.food && (b.guestList || []).some(g => g.food)) || (p.foodsIncluded && p.foodsIncluded.length);
    if (!eats) return out;
    for (const sv of cfg.services || []) if (sv.active !== false && (sv.products || []).includes(b.product)) out.push({ id: sv.id, date: b.date });
    return out;
  };
  // who can serve: staff who do food service, working the whole slot and not on a break; free people first
  E.dutyCandidates = (cfg, ix, date, sv) => {
    const s = T(sv.start), e = T(sv.end);
    return cfg.staff.filter(st => st.active !== false && (st.duties || ['food']).includes('food')).filter(st => {
      const d = E.staffDay(cfg, st, date); return d && d.spans.some(sp => s >= sp[0] && e <= sp[1]) && !d.breaks.some(b => overlap(s, e, b[0], b[1]));
    }).map(st => ({ st, busy: ((ix.staff[date] || {})[st.id] || []).filter(x => x[3] !== 'duty' && overlap(s, e, x[0], x[1])).length, load: handsOn((ix.staff[date] || {})[st.id] || []), notTherapist: (st.treatments || []).length ? 0 : 1 }))
      .sort((a, b) => a.busy - b.busy || b.notTherapist - a.notTherapist || a.load - b.load).map(x => x.st);
  };
  E.ensureDuty = (cfg, ix, date, id) => {
    ix.duty = ix.duty || {}; const dd = ix.duty[date] = ix.duty[date] || {};
    if (dd[id]) return dd[id];
    const sv = E.service(cfg, id, date); if (!sv) return null;
    const pinned = ((cfg.serviceAssign || {})[date] || {})[id];
    const staff = pinned && pinned.length ? pinned.filter(sid => cfg.staff.some(st => st.id === sid)) : E.dutyCandidates(cfg, ix, date, sv).slice(0, Math.max(1, sv.staff || 1)).map(st => st.id);
    dd[id] = staff;
    const s = T(sv.start), e = T(sv.end);
    for (const sid of staff) ((ix.staff[date] = ix.staff[date] || {})[sid] = ix.staff[date][sid] || []).push([s, e, 0, 'duty', id]);
    return staff;
  };
  // is there enough staff for the food service on this date?
  E.serviceOK = (cfg, ix, product, date) => {
    for (const sv0 of cfg.services || []) {
      if (sv0.active === false || !(sv0.products || []).includes(product)) continue;
      const need = Math.max(1, sv0.staff || 1), have = ((ix.duty || {})[date] || {})[sv0.id];
      if (have && have.length >= need) continue;
      const sv = E.service(cfg, sv0.id, date);
      if (E.dutyCandidates(cfg, ix, date, sv).length < need) return `No staff free for the ${sv.name.toLowerCase()}`;
    }
    return '';
  };
  // the public copy: no names, no prices, no references
  E.busy = (cfg, bookings) => {
    const ix = E.index(cfg, bookings), today = localISO(), keep = o => Object.fromEntries(Object.entries(o).filter(([d]) => d >= addD(today, -1)));
    return { at: new Date().toISOString(), spa: keep(ix.spa), ses: keep(ix.ses), rooms: keep(ix.rooms), house: keep(ix.house), staff: keep(ix.staff), troom: keep(ix.troom), food: keep(ix.food), duty: keep(ix.duty) };
  };
  E.fromBusy = busy => ({ spa: busy.spa || {}, ses: busy.ses || {}, rooms: busy.rooms || {}, house: busy.house || {}, staff: busy.staff || {}, troom: busy.troom || {}, guest: {}, food: busy.food || {}, duty: busy.duty || {} });
  E.cloneIx = ix => JSON.parse(JSON.stringify(ix));

  // ---------- spa capacity ----------
  // changeover: bookings that only overlap by this many minutes (one group leaving as the next arrives) don't count
  E.spaLoad = (ix, date, s, e, changeover = 0) => {
    const list = (ix.spa[date] || []).filter(u => Math.min(e, u[1]) - Math.max(s, u[0]) > changeover);
    if (list.some(u => u[3])) return { exclusive: true, people: Infinity, any: true };
    // most people in at the same moment
    let peak = 0; const pts = [...new Set([s, ...list.map(u => u[0]).filter(x => x > s && x < e)])];
    for (const t of pts) peak = Math.max(peak, list.filter(u => u[0] <= t && t < u[1]).reduce((a, u) => a + u[2], 0));
    return { exclusive: false, people: peak, any: list.length > 0 };
  };

  // sessions for a product on a date, with places left
  E.sessions = (cfg, ix, product, date, guests) => {
    const p = cfg.products[product]; if (!p) return [];
    const h = E.hours(cfg, date);
    return (cfg.sessions || []).filter(s => s.product === product && s.active !== false && (!s.days || s.days.includes(dow(date)))).map(s => {
      const st = T(s.start), en = T(s.end);
      let why = '';
      if (!h) why = 'Spa closed';
      else if (E.closedBetween(cfg, date, ['spa', 'product:' + product, 'session:' + s.id], st, en)) why = 'Closed';
      else if (E.stopSell(cfg, product, date)) why = 'Not available';
      const load = E.spaLoad(ix, date, st, en, cfg.spa.changeover || 0);
      let left;
      if (p.kind === 'private') left = load.any ? 0 : s.cap;
      else left = load.exclusive ? 0 : Math.max(0, Math.min(s.cap - ((ix.ses[date] || {})[s.id] || 0), cfg.spa.capacity - load.people));
      if (!why && left <= 0) why = p.kind === 'private' ? 'Spa already booked' : 'Full';
      else if (!why && guests && left < guests) why = `Only ${left} place${left === 1 ? '' : 's'} left`;
      const minG = E.minGuests(cfg, product, date);
      if (!why && guests && guests < minG) why = `Minimum ${minG} guests on this day`;
      if (!why && guests) why = E.includedFit(cfg, ix, { product, date, sessionId: s.id, guests });
      return { id: s.id, name: s.name, start: s.start, end: s.end, arrive: s.arrive, left, ok: !why, why };
    });
  };
  E.minGuests = (cfg, product, date) => { const p = cfg.products[product]; return (p.minByDay && p.minByDay[dow(date)]) || p.min || 1; };

  // ---------- bedrooms ----------
  E.freeRooms = (cfg, ix, date, nights, product) => {
    const out = [];
    for (const r of cfg.rooms) {
      if (r.active === false) continue;
      let ok = true;
      for (let i = 0; i < nights && ok; i++) {
        const d = addD(date, i);
        if ((ix.rooms[d] || []).includes(r.id) || ix.house[d] || E.closedAllDay(cfg, d, ['rooms', 'room:' + r.id, 'product:' + product])) ok = false;
      }
      if (ok) out.push(r);
    }
    return out;
  };
  // which rooms a stay needs; returns null when it can't fit
  E.pickRooms = (cfg, ix, product, date, nights, guests, keep) => {
    const p = cfg.products[product], free = E.freeRooms(cfg, ix, date, nights, product);
    if (p.kind === 'house') return free.length === cfg.rooms.filter(r => r.active !== false).length ? free.map(r => r.id) : null;
    let pool = p.kind === 'stay' && !p.allRooms ? free.filter(r => r.forBreaks) : free;   // allRooms: groups can use every bedroom
    if (keep && keep.length && keep.every(id => pool.some(r => r.id === id)) && keep.reduce((n, id) => n + pool.find(r => r.id === id).people, 0) >= guests) return keep.slice();
    pool = pool.slice().sort((a, b) => b.people - a.people || (b.ensuite ? 1 : 0) - (a.ensuite ? 1 : 0));
    const pick = []; let cap = 0;
    for (const r of pool) { if (cap >= guests) break; pick.push(r.id); cap += r.people; }
    return cap >= guests ? pick : null;
  };

  // ---------- can this stay / visit happen on this date? ----------
  E.dateCheck = (cfg, ix, q) => {   // q: { product, date, nights, guests, now? }
    const p = cfg.products[q.product]; if (!p || p.active === false) return { ok: false, why: 'Not available' };
    const today = q.today || localISO();
    if (q.date < today) return { ok: false, why: 'In the past' };
    // treatments only: not on a day the spa is booked exclusively (private spa, group, or the whole house) (user 2026-11-27)
    if (p.kind === 'treat') { const ph = E.productHours(cfg, q.product, q.date); if (ph && ph.on === false) return { ok: false, why: `${p.name} isn’t available on ${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][dow(q.date)]}` }; }
    // spa sessions, private spa and groups: never on any day of a whole-house stay, arrival to departure day (user 2026-11-27)
    if (p.kind === 'private' || p.kind === 'session' || (p.exclusiveFrom != null && (q.guests || 0) >= p.exclusiveFrom) || q.product === 'group') {
      const hs = ix.house || {}, span = Array.from({ length: (q.nights || 0) + 1 }, (_, i) => addD(q.date, i));
      if (span.some(d => hs[d])) return { ok: false, why: 'The whole house is booked then' };
    }
    if (p.kind === 'treat') { if ((ix.house || {})[q.date]) return { ok: false, why: 'The whole house is booked that day' }; if (((ix.spa || {})[q.date] || []).some(x => x[3])) return { ok: false, why: 'The spa is booked exclusively that day' }; }
    if (!q.admin) {
      if (between(today, q.date) > cfg.rules.bookAheadDays) return { ok: false, why: 'Too far ahead' };
      if (between(today, q.date) * 24 < cfg.rules.minNoticeHours) return { ok: false, why: 'Too soon to book online' };
    }
    if (E.closedAllDay(cfg, q.date, ['product:' + q.product])) return { ok: false, why: 'Closed' };
    if (E.stopSell(cfg, q.product, q.date)) return { ok: false, why: 'Not available' };
    const g = q.guests || p.min;
    if (p.kind === 'session' || p.kind === 'private') {
      if (!E.hours(cfg, q.date) || E.closedAllDay(cfg, q.date, ['spa'])) return { ok: false, why: 'Spa closed' };
      const ses = E.sessions(cfg, ix, q.product, q.date, g);
      if (!ses.length) return { ok: false, why: 'No sessions' };
      if (p.food) { const sw = E.serviceOK(cfg, ix, q.product, q.date); if (sw) return { ok: false, why: sw, sessions: ses }; }
      return ses.some(s => s.ok) ? { ok: true, sessions: ses } : { ok: false, why: ses[0].why || 'Full', sessions: ses };
    }
    if (p.kind === 'treat') {
      if (!E.hours(cfg, q.date) || E.closedAllDay(cfg, q.date, ['treatments'])) return { ok: false, why: 'Closed' };
      const staff = cfg.staff.filter(s => E.staffDay(cfg, s, q.date));
      return staff.length ? { ok: true } : { ok: false, why: 'No therapists' };
    }
    const n = q.nights || (p.nights ? p.nights[0] : p.minN);
    if (p.kind === 'stay') {
      const days = p.arriveDays && p.arriveDays[n];
      if (days && !days.includes(dow(q.date))) return { ok: false, why: 'Not an arrival day' };
      const r = E.rate(cfg, q.product, q.date);
      if (r && r.minNights && n < r.minNights) return { ok: false, why: `${r.minNights}-night minimum` };
      for (let i = 0; i < n; i++) { const d = addD(q.date, i); if (E.stopSell(cfg, q.product, d) || E.closedAllDay(cfg, d, ['rooms', 'spa', 'product:' + q.product])) return { ok: false, why: 'Closed' }; }
      for (const u of E.spaUse(cfg, { product: q.product, date: q.date, nights: n, guests: g })) {
        const load = E.spaLoad(ix, u.date, u.s, u.e, cfg.spa.changeover || 0);
        if (u.x ? load.any : (load.exclusive || load.people + g > cfg.spa.capacity)) return { ok: false, why: u.x ? 'Spa already booked for that time' : 'Spa fully booked' };
      }
      const rooms = E.pickRooms(cfg, ix, q.product, q.date, n, g);
      if (!rooms) return { ok: false, why: 'No rooms left' };
      const fit = E.includedFit(cfg, ix, { product: q.product, date: q.date, nights: n, guests: g }); if (fit) return { ok: false, why: fit };
      return { ok: true, rooms };
    }
    if (p.kind === 'house') {
      if (n < p.minN) return { ok: false, why: `${p.minN}-night minimum` };
      for (let i = 0; i < n; i++) { const d = addD(q.date, i), r = E.rate(cfg, 'house', d); if ((r && r.stopSell) || E.closedAllDay(cfg, d, ['rooms', 'product:house'])) return { ok: false, why: 'Not available' }; if (r && r.minNights && n < r.minNights) return { ok: false, why: `${r.minNights}-night minimum` }; }
      for (const u of E.spaUse(cfg, { product: 'house', date: q.date, nights: n, guests: g })) if (E.spaLoad(ix, u.date, u.s, u.e, cfg.spa.changeover || 0).any) return { ok: false, why: 'Already booked' };
      const rooms = E.pickRooms(cfg, ix, 'house', q.date, n, g);
      return rooms ? { ok: true, rooms } : { ok: false, why: 'Rooms already booked' };
    }
    return { ok: true };
  };
  // can the whole house start on this day (for the check-in calendar)?
  E.houseStartOK = (cfg, ix, date, q = {}) => E.dateCheck(cfg, ix, { ...q, product: 'house', date, nights: cfg.products.house.minN }).ok;

  // ---------- therapists ----------
  // a day's hours, saved as { shifts:[{start,end}, ...], breaks:[{start,min}] } (older { start, end } still read)
  E.shiftsOf = d => !d ? [] : (d.shifts && d.shifts.length ? d.shifts : d.start ? [{ start: d.start, end: d.end }] : []);
  // a therapist's working day: { start, end, spans:[[s,e]...], breaks:[[s,e]] } or null
  E.staffDay = (cfg, st, date) => {
    if (!st || st.active === false) return null;
    if ((st.off || []).some(o => o.from <= date && date <= (o.to || o.from) && !o.start)) return null;
    if (E.closedAllDay(cfg, date, ['treatments', 'staff:' + st.id])) return null;
    let d = st.shifts && date in st.shifts ? st.shifts[date] : (st.pattern || {})[dow(date)];
    const spans = E.shiftsOf(d).map(x => [T(x.start), T(x.end)]).filter(x => x[1] > x[0]).sort((a, b) => a[0] - b[0]);
    if (!spans.length) return null;
    const breaks = (d.breaks || []).map(b => [T(b.start), T(b.start) + (b.min || 30)]);
    for (const o of st.off || []) if (o.from <= date && date <= (o.to || o.from) && o.start) breaks.push([T(o.start), T(o.end)]);
    for (const c of E.closures(cfg, date, ['treatments'])) if (c.start) breaks.push([T(c.start), T(c.end)]);
    return { start: spans[0][0], end: spans[spans.length - 1][1], spans, breaks };
  };
  E.canDo = (st, tid) => (st.treatments || []).includes(tid);
  const handsOn = list => list.reduce((a, x) => a + (x[3] === 'duty' ? 0 : x[2] || 0), 0);
  // break rules for a person: Settings → Breaks, with any per-person overrides
  E.breakRules = (cfg, st) => ({ lunchMin: 30, lunchMax: 60, lunchFrom: '11:30', lunchTo: '15:00', lunchIfOver: 360, breakMin: 15, breakMax: 30, maxWithoutBreak: 240, ...(cfg.rules.breaks || {}), ...((st && st.breakRules) || {}) });
  // free gaps in a working day, given the busy list (treatments + turnover + food service)
  const gapsOf = (day, busy) => {
    const out = [];
    for (const sp of day.spans) {
      let t = sp[0];
      for (const b of busy.filter(x => x[1] > sp[0] && x[0] < sp[1]).sort((a, c) => a[0] - c[0])) { if (b[0] > t) out.push([t, Math.min(b[0], sp[1])]); t = Math.max(t, b[1]); }
      if (t < sp[1]) out.push([t, sp[1]]);
    }
    return out;
  };
  /* Rests: a free gap of at least breakMin counts as a break (set breaks in the pattern are always free).
     1) no stretch of work longer than maxWithoutBreak between breaks
     2) a day longer than lunchIfOver keeps a lunch gap of at least lunchMin inside the lunch window */
  E.restOK = (cfg, st, day, busy) => {
    const r = E.breakRules(cfg, st), gaps = gapsOf(day, busy);
    const rests = gaps.filter(g => g[1] - g[0] >= r.breakMin);
    const work = busy.filter(x => day.spans.some(sp => x[0] < sp[1] && x[1] > sp[0])).sort((a, b) => a[0] - b[0]);
    // between split shifts the time off counts as a rest
    const offs = []; for (let i = 1; i < day.spans.length; i++) offs.push([day.spans[i - 1][1], day.spans[i][0]]);
    const allRests = rests.concat(offs).sort((a, b) => a[0] - b[0]);
    for (const w of work) {
      const before = allRests.filter(g => g[1] <= w[0]).pop(), after = allRests.find(g => g[0] >= w[1]);
      const from = before ? before[1] : day.spans[0][0], to = after ? after[0] : Math.max(...work.map(x => x[1]));
      if (to - from > r.maxWithoutBreak) return `Needs a break (at most ${Math.round(r.maxWithoutBreak / 60 * 10) / 10} hours without one)`;
    }
    const length = day.spans.reduce((a, sp) => a + sp[1] - sp[0], 0);
    if (length > r.lunchIfOver) {
      const lf = T(r.lunchFrom), lt = T(r.lunchTo);
      if (!gaps.some(g => Math.min(g[1], lt) - Math.max(g[0], lf) >= r.lunchMin)) return `Needs a ${r.lunchMin}-minute lunch between ${r.lunchFrom} and ${r.lunchTo}`;
    }
    return '';
  };
  // the lunch and breaks we'd suggest for a day (for the timeline and day sheets)
  E.suggestBreaks = (cfg, st, date, ix) => {
    const day = E.staffDay(cfg, st, date); if (!day) return [];
    const r = E.breakRules(cfg, st), busy = (ix.staff[date] || {})[st.id] || [], gaps = gapsOf(day, busy), out = [];
    const fixed = day.breaks.map(b => ({ s: b[0], e: b[1], kind: 'Break', fixed: true }));
    if (fixed.length) return fixed;
    const lf = T(r.lunchFrom), lt = T(r.lunchTo), length = day.spans.reduce((a, sp) => a + sp[1] - sp[0], 0);
    let lunch = null;
    if (length > r.lunchIfOver) { const g = gaps.filter(g => Math.min(g[1], lt) - Math.max(g[0], lf) >= r.lunchMin).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0]; if (g) { const s0 = Math.max(g[0], lf); lunch = { s: s0, e: Math.min(s0 + r.lunchMax, g[1], lt), kind: 'Lunch' }; out.push(lunch); } }
    for (const g of gaps) if (g[1] - g[0] >= r.breakMin && !(lunch && g[0] <= lunch.s && g[1] >= lunch.e)) out.push({ s: g[0], e: Math.min(g[1], g[0] + r.breakMax), kind: 'Free' });
    return out;
  };
  // can therapist st do [t, t+min) (+buffer) on date, given the index?
  E.freeAt = (ix, date) => { const v = []; for (const m of [ix.staff, ix.troom]) for (const l of Object.values((m || {})[date] || {})) for (const x of l) v.push(Math.ceil(x[1] / 5) * 5); return v; };
  E.startsWith = (grid, ix, date, lo, hi, min, w1) => [...new Set(grid.concat(E.freeAt(ix, date).filter(t => t >= lo && t <= hi && t + min <= w1)))].sort((a, b) => a - b);
  E.staffFree = (cfg, ix, st, date, t, min, buffer) => {
    const day = E.staffDay(cfg, st, date); if (!day) return 'Not working';
    const e = t + min, eb = e + (buffer || 0);
    if (!day.spans.some(sp => t >= sp[0] && eb <= sp[1])) return 'Outside working hours';
    if (day.breaks.some(b => overlap(t, eb, b[0], b[1]))) return 'On a break';
    const list = (ix.staff[date] || {})[st.id] || [];
    const hit = list.find(x => overlap(t, eb, x[0], x[1])); if (hit) return hit[3] === 'duty' ? 'On food service' : 'Already booked';
    if (handsOn(list) + min > (st.maxHands || cfg.rules.maxHandsOn)) return 'Daily hands-on limit';
    const rest = E.restOK(cfg, st, day, list.concat([[t, eb, min]])); if (rest) return rest;
    return '';
  };
  // turnover after a treatment: its own, but never less than the minimum handover (Settings → Booking rules)
  E.buf = (cfg, tr) => Math.max((tr && tr.buffer) || 0, cfg.rules.minHandover || 0);
  // therapist order: priority 1 first (Staff → Edit), then the rest
  E.byPriority = (a, b) => (a.priority || 99) - (b.priority || 99);
  E.roomFree = (cfg, ix, date, tr, t, end, need, tag) => {
    const trs = [].concat(tr), rooms = cfg.treatRooms.filter(r => r.active !== false && trs.every(tr => (!tr.roomIds || !tr.roomIds.length || tr.roomIds.includes(r.id)) && (!tr.rooms || !tr.rooms.length || tr.rooms.every(tag => (r.tags || []).includes(tag)))) && !E.closedBetween(cfg, date, ['troom:' + r.id], t, end));
    for (const r of rooms) if (E.roomOK(r, (ix.troom[date] || {})[r.id] || [], t, end, need, tag)) return r;
    return null;
  };
  // a treatment room is used by one guest at a time, unless guests from the same booking asked to be treated together
  // (user 2026-11-27): then up to one guest per bed, each with their own therapist. Entries are [start, end, pairTag].
  E.canShare = (cfg, tids) => (cfg.treatRooms || []).some(r => r.active !== false && (r.beds || 1) >= tids.length && tids.every(id => { const tr = E.tr(cfg, id) || {}; return (!tr.roomIds || !tr.roomIds.length || tr.roomIds.includes(r.id)) && (!tr.rooms || !tr.rooms.length || tr.rooms.every(tag => (r.tags || []).includes(tag))); }));
  E.roomOK = (r, list, t, end, need, tag) => { const on = list.filter(x => x[0] < end && t < x[1]);
    if (!on.length) return (r.beds || 1) >= (need || 1);
    if (!tag || !on.every(x => x[2] === tag)) return false;
    return (r.beds || 1) - E.bedsInUse(on, t, end) >= (need || 1); };

  /* Schedule treatments on one date inside a window.
     items: [{ key, guest, tid, min?, together? (same value = side by side), start? (fixed), staff? (wanted) }]
     Returns { ok, items:[{ key, guest, tid, min, buffer, start:'HH:MM', staff, troom }], fail:{ key, why } } */
  E.schedule = (cfg, ix0, date, win, items, opt = {}) => {
    const ix = { ...ix0, staff: { ...ix0.staff, [date]: JSON.parse(JSON.stringify(ix0.staff[date] || {})) }, troom: { ...ix0.troom, [date]: JSON.parse(JSON.stringify(ix0.troom[date] || {})) } }, step = cfg.rules.slotStep || 15, out = [];
    const guestBusy = {}, taken = (opt.taken || []).filter(x => (x.date || date) === date);
    for (const x of taken) (guestBusy[x.guest] = guestBusy[x.guest] || []).push([T(x.start), T(x.start) + x.min]);
    const w0 = T(win[0]), w1 = T(win[1]);
    const book = (it, st, room, t, tag) => {
      const tr = E.tr(cfg, it.tid), min = it.min || tr.min, buf = E.buf(cfg, tr);
      ((ix.staff[date] = ix.staff[date] || {})[st.id] = ix.staff[date][st.id] || []).push([t, t + min + buf, min]);
      ((ix.troom[date] = ix.troom[date] || {})[room.id] = ix.troom[date][room.id] || []).push(tag ? [t, t + min + buf, tag] : [t, t + min + buf]);
      (guestBusy[it.guest] = guestBusy[it.guest] || []).push([t, t + min]);
      out.push({ key: it.key, guest: it.guest, tid: it.tid, ...(it.with && it.with.length ? { with: it.with.slice() } : {}), min, buffer: buf, start: HM(t), staff: st.id, troom: room.id, date, ...(tag ? { pair: tag } : {}) });
    };
    const guestFree = (g, t, e) => !(guestBusy[g] || []).some(x => overlap(t - 5, e + 5, x[0], x[1]));
    const load = st => handsOn((ix.staff[date] || {})[st.id] || []);
    // finish early: prefer the therapist whose last treatment would end soonest (and whose shift ends soonest),
    // so treatments pack together early in the day instead of keeping everyone in late
    const finishAfter = (st, end) => { const l = (ix.staff[date] || {})[st.id] || [], d = E.staffDay(cfg, st, date); return Math.max(end, ...l.map(x => x[1])) * 2 + (d ? d.end / 1440 : 0); };
    // groups: side-by-side items first, then longest first, then by guest
    const groups = []; const seen = {};
    for (const it of items) { if (it.together != null) { if (!seen[it.together]) groups.push(seen[it.together] = []); seen[it.together].push(it); } else groups.push([it]); }
    groups.sort((a, b) => (b.length - a.length) || ((E.tr(cfg, b[0].tid) || {}).min - (E.tr(cfg, a[0].tid) || {}).min));
    for (const g of groups) {
      const tr = E.tr(cfg, g[0].tid); if (!tr) return { ok: false, fail: { key: g[0].key, why: 'Unknown treatment' }, items: out };
      const min = g[0].min || tr.min, buf = E.buf(cfg, tr);
      const starts = g[0].start ? [T(g[0].start)] : [];
      // treatments start between the day's first and last start times (Settings → Treatment times)
      const tt = E.treatTimes(cfg, date), first = Math.max(w0, T(tt.first)), last = T(tt.last);
      if (!starts.length) { for (let t = Math.ceil(first / step) * step; t + min <= w1 && t <= last; t += step) starts.push(t); starts.splice(0, starts.length, ...E.startsWith(starts, ix, date, first, last, min, w1)); }
      if (opt.prefer === 'late') starts.reverse();
      // group setting: try the start times already used by this booking first, so guests are treated side by side
      if (opt.align && (out.length || taken.length) && !g[0].start) { const used = [...new Set(out.concat(taken).map(o => T(o.start)))].filter(t => t >= w0 && t + min <= w1).sort((a, b) => a - b); starts.unshift(...used.filter(t => starts.includes(t))); }
      let done = false, why = 'No therapist free in that time';
      if ((cfg.rules.share || 'fill') === 'fill' && g.length === 1) {
        const it = g[0], inUse = st => ((ix.staff[date] || {})[st.id] || []).some(x => x[3] !== 'duty');
        const order = cfg.staff.filter(st => E.canDoAll(st, it) && (!it.staff || it.staff === st.id)).sort((a, b) => (inUse(b) - inUse(a)) || E.byPriority(a, b));
        // earliest time first (busiest therapist only breaks ties), so guests aren't pushed late in the session
        // (user 2026-11-27); side by side with another guest only if that costs at most 30 minutes
        const fit = t => { if (!guestFree(it.guest, t, t + min)) return null; for (const st of order) { if (E.staffFree(cfg, ix, st, date, t, it.min || tr.min, buf)) continue; const room = E.roomFree(cfg, ix, date, tr, t, t + min + buf, 1); if (room) return { st, room }; why = 'No treatment room free'; } return null; };
        const ordered = [...new Set(starts)].sort((x, y) => opt.prefer === 'late' ? y - x : x - y);
        let best = null; for (const t of ordered) { const f = fit(t); if (f) { best = { t, ...f }; break; } }
        if (best && opt.align && (out.length || taken.length) && !it.start) { const used = [...new Set(out.concat(taken).map(o => T(o.start)))].filter(t => t !== best.t && Math.abs(t - best.t) <= 30).sort((x, y) => x - y); for (const t of used) { const f = fit(t); if (f) { best = { t, ...f }; break; } } }
        if (best) { book(it, best.st, best.room, best.t); done = true; }
        if (!done) return { ok: false, fail: { key: g[0].key, why, name: tr.name }, items: out };
        continue;
      }
      for (const t of starts) {
        if (!g.every(it => guestFree(it.guest, t, t + min))) continue;
        const gmin = Math.max(...g.map(it => it.min || (E.tr(cfg, it.tid) || {}).min || min)), tag = 'P' + Math.random().toString(36).slice(2, 10);
        if (!g.every(it => guestFree(it.guest, t, t + (it.min || (E.tr(cfg, it.tid) || {}).min || min)))) continue;
        const room = E.roomFree(cfg, ix, date, g.map(it => E.tr(cfg, it.tid)).filter(Boolean), t, t + gmin + buf, g.length, tag);
        if (!room) { why = 'No room for you to be treated together then'; continue; }
        const used = [], picks = [];
        for (const it of g) {
          const cands = cfg.staff.filter(st => !used.includes(st.id) && E.canDoAll(st, it) && (!it.staff || it.staff === st.id))
            .filter(st => !E.staffFree(cfg, ix, st, date, t, it.min || tr.min, buf)).sort((a, b) => (cfg.rules.share || 'fill') === 'fill'
              ? E.byPriority(a, b) || load(b) - load(a)      // fill by priority: therapist 1 first
              : load(a) - load(b) || finishAfter(a, t + min + buf) - finishAfter(b, t + min + buf));   // share the work evenly
          if (!cands.length) break;
          used.push(cands[0].id); picks.push(cands[0]);
        }
        if (picks.length < g.length) continue;
        g.forEach((it, i) => book(it, picks[i], room, t, tag)); done = true; break;
      }
      if (!done) return { ok: false, fail: { key: g[0].key, why, name: tr.name }, items: out };
    }
    return { ok: true, items: out };
  };
  // should this booking try to have guests treated at the same time (Settings → Rules)?
  E.alignFor = (cfg, b) => { const r = cfg.rules, p = cfg.products[b.product] || {}; const on = p.together != null ? p.together : r.groupTogether; return !!on && (b.guests || 1) >= (r.groupTogetherFrom || 2); };
  // first and last treatment start times for a date: { first:'10:00', last:'21:00' }
  E.treatTimes = (cfg, date) => { const t = cfg.treatTimes || {}; return { first: '00:00', last: '23:59', ...(t.default || {}), ...(t[dow(date)] || {}), ...((t.dates || {})[date] || {}) }; };
  // the time window treatments must fit in for a booking
  E.treatWindow = (cfg, b) => {
    const p = cfg.products[b.product];
    if (p.kind === 'session' || p.kind === 'private') { const s = E.session(cfg, b.sessionId); return s ? [s.start, s.end] : null; }
    if (p.kind === 'stay' || p.kind === 'house') { const t = E.stayTimes(cfg, b.product, b.date, b.nights); return t && t.spa ? t.spa : null; }
    if (p.kind === 'treat') { const h = E.hours(cfg, b.date); const part = b.part && p.parts && p.parts[b.part]; return part || (h ? [h.start, h.end] : null); }
    return null;
  };
  /* When a booking's treatments may happen: [[date, start, end], ...]
     spa sessions: during the session · treatments only: from the chosen start (or the chosen part of the day)
     stays & whole house: any time from check-in to check-out, on any day of the stay, within spa hours */
  // Treatment hours (user, 2026-11-26): which days treatments happen and between which times, for every booking type.
  // cfg.treatHours = { 0..6 (Sunday = 0): { on, from, to } }; not set = treatments whenever the spa is open
  E.treatHours = (cfg, date) => { const h = cfg.treatHours && cfg.treatHours[dow(date)]; return h ? h : null; };
  // a booking type's own days and times (Settings → Treatment hours → Treatments only): products[k].dayHours = { 0..6: { on, from, to } }
  E.productHours = (cfg, product, date) => { const p = cfg.products[product]; const h = p && p.dayHours && p.dayHours[dow(date)]; return h || null; };
  // the most beds of a room in use at any one moment between s and e (2026-11-26: counting every booking that touches
  // the time over-counted, e.g. one before and one after a long treatment never share the room with each other)
  E.bedsInUse = (list, s, e) => { const on = list.filter(x => x[0] < e && s < x[1]); if (!on.length) return 0;
    return Math.max(...[s, ...on.map(x => x[0]).filter(p => p > s && p < e)].map(p => on.filter(x => x[0] <= p && p < x[1]).length)); };
  E.windows = (cfg, b) => {
    const clip = (w, h) => { if (!w || !h) return w; if (h.on === false) return null;
      const s = Math.max(T(w[1]), T(h.from || '00:00')), e = Math.min(T(w[2]), T(h.to || '23:59')); return e - s >= 20 ? [w[0], HM(s), HM(e)] : null; };
    return E._windows(cfg, b).map(w => clip(clip(w, E.treatHours(cfg, w[0])), E.productHours(cfg, b.product, w[0]))).filter(Boolean);
  };
  E._windows = (cfg, b) => {
    const p = cfg.products[b.product]; if (!p || !b.date) return [];
    if (p.kind === 'session' || p.kind === 'private') { const s = E.session(cfg, b.sessionId); return s ? [[b.date, s.start, s.end]] : []; }
    if (p.kind === 'treat') {
      const h = E.hours(cfg, b.date); if (!h) return [];
      if (b.treatStart) return [[b.date, b.treatStart, h.end]];
      const part = b.part && p.parts && p.parts[b.part]; return [[b.date, part ? part[0] : h.start, part ? part[1] : h.end]];
    }
    if (p.kind === 'stay' || p.kind === 'house') {
      const t = E.stayTimes(cfg, b.product, b.date, b.nights), out = [];
      for (let i = 0; i <= (b.nights || 1); i++) {
        const d = addD(b.date, i), h = E.hours(cfg, d); if (!h) continue;
        const s0 = i === 0 ? Math.max(T(t.checkIn), T(h.start)) : T(h.start);
        const e0 = i === b.nights ? Math.min(T(t.checkOut), T(h.end)) : T(h.end);
        if (e0 - s0 >= 20) out.push([d, HM(s0), HM(e0)]);
      }
      return out;
    }
    return [];
  };
  // plan every treatment for a booking: the whole booking in its first window if it fits, else spread over the stay
  E.plan = (cfg, ix0, b, opt = {}) => {
    const needs = opt.needs || E.treatmentNeeds(cfg, b), wins = E.windows(cfg, b);
    if (!needs.length) return { ok: true, items: [] };
    if (!wins.length) return { ok: false, items: [], fail: { why: 'No time for treatments on that date' } };
    const align = opt.align != null ? opt.align : (b.together != null ? b.together : E.alignFor(cfg, b));
    // staff the food service first, so whoever serves it isn't given treatments then
    const ix = { ...ix0, staff: { ...ix0.staff }, duty: { ...(ix0.duty || {}) } };
    for (const sv of E.servicesFor(cfg, b)) { ix.staff[sv.date] = JSON.parse(JSON.stringify(ix0.staff[sv.date] || {})); ix.duty[sv.date] = { ...((ix0.duty || {})[sv.date] || {}) }; E.ensureDuty(cfg, ix, sv.date, sv.id); }
    const first = needs.some(n => n.date && n.date !== wins[0][0]) ? { ok: false, items: [], fail: {} } : E.schedule(cfg, ix, wins[0][0], [wins[0][1], wins[0][2]], needs, { align });
    if (first.ok || wins.length === 1) return first;
    const out = []; let cur = ix;
    const groups = [], seen = {};
    for (const it of needs) { if (it.together != null) { if (!seen[it.together]) groups.push(seen[it.together] = []); seen[it.together].push(it); } else groups.push([it]); }
    for (const g of groups) {
      let placed = null, why = '';
      for (const w of wins) { if (g[0].date && g[0].date !== w[0]) continue; const r = E.schedule(cfg, cur, w[0], [w[1], w[2]], g, { align, taken: out }); if (r.ok) { placed = r.items; break; } why = r.fail.why; }
      if (!placed) return { ok: false, items: out, fail: { key: g[0].key, why: why || 'No therapist free during the stay', name: (E.tr(cfg, g[0].tid) || {}).name } };
      out.push(...placed); cur = E.withItems(cur, placed);
    }
    return { ok: true, items: out };
  };
  E.withItems = (ix, items) => {
    const nx = { ...ix, staff: { ...ix.staff }, troom: { ...ix.troom } };
    for (const it of items) {
      const d = it.date, s = T(it.start), eb = s + it.min + (it.buffer || 0);
      nx.staff[d] = { ...(nx.staff[d] || {}) }; nx.staff[d][it.staff] = [...(nx.staff[d][it.staff] || []), [s, eb, it.min]];
      nx.troom[d] = { ...(nx.troom[d] || {}) }; nx.troom[d][it.troom] = [...(nx.troom[d][it.troom] || []), it.pair ? [s, eb, it.pair] : [s, eb]];
    }
    return nx;
  };
  /* The times one treatment could start, for the guest to pick: [{ date, times:[{ start, staff }] }]
     others = treatments already picked in this booking (they hold their therapist, room and the guest's time) */
  // like slotsFor, but a time is only offered if every other treatment in the booking can still be fitted around it
  // (2026-11-26: guests picked times one by one and the last guests could end up with no time at all)
  E.slotsAhead = (cfg, ix0, b, need, others = []) => {
    const sl = E.slotsFor(cfg, ix0, b, need, others);
    const rest = E.treatmentNeeds(cfg, b).filter(n => n.key !== need.key && !(b.times || {})[n.key]);
    if (!rest.length) return sl;
    return sl.map(d => ({ ...d, times: d.times.filter(x => { const b2 = { ...b, times: { ...(b.times || {}), [need.key]: { date: d.date, start: x.start } } }; return E.plan(cfg, ix0, b2, { needs: E.treatmentNeeds(cfg, b2) }).ok; }) }));
  };
  E.slotsFor = (cfg, ix0, b, need, others = []) => {
    const tr = E.tr(cfg, need.tid); if (!tr) return [];
    const min = need.min || tr.min, buf = E.buf(cfg, tr), step = cfg.rules.slotStep || 15, out = [];
    let ix = E.withItems(ix0, others.filter(o => o.staff && o.troom));
    ix = { ...ix, duty: { ...(ix.duty || {}) } };
    for (const sv of E.servicesFor(cfg, b)) { ix.staff[sv.date] = JSON.parse(JSON.stringify(ix.staff[sv.date] || {})); ix.duty[sv.date] = { ...(ix.duty[sv.date] || {}) }; E.ensureDuty(cfg, ix, sv.date, sv.id); }
    for (const w of E.windows(cfg, b)) {
      const tt = E.treatTimes(cfg, w[0]), times = [], lo = Math.max(T(w[1]), T(tt.first)), grid = [];
      for (let t = Math.ceil(lo / step) * step; t + min <= T(w[2]) && t <= T(tt.last); t += step) grid.push(t);
      for (const t of E.startsWith(grid, ix, w[0], lo, T(tt.last), min, T(w[2]))) {
        if (others.some(o => (o.date || b.date) === w[0] && o.guest === need.guest && overlap(t - 5, t + min + 5, T(o.start), T(o.start) + o.min))) continue;
        const st = cfg.staff.filter(x => E.canDoAll(x, need)).sort(E.byPriority).find(x => !E.staffFree(cfg, ix, x, w[0], t, min, buf));
        if (!st) continue;
        if (!E.roomFree(cfg, ix, w[0], tr, t, t + min + buf, 1)) continue;
        times.push({ start: HM(t), staff: st.id });
      }
      out.push({ date: w[0], times });
    }
    return out;
  };
  // can everyone's included treatments fit? (a session or stay that can't fit them isn't bookable)
  E.includedFit = (cfg, ix, q) => {
    const inc = E.includedFor(cfg, q.product); if (!inc.length) return '';
    const g = Math.max(1, q.guests || 1), b = { product: q.product, date: q.date, nights: q.nights || 0, sessionId: q.sessionId, guests: g, guestList: Array.from({ length: g }, () => ({ included: inc[0].id, food: (((cfg.products[q.product] || {}).foods) || [])[0] || ((cfg.foods || []).find(f => (f.products || []).includes(q.product)) || {}).id || (cfg.products[q.product] || {}).food ? 'food' : null, extras: [] })) };
    const r = E.plan(cfg, ix, b); return r.ok ? '' : 'Not enough therapist time for everyone’s included treatment';
  };
  // how much extra treatment time is left once everyone's included treatment (and lunch) is planned: the longest of
  // 60/45/30 minutes one guest could still add. 0 = included treatments only (user 2026-11-27: show this on the calendar)
  E.treatRoom = (cfg, ix, q) => {
    const inc = E.includedFor(cfg, q.product), g = Math.max(1, q.guests || 1), p = cfg.products[q.product] || {};
    const food = (p.foods || [])[0] || ((cfg.foods || []).find(f => (f.products || []).includes(q.product)) || {}).id || (p.food ? 'food' : null);
    const b = { product: q.product, date: q.date, nights: q.nights || 0, sessionId: q.sessionId, guests: g, guestList: Array.from({ length: g }, () => ({ included: inc.length ? inc[0].id : null, food, extras: [] })) };
    const base = E.treatmentNeeds(cfg, b); if (!E.plan(cfg, ix, b, { needs: base }).ok) return -1;
    const probe = (cfg.treatments || []).filter(t => t.sell !== false && !/^inc/.test(t.id)).sort((x, y) => y.min - x.min)[0]; if (!probe) return 0;
    for (const m of [60, 45, 30]) if (E.plan(cfg, ix, b, { needs: base.concat({ key: 'probe', guest: 0, tid: probe.id, min: m }) }).ok) return m;
    return 0;
  };
  E.roomLevel = m => m < 0 ? 'full' : m >= 60 ? 'plenty' : m > 0 ? 'some' : 'none';
  // free start times for a treatments-only booking (the guest picks one)
  E.treatSlots = (cfg, ix, b) => {
    const h = E.hours(cfg, b.date); if (!h) return [];
    const tt = E.treatTimes(cfg, b.date), step = cfg.rules.slotStep || 15, out = [];
    const ph = E.productHours(cfg, b.product, b.date); if (ph && ph.on === false) return [];
    for (let t = Math.max(T(h.start), T(tt.first), ph ? T(ph.from || '00:00') : 0); t <= Math.min(T(tt.last), T(h.end) - 20, ph ? T(ph.to || '23:59') - 20 : 1440); t += step) {
      const r = E.plan(cfg, ix, { ...b, treatStart: HM(t) });
      if (r.ok && r.items.some(i => T(i.start) === t)) out.push({ time: HM(t), end: HM(Math.max(...r.items.map(i => T(i.start) + i.min))), items: r.items });
    }
    return out;
  };
  // can one treatment move to { date, start, staff, troom }? '' = yes. ix must not include this booking.
  E.itemCheck = (cfg, ix, b, item, to) => {
    const d = to.date || item.date || b.date, s = T(to.start), st = cfg.staff.find(x => x.id === (to.staff || item.staff)), tr = E.tr(cfg, item.tid);
    if (!st) return 'Choose a therapist';
    if (!E.canDoAll(st, item)) return `${st.name} isn’t set up for ${tr ? tr.name : 'this treatment'}`;
    const w = E.windows(cfg, b).find(x => x[0] === d);
    if (!w || s < T(w[1]) || s + item.min > T(w[2])) return w ? `Outside the guest’s visit (${w[1]}–${w[2]})` : 'The guest isn’t here that day';
    const tt = E.treatTimes(cfg, d); if (s < T(tt.first) || s > T(tt.last)) return `Treatments start between ${tt.first} and ${tt.last}`;
    const others = (b.items || []).filter(x => x.key !== item.key && x.staff && x.troom);
    let nx = E.withItems(ix, others);
    nx = { ...nx, duty: { ...(nx.duty || {}) } };
    for (const sv of E.servicesFor(cfg, b)) { nx.staff[sv.date] = JSON.parse(JSON.stringify(nx.staff[sv.date] || {})); nx.duty[sv.date] = { ...(nx.duty[sv.date] || {}) }; E.ensureDuty(cfg, nx, sv.date, sv.id); }
    const why = E.staffFree(cfg, nx, st, d, s, item.min, item.buffer); if (why) return `${st.name}: ${why}`;
    if (others.some(o => (o.date || b.date) === d && o.guest === item.guest && overlap(s - 5, s + item.min + 5, T(o.start), T(o.start) + o.min))) return 'Clashes with this guest’s other treatment';
    const end = s + item.min + (item.buffer || 0);
    const room = to.troom ? cfg.treatRooms.find(r => r.id === to.troom) : E.roomFree(cfg, nx, d, tr, s, end, 1);
    if (!room) return 'No treatment room free';
    if (!E.roomOK(room, ((nx.troom[d] || {})[room.id] || []).filter(x => true), s, end, 1, item.pair)) return `${room.name} is in use`;
    return '';
  };
  // treatments that come with a booking type (each treatment lists the types it's included with)
  E.includedFor = (cfg, product) => {
    const list = cfg.treatments.filter(t => t.active !== false && (t.includedWith || []).includes(product));
    if (list.length) return list;
    const p = cfg.products[product] || {}; return (p.included || []).map(id => E.tr(cfg, id)).filter(Boolean);   // older saved settings
  };
  // 'one' = each guest chooses one of them; 'all' = every guest has all of them
  E.includedPick = (cfg, product) => ((cfg.products[product] || {}).includedPick === 'all' ? 'all' : 'one');
  // is this treatment sold on its own (as an extra, or treatments only)?
  E.sellable = t => t && t.active !== false && t.sell !== false && !t.included;
  // older settings had an 'Included' category: move to includedWith on each treatment
  E.migrate = cfg => {
    let n = 0;
    for (const [k, p] of Object.entries(cfg.products || {})) {
      for (const id of [...(p.included || []), ...(p.includedAll || [])]) { const t = E.tr(cfg, id); if (t) { t.includedWith = [...new Set([...(t.includedWith || []), k])]; n++; } }
      if ((p.includedAll || []).length && !(p.included || []).length) p.includedPick = 'all';
      if (!p.includedPick) p.includedPick = 'one';
      delete p.included; delete p.includedAll;
    }
    // policies now live on each booking type
    for (const p of Object.values(cfg.products || {})) if (p.policy == null && cfg.policies) { p.policy = cfg.policies[p.kind === 'house' ? 'house' : p.kind === 'stay' ? 'stay' : 'spa'] || ''; n++; }
    for (const t of cfg.treatments || []) if (t.included || t.cat === 'Included') { t.sell = false; delete t.included; if (t.cat === 'Included') t.cat = /facial/i.test(t.name) ? 'Facials' : 'Massage'; n++; }
    return n;
  };
  // the list of treatments a booking needs scheduled (included + extras)
  E.treatmentNeeds = (cfg, b) => {
    const out = E._needs(cfg, b), tm = b.times || {};
    // treated together (user 2026-11-27): only guests in this booking, only when they ask; same time, same room
    for (const [k, w] of Object.entries(b.pairs || {})) { const a = out.find(n => n.key === k), o = out.find(n => n.key === w); if (!a || !o || a.guest === o.guest) continue; o.together = a.together = o.together || 'T:' + w; }
    for (const n of out) { const src = n.together && Object.keys(b.pairs || {}).includes(n.key) ? b.pairs[n.key] : n.key; if (tm[src]) { n.start = tm[src].start; n.date = tm[src].date; } }
    return out;
  };
  E._needs = (cfg, b) => {
    const p = cfg.products[b.product], out = [];
    (b.guestList || []).forEach((g, i) => {
      const inc = E.includedFor(cfg, b.product), bl = tr => b.blueLight && cfg.rules.blueLight ? Math.max(tr.min, cfg.rules.blueLightMin) : tr.min;
      if (inc.length && E.includedPick(cfg, b.product) === 'all') inc.forEach((tr, j) => out.push({ key: `g${i}-inc${j || ''}`, guest: i, tid: tr.id, min: bl(tr), included: true }));
      else if (inc.length) { const tr = inc.find(t => t.id === g.included) || inc[0]; out.push({ key: `g${i}-inc`, guest: i, tid: tr.id, min: bl(tr), included: true }); }
      // an extra treatment of the same kind as the included one (a massage with the included massage) extends it into one
      // longer treatment, times added together (user, 2026-11-27); other extras stay separate
      const incNeed = out.find(n => n.guest === i && n.included && !String(n.key).slice(-1).match(/\d/)) || out.find(n => n.guest === i && n.included);
      const incCat = incNeed && (E.tr(cfg, incNeed.tid) || {}).cat;
      (g.extras || []).forEach((tid, j) => {
        const tr = E.tr(cfg, tid) || {};
        if (incNeed && cfg.rules.combineIncluded !== false && incCat && tr.cat === incCat) { const add = (incNeed.with || []).length ? 0 : E.extendBy(cfg, incNeed.min, tr); if (add > 0) { incNeed.with = (incNeed.with || []).concat(tid); incNeed.min += add; } return; }
        out.push({ key: `g${i}-x${j}`, guest: i, tid });
      });
    });
    return out;
  };
  // how many minutes a same-kind extra adds to an included treatment that is already `have` minutes long: the whole
  // treatment is capped at rules.combineMax (55 min, user 2026-11-27), and the extra is charged only for what it adds
  E.combineMax = cfg => +((cfg.rules || {}).combineMax) || 55;
  E.extendPrice = cfg => { const v = (cfg.rules || {}).extendPrice; return v === 0 || v ? +v : 55; };
  E.extendBy = (cfg, have, tr) => Math.max(0, Math.min((tr && tr.min) || 0, E.combineMax(cfg) - have));
  // what each guest's extras cost, with the same-kind ones prorated to the minutes they add: [{ guest, tid, price, full, mins }]
  E.extraCharges = (cfg, b) => {
    const out = [], inc = E.includedFor(cfg, b.product), comb = cfg.rules.combineIncluded !== false, bl = tr => b.blueLight && cfg.rules.blueLight ? Math.max(tr.min, cfg.rules.blueLightMin) : tr.min;
    (b.guestList || []).forEach((g, i) => {
      const incTr = inc.length ? (inc.find(t => t.id === g.included) || inc[0]) : null; let have = incTr ? bl(incTr) : 0;
      (g.extras || []).forEach(tid => { const t = E.tr(cfg, tid); if (!t) return;
        if (comb && incTr && E.includedPick(cfg, b.product) !== 'all' && t.cat === incTr.cat) { const add = out.some(x => x.guest === i && x.extends) ? 0 : E.extendBy(cfg, have, t); have += add; out.push({ guest: i, tid, mins: add, full: t.price, price: add >= t.min ? t.price : E.extendPrice(cfg), extends: true }); }
        else out.push({ guest: i, tid, mins: t.min, full: t.price, price: t.price });
      });
    });
    return out;
  };
  // the name of a treatment as booked: "20-minute aromatherapy massage + Back to Basics Massage" when one extends the other
  E.itemName = (cfg, it) => [it.tid, ...((it && it.with) || [])].map(t => (E.tr(cfg, t) || {}).name || t).join(' + ');
  E.canDoAll = (st, it) => E.canDo(st, it.tid) && ((it && it.with) || []).every(t => E.canDo(st, t));

  // ---------- prices ----------
  E.unitPrice = (cfg, product, date, nights) => {
    const p = cfg.products[product], r = E.rate(cfg, product, date);
    if (p.kind === 'house') return r && r.night != null ? r.night : p.night;
    if (p.priceN) return r && r.priceN && r.priceN[nights] != null ? r.priceN[nights] : p.priceN[nights];
    return r && r.price != null ? r.price : p.price;
  };
  E.quote = (cfg, b, today) => {
    const p = cfg.products[b.product]; if (!p) return null;
    const lines = [], g = b.guests || 1, n = b.nights || 0;
    if (p.kind === 'house') {
      let sum = 0; for (let i = 0; i < n; i++) sum += E.unitPrice(cfg, 'house', addD(b.date, i));
      lines.push({ k: 'base', label: `${p.name} · ${n} night${n === 1 ? '' : 's'}`, amount: sum });
    } else if (p.kind === 'stay') { const u = E.unitPrice(cfg, b.product, b.date, n); lines.push({ k: 'base', label: `${p.name} · ${n} night${n === 1 ? '' : 's'} · ${g} × £${u}`, amount: u * g }); }
    else if (p.kind !== 'treat') { const u = E.unitPrice(cfg, b.product, b.date); lines.push({ k: 'base', label: `${p.name} · ${g} × £${u}`, amount: u * g }); }
    if (b.breakfast && p.breakfast) lines.push({ k: 'bfast', label: `Breakfast · ${g} × ${n} morning${n === 1 ? '' : 's'}`, amount: cfg.breakfastPrice * g * n });
    let tsum = 0, off = 0;
    E.extraCharges(cfg, b).forEach(c => { const t = E.tr(cfg, c.tid); tsum += c.price; if (t.head && p.kind !== 'treat') off += c.price * cfg.rules.headSpaOff / 100; });
    (b.addOns || []).forEach(a => lines.push({ k: 'addon', label: a.label, amount: +a.amount || 0 }));
    if (tsum) lines.push({ k: 'treat', label: 'Treatments', amount: tsum });
    if (off) lines.push({ k: 'headoff', label: `Head spa ${cfg.rules.headSpaOff}% off`, amount: -Math.round(off * 100) / 100 });
    let total = lines.reduce((a, l) => a + l.amount, 0);
    if (b.promo && +b.promo.value) {
      const base = lines.filter(l => b.promo.on === 'all' || l.k === 'base' || (b.promo.on === 'treat' && l.k === 'treat')).reduce((a, l) => a + l.amount, 0);
      const d = Math.min(base, b.promo.type === 'pct' ? Math.round(base * b.promo.value) / 100 : +b.promo.value);
      if (d > 0) { lines.push({ k: 'promo', label: `Code ${b.promo.code}` + (b.promo.type === 'pct' ? ` (${b.promo.value}% off)` : ''), amount: -d }); total -= d; }
    }
    if (b.discount && +b.discount.value) {
      const d = b.discount.type === 'pct' ? Math.round(total * b.discount.value) / 100 : +b.discount.value;
      lines.push({ k: 'discount', label: 'Discount' + (b.discount.reason ? ' · ' + b.discount.reason : '') + (b.discount.type === 'pct' ? ` (${b.discount.value}%)` : ''), amount: -d });
      total -= d;
    }
    if (b.totalOverride != null && b.totalOverride !== '') { lines.push({ k: 'override', label: 'Price set by staff', amount: +b.totalOverride - total }); total = +b.totalOverride; }
    total = Math.max(0, Math.round(total * 100) / 100);
    const pay = p.pay || { deposit: 100 }, t0 = today || localISO();
    let deposit = total, balanceDue = null;
    if (pay.deposit < 100 && (!pay.balanceDays || between(t0, b.date) > pay.balanceDays)) { deposit = Math.round(total * pay.deposit) / 100; balanceDue = addD(b.date, -(pay.balanceDays || 0)); }
    return { lines, total, deposit, balance: Math.round((total - deposit) * 100) / 100, balanceDue, damage: pay.damage || 0 };
  };
  E.paid = b => Math.round((b.payments || []).reduce((a, x) => a + (+x.amount || 0), 0) * 100) / 100;

  // ---------- discount codes ----------
  // promo: { code, label, type:'pct'|'amt', value, on:'base'|'all'|'treat', from, to (when the code can be used),
  //          visitFrom, visitTo (dates of the visit), days:[weekdays of the visit], products:[], minSpend, maxUses, used, active }
  E.promoCheck = (cfg, pr, b, today) => {
    const t = today || localISO();
    if (!pr || pr.active === false) return 'That code isn’t valid';
    if (pr.from && t < pr.from) return 'That code starts on ' + pr.from;
    if (pr.to && t > pr.to) return 'That code has ended';
    if (pr.maxUses && (pr.used || 0) >= pr.maxUses) return 'That code has been fully used';
    if (b) {
      if (pr.products && pr.products.length && !pr.products.includes(b.product)) return 'That code isn’t for ' + ((cfg.products[b.product] || {}).name || 'this booking');
      if (b.date && pr.visitFrom && b.date < pr.visitFrom) return 'That code is for visits from ' + pr.visitFrom;
      if (b.date && pr.visitTo && b.date > pr.visitTo) return 'That code is for visits until ' + pr.visitTo;
      if (b.date && pr.days && pr.days.length && !pr.days.includes(dow(b.date))) return 'That code isn’t valid on that day';
      if (pr.minSpend) { const q = E.quote(cfg, { ...b, promo: null, discount: null, totalOverride: null }, t); if (q && q.total < pr.minSpend) return `That code needs a spend of £${pr.minSpend}`; }
    }
    return '';
  };
  // offers to show on the website right now (banner dates)
  E.promoBanners = (cfg, today) => { const t = today || localISO(); return (cfg.promos || []).filter(p => p.active !== false && p.banner && p.banner.on && (!p.banner.from || p.banner.from <= t) && (!p.banner.to || t <= p.banner.to) && !E.promoCheck(cfg, p, null, t)); };

  // ---------- cancelling ----------
  E.cancelTerms = (cfg, b, today) => {
    const p = cfg.products[b.product], q = b.quote || E.quote(cfg, b), days = between(today || localISO(), b.date);
    const rules = (p.cancel && p.cancel.rules) || [{ minDays: 0, keepPct: 100 }];
    const rule = rules.find(r => days >= r.minDays) || rules[rules.length - 1];
    const paid = E.paid(b);
    let keep = rule.keepDeposit ? Math.min(paid, q.deposit < q.total ? q.deposit : q.total / 2) : q.total * (rule.keepPct || 0) / 100;
    keep = Math.min(paid, Math.round(keep * 100) / 100);
    const canMove = p.cancel && p.cancel.moveDays != null && days >= p.cancel.moveDays;
    const when = days < 0 ? 'The visit has passed' : days === 0 ? 'Cancelling on the day' : `Cancelling ${days} day${days === 1 ? '' : 's'} before`;
    const text = days < 0 ? when : rule.keepDeposit ? `${when}: the deposit is kept` : rule.keepPct === 0 ? `${when}: full refund` : rule.keepPct === 100 ? `${when}: no refund under the terms` : `${when}: ${rule.keepPct}% kept`;
    return { days, keep, refund: Math.max(0, Math.round((paid - keep) * 100) / 100), canMove, text: text + (canMove ? ' · the guest may move their date instead' : '') };
  };

  if (typeof module !== 'undefined') module.exports = E; else root.YCEngine = E;
})(this);
