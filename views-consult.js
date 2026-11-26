/* Consultation forms in the portal: fill in on a tablet, view completed forms, settings. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore, C = window.YCConsult;
  const { $, $$, esc, fd, fdy, ft, today, uid } = A;
  const cc = () => { const c = A.cfg(); c.consult = c.consult || { questions: null, endpoint: '', retentionMonths: 24, publicKey: null }; if (!c.consult.questions) c.consult.questions = C.defaults(); return c.consult; };
  A.consultCfg = cc;
  const token = b => { if (!b.consultToken) { b.consultToken = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8); A.change('booking', b); } return b.consultToken; };
  // the guest's own link (only when the online form is set up)
  A.consultURL = b => { const c = cc(); return c.endpoint && c.publicKey ? A.siteURL() + `consult.html?ref=${encodeURIComponent(b.ref)}&t=${token(b)}` : ''; };
  const guestName = (b, g) => (b.guestList[g] || {}).name || (g === 0 ? A.cust(b) : 'Guest ' + (g + 1));
  if (!document.getElementById('consult-css')) { const st = document.createElement('style'); st.id = 'consult-css'; st.textContent = C.css; document.head.appendChild(st); }

  // fill in on a tablet (reception hands it to the guest)
  A.fillConsult = async (b, g) => {
    const c = cc();
    if (!c.publicKey) { if (await A.confirm('Set up the form first', 'The consultation form needs its encryption key. Create it now in Settings → Consultation form?', 'Go to Settings', false)) location.hash = '#/settings/consult'; return; }
    const r = await A.modal({ title: 'Consultation form', size: 'wide', ok: 'Submit the form', cancel: 'Close',
      body: `<p class="muted">${esc(guestName(b, g))} · ${esc(A.pname(b.product))} · ${fdy(b.date)}. Hand the tablet to the guest. Their answers are encrypted as soon as they submit.</p>${C.formHTML(c.questions, { name: (b.guestList[g] || {}).name || (g === 0 ? A.cust(b) : '') })}`,
      onOpen: m => C.wireForm(m),
      onOk: async m => { const v = C.readForm(m, c.questions); if (!v.ok) { $('.cq-msg', m).textContent = v.msg; throw new Error(v.msg); } const sealed = await C.seal(c.publicKey, v.answers); await St.saveConsult(b, g, sealed, 'tablet'); return v.answers; } });
    if (!r) return;
    b.guestList[g].consult = 'done'; if (r.name && !b.guestList[g].name && g > 0) b.guestList[g].name = r.name;
    (b.history = b.history || []).push({ at: new Date().toISOString(), by: St.S.user.name, what: `Consultation form completed on the tablet for ${guestName(b, g)}` });
    A.change('booking', b, 'Consultation form: ' + b.ref); A.toast('Form saved (encrypted)'); A.refresh();
  };
  // read completed forms
  A.viewConsults = async (b, g) => {
    let list = []; try { list = await St.listConsults(b); } catch (e) { A.toast('Couldn’t load the forms: ' + e.message); return; }
    if (g != null) list = list.filter(x => +x.g === +g || x.g === 'all');
    if (!list.length) { A.toast('No form yet' + (g != null ? ' for ' + guestName(b, g) : '')); return; }
    const key = await St.consultKey().catch(() => null);
    if (!key) { A.toast('This login can’t open forms yet. The owner creates the key in Settings → Consultation form.'); return; }
    const opened = [];
    for (const x of list) { try { opened.push({ x, f: await C.open(key, x.sealed) }); } catch (e) { opened.push({ x, err: true }); } }
    const show = ({ x, f, err }) => err ? `<div class="note bad">A form from ${ft(x.at)} couldn’t be opened (it was made with an older key).</div>` : `<div class="card" style="margin-bottom:12px">
      <div class="card-h"><h3>${esc(f.name)}</h3><span class="small muted">${x.via === 'online' ? 'Online' : 'On the tablet'} · ${ft(f.signedAt || x.at)}</span></div>
      ${C.flags(f.questions, f.a).length ? `<div class="note warn" style="margin-bottom:10px"><b>Check before the treatment:</b> ${C.flags(f.questions, f.a).map(esc).join(' · ')}</div>` : '<div class="note ok" style="margin-bottom:10px">Nothing flagged</div>'}
      <dl class="kv"><dt>Date of birth</dt><dd>${esc(f.dob)}</dd>${(f.questions || []).map(q => { const a = (f.a || {})[q.id]; const v = q.type === 'yesno' ? (a ? (a.yes ? '<b style="color:var(--warn)">Yes</b>' + (a.detail ? ' · ' + esc(a.detail) : '') : 'No') : '—') : esc(a || '—'); return `<dt>${esc(q.label)}</dt><dd>${v}</dd>`; }).join('')}
      <dt>Signed</dt><dd>${esc(f.sign)} · ${f.consent ? 'confirmed the information is correct' : ''}</dd></dl></div>`;
    St.audit(`Consultation form viewed: ${b.ref}`, b.ref); St.touch('audit');
    await A.modal({ title: 'Consultation form' + (opened.length > 1 ? 's' : ''), size: 'wide', ok: 'Close', cancel: '', foot: '<button class="btn" onclick="print()" style="margin-right:auto">Print</button>', body: `<p class="small muted">${esc(A.cust(b))} · ${b.ref} · ${fdy(b.date)}. Health information: keep it private, and don’t copy it into notes.</p>${opened.map(show).join('')}` });
  };

  // Settings → Consultation form
  A.consultSettings = () => {
    const c = cc(), S = St.S;
    const qRow = (q, i) => `<tr data-qi="${i}"><td style="width:150px"><select class="inp qt">${[['yesno', 'Yes / no (+ details)'], ['choice', 'Pick one'], ['text', 'Written answer']].map(([v, t]) => `<option value="${v}" ${q.type === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td><td><input class="inp ql" value="${esc(q.label)}" placeholder="Question"><input class="inp qd" style="margin-top:6px" value="${esc(q.type === 'choice' ? (q.options || []).join(', ') : q.detail || '')}" placeholder="${q.type === 'choice' ? 'Choices, separated by commas' : 'Details prompt (for yes answers)'}"></td><td style="width:110px;white-space:nowrap"><button type="button" class="icon-btn qup" title="Move up">↑</button><button type="button" class="icon-btn qdn" title="Move down">↓</button><button type="button" class="icon-btn qrm" title="Remove">${A.ic.x}</button></td></tr>`;
    const html = `<div class="card" style="max-width:980px"><div class="card-h"><h3>How it works</h3></div>
        <ol class="steps-list" style="color:var(--ink)"><li><b>Before the visit:</b> the before-the-visit email has a personal link to the form on the website (once the online address below is set up).</li><li><b>On arrival:</b> reception opens the booking and taps <b>Fill in on the tablet</b> for each guest.</li><li>Answers are encrypted in the guest’s browser. Only this portal can read them; therapists see them on their day sheet.</li></ol></div>
      <div class="card" style="max-width:980px"><div class="card-h"><h3>Encryption key</h3>${c.publicKey ? '<span class="badge ok">Set up</span>' : '<span class="badge warn">Not set up</span>'}</div>
        ${c.publicKey ? `<p>Forms are encrypted with York Cottage’s key. The private half is kept inside the sign-in vault, so any signed-in user (including therapists) can read forms, and nobody else can.</p>` : `<p>Create the key once. ${S.user.role === 'owner' ? '' : 'Only the owner can do this.'}</p>${S.user.role === 'owner' ? '<button class="btn pri" id="mkKey" style="margin-top:10px">Create the encryption key</button>' : ''}`}</div>
      <div class="card" style="max-width:980px"><div class="card-h"><h3>Online form</h3>${c.endpoint ? '<span class="badge ok">On</span>' : '<span class="badge">Off: guests fill it in on arrival</span>'}</div>
        <p class="muted" style="margin-bottom:10px">The address of the small receiving service (a free Cloudflare Worker, see consult-worker/README.md in the website folder). It only ever receives encrypted forms and files them in the private data store.</p>
        <div class="row r2">${A.f.text('endpoint', 'Receiving address', c.endpoint || '', { ph: 'https://yc-consult.example.workers.dev' })}${A.f.num('retentionMonths', 'Delete forms after (months)', c.retentionMonths || 24, { hint: 'Keep them only as long as you need them (UK GDPR)' })}</div>
        <button class="btn" id="saveEnd" style="margin-top:10px">Save</button></div>
      <div class="card" style="max-width:980px"><div class="card-h"><h3>Questions</h3><div style="display:flex;gap:8px"><button class="btn sm" id="qReset">Reset to the standard questions</button><button class="btn sm" id="qAdd">${A.ic.plus} Add a question</button></div></div>
        <p class="muted" style="margin-bottom:10px">Name, date of birth, a confirmation tick and a typed signature are always included. “Yes” answers to yes/no questions are flagged for the therapist.</p>
        <table class="tbl" id="qT"><tbody>${c.questions.map(qRow).join('')}</tbody></table><button class="btn pri" id="qSave" style="margin-top:12px">Save the questions</button>
        <details style="margin-top:14px"><summary class="btn sm ghost" style="display:inline-flex">Preview the form</summary><div style="margin-top:10px;max-width:640px">${C.formHTML(c.questions)}</div></details></div>`;
    const wire = el => {
      const mk = $('#mkKey', el); if (mk) mk.onclick = async () => { mk.disabled = true; mk.textContent = 'Creating…'; try { c.publicKey = await St.makeConsultKey(); A.change('cfg', null, 'Consultation form key created'); A.toast('Key created'); A.refresh(); } catch (e) { A.toast(e.message); mk.disabled = false; } };
      $('#saveEnd', el).onclick = () => { const v = A.read(el); c.endpoint = (v.endpoint || '').replace(/\/$/, ''); c.retentionMonths = v.retentionMonths || 24; A.change('cfg', null, 'Online consultation form settings saved'); A.toast('Saved'); A.refresh(); };
      const read = () => $$('#qT tr', el).map((tr, i) => { const old = c.questions[+tr.dataset.qi] || {}, type = $('.qt', tr).value, label = $('.ql', tr).value.trim(), d = $('.qd', tr).value.trim(); return label ? { id: old.id || uid('q'), type, label, ...(type === 'choice' ? { options: d.split(',').map(s => s.trim()).filter(Boolean) } : type === 'yesno' ? { detail: d } : {}) } : null; }).filter(Boolean);
      $('#qSave', el).onclick = () => { c.questions = read(); A.change('cfg', null, 'Consultation questions saved'); A.toast('Saved'); A.refresh(); };
      $('#qAdd', el).onclick = () => { c.questions = read(); c.questions.push({ id: uid('q'), type: 'yesno', label: '', detail: '' }); A.refresh(); };
      $('#qReset', el).onclick = async () => { if (await A.confirm('Use the standard questions?', 'Your own questions are replaced.', 'Reset')) { c.questions = C.defaults(); A.change('cfg', null, 'Consultation questions reset'); A.refresh(); } };
      el.addEventListener('click', e => { const tr = e.target.closest('#qT tr'); if (!tr) return; const i = +tr.dataset.qi, q = read();
        if (e.target.closest('.qrm')) { q.splice(i, 1); c.questions = q; A.refresh(); }
        if (e.target.closest('.qup') && i > 0) { [q[i - 1], q[i]] = [q[i], q[i - 1]]; c.questions = q; A.refresh(); }
        if (e.target.closest('.qdn') && i < q.length - 1) { [q[i + 1], q[i]] = [q[i], q[i + 1]]; c.questions = q; A.refresh(); } });
      $$('#qT .qt', el).forEach(s => s.onchange = () => { c.questions = read(); A.refresh(); });
      C.wireForm(el);
    };
    return { html, wire };
  };
})();
