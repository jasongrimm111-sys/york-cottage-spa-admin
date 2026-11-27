/* Consultation forms: the questions, and end-to-end encryption.
   The guest's browser encrypts the answers with York Cottage's public key (RSA-OAEP 2048 + AES-GCM), so only the
   signed-in admin portal, which holds the private key inside the encrypted sign-in vault, can read them.
   Shared by the admin portal and the website. */
(function (root) {
  const C = {};
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = u8 => { let s = ''; new Uint8Array(u8).forEach(c => s += String.fromCharCode(c)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };

  C.genKeys = async () => {
    const kp = await crypto.subtle.generateKey({ ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['encrypt', 'decrypt']);
    return { publicJwk: await crypto.subtle.exportKey('jwk', kp.publicKey), privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
  };
  // lock answers so only the portal can read them
  C.seal = async (publicJwk, obj) => {
    const pub = await crypto.subtle.importKey('jwk', publicJwk, RSA, false, ['encrypt']);
    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, te.encode(JSON.stringify(obj)));
    const k = await crypto.subtle.encrypt(RSA, pub, await crypto.subtle.exportKey('raw', aes));
    return { v: 1, alg: 'RSA-OAEP-256+A256GCM', k: b64(k), iv: b64(iv), ct: b64(ct) };
  };
  C.open = async (privateJwk, box) => {
    const priv = await crypto.subtle.importKey('jwk', privateJwk, RSA, false, ['decrypt']);
    const raw = await crypto.subtle.decrypt(RSA, priv, unb64(box.k));
    const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, aes, unb64(box.ct))));
  };

  // the starting questions (editable in Settings → Consultation form)
  C.defaults = () => [
    { id: 'pregnant', type: 'yesno', label: 'Are you pregnant, or could you be?', detail: 'How many weeks?' },
    { id: 'heart', type: 'yesno', label: 'Do you have a heart condition, or high or low blood pressure?', detail: 'Please tell us more' },
    { id: 'medical', type: 'yesno', label: 'Do you have diabetes, epilepsy, a blood clotting condition or any other medical condition?', detail: 'Please tell us more' },
    { id: 'meds', type: 'yesno', label: 'Are you taking any medication?', detail: 'Which ones?' },
    { id: 'allergy', type: 'yesno', label: 'Do you have any allergies (for example nuts, essential oils, latex or skincare products)?', detail: 'What are you allergic to?' },
    { id: 'skin', type: 'yesno', label: 'Any skin conditions, cuts, recent sunburn, or cosmetic treatments (peels, injectables, laser) in the last 2 weeks?', detail: 'Please tell us more' },
    { id: 'injury', type: 'yesno', label: 'Any injuries, recent surgery, or areas you’d like us to avoid?', detail: 'Where, and what happened?' },
    { id: 'pressure', type: 'choice', label: 'Preferred massage pressure', options: ['Light', 'Medium', 'Firm', 'Not sure'] },
    { id: 'other', type: 'text', label: 'Anything else your therapist should know?' }
  ];
  // forms (user 2026-11-27): several forms, each used for some treatments (or all). A guest gets every form that
  // matches their treatments, as one combined form. Older set-ups had one list of questions: that becomes the first form.
  C.forms = c => { c = c || {}; if (!Array.isArray(c.forms) || !c.forms.length) c.forms = [{ id: 'general', name: 'Health & wellbeing', all: true, treatments: [], questions: (c.questions && c.questions.length ? c.questions : C.defaults()) }]; return c.forms; };
  C.formsFor = (c, tids) => C.forms(c).filter(f => f.all || (f.treatments || []).some(t => (tids || []).includes(t)));
  // the questions for some forms, each form's questions under its name (when there's more than one)
  C.questionsFor = (c, forms) => { const out = [], seen = new Set();
    forms.forEach(f => { if (forms.length > 1 && f.questions.length) out.push({ id: 'h_' + f.id, type: 'heading', label: f.name });
      f.questions.forEach(q => { if (seen.has(q.id)) return; seen.add(q.id); out.push(q); }); });
    return out; };
  // which treatments a guest is having (booking items for that guest)
  C.guestTreatments = (b, g) => (b.items || []).filter(i => +i.guest === +g).flatMap(i => [i.tid, ...(i.with || [])]).filter(Boolean);
  // short form ids for each guest, for the online link: "general.massage|general"
  C.linkForms = (c, b) => { const n = Math.max(1, +b.guests || (b.guestList || []).length || 1); return Array.from({ length: n }, (_, g) => C.formsFor(c, C.guestTreatments(b, g)).map(f => f.id).join('.')).join('|'); };
  C.TYPES = [['yesno', 'Yes / no (+ details)'], ['choice', 'Pick one'], ['multi', 'Pick any'], ['short', 'Short answer'], ['text', 'Written answer'], ['date', 'Date'], ['heading', 'Section heading'], ['info', 'Information (no answer)']];
  C.consentText = 'The information I’ve given is correct to the best of my knowledge. I’ll tell my therapist before my treatment if anything changes.';
  // which answers a therapist should look at first
  C.flags = (qs, answers) => (qs || []).filter(q => { const a = (answers || {})[q.id]; if (!a) return false;
    if (q.type === 'yesno') return !!a.yes;
    const fl = (q.flagOn || []).map(x => x.toLowerCase()); if (!fl.length) return false;
    return (Array.isArray(a) ? a : [a]).some(x => fl.includes(String(x).toLowerCase())); }).map(q => q.label);

  // the form, as HTML (used by the website page and the tablet form in the portal)
  C.formHTML = (qs, opt = {}) => {
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const q = x => {
      if (x.type === 'yesno') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}</legend><div class="cq-yn"><label><input type="radio" name="q_${x.id}" value="no"> No</label><label><input type="radio" name="q_${x.id}" value="yes"> Yes</label></div><textarea class="cq-detail" name="d_${x.id}" rows="2" placeholder="${esc(x.detail || 'Please tell us more')}" hidden></textarea></fieldset>`;
      const help = x.help ? `<p class="cq-help">${esc(x.help)}</p>` : '', req = x.required ? ' <span class="cq-req">*</span>' : '';
      if (x.type === 'heading') return `<h3 class="cq-h">${esc(x.label)}</h3>${help}`;
      if (x.type === 'info') return `<div class="cq-info"><b>${esc(x.label)}</b>${help}</div>`;
      if (x.type === 'choice') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<div class="cq-yn">${(x.options || []).map(o => `<label><input type="radio" name="q_${x.id}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></fieldset>`;
      if (x.type === 'multi') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<div class="cq-yn">${(x.options || []).map(o => `<label><input type="checkbox" name="q_${x.id}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></fieldset>`;
      if (x.type === 'short') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<input class="cq-in" name="q_${x.id}" autocomplete="off"></fieldset>`;
      if (x.type === 'date') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<input class="cq-in" type="date" name="q_${x.id}"></fieldset>`;
      return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<textarea name="q_${x.id}" rows="3"></textarea></fieldset>`;
    };
    return `<form class="cform-q" novalidate>
      <div class="cq-row"><label class="cq-f"><span>Your full name</span><input name="name" required autocomplete="name" value="${esc(opt.name || '')}"></label><label class="cq-f"><span>Date of birth</span><input name="dob" type="date" required></label></div>
      ${(qs || []).map(q).join('')}
      <label class="cq-consent"><input type="checkbox" name="consent" required> <span>${esc(C.consentText)}</span></label>
      <label class="cq-f"><span>Type your full name to sign</span><input name="sign" required autocomplete="off"></label>
      <p class="cq-msg" role="alert"></p>
    </form>`;
  };
  C.answerText = (q, a) => { if (a == null || a === '' || (Array.isArray(a) && !a.length)) return '—'; if (q.type === 'yesno') return a.yes ? 'Yes' + (a.detail ? ' · ' + a.detail : '') : 'No'; return Array.isArray(a) ? a.join(', ') : String(a); };
  C.wireForm = root => root.querySelectorAll('.cq[data-q]').forEach(fs => fs.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => { const d = fs.querySelector('.cq-detail'); if (d) d.hidden = !(fs.querySelector('input[value=yes]') || {}).checked; })));
  // read + check; returns { ok, answers, msg }
  C.readForm = (root, qs) => {
    const f = root.querySelector('form'), v = n => (f.elements[n] || {}).value || '', ans = {};
    if (!v('name').trim()) return { ok: false, msg: 'Please add your name' };
    if (!v('dob')) return { ok: false, msg: 'Please add your date of birth' };
    for (const q of qs || []) {
      if (q.type === 'heading' || q.type === 'info') continue;
      if (q.type === 'multi') { ans[q.id] = [...f.querySelectorAll(`input[name="q_${q.id}"]:checked`)].map(x => x.value); if (q.required && !ans[q.id].length) return { ok: false, msg: 'Please answer: ' + q.label }; continue; }
      if (q.type === 'yesno') { const r = f.querySelector(`input[name="q_${q.id}"]:checked`); if (!r) return { ok: false, msg: 'Please answer: ' + q.label }; ans[q.id] = { yes: r.value === 'yes', detail: r.value === 'yes' ? v('d_' + q.id).trim() : '' }; if (ans[q.id].yes && !ans[q.id].detail) return { ok: false, msg: 'Please add a little detail for: ' + q.label }; }
      else if (q.type === 'choice') { const r = f.querySelector(`input[name="q_${q.id}"]:checked`); ans[q.id] = r ? r.value : ''; if (q.required && !ans[q.id]) return { ok: false, msg: 'Please answer: ' + q.label }; }
      else { ans[q.id] = v('q_' + q.id).trim(); if (q.required && !ans[q.id]) return { ok: false, msg: 'Please answer: ' + q.label }; }
    }
    if (!f.elements.consent.checked) return { ok: false, msg: 'Please tick to confirm the information is correct' };
    if (!v('sign').trim()) return { ok: false, msg: 'Please type your name to sign' };
    return { ok: true, answers: { name: v('name').trim(), dob: v('dob'), a: ans, consent: true, sign: v('sign').trim(), signedAt: new Date().toISOString(), questions: qs } };
  };
  C.css = `.cform-q{display:flex;flex-direction:column;gap:14px}.cq{border:1px solid rgba(35,40,35,.14);border-radius:12px;padding:12px 14px;background:#fff}.cq legend{font-weight:600;padding:0 4px;font-size:15px}
    .cq-yn{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}.cq-yn label{display:flex;align-items:center;gap:7px;border:1px solid rgba(35,40,35,.2);border-radius:99px;padding:7px 14px;cursor:pointer;font-size:15px}
    .cq-yn input{accent-color:#2f3b32;width:18px;height:18px}.cq textarea,.cq-f input{width:100%;border:1px solid rgba(35,40,35,.2);border-radius:9px;padding:9px 11px;font:inherit;font-size:16px;margin-top:8px;background:#fff}
    .cq-row{display:grid;grid-template-columns:2fr 1fr;gap:12px}.cq-f span{font-size:13px;font-weight:600}.cq-consent{display:flex;gap:10px;align-items:flex-start;font-size:15px}.cq-consent input{width:20px;height:20px;margin-top:2px;accent-color:#2f3b32}
    .cq-msg{color:#b0413e;font-weight:600;min-height:20px}.cq-h{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:26px;margin:10px 0 0}.cq-help{font-size:14px;color:#6b6f68;margin:4px 0 0}.cq-req{color:#b0413e}
    .cq-info{border-left:3px solid #b4785a;background:#fbf8f3;border-radius:8px;padding:10px 14px;font-size:15px}.cq-info .cq-help{margin-top:4px}.cq-in{width:100%;border:1px solid rgba(35,40,35,.2);border-radius:9px;padding:9px 11px;font:inherit;font-size:16px;margin-top:8px;background:#fff}@media(max-width:600px){.cq-row{grid-template-columns:1fr}}`;
  if (typeof module !== 'undefined') module.exports = C; else root.YCConsult = C;
})(this);
