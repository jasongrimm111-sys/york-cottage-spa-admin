/* To do: everything that needs someone's attention (worked out from bookings), plus the team's own tasks. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, gbp, fd, fdy, ft, today, uid } = A;
  const tasks = () => { const DB = A.DB(); DB.tasks = DB.tasks || { items: [], hidden: {} }; DB.tasks.hidden = DB.tasks.hidden || {}; DB.tasks.items = DB.tasks.items || []; return DB.tasks; };

  // automatic to-dos: [{ key, group, level, title, sub, href, booking, act }]
  A.todoItems = () => {
    const t = today(), DB = A.DB(), cfg = A.cfg(), out = [], live = DB.bookings.filter(E.live), due = A.due, cd = A.consultDue;
    const add = o => { if (!tasks().hidden[o.key]) out.push(o); };
    // support messages waiting for a reply come first (user, 2026-11-26: it should be obvious)
    (A.ticketsNeedingReply ? A.ticketsNeedingReply() : []).forEach(tk => out.push({ key: 'tk:' + tk.id, group: 'Support messages', level: 'bad', title: `${tk.name || tk.email} needs a reply`, sub: `${tk.topic || 'Message'} · ${tk.id} · ${new Date(tk.updated || tk.created).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, href: '#/ticket/' + tk.id }));
    DB.bookings.filter(b => b.status === 'pending' && b.date >= t && b.payLink && E.between((b.payLink.sent || b.created || '').slice(0, 10) || t, t) >= 2)
      .forEach(b => add({ key: 'pay:' + b.id + ':' + (b.payLink.sent || ''), group: 'Payments', level: 'warn', title: `${A.cust(b)} hasn’t paid`, sub: `Link for ${gbp(b.payLink.amount || due(b), 2)} sent ${fd((b.payLink.sent || '').slice(0, 10))} · visit ${fd(b.date)}`, href: '#/booking/' + b.id, booking: b, act: 'resend' }));
    live.filter(b => (b.quote || {}).balance && due(b) > 0 && b.status !== 'pending' && b.quote.balanceDue && E.between(t, b.quote.balanceDue) <= 14 && b.date >= t)
      .forEach(b => add({ key: 'bal:' + b.id + ':' + b.quote.balanceDue, group: 'Payments', level: 'info', title: `Balance ${gbp(due(b), 2)} due ${fd(b.quote.balanceDue)}`, sub: `${A.cust(b)} · ${A.pname(b.product)} ${fd(b.date)}`, href: '#/booking/' + b.id, booking: b, act: 'paylink' }));
    live.filter(b => b.date >= t && b.date <= E.addD(t, 3) && cd(b))
      .forEach(b => add({ key: 'form:' + b.id, group: 'Consultation forms', level: 'info', title: `${cd(b)} form${cd(b) > 1 ? 's' : ''} still to come · ${A.cust(b)}`, sub: `${A.pname(b.product)} ${fd(b.date)}`, href: '#/booking/' + b.id, booking: b, act: 'forms' }));
    live.filter(b => (b.items || []).some(i => !i.staff && (i.date || b.date) >= t))
      .forEach(b => add({ key: 'nostaff:' + b.id, group: 'Treatments', level: 'bad', title: `Treatment with no therapist · ${A.cust(b)}`, sub: `${fd(b.date)} · choose a therapist or move it`, href: '#/edit/' + b.id, booking: b }));
    // staffing suggestions: the most pressing days in the next three weeks (user 2026-11-27)
    if (A.staffingSuggestions && A.can('staff.edit')) A.staffingSuggestions().filter(s => s.date <= E.addD(t, 21)).sort((a, b) => (b.level - a.level) || a.date.localeCompare(b.date)).slice(0, 8)
      .forEach(s => add({ key: 'staffing:' + s.date + ':' + s.level, group: 'Staffing suggestions', level: s.level >= 2 ? 'bad' : 'warn', title: `${fdy(s.date)}: ${s.level >= 2 ? 'add a therapist' : 'worth considering another therapist'}`, sub: s.reasons[0].replace(/<[^>]+>/g, ''), href: '#/rota/' + s.date }));
    // time off and shift swaps waiting for a manager (user 2026-11-27)
    if (A.pendingRequests && A.can('staff.edit')) A.pendingRequests().forEach(r => out.push({ key: 'rq:' + r.id, group: 'Team requests', level: r.urgent ? 'bad' : 'warn', title: `${(cfg.staff.find(s => s.id === r.staffId) || {}).name || 'Someone'} ${r.offKind === 'sick' ? 'is off sick' + (r.coverId ? ` (${(cfg.staff.find(s => s.id === r.coverId) || {}).name} will cover)` : '') : 'asked for ' + (r.kind === 'swap' ? 'a shift swap' : 'time off')}`, sub: r.kind === 'swap' ? fd(r.date) : `${fd(r.from)}${r.to && r.to !== r.from ? ' – ' + fd(r.to) : ''}`, href: '#/requests' }));
    const ix = E.index(cfg, DB.bookings);
    DB.waitlist.filter(w => w.status === 'waiting' && w.date >= t && E.dateCheck(cfg, ix, { product: w.product, date: w.date, guests: w.guests, nights: w.nights, admin: true }).ok)
      .forEach(w => add({ key: 'wl:' + w.id, group: 'Waitlist', level: 'ok', title: `Space now free for ${w.name.replace(/^Sample: /, '')}`, sub: `${A.pname(w.product)} · ${fd(w.date)} · ${w.guests} guest${w.guests > 1 ? 's' : ''}`, href: '#/new?wl=' + w.id, act: 'book' }));
    DB.vouchers.filter(v => v.status === 'active' && v.balance > 0 && v.expires >= t && v.expires <= E.addD(t, 30))
      .forEach(v => add({ key: 'v:' + v.id + ':' + v.expires, group: 'Gift vouchers', level: 'info', title: `Voucher ${v.code} expires ${fd(v.expires)}`, sub: `${gbp(v.balance)} left · bought by ${v.buyer || ''}`, href: '#/vouchers' }));
    live.filter(b => b.date < t && b.date >= E.addD(t, -7) && !b.arrived && !b.noShow && !b.nights)
      .forEach(b => add({ key: 'arr:' + b.id, group: 'Arrivals to record', level: 'info', title: `Did ${A.cust(b)} come?`, sub: `${A.pname(b.product)} ${fd(b.date)} · mark arrived or no-show`, href: '#/booking/' + b.id, booking: b, act: 'arrived' }));
    live.filter(b => b.nights && (b.damage || {}).status === 'held' && E.addD(b.date, b.nights) < E.addD(t, -1))
      .forEach(b => add({ key: 'dmg:' + b.id, group: 'Payments', level: 'warn', title: `Release ${A.cust(b)}’s damage deposit`, sub: `Checked out ${fd(E.addD(b.date, b.nights))} · release within 48 hours`, href: '#/booking/' + b.id, booking: b }));
    return out;
  };
  A.todoCount = () => A.todoItems().length + tasks().items.filter(x => !x.done).length;

  A.views.todo = () => {
    const cfg = A.cfg(), t = today(), auto = A.todoItems(), T = tasks();
    const mine = T.items.filter(x => !x.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const doneRecent = T.items.filter(x => x.done).sort((a, b) => (b.done || '').localeCompare(a.done || '')).slice(0, 8);
    const groups = [...new Set(auto.map(x => x.group))];
    const ACT = { resend: 'Send a reminder', paylink: 'Send a payment link', book: 'Book them', arrived: 'Mark arrived' };
    const row = x => `<div class="li todo"><span class="dot" style="background:var(--${x.level === 'ok' ? 'ok' : x.level === 'bad' ? 'bad' : x.level === 'warn' ? 'warn' : 'info'})"></span>
      <a class="grow" href="${x.href}"><b>${esc(x.title)}</b><span class="small muted">${esc(x.sub)}</span></a>
      ${x.act === 'forms' && A.consultBtn ? (x.booking.guestList || []).map((g, gi) => (x.booking.items || []).some(i => +i.guest === gi && i.start) && g.consult !== 'done' ? A.consultBtn(x.booking, gi) : '').join('') : x.act ? `<button class="btn sm" data-act="${x.act}" data-key="${esc(x.key)}">${ACT[x.act]}</button>` : ''}<button class="btn sm ghost" data-hide="${esc(x.key)}" title="Hide this until something changes">Hide</button></div>`;
    const html = `<div class="vh"><div><div class="eyebrow">Run the day</div><h1>To do</h1><p>Things that need someone’s attention, worked out from the bookings, and the team’s own tasks.</p></div><div class="acts"><button class="btn pri" id="tAdd">${A.ic.plus} Add a task</button></div></div>
      <div class="grid g-side">
        <div>${groups.length ? (() => { const cur = groups.includes(A._todoTab) ? A._todoTab : groups[0], worst = g => auto.some(x => x.group === g && x.level === 'bad') ? 'bad' : auto.some(x => x.group === g && x.level === 'warn') ? 'warn' : '';
          return `<div class="todo-tabs" role="tablist">${groups.map(g => `<button type="button" role="tab" class="${g === cur ? 'on' : ''}" data-ttab="${esc(g)}">${esc(g)} <span class="tt-n ${worst(g)}">${auto.filter(x => x.group === g).length}</span></button>`).join('')}</div>`
            + groups.map(g => `<div class="card todo-panel" data-tpanel="${esc(g)}" ${g === cur ? '' : 'hidden'}><div class="list">${auto.filter(x => x.group === g).map(row).join('')}</div></div>`).join(''); })() : '<div class="card"><div class="empty"><b>All clear</b>Nothing needs attention right now.</div></div>'}
          ${Object.keys(T.hidden).length ? `<p class="small muted" style="margin-top:10px">${Object.keys(T.hidden).length} hidden · <button class="btn sm ghost" id="unhide">Show hidden items again</button></p>` : ''}</div>
        <div><div class="card"><div class="card-h"><h3>Team tasks</h3><span class="badge">${mine.length}</span></div>
          ${mine.length ? `<div class="list">${mine.map(x => `<label class="li chk todo" style="cursor:pointer"><input type="checkbox" data-done="${x.id}"> <span class="grow"><b>${esc(x.text)}</b><span class="small muted">${x.due ? (x.due < t ? '<span style="color:var(--bad)">Overdue · ' : '') + fd(x.due) + (x.due < t ? '</span>' : '') : 'No date'}${x.who ? ' · ' + esc(A.sname(x.who)) : ''}${x.by ? ' · added by ' + esc(x.by) : ''}</span></span><button type="button" class="icon-btn" data-tdel="${x.id}" title="Delete">${A.ic.trash}</button></label>`).join('')}</div>` : '<p class="muted">No tasks. Add one for anything the team needs to remember, like ordering towels or a supplier call.</p>'}
          ${doneRecent.length ? `<div class="hr"></div><p class="small muted" style="margin-bottom:6px">Recently done</p>${doneRecent.map(x => `<div class="small muted" style="padding:3px 0"><s>${esc(x.text)}</s> · ${esc(x.doneBy || '')} ${ft(x.done)} <button class="btn sm ghost" data-undone="${x.id}">Undo</button></div>`).join('')}` : ''}</div></div>
      </div>`;
    return { html, wire: el => {
      const save = what => { A.change('tasks', null, what); A.refresh(); };
      $$('[data-ttab]', el).forEach(b => b.onclick = () => { A._todoTab = b.dataset.ttab; $$('[data-ttab]', el).forEach(x => x.classList.toggle('on', x === b)); $$('[data-tpanel]', el).forEach(p => p.hidden = p.dataset.tpanel !== b.dataset.ttab); });
      $('#tAdd', el).onclick = async () => {
        const r = await A.modal({ title: 'Add a task', body: `${A.f.text('text', 'What needs doing', '', { ph: 'e.g. Order more robes' })}<div class="row r2">${A.f.date('due', 'By (optional)', '')}${A.f.sel('who', 'For (optional)', '', [['', 'Anyone'], ...cfg.staff.map(s => [s.id, s.name])])}</div>`, ok: 'Add task', onOk: m => { const v = A.read(m); if (!v.text) throw new Error('Say what needs doing'); return v; } });
        if (!r) return; T.items.push({ id: uid('t'), text: r.text, due: r.due || '', who: r.who || '', at: new Date().toISOString(), by: St.S.user.name }); save('Task added: ' + r.text);
      };
      $$('[data-done]', el).forEach(c => c.onchange = () => { const x = T.items.find(i => i.id === c.dataset.done); x.done = new Date().toISOString(); x.doneBy = St.S.user.name; save('Task done: ' + x.text); });
      $$('[data-undone]', el).forEach(b => b.onclick = () => { const x = T.items.find(i => i.id === b.dataset.undone); delete x.done; delete x.doneBy; save('Task reopened: ' + x.text); });
      $$('[data-tdel]', el).forEach(b => b.onclick = e => { e.preventDefault(); const x = T.items.find(i => i.id === b.dataset.tdel); T.items = T.items.filter(i => i !== x); save('Task deleted: ' + x.text); });
      $$('[data-hide]', el).forEach(b => b.onclick = () => { T.hidden[b.dataset.hide] = new Date().toISOString(); save(''); A.toast('Hidden. It comes back if something changes.', () => { delete T.hidden[b.dataset.hide]; save(''); }); });
      const uh = $('#unhide', el); if (uh) uh.onclick = () => { T.hidden = {}; save('Hidden to-dos shown again'); };
      $$('[data-act]', el).forEach(b => b.onclick = async () => {
        const x = auto.find(i => i.key === b.dataset.key), bk = x && x.booking;
        if (b.dataset.act === 'book') { location.hash = x.href; return; }
        if (!bk) return;
        if (b.dataset.act === 'resend' || b.dataset.act === 'paylink') return A.payLinkDialog(bk);
        if (b.dataset.act === 'arrived') { bk.arrived = true; bk.arrivedAt = bk.arrivedAt || null; (bk.history = bk.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: 'Marked as arrived (afterwards)' }); A.change('booking', bk, 'Arrived: ' + bk.ref); A.refresh(); }
      });
    } };
  };
})();
