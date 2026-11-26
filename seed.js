/* Sample data for the demo: made-up therapists and bookings (no real people).
   Bookings are placed through the engine, so every sample day follows the real rules. */
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.YCEngine;
  const D0 = typeof module !== 'undefined' ? require('./defaults.js') : root.YC_DEFAULTS;
  const shift = (start, end, lunch, min = 30) => ({ start, end, breaks: lunch ? [{ start: lunch, min }] : [] });
  const ALL = ['inc-massage', 'inc-facial', 'inc-lux-facial', 'basics', 'radiance', 'tension', 'scalp', 'recipe', 'full'];
  const HEAD = ['classic', 'ritual', 'zen'];
  const STAFF = [
    { id: 's1', name: 'Amelia Hart', role: 'Lead therapist', colour: '#b4785a', email: '', phone: '', treatments: [...ALL, ...HEAD], maxHands: 330,
      pattern: { 1: shift('09:00', '17:30', '12:45'), 2: shift('09:00', '17:30', '12:45'), 3: shift('09:00', '17:30', '12:45'), 4: shift('09:00', '17:30', '12:45'), 5: shift('09:00', '17:30', '12:45') }, holidayDays: 28 },
    { id: 's2', name: 'Grace Okafor', role: 'Spa therapist', colour: '#5d7a63', email: '', phone: '', treatments: ALL, maxHands: 360,
      pattern: { 0: shift('13:00', '22:30', '17:00'), 3: shift('13:00', '22:00', '17:15'), 4: shift('13:00', '22:00', '17:15'), 5: shift('09:00', '17:30', '12:30'), 6: shift('09:00', '17:30', '12:30') }, holidayDays: 28 },
    { id: 's3', name: 'Sophie Lane', role: 'Head spa specialist', colour: '#7c6a9a', email: '', phone: '', treatments: ['inc-facial', 'inc-lux-facial', 'basics', 'radiance', ...HEAD], maxHands: 330,
      pattern: { 2: shift('09:30', '18:00', '13:00'), 3: shift('09:30', '18:00', '13:00'), 4: shift('09:30', '18:00', '13:00'), 5: shift('09:30', '18:00', '13:00'), 6: shift('09:30', '18:00', '13:00') }, holidayDays: 28 },
    { id: 's4', name: 'Lily Brooks', role: 'Spa therapist (part time)', colour: '#4f7c8a', email: '', phone: '', treatments: ['inc-massage', 'inc-facial', 'tension', 'scalp', 'recipe'], maxHands: 300,
      pattern: { 0: shift('10:00', '18:00', '13:30'), 1: shift('13:00', '22:00', '17:30'), 2: shift('13:00', '22:00', '17:30'), 6: shift('10:00', '18:00', '13:30') }, holidayDays: 17 }
  ];
  const FIRST = ['Olivia', 'Emma', 'Charlotte', 'Sarah', 'Rachel', 'Hannah', 'Laura', 'Megan', 'Jess', 'Claire', 'Priya', 'Aisha', 'Zoe', 'Katie', 'Nicola', 'Helen', 'Tom', 'James', 'Dan', 'Chris', 'Leah', 'Amy', 'Becky', 'Gemma'];
  const LAST = ['Walker', 'Bennett', 'Patel', 'Hughes', 'Clarke', 'Wood', 'Price', 'Turner', 'Shaw', 'Mason', 'Reid', 'Fox', 'Ellis', 'Khan', 'Webb', 'Lloyd', 'Barker', 'Hunt', 'Cole', 'Ward'];

  function make(opts = {}) {
    let seed = opts.seed || 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const cfg = JSON.parse(JSON.stringify(opts.cfg || D0));   // the real starting setup: 2 therapists
    E.migrate(cfg);
    if (!opts.cfg) cfg.staff[1].off = [{ from: E.addD(E.localISO(), 9), to: E.addD(E.localISO(), 13), reason: 'Holiday', kind: 'holiday' }];
    if (!opts.cfg) cfg.promos = [
      { id: 'p1', code: 'WINTER15', label: '15% off winter spa days', type: 'pct', value: 15, on: 'base', from: E.localISO(), to: E.addD(E.localISO(), 45), visitFrom: E.localISO(), visitTo: E.addD(E.localISO(), 90), days: [1, 2, 3, 4], products: ['day', 'access'], minSpend: 0, maxUses: 100, used: 7, active: true,
        banner: { on: true, from: E.localISO(), to: E.addD(E.localISO(), 45), text: 'Winter weekdays: 15% off Day Spa and Spa Access with code WINTER15' } },
      { id: 'p2', code: 'THANKYOU10', label: '£10 off for returning guests', type: 'amt', value: 10, on: 'all', from: '', to: '', products: [], minSpend: 80, maxUses: 0, used: 3, active: true, banner: { on: false } }
    ];
    const today = E.localISO(), bookings = [], cust = {};
    const ref = () => 'YC-' + Math.floor(rnd() * 36 ** 6).toString(36).toUpperCase().padStart(6, '0');
    const mix = [['day', 34], ['access', 14], ['break', 20], ['treat', 12], ['private', 5], ['group', 3], ['house', 2]];
    const W = mix.reduce((a, x) => a + x[1], 0);
    const prodPick = () => { let r = rnd() * W; for (const [k, w] of mix) { if ((r -= w) < 0) return k; } return 'day'; };
    const days = opts.days || [-90, 60];
    // make sure every kind of booking shows up: private spa days, group breaks and whole-house weekends on a rhythm
    const forced = off => { const d = E.addD(today, off), w = E.dow(d), out = [];
      if (off % 9 === 0) out.push('private'); if (w >= 0 && w <= 3 && off % 5 === 0) out.push('group'); if (w === 5 && Math.abs(off) % 3 === 1) out.push('house');
      if (off % 4 === 0) out.push('treat'); if (w >= 0 && w <= 3 && off % 3 === 0) out.push('break'); return out; };
    let n = 0; const ix = E.index(cfg, []);
    for (let off = days[0]; off <= days[1]; off++) {
      const date = E.addD(today, off), busyness = 0.55 + (E.dow(date) >= 5 || E.dow(date) === 0 ? 0.35 : 0) + (off > 30 ? -0.35 : 0);
      const tries = Math.round(busyness * 5 + rnd() * 2);
      const must = forced(off);
      for (let k = 0; k < tries + must.length; k++) {
        const product = k < must.length ? must[k] : prodPick(), p = cfg.products[product]; if (!p || p.active === false) continue;
        let guests = product === 'group' ? 7 + Math.floor(rnd() * 5) : product === 'house' ? 10 + Math.floor(rnd() * 6) : product === 'private' ? 4 + Math.floor(rnd() * 5) : product === 'treat' ? 1 + (rnd() < .3 ? 1 : 0) : rnd() < .7 ? 2 : (product === 'break' ? 4 : 1 + Math.floor(rnd() * 4));
        guests = Math.max(E.minGuests(cfg, product, date), Math.min(p.max, guests));
        const nights = p.kind === 'house' ? 2 + (rnd() < .3 ? 1 : 0) : p.nights ? (rnd() < .3 && p.nights.includes(2) ? 2 : 1) : 0;
        const chk = E.dateCheck(cfg, ix, { product, date, nights, guests, admin: true, today: E.addD(date, -30) });
        if (!chk.ok) continue;
        const ses = chk.sessions ? chk.sessions.filter(s => s.ok) : [];
        const b = { id: (opts.idPrefix || 'b') + (++n), sample: !!opts.cfg, ref: ref(), product, date, nights, guests, status: 'confirmed', sessionId: ses.length ? pick(ses).id : null,
          part: product === 'treat' ? pick(['Morning', 'Afternoon']) : null, rooms: chk.rooms || [], breakfast: p.breakfast && rnd() < .4, blueLight: rnd() < .06,
          guestList: [], items: [], payments: [], history: [], source: pick(['web', 'web', 'web', 'web', 'phone', 'email']), tags: [] };
        const foods = cfg.foods.filter(f => f.products.includes(product));
        for (let g = 0; g < guests; g++) {
          const extras = [];
          const extraP = product === 'treat' ? 1 : product === 'house' ? .25 : .3;
          if (rnd() < extraP) extras.push(pick(cfg.treatments.filter(t => E.sellable(t))).id);
          if (product === 'treat' && rnd() < .2) extras.push(pick(['tension', 'scalp', 'basics']));
          b.guestList.push({ name: g ? '' : '', food: p.food && foods.length ? pick(foods).id : null, included: E.includedFor(cfg, product).length ? pick(E.includedFor(cfg, product)).id : null, extras: [...new Set(extras)], consult: off < 0 ? 'done' : rnd() < .5 ? 'done' : 'needed' });
        }
        if (product === 'treat') b.treatStart = pick(['10:00', '10:30', '11:00', '11:30', '13:00', '14:00', '14:30', '15:00', '16:00']);
        const sch = E.plan(cfg, ix, b);
        if (!sch.ok) continue;
        b.items = sch.items;
        const first = pick(FIRST), last = pick(LAST), email = `${first}.${last}`.toLowerCase() + '@example.com';
        b.customer = { first, last, email, phone: '07700 9' + String(Math.floor(rnd() * 99999)).padStart(5, '0') };
        // every guest has a name (user, 2026-11-26): the booker first, made-up names for the others
        b.guestList.forEach((g, i) => { g.name = i === 0 ? `${first} ${last}` : `${pick(FIRST)} ${rnd() < .3 ? last : pick(LAST)}`; });
        { const rs = b.product === 'house' ? cfg.rooms.filter(r => r.active !== false).map(r => r.id) : (b.rooms || []); if (rs.length) b.guestList.forEach((g, i) => { g.room = rs[Math.min(rs.length - 1, Math.floor(i / 2))]; }); }
        if (!opts.cfg && rnd() < .08) b.promo = { code: 'THANKYOU10', type: 'amt', value: 10, on: 'all' };
        if (rnd() < .05) b.discount = { type: 'pct', value: 10, reason: 'Birthday' };
        b.quote = E.quote(cfg, b, E.addD(date, -30));
        const lead = 3 + Math.floor(rnd() * 50), created = new Date(E.pd(E.addD(date, -lead)).getTime() + 9 * 36e5 + rnd() * 10 * 36e5).toISOString();
        b.created = created; b.updated = created;
        const method = rnd() < .2 ? 'klarna' : rnd() < .05 ? 'voucher' : b.source === 'phone' && rnd() < .3 ? 'card terminal' : 'card';
        const due = b.quote.balance && E.between(today, b.quote.balanceDue) > 0 ? b.quote.deposit : b.quote.total;
        if (b.source !== 'web' && off > 3 && rnd() < .35) { b.status = 'pending'; b.payLink = { sent: created, expires: E.addD(E.localISO(new Date(created)), 7) }; }
        else b.payments.push({ id: 'pay' + n, at: created, amount: due, method, kind: 'payment', note: method === 'voucher' ? 'Gift voucher' : '' });
        if (rnd() < .06 && off > -60) {
          b.status = 'cancelled'; b.cancelled = { at: new Date(E.pd(E.addD(date, -Math.floor(lead / 2)))).toISOString(), reason: pick(['Illness', 'Change of plans', 'Moved to another date']) };
          const t = E.cancelTerms(cfg, b, E.addD(date, -Math.floor(lead / 2)));
          if (t.refund) b.payments.push({ id: 'ref' + n, at: b.cancelled.at, amount: -t.refund, method, kind: 'refund', note: 'Refund on cancellation' });
        }
        if (off < 0 && b.status !== 'cancelled') b.arrived = true;
        b.history.push({ at: created, by: b.source === 'web' ? 'Website' : 'Sample staff', what: 'Booking made' });
        const ck = email; cust[ck] = cust[ck] || { email, first, last, phone: b.customer.phone, marketing: rnd() < .5, notes: '', tags: [] };
        bookings.push(b); if (E.live(b)) E.addToIndex(cfg, ix, b);
      }
    }
    // a few returning guests
    bookings.slice(0, 30).forEach((b, i) => { if (i % 3 === 0 && bookings[i + 40] && bookings[i + 40].status !== 'cancelled') { bookings[i + 40].customer = { ...b.customer }; } });
    const customers = {};
    for (const b of bookings) customers[b.customer.email] = customers[b.customer.email] || { email: b.customer.email, first: b.customer.first, last: b.customer.last, phone: b.customer.phone, marketing: rnd() < .5, notes: '', tags: [] };
    const vouchers = [];
    for (let i = 0; i < 18; i++) {
      const vp = pick(cfg.vouchers.products), sold = E.addD(today, -Math.floor(rnd() * 300)), used = rnd() < .45;
      vouchers.push({ id: 'v' + i, code: 'YCV-' + Math.floor(rnd() * 36 ** 6).toString(36).toUpperCase().padStart(6, '0'), product: vp.id, name: vp.name, paid: vp.price, value: vp.value, balance: used ? (rnd() < .3 ? Math.round(vp.value * .3) : 0) : vp.value,
        buyer: pick(FIRST) + ' ' + pick(LAST), recipient: pick(FIRST), sold, expires: E.addD(sold, 365), status: 'active', uses: used ? [{ at: E.addD(sold, 60), amount: vp.value, ref: 'YC-SAMPLE' }] : [] });
    }
    const waitlist = [
      { id: 'w1', at: new Date().toISOString(), product: 'day', date: E.addD(today, 4), guests: 2, name: 'Sample: Rachel Fox', email: 'rachel.fox@example.com', phone: '07700 900111', note: 'Any session', status: 'waiting' },
      { id: 'w2', at: new Date().toISOString(), product: 'break', date: E.addD(today, 8), guests: 2, name: 'Sample: Tom Ellis', email: 'tom.ellis@example.com', phone: '07700 900222', note: 'Anniversary', status: 'waiting' }
    ];
    // sample support messages (sample emails: nothing is sent)
    const tickets = ((customers, now) => {
  const k = () => Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  const at = h => new Date(now.getTime() - h * 3600e3).toISOString();
  const cs = Object.values(customers).filter(c => /@example\.com$/.test(c.email));
  const a = cs[0] || { first: 'Olivia', last: 'Walker', email: 'olivia.walker@example.com' }, b = cs[1] || { first: 'James', last: 'Hunt', email: 'james.hunt@example.com' };
  return [
    { id: 'T-SMPL01', key: k(), status: 'open', needsReply: true, created: at(2), updated: at(2), name: a.first + ' ' + a.last, email: a.email, phone: a.phone || '', topic: 'An existing booking', ref: '', customer: a.email, sample: true,
      messages: [{ from: 'guest', at: at(2), text: 'Hi, is it possible to move our afternoon session to the morning instead? We have a family thing later in the day. Thanks!' }] },
    { id: 'T-SMPL02', key: k(), status: 'open', needsReply: false, created: at(30), updated: at(26), name: b.first + ' ' + b.last, email: b.email, phone: b.phone || '', topic: 'Gift vouchers', ref: '', customer: b.email, sample: true,
      messages: [{ from: 'guest', at: at(30), text: 'Do your gift vouchers cover the overnight spa break, or just spa days?' }, { from: 'staff', by: 'York Cottage', at: at(26), text: 'Hi! Our money vouchers can be used on anything, including the overnight spa break. Experience vouchers are for the experience named on them.' }] },
    { id: 'T-SMPL03', key: k(), status: 'open', needsReply: true, created: at(0.5), updated: at(0.5), name: 'Megan Hartley', email: 'megan.hartley@example.com', phone: '07700 900123', topic: 'Groups and events', ref: '', customer: null, sample: true,
      messages: [{ from: 'guest', at: at(0.5), text: 'Hello, I’m organising a hen party for 10 in June. Could we book the whole house for two nights and add treatments for everyone?' }] },
  ];
})(customers, new Date());
    return { cfg, bookings, customers, vouchers, waitlist, tickets };
  }
  const S = { make, STAFF };
  if (typeof module !== 'undefined') module.exports = S; else root.YCSeed = S;
})(this);
