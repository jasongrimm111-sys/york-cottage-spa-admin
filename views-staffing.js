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
      <span class="small muted" style="display:block">${s.reasons.join(' · ')}</span></span><a class="btn sm" href="#/staffday/${(A.cfg().staff[0] || {}).id || ''}/${s.date}">See the day</a></div>`;
  const card0 = list => { const top = list.filter(s => s.level >= 2), rest = list.filter(s => s.level < 2), show = top.concat(rest.slice(0, Math.max(0, 6 - top.length))), more = list.filter(s => !show.includes(s));
    return `<div class="card staffing"><div class="card-h"><h3>Staffing suggestions</h3><span class="small muted">Next six weeks</span></div>
    ${list.length ? `<p class="muted" style="margin-bottom:8px">Days where another therapist would let you sell more, or take pressure off the team. Red: sales are being lost or someone is over their limit.</p>
      <div class="list">${show.sort((a, b) => a.date.localeCompare(b.date)).map(row).join('')}</div>${more.length ? `<details style="margin-top:8px"><summary class="small" style="cursor:pointer">${more.length} smaller suggestion${more.length > 1 ? 's' : ''}</summary><div class="list">${more.map(row).join('')}</div></details>` : ''}`
      : '<p class="muted">Nothing to suggest: there’s enough therapist time for what’s booked over the next six weeks.</p>'}</div>`; };
  const card = card0;
  A.staffingCard = () => card(A.staffingSuggestions());
})();
