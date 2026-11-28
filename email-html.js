// Turns a York Cottage email (written as plain text) into a branded HTML email: logo at the top, the message in a
// white card, important links as buttons, and a footer with the address and contact details (user 2026-11-27).
// The plain text is still sent alongside, for mail apps that prefer it. Used by run.js when sending, and by the admin's
// email log to preview exactly what the guest sees.
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BTN = /^(Manage your booking|Pay here|Pay now|Book it here(?: before someone else does)?|Fill in your consultation form|Please complete your consultation form before you arrive|Book online and enter the code when you pay|Reply in the admin|Open it|See your day in the admin|See the conversation|Open the booking|Approve it and sort out their treatments in the admin|Get directions)\s*:?\s*(https?:\/\/\S+)\s*$/i;
  const link = s => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,)])/g, '<a href="$1" style="color:#9a5d3f;text-decoration:underline">$1</a>');
  const button = (label, url) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px"><tr><td style="border-radius:999px;background:#b4785a"><a href="${esc(url)}" style="display:inline-block;padding:12px 24px;font:600 15px/1.2 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
  // a section like "Your stay:" or "Your treatment times:" followed by details becomes a soft panel, like the website:
  // a small heading, then label on the left and the detail in bold on the right; guests' names as sub-headings,
  // treatment times as rows with the time in bold (user 2026-11-28)
  const ROW = /^([^:]{1,48}):\s+(.+)$/, TIME = /^\s*((?:[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} )?\d{1,2}:\d{2})\s+(.+)$/;
  const TD = 'padding:9px 0;border-top:1px solid #ece5d9;font:400 15px/1.45 Arial,Helvetica,sans-serif;vertical-align:top';
  function panel(lines) {
    const head = lines[0].replace(/:\s*$/, '').trim(), rows = [], pay = /^payment$/i.test(head);
    // lines only between rows, never above the first one
    const td = (extra = '') => `${TD.replace('border-top:1px solid #ece5d9', rows.length ? 'border-top:1px solid #ece5d9' : 'border-top:0')};${extra}`;
    for (const l of lines.slice(1)) {
      if (!l.trim()) continue;
      let m;
      if (/^\s{2,}/.test(l) && (m = l.match(TIME))) rows.push(`<tr><td style="${td('width:1%;color:#2a302a;font-weight:700;white-space:nowrap;padding:9px 18px 9px 14px')}">${esc(m[1])}</td><td style="${td('color:#2a302a')}">${link(m[2])}</td></tr>`);
      else if (/:\s*$/.test(l) && l.length < 60) rows.push(`<tr><td colspan="2" style="${td('padding-top:12px;font-weight:700;color:#2a302a')}">${esc(l.replace(/:\s*$/, '').trim())}</td></tr>`);
      else if (!/https?:/.test(l) && (m = l.match(ROW))) { const big = pay && /^total$/i.test(m[1].trim());
        rows.push(`<tr><td style="${td('width:40%;color:#2a302a;font-weight:700;padding-right:12px' + (big ? ';font-size:17px' : ''))}">${esc(m[1])}</td><td style="${td('color:#2a302a;text-align:right' + (big ? ';font-size:22px;font-weight:700' : ''))}">${link(m[2])}</td></tr>`); }
      else if ((m = l.match(BTN))) rows.push(`<tr><td colspan="2" style="${td('padding-top:12px')}">${button(m[1], m[2])}</td></tr>`);
      else rows.push(`<tr><td colspan="2" style="${td('color:#6b6f68;font-size:14px')}">${link(l.trim())}</td></tr>`);
    }
    return `<div style="margin:0 0 18px"><div style="font:700 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#9a5d3f;margin:0 0 8px">${esc(head)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${pay ? '#f3f6f1' : '#fbf8f3'};border:1px solid ${pay ? '#cfdccb' : '#e8e1d5'};border-radius:14px;padding:6px 16px;border-collapse:separate">${rows.join('')}</table></div>`;
  }
  const isPanel = lines => lines.length > 1 && /:\s*$/.test(lines[0]) && lines[0].length < 40 && !/https?:/.test(lines[0]);
  function bodyHtml(text) {
    const paras = String(text || '').replace(/\r/g, '').trim().split(/\n{2,}/);
    return paras.map(p => {
      const lines = p.split('\n');
      if (isPanel(lines)) return panel(lines);
      // a paragraph that is just "Label: link" becomes a button
      if (lines.length === 1) { const m = lines[0].match(BTN); if (m) return button(m[1].replace(/ before someone else does/i, '').replace(/^Please complete your consultation form before you arrive$/i, 'Fill in your consultation form'), m[2]); }
      // each line is its own block: indented lines (treatment times under a guest) step in; short lines ending
      // in ':' ("Your treatment times:", a guest's name) are bold
      const out = lines.map(l => {
        const m = l.match(BTN); if (m) return button(m[1], m[2]);
        if (/^\s{2,}/.test(l)) return `<div style="padding-left:16px">${link(l.trim())}</div>`;
        if (/:\s*$/.test(l) && l.length < 60 && !/https?:/.test(l)) return `<div style="font-weight:700;margin-top:2px">${link(l.trim())}</div>`;
        return `<div>${link(l) || '&nbsp;'}</div>`;
      });
      return `<div style="margin:0 0 16px;font:400 16px/1.6 Arial,Helvetica,sans-serif;color:#2a302a">${out.join('')}</div>`;
    }).join('');
  }
  function emailHtml(text, opt = {}) {
    const b = opt.business || {}, site = (opt.site || '').replace(/\/?$/, '/'), logo = opt.logo || site + 'img/email-logo.png';
    // guests' booking emails open with a photo of the spa (user 2026-11-27); marketing emails use their own picture (or none)
    if (!opt.image && !opt.internal && !opt.unsubscribe && opt.photo !== false) opt = { ...opt, image: site + 'img/email/pool-lounge.jpg' };
    const contact = [b.address && esc(b.address), b.phone && `<a href="tel:${esc(String(b.phone).replace(/\s/g, ''))}" style="color:#6b6f68;text-decoration:none">${esc(b.phone)}</a>`, b.email && `<a href="mailto:${esc(b.email)}" style="color:#6b6f68;text-decoration:none">${esc(b.email)}</a>`].filter(Boolean).join(' · ');
    return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(opt.subject || b.name || 'York Cottage Spa')}</title></head>
<body style="margin:0;padding:0;background:#f6f1e9">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opt.preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f1e9"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
    <tr><td align="center" style="padding:6px 0 22px"><a href="${esc(site)}" style="text-decoration:none"><img src="${esc(logo)}" width="252" height="56" alt="${esc(b.name || 'York Cottage Spa')}" style="display:block;border:0;width:252px;height:auto"></a></td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e8e1d5;border-radius:18px;padding:${opt.image ? '0 0 18px' : '30px 30px 18px'};overflow:hidden">
      ${opt.image ? `<img src="${esc(opt.image)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:18px 18px 0 0;margin:0 0 26px">` : ''}
      <div style="${opt.image ? 'padding:0 30px' : ''}">${opt.heading ? `<h1 style="margin:0 0 14px;font:500 30px/1.2 Georgia,'Times New Roman',serif;color:#2a302a">${esc(opt.heading)}</h1>` : ''}${bodyHtml(text)}${opt.button && opt.button.url ? `<div style="margin:4px 0 12px">${button(opt.button.label || 'Book now', opt.button.url)}</div>` : ''}</div></td></tr>
    <tr><td align="center" style="padding:22px 10px 6px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#6b6f68">
      <div style="font:600 14px/1.4 Arial,Helvetica,sans-serif;color:#2a302a;margin-bottom:4px">${esc(b.name || 'York Cottage Spa')}</div>
      ${contact ? `<div>${contact}</div>` : ''}
      <div style="margin-top:6px"><a href="${esc(site)}" style="color:#9a5d3f;text-decoration:underline">${esc(site.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></div>
      ${opt.internal ? '<div style="margin-top:10px;color:#9a9a92">Sent to the York Cottage team by the booking system.</div>'
        : opt.unsubscribe ? `<div style="margin-top:10px;color:#9a9a92">You’re receiving this because you asked for news and offers from York Cottage Spa. <a href="${esc(opt.unsubscribe)}" style="color:#9a9a92;text-decoration:underline">Unsubscribe</a></div>`
        : '<div style="margin-top:10px;color:#9a9a92">You’re receiving this because of a booking or enquiry with York Cottage Spa. Just reply to this email if you have any questions.</div>'}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  }
  const api = { emailHtml, bodyHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.YCEmail = api;
})(this);
