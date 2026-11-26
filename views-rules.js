// Rules: every rule and setting the booking system follows, in plain English, with a link to where each is changed
// (user, 2026-11-27). Read-only: it's worked out from the live settings, so it's always up to date.
(function () {
  const A = window.YCA, E = window.YCEngine, V = A.views;
  const { esc } = A;
  const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], ORDER = [1, 2, 3, 4, 5, 6, 0];
  const SH = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const gbp = n => '£' + (Math.round(n * 100) / 100).toLocaleString('en-GB');
  const mins = m => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} hour${m === 60 ? '' : 's'}`) : `${m} min`;
  const days = list => { const l = ORDER.filter(d => (list || []).includes(d)); if (!l.length) return 'no days'; if (l.length === 7) return 'every day';
    const runs = []; let a = null, p = null; for (const d of l) { const i = ORDER.indexOf(d); if (a != null && i === ORDER.indexOf(p) + 1) p = d; else { if (a != null) runs.push([a, p]); a = p = d; } } runs.push([a, p]);
    return runs.map(([x, y]) => x === y ? SH[x] : ORDER.indexOf(y) - ORDER.indexOf(x) === 1 ? SH[x] + ', ' + SH[y] : SH[x] + '–' + SH[y]).join(', '); };
  const link = (href, t = 'Change') => `<a class="rl-go" href="${href}">${t} →</a>`;
  const card = (id, title, intro, rows, href) => `<section class="card rl-card" id="rl-${id}"><div class="card-h"><h3>${title}</h3>${href ? link(href) : ''}</div>${intro ? `<p class="muted rl-intro">${intro}</p>` : ''}<ul class="rl-list">${rows.filter(Boolean).map(r => `<li>${r}</li>`).join('')}</ul></section>`;
  const grid = (head, rows) => `<div class="rl-tbl-wrap"><table class="tbl rl-tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  V.rules = () => {
    const cfg = A.cfg(), r = cfg.rules || {}, br = E.breakRules(cfg, null), tt = cfg.treatTimes || {}, th = cfg.treatHours || {};
    const prods = Object.entries(cfg.products).filter(([, p]) => p.active !== false);
    const tr = id => (cfg.treatments.find(t => t.id === id) || {}).name || id;
    const out = [];

    // ---- at a glance ----
    out.push(card('glance', 'The big rules', 'What the booking system always makes sure of, on the website and in the admin.', [
      'A day or session is only offered if <b>every guest’s included treatment</b> can be given a time, after the lunch or food service has been staffed.',
      'An extra treatment is only offered if <b>everyone’s treatments still fit</b> with it.',
      'Guests choose a time for every treatment before they can pay. Changing the date or session clears their treatment choices and times.',
      `Just before paying, the times are checked again and <b>held for ${r.holdMinutes || 30} minutes</b>. If two people pay for the same time at once, only the first gets it; the other is asked to choose again and isn’t charged.`,
      'Treatments are planned at the <b>earliest free time</b>. Guests are put side by side only if that delays them by 30 minutes or less.',
      `Treatments can start on the ${(r.slotStep || 30) === 60 ? 'hour' : (r.slotStep || 30) === 30 ? 'hour and half hour' : `${r.slotStep}-minute marks`}, or <b>back to back</b>, as soon as a therapist and room are free again (to the nearest 5 minutes).`,
      '<b>Treatments only</b> are never offered on a day the spa is booked exclusively (private spa, group or whole house).',
      'No therapist is booked over their hours, breaks, time off, food duty, or daily hands-on limit.'
    ]));

    // ---- opening and treatment hours ----
    out.push(`<section class="card rl-card" id="rl-hours"><div class="card-h"><h3>Opening and treatment hours</h3>${link('#/spa/hours', 'Opening hours')}</div>
      <p class="muted rl-intro">Treatments run inside the treatment hours, which sit inside opening hours. Treatments only have their own days and times on top.</p>
      ${grid(['Day', 'Spa open', 'Treatments', 'Treatment starts', 'Treatments only'], ORDER.map(d => { const o = cfg.hours[d], h = th[d], tp = ((cfg.products.treat || {}).dayHours || {})[d], t = { first: '00:00', last: '23:59', ...(tt.default || {}), ...(tt[d] || {}) };
        return [`<b>${DAY[d]}</b>`, o ? `${o.start}–${o.end}` : '<span class="muted">Closed</span>', !o ? '—' : h && h.on === false ? '<span class="rl-off">Off</span>' : h ? `${h.from}–${h.to}` : 'Whenever open', o ? `${t.first} to ${t.last}` : '—', !o || !cfg.products.treat ? '—' : tp && tp.on === false ? '<span class="rl-off">Off</span>' : tp ? `${tp.from}–${tp.to}` : 'As treatments']; }))}
      <p class="rl-links">${link('#/settings/treathours', 'Treatment hours and treatments only')} ${link('#/spa/times', 'Treatment start times')} ${link('#/spa/closures', 'Closures')}</p>
      ${(cfg.closures || []).length ? `<p class="small muted">${cfg.closures.length} closure${cfg.closures.length > 1 ? 's' : ''} set (days the spa is shut).</p>` : ''}</section>`);

    // ---- booking types ----
    const prodRows = prods.map(([k, p]) => {
      const price = p.priceN ? Object.entries(p.priceN).map(([n, v]) => `${gbp(v)} pp for ${n} night${n > 1 ? 's' : ''}`).join(', ') : p.kind === 'treat' ? 'Treatments at their own prices' : p.kind === 'house' ? `${gbp(p.night || 0)} a night (can vary by date)` : p.price ? `${gbp(p.price)} ${p.perPerson === false ? 'per booking' : 'per person'}` : 'Price on request';
      const g = `${p.min || 1}–${p.max || '?'} guests${p.minByDay ? ' (' + Object.entries(p.minByDay).map(([d, n]) => `${n}+ on ${DAY[d]}s`).join(', ') + ')' : ''}`;
      const ses = (cfg.sessions || []).filter(s => s.product === k && s.active !== false);
      const when = ses.length ? ses.map(s => `${esc(s.name)} ${s.start}–${s.end} (${days(s.days || [0, 1, 2, 3, 4, 5, 6])})`).join('<br>') : p.nights ? `${p.nights.map(n => n + ' night' + (n > 1 ? 's' : '')).join(' or ')}${p.arriveDays ? '; arrive ' + Object.entries(p.arriveDays).map(([n, ds]) => (p.nights.length > 1 ? n + '-night: ' : '') + days(ds)).join('; ') : ''}` : p.kind === 'house' ? `${p.minN || 2}–${p.maxN || 30} nights` : p.kind === 'treat' ? 'Any start time in treatments-only hours' : '—';
      const inc = E.includedFor(cfg, k); const incTxt = inc.length ? (E.includedPick(cfg, k) === 'all' ? inc.map(t => esc(t.name)).join(' + ') : 'One of: ' + inc.map(t => esc(t.name)).join(', ')) : '—';
      const pay = p.pay ? (p.pay.deposit >= 100 ? 'Paid in full' : `${p.pay.deposit}% deposit`) : '—';
      const rs = ((p.cancel || {}).rules || []).slice().sort((x, y) => y.minDays - x.minDays);
      const keep = x => x.keepDeposit ? 'deposit kept' : !x.keepPct ? 'full refund' : x.keepPct >= 100 ? 'no refund' : `${100 - x.keepPct}% refunded`;
      const canc = p.cancel ? (rs.length === 1 ? keep(rs[0]).replace(/^./, c => c.toUpperCase()) : rs.map((x, i) => `${x.minDays ? `${x.minDays}+ days before` : `under ${rs[i - 1] ? rs[i - 1].minDays : 0} days`}: ${keep(x)}`).join('<br>')) + (p.cancel.moveDays ? `<br><span class="small muted">Can move with ${p.cancel.moveDays}+ days’ notice</span>` : '') : '—';
      return [`<b>${esc(p.name)}</b>${p.online === false ? '<br><span class="small muted">Not bookable online</span>' : ''}`, price, g, when, incTxt, p.food ? 'Yes' : '—', pay, canc];
    });
    out.push(`<section class="card rl-card" id="rl-types"><div class="card-h"><h3>Booking types</h3>${link('#/products')}</div><p class="muted rl-intro">What each booking type includes and its rules. Booking types themselves are set up by Claude; their prices and rules can be changed here.</p>
      ${grid(['Type', 'Price', 'Guests', 'When', 'Included treatment', 'Food', 'Payment', 'Cancelling'], prodRows)}</section>`);

    // ---- treatments and extras ----
    const sell = cfg.treatments.filter(t => t.active !== false && t.sell !== false && !/^inc/.test(t.id));
    out.push(`<section class="card rl-card" id="rl-treat"><div class="card-h"><h3>Treatments and extras</h3>${link('#/treatments')}</div>
      <ul class="rl-list">
        <li>Each guest can add up to <b>${r.maxExtras || 3} extra treatments</b> online.</li>
        ${r.combineIncluded !== false ? `<li>An extra of the <b>same kind</b> as the included treatment (a massage with the included massage) <b>extends it</b> into one longer treatment, up to <b>${E.combineMax(cfg)} minutes</b> in all. One extension per guest.</li>
        <li>An extension that fits whole keeps its own price. One that's cut short to fit costs a flat <b>${gbp(E.extendPrice(cfg))}</b>.</li>` : '<li>Extras are always separate treatments.</li>'}
        <li>Japanese head spa is <b>${r.headSpaOff || 0}% off</b> with a session or stay.</li>
        ${r.blueLight ? `<li>Blue Light Card holders get included treatments of <b>${r.blueLightMin} minutes</b>.</li>` : ''}
      </ul>
      ${grid(['Treatment', 'Length', 'Price', 'Turnover after', 'Rooms', 'Who can do it'], sell.concat(cfg.treatments.filter(t => /^inc/.test(t.id) && t.active !== false)).map(t => [esc(t.name) + (/^inc/.test(t.id) ? ' <span class="small muted">(included)</span>' : ''), mins(t.min), /^inc/.test(t.id) ? '—' : gbp(t.price), mins(E.buf(cfg, t)), (t.roomIds || []).map(id => esc(((cfg.treatRooms || []).find(x => x.id === id) || {}).name || id)).join(', ') || 'Any', cfg.staff.filter(s => s.active !== false && E.canDo(s, t.id)).map(s => esc(s.name)).join(', ') || '<span class="rl-off">Nobody</span>']))}</section>`);

    // ---- scheduling ----
    out.push(card('plan', 'How treatments are planned', '', [
      `Every treatment is followed by at least <b>${r.minHandover ?? 15} minutes</b> to reset the room (longer if the treatment says so).`,
      `When more than one therapist is working: ${(r.share || 'fill') === 'fill' ? '<b>use one therapist where possible</b>, by their priority in Staff, then the next' : '<b>share treatments evenly</b>'}.`,
      r.groupTogether ? `Groups of <b>${r.groupTogetherFrom || 2} or more</b> are treated side by side where it costs at most 30 minutes.` : 'Guests in a group aren’t specially put side by side.',
      `A therapist does at most <b>${mins(r.maxHandsOn || 360)}</b> of hands-on treatments a day (unless their own limit is set in Staff).`,
      `Treatment rooms: ${(cfg.treatRooms || []).filter(x => x.active !== false).map(x => `${esc(x.name)} (${x.beds} bed${x.beds > 1 ? 's' : ''})`).join(', ')}.`
    ], '#/settings/rules'));

    // ---- breaks ----
    out.push(card('breaks', 'Therapists’ lunch and breaks', 'The planner leaves room for these in everyone’s day.', [
      `No one works more than <b>${mins(br.maxWithoutBreak)}</b> without a break of <b>${br.breakMin}–${br.breakMax} minutes</b>.`,
      `On days over <b>${mins(br.lunchIfOver)}</b>, a lunch of <b>${br.lunchMin}–${br.lunchMax} minutes</b> between ${br.lunchFrom} and ${br.lunchTo}.`,
      'Food duty counts as work, so a therapist serving lunch still needs their break around it.'
    ], '#/settings/breaks'));

    // ---- food ----
    const sv = (cfg.services || []).filter(s => s.active !== false);
    out.push(`<section class="card rl-card" id="rl-food"><div class="card-h"><h3>Food service</h3>${link('#/spa/food')}</div><p class="muted rl-intro">Someone with food duty serves these; while they do, they can’t give treatments.</p>
      ${grid(['Service', 'Time', 'For', 'Staff needed'], sv.map(s => [esc(s.name), `${s.start}–${s.end}${Object.keys(s.byDay || {}).length ? ' <span class="small muted">(other times on some days)</span>' : ''}`, (s.products || []).map(k => esc((cfg.products[k] || {}).name || k)).join(', '), s.staff || 1]))}
      <p class="small muted" style="margin-top:8px">Food duty: ${cfg.staff.filter(s => (s.duties || []).includes('food')).map(s => esc(s.name)).join(', ') || 'nobody yet'}. Menus: ${(cfg.foods || []).filter(f => f.active !== false).map(f => esc(f.name)).join(', ')}.</p></section>`);

    // ---- capacity and rooms ----
    out.push(card('cap', 'Spa capacity and bedrooms', '', [
      `At most <b>${(cfg.spa || {}).capacity || '?'} guests</b> in the spa at once, with <b>${(cfg.spa || {}).changeover || 0} minutes</b> between sessions.`,
      ...(cfg.sessions || []).filter(s => s.active !== false && s.cap).map(s => `${esc((cfg.products[s.product] || {}).name || s.product)} · ${esc(s.name)}: up to <b>${s.cap}</b> guests.`),
      `Bedrooms: ${(cfg.rooms || []).filter(x => x.active !== false).map(x => `${esc(x.name)} (sleeps ${x.people})`).join(', ')}.`,
      'A private spa, group or whole-house booking has the spa to itself.'
    ], '#/spa/capacity'));

    // ---- staff ----
    out.push(`<section class="card rl-card" id="rl-staff"><div class="card-h"><h3>Staff</h3>${link('#/staff')}</div>
      ${grid(['Name', 'Usual days', 'Does', 'Food duty', 'Hands-on limit', 'Priority'], cfg.staff.filter(s => s.active !== false).map(s => { const pat = s.pattern || {}, on = ORDER.filter(d => { const x = pat[d] || (pat.days || {})[d]; return x && x.on !== false && ((x.shifts || []).length || x.start || x === true); });
        return [`<b>${esc(s.name)}</b>`, on.length ? days(on) : '<span class="muted">See rota</span>', (s.treatments || []).length + ' treatments', (s.duties || []).includes('food') ? 'Yes' : '—', mins(s.maxHands || r.maxHandsOn || 360), s.priority || '—']; }))}</section>`);

    // ---- online booking ----
    out.push(card('online', 'Booking online', '', [
      `Online bookings can be made up to <b>${r.bookAheadDays} days</b> ahead, with at least <b>${r.minNoticeHours} hours’</b> notice.`,
      `Times are held for <b>${r.holdMinutes || 30} minutes</b> while a guest pays.`,
      'Staff booking in the admin follow the same rules, and can see times guests are paying for as taken.'
    ], '#/settings/rules'));

    const toc = [['glance', 'The big rules'], ['hours', 'Hours'], ['types', 'Booking types'], ['treat', 'Treatments'], ['plan', 'Planning'], ['breaks', 'Breaks'], ['food', 'Food'], ['cap', 'Capacity'], ['staff', 'Staff'], ['online', 'Online']];
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Rules</h1><p>Everything the booking system follows, worked out from your current settings.</p></div></div>
      <nav class="rl-toc">${toc.map(([id, t]) => `<a href="#rl-${id}" data-rl="${id}">${t}</a>`).join('')}</nav>${out.join('')}`,
      wire: el => el.querySelectorAll('[data-rl]').forEach(a => a.onclick = e => { e.preventDefault(); const t = el.querySelector('#rl-' + a.dataset.rl); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }) };
  };
})();
