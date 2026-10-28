/* create17b — Account creation vendor step + Fire inspection Viewing suggest */
(function () {
  const SS_KEY = 'hub_account_setup_v1';
  const DEMO_TEAM = [
    { id: 't1', name: 'Joe Martinez', role: 'Tech', email: 'joe@oakridgepm.example', revoked: false },
    { id: 't2', name: 'Fred Nguyen', role: 'Tech', email: 'fred@oakridgepm.example', revoked: false },
    { id: 't3', name: 'Dennis Cole', role: 'Tech', email: 'dennis@oakridgepm.example', revoked: false },
    { id: 't4', name: 'Ana Ruiz', role: 'Tech', email: 'ana@oakridgepm.example', revoked: false },
  ];
  const DEFAULT_VENDORS = [
    { id: 'tendco-paint', name: 'TendCo Painting', phone: '813-682-4292', email: 'workorders@tendcopm.com', request_email: 'workorders@tendcopm.com', trade: 'Painting', tendco: true },
    { id: 'tendco-clean', name: 'TendCo Cleaning', phone: '813-682-4292', email: 'workorders@tendcopm.com', request_email: 'workorders@tendcopm.com', trade: 'Cleaning', tendco: true },
    { id: 'tendco-punch', name: 'TendCo Punch', phone: '813-682-4292', email: 'workorders@tendcopm.com', request_email: 'workorders@tendcopm.com', trade: 'Punch / drywall', tendco: true },
    { id: 'tendco-common', name: 'TendCo Common area', phone: '813-682-4292', email: 'workorders@tendcopm.com', request_email: 'workorders@tendcopm.com', trade: 'Common area', tendco: true },
  ];

  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
  function saveDraft(d) {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(d)); } catch {}
  }

  const draft = loadDraft() || {
    step: 1,
    profile: {
      full_name: '',
      role: 'maintenance_supervisor',
      email: '',
      phone: '',
      property_name: '',
      address: '',
      unit_count: '',
      building_type: '',
      photo_data: '',
    },
    contacts: {
      emergency: { name: '', title: 'Emergency contact', phone: '', email: '' },
      leasing: { name: '', title: 'Leasing', phone: '', email: '' },
      regional: { name: '', title: 'Regional', phone: '', email: '' },
    },
    vendors: DEFAULT_VENDORS.map(v => ({ ...v })),
    viewingVendors: [], // create17 — outside make-ready, viewing-only
    otherVendorsChoice: '', // '' | 'yes' | 'no'
    team: DEMO_TEAM.map(t => ({ ...t })),
  };
  if (!Array.isArray(draft.viewingVendors)) draft.viewingVendors = [];
  if (typeof draft.otherVendorsChoice !== 'string') draft.otherVendorsChoice = '';

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function initials(name) {
    return String(name || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
  }
  function showErr(msg, ids) {
    const el = document.getElementById('setup-err');
    if (!el) return;
    if (!msg) { el.hidden = true; el.classList.remove('on'); el.textContent = ''; return; }
    el.hidden = false; el.classList.add('on'); el.textContent = msg;
    (ids || []).forEach(id => {
      const f = document.getElementById(id)?.closest('.field');
      if (f) f.classList.add('bad');
    });
  }
  function clearBad() {
    document.querySelectorAll('.field.bad').forEach(f => f.classList.remove('bad'));
    showErr('');
  }

  function render() {
    clearBad();
    const step = draft.step;
    document.querySelectorAll('#setup-steps span').forEach(el => {
      const s = Number(el.dataset.step);
      el.classList.toggle('on', s === step);
      el.classList.toggle('done', s < step);
    });
    const back = document.getElementById('setup-back');
    const next = document.getElementById('setup-next');
    if (back) back.hidden = step <= 1;
    if (next) {
      if (step >= 3) next.textContent = (draft.otherVendorsChoice === 'yes') ? 'Save · Enter Hub' : 'Finish · Enter Hub';
      else next.textContent = 'Continue';
    }

    const title = document.getElementById('setup-title');
    const lede = document.getElementById('setup-lede');
    const body = document.getElementById('setup-body');
    if (!body) return;

    if (step === 1) {
      if (title) title.textContent = 'Create your profile';
      if (lede) lede.textContent = 'Maintenance supervisors and property managers set up The Hub for their community.';
      const p = draft.profile;
      body.innerHTML = `
        <div class="photo-row">
          <div class="photo-preview" id="photo-preview">${p.photo_data ? `<img src="${esc(p.photo_data)}" alt="">` : esc(initials(p.full_name || 'You'))}</div>
          <div class="photo-actions">
            <label class="btn sec sm" for="photo-input">Add photo <span style="font-weight:500;color:var(--faint)">(optional)</span></label>
            <input id="photo-input" type="file" accept="image/*" hidden>
            <div class="hint">Square crop looks best · stays on this device in demo</div>
          </div>
        </div>
        <div class="field" id="f-name">
          <label for="su-name">Full name <span class="req-star">*</span></label>
          <input id="su-name" type="text" autocomplete="name" placeholder="Alex Rivera" value="${esc(p.full_name)}">
        </div>
        <div class="setup-section-h">Role</div>
        <div class="role-picks" role="radiogroup" aria-label="Role">
          <label class="role-pick${p.role==='maintenance_supervisor'?' on':''}">
            <input type="radio" name="su-role" value="maintenance_supervisor" ${p.role==='maintenance_supervisor'?'checked':''}>
            <span><b>Maintenance supervisor</b><small>Runs make-ready, crews, and vendor confirms</small></span>
          </label>
          <label class="role-pick${p.role==='property_manager'?' on':''}">
            <input type="radio" name="su-role" value="property_manager" ${p.role==='property_manager'?'checked':''}>
            <span><b>Property manager</b><small>Owns the community board and leasing dates</small></span>
          </label>
        </div>
        <div class="setup-row2">
          <div class="field" id="f-email">
            <label for="su-email">Work email <span class="req-star">*</span></label>
            <input id="su-email" type="email" autocomplete="email" placeholder="you@company.com" value="${esc(p.email)}">
          </div>
          <div class="field" id="f-phone">
            <label for="su-phone">Phone <span class="req-star">*</span></label>
            <input id="su-phone" type="tel" autocomplete="tel" placeholder="813-555-0100" value="${esc(p.phone)}">
          </div>
        </div>
        <div class="field" id="f-prop">
          <label for="su-prop">Property / community name <span class="req-star">*</span></label>
          <input id="su-prop" type="text" placeholder="Oakridge Apartments" value="${esc(p.property_name)}">
        </div>
        <div class="field" id="f-address">
          <label for="su-address">Property address <span class="req-star">*</span></label>
          <input id="su-address" type="text" autocomplete="street-address" placeholder="123 Oakridge Blvd, Winter Park, FL" value="${esc(p.address || '')}">
          <div class="hint" style="margin-top:6px;font-size:11.5px;color:var(--faint);font-weight:600">Type the full street address — not auto-filled from outreach.</div>
        </div>
        <div class="setup-row2">
          <div class="field" id="f-units">
            <label for="su-units">Number of units <span class="req-star">*</span></label>
            <input id="su-units" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 240" value="${esc(p.unit_count || '')}">
          </div>
          <div class="field" id="f-btype">
            <label>Building type <span class="req-star">*</span></label>
            <div class="btype-picks" role="radiogroup" aria-label="Building type">
              <label class="btype-pick${p.building_type==='garden_style'?' on':''}"><input type="radio" name="su-btype" value="garden_style" ${p.building_type==='garden_style'?'checked':''}><span>Garden style</span></label>
              <label class="btype-pick${p.building_type==='mid_rise'?' on':''}"><input type="radio" name="su-btype" value="mid_rise" ${p.building_type==='mid_rise'?'checked':''}><span>Mid-rise</span></label>
              <label class="btype-pick${p.building_type==='high_rise'?' on':''}"><input type="radio" name="su-btype" value="high_rise" ${p.building_type==='high_rise'?'checked':''}><span>High-rise</span></label>
            </div>
          </div>
        </div>
        <div class="admin-note">
          <b>Admin rule:</b> Only Maintenance supervisors and Property managers can create profiles for other users. They can revoke access with one click (Change password / Disconnect).
        </div>
        <div class="team-strip">
          <h3>Team on this property</h3>
          <div id="team-list">${renderTeam()}</div>
        </div>`;
      bindStep1();
    } else if (step === 2) {
      if (title) title.textContent = 'Property contacts';
      if (lede) lede.textContent = 'Who to call for emergencies, leasing, and regional — always one tap away.';
      body.innerHTML = ['emergency','leasing','regional'].map(key => contactCardHtml(key)).join('');
    } else {
      if (title) title.textContent = 'Vendors';
      if (lede) lede.textContent = 'TendCo is ready for painting, cleaning, punch, and common area. Add make-ready vendors — or skip straight into The Hub.';
      const propVendors = draft.vendors.filter(v => !v.tendco);
      const otherChoice = draft.otherVendorsChoice || '';
      const viewingList = draft.viewingVendors || [];
      body.innerHTML = `
        <div class="setup-section-h">Make-ready vendors · TendCo defaults <span class="vendor-badge">Platform</span></div>
        ${draft.vendors.filter(v => v.tendco).map(v => vendorCardHtml(v, draft.vendors.indexOf(v))).join('')}
        <div class="setup-section-h">Your make-ready vendors</div>
        <div id="prop-vendors">${propVendors.map(v => vendorCardHtml(v, draft.vendors.indexOf(v))).join('') || '<p class="hint setup-empty-hint">None yet — add carpet, pest, electric, and other trades that work on units.</p>'}</div>
        <div class="vendor-add">
          <button class="btn sec sm" type="button" id="add-vendor">+ Add make-ready vendor</button>
        </div>
        <p class="hint setup-req-hint">Required on every make-ready vendor: <b>Which is the best email to send the service request?</b> That address is the official handoff.</p>

        <div class="setup-skip-card" role="region" aria-label="Skip make-ready vendors">
          <div class="setup-skip-copy">
            <b>Don’t need make-ready vendors right now?</b>
            <span>Skip the rest of this step and enter The Hub. You can add vendors anytime.</span>
          </div>
          <button class="btn pri sm" type="button" id="skip-mr-vendors">Skip · Enter Hub</button>
        </div>

        <div class="setup-other-card" id="other-vendors-card">
          <div class="setup-section-h" style="margin-top:0">Outside make-ready <span class="vendor-badge viewing">Viewing</span></div>
          <p class="setup-other-prompt" id="other-vendors-prompt">Want to add other vendors to help you schedule your day? Fire companies, landscapers, or anyone else worth tracking — so you can keep an eye on the work without the make-ready pipeline.</p>
          <p class="setup-other-sub">Viewing only — no vendor messages, no approvals, no pipeline.</p>
          <div class="setup-other-actions" id="other-choice-row" ${otherChoice==='yes'?'hidden':''}>
            <button class="btn pri sm" type="button" id="other-yes">Yes, add vendors</button>
            <button class="btn sec sm" type="button" id="other-no">No thanks · Enter Hub</button>
          </div>
          <div id="other-vendors-form" ${otherChoice==='yes'?'':'hidden'}>
            <div class="vw-suggest-row setup-vw-suggest">
              <button type="button" class="vw-suggest" id="suggest-fire">+ Fire inspection</button>
              <span class="hint" style="font-size:12px;font-weight:600;color:var(--faint)">Suggested Viewing · annual · no vendor email</span>
            </div>
            <div id="viewing-vendor-list">${viewingList.map((v, i) => viewingVendorCardHtml(v, i)).join('') || '<p class="hint setup-empty-hint">Add a company you want on your schedule for convenience.</p>'}</div>
            <div class="vendor-add">
              <button class="btn sec sm" type="button" id="add-viewing-vendor">+ Add viewing vendor</button>
            </div>
          </div>
        </div>`;
      bindStep3();
    }
    saveDraft(draft);
  }

  function renderTeam() {
    return draft.team.map(t => `
      <div class="team-row${t.revoked?' revoked':''}" data-tid="${esc(t.id)}">
        <div class="av">${esc(initials(t.name))}</div>
        <div class="meta"><b>${esc(t.name)}</b><span>${esc(t.role)} · ${esc(t.email)}</span></div>
        ${t.revoked
          ? `<button class="btn ghost sm" type="button" data-restore="${esc(t.id)}">Restore</button>`
          : `<button class="btn sec sm" type="button" data-revoke="${esc(t.id)}" title="Change password / Disconnect">Revoke</button>`}
      </div>`).join('');
  }

  function contactCardHtml(key) {
    const labels = { emergency: 'Emergencies', leasing: 'Leasing', regional: 'Regional' };
    const c = draft.contacts[key] || {};
    return `<div class="contact-card" data-contact="${key}">
      <h3>${esc(labels[key] || key)}</h3>
      <div class="setup-row2">
        <div class="field"><label>Name</label><input data-ck="name" type="text" placeholder="Full name" value="${esc(c.name)}"></div>
        <div class="field"><label>Title</label><input data-ck="title" type="text" placeholder="Title" value="${esc(c.title)}"></div>
      </div>
      <div class="setup-row2">
        <div class="field"><label>Phone</label><input data-ck="phone" type="tel" placeholder="Phone" value="${esc(c.phone)}"></div>
        <div class="field"><label>Email</label><input data-ck="email" type="email" placeholder="Email" value="${esc(c.email)}"></div>
      </div>
    </div>`;
  }

  function vendorCardHtml(v, idx) {
    return `<div class="vendor-card${v.tendco?' tendco':''}" data-vidx="${idx}">
      <h3>${esc(v.name || 'Vendor')}${v.tendco ? ' <span class="vendor-badge">TendCo</span>' : ' <span class="vendor-badge prop">Make-ready</span>'}
        ${v.trade ? `<span style="margin-left:auto;font-size:11px;font-weight:700;color:var(--muted)">${esc(v.trade)}</span>` : ''}
      </h3>
      <div class="setup-row2">
        <div class="field"><label>Company name</label><input data-vk="name" type="text" placeholder="Company name" value="${esc(v.name)}" autocomplete="organization"></div>
        <div class="field"><label>Phone</label><input data-vk="phone" type="tel" value="${esc(v.phone || '')}"></div>
      </div>
      <div class="field"><label>Email</label><input data-vk="email" type="email" value="${esc(v.email || '')}"></div>
      <div class="field req-email-field">
        <label>Which is the best email to send the service request? <span class="req-star">*</span></label>
        <input data-vk="request_email" type="email" required placeholder="requests@vendor.com" value="${esc(v.request_email || '')}">
      </div>
      ${v.tendco ? '' : `<button class="btn ghost sm" type="button" data-rm-vendor="${idx}" style="margin-top:4px">Remove</button>`}
    </div>`;
  }

  function viewingVendorCardHtml(v, idx) {
    const fireBit = v.template === 'fire_inspection' || /fire/i.test(v.name || '')
      ? ' <span class="vendor-badge viewing">Fire</span>' : '';
    return `<div class="vendor-card viewing" data-vvidx="${idx}">
      <h3>${esc(v.name || 'Vendor')} <span class="vendor-badge viewing">Viewing</span>${fireBit}</h3>
      <div class="setup-row2">
        <div class="field"><label>Company name</label><input data-vvk="name" type="text" placeholder="e.g. Coastal Fire · GreenScape" value="${esc(v.name || '')}" autocomplete="organization"></div>
        <div class="field"><label>Phone <span style="font-weight:500;color:var(--faint)">(optional)</span></label><input data-vvk="phone" type="tel" placeholder="Phone" value="${esc(v.phone || '')}"></div>
      </div>
      <div class="field"><label>Email <span style="font-weight:500;color:var(--faint)">(optional)</span></label><input data-vvk="email" type="email" placeholder="Optional — not used for handoff" value="${esc(v.email || '')}"></div>
      <p class="hint setup-viewing-note">Courtesy tracking only. No service-request email, no approval, no make-ready pipeline.</p>
      <button class="btn ghost sm" type="button" data-rm-viewing="${idx}" style="margin-top:4px">Remove</button>
    </div>`;
  }

  function bindStep1() {
    document.querySelectorAll('.role-pick').forEach(lab => {
      lab.addEventListener('click', () => {
        document.querySelectorAll('.role-pick').forEach(x => x.classList.remove('on'));
        lab.classList.add('on');
        const inp = lab.querySelector('input');
        if (inp) inp.checked = true;
      });
    });
    document.querySelectorAll('.btype-pick').forEach(lab => {
      lab.addEventListener('click', () => {
        document.querySelectorAll('.btype-pick').forEach(x => x.classList.remove('on'));
        lab.classList.add('on');
        const inp = lab.querySelector('input');
        if (inp) { inp.checked = true; draft.profile.building_type = inp.value; saveDraft(draft); }
      });
    });
    document.getElementById('photo-input')?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 2.5e6) { showErr('Photo should be under ~2.5 MB for demo.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        draft.profile.photo_data = String(reader.result || '');
        const prev = document.getElementById('photo-preview');
        if (prev) prev.innerHTML = `<img src="${draft.profile.photo_data}" alt="">`;
        saveDraft(draft);
      };
      reader.readAsDataURL(file);
    });
    document.querySelectorAll('[data-revoke]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = draft.team.find(x => x.id === btn.dataset.revoke);
        if (!t) return;
        t.revoked = true;
        saveDraft(draft);
        const list = document.getElementById('team-list');
        if (list) list.innerHTML = renderTeam();
        bindStep1TeamOnly();
      });
    });
    bindStep1TeamOnly();
  }
  function bindStep1TeamOnly() {
    document.querySelectorAll('[data-revoke]').forEach(btn => {
      btn.onclick = () => {
        const t = draft.team.find(x => x.id === btn.dataset.revoke);
        if (!t) return;
        t.revoked = true;
        saveDraft(draft);
        const list = document.getElementById('team-list');
        if (list) list.innerHTML = renderTeam();
        bindStep1TeamOnly();
      };
    });
    document.querySelectorAll('[data-restore]').forEach(btn => {
      btn.onclick = () => {
        const t = draft.team.find(x => x.id === btn.dataset.restore);
        if (!t) return;
        t.revoked = false;
        saveDraft(draft);
        const list = document.getElementById('team-list');
        if (list) list.innerHTML = renderTeam();
        bindStep1TeamOnly();
      };
    });
  }

  function readStep1() {
    draft.profile.full_name = (document.getElementById('su-name')?.value || '').trim();
    draft.profile.email = (document.getElementById('su-email')?.value || '').trim();
    draft.profile.phone = (document.getElementById('su-phone')?.value || '').trim();
    draft.profile.property_name = (document.getElementById('su-prop')?.value || '').trim();
    draft.profile.address = (document.getElementById('su-address')?.value || '').trim();
    draft.profile.unit_count = (document.getElementById('su-units')?.value || '').trim();
    const role = document.querySelector('input[name="su-role"]:checked')?.value;
    if (role) draft.profile.role = role;
    const btype = document.querySelector('input[name="su-btype"]:checked')?.value || '';
    draft.profile.building_type = btype;
    const bad = [];
    if (!draft.profile.full_name) bad.push('f-name');
    if (!draft.profile.email || !/@/.test(draft.profile.email)) bad.push('f-email');
    if (!draft.profile.phone) bad.push('f-phone');
    if (!draft.profile.property_name) bad.push('f-prop');
    if (!draft.profile.address) bad.push('f-address');
    const unitsN = Number(draft.profile.unit_count);
    if (!draft.profile.unit_count || !Number.isFinite(unitsN) || unitsN < 1) bad.push('f-units');
    if (!draft.profile.building_type) bad.push('f-btype');
    if (bad.length) {
      showErr('Fill every required profile field to continue — including address, number of units, and building type.');
      bad.forEach(id => document.getElementById(id)?.classList.add('bad'));
      return false;
    }
    return true;
  }

  function readStep2() {
    document.querySelectorAll('.contact-card').forEach(card => {
      const key = card.dataset.contact;
      if (!draft.contacts[key]) draft.contacts[key] = {};
      card.querySelectorAll('[data-ck]').forEach(inp => {
        draft.contacts[key][inp.dataset.ck] = (inp.value || '').trim();
      });
    });
    return true;
  }

  function readViewingVendorFields() {
    document.querySelectorAll('.vendor-card.viewing[data-vvidx]').forEach(card => {
      const idx = Number(card.dataset.vvidx);
      if (!draft.viewingVendors[idx]) return;
      card.querySelectorAll('[data-vvk]').forEach(inp => {
        draft.viewingVendors[idx][inp.dataset.vvk] = (inp.value || '').trim();
      });
    });
  }

  function bindStep3() {
    document.querySelectorAll('.vendor-card[data-vidx]').forEach(card => {
      const idx = Number(card.dataset.vidx);
      card.querySelectorAll('[data-vk]').forEach(inp => {
        inp.addEventListener('change', () => {
          if (!draft.vendors[idx]) return;
          draft.vendors[idx][inp.dataset.vk] = (inp.value || '').trim();
          saveDraft(draft);
        });
      });
    });
    document.querySelectorAll('[data-rm-vendor]').forEach(btn => {
      btn.addEventListener('click', () => {
        readStep3FieldsOnly();
        readViewingVendorFields();
        const idx = Number(btn.dataset.rmVendor);
        draft.vendors.splice(idx, 1);
        render();
      });
    });
    document.getElementById('add-vendor')?.addEventListener('click', () => {
      readStep3FieldsOnly();
      readViewingVendorFields();
      draft.vendors.push({
        id: 'prop-' + Date.now().toString(36),
        name: '',
        phone: '',
        email: '',
        request_email: '',
        trade: 'Other',
        tendco: false,
      });
      render();
    });

    document.getElementById('skip-mr-vendors')?.addEventListener('click', () => {
      // Skip remaining vendor prompts (make-ready + optional viewing) → Enter Hub
      readStep3FieldsOnly();
      draft.otherVendorsChoice = 'skipped';
      enterHub({ skippedVendors: true });
    });
    document.getElementById('other-yes')?.addEventListener('click', () => {
      readStep3FieldsOnly();
      draft.otherVendorsChoice = 'yes';
      if (!draft.viewingVendors.length) {
        draft.viewingVendors.push({
          id: 'vw-setup-' + Date.now().toString(36),
          name: '',
          phone: '',
          email: '',
        });
      }
      saveDraft(draft);
      render();
    });
    document.getElementById('other-no')?.addEventListener('click', () => {
      readStep3FieldsOnly();
      draft.otherVendorsChoice = 'no';
      draft.viewingVendors = [];
      enterHub({ skippedVendors: false });
    });
    document.getElementById('suggest-fire')?.addEventListener('click', () => {
      readStep3FieldsOnly();
      readViewingVendorFields();
      if ((draft.viewingVendors || []).some(v => v.template === 'fire_inspection' || /^fire inspection$/i.test(v.name || ''))) {
        showErr('Fire inspection is already on your Viewing list.');
        return;
      }
      draft.viewingVendors.push({
        id: 'vw-setup-fire-' + Date.now().toString(36),
        name: 'Fire inspection',
        phone: '',
        email: '',
        template: 'fire_inspection',
      });
      saveDraft(draft);
      render();
    });
    document.getElementById('add-viewing-vendor')?.addEventListener('click', () => {
      readStep3FieldsOnly();
      readViewingVendorFields();
      draft.viewingVendors.push({
        id: 'vw-setup-' + Date.now().toString(36),
        name: '',
        phone: '',
        email: '',
      });
      saveDraft(draft);
      render();
    });
    document.querySelectorAll('[data-rm-viewing]').forEach(btn => {
      btn.addEventListener('click', () => {
        readStep3FieldsOnly();
        readViewingVendorFields();
        draft.viewingVendors.splice(Number(btn.dataset.rmViewing), 1);
        saveDraft(draft);
        render();
      });
    });
    document.querySelectorAll('.vendor-card.viewing [data-vvk]').forEach(inp => {
      inp.addEventListener('change', () => {
        readViewingVendorFields();
        saveDraft(draft);
      });
    });
  }

  function readStep3FieldsOnly() {
    document.querySelectorAll('.vendor-card[data-vidx]').forEach(card => {
      const idx = Number(card.dataset.vidx);
      if (!draft.vendors[idx]) return;
      card.querySelectorAll('[data-vk]').forEach(inp => {
        draft.vendors[idx][inp.dataset.vk] = (inp.value || '').trim();
      });
    });
  }

  function readStep3() {
    readStep3FieldsOnly();
    readViewingVendorFields();
    // Only validate make-ready vendors that are present (TendCo + property)
    const missing = draft.vendors.find(v => !v.request_email || !/@/.test(v.request_email));
    if (missing) {
      showErr('Every make-ready vendor needs a best email for service requests — including “' + (missing.name || 'new vendor') + '”.');
      document.querySelectorAll('.vendor-card[data-vidx]').forEach(card => {
        const idx = Number(card.dataset.vidx);
        const v = draft.vendors[idx];
        if (v && (!v.request_email || !/@/.test(v.request_email))) {
          card.querySelector('[data-vk="request_email"]')?.closest('.field')?.classList.add('bad');
        }
      });
      return false;
    }
    const emptyName = draft.vendors.find(v => !v.tendco && !v.name);
    if (emptyName) {
      showErr('Give each make-ready vendor a company name, or remove the blank card.');
      return false;
    }
    if (draft.otherVendorsChoice === 'yes') {
      const blank = (draft.viewingVendors || []).find(v => !String(v.name || '').trim());
      if (blank) {
        showErr('Give each viewing vendor a company name, or remove the blank card.');
        return false;
      }
    }
    return true;
  }

  const VW_SS_KEY = 'hub_viewing_items_v1';

  function persistViewingVendorsToHub() {
    const fromSetup = (draft.viewingVendors || [])
      .filter(v => String(v.name || '').trim())
      .map(v => {
        const name = String(v.name || '').trim();
        const bits = [v.phone, v.email].filter(Boolean);
        const isFire = v.template === 'fire_inspection' || /^fire inspection$/i.test(name);
        if (isFire) {
          return {
            id: v.id || ('vw-setup-fire-' + Date.now().toString(36)),
            title: 'Fire inspection',
            kind: 'fire_inspection',
            cadence: 'annual',
            days: [],
            month: 11,
            monthday: 3,
            once: '',
            week_block_days: 5,
            notes: (bits.length ? bits.join(' · ') + ' · ' : '') + 'Viewing only — no communication',
            phone: v.phone || '',
            email: v.email || '',
            from_setup: true,
            demo: false,
          };
        }
        return {
          id: v.id || ('vw-setup-' + Date.now().toString(36)),
          title: name,
          kind: 'other',
          cadence: 'monthly',
          days: [],
          monthday: 1,
          once: '',
          notes: (bits.length ? bits.join(' · ') + ' · ' : '') + 'Viewing only — no communication',
          phone: v.phone || '',
          email: v.email || '',
          from_setup: true,
          demo: false,
        };
      });
    if (!fromSetup.length) return;
    let existing = [];
    try {
      const raw = sessionStorage.getItem(VW_SS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) existing = parsed;
      }
    } catch {}
    // Drop prior setup-sourced rows, keep demo / user Hub items
    existing = existing.filter(x => !x.from_setup);
    const ids = new Set(fromSetup.map(x => x.id));
    existing = existing.filter(x => !ids.has(x.id));
    try { sessionStorage.setItem(VW_SS_KEY, JSON.stringify(existing.concat(fromSetup))); } catch {}
  }

  function enterHub(opts) {
    const o = opts || {};
    saveDraft(draft);
    if (!o.skippedVendors && draft.otherVendorsChoice === 'yes') {
      persistViewingVendorsToHub();
    }
    try { sessionStorage.setItem('hub_setup_complete', '1'); } catch {}
    location.href = 'app.html?demo=1&v=20261027mobileAgenda';
  }

  function finish() {
    enterHub({ skippedVendors: false });
  }

  function goHubSkip() {
    // Footer “Skip to Hub” — leave setup entirely
    location.href = 'app.html?demo=1&v=20261027mobileAgenda';
  }

  document.getElementById('setup-back')?.addEventListener('click', () => {
    if (draft.step === 2) readStep2();
    if (draft.step === 3) readStep3();
    draft.step = Math.max(1, draft.step - 1);
    render();
  });
  document.getElementById('setup-next')?.addEventListener('click', () => {
    if (draft.step === 1) {
      if (!readStep1()) return;
      draft.step = 2;
      render();
      return;
    }
    if (draft.step === 2) {
      readStep2();
      draft.step = 3;
      render();
      return;
    }
    if (!readStep3()) return;
    finish();
  });
  document.getElementById('setup-skip')?.addEventListener('click', goHubSkip);

  // Prefill demo-friendly values if empty (faster call demo)
  if (!draft.profile.full_name) {
    draft.profile.full_name = 'Alex Rivera';
    draft.profile.email = 'alex@oakridgepm.example';
    draft.profile.phone = '813-555-0142';
    draft.profile.property_name = 'Oakridge Apartments';
    draft.contacts.emergency = { name: 'Front desk / after-hours', title: 'Emergency', phone: '813-555-0911', email: 'emergency@oakridgepm.example' };
    draft.contacts.leasing = { name: 'Sam Ortiz', title: 'Leasing manager', phone: '813-555-0188', email: 'leasing@oakridgepm.example' };
    draft.contacts.regional = { name: 'Jordan Lee', title: 'Regional PM', phone: '813-555-0177', email: 'regional@oakridgepm.example' };
  }

  render();
})();
