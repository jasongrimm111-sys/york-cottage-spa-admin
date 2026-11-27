/* Roles: what each kind of user can do. Owner can always do everything. */
(function () {
  const A = window.YCA, St = window.YCStore;
  const { $, $$, esc, uid } = A;
  // [key, what it allows, group]
  A.PERMS = [
    ['view.today', 'See Today and the to-do list', 'Day to day'], ['view.calendar', 'See the calendars and room calendar', 'Day to day'], ['view.bookings', 'See bookings and the waitlist', 'Day to day'],
    ['arrivals', 'Mark arrivals and no-shows', 'Day to day'], ['consult.fill', 'Open the consultation form on the tablet', 'Day to day'], ['consult.view', 'Read completed consultation forms', 'Day to day'],
    ['bookings.create', 'Make bookings', 'Bookings'], ['bookings.edit', 'Edit and move bookings', 'Bookings'], ['bookings.cancel', 'Cancel and reinstate bookings', 'Bookings'],
    ['payments.take', 'Take payments and send payment links', 'Bookings'], ['payments.refund', 'Give refunds', 'Bookings'],
    ['treatments.moveOwn', 'Move or hand over their own treatments', 'Treatments'], ['treatments.moveAll', 'Move or hand over anyone’s treatments', 'Treatments'],
    ['staff.view', 'See all staff, day sheets and the rota', 'Team'], ['staff.edit', 'Change staff, hours, time off and food cover', 'Team'],
    ['view.customers', 'See customers', 'Guests & sales'], ['customers.edit', 'Edit, export and erase customers', 'Guests & sales'], ['vouchers', 'Sell and manage gift vouchers', 'Guests & sales'], ['promos', 'Manage discount codes', 'Guests & sales'], ['reports', 'See reports and exports', 'Guests & sales'],
    ['setup', 'Change set-up: spa, sessions, treatments, rooms, booking types, prices, emails', 'Running the portal'], ['settings', 'Change settings and booking rules', 'Running the portal'], ['users', 'Manage users and roles', 'Running the portal'], ['data', 'Backups, restore and sample data', 'Running the portal']
  ];
  const ALL = A.PERMS.map(p => p[0]);
  A.ROLE_DEFAULTS = {
    owner: { name: 'Owner', locked: true, perms: ALL },
    manager: { name: 'Manager', perms: ALL.filter(p => !['users', 'data'].includes(p)) },
    reception: { name: 'Reception', perms: ['view.today', 'view.calendar', 'view.bookings', 'arrivals', 'consult.fill', 'bookings.create', 'bookings.edit', 'bookings.cancel', 'payments.take', 'treatments.moveAll', 'staff.view', 'view.customers', 'vouchers'] },
    therapist: { name: 'Therapist', perms: ['view.calendar', 'view.bookings', 'consult.fill', 'consult.view', 'treatments.moveOwn', 'arrivals'] }
  };
  A.roles = () => { const c = A.cfg(); c.roles = c.roles || JSON.parse(JSON.stringify(A.ROLE_DEFAULTS)); for (const k of Object.keys(A.ROLE_DEFAULTS)) if (!c.roles[k]) c.roles[k] = JSON.parse(JSON.stringify(A.ROLE_DEFAULTS[k])); c.roles.owner.perms = ALL; c.roles.owner.locked = true; return c.roles; };
  A.can = p => { const u = St.S.user; if (!u) return false; if (u.role === 'owner') return true; const r = A.roles()[u.role]; return !!(r && r.perms.includes(p)); };
  A.myStaff = () => St.S.user && St.S.user.staffId;

  // pages and the permission they need
  A.ROUTE_PERM = { rules: 'view.bookings', today: 'view.today', ahead: 'view.today', support: 'view.customers', ticket: 'view.customers', todo: 'view.today', calendar: 'view.calendar', roomcal: 'view.calendar', day: 'view.calendar', bookings: 'view.bookings', booking: 'view.bookings', waitlist: 'view.bookings',
    new: 'bookings.create', edit: 'bookings.edit', staff: 'staff.view', requests: 'staff.view', rota: null, staffday: null, customers: 'view.customers', customer: 'view.customers', marketing: 'view.customers', campaign: 'view.customers', vouchers: 'vouchers', promos: 'promos', reports: 'reports',
    spa: 'setup', treatments: 'setup', rooms: 'setup', products: 'setup', rates: 'setup', emails: 'setup', settings: null };
  A.canRoute = name => { const p = A.ROUTE_PERM[name]; if (name === 'staffday') return !!A.myStaff() || A.can('staff.view'); if (name === 'rota') return A.can('staff.view') || !!A.myStaff(); if (name === 'settings') return true; return p == null || A.can(p); };
  A.homeRoute = () => A.can('view.today') ? 'today' : A.myStaff() ? 'staffday/' + A.myStaff() : A.can('view.calendar') ? 'calendar' : 'settings/users';

  // after each page or pop-up: remove the controls this role can't use
  const SEL = [
    ['#takePay,#payLink,[data-act=resend],[data-act=paylink]', 'payments.take'], ['#refund', 'payments.refund'], ['#cancelB,#reinstate', 'bookings.cancel'],
    ['a[href^="#/edit/"]', 'bookings.edit'], ['a[href^="#/new"],#dupB,[data-wlmail],#wlAdd,[data-act=book]', 'bookings.create'],
    ['[data-arr],[data-ns],#noShowT,[data-act=arrived]', 'arrivals'], ['[data-cfill],[data-act=forms]', 'consult.fill'], ['[data-cview]', 'consult.view'],
    ['[data-edit],[data-off],#addSt,[data-duty]', 'staff.edit'], ['#cSave,#gdprD,#gdprX,#cCsv,#cMk', 'customers.edit'], ['#bCsv,#rCsv,#fCsv,#fMail', 'reports'],
    ['[data-consult],[data-hk],#dmgS', 'arrivals']
  ];
  A.applyPerms = root => {
    if (!root || St.S.user.role === 'owner') return;
    for (const [sel, p] of SEL) if (!A.can(p)) root.querySelectorAll(sel).forEach(e => e.remove());
    // moving treatments: their own only, unless they can move anyone's
    if (!A.can('treatments.moveAll')) root.querySelectorAll('[data-mv],[data-move]').forEach(btn => {
      const [bid, key] = (btn.dataset.mv || btn.dataset.move).split('|'), b = A.DB().bookings.find(x => x.id === bid), it = b && (b.items || []).find(i => i.key === key);
      if (!(A.can('treatments.moveOwn') && it && it.staff && it.staff === A.myStaff())) btn.remove();
    });
    if (!A.can('staff.edit')) root.querySelectorAll('[data-cell]').forEach(c => { c.removeAttribute('data-cell'); c.style.cursor = 'default'; c.title = ''; });
  };

  // Settings → Roles
  A.rolesSettings = () => {
    const R = A.roles(), keys = Object.keys(R), groups = [...new Set(A.PERMS.map(p => p[2]))], canEdit = A.can('users');
    const html = `<div class="card"><div class="card-h"><h3>Roles</h3>${canEdit ? `<button class="btn sm" id="roleAdd">${A.ic.plus} Add a role</button>` : ''}</div>
      <p class="muted" style="margin-bottom:12px">Tick what each role can do. Give each user a role in the Users tab. The owner can always do everything. A user linked to a staff member also sees their own day sheet.</p>
      <div class="tbl-wrap"><table class="tbl roles-t"><thead><tr><th>Can…</th>${keys.map(k => `<th class="c">${esc(R[k].name)}${!R[k].locked && !A.ROLE_DEFAULTS[k] && canEdit ? ` <button class="icon-btn" data-rdel="${k}" title="Delete this role">${A.ic.trash}</button>` : ''}</th>`).join('')}</tr></thead><tbody>
      ${groups.map(g => `<tr class="grp"><td colspan="${keys.length + 1}">${esc(g)}</td></tr>` + A.PERMS.filter(p => p[2] === g).map(([p, label]) => `<tr><td>${esc(label)}</td>${keys.map(k => `<td class="c"><input type="checkbox" data-rp="${k}|${p}" ${R[k].perms.includes(p) ? 'checked' : ''} ${R[k].locked || !canEdit ? 'disabled' : ''} aria-label="${esc(R[k].name)}: ${esc(label)}"></td>`).join('')}</tr>`).join('')).join('')}
      </tbody></table></div>${canEdit ? '<button class="btn pri" id="roleSave" style="margin-top:12px">Save roles</button>' : '<p class="small muted" style="margin-top:10px">Only users who can manage users and roles can change these.</p>'}</div>`;
    const wire = el => {
      const sv = $('#roleSave', el); if (sv) sv.onclick = () => { keys.forEach(k => { if (!R[k].locked) R[k].perms = $$(`[data-rp^="${k}|"]`, el).filter(c => c.checked).map(c => c.dataset.rp.split('|')[1]); }); A.change('cfg', null, 'Roles saved'); A.toast('Saved'); A.reshell(); location.hash = '#/settings/roles'; };
      const ad = $('#roleAdd', el); if (ad) ad.onclick = async () => { const r = await A.modal({ title: 'Add a role', body: `${A.f.text('name', 'Role name', '', { ph: 'e.g. Weekend reception' })}${A.f.sel('copy', 'Start from', 'reception', keys.map(k => [k, R[k].name]))}`, onOk: m => { const v = A.read(m); if (!v.name) throw new Error('Name it'); return v; } }); if (!r) return; const k = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20) + '-' + uid('').slice(-3); R[k] = { name: r.name, perms: [...R[r.copy].perms] }; A.change('cfg', null, 'Role added: ' + r.name); A.refresh(); };
      $$('[data-rdel]', el).forEach(b => b.onclick = async () => { const k = b.dataset.rdel; const v = await St.users(); if ((v.users || []).some(u => u.role === k)) { A.toast('Someone has this role. Give them another role first.'); return; } if (await A.confirm('Delete the ' + esc(R[k].name) + ' role?', '', 'Delete')) { delete R[k]; A.change('cfg', null, 'Role deleted'); A.refresh(); } });
    };
    return { html, wire };
  };
})();
