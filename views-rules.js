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
      '<b>Treatments only</b> can still be booked while the spa is booked “just for” a group, but never during the hours a whole-house stay has the spa.',
      'On a <b>whole-house check-in day</b>, morning sessions and treatments only can still be booked (before the house has the spa); on its <b>check-out day</b>, afternoon and evening sessions and treatments only can. Days in between are the house’s alone. <b>Groups</b> can’t be on any day of a whole-house stay.',
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
      `Treatments-only guests are asked to arrive <b>${E.arriveBefore(cfg)} minutes</b> before their first treatment. <a href="#/settings/rules">Change</a>`,
      `When more than one therapist is working: ${(r.share || 'fill') === 'fill' ? `<b>fill one therapist’s day before using the next</b>, in this order: ${cfg.staff.filter(s => s.active !== false && !s.cover && (s.treatments || []).length).sort(E.byPriority).map(s => esc(s.name)).join(', ')}` : r.share === 'week' ? '<b>share fairly across the week</b> (whoever has done least that week first)' : '<b>share evenly between everyone on shift</b> that day'}. Cover therapists${cfg.staff.some(s => s.cover) ? ` (${cfg.staff.filter(s => s.cover).map(s => esc(s.name)).join(', ')})` : ''} are only booked when the others are full.`,
      r.groupTogether ? `Groups of <b>${r.groupTogetherFrom || 2} or more</b> are treated side by side where it costs at most 30 minutes.` : 'Guests in a group aren’t specially put side by side.',
      `A therapist does at most <b>${mins(r.maxHandsOn || 360)}</b> of hands-on treatments a day (unless their own limit is set in Staff).`,
      `Treatment rooms: ${(cfg.treatRooms || []).filter(x => x.active !== false).map(x => `${esc(x.name)} (${x.beds} bed${x.beds > 1 ? 's' : ''})`).join(', ')}.`,
      'A therapist <b>only ever treats one guest at a time</b>, and a treatment room is <b>one guest’s at a time</b>.',
      'Two guests <b>from the same booking</b> can be treated <b>together</b> in a 2-bed room (each with their own therapist, at the same time) when they ask for it while booking. Guests from different bookings never share a room.'
    ], '#/settings/rules'));

    // ---- breaks ----
    // ---- staff cover (user 2026-11-27) ----
    const covers = cfg.staff.filter(s => s.active !== false && s.cover), sug = A.staffingSuggestions ? A.staffingSuggestions() : [], need = sug.filter(x => x.level >= 2);
    out.push(card('cover', 'Staff cover for busy days', 'How the system spots days that need another therapist, and how to add one just for that day.', [
      `<b>How treatments are shared:</b> ${(r.share || 'fill') === 'fill' ? 'each therapist’s day is filled before the next is used, so a busy day shows clearly when one person is nearly full' : r.share === 'week' ? 'shared fairly across the week' : 'shared evenly between everyone on shift'}. <a href="#/settings/rules">Change</a>`,
      `<b>Staffing suggestions</b> look six weeks ahead and flag a day when: therapist time is <b>85%+ booked</b>; a therapist is within <b>90% of their daily hands-on limit</b>; a session <b>still has places but no therapist time</b> is left for its included treatments (so it can’t be sold online); only the included treatments fit, so guests can’t add extras; or no therapist is rostered while the spa is open.`,
      `Red means sales are being lost or someone is over their limit; amber means worth considering. They show on the <a href="#/rota">Rota</a>, in the <a href="#/todo">To do</a> list, and at the top of each day on <a href="#/ahead">Future days</a>${need.length ? `. <b>${need.length} day${need.length > 1 ? 's' : ''}</b> in the next six weeks ${need.length > 1 ? 'need' : 'needs'} cover now: ${need.slice(0, 5).map(x => `<a href="#/ahead/${x.date}">${A.fd(x.date)}</a>`).join(', ')}` : ''}.`,
      `<b>To add cover:</b> press <b>Add cover</b> on a suggestion (or on the day). Pick a therapist who isn’t working that day, or add someone new, and set their hours. It’s a one-off shift for that day only; their usual week doesn’t change.`,
      `When cover is added, the day’s <b>booked treatments are shared out</b> between everyone on shift where possible. Guests keep exactly the same times; only who treats them (and which room) can change, and you see the list before anything moves. Therapists whose treatments change are emailed their new list (if they have schedule alerts on).`,
      `As soon as cover is on the rota, the website can <b>sell more that day</b>: more times for extras and longer treatments, and sessions that had no therapist time become bookable again.`,
      `<b>Cover-only therapists</b> (Staff → Edit → “Cover only”) are only booked when the regular therapists are full, whichever sharing rule is chosen. ${covers.length ? 'Cover-only now: ' + covers.map(s => esc(s.name)).join(', ') + '.' : 'Nobody is marked cover-only yet; anyone new added through Add cover is.'} On days they aren’t rostered they add nothing to what the website offers.`
    ], '#/rota'));
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

    // ---- prices (user 2026-11-28): what's on offer and how each price was worked out ----
    { const pr = cfg.products, X = E.exclusiveRates(cfg), ses = k => (cfg.sessions || []).filter(s => s.product === k && s.active !== false);
      const sp = (k, len) => { const s = ses(k).find(x => (x.length || 'half') === len); return s ? (s.price != null ? s.price : pr[k].price) : null; };
      const times = (k, len) => ses(k).filter(x => (x.length || 'half') === len).map(x => `${x.start}–${x.end}`).join(' or ');
      const acc = pr.access || {}, day = pr.day || {}, brk = pr.break || {}, hs = pr.house || {}, n1 = (brk.priceN || {})[1], nx = (brk.priceN || {})[2] - n1;
      const exRow = (g) => { const e = (brk.exclusiveFrom || 6) - g; return [`${g} guest${g === 1 ? '' : 's'}`, `${e}`, gbp(e * X.half), gbp(e * X.full), gbp(e * X.night) + ' a night']; };
      out.push(`<section class="card rl-card" id="rl-prices"><div class="card-h"><h3>Prices</h3>${link('#/products')}</div>
      <p class="muted rl-intro">What guests can book, what each costs, and the thinking behind every price. Change prices in Booking types; change the “just for us” prices in Settings → Booking rules.</p>
      <h4 class="rl-h">What’s on offer</h4>
      ${grid(['Booking', 'What’s included', 'Length', 'Guests', 'Price'], [
        [`<b>${esc(acc.name || 'Spa Access Only')}</b>`, 'Spa pool, sauna and lounge, hot &amp; cold drinks, towel and robe. No food or treatment.', `Half day (${times('access', 'half')}) or full day (${times('access', 'full')})`, `${acc.min || 1}–${acc.max || 6}`, `${gbp(sp('access', 'half'))} half day · ${gbp(sp('access', 'full'))} full day, per person`],
        [`<b>${esc(day.name || 'Spa, Lunch & Treatment')}</b>`, 'Everything in Spa Access Only, plus lunch (afternoon tea or a grazing board) and a 20-minute massage or facial each.', `Half day (${times('day', 'half')}) or full day (${times('day', 'full')})`, `${day.min || 1}–${day.max || 6}`, `${gbp(sp('day', 'half'))} half day · ${gbp(sp('day', 'full'))} full day, per person`],
        [`<b>${esc(brk.name || 'Spa Break')}</b>`, 'Guests choose from any free bedroom (king, double or twin), the spa from 2pm on arrival until 6pm on the last evening (Sunday arrivals 18:00–22:30), lunch every day, the kitchen for dinner, a 20-minute massage or facial each.', 'Sunday to Thursday nights, 1 to 5 nights, ending by Friday morning', `${brk.min || 1}–${brk.max || 16}`, Object.entries(brk.priceN || {}).map(([n, v]) => `${n} night${n === '1' ? '' : 's'} ${gbp(v)}`).join(' · ') + ` per person, 2 sharing. Room to themselves +${gbp(brk.singleSupp || 0)} a night.`],
        [`<b>${esc(hs.name || 'Whole House & Spa')}</b>`, 'The whole house and spa: 8 bedrooms, kitchen, 2 living rooms, hot tub and sauna.', 'Must include Friday and Saturday night; extra nights either side (up to 30)', `up to ${hs.max || 16}`, `From ${gbp(hs.night || 0)} a night for the house`],
        [`<b>${esc((pr.treat || {}).name || 'Treatments only')}</b>`, 'Massages, facials and Japanese head spa, without a spa session.', 'Guests pick a start time', `${(pr.treat || {}).min || 1}–${(pr.treat || {}).max || 4}`, 'Each treatment’s own price'],
        ['<b>Breakfast</b> (spa breaks)', 'Continental breakfast', 'Each morning', '', `${gbp(cfg.breakfastPrice || 10)} per person per morning`]])}
      <h4 class="rl-h">How the prices work</h4>
      <ul class="rl-list">
        <li><b>Half days are 4 hours</b>: Spa Access Only ${gbp(sp('access', 'half'))} and Spa, Lunch &amp; Treatment ${gbp(sp('day', 'half'))} per person.</li>
        <li><b>Full days (7½ hours) cost less per hour than two half days.</b> Spa Access Only full day ${gbp(sp('access', 'full'))} (half day + 50%). Spa, Lunch &amp; Treatment full day ${gbp(sp('day', 'full'))}: the same spa time, but lunch and the treatment are only had once, so it adds ${gbp(sp('day', 'full') - sp('day', 'half'))} to the half day rather than doubling it. Both fill the spa from 09:30 to 17:00, so a full-day guest takes the place of a morning and an afternoon guest; the premium covers most of the second half day, and a longer day is a reason to book.</li>
        <li><b>The difference between the two spa days is lunch and a treatment</b>: ${gbp(sp('day', 'half') - sp('access', 'half'))} per person for a half day.</li>
        <li><b>Spa Break: ${gbp(n1)} for the first night, then ${gbp(nx)} for each extra night.</b> Each night includes the room, spa time and lunch. Extra nights cost less than the first because check-in, changeover and the room clean happen once per stay.</li>
        <li><b>Room to themselves +${gbp(brk.singleSupp || 0)} a night</b>: break prices are based on 2 sharing, so anyone alone in a room (by choice or an odd number of guests) pays towards the empty half. Guests choose their rooms and see the charge before they continue. Not charged when the break has 6 or more guests or is booked “just for us”: those nights are closed to other guests, so every bedroom is theirs and a guest sleeping alone takes no room that could have been sold.</li>
        <li><b>Whole House</b>: ${gbp(hs.night || 0)} a night. It’s the only booking that gives a group the whole house, and it must include Friday and Saturday, when hen parties and big groups want it.</li>
        <li><b>Head spa</b> is ${r.headSpaOff || 10}% off with a spa day or stay.</li>
        <li>${E.groupRates(cfg).on ? `<b>Group discount: ${E.groupRates(cfg).pct}% off for ${E.groupRates(cfg).from} or more guests</b> on Spa Access Only, Spa, Lunch &amp; Treatment and Spa Breaks, to help more groups book. A group of ${E.groupRates(cfg).from} fills the spa in one sale (no empty places to sell and less admin), so a small discount is worth it, and they also get the spa to themselves. It’s off the booking price only: extra treatments, where most groups spend more, and breakfast stay full price. Not on the Whole House, which is already priced for the group. Only one discount per booking, so a code or the head spa offer is used instead if it saves more. Example: 6 on a half-day Spa, Lunch &amp; Treatment pay ${gbp(6 * (sp('day', 'half') || 0) * (100 - E.groupRates(cfg).pct) / 100)} instead of ${gbp(6 * (sp('day', 'half') || 0))}.` : 'The group discount is switched off.'}</li>
      </ul>
      <h4 class="rl-h">“Just for us” (exclusive use)</h4>
      <ul class="rl-list">
        <li><b>6 or more guests have it free.</b> The spa holds 6 at once, so a booking of 6 fills it anyway. On a spa break, 6+ also means no other guests stay those nights.</li>
        <li><b>Fewer than 6 pay for each empty place, at about half the price of that place</b>: ${gbp(X.half)} per empty place for a half day and ${gbp(X.full)} for a full day (half of Spa Access Only, because what the business loses is spa space, not lunch or treatments), and ${gbp(X.night)} per empty place per night on a spa break (half the first-night price, because the spare bedrooms close too).</li>
        <li><b>Why half price:</b> empty places wouldn’t all have sold, so charging about half of each one leaves the business level on average, while a couple pays far less than for 6 people. Exclusive bookings also tend to add extra treatments.</li>
        <li><b>The fewer guests, the more it costs</b>, but the more of them, the better value it is. The guest sees the exact amount on the tick box, on the half-day / full-day buttons and as its own line in the summary before paying.</li>
        <li>${X.lastOn ? `<b>Last minute: ${X.lastPct}% off when booked ${X.lastDays} days or fewer before the visit</b>, because empty places that late rarely sell.` : 'The last-minute discount is switched off.'}</li>
        <li>Only offered when nobody else is booked in. If a day can’t be just theirs, the guest is told and can choose another day or carry on without it.</li>
      </ul>
      ${grid(['Guests', 'Empty places', 'Half day', 'Full day', 'Spa break'], [1, 2, 3, 4, 5].map(exRow))}
      <p class="small muted" style="margin-top:8px">“Just for us” amounts before any last-minute discount.</p></section>`); }

    // ---- capacity and rooms ----
    out.push(card('cap', 'Spa capacity and bedrooms', '', [
      `At most <b>${(cfg.spa || {}).capacity || '?'} guests</b> in the spa at once, with <b>${(cfg.spa || {}).changeover || 0} minutes</b> between sessions.`,
      ...(cfg.sessions || []).filter(s => s.active !== false && s.cap && (cfg.products[s.product] || {}).active !== false).map(s => `${esc((cfg.products[s.product] || {}).name || s.product)} · ${esc(s.name)}: up to <b>${s.cap}</b> guests.`),
      `Bedrooms: ${(cfg.rooms || []).filter(x => x.active !== false).map(x => `${esc(x.name)} (sleeps ${x.people})`).join(', ')}.`,
      'A whole-house booking, a spa day or spa break of 6+, or one booked “just for us” has the spa to itself.'
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

    const toc = [['glance', 'The big rules'], ['hours', 'Hours'], ['types', 'Booking types'], ['prices', 'Prices'], ['treat', 'Treatments'], ['plan', 'Planning'], ['cover', 'Staff cover'], ['breaks', 'Breaks'], ['food', 'Food'], ['cap', 'Capacity'], ['staff', 'Staff'], ['online', 'Online']];
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Rules</h1><p>Everything the booking system follows, worked out from your current settings.</p></div></div>
      <nav class="rl-toc">${toc.map(([id, t]) => `<a href="#rl-${id}" data-rl="${id}">${t}</a>`).join('')}</nav>${out.join('')}`,
      wire: el => el.querySelectorAll('[data-rl]').forEach(a => a.onclick = e => { e.preventDefault(); const t = el.querySelector('#rl-' + a.dataset.rl); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }) };
  };
})();
