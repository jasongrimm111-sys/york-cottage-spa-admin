/* Consultation forms: the questions, and end-to-end encryption.
   The guest's browser encrypts the answers with York Cottage's public key (RSA-OAEP 2048 + AES-GCM), so only the
   signed-in admin portal, which holds the private key inside the encrypted sign-in vault, can read them.
   Shared by the admin portal and the website. */
(function (root) {
  const C = {};
  // a properly formed email address: name@domain.tld, no spaces, no double dots, a real-looking ending
  C.validEmail = v => { v = String(v || '').trim(); if (!v || v.length > 254) return false;
    const m = /^([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+)@((?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,})$/.exec(v);
    return !!m && m[1].length <= 64 && m[1][0] !== '.' && m[1].slice(-1) !== '.' && !m[1].includes('..'); };
  C.DIAL = [['+44', '🇬🇧 +44'], ['+353', '🇮🇪 +353'], ['+33', '🇫🇷 +33'], ['+49', '🇩🇪 +49'], ['+34', '🇪🇸 +34'], ['+39', '🇮🇹 +39'], ['+31', '🇳🇱 +31'], ['+32', '🇧🇪 +32'], ['+351', '🇵🇹 +351'], ['+41', '🇨🇭 +41'], ['+48', '🇵🇱 +48'], ['+46', '🇸🇪 +46'], ['+47', '🇳🇴 +47'], ['+45', '🇩🇰 +45'], ['+30', '🇬🇷 +30'], ['+1', '🇺🇸 🇨🇦 +1'], ['+61', '🇦🇺 +61'], ['+64', '🇳🇿 +64'], ['+27', '🇿🇦 +27'], ['+971', '🇦🇪 +971'], ['+91', '🇮🇳 +91'], ['+86', '🇨🇳 +86'], ['+81', '🇯🇵 +81']];
  // the number without its dialling code or leading 0, e.g. "07700 900123" → "7700 900123"
  C.national = v => String(v || '').trim().replace(/^0+(?=\d)/, '');
  C.splitPhone = v => { v = String(v || '').trim(); if (!v) return { code: '+44', num: '' };
    const d = C.DIAL.map(x => x[0]).sort((a, b) => b.length - a.length).find(c => v.replace(/[\s()-]/g, '').startsWith(c) || v.startsWith('00' + c.slice(1)));
    if (d) { const rest = v.replace(/[\s()-]/g, '').startsWith(d) ? v.replace(/^\s*\+?\s*/, '').slice(d.length - 1) : v.slice(d.length + 1); return { code: d, num: C.national(rest.trim()) }; }
    return { code: '+44', num: C.national(v) }; };
  C.validNational = v => { const n = C.national(v), d = n.replace(/[^\d]/g, ''); return d.length >= 7 && d.length <= 12 && /^[\d\s()-]+$/.test(n); };
  C.validPhone = v => { const d = String(v || '').replace(/[^\d]/g, ''); return d.length >= 10 && d.length <= 15 && /^[\d\s+()-]+$/.test(String(v).trim()); };
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
  // the default form: York Cottage's own Treatment Consultation (copied from their Wix form, user 2026-11-27)
  const YN = (id, label) => ({ id, type: 'yesno', label, detail: '' });
  C.defaults = () => [
    { id: 'welcome', type: 'info', label: 'Welcome to York Cottage', help: 'We hope you have a wonderful time. We’re on hand to help make your day extra special, so please let us know if we can help in any way.\nPlease take a minute to fill in the following before your treatment.' },
    { id: 'gender', type: 'choice', label: 'Gender', options: ['Male', 'Female', 'Non-Binary', 'Other / Prefer not to say'], required: true },
    { id: 'email', type: 'short', label: 'Email', fill: 'email', required: true },
    { id: 'phone', type: 'short', label: 'Phone number', fill: 'phone' },
    { id: 'news', type: 'optin', label: 'Yes, send me special offers and news from York Cottage Spa by email', help: 'You can unsubscribe at any time.' },
    { id: 'h_health', type: 'heading', label: 'General health' },
    { id: 'gp', type: 'short', label: 'GP', help: 'Your doctor’s name and surgery' },
    { id: 'stress', type: 'choice', label: 'How would you describe your stress levels?', options: ['Low', 'Medium', 'High'], required: true },
    { id: 'energy', type: 'choice', label: 'How would you describe your energy levels?', options: ['Low', 'Medium', 'High'], required: true },
    YN('anxiety', 'Do you struggle with anxiety?'),
    YN('pain', 'Do you struggle with pain?'),
    YN('meds', 'Are you taking any medication?'),
    { id: 'massage_before', type: 'choice', label: 'Have you ever had a massage treatment before?', options: ['Yes', 'No'], required: true },
    { id: 'pregnant', type: 'choice', label: 'Could you be pregnant or are you trying to become pregnant?', options: ['I am', 'Yes', 'No'], flagOn: ['I am', 'Yes'], required: true },
    YN('breastfeeding', 'Are you breastfeeding?'),
    { id: 'h_cond', type: 'heading', label: 'Conditions / symptoms' },
    YN('bp', 'Unstable blood pressure'), YN('heart', 'Heart disorder'), YN('thrombosis', 'Thrombosis / embolism'), YN('osteoporosis', 'Osteoporosis'),
    YN('epilepsy', 'Epilepsy'), YN('diabetes', 'Diabetes'), YN('arthritis', 'Arthritis'), YN('skin', 'Skin disorders'), YN('haemorrhage', 'Recent haemorrhage'),
    YN('back', 'Back problems'), YN('oedema', 'Swelling / oedema'), YN('nervous', 'Dysfunction of the nervous system (e.g. MS)'), YN('cancer', 'Have you ever had, or do you have, cancer?'),
    YN('fractures', 'Do you have any recent fractures or sprains?'), YN('infectious', 'Any infectious diseases (e.g. chicken pox)?'), YN('allergies', 'Any allergies (e.g. nuts or oils)?'),
    YN('bruising', 'Any bruising, cuts, abrasions or varicose veins?'), YN('surgery', 'Recent surgery, broken bones or scarring?'),
    { id: 'details', type: 'text', label: 'Please give details if you answered yes to any of the above' },
    { id: 'other', type: 'text', label: 'Any other conditions?', help: 'Write “None” if there aren’t any.', required: true },
    { id: 'h_consent', type: 'heading', label: 'Consent' },
    { id: 'consent_text', type: 'info', terms: true, label: 'Terms and conditions', help: 'York Cottage Spa Ltd. is a business registered in England with the number 12827276, registered address York Cottage, Easton Lane, Bozeat, NN29 7NN (“York Cottage Spa”).\nI understand that no therapist or other member of staff at York Cottage Spa will diagnose any illness, disease or any other physical or mental disorder, and does not prescribe pharmaceuticals or medical treatment.\nIt has been made clear to me that the treatments I receive at York Cottage Spa are not a substitute for any medical examinations and/or diagnoses, and that it is recommended that I see a medical practitioner for any physical or mental ailment I may have.\nBecause the therapist must be aware of any existing physical ailments or conditions of clients treated, I have stated any and all of my known medical conditions and, if necessary, give the therapist and/or York Cottage Spa permission to consult with my GP or the medical professional named above.\nI assume all risks and perils to my person physically, physiologically or psychologically which may ensue during this or subsequent visits to York Cottage Spa, including during treatments, as well as any effects deemed detrimental which may ensue afterwards as a result of this or subsequent visits and/or treatments.\nAll personal information given above will be stored by York Cottage Spa in digital form to keep the records required by regulatory bodies and industry best practice. Where I have given consent above, I understand I may receive updates, news and offers from York Cottage Spa from time to time by email.' }
  ];
  // the questions the first version shipped with: an untouched set-up moves to the new default form
  const OLD_DEFAULT_IDS = 'pregnant,heart,medical,meds,allergy,skin,injury,pressure,other';

  // forms (user 2026-11-27): several forms, each used for some treatments (or all). A guest gets every form that
  // matches their treatments, as one combined form. Older set-ups had one list of questions: that becomes the first form.
  C.forms = c => { c = c || {}; if (!Array.isArray(c.forms) || !c.forms.length) { const old = c.questions && c.questions.length && c.questions.map(q => q.id).join(',') !== OLD_DEFAULT_IDS; c.forms = [{ id: 'general', name: 'Treatment consultation', all: true, treatments: [], questions: old ? c.questions : C.defaults() }]; }
    // a form saved before the York Cottage questions arrived, still with only the first starting questions, gets them
    // the main form (id 'general') is always first and used for every treatment (user 2026-11-27)
    const mi = c.forms.findIndex(f => f.id === 'general'); if (mi > 0) c.forms.unshift(c.forms.splice(mi, 1)[0]); if (c.forms[0] && c.forms[0].id === 'general') { c.forms[0].all = true; c.forms[0].treatments = []; }
    c.forms.forEach(f => { if (f.id === 'general' && (f.questions || []).map(q => q.id).join(',') === OLD_DEFAULT_IDS) { f.questions = C.defaults(); c.questions = f.questions; } });
    return c.forms; };
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
  C.TYPES = [['yesno', 'Yes / no (+ details)'], ['choice', 'Pick one'], ['multi', 'Pick any'], ['short', 'Short answer'], ['text', 'Written answer'], ['date', 'Date'], ['heading', 'Section heading'], ['info', 'Information (no answer)'], ['optin', 'Marketing opt-in']];
  C.consentText = 'The information I’ve given is correct to the best of my knowledge.';
  const isTerms = q => q && q.type === 'info' && (q.terms || q.id === 'consent_text');
  // which answers a therapist should look at first
  C.flags = (qs, answers) => (qs || []).filter(q => { const a = (answers || {})[q.id]; if (!a) return false;
    if (q.type === 'yesno') return !!a.yes;
    const fl = (q.flagOn || []).map(x => x.toLowerCase()); if (!fl.length) return false;
    return (Array.isArray(a) ? a : [a]).some(x => fl.includes(String(x).toLowerCase())); }).map(q => q.label);

  // the form, as HTML (used by the website page and the tablet form in the portal)
  C.formHTML = (qs, opt = {}) => {
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const q = x => {
      if (x.type === 'yesno') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)} <span class="cq-req">*</span></legend><div class="cq-yn"><label><input type="radio" name="q_${x.id}" value="no"> No</label><label><input type="radio" name="q_${x.id}" value="yes"> Yes</label></div>${x.detail ? `<textarea class="cq-detail" name="d_${x.id}" rows="2" placeholder="${esc(x.detail)}" hidden></textarea>` : ''}</fieldset>`;
      const help = x.help ? `<p class="cq-help">${esc(x.help)}</p>` : '', req = x.required ? ' <span class="cq-req">*</span>' : '';
      if (x.type === 'optin') return `<label class="cq-consent cq-optin" data-q="${x.id}"><input type="checkbox" name="q_${x.id}" ${(opt.prefill || {}).optin ? 'checked' : ''}> <span><b>${esc(x.label)}</b>${x.help ? `<small>${esc(x.help)}</small>` : ''}</span></label>`;
      if (x.type === 'heading') return `<h3 class="cq-h">${esc(x.label)}</h3>${help}`;
      if (x.type === 'info') return `<div class="cq-info"><b>${esc(x.label)}</b>${help}</div>`;
      if (x.type === 'choice') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<div class="cq-yn">${(x.options || []).map(o => `<label><input type="radio" name="q_${x.id}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></fieldset>`;
      if (x.type === 'multi') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<div class="cq-yn">${(x.options || []).map(o => `<label><input type="checkbox" name="q_${x.id}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></fieldset>`;
      if (x.type === 'short' && x.fill === 'phone') { const ph = C.splitPhone((opt.prefill || {}).phone);
        return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<div class="cq-phone"><select class="cq-in cq-dial" name="qc_${x.id}" aria-label="Dialling code">${C.DIAL.map(([c, l]) => `<option value="${c}" ${c === ph.code ? 'selected' : ''}>${l}</option>`).join('')}</select><input class="cq-in" name="q_${x.id}" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="7700 900123" value="${esc(ph.num)}"></div></fieldset>`; }
      if (x.type === 'short') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<input class="cq-in" name="q_${x.id}" ${x.fill === 'email' ? 'type="email" autocomplete="email" inputmode="email"' : 'autocomplete="off"'} value="${esc(((opt.prefill || {})[x.fill]) || '')}"></fieldset>`;
      if (x.type === 'date') return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<input class="cq-in" type="date" name="q_${x.id}"></fieldset>`;
      return `<fieldset class="cq" data-q="${x.id}"><legend>${esc(x.label)}${req}</legend>${help}<textarea name="q_${x.id}" rows="3"></textarea></fieldset>`;
    };
    const terms = (qs || []).filter(isTerms); qs = (qs || []).filter(q => !isTerms(q));
    const body = []; let run = [];
    const flush = () => { if (run.length >= 3) body.push(`<div class="cq-grp" data-grp><div class="cq-grp-h"><span>Answer Yes to any that apply to you</span><button type="button" class="cq-none">None of these apply</button></div>${run.map(x => `<div class="cq-r" data-q="${x.id}"><span class="cq-rl">${esc(x.label)}</span><span class="cq-seg"><label><input type="radio" name="q_${x.id}" value="no"><b>No</b></label><label class="y"><input type="radio" name="q_${x.id}" value="yes"><b>Yes</b></label></span></div>`).join('')}</div>`); else run.forEach(x => body.push(q(x))); run = []; };
    (qs || []).forEach(x => { if (x.type === 'yesno' && !x.detail) run.push(x); else { flush(); body.push(q(x)); } }); flush();
    return `<form class="cform-q" novalidate><div class="cq-prog" aria-hidden="true"><i></i><span>Let’s get started</span></div>
      <div class="cq-row"><label class="cq-f"><span>Your full name</span><input name="name" required autocomplete="name" value="${esc(opt.name || '')}"></label><label class="cq-f"><span>Date of birth</span><input name="dob" type="date" required></label></div>
      ${body.join('')}
      ${terms.map(t => `<div class="cq-terms" hidden><div class="cq-terms-h"><b>${esc(t.label || 'Terms and conditions')}</b><button type="button" class="cq-terms-x">Close</button></div><div class="cq-terms-b">${String(t.help || '').split(String.fromCharCode(10)).filter(x => x.trim()).map(x => `<p>${esc(x)}</p>`).join('')}</div></div>`).join('')}
      <label class="cq-consent"><input type="checkbox" name="consent" required> <span>${terms.length ? `I have read and agree to the <a href="#" class="cq-tlink">${esc((terms[0].label || 'terms and conditions').toLowerCase())}</a>. ` : ''}${esc(opt.consent || C.consentText)}</span></label>
      <div class="cq-f"><span>Your signature</span><div class="cq-sig"><canvas width="900" height="260" aria-label="Sign here with your finger or mouse"></canvas><span class="cq-sig-ph">Sign here with your finger</span><button type="button" class="cq-sig-clear">Clear</button></div>
        <label class="cq-f" style="margin-top:8px"><span>Your full name (as your signature)</span><input name="sign" required autocomplete="off" value="${esc(opt.name || '')}"></label></div>
      <p class="cq-msg" role="alert"></p>
    </form>`;
  };
  C.splitIntro = qs => { const q0 = (qs || []).find(q => !['heading'].includes(q.type)); return q0 && q0.type === 'info' && !q0.terms && q0.id !== 'consent_text' && (qs || []).indexOf(q0) === 0 ? { intro: q0, rest: qs.slice(1) } : { intro: null, rest: qs || [] }; };
  C.answerText = (q, a) => { if (a == null || a === '' || (Array.isArray(a) && !a.length)) return '—'; if (q.type === 'optin') return a ? 'Yes, opted in' : 'No'; if (q.type === 'yesno') return a.yes ? 'Yes' + (a.detail ? ' · ' + a.detail : '') : 'No'; return Array.isArray(a) ? a.join(', ') : String(a); };
  C.wireSig = root => root.querySelectorAll('.cq-sig').forEach(box => {
    const cv = box.querySelector('canvas'), cx = cv.getContext('2d'); let down = false, last = null; box._drawn = false;
    cx.lineWidth = 4.5; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#1d2a22';
    const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    cv.addEventListener('pointerdown', e => { down = true; last = pt(e); cv.setPointerCapture(e.pointerId); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (!down) return; const p = pt(e); cx.beginPath(); cx.moveTo(last[0], last[1]); cx.lineTo(p[0], p[1]); cx.stroke(); last = p; if (!box._drawn) { box._drawn = true; box.classList.add('drawn'); } e.preventDefault(); });
    const up = () => { down = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    box.querySelector('.cq-sig-clear').onclick = () => { cx.clearRect(0, 0, cv.width, cv.height); box._drawn = false; box.classList.remove('drawn'); };
  });
  C.wireProgress = root => { const f = root.querySelector('form.cform-q'), bars = [...root.querySelectorAll('.cq-prog')]; if (!f || !bars.length) return;
    const upd = () => { const need = [...f.querySelectorAll('.cq[data-q], .cq-r[data-q]')].filter(x => x.querySelector('input[type=radio]') || x.querySelector('.cq-req'));
      const done = need.filter(x => [...x.querySelectorAll('input,textarea')].some(i => (i.type === 'radio' || i.type === 'checkbox') ? i.checked : i.value.trim())).length;
      const extra = [f.elements.name && f.elements.name.value.trim(), f.elements.dob && f.elements.dob.value, f.elements.consent && f.elements.consent.checked, f.querySelector('.cq-sig') && f.querySelector('.cq-sig')._drawn];
      const all = need.length + extra.length, got = done + extra.filter(Boolean).length, pc = all ? Math.round(got / all * 100) : 0;
      bars.forEach(bar => { bar.querySelector('i').style.width = pc + '%'; const t = bar.querySelector('span'); if (t) t.textContent = pc >= 100 ? (bar.dataset.short ? 'All done' : 'All done: send your answers below') : pc ? (bar.dataset.short ? pc + '%' : `${pc}% done`) : (bar.dataset.short ? '0%' : 'Let’s get started'); bar.classList.toggle('full', pc >= 100); }); };
    f.addEventListener('input', upd); f.addEventListener('change', upd); f.addEventListener('pointerup', () => setTimeout(upd, 50)); upd(); };
  C.wireKeys = root => { const f = root.querySelector('form.cform-q'); if (!f) return;
    f.querySelectorAll('.cq-phone input').forEach(i => i.addEventListener('blur', () => { const n = C.national(i.value); if (n !== i.value) { i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); } }));
    f.addEventListener('submit', e => e.preventDefault());
    const stops = () => { const seen = new Set(); return [...f.querySelectorAll('input,textarea,select,button')].filter(el => { if (el.disabled || el.type === 'hidden' || el.closest('[hidden]')) return false;
      if (el.type === 'radio') { if (seen.has(el.name)) return false; seen.add(el.name); } return true; }); };
    f.querySelectorAll('input:not([type=radio]):not([type=checkbox]),textarea').forEach(el => el.setAttribute('enterkeyhint', 'next'));
    const last = f.querySelector('[name=sign]'); if (last) last.setAttribute('enterkeyhint', 'done');
    f.addEventListener('keydown', e => {
      const el = e.target; if (e.key !== 'Enter' || e.shiftKey || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
      e.preventDefault();
      const list = stops(), cur = el.type === 'radio' ? list.find(x => x.name === el.name) : el, i = list.indexOf(cur), next = list[i + 1];
      if (next) { next.focus(); next.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else el.blur();
    }); };
  const units = (root, qs) => { const f = root.querySelector('form.cform-q'); if (!f) return []; const byId = {}; (qs || []).forEach(q => byId[q.id] = q); const out = [];
    const nameL = f.elements.name && f.elements.name.closest('label'), dobL = f.elements.dob && f.elements.dob.closest('label');
    if (nameL) out.push({ el: nameL, check: () => f.elements.name.value.trim() ? '' : 'Please add your full name' });
    if (dobL) out.push({ el: dobL, check: () => { const v = f.elements.dob.value; if (!v) return 'Please add your date of birth'; const d = new Date(v + 'T12:00:00'); return isNaN(d) || d > new Date() || d.getFullYear() < 1900 ? 'Please check your date of birth' : ''; } });
    f.querySelectorAll('[data-q]').forEach(el => { const q = byId[el.dataset.q]; if (!q || q.type === 'optin') return;
      const val = () => { const i = el.querySelector('input:not([type=radio]):not([type=checkbox]),textarea'); return i ? i.value.trim() : ''; };
      out.push({ el, q, check: () => {
        if (q.type === 'yesno') { const r = el.querySelector('input[type=radio]:checked'); if (!r) return 'Please choose No or Yes'; const d = el.querySelector('.cq-detail'); return r.value === 'yes' && q.detail && d && !d.value.trim() ? 'Please add a little detail' : ''; }
        if (q.type === 'choice') return q.required && !el.querySelector('input:checked') ? 'Please choose one' : '';
        if (q.type === 'multi') return q.required && !el.querySelector('input:checked') ? 'Please choose at least one' : '';
        const v = val();
        if (q.required && !v) return q.fill === 'email' ? 'Please add your email address' : 'Please answer this question';
        if (v && q.fill === 'email' && !C.validEmail(v)) return 'That doesn’t look like an email address, e.g. name@example.com';
        if (v && q.fill === 'phone' && !C.validNational(v)) return 'Please check the phone number, e.g. 7700 900123';
        return ''; } }); });
    const cons = f.querySelector('.cq-consent:not(.cq-optin)'); if (cons) out.push({ el: cons, check: () => f.elements.consent.checked ? '' : 'Please tick to agree before you send' });
    const sig = f.querySelector('.cq-sig'); if (sig) out.push({ el: sig, check: () => sig._drawn ? '' : 'Please sign in the box' });
    const signL = f.elements.sign && f.elements.sign.closest('label'); if (signL) out.push({ el: signL, check: () => f.elements.sign.value.trim() ? '' : 'Please add your full name under your signature' });
    return out; };
  const mark = (u, msg) => { u.el.classList.toggle('cq-bad', !!msg); let e = u.el.querySelector(':scope > .cq-err') || (u.el.nextElementSibling && u.el.nextElementSibling.classList.contains('cq-err') ? u.el.nextElementSibling : null);
    if (!msg) { if (e) e.remove(); return; }
    if (!e) { e = document.createElement('p'); e.className = 'cq-err'; e.setAttribute('role', 'alert'); if (u.el.matches('.cq-sig,.cq-consent')) u.el.after(e); else u.el.appendChild(e); }
    e.textContent = msg; };
  C.wireValidate = (root, qs) => { const us = units(root, qs); if (!us.length) return; const f = root.querySelector('form.cform-q'), seen = new Set();
    const idx = el => us.findIndex(u => u.el === el || u.el.contains(el));
    const visit = i => { if (i < 0) return; seen.add(i); mark(us[i], us[i].check());
      for (let j = 0; j < i; j++) if (!seen.has(j)) { seen.add(j); const m = us[j].check(); if (m) mark(us[j], m); } };   // questions they skipped
    f.addEventListener('focusout', e => { const i = idx(e.target); if (i < 0) return; setTimeout(() => { if (us[i].el.contains(document.activeElement)) return; visit(i); }, 0); });
    f.addEventListener('change', e => { const i = idx(e.target); if (i < 0) return; if (e.target.type === 'radio' || e.target.type === 'checkbox') visit(i); else if (us[i].el.classList.contains('cq-bad')) mark(us[i], us[i].check()); });
    f.addEventListener('input', e => { const i = idx(e.target); if (i >= 0 && us[i].el.classList.contains('cq-bad')) mark(us[i], us[i].check()); });
    f.addEventListener('change', e => { if (!e.target.matches || !e.target.matches('[data-grp]')) return; us.forEach((u, i) => { if (e.target.contains(u.el)) { seen.add(i); mark(u, u.check()); } }); });
    f.addEventListener('pointerup', e => { const s = e.target.closest('.cq-sig'); if (s) setTimeout(() => { const i = idx(s); if (i >= 0) visit(i); }, 30); });
    // the "questions still need an answer" note counts down live, and goes once everything is answered
    const note = () => { const m = f.querySelector('.cq-msg'); if (!m || !m.textContent) return; const n = f.querySelectorAll('.cq-bad').length;
      m.textContent = n ? (n === 1 ? 'One question still needs an answer: it’s highlighted above.' : `${n} questions still need an answer: they’re highlighted above.`) : ''; };
    ['input', 'change', 'focusout', 'pointerup'].forEach(ev => f.addEventListener(ev, () => setTimeout(note, 60)));
    f._units = us; };
  C.checkAll = (root, qs) => { const f = root.querySelector('form.cform-q'), us = (f && f._units) || units(root, qs); let first = null, n = 0;
    us.forEach(u => { const m = u.check(); mark(u, m); if (m) { n++; if (!first) first = u.el; } }); return { n, first }; };
  C.fillForm = (root, qs, prev) => { const f = root.querySelector('form.cform-q'); if (!f || !prev) return; const a = prev.a || {};
    const set = (n, v) => { const el = f.elements[n]; if (el && v != null && !(el instanceof RadioNodeList)) el.value = v; };
    set('name', prev.name); set('dob', prev.dob);
    for (const q of qs || []) { const v = a[q.id]; if (v == null) continue;
      if (q.type === 'yesno') { const r = f.querySelector(`input[name="q_${q.id}"][value="${v.yes ? 'yes' : 'no'}"]`); if (r) r.checked = true; const d = f.elements['d_' + q.id]; if (d && !(d instanceof RadioNodeList)) { d.value = v.detail || ''; d.hidden = !v.yes; } }
      else if (q.type === 'choice') { f.querySelectorAll(`input[name="q_${q.id}"]`).forEach(r => { r.checked = r.value === v; }); }
      else if (q.type === 'multi') { f.querySelectorAll(`input[name="q_${q.id}"]`).forEach(r => { r.checked = (v || []).includes(r.value); }); }
      else if (q.type === 'optin') { const c = f.elements['q_' + q.id]; if (c) c.checked = !!v; }
      else if (q.fill === 'phone') { const ph = C.splitPhone(v); const c = f.elements['qc_' + q.id]; if (c) c.value = ph.code; set('q_' + q.id, ph.num); }
      else set('q_' + q.id, v); }
    f.dispatchEvent(new Event('change', { bubbles: true })); };
  C.wireForm = (root, qs) => { C.wireSig(root); C.wireKeys(root); if (qs) C.wireValidate(root, qs);
    root.querySelectorAll('.cq-tlink').forEach(a => a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const f = a.closest('form'), t = f && f.querySelector('.cq-terms'); if (!t) return; t.hidden = !t.hidden; if (!t.hidden) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }));
    root.querySelectorAll('.cq-terms-x').forEach(b => b.onclick = () => { b.closest('.cq-terms').hidden = true; });
    root.querySelectorAll('[data-grp]').forEach(g => { const b = g.querySelector('.cq-none'); b.onclick = () => { g.querySelectorAll('input[value=no]').forEach(i => { i.checked = true; }); g.dispatchEvent(new Event('change', { bubbles: true })); }; }); root.querySelectorAll('.cq[data-q]').forEach(fs => fs.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => { const d = fs.querySelector('.cq-detail'); if (d) d.hidden = !(fs.querySelector('input[value=yes]') || {}).checked; }))); C.wireProgress(root); };
  // read + check; returns { ok, answers, msg }
  C.readForm = (root, qs) => {
    const f = root.querySelector('form'), v = n => (f.elements[n] || {}).value || '', ans = {};
    const chk = C.checkAll(root, qs); if (chk.n) { if (chk.first) chk.first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return { ok: false, first: chk.first, msg: chk.n === 1 ? 'One question still needs an answer: it’s highlighted above.' : `${chk.n} questions still need an answer: they’re highlighted above.` }; }
    if (!v('name').trim()) return { ok: false, msg: 'Please add your name' };
    if (!v('dob')) return { ok: false, msg: 'Please add your date of birth' };
    for (const q of qs || []) {
      if (q.type === 'heading' || q.type === 'info') continue;
      if (q.type === 'optin') { ans[q.id] = !!(f.elements['q_' + q.id] || {}).checked; continue; }
      if (q.type === 'multi') { ans[q.id] = [...f.querySelectorAll(`input[name="q_${q.id}"]:checked`)].map(x => x.value); if (q.required && !ans[q.id].length) return { ok: false, msg: 'Please answer: ' + q.label }; continue; }
      if (q.type === 'yesno') { const r = f.querySelector(`input[name="q_${q.id}"]:checked`); if (!r) return { ok: false, msg: 'Please answer: ' + q.label }; ans[q.id] = { yes: r.value === 'yes', detail: r.value === 'yes' ? v('d_' + q.id).trim() : '' }; if (ans[q.id].yes && q.detail && !ans[q.id].detail) return { ok: false, msg: 'Please add a little detail for: ' + q.label }; }
      else if (q.type === 'choice') { const r = f.querySelector(`input[name="q_${q.id}"]:checked`); ans[q.id] = r ? r.value : ''; if (q.required && !ans[q.id]) return { ok: false, msg: 'Please answer: ' + q.label }; }
      else { ans[q.id] = v('q_' + q.id).trim(); if (q.fill === 'phone' && ans[q.id]) ans[q.id] = (v('qc_' + q.id) || '+44') + ' ' + C.national(ans[q.id]); if (q.required && !ans[q.id]) return { ok: false, msg: 'Please answer: ' + q.label }; }
    }
    if (!f.elements.consent.checked) return { ok: false, msg: 'Please tick to confirm the information is correct' };
    const sig = root.querySelector('.cq-sig');
    if (sig && !sig._drawn) return { ok: false, msg: 'Please sign in the signature box' };
    if (!v('sign').trim()) return { ok: false, msg: 'Please add your full name under your signature' };
    const sigImg = sig ? sig.querySelector('canvas').toDataURL('image/png') : '';
    const oq = (qs || []).find(q => q.type === 'optin'), eq = (qs || []).find(q => q.fill === 'email');
    const optin = oq ? { yes: !!ans[oq.id], email: eq ? String(ans[eq.id] || '').trim().toLowerCase() : '', name: v('name').trim() } : null;
    return { ok: true, optin, answers: { name: v('name').trim(), dob: v('dob'), a: ans, consent: true, sign: v('sign').trim(), sigImg, signedAt: new Date().toISOString(), questions: qs } };
  };
  C.css = `.cform-q{max-width:100%;overflow-x:clip}.cform-q input,.cform-q select,.cform-q textarea{max-width:100%;min-width:0;box-sizing:border-box}.cform-q input[type=date]{width:100%;-webkit-appearance:none;appearance:none;display:block;text-align:left}.cform-q,.cform-q *{min-width:0;overflow-wrap:anywhere}.cq{min-inline-size:0}.cq-seg b,.cq-none{overflow-wrap:normal;white-space:nowrap}.cform-q{display:flex;flex-direction:column;gap:14px;font-family:Manrope,system-ui,sans-serif;color:#23281f}
    .cq-prog{position:sticky;top:0;z-index:3;background:#fbf8f3;padding:10px 0 8px;margin:-4px 0 2px}.cq-prog i{display:block;height:6px;border-radius:99px;background:linear-gradient(90deg,#b4785a,#d9a37f);width:0;transition:width .35s;box-shadow:inset 0 0 0 999px rgba(0,0,0,0)}
    .cq-prog::before{content:'';position:absolute;left:0;right:0;top:10px;height:6px;border-radius:99px;background:rgba(35,40,35,.08);z-index:-1}.cq-prog span{display:block;font-size:12.5px;font-weight:600;color:#6b6f68;margin-top:6px}.cq-prog.full span{color:#2f6b3f}
    .cq{border:1px solid rgba(35,40,35,.1);border-radius:16px;padding:16px 18px;background:#fff;margin:0;box-shadow:0 1px 2px rgba(35,40,35,.04)}.cq legend{font-weight:600;padding:0;font-size:16px;line-height:1.35;float:left;width:100%;margin-bottom:2px}.cq legend+*{clear:both}
    .cq-yn{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;clear:both}.cq-yn label{display:flex;align-items:center;gap:8px;border:1.5px solid rgba(35,40,35,.16);border-radius:12px;padding:11px 16px;cursor:pointer;font-size:15.5px;background:#fff;transition:all .15s;min-height:46px}
    .cq-yn label:hover{border-color:rgba(35,40,35,.35)}.cq-yn label:has(input:checked){background:#2f3b32;border-color:#2f3b32;color:#fff}.cq-yn input{position:absolute;opacity:0;pointer-events:none}.cq-yn label:has(input:focus-visible),.cq-seg label:has(input:focus-visible) b,.cq-consent:has(input:focus-visible){outline:3px solid #b4785a;outline-offset:2px}.cq-none:focus-visible,.cq-sig-clear:focus-visible,.cq-tlink:focus-visible{outline:3px solid #b4785a;outline-offset:2px}
    .cq textarea,.cq-f input,.cq-in{width:100%;border:1.5px solid rgba(35,40,35,.16);border-radius:12px;padding:12px 14px;font:inherit;font-size:16px;margin-top:10px;background:#fff;transition:border-color .15s}.cq textarea:focus,.cq-f input:focus,.cq-in:focus{outline:none;border-color:#2f3b32;box-shadow:0 0 0 3px rgba(47,59,50,.1)}
    .cq-row{display:grid;grid-template-columns:2fr 1fr;gap:12px}.cq-f{display:block}.cq-f>span{font-size:14px;font-weight:600}.cq-f input{margin-top:6px}
    .cq-consent{display:flex;gap:12px;align-items:flex-start;font-size:15px;line-height:1.5;background:#fff;border:1.5px solid rgba(35,40,35,.16);border-radius:14px;padding:14px 16px;cursor:pointer}.cq-consent:has(input:checked){border-color:#2f3b32;background:#f3f5f1}.cq-terms{border:1px solid rgba(35,40,35,.14);border-radius:14px;background:#fff;overflow:hidden}.cq-terms-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f4ede4}.cq-terms-x{border:1px solid rgba(35,40,35,.2);background:#fff;border-radius:99px;padding:5px 14px;font:inherit;font-size:13px;cursor:pointer}
    .cq-terms-b{padding:14px 16px;font-size:14px;line-height:1.65;color:#3c4038;max-height:46vh;overflow:auto}.cq-terms-b p{margin:0 0 10px}.cq-tlink{color:#9a5d3f;font-weight:700;text-decoration:underline}
    .cq-optin span{display:flex;flex-direction:column;gap:2px}.cq-optin small{font-size:13px;color:#6b6f68;font-weight:400}.cq-consent input{width:22px;height:22px;margin-top:1px;accent-color:#2f3b32;flex:none}
    .cq-msg{color:#b0413e;font-weight:600;min-height:20px}.cq-bad{border-color:#d36b5e!important;box-shadow:0 0 0 3px rgba(211,107,94,.12)!important}.cq-r.cq-bad{background:#fdf0ee}label.cq-bad{box-shadow:none!important;border-color:transparent!important}.cq-bad .cq-in,.cq-bad textarea,.cq-bad input:not([type=radio]):not([type=checkbox]){border-color:#d36b5e}.cq-err{color:#b0413e;font-size:13.5px;font-weight:600;margin:8px 0 0;clear:both}.cq-r{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px}.cq-r>.cq-err{grid-column:1/-1;margin:2px 0 0}.cq-phone{display:grid;grid-template-columns:118px minmax(0,1fr);gap:8px}.cq-dial{appearance:auto;width:100%;padding-left:8px;padding-right:4px}.cq-sig+.cq-err,.cq-consent+.cq-err{margin-top:6px}.cq-h{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:28px;margin:14px 0 -2px;line-height:1.15}.cq-help{font-size:14px;color:#6b6f68;margin:4px 0 0;white-space:pre-line;clear:both}.cq-req{color:#b0413e}
    .cq-info{border-radius:16px;background:#f4ede4;padding:16px 18px;font-size:15px}.cq-info b{display:block;font-size:16px;margin-bottom:2px}.cq-info .cq-help{font-size:13.5px;line-height:1.6;color:#55594f}
    .cq-grp{background:#fff;border:1px solid rgba(35,40,35,.1);border-radius:16px;overflow:hidden}.cq-grp-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;background:#f4ede4;font-size:14px;font-weight:600}
    .cq-none{border:1.5px solid #2f3b32;background:#fff;color:#2f3b32;border-radius:99px;padding:8px 16px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}.cq-none:hover{background:#2f3b32;color:#fff}
    .cq-r{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid rgba(35,40,35,.08);transition:background .15s}.cq-r:has(input[value=yes]:checked){background:#fbf1ea}.cq-rl{font-size:15.5px;line-height:1.35}
    .cq-seg{display:inline-flex;border:1.5px solid rgba(35,40,35,.16);border-radius:12px;overflow:hidden;flex:none}.cq-seg label{cursor:pointer}.cq-seg input{position:absolute;opacity:0;pointer-events:none}.cq-seg b{display:block;padding:10px 18px;font-size:15px;font-weight:600;min-width:58px;text-align:center}
    .cq-seg label+label{border-left:1.5px solid rgba(35,40,35,.16)}.cq-seg label:has(input:checked) b{background:#2f3b32;color:#fff}.cq-seg label.y:has(input:checked) b{background:#b4785a}
    .cq-in[type=date],input[type=date]{min-height:48px}
    .cq-sig{position:relative;margin-top:8px;border:1.5px dashed rgba(35,40,35,.3);border-radius:14px;background:#fff;touch-action:none}.cq-sig.drawn{border-style:solid;border-color:#2f3b32}.cq-sig canvas{display:block;width:100%;height:160px;cursor:crosshair;touch-action:none}
    .cq-sig-ph{position:absolute;left:18px;bottom:16px;color:#a3a69e;font-size:15px;pointer-events:none}.cq-sig.drawn .cq-sig-ph{display:none}
    .cq-sig-clear{position:absolute;right:8px;top:8px;border:1px solid rgba(35,40,35,.2);background:#fff;border-radius:99px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}
    @media(max-width:600px){.cq-row{grid-template-columns:1fr}.cq{padding:14px}.cq-r{padding:10px 12px}.cq-seg b{padding:10px 14px;min-width:50px}.cq-h{font-size:25px}}`;

  if (typeof module !== 'undefined') module.exports = C; else root.YCConsult = C;
})(this);
