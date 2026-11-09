/* TendCo internal CRM. Records come from /portal/api/crm only. */
(function () {
  const API = '/portal/api/crm';
  const root = document.getElementById('crm-root');
  const toastEl = document.getElementById('toast');
  let me = null;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastEl._t);
    toastEl._tm = setTimeout(() => toastEl.classList.remove('on'), 2400);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function demoLock() {
    try { return new URLSearchParams(location.search).get('demo') === '1'; } catch { return false; }
  }
  async function api(path, opts) {
    const res = await fetch(API + path, {
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return data;
  }
  function route() {
    const raw = (location.hash || '#/followups').replace(/^#\/?/, '');
    return raw.split('?')[0];
  }
  function setTitle(title, crumb) {
    document.getElementById('top-title').textContent = title;
    document.getElementById('top-crumb').textContent = crumb || 'Internal workspace';
    const name = route().split('/')[0] || 'followups';
    document.querySelectorAll('.nav a[data-crm]').forEach((a) => a.classList.toggle('on', a.dataset.crm === name));
  }
  function field(label, html) {
    return `<div class="field"><label>${label}</label>${html}</div>`;
  }

  async function boot() {
    if (demoLock()) {
      setTitle('CRM', 'Not in the public demo');
      root.innerHTML = '<div class="card card-b"><p class="crm-bad">The public Hub demo does not include internal CRM records.</p><p style="margin-top:10px"><a class="btn sec" href="app.html?demo=1">Back to the Hub demo</a></p></div>';
      return;
    }
    try {
      const data = await api('');
      me = data.user;
      document.getElementById('user-foot').textContent = me.name + ' · ' + me.role.toUpperCase();
      document.getElementById('banner-who').textContent = '· ' + me.name;
    } catch (err) {
      if (err.status === 401) {
        location.href = 'index.html?next=crm';
        return;
      }
      setTitle('CRM');
      root.innerHTML = `<div class="card card-b"><p class="crm-bad">${esc(err.message || 'TendCo staff only')}</p><p style="margin-top:10px"><a class="btn sec" href="app.html">Back to the Hub</a></p></div>`;
      return;
    }
    await render();
  }

  async function render() {
    const parts = route().split('/');
    try {
      if (parts[0] === 'clients' && parts[1]) return clientPage(parts[1]);
      if (parts[0] === 'clients') return clientsPage();
      if (parts[0] === 'sites' && parts[1]) return sitePage(parts[1]);
      if (parts[0] === 'jobs' && parts[1]) return jobPage(parts[1]);
      if (parts[0] === 'jobs') return jobsPage();
      if (parts[0] === 'schedule') return schedulePage();
      if (parts[0] === 'search') return searchPage();
      return followupsPage();
    } catch (err) {
      root.innerHTML = `<p class="crm-bad">${esc(err.message)}</p>`;
    }
  }

  async function followupsPage() {
    setTitle('Follow-ups', 'Open work and invoice clock');
    const [follow, ar] = await Promise.all([api('/followups?status=open'), api('/ar/summary')]);
    const overdue = ar.overdue || [];
    root.innerHTML = `
      ${overdue.length ? `<div class="crm-warn">${overdue.length} job${overdue.length === 1 ? '' : 's'} done more than 24 hours without the invoice sent. ${overdue.map((j) => `<a href="#/jobs/${esc(j.id)}">${esc(j.public_id)}</a>`).join(' · ')}</div>` : '<div class="card card-b" style="margin-bottom:12px">No invoice-sent alerts right now.</div>'}
      <div class="card"><div class="card-h"><h3>Open follow-ups</h3></div><div class="card-b">
        <table class="crm-table"><thead><tr><th>Due</th><th>Owner</th><th>Note</th></tr></thead><tbody>
        ${(follow.followups || []).map((f) => `<tr><td>${esc(f.due_on)}</td><td>${esc(f.owner_name)}</td><td>${esc(f.note)} <button class="btn sec sm" data-done="${esc(f.id)}" type="button">Done</button></td></tr>`).join('') || '<tr><td colspan="3">No open follow-ups.</td></tr>'}
        </tbody></table>
      </div></div>
      <p style="margin-top:12px;color:var(--muted)">Done → invoice created averages ${esc(ar.averages_hours && ar.averages_hours.done_to_sent != null ? ar.averages_hours.done_to_sent + ' h' : '—')}.</p>`;
    root.querySelectorAll('[data-done]').forEach((btn) => btn.addEventListener('click', async () => {
      await api('/followups/' + btn.dataset.done + '/done', { method: 'POST', body: '{}' });
      toast('Follow-up completed');
      render();
    }));
  }

  async function clientsPage() {
    setTitle('Clients', 'Property management and other industries');
    const data = await api('/clients');
    root.innerHTML = `<div class="crm-split">
      <div class="card"><div class="card-h"><h3>Clients</h3></div><div class="card-b">
        <table class="crm-table"><thead><tr><th>Number</th><th>Name</th><th>Industry</th><th>Sites</th></tr></thead><tbody>
        ${(data.clients || []).map((c) => `<tr data-href="#/clients/${esc(c.id)}"><td>${esc(c.public_id)}</td><td>${esc(c.name)}</td><td>${esc(c.industry)}</td><td>${esc(c.site_count)}</td></tr>`).join('') || '<tr><td colspan="4">No clients yet.</td></tr>'}
        </tbody></table>
      </div></div>
      <form class="card card-b crm-form" id="new-client">
        <h3>New property management client</h3>
        ${field('Industry', `<input name="industry" required value="Property management">`)}
        ${field('Name', `<input name="name" required>`)}
        ${field('Management address', `<input name="management_address">`)}
        ${field('Management phone', `<input name="management_phone">`)}
        ${field('Owner names', `<input name="owner_names">`)}
        ${field('Website', `<input name="website">`)}
        ${field('Fee note', `<input name="fee_note">`)}
        <button class="btn pri" type="submit">Save client</button>
      </form>
    </div>`;
    wireRows();
    document.getElementById('new-client').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      const saved = await api('/clients', { method: 'POST', body: JSON.stringify(body) });
      toast('Saved ' + saved.client.public_id);
      location.hash = '#/clients/' + saved.client.id;
    });
  }

  async function clientPage(id) {
    const data = await api('/clients/' + id);
    const c = data.client;
    setTitle(c.public_id, c.name);
    root.innerHTML = `<div class="page-h"><div><h2>${esc(c.name)}</h2><p>${esc(c.public_id)} · ${esc(c.industry)}</p></div></div>
      <div class="crm-split">
        <div>
          <div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Sites</h3></div><div class="card-b">
            ${(c.sites || []).map((s) => `<p><a href="#/sites/${esc(s.id)}"><b>${esc(s.public_id)}</b> ${esc(s.name)}</a> ${s.missing_info ? '<span class="pill a">Missing info</span>' : ''}</p>`).join('') || '<p>No sites yet.</p>'}
          </div></div>
          <div class="card"><div class="card-h"><h3>Contacts</h3></div><div class="card-b">
            ${(c.contacts || []).map((p) => `<p>${esc(p.name)} · ${esc(p.email)} · ${esc(p.phone)}</p>`).join('') || '<p>No contacts yet.</p>'}
          </div></div>
        </div>
        <div>
          <form class="card card-b crm-form" id="edit-client" style="margin-bottom:16px">
            <h3>Edit</h3>
            ${field('Name', `<input name="name" required value="${esc(c.name)}">`)}
            ${field('Industry', `<input name="industry" required value="${esc(c.industry)}">`)}
            ${field('Management address', `<input name="management_address" value="${esc(c.management_address)}">`)}
            ${field('Management phone', `<input name="management_phone" value="${esc(c.management_phone)}">`)}
            ${field('Owner names', `<input name="owner_names" value="${esc(c.owner_names)}">`)}
            <button class="btn pri" type="submit">Save</button>
          </form>
          <form class="card card-b crm-form" id="new-site">
            <h3>New site</h3>
            <p style="color:var(--muted);font-size:12px">Email and a contact are required. The site number stays with this client’s sequence.</p>
            ${field('Property name', `<input name="name" required>`)}
            ${field('Address', `<input name="address_line" required>`)}
            ${field('City', `<input name="city">`)}
            ${field('State', `<input name="region">`)}
            ${field('Postal', `<input name="postal">`)}
            ${field('Site email', `<input name="email" type="email" required>`)}
            ${field('Units', `<input name="units" inputmode="numeric">`)}
            ${field('Avg rent note', `<input name="avg_rent_note" placeholder="As provided">`)}
            ${field('Contact name', `<input name="contact_name" required>`)}
            ${field('Contact email', `<input name="contact_email" type="email">`)}
            ${field('Contact phone', `<input name="contact_phone">`)}
            <button class="btn pri" type="submit">Save site</button>
          </form>
        </div>
      </div>`;
    document.getElementById('edit-client').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      await api('/clients/' + id, { method: 'PATCH', body: JSON.stringify(body) });
      toast('Saved');
      render();
    });
    document.getElementById('new-site').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      try {
        const saved = await api('/clients/' + id + '/sites', { method: 'POST', body: JSON.stringify({
          name: f.name, address_line: f.address_line, city: f.city, region: f.region, postal: f.postal,
          email: f.email, units: f.units, avg_rent_note: f.avg_rent_note,
          contact: { name: f.contact_name, email: f.contact_email, phone: f.contact_phone },
        }) });
        toast('Saved ' + saved.site.public_id);
        location.hash = '#/sites/' + saved.site.id;
      } catch (err) { toast(err.message); }
    });
  }

  async function sitePage(id) {
    const data = await api('/sites/' + id);
    const s = data.site;
    const clients = await api('/clients');
    const types = await api('/job-types');
    setTitle(s.public_id, s.name);
    root.innerHTML = `<div class="page-h"><div><h2>${esc(s.name)}</h2><p>${esc(s.public_id)} · ${esc(s.address)}</p></div>
      <div class="r">${s.directions_url ? `<a class="btn sec" href="${esc(s.directions_url)}" target="_blank" rel="noopener">Directions</a>` : ''}</div></div>
      <div class="crm-split">
        <div class="card"><div class="card-h"><h3>Hand-off history</h3></div><div class="card-b">
          ${(s.transfers || []).map((t) => `<p>${esc(t.from_public_id)} → ${esc(t.to_public_id)} · ${esc(t.transfer_type)} · ${esc(t.notice_days)} days · through ${esc(t.countdown_end)}</p>`).join('') || '<p>No transfers. This site still has its original number.</p>'}
        </div></div>
        <div>
          <form class="card card-b crm-form" id="new-job" style="margin-bottom:16px">
            <h3>New job</h3>
            ${field('Category', `<select name="category"><option>Emergency</option><option>Work order</option><option selected>Make ready</option></select>`)}
            ${field('Job type', `<select name="job_type_id">${(types.job_types || []).map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>`)}
            ${field('Title', `<input name="title">`)}
            ${field('Scheduled', `<input name="scheduled_on" type="date">`)}
            <button class="btn pri" type="submit">Save job</button>
          </form>
          <form class="card card-b crm-form" id="transfer">
            <h3>Hand off</h3>
            ${field('To client', `<select name="to_client_id">${(clients.clients || []).filter((c) => c.id !== s.client_id).map((c) => `<option value="${esc(c.id)}">${esc(c.public_id)} ${esc(c.name)}</option>`).join('')}</select>`)}
            ${field('Type', `<select name="transfer_type"><option value="management">Management</option><option value="sale">Sale</option></select>`)}
            ${field('Notice', `<select name="notice_days"><option value="30">30 days</option><option value="60">60 days</option></select>`)}
            ${field('Who pays', `<select name="who_pays"><option value="previous">Previous</option><option value="new">New</option><option value="tendco">TendCo</option></select>`)}
            ${field('Sale balance cents', `<input name="sale_balance_cents" value="0">`)}
            <button class="btn sec" type="submit">Transfer</button>
          </form>
        </div>
      </div>`;
    document.getElementById('new-job').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      body.site_id = id;
      const saved = await api('/jobs', { method: 'POST', body: JSON.stringify(body) });
      toast('Saved ' + saved.job.public_id);
      location.hash = '#/jobs/' + saved.job.id;
    });
    document.getElementById('transfer').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      body.notice_days = Number(body.notice_days);
      body.sale_balance_cents = Number(body.sale_balance_cents);
      try {
        const saved = await api('/sites/' + id + '/transfer', { method: 'POST', body: JSON.stringify(body) });
        toast('Transferred. Number stays ' + saved.site.public_id);
        render();
      } catch (err) { toast(err.message); }
    });
  }

  async function jobsPage() {
    setTitle('Jobs', 'Saved jobs keep their TC number');
    const data = await api('/jobs');
    root.innerHTML = `<div class="card"><div class="card-b"><table class="crm-table"><thead><tr><th>Number</th><th>Title</th><th>Category</th><th>Status</th><th>AR</th></tr></thead><tbody>
      ${(data.jobs || []).map((j) => `<tr data-href="#/jobs/${esc(j.id)}"><td>${esc(j.public_id)}</td><td>${esc(j.title)}</td><td>${esc(j.category)}</td><td>${esc(j.status)}</td><td>${esc(j.ar_stage)}${j.invoice_overdue ? ' <span class="pill r">24h</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5">No jobs yet.</td></tr>'}
    </tbody></table></div></div>`;
    wireRows();
  }

  async function jobPage(id) {
    const data = await api('/jobs/' + id);
    const j = data.job;
    const notes = await api('/notes?entity_type=job&entity_id=' + encodeURIComponent(id));
    setTitle(j.public_id, j.title);
    const nextAr = { none: 'created', created: 'sent', sent: 'check_received', check_received: 'deposited' }[j.ar_stage];
    root.innerHTML = `<div class="page-h"><div><h2>${esc(j.title)}</h2><p>${esc(j.public_id)} · ${esc(j.client_public_id)} · ${esc(j.site_public_id)} ${esc(j.site_name)}</p></div></div>
      ${j.invoice_overdue ? '<div class="crm-warn">Done more than 24 hours ago and the invoice is not marked sent.</div>' : ''}
      <div class="crm-split">
        <div class="card"><div class="card-h"><h3>Activity on this job</h3></div><div class="card-b" id="job-notes">
          <p>Status <b>${esc(j.status)}</b> · AR <b>${esc(j.ar_stage)}</b> · QuickBooks <b>${esc(j.qb_invoice_ref || '—')}</b></p>
          ${(notes.notes || []).map((n) => `<div class="crm-note"><b>${esc(n.author_name)}</b><div>${esc(n.body)}</div></div>`).join('')}
        </div></div>
        <div>
          <form class="card card-b crm-form" id="job-status" style="margin-bottom:16px">
            <h3>Status</h3>
            ${field('Status', `<select name="status">${['scheduled','on_the_way','arrived','started','done','needs_return','closed'].map((s) => `<option ${s===j.status?'selected':''}>${s}</option>`).join('')}</select>`)}
            ${field('QuickBooks invoice #', `<input name="qb_invoice_ref" value="${esc(j.qb_invoice_ref || '')}" placeholder="Manual reference">`)}
            <button class="btn pri" type="submit">Save</button>
            ${nextAr ? `<button class="btn sec" type="button" id="ar-next">Mark invoice ${esc(nextAr.replace('_', ' '))}</button>` : ''}
          </form>
          <form class="card card-b crm-form" id="job-note" style="margin-bottom:16px">
            <h3>Note</h3>
            ${field('Note', `<textarea name="body" required rows="3"></textarea>`)}
            <button class="btn sec" type="submit">Add note</button>
          </form>
          <form class="card card-b crm-form" id="job-follow">
            <h3>Follow-up</h3>
            ${field('Due', `<input name="due_on" type="date" required>`)}
            ${field('Note', `<input name="note" required>`)}
            <button class="btn sec" type="submit">Save follow-up</button>
          </form>
        </div>
      </div>`;
    document.getElementById('job-status').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api('/jobs/' + id, { method: 'PATCH', body: JSON.stringify(body) });
        toast('Saved');
        render();
      } catch (err) { toast(err.message); }
    });
    const arBtn = document.getElementById('ar-next');
    if (arBtn) arBtn.addEventListener('click', async () => {
      const ref = document.querySelector('[name=qb_invoice_ref]').value;
      try {
        await api('/jobs/' + id, { method: 'PATCH', body: JSON.stringify({ ar_stage: nextAr, qb_invoice_ref: ref }) });
        toast('AR updated');
        render();
      } catch (err) { toast(err.message); }
    });
    document.getElementById('job-note').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      body.entity_type = 'job';
      body.entity_id = id;
      await api('/notes', { method: 'POST', body: JSON.stringify(body) });
      toast('Note saved');
      render();
    });
    document.getElementById('job-follow').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      body.entity_type = 'job';
      body.entity_id = id;
      await api('/followups', { method: 'POST', body: JSON.stringify(body) });
      toast('Follow-up saved');
    });
  }

  async function schedulePage() {
    setTitle('Schedule', 'Industry, category, and job type');
    let filters = {};
    try { filters = JSON.parse(sessionStorage.getItem('crm_schedule_filters') || '{}'); } catch { filters = {}; }
    const params = new URLSearchParams();
    if (filters.industry) params.set('industry', filters.industry);
    if (filters.category) params.set('category', filters.category);
    if (filters.job_type) params.set('job_type', filters.job_type);
    const [jobs, types] = await Promise.all([api('/schedule?' + params.toString()), api('/job-types')]);
    root.innerHTML = `<div class="crm-filters">
      <select id="f-industry"><option value="">All industries</option><option>Property management</option><option>Multifamily</option><option>Single-family</option><option>Commercial</option></select>
      <select id="f-category"><option value="">All categories</option><option>Emergency</option><option>Work order</option><option>Make ready</option></select>
      <select id="f-type"><option value="">All job types</option>${(types.job_types || []).map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
    </div>
    <div class="card"><div class="card-b"><table class="crm-table"><thead><tr><th>When</th><th>Job</th><th>Category</th><th>Type</th></tr></thead><tbody>
      ${(jobs.jobs || []).map((j) => `<tr data-href="#/jobs/${esc(j.id)}"><td>${esc(j.scheduled_on || '—')}</td><td>${esc(j.public_id)} ${esc(j.title)}</td><td>${esc(j.category)}</td><td>${esc(j.job_type_name)}</td></tr>`).join('') || '<tr><td colspan="4">No matching jobs.</td></tr>'}
    </tbody></table></div></div>`;
    document.getElementById('f-industry').value = filters.industry || '';
    document.getElementById('f-category').value = filters.category || '';
    document.getElementById('f-type').value = filters.job_type || '';
    for (const id of ['f-industry', 'f-category', 'f-type']) {
      document.getElementById(id).addEventListener('change', () => {
        const next = {
          industry: document.getElementById('f-industry').value,
          category: document.getElementById('f-category').value,
          job_type: document.getElementById('f-type').value,
        };
        sessionStorage.setItem('crm_schedule_filters', JSON.stringify(next));
        render();
      });
    }
    wireRows();
  }

  async function searchPage() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
    setTitle('Search', q);
    const data = q ? await api('/search?q=' + encodeURIComponent(q)) : { results: [] };
    root.innerHTML = `<div class="card"><div class="card-b"><table class="crm-table"><thead><tr><th>Kind</th><th>Number</th><th>Label</th></tr></thead><tbody>
      ${(data.results || []).map((r) => `<tr data-href="${r.kind === 'site' ? '#/sites/' : r.kind === 'job' ? '#/jobs/' : '#/clients/'}${esc(r.id)}"><td>${esc(r.kind)}</td><td>${esc(r.public_id)}</td><td>${esc(r.label)}</td></tr>`).join('') || '<tr><td colspan="3">No matches.</td></tr>'}
    </tbody></table></div></div>`;
    wireRows();
  }

  function wireRows() {
    root.querySelectorAll('[data-href]').forEach((row) => row.addEventListener('click', () => { location.hash = row.dataset.href; }));
  }

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('search-q').value.trim();
    location.hash = '#/search?q=' + encodeURIComponent(q);
  });
  document.getElementById('burger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sb-overlay').classList.toggle('open');
  });
  window.addEventListener('hashchange', () => { if (me) render(); });
  boot();
})();
