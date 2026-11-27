/* Website text (user 2026-11-27): change any fixed wording on the website (headings, paragraphs, lists, buttons,
   FAQ questions, and each page's Google title and description), find it with search, and put any of it back to the
   original. The list of text comes from the website's site-text.json; changes are saved in cfg.siteText and the
   website's site.js swaps them in. Text the booking system fills in (prices, sessions, treatments) is set elsewhere. */
(function () {
  const A = window.YCA;
  const { $, $$, esc } = A;
  let CAT = null, loading = null, q = '', pg = '', onlyChanged = false;
  const load = () => loading || (loading = fetch(A.siteURL() + 'site-text.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(j => (CAT = j)).catch(e => { loading = null; throw e; }));
  const map = () => { const c = A.cfg(); return c.siteText = c.siteText || {}; };
  const LIM = { 'Google title': [30, 60], 'Google description': [70, 160] };
  const pageURL = p => A.siteURL() + (p === 'index' || p === 'all' ? '' : p + '.html');

  A.views.sitetext = () => {
    if (!CAT) { load().then(() => A.refresh()).catch(() => { const e = document.getElementById('stLoad'); if (e) e.textContent = 'Couldn’t load the website’s text just now. Check the connection and try again.'; });
      return `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Website text</h1></div></div><div class="card"><p id="stLoad" class="muted">Loading the website’s text…</p></div>`; }
    const m = map(), qq = q.trim().toLowerCase();
    const rows = CAT.items.filter(it => (!pg || it.page === pg) && (!onlyChanged || m[it.k]) && (!qq || (it.text + ' ' + (m[it.k] || '') + ' ' + (CAT.pages[it.page] || '') + ' ' + it.kind).toLowerCase().includes(qq)));
    const nChanged = CAT.items.filter(it => m[it.k]).length;
    const pages = Object.entries(CAT.pages).sort((a, b) => a[0] === 'index' ? -1 : b[0] === 'index' ? 1 : a[1].localeCompare(b[1]));
    return { html: `<div class="vh"><div><div class="eyebrow">Set-up</div><h1>Website text</h1><p>Change the wording anywhere on the website, including what Google shows for each page. <b>${nChanged}</b> change${nChanged === 1 ? '' : 's'} so far.</p></div></div>
      <div class="card st-bar"><input class="inp" id="stQ" type="search" placeholder="Search the website’s text, e.g. sauna or afternoon tea" value="${esc(q)}" autocomplete="off">
        <select class="inp" id="stP"><option value="">All pages</option>${pages.map(([k, n]) => `<option value="${k}" ${pg === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <label class="sw"><input type="checkbox" id="stC" ${onlyChanged ? 'checked' : ''}> Only changed</label></div>
      <div class="card flush"><table class="tbl st-tbl"><thead><tr><th>Page</th><th>What</th><th>Text</th><th></th></tr></thead><tbody>
      ${rows.map(it => { const v = m[it.k]; return `<tr class="click" data-st="${esc(it.k)}"><td class="small">${esc(CAT.pages[it.page] || it.page)}</td><td class="small muted">${esc(it.kind)}</td>
        <td>${esc((v || it.text).slice(0, 220))}${(v || it.text).length > 220 ? '…' : ''}${v ? `<div class="small muted st-was">Was: ${esc(it.text.slice(0, 140))}${it.text.length > 140 ? '…' : ''}</div>` : ''}</td>
        <td>${v ? '<span class="badge ok">Changed</span>' : ''}</td></tr>`; }).join('') || `<tr><td colspan="4"><div class="empty"><b>Nothing found</b>Try fewer words, or another page.</div></td></tr>`}
      </tbody></table></div>
      <p class="small muted" style="margin-top:10px">Prices, sessions, treatments, offers and opening times come from their own settings pages, so they aren’t listed here. Changes appear on the website within a few minutes.</p>`,
      wire: el => {
        let t; const qi = $('#stQ', el);
        qi.oninput = () => { clearTimeout(t); t = setTimeout(() => { q = qi.value; const pos = qi.selectionStart; A.refresh(); const n = document.getElementById('stQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); };
        $('#stP', el).onchange = e => { pg = e.target.value; A.refresh(); };
        $('#stC', el).onchange = e => { onlyChanged = e.target.checked; A.refresh(); };
        $$('[data-st]', el).forEach(r => r.onclick = () => edit(r.dataset.st));
      } };
  };

  async function edit(k) {
    const it = CAT.items.find(x => x.k === k); if (!it) return;
    const m = map(), cur = m[k] || it.text, lim = LIM[it.kind], long = cur.length > 90 || /Text|description/.test(it.kind);
    const r = await A.modal({ title: esc(it.kind) + ' · ' + esc(CAT.pages[it.page] || it.page), size: 'wide',
      foot: `${m[k] ? '<button class="btn ghost" data-def style="margin-right:auto">Return to default</button>' : ''}<a class="btn ghost" href="${pageURL(it.page)}" target="_blank" rel="noopener"${m[k] ? '' : ' style="margin-right:auto"'}>See the page</a>`,
      body: `${long ? A.f.area('v', 'Text', cur, { rows: Math.min(10, Math.max(3, Math.ceil(cur.length / 80))) }) : A.f.text('v', 'Text', cur)}
        <div class="small muted" id="stN" style="margin-top:4px"></div>
        ${/<em>|\*/.test(it.text) || it.kind !== 'Google title' ? '<p class="small muted" style="margin-top:6px">Put words between *stars* to show them in italic, like the headings on the website.</p>' : ''}
        <div class="st-orig"><div class="small muted">Original wording</div><div>${esc(it.text)}</div></div>
        <div class="st-prev"><div class="small muted" style="margin-bottom:6px">${it.kind.startsWith('Google') ? 'How it could look on Google' : 'Preview: where it is on the page, as you type'}</div>
          ${it.kind.startsWith('Google') ? `<div class="gg"><div class="gg-site">York Cottage Spa<span>www.yorkcottagespa.com${it.page === 'index' ? '' : ' › ' + esc(it.page)}</span></div><div class="gg-t"></div><div class="gg-d"></div></div>`
            : `<div class="st-frame"><iframe title="Page preview" src="${pageURL(it.page)}${pageURL(it.page).includes('?') ? '&' : '?'}yc-preview=1" loading="eager"></iframe><div class="st-fl">Loading the page…</div></div>`}</div>`,
      onOpen: (mm) => { const i = $('[data-k=v]', mm), n = $('#stN', mm);
        const cnt = () => { const L = i.value.length; n.textContent = lim ? `${L} characters · Google shows about ${lim[1]}${L > lim[1] ? ': this may be cut short' : L < lim[0] ? ': a little short' : ''}` : ''; n.style.color = lim && (L > lim[1]) ? 'var(--red, #b3412e)' : ''; };
        i.addEventListener('input', cnt); cnt();
        // live preview
        const G = $('.gg', mm), F = $('.st-frame iframe', mm), other = CAT.items.find(x => x.page === it.page && x.kind === (it.kind === 'Google title' ? 'Google description' : 'Google title'));
        const send = (scroll) => { if (G) { const t = it.kind === 'Google title' ? i.value : (other && (m[other.k] || other.text)) || '', d = it.kind === 'Google description' ? i.value : (other && (m[other.k] || other.text)) || '';
            $('.gg-t', mm).textContent = t.length > 62 ? t.slice(0, 60) + '…' : t; $('.gg-d', mm).textContent = d.length > 162 ? d.slice(0, 158) + '…' : d; return; }
          if (F && F.contentWindow) F.contentWindow.postMessage({ yc: 'preview', k, v: i.value.trim() === it.text ? '' : i.value, scroll }, new URL(A.siteURL()).origin); };
        i.addEventListener('input', () => send(false)); send(true);
        const onMsg = e => { if (e.source === (F && F.contentWindow) && e.data && e.data.yc === 'ready') { const l = $('.st-fl', mm); if (l) l.remove(); setTimeout(() => send(true), 300); } };
        addEventListener('message', onMsg); const ob = new MutationObserver(() => { if (!document.body.contains(mm)) { removeEventListener('message', onMsg); ob.disconnect(); } }); ob.observe(document.body, { childList: true });
        const d = $('[data-def]', mm); if (d) d.onclick = () => { $('[data-k=v]', mm).value = it.text; $('[data-ok]', mm).click(); }; },
      onOk: mm => { const v = $('[data-k=v]', mm).value.replace(/\r/g, '').trim(); if (!v) throw new Error('Type the text, or use Return to default'); return v; } });
    if (typeof r !== 'string') return;
    if (r === it.text) { if (m[k]) { delete m[k]; A.change('cfg', null, `Website text back to the original (${CAT.pages[it.page] || it.page})`); A.toast('Back to the original wording'); } }
    else { m[k] = r; A.change('cfg', null, `Website text changed (${CAT.pages[it.page] || it.page}): ${r.slice(0, 60)}`); A.toast('Saved. It shows on the website within a few minutes'); }
    A.refresh();
  }
})();
