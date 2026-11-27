/* Email guests (user 2026-11-27): write a marketing email, preview it exactly as guests see it, send a test, then send to
   everyone who agreed to news and offers. Each email carries a personal unsubscribe link. The data job sends them (spaced
   out) and collects delivered / opened / clicked from Resend, shown in each email's report. Campaigns: campaigns.json. */
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore;
  const { $, $$, esc, fd, fdy, ft, today, uid } = A;
  const list = () => { const DB = A.DB(); return DB.campaigns = DB.campaigns || []; };
  const key = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  // who gets marketing: guests ticked "Happy to get news and offers" (and not unsubscribed), with an email
  A.marketingList = () => { const DB = A.DB(), all = A.customers();
    const rec = e => DB.customers[e] || DB.customers[Object.keys(DB.customers).find(k => k.toLowerCase() === e)] || {};
    return Object.values(all).filter(c => c.email && /^\S+@\S+\.\S+$/.test(c.email) && rec(c.email).marketing && !rec(c.email).unsubscribedAt); };
  const custKey = email => { const DB = A.DB(); return Object.keys(DB.customers).find(k => k.toLowerCase() === String(email).toLowerCase()) || email; };
  const unsubURL = (email) => { const DB = A.DB(), k = custKey(email), c = DB.customers[k] = DB.customers[k] || { marketing: true, notes: '', tags: [] }; if (!c.unsubKey) c.unsubKey = key();
    return A.siteURL() + `unsubscribe.html?e=${encodeURIComponent(email)}&k=${c.unsubKey}`; };
  const fill = (s, c) => String(s || '').replace(/\{first\}/g, (c && c.first) || 'there').replace(/\{name\}/g, (c && c.name) || '');
  const html = (cp, c, unsub) => window.YCEmail ? YCEmail.emailHtml(fill(cp.body, c), { site: A.siteURL(), business: A.cfg().business, subject: fill(cp.subject, c), preheader: cp.preheader, heading: fill(cp.heading, c), image: cp.image, button: cp.button && cp.button.url ? cp.button : null, unsubscribe: unsub || A.siteURL() + 'unsubscribe.html' }) : '';
  // starting points for common emails (user 2026-11-27): everything can be edited before sending. [Square brackets] are for the team to fill in.
  const SIGN = 'The York Cottage Spa Team';
  // the spa's own photos (copied from the website into img/email/ so they always load in emails)
  const PHOTOS = [['pool-lounge', 'Pool and lounge'], ['pool', 'The pool'], ['loungers', 'Loungers'], ['relax', 'Relaxation room'], ['spa-hall', 'The spa'], ['garden', 'The garden'], ['house', 'The cottage'], ['bedroom', 'A bedroom'], ['grazing', 'Grazing board'], ['afternoon-tea', 'Afternoon tea']];
  const photoURL = k => A.siteURL() + 'img/email/' + k + '.jpg';
  // starting points for common emails (user 2026-11-27): each has a photo and an AI picture idea; [square brackets] are for the team to fill in
  const TEMPLATES = [
    { name: 'Seasonal offer', icon: '🍂', what: 'A discount or offer for a season or month', photo: 'pool-lounge', ai: 'A cosy spa lounge beside an indoor pool on a crisp winter afternoon, soft blankets, candles and a warm glow from the windows', subject: 'A little winter treat for you, {first}', preheader: 'Treat yourself to some quiet this season', heading: 'Winter warmers at York Cottage',
      body: `Hello {first},\n\nAs the evenings draw in, there’s nowhere cosier than the spa: warm water, a hot sauna and an unhurried afternoon with nowhere you need to be.\n\nThis [season], enjoy [10% off all treatments] with the code [CODE] when you book online.\n\nThe offer runs until [date], and the most popular days go quickly.\n\nWe’d love to see you soon.\n${SIGN}`, button: 'Book your visit', url: 'book.html' },
    { name: 'Black Friday', icon: '🖤', what: 'Your biggest offer of the year, for a few days only', photo: 'spa-hall', ai: 'An elegant flat lay of a dark gift box tied with a copper ribbon, folded white spa towels, eucalyptus and a lit candle on a stone surface, moody and luxurious', subject: 'Black Friday at York Cottage: [offer]', preheader: 'Our best offer of the year, until [end date]', heading: 'Black Friday: our best offer of the year',
      body: `Hello {first},\n\nFor a few days only, we’re offering [25% off spa days and gift vouchers], our biggest saving of the year.\n\nUse the code [CODE] when you book online or buy a voucher. Vouchers make a lovely Christmas present and are valid for 12 months.\n\nThe offer ends at midnight on [end date], and spaces at this price are limited.\n\n${SIGN}`, button: 'Shop the offer', url: 'gift-vouchers.html' },
    { name: 'Gift vouchers', icon: '🎁', what: 'Christmas, Mother’s Day, birthdays', photo: 'loungers', ai: 'A beautifully wrapped spa gift voucher in a cream envelope with a sprig of rosemary, on a soft white spa towel, gentle morning light', subject: 'The gift of calm, sent in minutes', preheader: 'Spa days and stays, ready to give', heading: 'Give the gift of calm',
      body: `Hello {first},\n\nLooking for something special? A York Cottage gift voucher is the present people remember: a spa day, an afternoon of treatments, or a night away.\n\nVouchers are sent by email in minutes, can be printed or forwarded, and are valid for 12 months.\n\nPerfect for birthdays, anniversaries, thank-yous and Christmas.\n\n${SIGN}`, button: 'Choose a voucher', url: 'gift-vouchers.html' },
    { name: 'Last-minute spaces', icon: '⏰', what: 'Fill quiet days in the next week or two', photo: 'pool', ai: 'A calm, empty indoor spa pool with sun loungers and plants, French doors open onto a green garden, inviting and peaceful', subject: '{first}, we’ve a few spaces this week', preheader: 'A short-notice treat, if you can get away', heading: 'Spaces this week',
      body: `Hello {first},\n\nWe’ve a handful of spaces coming up over the next few days, perfect for a short-notice treat.\n\n[Which days and sessions are free, e.g. Tuesday and Wednesday afternoons.]\n\nSpaces are first come, first served.\n\n${SIGN}`, button: 'See what’s available', url: 'book.html' },
    { name: 'New treatment', icon: '✨', what: 'Introduce a new treatment or experience', photo: 'relax', ai: 'A serene treatment room prepared for a facial, warm towels, natural skincare bottles and fresh flowers, soft daylight', subject: 'New at York Cottage: [treatment]', preheader: 'Our newest treatment, now taking bookings', heading: 'Something new at the spa',
      body: `Hello {first},\n\nWe’re delighted to introduce our newest treatment: [name of the treatment].\n\n[A couple of sentences about what it is, how it feels and who it’s for.]\n\nIt’s [length] minutes and [price], and you can add it to any spa day or book it on its own.\n\n${SIGN}`, button: 'Book the new treatment', url: 'treatments.html' },
    { name: 'An event', icon: '📅', what: 'A special evening, yoga, a supper club', photo: 'grazing', ai: 'A long table set for an intimate evening event in a country cottage, candles, linen, seasonal flowers and a grazing board, warm evening light', subject: 'You’re invited: [event] at York Cottage', preheader: '[Date] · limited places', heading: '[Event name]',
      body: `Hello {first},\n\nWe’d love you to join us for [event] on [day and date], from [time].\n\n[What happens, what’s included and who it’s for.]\n\nPlaces are limited to [number], and it’s [price] per person.\n\n${SIGN}`, button: 'Book your place', url: 'events.html' },
    { name: 'We miss you', icon: '💛', what: 'Welcome back guests who haven’t visited for a while', photo: 'garden', ai: 'A sunny English country garden in front of a honey-coloured stone cottage, a wide lawn and tall trees, welcoming and calm', subject: 'It’s been a while, {first}', preheader: 'Come back and slow down with us', heading: 'We’ve missed you',
      body: `Hello {first},\n\nIt’s been a little while since your last visit, and we’d love to welcome you back.\n\nSince you were here we’ve [anything new: treatments, rooms, menus].\n\nWhenever you’re ready for an afternoon (or a night) away, we’re here.\n\n${SIGN}`, button: 'Plan your next visit', url: 'book.html' },
    { name: 'News from the spa', icon: '📰', what: 'A friendly update or newsletter', photo: 'house', ai: 'The front of a pretty stone cottage spa in the English countryside with a willow tree, soft golden-hour light', subject: 'News from York Cottage', preheader: 'What’s new, what’s coming up, and dates for the diary', heading: 'News from York Cottage',
      body: `Hello {first},\n\nA quick hello from all of us at York Cottage, with a few things we wanted to share.\n\n[First piece of news.]\n\n[Second piece of news.]\n\n[Dates for the diary.]\n\nThank you for being part of York Cottage. We hope to see you soon.\n\n${SIGN}`, button: 'Visit our website', url: '' },
    { name: 'Blank email', icon: '✏️', what: 'Start from scratch', photo: 'pool-lounge', ai: '', subject: '', preheader: '', heading: '', body: `Hello {first},\n\n\n\n${SIGN}`, button: 'Book now', url: 'book.html' }
  ];

  const show = t => esc(String(t || '').replace(/\{first\}/g, '(first name)').replace(/\{name\}/g, '(name)'));
  const STATUS = { draft: ['Draft', ''], sending: ['Sending', 'info'], sent: ['Sent', 'ok'] };
  const statsOf = cp => { const DB = A.DB(), its = DB.outbox.filter(o => o.campaign === cp.id && !o.test), n = its.length || cp.count || 0;
    const ev = k => its.filter(o => (o.events || []).includes(k) || o.event === k).length;
    const opened = its.filter(o => ['opened', 'clicked'].includes(o.event) || (o.events || []).some(e => e === 'opened' || e === 'clicked')).length, clicked = ev('clicked');
    const delivered = its.filter(o => ['delivered', 'opened', 'clicked'].includes(o.event) || (o.events || []).some(e => ['delivered', 'opened', 'clicked'].includes(e))).length;
    const bounced = its.filter(o => ['bounced', 'complained'].includes(o.event)).length, failed = its.filter(o => o.status === 'failed').length, waiting = its.filter(o => o.status === 'queued' || o.status === 'waiting').length;
    const unsub = Object.values(DB.customers).filter(c => c.unsubscribedAt && cp.sentAt && c.unsubscribedAt >= cp.sentAt && its.some(o => (o.to || '').toLowerCase() === (c.email || '').toLowerCase() || o.custKey === c.unsubKey)).length;
    const pct = x => n ? Math.round(x / n * 1000) / 10 + '%' : '—';
    return { n, its, delivered, opened, clicked, bounced, failed, waiting, unsub, pct }; };

  A.views.marketing = () => {
    const cps = list().slice().sort((a, b) => (b.sentAt || b.created || '').localeCompare(a.sentAt || a.created || '')), aud = A.marketingList();
    return { html: `<div class="vh"><div><div class="eyebrow">Guests &amp; sales</div><h1>Email guests</h1><p>News and offers for guests who agreed to hear from you. <b>${aud.length}</b> guest${aud.length === 1 ? '' : 's'} on the list.</p></div><div class="acts"><button class="btn pri" id="cpNew">${A.ic.plus} New email</button></div></div>
      <div class="card flush"><table class="tbl"><thead><tr><th>Email</th><th>Status</th><th class="r">Sent to</th><th class="r">Opened</th><th class="r">Clicked</th><th class="r">Unsubscribed</th></tr></thead><tbody>
      ${cps.map(cp => { const s = statsOf(cp), st = STATUS[cp.status] || STATUS.draft; return `<tr class="click" data-cp="${cp.id}"><td><b>${show(cp.subject || cp.name) || 'Untitled'}</b><br><span class="small muted">${cp.sentAt ? 'Sent ' + ft(cp.sentAt) : 'Created ' + ft(cp.created)}${cp.by ? ' · ' + esc(cp.by) : ''}</span></td><td><span class="badge ${st[1]}">${st[0]}</span></td><td class="r">${cp.status === 'draft' ? '—' : s.n}</td><td class="r">${cp.status === 'draft' ? '—' : s.pct(s.opened)}</td><td class="r">${cp.status === 'draft' ? '—' : s.pct(s.clicked)}</td><td class="r">${cp.status === 'draft' ? '—' : s.unsub}</td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty"><b>No emails yet</b>Start one with New email.</div></td></tr>'}
      </tbody></table></div>
      <p class="small muted" style="margin-top:10px">Opens and clicks come from the email service (Resend), checked a few times a day for two weeks after sending. They need “Open tracking” and “Click tracking” switched on for the sending domain in Resend. Some mail apps hide opens, so the open rate is a minimum.</p>`,
      wire: el => {
        $('#cpNew', el).onclick = async () => {
          const t = await A.modal({ title: 'Start a new email', size: 'wide', ok: '', cancel: 'Cancel', body: `<p class="muted" style="margin-bottom:12px">Pick a starting point. Everything can be changed before you send.</p><div class="tpl-pick">${TEMPLATES.map((t, i) => `<button type="button" data-tpl="${i}"><b>${t.icon} ${esc(t.name)}</b><small>${esc(t.what)}</small></button>`).join('')}</div>`,
            onOpen: (m, close) => $$('[data-tpl]', m).forEach(b => b.onclick = () => close(TEMPLATES[+b.dataset.tpl])) });
          if (!t || typeof t !== 'object') return;
          const site = A.siteURL(), cp = { id: uid('cp'), status: 'draft', created: new Date().toISOString(), by: St.S.user.name, template: t.name, subject: t.subject, preheader: t.preheader, heading: t.heading, body: t.body, image: t.photo ? photoURL(t.photo) : '', aiPrompt: t.ai || '', button: { label: t.button, url: t.url === null ? '' : site + t.url } };
          list().push(cp); A.change('campaigns', null, 'Marketing email started: ' + t.name); location.hash = '#/campaign/' + cp.id; };
        $$('[data-cp]', el).forEach(r => r.onclick = () => location.hash = '#/campaign/' + r.dataset.cp);
      } };
  };

  A.views.campaign = id => {
    const cp = list().find(x => x.id === id); if (!cp) return '<div class="empty"><b>Email not found</b></div>';
    const aud = A.marketingList(), me = (A.cfg().business || {}).email || '';
    if (cp.status !== 'draft') return report(cp);
    return { html: `<div class="vh"><div><div class="eyebrow">Email guests</div><h1>${show(cp.subject) || 'New email'}</h1><p>Draft · goes to <b>${aud.length}</b> guest${aud.length === 1 ? '' : 's'} who agreed to news and offers.</p></div>
        <div class="acts"><button class="btn ghost danger" id="cpDel">Delete draft</button></div></div>
      <div class="grid g2 cp-grid">
        <div class="card"><div class="card-h"><h3>Write it</h3><button class="btn pri" id="cpSave">Save</button></div>
          ${A.f.text('subject', 'Subject line', cp.subject, { ph: 'e.g. Winter warmers at York Cottage' })}<div style="height:8px"></div>
          ${A.f.text('preheader', 'Preview text (shown after the subject in the inbox)', cp.preheader, { ph: 'e.g. 10% off treatments until 27 December' })}<div style="height:8px"></div>
          ${A.f.text('heading', 'Big heading in the email (optional)', cp.heading)}<div style="height:8px"></div>
          ${A.f.area('body', 'Message', cp.body, { rows: 10, hint: 'Leave a blank line between paragraphs. {first} becomes each guest’s first name. Links are clickable.' })}<div style="height:8px"></div>
          <div class="fld"><span>Picture at the top</span>
            <div class="cp-pic">${cp.image ? `<img src="${esc(cp.image)}" alt="">` : '<div class="cp-nopic">No picture</div>'}
              <div class="cp-pic-b"><button type="button" class="btn" id="cpPhoto">Choose a photo</button><button type="button" class="btn" id="cpAI">✨ Create with AI</button>${cp.image ? '<button type="button" class="btn ghost" id="cpNoPic">Remove</button>' : ''}</div></div>
            ${cp.aiJob ? `<p class="small" id="cpAIwait" style="margin-top:6px">✨ Making your picture… this usually takes a minute or two. You can keep writing.</p>` : ''}
            <input type="hidden" data-k="image" value="${esc(cp.image || '')}"></div><div style="height:8px"></div>
          <div class="row r2">${A.f.text('btnLabel', 'Button text (optional)', (cp.button || {}).label || '')}${A.f.text('btnUrl', 'Button link', (cp.button || {}).url || '', { ph: 'https://…' })}</div></div>
        <div><div class="card"><div class="card-h"><h3>Preview</h3><span class="small muted">as ${esc((aud[0] || {}).first || 'a guest')} will see it</span></div><iframe class="mail-frame" id="cpPrev" title="Email preview" sandbox="allow-popups"></iframe></div>
          <div class="card"><div class="card-h"><h3>Send a test</h3></div>${A.f.text('testTo', 'Send a test to', cp.testTo || me, { type: 'email' })}<button class="btn" id="cpTest" style="margin-top:8px">Send test</button>
            <p class="small muted" style="margin-top:6px">The subject starts with [Test]. Tests aren’t counted in the report.</p></div>
          <div class="card"><div class="card-h"><h3>Send to guests</h3></div><p>${aud.length ? `Goes to <b>${aud.length}</b> guest${aud.length === 1 ? '' : 's'}. They’re sent a few seconds apart by the email job, usually starting within the hour.` : 'Nobody is on the list yet: tick “Happy to get news and offers” on a customer’s page.'}</p>
            ${aud.length ? `<details style="margin:8px 0"><summary class="small" style="cursor:pointer">See who</summary><div class="small muted" style="max-height:180px;overflow:auto;margin-top:6px">${aud.map(c => esc(c.name || c.email) + ' · ' + esc(c.email)).join('<br>')}</div></details>` : ''}
            <button class="btn pri" id="cpSend" ${aud.length ? '' : 'disabled'}>Send to ${aud.length} guest${aud.length === 1 ? '' : 's'}</button></div></div>
      </div>`,
      wire: el => {
        const read = () => { const v = A.read(el); Object.assign(cp, { subject: v.subject, preheader: v.preheader, heading: v.heading, body: v.body, image: (v.image || '').trim(), button: { label: v.btnLabel, url: (v.btnUrl || '').trim() }, testTo: v.testTo }); };
        const prev = () => { read(); $('#cpPrev', el).srcdoc = html(cp, aud[0] || { first: 'Sophie', name: 'Sophie Turner' }); };
        let tm; el.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(prev, 300); }); prev();
        const setPic = url => { read(); cp.image = url; A.change('campaigns'); A.refresh(); };
        $('#cpPhoto', el).onclick = async () => {
          const k = await A.modal({ title: 'Choose a photo', size: 'wide', ok: '', cancel: 'Cancel', body: `<div class="pic-pick">${PHOTOS.map(([k, l]) => `<button type="button" data-ph="${k}"><img src="${photoURL(k)}" alt="" loading="lazy"><span>${esc(l)}</span></button>`).join('')}</div>
            <p class="small muted" style="margin-top:10px">Or paste the web address of any picture: <input class="inp" id="phURL" placeholder="https://…" style="margin-top:6px"></p>`,
            foot: '<button class="btn" data-use>Use this address</button>',
            onOpen: (m, close) => { $$('[data-ph]', m).forEach(b => b.onclick = () => close(photoURL(b.dataset.ph))); $('[data-use]', m).onclick = () => { const u = $('#phURL', m).value.trim(); if (/^https:\/\/\S+$/.test(u)) close(u); else A.toast('Paste a web address starting https://'); }; } });
          if (typeof k === 'string') setPic(k);
        };
        if ($('#cpNoPic', el)) $('#cpNoPic', el).onclick = () => setPic('');
        $('#cpAI', el).onclick = async () => {
          read();
          const pr = await A.modal({ title: '✨ Create a picture with AI', ok: 'Create picture', body: `<p class="muted" style="margin-bottom:10px">Describe the picture you’d like. Be specific about the scene, the season and the mood. No need to mention style: it’s always made as a calm, natural photo with no writing on it.</p>${A.f.area('prompt', 'Describe the picture', cp.aiPrompt || cp.heading || '', { rows: 4 })}<p class="small muted" style="margin-top:8px">It’s made by the email job and appears here in a minute or two. AI pictures aren’t real photos of York Cottage, so use them for moods and ideas rather than showing the rooms.</p>`,
            onOk: m => { const v = $('[data-k=prompt]', m).value.trim(); if (v.length < 8) throw new Error('Describe the picture in a few words'); return v; } });
          if (typeof pr !== 'string') return;
          cp.aiPrompt = pr;
          if (St.S.mode === 'demo') { cp.image = photoURL(PHOTOS[Math.floor(Math.random() * PHOTOS.length)][0]); A.change('campaigns'); A.refresh(); A.toast('Demo: a sample picture is used instead of a real AI one'); return; }
          const job = St.queue({ type: 'image', forCampaign: cp.id, prompt: pr, subject: 'AI picture', to: '' });
          cp.aiJob = job.id; A.change('campaigns', null, 'AI picture requested for a marketing email'); A.refresh();
        };
        // waiting for an AI picture: check every 10 seconds; when it's ready, copy it to the website and use it
        if (cp.aiJob && St.S.mode === 'live') {
          const id = cp.aiJob, t0 = Date.now();
          const poll = async () => {
            if (cp.aiJob !== id || !document.body.contains(el)) return;
            let r = null; try { r = await St.S.gh.get(St.CONF.dataRepo, 'marketing/img/' + id + '.json'); } catch (e) {}
            if (r && r.data && r.data.file) {
              try { const name = 'img/m/' + id + '.' + (r.data.ext || 'jpg'); await St.S.gh.copy(St.CONF.dataRepo, r.data.file, St.CONF.liveRepo, name, 'Picture for a marketing email');
                cp.aiJob = null; cp.image = `https://raw.githubusercontent.com/${St.CONF.owner}/${St.CONF.liveRepo}/${St.CONF.branch}/${name}`; A.change('campaigns', null, 'AI picture added to a marketing email'); A.toast('Your picture is ready'); A.refresh(); }
              catch (e) { A.toast('The picture was made but couldn’t be copied: ' + e.message); }
              return;
            }
            if (r && r.data && r.data.error) { cp.aiJob = null; A.change('campaigns'); A.refresh(); A.toast('Couldn’t make the picture: ' + r.data.error); return; }
            if (Date.now() - t0 > 15 * 60e3) { const w = $('#cpAIwait', el); if (w) w.textContent = 'Still waiting for the picture. The email job may be busy; check back in a little while.'; return; }
            setTimeout(poll, 10000);
          };
          setTimeout(poll, 8000);
        }
        const save = (what) => { read(); A.change('campaigns', null, what || 'Marketing email saved: ' + (cp.subject || 'untitled')); };
        $('#cpSave', el).onclick = () => { save(); A.toast('Saved'); };
        $('#cpDel', el).onclick = async () => { if (!(await A.confirm('Delete this draft?', 'It hasn’t been sent, so nobody will notice.', 'Delete'))) return; A.DB().campaigns = list().filter(x => x !== cp); A.change('campaigns', null, 'Marketing draft deleted'); location.hash = '#/marketing'; };
        $('#cpTest', el).onclick = () => { read(); if (!cp.subject) { A.toast('Add a subject line first'); return; } const to = (cp.testTo || '').trim(); if (!/^\S+@\S+\.\S+$/.test(to)) { A.toast('Enter an email address for the test'); return; }
          const c = aud[0] || { first: 'Sophie', name: 'Sophie Turner' };
          St.queue({ type: 'email', template: 'campaign', campaign: cp.id, test: true, to, subject: '[Test] ' + fill(cp.subject, c), body: fill(cp.body, c), unsub: A.siteURL() + 'unsubscribe.html' });
          save('Marketing test queued to ' + to); A.toast('Test queued: it arrives when the email job next runs (within the hour)'); };
        $('#cpSend', el).onclick = async () => { read(); if (!cp.subject || (cp.body || '').trim().length < 10) { A.toast('Add a subject and a message first'); return; }
          if (/\[[^\]]{2,}\]/.test([cp.subject, cp.preheader, cp.heading, cp.body].join(' '))) { A.toast('Fill in the [square bracket] parts first'); return; }
          const people = A.marketingList();
          if (!(await A.confirm(`Send to ${people.length} guest${people.length === 1 ? '' : 's'}?`, `“${show(cp.subject)}” goes to everyone on the news and offers list. This can’t be undone.`, 'Send now'))) return;
          const now = new Date().toISOString();
          for (const c of people) St.queue({ type: 'email', template: 'campaign', campaign: cp.id, to: c.email, subject: fill(cp.subject, c), body: fill(cp.body, c), unsub: unsubURL(c.email), custKey: A.DB().customers[custKey(c.email)].unsubKey });
          Object.assign(cp, { status: 'sending', sentAt: now, count: people.length, sentBy: St.S.user.name });
          A.change('customers'); A.change('campaigns', null, `Marketing email sent to ${people.length}: ${cp.subject}`); St.audit(`Marketing email “${cp.subject}” queued for ${people.length} guests`);
          A.toast(`Queued for ${people.length} guests`); A.refresh(); };
      } };
  };

  // the report for a sent email
  function report(cp) {
    const s = statsOf(cp), done = s.waiting === 0;
    if (cp.status === 'sending' && done && s.n) { cp.status = 'sent'; A.change('campaigns'); }
    const kpi = (l, v, sub) => `<div class="kpi"><small>${l}</small><b>${v}</b><span>${sub || ''}</span></div>`;
    const EV = { opened: ['Opened', 'ok'], clicked: ['Clicked', 'ok'], delivered: ['Delivered', ''], bounced: ['Bounced', 'bad'], complained: ['Marked as spam', 'bad'], sent: ['Sent', ''], delivery_delayed: ['Delayed', 'warn'] };
    return { html: `<div class="vh"><div><div class="eyebrow">Email guests · report</div><h1>${show(cp.subject)}</h1><p>Sent ${ft(cp.sentAt)}${cp.sentBy ? ' by ' + esc(cp.sentBy) : ''} to ${s.n} guest${s.n === 1 ? '' : 's'}.${s.waiting ? ` <b>${s.waiting}</b> still waiting to send.` : ''}</p></div><div class="acts"><button class="btn" id="cpView">View the email</button><button class="btn" id="cpCopy">${A.ic.copy || ''} Copy as a new email</button></div></div>
      <div class="grid g4" style="margin-bottom:14px">${kpi('Delivered', s.pct(s.delivered), `${s.delivered} of ${s.n}`)}${kpi('Opened', s.pct(s.opened), `${s.opened} guests`)}${kpi('Clicked a link', s.pct(s.clicked), `${s.clicked} guests`)}${kpi('Unsubscribed', s.unsub, s.bounced ? `${s.bounced} bounced or spam` : 'since sending')}</div>
      <div class="card flush"><table class="tbl"><thead><tr><th>Guest</th><th>Sent</th><th>Status</th></tr></thead><tbody>
      ${s.its.map(o => { const e = EV[o.event] || (o.status === 'sent' ? EV.sent : o.status === 'failed' ? ['Failed', 'bad'] : ['Waiting to send', 'info']); return `<tr><td>${esc(o.to)}</td><td class="small">${o.done ? ft(o.done) : '—'}</td><td><span class="badge ${e[1]}">${e[0]}</span>${o.error ? ` <span class="small muted">${esc(o.error)}</span>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="small muted" style="margin-top:10px">Statuses update a few times a day for two weeks. “Opened” counts guests whose mail app showed pictures; some apps hide opens, so the real figure is usually higher.</p>`,
      wire: el => {
        $('#cpView', el).onclick = () => A.modal({ title: show(cp.subject), size: 'wide', ok: 'Close', cancel: '', body: `<iframe class="mail-frame" sandbox="allow-popups" srcdoc="${esc(html(cp, { first: 'Sophie', name: 'Sophie Turner' }))}"></iframe>` });
        $('#cpCopy', el).onclick = () => { const n = { ...JSON.parse(JSON.stringify(cp)), id: uid('cp'), status: 'draft', created: new Date().toISOString(), by: St.S.user.name, sentAt: null, count: 0, sentBy: null, subject: cp.subject + ' (copy)' }; list().push(n); A.change('campaigns', null, 'Marketing email copied'); location.hash = '#/campaign/' + n.id; };
      } };
  }
})();
