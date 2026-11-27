/* Consultation forms in the portal (form builder and hand-over mode: user 2026-11-27).
   - Forms: several forms, each for some treatments or for all. A guest gets the forms for their treatments, combined.
   - Before the visit: the guest's email links to the online form (when the online form is switched on).
   - On the day: Consultation forms (Run the day) lists each guest with their form status; the therapist taps a guest,
     hands over the tablet, the guest fills it in full-screen, then it asks to be handed back for the next guest.
   Answers are encrypted on the device as soon as they're submitted. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore, C = window.YCConsult;
  const { $, $$, esc, fd, fdy, ft, today, uid } = A;
  const cc = () => { const c = A.cfg(); c.consult = c.consult || { questions: null, endpoint: '', retentionMonths: 24, publicKey: null }; C.forms(c.consult); return c.consult; };
  A.consultCfg = cc;
  const token = b => { if (!b.consultToken) { b.consultToken = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8); A.change('booking', b); } return b.consultToken; };
  // the guest's own link (only when the online form is set up); it says which forms each guest needs
  A.consultURL = b => { const c = cc(); return c.endpoint && c.publicKey ? A.siteURL() + `consult.html?ref=${encodeURIComponent(b.ref)}&t=${token(b)}&f=${encodeURIComponent(C.linkForms(c, b))}` : ''; };
  const guestName = (b, g) => ((b.guestList || [])[g] || {}).name || (g === 0 ? A.cust(b) : 'Guest ' + (g + 1));
  const guestForms = (b, g) => C.formsFor(cc(), C.guestTreatments(b, g));
  const guestQs = (b, g) => C.questionsFor(cc(), guestForms(b, g));
  A.consultFormsFor = guestForms;
  // forms still to do today: each guest with a treatment today, once per booking (a therapist: only their own guests)
  A.consultsToDo = () => { const t = today(), me = A.myStaff(); let n = 0;
    for (const b of A.DB().bookings) { if (!E.live(b) || !(b.items || []).some(i => (i.date || b.date) === t && i.start)) continue;
      for (let g = 0; g < Math.max(1, +b.guests || 1); g++) { const its = (b.items || []).filter(i => +i.guest === g && i.start && (i.date || b.date) === t); if (!its.length) continue;
        if (me && !its.some(i => i.staff === me)) continue; if (((b.guestList || [])[g] || {}).noShow) continue; if (((b.guestList || [])[g] || {}).consult !== 'done') n++; } }
    return n; };
  // one form per guest per booking (user 2026-11-27): "Hand to" only on the guest's first treatment of the booking
  A.firstItemOf = (b, g) => (b.items || []).filter(i => +i.guest === +g && i.start).sort((x, y) => ((x.date || b.date) + x.start).localeCompare((y.date || b.date) + y.start))[0];
  // demo: make every sample form once, in the background, so flag counts show on the buttons
  let demoAll = null;
  A.ensureDemoFormsAll = () => { if (St.S.mode !== 'demo' || demoAll) return; demoAll = (async () => { for (const b of A.DB().bookings) { if ((b.guestList || []).some(g => g && g.consult === 'done' && g.flags == null)) { try { await ensureDemoForms(b); } catch (e) {} } } A.refresh(); })(); };
  A.consultBtn = (b, g, cls = 'sm', itemKey) => (A.ensureDemoFormsAll && setTimeout(A.ensureDemoFormsAll, 300), 0) || (((b.guestList || [])[g] || {}).noShow ? '' : consultBtn1(b, g, cls, itemKey));
  const consultBtn1 = (b, g, cls, itemKey) => (((b.guestList || [])[g] || {}).consult !== 'done' && itemKey && (A.firstItemOf(b, g) || {}).key !== itemKey) ? '' : ((b.guestList || [])[g] || {}).consult === 'done'
    ? `<button type="button" class="btn ${cls} cbtn" data-cview="${b.id}|${g}">${A.ic.log} View consultation${+((b.guestList || [])[g] || {}).flags > 0 ? ` <span class="cflag" title="${b.guestList[g].flags} answer${b.guestList[g].flags > 1 ? 's' : ''} to check before the treatment">⚑ ${b.guestList[g].flags}</span>` : ''}</button>`
    : `<button type="button" class="btn ${cls} pri cbtn" data-chand="${b.id}|${g}">Hand to ${esc((guestName(b, g) || 'guest').split(' ')[0])}</button>`;
  // buttons shown inside pop-ups (e.g. the calendar's booking details)
  document.addEventListener('click', e => { const x = e.target.closest('[data-chand],[data-cview]'); if (!x || x.onclick) return; const v = x.dataset.chand || x.dataset.cview; if (!v || !v.includes('|')) return;
    e.preventDefault(); const [id, g] = v.split('|'), b = A.DB().bookings.find(y => y.id === id); if (!b) return; const ov = x.closest('.ov'); if (ov) ov.querySelector('[data-x]')?.click(); x.dataset.chand ? A.handOver(b, +g) : A.viewConsults(b, +g); });
  A.wireConsultBtns = el => { const DB = A.DB(), get = s => { const [id, g] = s.split('|'); return [DB.bookings.find(x => x.id === id), +g]; };
    $$('[data-chand]', el).forEach(x => x.onclick = e => { e.preventDefault(); e.stopPropagation(); const [b, g] = get(x.dataset.chand); if (b) A.handOver(b, g); });
    $$('[data-cview]', el).forEach(x => { if (!x.dataset.cview.includes('|')) return; x.onclick = e => { e.preventDefault(); e.stopPropagation(); const [b, g] = get(x.dataset.cview); if (b) A.viewConsults(b, g); }; }); };
  if (!document.getElementById('consult-css')) { const st = document.createElement('style'); st.id = 'consult-css'; st.textContent = C.css; document.head.appendChild(st); }
  const needKey = async () => { if (cc().publicKey) return false; if (await A.confirm('Set up the form first', 'The consultation form needs its encryption key. Create it now in Settings → Consultation forms?', 'Go to Settings', false)) location.hash = '#/settings/consult'; return true; };
  const custRec = email => { const DB = A.DB(), e = String(email || '').toLowerCase(); const k = Object.keys(DB.customers || {}).find(x => x.toLowerCase() === e); return (k && DB.customers[k]) || {}; };
  // the form's marketing tick (user 2026-11-27): ticked adds the guest as a customer who gets news and offers; unticked takes them off
  A.consultOptin = (o, by) => { if (!o || !o.email || !C.validEmail(o.email)) return;
    const DB = A.DB(); DB.customers = DB.customers || {}; const k = Object.keys(DB.customers).find(x => x.toLowerCase() === o.email) || o.email;
    const c = DB.customers[k] = DB.customers[k] || { marketing: false, notes: '', tags: [] }, was = !!c.marketing;
    if (!c.name && o.name) { c.name = o.name; c.first = o.name.split(' ')[0]; c.last = o.name.split(' ').slice(1).join(' '); c.source = 'Consultation form'; }
    if (o.yes) { c.marketing = true; delete c.unsubscribedAt; c.optedInAt = c.optedInAt || new Date().toISOString(); } else if (was) { c.marketing = false; }
    if (was !== !!c.marketing || !was && o.yes) A.change('customers', null, `${o.yes ? 'Opted in to' : 'Opted out of'} news and offers on the consultation form (${by || 'tablet'})`); };
  const save = async (b, g, v, via) => {
    A.consultOptin(v.optin, via);
    const sealed = await C.seal(cc().publicKey, v.answers); await St.saveConsult(b, g, sealed, via);
    b.guestList[g] = b.guestList[g] || {}; b.guestList[g].consult = 'done'; b.guestList[g].flags = C.flags(v.answers.questions, v.answers.a).length; if (v.answers.name && !b.guestList[g].name && g > 0) b.guestList[g].name = v.answers.name;
    (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: `Consultation form completed ${via === 'tablet' ? 'on the tablet' : ''} for ${guestName(b, g)}` });
    A.change('booking', b, 'Consultation form: ' + b.ref);
  };

  // fill in on a tablet, from the booking page
  A.fillConsult = async (b, g) => A.handOver(b, g);

  // hand-over mode: full screen, just the form; then "please hand the tablet back"
  A.handOver = async (b, g, after, prev) => {
    if (await needKey()) return;
    const qs = guestQs(b, g), forms = guestForms(b, g), first = (guestName(b, g) || '').split(' ')[0];
    const ov = document.createElement('div'); ov.className = 'kiosk'; document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const close = () => { ov.remove(); document.body.style.overflow = ''; if (after) after(); else A.refresh(); };
    const formStep = () => {
      const { intro, rest: fqs } = C.splitIntro(qs);
      const its = (b.items || []).filter(i => +i.guest === +g && i.start).sort((x, y) => ((x.date || b.date) + x.start).localeCompare((y.date || b.date) + y.start));
      const tname = id => ((A.cfg().treatments || []).find(t => t.id === id) || {}).name || id;
      ov.innerHTML = `<header class="kiosk-top"><span class="k-brand"><svg viewBox="0 0 760 500" width="34" fill="none" stroke="currentColor" stroke-width="30" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M160 190 L160 45 C215 62 268 92 305 132"/><path d="M600 190 L600 45 C545 62 492 92 455 132"/><path d="M380 25 C455 115 515 215 515 325 C515 415 455 470 380 485 C305 470 245 415 245 325 C245 215 305 115 380 25 Z" stroke="#d9a37f"/><path d="M10 180 C150 172 290 212 345 300 C368 337 380 360 380 385 L380 488 C235 488 125 455 82 382 C52 330 27 258 10 180 Z"/><path d="M750 180 C610 172 470 212 415 300 C392 337 380 360 380 385 L380 488 C525 488 635 455 678 382 C708 330 733 258 750 180 Z"/></svg><span><b>York Cottage</b><small>Consultation form</small></span></span>
          <span class="k-prog cq-prog" data-short="1"><i></i><span>0%</span></span>
          <button type="button" class="k-cancel" data-x>✕ Cancel</button></header>
        <div class="kiosk-in"><section class="k-hero"><div class="kiosk-hello">Hello${first ? ' ' + esc(first) : ''}</div>
          ${intro ? `<div class="kiosk-sub k-intro">${esc(intro.help || intro.label).split(String.fromCharCode(10)).filter(x => x.trim()).map(x => `<p>${x}</p>`).join('')}</div>` : `<p class="kiosk-sub">A few quick questions so your therapist can make your treatment safe and just right for you. It takes about three minutes${g === 0 && (b.customer || {}).email ? ', and we’ve filled in what we already know' : ''}.</p>`}
          ${its.length ? `<div class="k-chips">${its.map(i => `<span>${esc(tname(i.tid))} · ${i.start}</span>`).join('')}</div>` : ''}</section>
        ${C.formHTML(fqs, { name: ((b.guestList || [])[g] || {}).name || (g === 0 ? A.cust(b) : ''), consent: cc().consentText, prefill: g === 0 ? { email: (b.customer || {}).email || '', phone: (b.customer || {}).phone || '', optin: !!custRec((b.customer || {}).email).marketing } : {} })}
        <div class="k-foot"><p class="kiosk-lock">🔒 Your answers are encrypted on this tablet and only York Cottage can read them.</p><button class="btn pri k-send" id="kGo">Send my answers →</button></div></div>`;
      C.wireForm(ov, qs); if (prev) C.fillForm(ov, qs, prev); ov.scrollTop = 0;
      $('[data-x]', ov).onclick = async () => { if (await A.modal(prev ? { title: 'Cancel your changes?', body: '<p>The form stays as it was before.</p>', ok: 'Yes, cancel changes', cancel: 'Keep editing', danger: true } : { title: 'Cancel this form?', body: '<p>Nothing has been saved. You can start it again from the list.</p>', ok: 'Yes, cancel the form', cancel: 'Keep going', danger: true })) close(); };
      $('#kGo', ov).onclick = async e => { const v = C.readForm(ov, qs), msg = $('.cq-msg', ov);
        if (!v.ok) { msg.textContent = v.msg; return; }
        e.target.disabled = true; e.target.textContent = 'Saving…';
        try { await save(b, g, v, 'tablet'); doneStep(C.flags(qs, v.answers.a)); } catch (err) { e.target.disabled = false; e.target.textContent = 'Send my answers'; msg.textContent = 'That didn’t save: ' + err.message; } };
    };
    const doneStep = (flags) => {
      ov.innerHTML = `<div class="kiosk-in kiosk-done"><div class="kiosk-tick">✓</div><div class="kiosk-hello">Thank you${first ? ', ' + esc(first) : ''}</div><p class="kiosk-sub">Please hand the tablet back to your therapist.</p>
        <button class="btn kiosk-back" id="kBack">Continue</button></div>`;
      $('#kBack', ov).onclick = () => {
        ov.innerHTML = `<div class="kiosk-in kiosk-done"><div class="kiosk-hello" style="font-size:34px">${esc(guestName(b, g))}’s form is saved</div>
          ${flags.length ? `<div class="note warn" style="text-align:center;margin:16px 0"><b>Check before the treatment:</b> ${flags.map(esc).join(' · ')}</div>` : '<div class="note ok" style="margin:16px 0">Nothing flagged</div>'}
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn" id="kView">Read the answers</button><button class="btn pri" id="kList">Back to the list</button></div></div>`;
        $('#kList', ov).onclick = close; $('#kView', ov).onclick = async () => { close(); A.viewConsults(b, g); };
      };
    };
    formStep();
  };

  // demo only (user 2026-11-27): guests marked as done get a realistic filled-in form the first time it's opened
  const rnd = seed => { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; };
  const sigImage = name => { const cv = document.createElement('canvas'); cv.width = 900; cv.height = 260; const cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(0,0,0,0)'; cx.fillRect(0, 0, 900, 260); cx.fillStyle = '#1d2a22'; cx.font = 'italic 86px "Segoe Script","Brush Script MT","Lucida Handwriting",cursive'; cx.textBaseline = 'middle';
    cx.save(); cx.translate(60, 140); cx.rotate(-0.04); cx.fillText(name, 0, 0); cx.restore();
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="260"><text x="50" y="160" font-family="Segoe Script, Brush Script MT, cursive" font-style="italic" font-size="84" fill="#1d2a22" transform="rotate(-2 450 130)">${esc(name)}</text></svg>`))); };
  const sampleForm = (b, g) => {
    const r = rnd(b.id + '|' + g), pick = a => a[Math.floor(r() * a.length)], qs = guestQs(b, g), name = guestName(b, g), a = {};
    const yesOdds = { allergies: .18, back: .12, meds: .2, pain: .15, anxiety: .12, skin: .06, arthritis: .05, bruising: .07, surgery: .04 };
    const details = { allergies: pick(['Nut allergy (peanuts)', 'Allergic to lavender oil', 'Sensitive to latex']), back: pick(['Lower back stiffness from desk work', 'Old disc injury, please go gently on the lower back']), meds: pick(['Antihistamines for hay fever', 'Blood pressure tablets (amlodipine)', 'The contraceptive pill']), pain: 'Tension in my neck and shoulders', anxiety: 'Mild, I prefer a quiet room', skin: 'Eczema on my hands', arthritis: 'Some arthritis in my knees', bruising: 'Small bruise on my left shin', surgery: 'Knee surgery about two years ago' };
    const said = [];
    for (const q of qs) {
      if (q.type === 'yesno') { const y = r() < (yesOdds[q.id] || 0); a[q.id] = { yes: y, detail: y && q.detail ? (details[q.id] || 'Please be gentle') : '' }; if (y && details[q.id]) said.push(details[q.id]); }
      else if (q.type === 'choice') a[q.id] = q.id === 'pregnant' ? 'No' : q.id === 'gender' ? pick(['Female', 'Female', 'Female', 'Male', 'Other / Prefer not to say']) : q.id === 'massage_before' ? pick(['Yes', 'Yes', 'No']) : q.id === 'stress' || q.id === 'energy' ? pick(['Low', 'Medium', 'Medium', 'High']) : pick(q.options || ['']);
      else if (q.type === 'multi') a[q.id] = (q.options || []).filter(() => r() < .35);
      else if (q.type === 'optin') a[q.id] = r() < .45;
      else if (q.fill === 'email') a[q.id] = g === 0 ? ((b.customer || {}).email || '') : name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com';
      else if (q.fill === 'phone') { const ph = C.splitPhone(g === 0 ? ((b.customer || {}).phone || '') : '07700 9' + String(Math.floor(r() * 90000) + 10000)); a[q.id] = ph.num ? ph.code + ' ' + ph.num : ''; }
      else if (q.id === 'gp') a[q.id] = pick(['Dr Patel, Bozeat Surgery', 'Dr Hughes, Wollaston Surgery', 'Dr Okafor, Rushden Medical Centre', 'Dr Wright, Olney Health Centre']);
      else if (q.id === 'details') a[q.id] = said.join('. ');
      else if (q.id === 'other') a[q.id] = r() < .85 ? 'None' : 'Occasional migraines';
      else if (q.type === 'date') a[q.id] = '';
      else if (q.type === 'text' || q.type === 'short') a[q.id] = '';
    }
    const y = 1958 + Math.floor(r() * 42), dob = `${y}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`;
    const online = r() < .55, at = new Date((b.date || today()) + 'T' + (online ? '19:' : '09:') + String(10 + Math.floor(r() * 49)) + ':00'); if (online) at.setDate(at.getDate() - 1 - Math.floor(r() * 4));
    return { via: online ? 'online' : 'tablet', at: at.toISOString(), answers: { name, dob, a, consent: true, sign: name, sigImg: sigImage(name), signedAt: at.toISOString(), questions: qs } };
  };
  const ensureDemoForms = async b => {
    if (St.S.mode !== 'demo') return;
    const c = cc(); if (!c.publicKey) { c.publicKey = await St.makeConsultKey(); A.change('cfg'); }
    const have = await St.listConsults(b), gs = (b.guestList || []).map((x, g) => g).filter(g => ((b.guestList[g] || {}).consult === 'done') && !have.some(h => +h.g === g));
    for (const g of gs) { const f = sampleForm(b, g); b.guestList[g].flags = C.flags(f.answers.questions, f.answers.a).length; A.change('booking', b); await St.saveConsult(b, g, await C.seal(c.publicKey, f.answers), { via: f.via }); const recs = St.S.DB.consults || []; const last = recs[recs.length - 1]; if (last) last.at = f.at; }
  };

  // read completed forms
  // a "loading" screen while the forms are fetched and opened (they can take a moment) (user 2026-11-27)
  const loading = on => { let l = document.getElementById('cLoad'); if (!on) { if (l) l.remove(); return; }
    if (!l) { l = document.createElement('div'); l.id = 'cLoad'; l.className = 'cload'; l.innerHTML = '<div class="cload-b"><span class="cload-s"></span><b>Opening the form…</b><small>Unlocking the answers securely</small></div>'; document.body.appendChild(l); } };
  A.viewConsults = async (b, g) => { loading(true); try { return await viewConsults(b, g); } finally { loading(false); } };
  const viewConsults = async (b, g) => {
    try { await ensureDemoForms(b); } catch (e) { console.warn(e); }
    let list = []; try { list = await St.listConsults(b); } catch (e) { A.toast('Couldn’t load the forms: ' + e.message); return; }
    if (g != null) list = list.filter(x => +x.g === +g || x.g === 'all');
    if (!list.length) { A.toast('No form yet' + (g != null ? ' for ' + guestName(b, g) : '')); return; }
    const key = await St.consultKey().catch(() => null);
    if (!key) { A.toast('This login can’t open forms yet. The owner creates the key in Settings → Consultation forms.'); return; }
    const opened = [];
    for (const x of list) { try { opened.push({ x, f: await C.open(key, x.sealed) }); } catch (e) { opened.push({ x, err: true }); } }
    { let ch = false; for (const o of opened) { if (o.err || o.x.g === 'all') continue; const gi = +o.x.g, n = C.flags(o.f.questions, o.f.a).length; b.guestList[gi] = b.guestList[gi] || {}; if (b.guestList[gi].flags !== n) { b.guestList[gi].flags = n; ch = true; } } if (ch) { A.change('booking', b); setTimeout(() => A.refresh(), 0); } }
    const show = ({ x, f, err }, i, all) => err ? `<div class="note bad">A form from ${ft(x.at)} couldn’t be opened (it was made with an older key).</div>` : `<div class="card" style="margin-bottom:12px">
      <div class="card-h"><h3>${esc(f.name)}${x.old ? ' <span class="badge">Earlier version</span>' : ''}</h3><span class="ca-hr"><span class="small muted">${x.via === 'online' ? 'Online, before the visit' : 'On the tablet'}${x.edited ? ' · corrected' : ''} · ${ft(f.signedAt || x.at)}</span>${!x.old && x.g !== 'all' && b.status !== 'cancelled' ? `<button type="button" class="btn sm" data-cedit="${i}">✎ Edit answers</button>` : ''}</span></div>
      ${C.flags(f.questions, f.a).length ? `<div class="note warn" style="margin-bottom:10px"><b>Check before the treatment:</b> ${C.flags(f.questions, f.a).map(esc).join(' · ')}</div>` : '<div class="note ok" style="margin-bottom:10px">Nothing flagged</div>'}
      <div class="ca">${[['Date of birth', f.dob ? new Date(f.dob + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—']].map(([q, a]) => `<div class="ca-r"><span>${q}</span><b>${esc(a)}</b></div>`).join('')}
        ${(f.questions || []).map(q => { if (q.type === 'heading') return `<div class="ca-h">${esc(q.label)}</div>`; if (q.type === 'info') return q.terms || q.id === 'consent_text' ? `<div class="ca-r ${f.consent ? 'ok' : 'flag'}"><span>Agreed to the ${esc((q.label || 'terms and conditions').toLowerCase())}</span><b>${f.consent ? '✓ Agreed' : 'Not agreed'}</b></div>` : '';
          const a = (f.a || {})[q.id], flag = C.flags([q], f.a || {}).length; return `<div class="ca-r ${flag ? 'flag' : ''}"><span>${esc(q.label)}</span><b>${flag ? '⚑ ' : ''}${esc(C.answerText(q, a))}</b></div>`; }).join('')}
        <div class="ca-r ${f.consent ? 'ok' : ''}"><span>Confirmed the information is correct</span><b>${f.consent ? '✓ Yes' : '—'}</b></div><div class="ca-h">Signed</div><div class="ca-r"><span>Signed by ${esc(f.sign)}</span><b>${ft(f.signedAt || x.at)}</b></div>
        ${f.sigImg ? `<img class="ca-sig" src="${f.sigImg}" alt="Signature of ${esc(f.sign)}">` : ''}</div></div>`;
    St.audit(`Consultation form viewed: ${b.ref}`, b.ref); St.touch('audit');
    // newest first for each guest; earlier versions (before a correction) are kept underneath
    opened.sort((p, q) => (+p.x.g - +q.x.g) || String((q.f || {}).signedAt || q.x.at).localeCompare(String((p.f || {}).signedAt || p.x.at)));
    const seenG = new Set(); opened.forEach(o => { const k = String(o.x.g); if (seenG.has(k)) o.x.old = true; else { seenG.add(k); o.x.edited = opened.some(p => p !== o && String(p.x.g) === k); } });
    const cur = opened.filter(o => !o.x.old), old = opened.filter(o => o.x.old);
    loading(false);
    const r = await A.modal({ title: 'Consultation form' + (cur.length > 1 ? 's' : ''), size: 'wide', ok: 'Close', cancel: '', foot: '<button class="btn" onclick="print()" style="margin-right:auto">Print</button>',
      body: `<p class="small muted">${esc(A.cust(b))} · ${b.ref} · ${fdy(b.date)}. Health information: keep it private, and don’t copy it into notes.</p>${opened.map((o, i) => o.x.old ? '' : show(o, i)).join('')}
        ${old.length ? `<details class="ca-old"><summary>Earlier version${old.length > 1 ? 's' : ''} (${old.length}), before ${old.length > 1 ? 'corrections' : 'a correction'}</summary>${opened.map((o, i) => o.x.old ? show(o, i) : '').join('')}</details>` : ''}`,
      onOpen: (m, close) => $$('[data-cedit]', m).forEach(x => x.onclick = () => close({ edit: +x.dataset.cedit })) });
    if (r && r.edit != null) { const o = opened[r.edit]; A.handOver(b, +o.x.g, null, o.f); }
  };

  // ---------- Run the day → Consultation forms: each guest with treatments on a day, and their form ----------
  A.views.consults = (dArg) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dArg || '') ? dArg : today(), me = A.myStaff(), mineOnly = !!me && (A.isTher() || (A.consultMine !== false));
    const DB = A.DB(), add = d => { const x = new Date(date + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
    const rows = [];
    for (const b of DB.bookings.filter(x => x.date === date && E.live(x))) {
      const n = Math.max(1, +b.guests || 1);
      for (let g = 0; g < n; g++) {
        const its = (b.items || []).filter(i => +i.guest === g && i.start); if (!its.length) continue;
        if (mineOnly && !its.some(i => i.staff === me)) continue;
        const st = ((b.guestList || [])[g] || {}).consult;
        rows.push({ b, g, start: its.map(i => i.start).sort()[0], its, st });
      }
    }
    rows.sort((x, y) => x.start.localeCompare(y.start));
    const tn = id => ((A.cfg().treatments || []).find(t => t.id === id) || {}).name || id;
    const badge = st => st === 'done' ? '<span class="badge ok">Done</span>' : '<span class="badge warn">Not yet</span>';
    const done = rows.filter(r => r.st === 'done').length;
    return { html: `<div class="vh"><div><div class="eyebrow">Run the day</div><h1>Consultation forms</h1><p>${rows.length ? `<b>${done}</b> of ${rows.length} guest${rows.length === 1 ? '' : 's'} done${mineOnly ? ' (your guests)' : ''}.` : 'No treatments on this day.'} Tap a guest, then hand them the tablet.</p></div>
        <div class="acts"><button class="icon-btn" id="cdPrev" aria-label="Earlier">‹</button><input type="date" class="inp" id="cdDate" value="${date}" style="width:170px"><button class="icon-btn" id="cdNext" aria-label="Later">›</button>${me && !A.isTher() ? `<label class="sw"><input type="checkbox" id="cdMine" ${mineOnly ? 'checked' : ''}> Only my guests</label>` : ''}</div></div>
      <div class="cd-list">${rows.map(r => `<div class="card cd-row ${r.st === 'done' ? 'is-done' : ''}">
          <div class="cd-time">${r.start}</div>
          <div class="cd-who"><b>${esc(guestName(r.b, r.g))}</b><div class="small muted">${r.its.map(i => esc(tn(i.tid))).join(' · ')} · ${esc(r.b.ref)}</div><div class="small muted">Form: ${guestForms(r.b, r.g).map(f => esc(f.name)).join(' + ')}</div></div>

          <div class="cd-act">${r.st === 'done' ? A.consultBtn(r.b, r.g, '') : `<button class="btn pri" data-ch="${r.b.id}|${r.g}">Hand to ${esc(guestName(r.b, r.g).split(' ')[0])}</button>`}</div></div>`).join('') || '<div class="card"><div class="empty"><b>Nobody to show</b>No treatments booked for this day' + (mineOnly ? ' with you' : '') + '.</div></div>'}</div>`,
      wire: el => {
        const go = d => { location.hash = '#/consults/' + d; };
        $('#cdPrev', el).onclick = () => go(add(-1)); $('#cdNext', el).onclick = () => go(add(1)); $('#cdDate', el).onchange = e => e.target.value && go(e.target.value);
        const mine = $('#cdMine', el); if (mine) mine.onchange = () => { A.consultMine = mine.checked; A.refresh(); };
        const find = s => { const [id, g] = s.split('|'); return [DB.bookings.find(x => x.id === id), +g]; };
        $$('[data-ch]', el).forEach(x => x.onclick = () => { const [b, g] = find(x.dataset.ch); A.handOver(b, g); });
        $$('[data-cv]', el).forEach(x => x.onclick = () => { const [b, g] = find(x.dataset.cv); A.viewConsults(b, g); });
      } };
  };

  // ---------- Settings → Consultation forms ----------
  A.consultSettings = () => {
    const c = cc(), S = St.S, TR = A.cfg().treatments || [];
    const html = `<div class="card" style="max-width:980px"><div class="card-h"><h3>How it works</h3></div>
        <ol class="steps-list" style="color:var(--ink)"><li><b>Forms:</b> make a form for each kind of treatment (or one for everything). Each guest gets the forms for the treatments they’re having, as one form.</li>
        <li><b>Before the visit:</b> the before-the-visit email links each guest to their form on the website (once the online form below is switched on).</li>
        <li><b>On the day:</b> <b>Run the day → Consultation forms</b> lists every guest. The therapist taps a guest and hands over the tablet; when they’ve finished it asks for the tablet back, ready for the next guest.</li>
        <li>Answers are encrypted on the device. Only this portal can read them, and anything to check is flagged for the therapist.</li></ol></div>
      <div class="card" style="max-width:980px"><div class="card-h"><h3>Forms</h3><button class="btn sm" id="fAdd">${A.ic.plus} New form</button></div>
        <table class="tbl"><thead><tr><th>Form</th><th>Used for</th><th class="r">Questions</th><th></th></tr></thead><tbody>
        ${c.forms.map((f, i) => `<tr class="click" data-fe="${f.id}"><td><b>${esc(f.name)}</b>${f.id === 'general' ? ' <span class="badge ok">Main form</span>' : ''}</td><td class="small">${f.id === 'general' ? 'Every guest, every treatment' : f.all ? 'Every treatment' : (f.treatments || []).map(t => esc((TR.find(x => x.id === t) || {}).name || t)).join(', ') || '<span class="muted">No treatments yet</span>'}</td><td class="r">${f.questions.filter(q => !['heading', 'info'].includes(q.type)).length}</td>
          <td style="white-space:nowrap;text-align:right">${f.id === 'general' ? '' : `<button class="icon-btn" data-fm="${i}" data-d="-1" aria-label="Earlier" ${i > 1 ? '' : 'disabled'}>↑</button><button class="icon-btn" data-fm="${i}" data-d="1" aria-label="Later" ${i < c.forms.length - 1 ? '' : 'disabled'}>↓</button>`}</td></tr>`).join('')}
        </tbody></table><p class="small muted" style="margin-top:8px">Name, date of birth, the agreement tick and a signature are always included. The main form is filled in by every guest. Other forms are added after it for the treatments they’re for, in this order.</p></div>
      <div class="card" style="max-width:980px"><div class="card-h"><h3>Encryption key</h3>${c.publicKey ? '<span class="badge ok">Set up</span>' : '<span class="badge warn">Not set up</span>'}</div>
        ${c.publicKey ? `<p>Forms are encrypted with York Cottage’s key. The private half is kept inside the sign-in vault, so any signed-in user (including therapists) can read forms, and nobody else can.</p>` : `<p>Create the key once. ${S.user.role === 'owner' ? '' : 'Only the owner can do this.'}</p>${S.user.role === 'owner' ? '<button class="btn pri" id="mkKey" style="margin-top:10px">Create the encryption key</button>' : ''}`}</div>
      <div class="card" style="max-width:980px"><div class="card-h"><h3>Online form (before the visit)</h3>${c.endpoint ? '<span class="badge ok">On</span>' : '<span class="badge">Off: guests fill it in on arrival</span>'}</div>
        <p class="muted" style="margin-bottom:10px">Needs the small receiving service (a free Cloudflare Worker: see consult-worker/README.md in the website folder). It only ever receives encrypted forms. The same service also handles one-click unsubscribe and the contact form.</p>
        <div class="row r2">${A.f.text('endpoint', 'Receiving address', c.endpoint || '', { ph: 'https://yc-consult.example.workers.dev' })}${A.f.num('retentionMonths', 'Delete forms after (months)', c.retentionMonths || 24, { hint: 'Keep them only as long as you need them (UK GDPR)' })}</div>
        <button class="btn" id="saveEnd" style="margin-top:10px">Save</button></div>`;
    const wire = el => {
      const mk = $('#mkKey', el); if (mk) mk.onclick = async () => { mk.disabled = true; mk.textContent = 'Creating…'; try { c.publicKey = await St.makeConsultKey(); A.change('cfg', null, 'Consultation form key created'); A.toast('Key created'); A.refresh(); } catch (e) { A.toast(e.message); mk.disabled = false; } };
      $('#saveEnd', el).onclick = () => { const v = A.read(el); c.endpoint = (v.endpoint || '').replace(/\/$/, ''); c.retentionMonths = v.retentionMonths || 24; A.change('cfg', null, 'Online consultation form settings saved'); A.toast('Saved'); A.refresh(); };
      $('#fAdd', el).onclick = () => { const f = { id: uid('f'), name: '', all: false, treatments: [], questions: [] }; c.forms.push(f); A.openFormBuilder(f, true); };
      $$('[data-fe]', el).forEach(r => r.onclick = e => { if (e.target.closest('[data-fm]')) return; A.openFormBuilder(c.forms.find(f => f.id === r.dataset.fe)); });
      $$('[data-fm]', el).forEach(x => x.onclick = () => { const i = +x.dataset.fm, j = i + +x.dataset.d; if (j < 1 || j >= c.forms.length || i < 1) return; [c.forms[i], c.forms[j]] = [c.forms[j], c.forms[i]]; A.change('cfg', null, 'Consultation forms reordered'); A.refresh(); });
    };
    return { html, wire };
  };

  // ---------- the form builder: its own page, #/consultform/<id> (user 2026-11-27: easier to use, better preview) ----------
  const QT = {
    yesno: { name: 'Yes or no', icon: '◐', eg: 'Are you pregnant, or could you be?' },
    choice: { name: 'Pick one', icon: '◉', eg: 'Preferred massage pressure: Light / Medium / Firm' },
    multi: { name: 'Pick any', icon: '☑', eg: 'Areas to focus on: Back, Shoulders, Neck…' },
    short: { name: 'Short answer', icon: '▭', eg: 'Your GP’s name' },
    text: { name: 'Longer answer', icon: '☰', eg: 'Anything else your therapist should know?' },
    date: { name: 'Date', icon: '📅', eg: 'Date of your last facial' },
    heading: { name: 'Section heading', icon: 'H', eg: 'Splits a long form into parts' },
    info: { name: 'Information', icon: 'ℹ', eg: 'A note for the guest, with no answer' },
    optin: { name: 'Marketing opt-in', icon: '✉', eg: 'Yes, send me special offers and news' }
  };
  const blank = type => ({ id: uid('q'), type, label: '', ...(type === 'yesno' ? { detail: 'Please tell us more' } : {}), ...(['choice', 'multi'].includes(type) ? { options: ['', ''], flagOn: [] } : {}) });
  let FB = null;   // { id, draft, open, isNew, dirty }
  A.openFormBuilder = (f, isNew) => { FB = { id: f.id, draft: JSON.parse(JSON.stringify(f)), open: isNew ? null : -1, isNew, dirty: !!isNew }; location.hash = '#/consultform/' + f.id; };
  A.views.consultform = fid => {
    const c = cc(), TR = (A.cfg().treatments || []).filter(t => t.active !== false);
    let f0 = c.forms.find(x => x.id === fid);
    if (!FB || FB.id !== fid) { if (!f0) return '<div class="empty"><b>Form not found</b></div>'; FB = { id: f0.id, draft: JSON.parse(JSON.stringify(f0)), open: -1, isNew: false, dirty: false }; }
    const d = FB.draft, qs = d.questions;
    const usedFor = d.all ? 'Every treatment' : (d.treatments || []).length ? (d.treatments || []).map(t => (TR.find(x => x.id === t) || {}).name || t).join(', ') : 'No treatments chosen yet';
    const summary = q => {
      const t = QT[q.type] || QT.text, lab = q.label || '<span class="muted">No question written yet</span>';
      if (q.type === 'heading') return `<div class="fq-sum fq-head">${q.label ? esc(q.label) : lab}</div>`;
      const extra = ['choice', 'multi'].includes(q.type) ? `<div class="fq-chips">${(q.options || []).filter(Boolean).map(o => `<span class="${(q.flagOn || []).includes(o) ? 'fl' : ''}">${esc(o)}${(q.flagOn || []).includes(o) ? ' ⚑' : ''}</span>`).join('')}</div>`
        : q.type === 'yesno' ? `<div class="fq-chips"><span>No</span><span class="fl">Yes ⚑</span>${q.detail ? `<em>then asks: “${esc(q.detail)}”</em>` : ''}</div>` : '';
      return `<div class="fq-sum"><div class="fq-t"><i>${t.icon}</i>${esc(t.name)}${q.required ? ' · must be answered' : ''}${q.type === 'info' && (q.terms || q.id === 'consent_text') ? ' · behind a link, must be agreed to' : ''}</div><div class="fq-l">${q.label ? esc(q.label) : lab}</div>${extra}</div>`;
    };
    const editor = (q, i) => {
      const L = (k, label, v, ph, hint) => `<label class="fld"><span>${label}</span><input class="inp" data-f="${k}" value="${esc(v || '')}" placeholder="${esc(ph || '')}">${hint ? `<small>${hint}</small>` : ''}</label>`;
      return `<div class="fq-ed">
        <div class="fq-edh"><label class="fld" style="flex:1"><span>Type of answer</span><select class="inp" data-f="type">${Object.entries(QT).map(([k, t]) => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${t.icon}  ${t.name}</option>`).join('')}</select></label></div>
        ${L('label', q.type === 'heading' ? 'Heading' : q.type === 'info' ? 'Title' : 'Question', q.label, QT[q.type].eg)}
        ${q.type === 'yesno' ? L('detail', 'When they answer Yes, ask them', q.detail, 'e.g. Please tell us more', 'A Yes answer is always flagged for the therapist.') : ''}
        ${['choice', 'multi'].includes(q.type) ? `<div class="fld"><span>Choices</span><div class="fq-opts">${(q.options || []).map((o, j) => `<div class="fq-opt"><input class="inp" data-opt="${j}" value="${esc(o)}" placeholder="Choice ${j + 1}"><label class="fq-flag" title="Flag this answer for the therapist"><input type="checkbox" data-flag="${j}" ${(q.flagOn || []).includes(o) && o ? 'checked' : ''}> ⚑ Flag</label><button type="button" class="icon-btn" data-optrm="${j}" aria-label="Remove choice">${A.ic.x}</button></div>`).join('')}</div>
          <button type="button" class="btn sm ghost" data-optadd style="align-self:flex-start;margin-top:4px">${A.ic.plus} Add a choice</button><small>Tick ⚑ Flag on any answer the therapist should check before the treatment.</small></div>` : ''}
        ${q.type !== 'heading' ? L('help', q.type === 'info' ? 'The information' : 'Help text under it (optional)', q.help, q.type === 'info' ? 'e.g. Please arrive 15 minutes early and bring swimwear.' : 'e.g. This helps us choose the right oils') : ''}
        ${q.type === 'info' ? `<label class="sw"><input type="checkbox" data-f="terms" ${q.terms || q.id === 'consent_text' ? 'checked' : ''}> Show behind a link next to the agreement tick box (for long terms and conditions)</label>` : ''}${q.type === 'optin' ? '<small class="muted">Ticking it adds the guest to Customers with news and offers switched on. It starts ticked for a booker who has already agreed.</small>' : ''}${['choice', 'multi', 'short', 'text', 'date'].includes(q.type) ? `<label class="sw"><input type="checkbox" data-f="required" ${q.required ? 'checked' : ''}> Must be answered</label>` : ''}
        <div class="fq-eda"><button type="button" class="btn sm ghost" data-dup>Duplicate</button><button type="button" class="btn sm ghost danger" data-del>Delete question</button><button type="button" class="btn sm pri" data-done>Done</button></div></div>`;
    };
    return { html: `<div class="vh"><div><div class="eyebrow"><a href="#/settings/consult">Consultation forms</a></div><h1>${esc(d.name || 'New form')}</h1><p>${qs.filter(q => !['heading', 'info'].includes(q.type)).length} question${qs.length === 1 ? '' : 's'} · used for ${esc(usedFor)}</p></div>
        <div class="acts">${FB.isNew || d.id === 'general' ? '' : '<button class="btn ghost danger" id="fbDel">Delete form</button>'}<button class="btn" id="fbCancel">${FB.dirty ? 'Cancel' : 'Back'}</button><button class="btn pri" id="fbSave">Save the form</button></div></div>
      <div class="fb2">
        <div class="fb2-l">
          <div class="card"><div class="card-h"><h3>About this form</h3></div>
            <label class="fld"><span>Form name (guests see it as a heading)</span><input class="inp" id="fbName" value="${esc(d.name)}" placeholder="e.g. Massage, Facials, Head spa"></label>
            ${d.id === 'general' ? '<div class="note ok" style="margin-top:12px"><b>Main form:</b> every guest fills this in, whatever their treatment.</div>' : ''}<div class="fld" style="margin-top:12px" ${d.id === 'general' ? 'hidden' : ''}><span>Which treatments use it</span>
              <div class="seg fb-all"><button type="button" class="${d.all ? 'on' : ''}" data-all="1">Every treatment</button><button type="button" class="${d.all ? '' : 'on'}" data-all="0">Only some treatments</button></div>
              ${d.all ? '' : `<div class="fb-tr2">${TR.map(t => `<label class="chk"><input type="checkbox" value="${t.id}" ${(d.treatments || []).includes(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}</div>`}</div></div>
          <div class="card"><div class="card-h"><h3>Questions</h3>${d.id === 'general' ? '<button type="button" class="btn sm ghost" id="fbStd">Add the standard health questions</button>' : ''}</div>
            <p class="small muted" style="margin:-4px 0 12px">Name, date of birth, a confirmation tick and a signature are always added at the start and end. Click a question to change it.</p>
            <div class="fq-list">${qs.map((q, i) => `<div class="fq ${FB.open === i ? 'open' : ''}" data-qi="${i}">
                <div class="fq-row"><div class="fq-n">${i + 1}</div>${FB.open === i ? `<div style="flex:1">${editor(q, i)}</div>` : `<div class="fq-click" data-open="${i}">${summary(q)}</div>`}
                <div class="fq-mv"><button type="button" class="icon-btn" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" class="icon-btn" data-dn="${i}" ${i < qs.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button></div></div></div>`).join('') || '<div class="empty" style="padding:18px"><b>No questions yet</b>Add the first one below.</div>'}</div>
            <div class="fq-add"><div class="small" style="font-weight:600;margin-bottom:8px">Add a question</div><div class="fq-types">${Object.entries(QT).map(([k, t]) => `<button type="button" data-add="${k}"><i>${t.icon}</i><b>${t.name}</b><small>${esc(t.eg)}</small></button>`).join('')}</div></div></div>
        </div>
        <div class="fb2-r"><div class="pv-cap"><span>What the guest sees</span><span class="seg pv-size"><button type="button" class="${A.fbPv === 'tablet' ? '' : 'on'}" data-pv="phone">Phone</button><button type="button" class="${A.fbPv === 'tablet' ? 'on' : ''}" data-pv="tablet">Tablet</button></span></div>
          <div class="pv-dev ${A.fbPv === 'tablet' ? 'tablet' : ''}"><div class="pv-scr kiosk-look" id="fbPrev"></div></div></div>
      </div>`,
      wire: el => {
        const prev = () => { const p = $('#fbPrev', el), y = p.scrollTop;
          p.innerHTML = `<div class="kiosk-top"><span>York Cottage Spa</span></div><div class="kiosk-in"><div class="kiosk-hello">Hello Sophie</div><p class="kiosk-sub">Before your ${esc((d.name || 'treatment').toLowerCase())}, please answer a few questions so your therapist can make it safe and just right for you.</p>
            ${C.formHTML([{ id: 'h0', type: 'heading', label: d.name || 'Form' }, ...qs.filter(q => q.label || q.type === 'info')], { name: 'Sophie Turner' })}<button class="btn pri kiosk-go" type="button">Send my answers</button></div>`;
          C.wireForm(p); p.scrollTop = y; };
        const touch = () => { FB.dirty = true; const c2 = $('#fbCancel', el); if (c2) c2.textContent = 'Cancel'; };
        const redraw = () => { const y = scrollY; A.refresh(); scrollTo(0, y); };
        $('#fbName', el).oninput = e => { d.name = e.target.value; touch(); prev(); };
        $$('[data-all]', el).forEach(b => b.onclick = () => { d.all = b.dataset.all === '1'; touch(); redraw(); });
        $$('.fb-tr2 input', el).forEach(x => x.onchange = () => { d.treatments = $$('.fb-tr2 input:checked', el).map(y => y.value); touch(); });
        $$('[data-pv]', el).forEach(b => b.onclick = () => { A.fbPv = b.dataset.pv; redraw(); });
        $$('[data-open]', el).forEach(x => x.onclick = () => { FB.open = +x.dataset.open; redraw(); });
        $$('[data-up]', el).forEach(x => x.onclick = () => { const i = +x.dataset.up; [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; if (FB.open === i) FB.open = i - 1; touch(); redraw(); });
        $$('[data-dn]', el).forEach(x => x.onclick = () => { const i = +x.dataset.dn; [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; if (FB.open === i) FB.open = i + 1; touch(); redraw(); });
        $$('[data-add]', el).forEach(x => x.onclick = () => { qs.push(blank(x.dataset.add)); FB.open = qs.length - 1; touch(); redraw(); const n = $$('.fq.open input[data-f=label]')[0]; if (n) { n.focus(); n.scrollIntoView({ block: 'center' }); } });
        const std = $('#fbStd', el); if (std) std.onclick = () => { const have = new Set(qs.map(q => q.id)); C.defaults().forEach(q => { if (!have.has(q.id)) qs.push(q); }); touch(); redraw(); };
        // the open question's fields
        const ed = $('.fq.open', el);
        if (ed) {
          const i = +ed.dataset.qi, q = qs[i];
          $$('[data-f]', ed).forEach(x => { const k = x.dataset.f; x.addEventListener(x.type === 'checkbox' || x.tagName === 'SELECT' ? 'change' : 'input', () => {
            if (k === 'type') { const keep = { id: q.id, label: q.label, help: q.help }; Object.keys(q).forEach(z => delete q[z]); Object.assign(q, blank(x.value), keep); touch(); redraw(); return; }
            q[k] = x.type === 'checkbox' ? x.checked : x.value; touch(); prev(); }); });
          $$('[data-opt]', ed).forEach(x => x.oninput = () => { const j = +x.dataset.opt, old = q.options[j]; q.options[j] = x.value; if ((q.flagOn || []).includes(old)) q.flagOn = q.flagOn.map(z => z === old ? x.value : z); touch(); prev(); });
          $$('[data-flag]', ed).forEach(x => x.onchange = () => { const o = q.options[+x.dataset.flag]; q.flagOn = (q.flagOn || []).filter(z => z !== o); if (x.checked && o) q.flagOn.push(o); touch(); });
          $$('[data-optrm]', ed).forEach(x => x.onclick = () => { const o = q.options.splice(+x.dataset.optrm, 1)[0]; q.flagOn = (q.flagOn || []).filter(z => z !== o); touch(); redraw(); });
          const oa = $('[data-optadd]', ed); if (oa) oa.onclick = () => { q.options.push(''); touch(); redraw(); const l = $$('.fq.open [data-opt]').pop(); if (l) l.focus(); };
          $('[data-dup]', ed).onclick = () => { qs.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(q)), id: uid('q') }); FB.open = i + 1; touch(); redraw(); };
          $('[data-del]', ed).onclick = () => { qs.splice(i, 1); FB.open = -1; touch(); redraw(); };
          $('[data-done]', ed).onclick = () => { FB.open = -1; redraw(); };
        }
        prev();
        $('#fbCancel', el).onclick = async () => { if (FB.dirty && !(await A.confirm('Leave without saving?', 'Your changes to this form will be lost.', 'Leave'))) return; if (FB.isNew) c.forms = c.forms.filter(x => x.id !== FB.id); FB = null; location.hash = '#/settings/consult'; };
        const del = $('#fbDel', el); if (del) del.onclick = async () => { if (c.forms.length < 2) { A.toast('Keep at least one form'); return; } if (!(await A.confirm('Delete this form?', 'Guests won’t be asked these questions any more. Forms already filled in are kept.', 'Delete'))) return; c.forms = c.forms.filter(x => x.id !== FB.id); A.change('cfg', null, 'Consultation form deleted: ' + d.name); FB = null; location.hash = '#/settings/consult'; };
        $('#fbSave', el).onclick = () => {
          if (!(d.name || '').trim()) { A.toast('Give the form a name'); $('#fbName', el).focus(); return; }
          if (!d.all && !(d.treatments || []).length) { A.toast('Choose which treatments use this form, or pick Every treatment'); return; }
          const clean = qs.filter(q => (q.label || '').trim() || (q.type === 'info' && (q.help || '').trim())).map(q => ({ ...q, label: (q.label || '').trim(), ...(q.options ? { options: q.options.map(o => o.trim()).filter(Boolean) } : {}) }));
          const bad = clean.find(q => ['choice', 'multi'].includes(q.type) && q.options.length < 2); if (bad) { A.toast('Add at least two choices for: ' + bad.label); FB.open = qs.indexOf(qs.find(x => x.id === bad.id)); redraw(); return; }
          const f = c.forms.find(x => x.id === FB.id); Object.assign(f, { name: d.name.trim(), all: !!d.all, treatments: d.all ? [] : d.treatments, questions: clean }); if (f.id === 'general') c.questions = f.questions;
          A.change('cfg', null, (FB.isNew ? 'Consultation form created: ' : 'Consultation form saved: ') + f.name); A.toast('Form saved'); FB = null; location.hash = '#/settings/consult';
        };
      } };
  };

})();
