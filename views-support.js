// Support: messages from the website's contact form, kept as tickets (user, 2026-11-26).
// A ticket needs a reply while the guest wrote last; replying emails them a link to the conversation (ticket.html).
(function () {
  const A = window.YCA, E = window.YCEngine, St = window.YCStore, V = A.views;
  const { $, $$, esc, today } = A;
  const T = () => { const DB = A.DB(); DB.tickets = DB.tickets || []; return DB.tickets; };
  const site = () => ((A.cfg().business || {}).siteUrl || 'https://jasongrimm111-sys.github.io/york-cottage-spa/').replace(/\/?$/, '/');
  const ago = at => { const m = Math.round((Date.now() - new Date(at)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  const when = at => new Date(at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const custOf = t => { const cs = A.DB().customers || {}, e = String(t.customer || t.email || '').toLowerCase(); const k = Object.keys(cs).find(x => x.toLowerCase() === e); return k ? { key: k, c: cs[k] } : null; };
  const stateOf = t => t.status === 'closed' ? 'closed' : t.needsReply ? 'reply' : 'waiting';
  const LABEL = { reply: 'Needs a reply', waiting: 'Waiting for the guest', closed: 'Closed' };
  A.ticketsNeedingReply = () => T().filter(t => stateOf(t) === 'reply');
  let lastLoad = 0;
  const refresh = async force => { if (!force && Date.now() - lastLoad < 60000) return false; lastLoad = Date.now(); try { await St.reloadTickets(); return true; } catch (e) { console.warn(e); return false; } };

  V.support = (tab) => {
    tab = ['reply', 'waiting', 'closed', 'all'].includes(tab) ? tab : 'reply';
    const list = T().slice().sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created));
    const n = k => list.filter(t => k === 'all' || stateOf(t) === k).length;
    const rows = list.filter(t => tab === 'all' || stateOf(t) === tab);
    const ep = ((A.cfg().consult || {}).endpoint || '');
    return { html: `<div class="vh"><div><div class="eyebrow">Guests & sales</div><h1>Support</h1><p>Messages from the website’s contact form. Reply here and the guest is emailed a link to the conversation.</p></div><div class="acts"><button class="btn" id="tkRefresh">Check for new messages</button></div></div>
      ${ep ? '' : `<div class="note warn" style="margin-bottom:14px"><b>The website form isn’t switched on yet.</b> Messages start arriving once the website receiver is deployed and its address is saved in Settings → Consultation form → Receiving address (the same receiver handles both).</div>`}
      <div class="seg sp-tabs">${[['reply', 'Needs a reply'], ['waiting', 'Waiting for the guest'], ['closed', 'Closed'], ['all', 'All']].map(([k, t]) => `<a href="#/support/${k}" class="${k === tab ? 'on' : ''}">${t}${n(k) ? ` <span class="cnt ${k === 'reply' ? 'hot' : ''}">${n(k)}</span>` : ''}</a>`).join('')}</div>
      <div class="card sp-list">${rows.length ? rows.map(t => { const last = t.messages[t.messages.length - 1] || {}, c = custOf(t), st = stateOf(t);
        return `<a class="sp-row ${st}" href="#/ticket/${t.id}"><span class="sp-dot" title="${LABEL[st]}"></span><span class="grow"><b>${esc(t.name || t.email)}</b>${c ? ' <span class="badge">customer</span>' : ' <span class="badge info">new contact</span>'} <span class="small muted">${esc(t.topic || '')}${t.ref ? ' · ' + esc(t.ref) : ''}</span><span class="sp-snip">${last.from === 'staff' ? 'You: ' : ''}${esc((last.text || '').slice(0, 140))}</span></span><span class="sp-meta"><span>${ago(t.updated || t.created)}</span><span class="small muted">${esc(t.id)} · ${t.messages.length} message${t.messages.length === 1 ? '' : 's'}</span></span></a>`; }).join('')
        : `<div class="empty"><b>${tab === 'reply' ? 'Nothing needs a reply' : 'Nothing here'}</b>${tab === 'reply' ? 'New messages from the website show up here.' : ''}</div>`}</div>`,
      wire: el => { $('#tkRefresh', el).onclick = async () => { await refresh(true); A.refresh(); A.toast('Up to date'); }; refresh().then(got => { if (got && location.hash.startsWith('#/support')) A.refresh(); }); } };
  };

  V.ticket = id => {
    const t = T().find(x => x.id === id); if (!t) return `<div class="empty"><b>That message isn’t here</b><a href="#/support">Back to Support</a></div>`;
    const c = custOf(t), st = stateOf(t), DB = A.DB();
    const bk = t.ref ? DB.bookings.find(b => b.ref === t.ref) : null;
    const past = c ? DB.bookings.filter(b => (b.customer || {}).email && b.customer.email.toLowerCase() === c.key.toLowerCase()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4) : [];
    return { html: `<div class="vh"><div><div class="eyebrow">${esc(t.id)} · ${esc(t.topic || 'Message')}</div><h1>${esc(t.name || t.email)}</h1><p><span class="sp-state ${st}">${LABEL[st]}</span> · started ${when(t.created)}</p></div>
        <div class="acts">${st === 'closed' ? '<button class="btn" id="tkOpen">Reopen</button>' : `<button class="btn" id="tkClose">Close ticket</button>${st === 'reply' ? '<button class="btn" id="tkNoReply" title="Mark as handled without replying">No reply needed</button>' : ''}`}</div></div>
      <div class="grid g-side">
        <div>
          <div class="card"><div class="sp-thread">${t.messages.map(m => `<div class="sp-msg ${m.from === 'staff' ? 'staff' : 'guest'}"><div class="sp-who">${m.from === 'staff' ? esc(m.by || 'York Cottage') : esc((t.name || 'Guest').split(' ')[0])} · ${when(m.at)}</div><div class="sp-text">${esc(m.text).replace(/\n/g, '<br>')}</div></div>`).join('')}</div>
            <div class="sp-reply"><label class="fld"><span>Reply to ${esc((t.name || 'the guest').split(' ')[0])}</span><textarea class="inp" id="tkMsg" rows="5" placeholder="Write your reply…"></textarea></label>
              <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><button class="btn pri" id="tkSend">Send reply</button><label class="chk"><input type="checkbox" id="tkCloseToo"> Close the ticket too</label><span class="small muted" style="margin-left:auto">${t.email && !/@example\.com$/i.test(t.email) ? 'Emailed to ' + esc(t.email) + ' with a link to reply' : 'Sample contact: no email is sent'}</span></div></div></div>
        </div>
        <div>
          <div class="card"><div class="card-h"><h3>Who’s asking</h3></div>
            <dl class="kv"><dt>Name</dt><dd>${esc(t.name)}</dd><dt>Email</dt><dd>${esc(t.email)}</dd>${t.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(t.phone)}">${esc(t.phone)}</a></dd>` : ''}${t.ref ? `<dt>Booking</dt><dd>${bk ? `<a href="#/booking/${bk.id}">${esc(t.ref)}</a>` : esc(t.ref) + ' <span class="small muted">(not found)</span>'}</dd>` : ''}</dl>
            ${c ? `<a class="btn sm" style="margin-top:12px" href="#/customer/${encodeURIComponent(c.key)}">${A.ic.cust} Open their customer record</a>${past.length ? `<div class="small muted" style="margin-top:12px">Recent bookings</div><div class="list">${past.map(b => `<a class="li" href="#/booking/${b.id}"><span class="grow small"><b>${A.fd(b.date)}</b> · ${esc(A.pname(b.product))}</span></a>`).join('')}</div>` : ''}`
              : `<p class="small muted" style="margin-top:10px">Not a customer yet.</p><button class="btn sm pri" id="tkMkCust" style="margin-top:6px">${A.ic.plus} Create a customer from this message</button>`}
          </div>
        </div>
      </div>`,
      wire: el => {
        const save = what => { t.updated = new Date().toISOString(); A.change('support/tickets', null, what); A.refresh(); };
        const send = $('#tkSend', el); if (send) send.onclick = () => {
          const text = $('#tkMsg', el).value.trim(); if (!text) { A.toast('Write a reply first'); return; }
          const by = (St.S.user && St.S.user.name || 'York Cottage').replace(/ \(viewing as.*\)$/, '');
          t.messages.push({ from: 'staff', by, at: new Date().toISOString(), text }); t.needsReply = false;
          if ($('#tkCloseToo', el).checked) t.status = 'closed';
          if (t.email && !/@example\.com$/i.test(t.email)) {
            const biz = A.cfg().business || {}, link = `${site()}ticket.html?t=${t.id}&k=${t.key}`;
            (A.DB().outbox = A.DB().outbox || []).push({ id: 'o' + Date.now().toString(36), at: new Date().toISOString(), by, type: 'email', status: 'queued', to: t.email, subject: `Re: your message to ${biz.name || 'York Cottage Spa'} (${t.id})`,
              body: `Hello ${(t.name || '').split(' ')[0] || 'there'},\n\n${text}\n\n${by}\n${biz.name || 'York Cottage Spa'}\n\nTo reply, or to see the whole conversation, use this link (replies to this email aren't read):\n${link}` });
            A.change('outbox', null, '');
          }
          save(`Support ${t.id}: replied`); A.toast(t.email ? 'Reply sent' : 'Reply saved');
        };
        const cl = $('#tkClose', el); if (cl) cl.onclick = () => { t.status = 'closed'; t.needsReply = false; save(`Support ${t.id}: closed`); };
        const op = $('#tkOpen', el); if (op) op.onclick = () => { t.status = 'open'; save(`Support ${t.id}: reopened`); };
        const nr = $('#tkNoReply', el); if (nr) nr.onclick = () => { t.needsReply = false; save(`Support ${t.id}: no reply needed`); };
        const mk = $('#tkMkCust', el); if (mk) mk.onclick = () => {
          const DB = A.DB(), email = String(t.email || '').trim().toLowerCase(); if (!email) { A.toast('This message has no email address'); return; }
          const [first, ...rest] = String(t.name || '').trim().split(/\s+/);
          DB.customers = DB.customers || {}; DB.customers[email] = DB.customers[email] || { email, first: first || '', last: rest.join(' '), phone: t.phone || '', marketing: false, notes: `From support message ${t.id}`, tags: [] };
          t.customer = email; A.change('customers', null, `Customer created from support message ${t.id}: ${t.name}`); save(''); A.toast('Customer created');
        };
      } };
  };

  // a customer's support messages, for their customer page
  A.ticketsFor = email => T().filter(t => String(t.customer || t.email || '').toLowerCase() === String(email || '').toLowerCase()).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
})();
