/* On the day (user 2026-11-27):
   - each guest can be marked as here, or as not coming. A guest who doesn't come has their treatments set aside
     (b.releasedItems) so the therapist and room are free again; undoing it puts them back if the times are still free.
   - a guest who's here can book another treatment there and then: it's added to the bill at full price (b.dayTreats)
     and booked into a free time with a therapist who can do it.
   - Arrivals asks who's here when a booking has more than one guest. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, fd, today, uid, gbp } = A;
  const gname = (b, g) => ((b.guestList || [])[g] || {}).name || (g === 0 ? A.cust(b) : 'Guest ' + (g + 1));
  const log = (b, what) => (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what });

  // here / not coming / not recorded, for one guest
  A.setGuestShow = (b, g, state, at) => {
    const gl = b.guestList[g] = b.guestList[g] || {}, cfg = A.cfg(), t = today();
    const was = gl.noShow ? 'no' : gl.arrived ? 'here' : null; if (was === state && !(state === 'here' && at)) return { ok: true };
    let kept = 0, lost = [];
    if (state === 'no') {   // set their treatments (today and later) aside
      const mine = (b.items || []).filter(i => +i.guest === +g && (i.date || b.date) >= t);
      b.releasedItems = (b.releasedItems || []).concat(mine); b.items = (b.items || []).filter(i => !mine.includes(i));
    } else if (was === 'no') {   // coming after all: put their treatments back if the times are still free
      const back = (b.releasedItems || []).filter(i => +i.guest === +g);
      const ix = E.index(cfg, A.DB().bookings, b.id);
      for (const it of back) { if (!E.itemCheck(cfg, ix, b, it, { date: it.date || b.date, start: it.start, staff: it.staff, troom: it.troom })) { b.items.push(it); kept++; } else lost.push(it); }
      b.releasedItems = (b.releasedItems || []).filter(i => !back.includes(i) || lost.includes(i));
    }
    gl.noShow = state === 'no'; gl.arrived = state === 'here'; if (state === 'here') gl.arrivedAt = at || gl.arrivedAt || new Date().toISOString(); else delete gl.arrivedAt;
    const all = b.guestList.slice(0, b.guests || b.guestList.length);
    b.arrived = all.some(x => x && x.arrived); const firstIn = all.filter(x => x && x.arrived && x.arrivedAt).map(x => x.arrivedAt).sort()[0]; b.arrivedAt = b.arrived ? (firstIn || b.arrivedAt || new Date().toISOString()) : null;
    b.noShow = all.length > 0 && all.every(x => x && x.noShow);
    log(b, state === 'no' ? `${gname(b, g)} didn’t come${(b.releasedItems || []).some(i => +i.guest === +g) ? ': their treatments were released' : ''}` : state === 'here' ? `${gname(b, g)} arrived` : `${gname(b, g)}’s arrival cleared`);
    b.quote = E.quote(cfg, b);
    A.change('booking', b, `Guest ${state === 'no' ? 'not coming' : state === 'here' ? 'arrived' : 'arrival cleared'}: ${b.ref}`);
    return { ok: true, kept, lost };
  };
  A.guestShowButtons = (b, g) => {
    const gl = (b.guestList || [])[g] || {}, st = gl.noShow ? 'no' : gl.arrived ? 'here' : '';
    return `${gl.arrived ? `<button type="button" class="btn sm ghost g-at" data-garrt="${g}" title="Change when they arrived">arrived ${A.arrivedTime(b, g) || '—'}</button>` : ''}<span class="seg gshow" role="group" aria-label="Has ${esc(gname(b, g))} arrived?"><button type="button" class="${st === 'here' ? 'on' : ''}" data-gshow="${g}|here">✓ Here</button><button type="button" class="${st === 'no' ? 'on bad' : ''}" data-gshow="${g}|no">Not coming</button></span>`;
  };
  A.wireGuestShow = (el, b) => { $$('[data-garrt]', el).forEach(x => x.onclick = () => A.editArrival(b, +x.dataset.garrt)); wireShow(el, b); };
  const wireShow = (el, b) => $$('[data-gshow]', el).forEach(x => x.onclick = async () => {
    const [g, s] = x.dataset.gshow.split('|'), gl = b.guestList[+g] || {}, cur = gl.noShow ? 'no' : gl.arrived ? 'here' : '';
    const want = cur === s ? null : s;
    if (want === 'no' && (b.items || []).some(i => +i.guest === +g && (i.date || b.date) >= today())) {
      if (!(await A.confirm(`${esc(gname(b, +g))} isn’t coming?`, 'Their treatments are released so the therapist and room are free again. Nothing is refunded automatically. You can undo this.', 'Yes, not coming', true))) return; }
    const r = A.setGuestShow(b, +g, want);
    if (r.lost && r.lost.length) A.toast(`${r.lost.length} treatment${r.lost.length > 1 ? 's' : ''} couldn’t go back (the time has been taken): add ${r.lost.length > 1 ? 'them' : 'it'} again with Add a treatment`);
    else A.toast(want === 'no' ? 'Marked as not coming' : want === 'here' ? 'Marked as here' : 'Cleared');
    A.refresh(); });

  const defaultArrive = b => { const t = today(); if (b.date === t) { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } return E.arriveAt ? (E.arriveAt(A.cfg(), b) || '10:00') : '10:00'; };
  const atISO = (date, hm) => new Date(`${date}T${hm}:00`).toISOString();
  const hmOf = iso => { if (!iso) return ''; const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  A.arrivedTime = (b, g) => hmOf(((b.guestList || [])[g] || {}).arrivedAt);
  // change when a guest arrived
  A.editArrival = async (b, g) => {
    const r = await A.modal({ title: `When did ${esc(gname(b, g))} arrive?`, ok: 'Save', body: `${A.f.time('t', 'Arrived at', A.arrivedTime(b, g) || defaultArrive(b))}<p class="small muted" style="margin-top:6px">${fd(b.date)}</p>`, onOk: m => { const v = A.read(m); if (!/^\d\d:\d\d$/.test(v.t || '')) throw new Error('Choose a time'); return v.t; } });
    if (!r) return; A.setGuestShow(b, g, 'here', atISO(b.date, r)); A.toast('Arrival time saved'); A.refresh(); };
  // Arrivals: who's here? (bookings with more than one guest)
  A.whoIsHere = async b => {
    const n = b.guests || (b.guestList || []).length;
    const r = await A.modal({ title: 'Who’s here?', ok: 'Save', body: `<p class="muted" style="margin-bottom:10px">${esc(A.cust(b))} · ${b.ref}. Untick anyone who hasn’t come: their treatments are released.</p>
      <div class="who-list">${Array.from({ length: n }, (_, g) => `<label class="chk who"><input type="checkbox" data-who="${g}" ${((b.guestList || [])[g] || {}).noShow ? '' : 'checked'}> <span>${esc(gname(b, g))}</span></label>`).join('')}</div>
      <div style="height:12px"></div>${A.f.time('t', 'Arrived at', defaultArrive(b))}<p class="small muted" style="margin-top:6px">${b.date === today() ? 'Change it if they arrived earlier.' : 'Recorded after the day, so set the time they actually arrived.'}</p>`,
      onOk: m => { const v = A.read(m); if (!/^\d\d:\d\d$/.test(v.t || '')) throw new Error('Choose the time they arrived'); return { here: $$('[data-who]', m).map(x => x.checked), t: v.t }; } });
    if (!r) return false;
    r.here.forEach((here, g) => A.setGuestShow(b, g, here ? 'here' : 'no', here ? atISO(b.date, r.t) : null));
    A.toast(r.here.every(Boolean) ? 'Everyone’s here' : `${r.here.filter(Boolean).length} of ${r.here.length} here`); A.refresh(); return true;
  };

  // add a treatment there and then
  A.addTreatmentNow = async (b, g) => {
    const cfg = A.cfg(), t = today(), step = cfg.rules.slotStep || 15;
    const wins = E.windows(cfg, b).filter(w => w[0] >= t); const days = wins.length ? wins : [[t, '09:00', '18:00']];
    const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
    const trs = (cfg.treatments || []).filter(x => x.active !== false && x.sell !== false && +x.price > 0);
    if (!trs.length) { A.toast('No treatments are set up to sell'); return; }
    const slots = (tid, date, pref) => { const tr = E.tr(cfg, tid), ix = E.index(cfg, A.DB().bookings, b.id), w = days.find(x => x[0] === date); if (!tr || !w) return [];
      const it = { key: 'new', guest: g, tid, min: tr.min, buffer: tr.buffer || 0, date }, out = [];
      const staff = cfg.staff.filter(s => s.active !== false && E.canDo(s, tid) && (!pref || s.id === pref));
      for (let m = Math.ceil(Math.max(E.T(w[1]), date === t ? nowM + 5 : 0) / step) * step; m + tr.min <= E.T(w[2]); m += step) {
        for (const s of staff) { const r = cfg.treatRooms.find(r => !E.itemCheck(cfg, ix, b, it, { date, start: E.HM(m), staff: s.id, troom: r.id })); if (r) { out.push([E.HM(m), s.id, r.id]); break; } } }
      return out; };
    const res = await A.modal({ title: 'Add a treatment for ' + esc(gname(b, g)), size: 'wide', ok: 'Add the treatment',
      body: `<div class="row r2">${A.f.sel('tid', 'Treatment', trs[0].id, trs.map(x => [x.id, `${x.name} · ${x.min} min · ${gbp(x.price)}`]))}
        ${days.length > 1 ? A.f.sel('date', 'Day', days[0][0], days.map(w => [w[0], fd(w[0])])) : `<input type="hidden" data-k="date" value="${days[0][0]}">`}</div><div style="height:10px"></div>
        <div class="row r2">${A.f.sel('pref', 'Therapist', '', [['', 'Whoever is free'], ...cfg.staff.filter(s => s.active !== false).map(s => [s.id, s.name])])}<label class="fld"><span>Free times</span><select class="inp" data-k="slot" id="atSlot"></select></label></div>
        <p class="small muted" id="atMsg" style="margin-top:8px"></p><p class="small muted">It’s added to the bill at full price. Take payment now from the booking page, or when they leave.</p>`,
      onOpen: m => { const fill = () => { const v = A.read(m), list = slots(v.tid, v.date, v.pref);
          $('#atSlot', m).innerHTML = list.map(([tm, s, r]) => `<option value="${tm}|${s}|${r}">${tm} · ${esc(A.sname(s))} · ${esc((cfg.treatRooms.find(x => x.id === r) || {}).name || '')}</option>`).join('');
          $('#atMsg', m).textContent = list.length ? `${list.length} free time${list.length > 1 ? 's' : ''}${v.date === t ? ' left today' : ''}.` : 'No free times with a therapist who can do this. Try another treatment, day or therapist.'; };
        $$('[data-k=tid],[data-k=date],[data-k=pref]', m).forEach(x => x.onchange = fill); fill(); },
      onOk: m => { const v = A.read(m); if (!v.slot) throw new Error('No free time chosen'); const [start, staff, troom] = v.slot.split('|'); return { ...v, start, staff, troom }; } });
    if (!res) return;
    const tr = E.tr(cfg, res.tid), n = (b.dayTreats || []).length, key = `g${g}-d${n}-${uid('').slice(-4)}`;
    (b.dayTreats = b.dayTreats || []).push({ key, guest: g, tid: res.tid, price: +tr.price, at: new Date().toISOString(), by: St.S.user.name });
    (b.items = b.items || []).push({ key, guest: g, tid: res.tid, min: tr.min, buffer: tr.buffer || 0, start: res.start, staff: res.staff, troom: res.troom, date: res.date, dayAdd: true });
    const q = E.quote(cfg, b); if (q) b.quote = q;
    log(b, `${tr.name} added for ${gname(b, g)} at ${res.start} with ${A.sname(res.staff)} (${gbp(tr.price)})`);
    A.change('booking', b, `Treatment added on the day: ${b.ref}`);
    const owe = (b.quote.total || 0) - E.paid(b);
    A.toast(`${tr.name} added at ${res.start}${owe > 0.009 ? ` · ${gbp(owe, 2)} to pay` : ''}`); A.refresh();
  };
})();
