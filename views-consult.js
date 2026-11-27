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
  if (!document.getElementById('consult-css')) { const st = document.createElement('style'); st.id = 'consult-css'; st.textContent = C.css; document.head.appendChild(st); }
  const needKey = async () => { if (cc().publicKey) return false; if (await A.confirm('Set up the form first', 'The consultation form needs its encryption key. Create it now in Settings → Consultation forms?', 'Go to Settings', false)) location.hash = '#/settings/consult'; return true; };
  const save = async (b, g, v, via) => {
    const sealed = await C.seal(cc().publicKey, v.answers); await St.saveConsult(b, g, sealed, via);
    b.guestList[g] = b.guestList[g] || {}; b.guestList[g].consult = 'done'; if (v.answers.name && !b.guestList[g].name && g > 0) b.guestList[g].name = v.answers.name;
    (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: `Consultation form completed ${via === 'tablet' ? 'on the tablet' : ''} for ${guestName(b, g)}` });
    A.change('booking', b, 'Consultation form: ' + b.ref);
  };

  // fill in on a tablet, from the booking page
  A.fillConsult = async (b, g) => A.handOver(b, g);

  // hand-over mode: full screen, just the form; then "please hand the tablet back"
  A.handOver = async (b, g, after) => {
    if (await needKey()) return;
    const qs = guestQs(b, g), forms = guestForms(b, g), first = (guestName(b, g) || '').split(' ')[0];
    const ov = document.createElement('div'); ov.className = 'kiosk'; document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const close = () => { ov.remove(); document.body.style.overflow = ''; if (after) after(); else A.refresh(); };
    const formStep = () => {
      ov.innerHTML = `<div class="kiosk-top"><span>York Cottage Spa · consultation form</span><button type="button" class="kiosk-x" data-x>Therapist: cancel</button></div>
        <div class="kiosk-in"><div class="kiosk-hello">Hello${first ? ' ' + esc(first) : ''}</div><p class="kiosk-sub">Before your ${esc(forms.map(f => f.name.toLowerCase()).join(' and ') || 'treatment')}${forms.length ? '' : ''}, please answer a few questions so your therapist can make it safe and just right for you. It takes a couple of minutes.</p>
        ${C.formHTML(qs, { name: ((b.guestList || [])[g] || {}).name || (g === 0 ? A.cust(b) : '') })}
        <button class="btn pri kiosk-go" id="kGo">Send my answers</button><p class="kiosk-lock">🔒 Your answers are encrypted on this tablet and only York Cottage can read them.</p></div>`;
      C.wireForm(ov); ov.scrollTop = 0;
      $('[data-x]', ov).onclick = async () => { if (await A.confirm('Stop this form?', 'Nothing has been saved yet.', 'Stop', false)) close(); };
      $('#kGo', ov).onclick = async e => { const v = C.readForm(ov, qs), msg = $('.cq-msg', ov);
        if (!v.ok) { msg.textContent = v.msg; msg.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        e.target.disabled = true; e.target.textContent = 'Saving…';
        try { await save(b, g, v, 'tablet'); doneStep(C.flags(qs, v.answers.a)); } catch (err) { e.target.disabled = false; e.target.textContent = 'Send my answers'; msg.textContent = 'That didn’t save: ' + err.message; } };
    };
    const doneStep = (flags) => {
      ov.innerHTML = `<div class="kiosk-in kiosk-done"><div class="kiosk-tick">✓</div><div class="kiosk-hello">Thank you${first ? ', ' + esc(first) : ''}</div><p class="kiosk-sub">Please hand the tablet back to your therapist.</p>
        <button class="btn kiosk-back" id="kBack">I’m the therapist: continue</button></div>`;
      $('#kBack', ov).onclick = () => {
        ov.innerHTML = `<div class="kiosk-in kiosk-done"><div class="kiosk-hello" style="font-size:34px">${esc(guestName(b, g))}’s form is saved</div>
          ${flags.length ? `<div class="note warn" style="text-align:left;margin:16px 0"><b>Check before the treatment:</b> ${flags.map(esc).join(' · ')}</div>` : '<div class="note ok" style="margin:16px 0">Nothing flagged</div>'}
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn" id="kView">Read the answers</button><button class="btn pri" id="kList">Back to the list</button></div></div>`;
        $('#kList', ov).onclick = close; $('#kView', ov).onclick = async () => { close(); A.viewConsults(b, g); };
      };
    };
    formStep();
  };

  // read completed forms
  A.viewConsults = async (b, g) => {
    let list = []; try { list = await St.listConsults(b); } catch (e) { A.toast('Couldn’t load the forms: ' + e.message); return; }
    if (g != null) list = list.filter(x => +x.g === +g || x.g === 'all');
    if (!list.length) { A.toast('No form yet' + (g != null ? ' for ' + guestName(b, g) : '')); return; }
    const key = await St.consultKey().catch(() => null);
    if (!key) { A.toast('This login can’t open forms yet. The owner creates the key in Settings → Consultation forms.'); return; }
    const opened = [];
    for (const x of list) { try { opened.push({ x, f: await C.open(key, x.sealed) }); } catch (e) { opened.push({ x, err: true }); } }
    const show = ({ x, f, err }) => err ? `<div class="note bad">A form from ${ft(x.at)} couldn’t be opened (it was made with an older key).</div>` : `<div class="card" style="margin-bottom:12px">
      <div class="card-h"><h3>${esc(f.name)}</h3><span class="small muted">${x.via === 'online' ? 'Online, before the visit' : 'On the tablet'} · ${ft(f.signedAt || x.at)}</span></div>
      ${C.flags(f.questions, f.a).length ? `<div class="note warn" style="margin-bottom:10px"><b>Check before the treatment:</b> ${C.flags(f.questions, f.a).map(esc).join(' · ')}</div>` : '<div class="note ok" style="margin-bottom:10px">Nothing flagged</div>'}
      <dl class="kv"><dt>Date of birth</dt><dd>${esc(f.dob)}</dd>${(f.questions || []).map(q => q.type === 'heading' ? `<dt class="kv-h">${esc(q.label)}</dt><dd></dd>` : q.type === 'info' ? '' : `<dt>${esc(q.label)}</dt><dd>${q.type === 'yesno' && (f.a || {})[q.id] && f.a[q.id].yes ? '<b style="color:var(--warn)">' + esc(C.answerText(q, f.a[q.id])) + '</b>' : esc(C.answerText(q, (f.a || {})[q.id]))}</dd>`).join('')}
      <dt>Signed</dt><dd>${esc(f.sign)} · ${f.consent ? 'confirmed the information is correct' : ''}</dd></dl></div>`;
    St.audit(`Consultation form viewed: ${b.ref}`, b.ref); St.touch('audit');
    await A.modal({ title: 'Consultation form' + (opened.length > 1 ? 's' : ''), size: 'wide', ok: 'Close', cancel: '', foot: '<button class="btn" onclick="print()" style="margin-right:auto">Print</button>', body: `<p class="small muted">${esc(A.cust(b))} · ${b.ref} · ${fdy(b.date)}. Health information: keep it private, and don’t copy it into notes.</p>${opened.map(show).join('')}` });
  };

  // ---------- Run the day → Consultation forms: each guest with treatments on a day, and their form ----------
  A.views.consults = (rest) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rest[0] || '') ? rest[0] : today(), me = A.myStaff(), mineOnly = !!me && (A.isTher() || (A.consultMine !== false));
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
    const badge = st => st === 'done' ? '<span class="badge ok">Done</span>' : st === 'paper' ? '<span class="badge ok">On paper</span>' : '<span class="badge warn">Not yet</span>';
    const done = rows.filter(r => r.st === 'done' || r.st === 'paper').length;
    return { html: `<div class="vh"><div><div class="eyebrow">Run the day</div><h1>Consultation forms</h1><p>${rows.length ? `<b>${done}</b> of ${rows.length} guest${rows.length === 1 ? '' : 's'} done${mineOnly ? ' (your guests)' : ''}.` : 'No treatments on this day.'} Tap a guest, then hand them the tablet.</p></div>
        <div class="acts"><button class="icon-btn" id="cdPrev" aria-label="Earlier">‹</button><input type="date" class="inp" id="cdDate" value="${date}" style="width:170px"><button class="icon-btn" id="cdNext" aria-label="Later">›</button>${me && !A.isTher() ? `<label class="sw"><input type="checkbox" id="cdMine" ${mineOnly ? 'checked' : ''}> Only my guests</label>` : ''}</div></div>
      <div class="cd-list">${rows.map(r => `<div class="card cd-row ${r.st === 'done' || r.st === 'paper' ? 'is-done' : ''}">
          <div class="cd-time">${r.start}</div>
          <div class="cd-who"><b>${esc(guestName(r.b, r.g))}</b><div class="small muted">${r.its.map(i => esc(tn(i.tid))).join(' · ')} · ${esc(r.b.ref)}</div><div class="small muted">Form: ${guestForms(r.b, r.g).map(f => esc(f.name)).join(' + ')}</div></div>
          <div class="cd-st">${badge(r.st)}</div>
          <div class="cd-act">${r.st === 'done' ? `<button class="btn" data-cv="${r.b.id}|${r.g}">Read it</button>` : `<button class="btn pri" data-ch="${r.b.id}|${r.g}">Hand to ${esc(guestName(r.b, r.g).split(' ')[0])}</button><button class="btn ghost sm" data-cp="${r.b.id}|${r.g}">Done on paper</button>`}</div></div>`).join('') || '<div class="card"><div class="empty"><b>Nobody to show</b>No treatments booked for this day' + (mineOnly ? ' with you' : '') + '.</div></div>'}</div>`,
      wire: el => {
        const go = d => { location.hash = '#/consults/' + d; };
        $('#cdPrev', el).onclick = () => go(add(-1)); $('#cdNext', el).onclick = () => go(add(1)); $('#cdDate', el).onchange = e => e.target.value && go(e.target.value);
        const mine = $('#cdMine', el); if (mine) mine.onchange = () => { A.consultMine = mine.checked; A.refresh(); };
        const find = s => { const [id, g] = s.split('|'); return [DB.bookings.find(x => x.id === id), +g]; };
        $$('[data-ch]', el).forEach(x => x.onclick = () => { const [b, g] = find(x.dataset.ch); A.handOver(b, g); });
        $$('[data-cv]', el).forEach(x => x.onclick = () => { const [b, g] = find(x.dataset.cv); A.viewConsults(b, g); });
        $$('[data-cp]', el).forEach(x => x.onclick = () => { const [b, g] = find(x.dataset.cp); b.guestList[g] = b.guestList[g] || {}; b.guestList[g].consult = 'paper'; A.change('booking', b, 'Consultation form done on paper: ' + b.ref); A.refresh(); });
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
        ${c.forms.map((f, i) => `<tr class="click" data-fe="${f.id}"><td><b>${esc(f.name)}</b></td><td class="small">${f.all ? 'Every treatment' : (f.treatments || []).map(t => esc((TR.find(x => x.id === t) || {}).name || t)).join(', ') || '<span class="muted">No treatments yet</span>'}</td><td class="r">${f.questions.filter(q => !['heading', 'info'].includes(q.type)).length}</td>
          <td style="white-space:nowrap;text-align:right"><button class="icon-btn" data-fm="${i}" data-d="-1" aria-label="Earlier">↑</button><button class="icon-btn" data-fm="${i}" data-d="1" aria-label="Later">↓</button></td></tr>`).join('')}
        </tbody></table><p class="small muted" style="margin-top:8px">Name, date of birth, a confirmation tick and a typed signature are always included. When a guest needs more than one form, they’re shown in this order.</p></div>
      <div class="card" style="max-width:980px"><div class="card-h"><h3>Encryption key</h3>${c.publicKey ? '<span class="badge ok">Set up</span>' : '<span class="badge warn">Not set up</span>'}</div>
        ${c.publicKey ? `<p>Forms are encrypted with York Cottage’s key. The private half is kept inside the sign-in vault, so any signed-in user (including therapists) can read forms, and nobody else can.</p>` : `<p>Create the key once. ${S.user.role === 'owner' ? '' : 'Only the owner can do this.'}</p>${S.user.role === 'owner' ? '<button class="btn pri" id="mkKey" style="margin-top:10px">Create the encryption key</button>' : ''}`}</div>
      <div class="card" style="max-width:980px"><div class="card-h"><h3>Online form (before the visit)</h3>${c.endpoint ? '<span class="badge ok">On</span>' : '<span class="badge">Off: guests fill it in on arrival</span>'}</div>
        <p class="muted" style="margin-bottom:10px">Needs the small receiving service (a free Cloudflare Worker: see consult-worker/README.md in the website folder). It only ever receives encrypted forms. The same service also handles one-click unsubscribe and the contact form.</p>
        <div class="row r2">${A.f.text('endpoint', 'Receiving address', c.endpoint || '', { ph: 'https://yc-consult.example.workers.dev' })}${A.f.num('retentionMonths', 'Delete forms after (months)', c.retentionMonths || 24, { hint: 'Keep them only as long as you need them (UK GDPR)' })}</div>
        <button class="btn" id="saveEnd" style="margin-top:10px">Save</button></div>`;
    const wire = el => {
      const mk = $('#mkKey', el); if (mk) mk.onclick = async () => { mk.disabled = true; mk.textContent = 'Creating…'; try { c.publicKey = await St.makeConsultKey(); A.change('cfg', null, 'Consultation form key created'); A.toast('Key created'); A.refresh(); } catch (e) { A.toast(e.message); mk.disabled = false; } };
      $('#saveEnd', el).onclick = () => { const v = A.read(el); c.endpoint = (v.endpoint || '').replace(/\/$/, ''); c.retentionMonths = v.retentionMonths || 24; A.change('cfg', null, 'Online consultation form settings saved'); A.toast('Saved'); A.refresh(); };
      $('#fAdd', el).onclick = () => { const f = { id: uid('f'), name: 'New form', all: false, treatments: [], questions: [] }; c.forms.push(f); editForm(f, true); };
      $$('[data-fe]', el).forEach(r => r.onclick = e => { if (e.target.closest('[data-fm]')) return; editForm(c.forms.find(f => f.id === r.dataset.fe)); });
      $$('[data-fm]', el).forEach(x => x.onclick = () => { const i = +x.dataset.fm, j = i + +x.dataset.d; if (j < 0 || j >= c.forms.length) return; [c.forms[i], c.forms[j]] = [c.forms[j], c.forms[i]]; A.change('cfg', null, 'Consultation forms reordered'); A.refresh(); });
    };
    return { html, wire };
  };

  // the form builder
  async function editForm(f, isNew) {
    const c = cc(), TR = (A.cfg().treatments || []).filter(t => t.active !== false);
    let qs = JSON.parse(JSON.stringify(f.questions));
    const qRow = (q, i) => `<div class="fb-q" data-qi="${i}"><div class="fb-qh"><select class="inp qt">${C.TYPES.map(([v, t]) => `<option value="${v}" ${q.type === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <span class="fb-qa"><button type="button" class="icon-btn qup" title="Move up">↑</button><button type="button" class="icon-btn qdn" title="Move down">↓</button><button type="button" class="icon-btn qrm" title="Remove">${A.ic.x}</button></span></div>
      <input class="inp ql" value="${esc(q.label)}" placeholder="${q.type === 'heading' ? 'Section heading' : q.type === 'info' ? 'Information for the guest' : 'The question'}">
      ${['choice', 'multi'].includes(q.type) ? `<input class="inp qo" value="${esc((q.options || []).join(', '))}" placeholder="Choices, separated by commas"><input class="inp qf" value="${esc((q.flagOn || []).join(', '))}" placeholder="Flag these answers for the therapist (optional), e.g. Yes, Firm">` : ''}
      ${q.type === 'yesno' ? `<input class="inp qd" value="${esc(q.detail || '')}" placeholder="What to ask when they answer yes, e.g. Please tell us more"><div class="small muted">A “yes” is flagged for the therapist.</div>` : ''}
      <input class="inp qh" value="${esc(q.help || '')}" placeholder="Extra help text under it (optional)">
      ${['choice', 'multi', 'short', 'text', 'date'].includes(q.type) ? `<label class="sw"><input type="checkbox" class="qr" ${q.required ? 'checked' : ''}> Must be answered</label>` : ''}</div>`;
    const read = m => $$('.fb-q', m).map(d => { const old = qs[+d.dataset.qi] || {}, type = $('.qt', d).value, label = $('.ql', d).value.trim();
      const o = { id: old.id || uid('q'), type, label, help: ($('.qh', d) || {}).value ? $('.qh', d).value.trim() : '' };
      if (['choice', 'multi'].includes(type)) { o.options = ($('.qo', d) ? $('.qo', d).value : (old.options || []).join(',')).split(',').map(s => s.trim()).filter(Boolean); o.flagOn = ($('.qf', d) ? $('.qf', d).value : '').split(',').map(s => s.trim()).filter(Boolean); }
      if (type === 'yesno') o.detail = $('.qd', d) ? $('.qd', d).value.trim() : (old.detail || '');
      if ($('.qr', d)) o.required = $('.qr', d).checked;
      return o; });
    const r = await A.modal({ title: isNew ? 'New consultation form' : 'Edit form', size: 'wide', ok: 'Save the form',
      foot: isNew ? '' : '<button class="btn ghost danger" data-del style="margin-right:auto">Delete form</button>',
      body: `<div class="fb">
        <div class="fb-l">${A.f.text('fname', 'Form name', f.name, { ph: 'e.g. Massage, Facials, Head spa' })}<div style="height:10px"></div>
          <div class="fld"><span>Used for</span><label class="sw"><input type="checkbox" id="fAll" ${f.all ? 'checked' : ''}> Every treatment</label>
            <div class="fb-tr" ${f.all ? 'hidden' : ''}>${TR.map(t => `<label class="chk"><input type="checkbox" value="${t.id}" ${(f.treatments || []).includes(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}</div></div>
          <div class="fb-qs-h"><b>Questions</b><span style="display:flex;gap:6px">${!isNew && f.id === 'general' ? '<button type="button" class="btn sm ghost" id="qStd">Standard health questions</button>' : ''}<button type="button" class="btn sm" id="qAdd">${A.ic.plus} Add a question</button></span></div>
          <div id="fbQs">${qs.map(qRow).join('') || '<p class="muted small">No questions yet. Add some with Add a question.</p>'}</div></div>
        <div class="fb-r"><div class="small muted" style="margin-bottom:6px">Preview: what the guest sees</div><div class="fb-prev" id="fbPrev"></div></div></div>`,
      onOpen: (m, close) => {
        const redraw = () => { $('#fbQs', m).innerHTML = qs.map(qRow).join('') || '<p class="muted small">No questions yet. Add some with Add a question.</p>'; prev(); };
        const prev = () => { const cur = read(m); $('#fbPrev', m).innerHTML = `<div class="cq-h" style="margin-top:0">${esc($('[data-k=fname]', m).value || 'Form')}</div>` + C.formHTML(cur.filter(q => q.label)); C.wireForm($('#fbPrev', m)); };
        $('#fAll', m).onchange = e => { $('.fb-tr', m).hidden = e.target.checked; };
        $('#qAdd', m).onclick = () => { qs = read(m); qs.push({ id: uid('q'), type: 'yesno', label: '', detail: '' }); redraw(); const l = $$('.fb-q', m).pop(); if (l) { l.scrollIntoView({ block: 'center' }); $('.ql', l).focus(); } };
        const std = $('#qStd', m); if (std) std.onclick = async () => { qs = read(m); const have = new Set(qs.map(q => q.id)); C.defaults().forEach(q => { if (!have.has(q.id)) qs.push(q); }); redraw(); };
        m.addEventListener('click', e => { const d = e.target.closest('.fb-q'); if (!d) return; const i = +d.dataset.qi;
          if (e.target.closest('.qrm')) { qs = read(m); qs.splice(i, 1); redraw(); }
          if (e.target.closest('.qup') && i > 0) { qs = read(m); [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; redraw(); }
          if (e.target.closest('.qdn') && i < qs.length - 1) { qs = read(m); [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; redraw(); } });
        m.addEventListener('change', e => { if (e.target.closest('.qt')) { qs = read(m); redraw(); } });
        let t; m.addEventListener('input', () => { clearTimeout(t); t = setTimeout(prev, 250); });
        prev();
        const del = $('[data-del]', m); if (del) del.onclick = async () => { if (c.forms.length < 2) { A.toast('Keep at least one form'); return; } if (await A.confirm('Delete this form?', 'Guests won’t be asked these questions any more. Forms already filled in are kept.', 'Delete')) close('del'); };
      },
      onOk: m => { const name = $('[data-k=fname]', m).value.trim(); if (!name) throw new Error('Give the form a name');
        const all = $('#fAll', m).checked, trs = $$('.fb-tr input:checked', m).map(x => x.value);
        if (!all && !trs.length) throw new Error('Choose which treatments use this form, or tick Every treatment');
        const q = read(m).filter(x => x.label); const bad = q.find(x => ['choice', 'multi'].includes(x.type) && (x.options || []).length < 2); if (bad) throw new Error('Add at least two choices for: ' + bad.label);
        return { name, all, treatments: all ? [] : trs, questions: q }; } });
    if (r === 'del') { c.forms = c.forms.filter(x => x !== f); A.change('cfg', null, 'Consultation form deleted: ' + f.name); A.refresh(); return; }
    if (!r || typeof r !== 'object') { if (isNew) c.forms = c.forms.filter(x => x !== f); A.refresh(); return; }
    Object.assign(f, r); if (f.id === 'general') c.questions = f.questions;   // older website code still reads this
    A.change('cfg', null, (isNew ? 'Consultation form created: ' : 'Consultation form saved: ') + f.name); A.toast('Form saved'); A.refresh();
  }
})();
