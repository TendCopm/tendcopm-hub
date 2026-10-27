/* Houses — address book, map pins, area clusters.
 * Separate from multifamily make-ready units. Preview data is Central Florida SFR.
 * Straight-line nearest-neighbor loops (not drive time).
 * Curb view (detail only): Street View Static when a key is set, else a Maps link.
 * A crew exterior photo (exteriorPhotoUrl) overrides Street View.
 */
(function () {
  const EXTRA_KEY = 'hub_houses_extra_v1';
  /* Demo overlay: { houses: { [id]: { exteriorPhotoUrl } } }. Seed rows stay in SEED. */
  const DEMO_KEY = 'hub_houses_demo_v1';
  const AREA_ORDER = ['altamonte', 'winter-park', 'college-park', 'conway', 'belle-isle', 'kissimmee'];

  const COMPANIES = [
    { id: 'oak-pine', name: 'Oak & Pine Homes' },
    { id: 'lakeside', name: 'Lakeside Residential' },
    { id: 'horizon', name: 'Horizon Property Co.' },
    { id: 'cedar', name: 'Cedar & Co.' },
  ];

  const AREAS = {
    altamonte: { id: 'altamonte', name: 'Altamonte', city: 'Altamonte Springs', lat: 28.663, lng: -81.380 },
    'winter-park': { id: 'winter-park', name: 'Winter Park', city: 'Winter Park', lat: 28.598, lng: -81.351 },
    'college-park': { id: 'college-park', name: 'College Park', city: 'Orlando', lat: 28.571, lng: -81.384 },
    conway: { id: 'conway', name: 'Conway', city: 'Orlando', lat: 28.490, lng: -81.340 },
    'belle-isle': { id: 'belle-isle', name: 'Belle Isle', city: 'Belle Isle', lat: 28.456, lng: -81.349 },
    kissimmee: { id: 'kissimmee', name: 'Kissimmee', city: 'Kissimmee', lat: 28.300, lng: -81.411 },
  };

  const JOBS = ['Turnover', 'Interior paint', 'Touch-up paint', 'Make-ready clean', 'Carpet', 'Punch', 'Locks', 'Drywall', 'Plumbing', 'HVAC', 'Housekeeping'];
  const CREWS = ['Joe', 'Fred', 'Dennis', 'Ana', 'Maya', 'TendCo Cleaning', 'TendCo Painting', 'Floor Pro Carpet', 'Sunshine Carpet'];

  const STATUS = {
    received: { label: 'Received', pill: 'n' },
    scheduled: { label: 'Scheduled', pill: 'b' },
    in_progress: { label: 'In progress', pill: 'a' },
    punch: { label: 'Punch', pill: 'p' },
    complete: { label: 'Tended', pill: 'g' },
  };

  /* Optional exteriorPhotoUrl (data URL or https) overrides Street View. Not set on the seed. */
  const SEED = [
    { id: 'hs-cp-1', street: '812 W Princeton St', city: 'Orlando', zip: '32804', areaId: 'college-park', companyId: 'oak-pine', lat: 28.57285, lng: -81.38955, job: 'Interior paint', status: 'scheduled', window: '2026-11-03', crew: 'Joe', notes: 'Lockbox on the side gate' },
    { id: 'hs-cp-2', street: '640 W Harvard St', city: 'Orlando', zip: '32804', areaId: 'college-park', companyId: 'oak-pine', lat: 28.56995, lng: -81.38540, job: 'Turnover', status: 'in_progress', window: '2026-11-02', crew: 'Ana', notes: 'Owner will meet the crew' },
    { id: 'hs-cp-3', street: '1614 N Shine Ave', city: 'Orlando', zip: '32804', areaId: 'college-park', companyId: 'oak-pine', lat: 28.56690, lng: -81.37940, job: 'Carpet', status: 'received', window: '2026-11-04', crew: 'Floor Pro Carpet', notes: '' },
    { id: 'hs-cp-4', street: '415 W Smith St', city: 'Orlando', zip: '32804', areaId: 'college-park', companyId: 'oak-pine', lat: 28.57470, lng: -81.38160, job: 'Punch', status: 'punch', window: '2026-11-03', crew: 'Maya', notes: 'Punch list is on the fridge' },
    { id: 'hs-wp-1', street: '327 N New England Ave', city: 'Winter Park', zip: '32789', areaId: 'winter-park', companyId: 'oak-pine', lat: 28.59390, lng: -81.35540, job: 'Interior paint', status: 'scheduled', window: '2026-11-05', crew: 'Fred', notes: '' },
    { id: 'hs-wp-2', street: '875 N Pennsylvania Ave', city: 'Winter Park', zip: '32789', areaId: 'winter-park', companyId: 'oak-pine', lat: 28.60110, lng: -81.35190, job: 'Make-ready clean', status: 'scheduled', window: '2026-11-05', crew: 'TendCo Cleaning', notes: '' },
    { id: 'hs-wp-3', street: '430 E Lyman Ave', city: 'Winter Park', zip: '32789', areaId: 'winter-park', companyId: 'oak-pine', lat: 28.59755, lng: -81.34640, job: 'Drywall', status: 'in_progress', window: '2026-11-06', crew: 'Dennis', notes: 'Garage code on the work note' },
    { id: 'hs-wp-4', street: '955 W Canton Ave', city: 'Winter Park', zip: '32789', areaId: 'winter-park', companyId: 'oak-pine', lat: 28.59020, lng: -81.36080, job: 'Locks', status: 'complete', window: '2026-10-24', crew: 'Joe', notes: '' },
    { id: 'hs-wp-5', street: '210 W Comstock Ave', city: 'Winter Park', zip: '32789', areaId: 'winter-park', companyId: 'horizon', lat: 28.60440, lng: -81.34880, job: 'HVAC', status: 'received', window: '2026-11-12', crew: 'Joe', notes: 'Horizon home — keep it on the Winter Park loop, not the Kissimmee day' },
    { id: 'hs-cw-1', street: '1412 Gaston Foster Rd', city: 'Orlando', zip: '32812', areaId: 'conway', companyId: 'lakeside', lat: 28.48080, lng: -81.33950, job: 'Turnover', status: 'scheduled', window: '2026-11-04', crew: 'Ana', notes: '' },
    { id: 'hs-cw-2', street: '1822 Crystal Lake Dr', city: 'Orlando', zip: '32806', areaId: 'conway', companyId: 'lakeside', lat: 28.48860, lng: -81.34820, job: 'Carpet', status: 'in_progress', window: '2026-11-03', crew: 'Sunshine Carpet', notes: '' },
    { id: 'hs-cw-3', street: '3616 E Grant St', city: 'Orlando', zip: '32806', areaId: 'conway', companyId: 'lakeside', lat: 28.50010, lng: -81.34180, job: 'Touch-up paint', status: 'scheduled', window: '2026-11-04', crew: 'Fred', notes: '' },
    { id: 'hs-bi-1', street: '685 Nela Ave', city: 'Belle Isle', zip: '32809', areaId: 'belle-isle', companyId: 'lakeside', lat: 28.46240, lng: -81.35180, job: 'Locks', status: 'scheduled', window: '2026-11-06', crew: 'Maya', notes: '' },
    { id: 'hs-bi-2', street: '1924 Hoffner Ave', city: 'Belle Isle', zip: '32809', areaId: 'belle-isle', companyId: 'lakeside', lat: 28.45560, lng: -81.33940, job: 'Housekeeping', status: 'received', window: '2026-11-07', crew: 'TendCo Cleaning', notes: '' },
    { id: 'hs-bi-3', street: '3012 Daetwyler Dr', city: 'Belle Isle', zip: '32812', areaId: 'belle-isle', companyId: 'lakeside', lat: 28.45120, lng: -81.35620, job: 'Interior paint', status: 'scheduled', window: '2026-11-06', crew: 'TendCo Painting', notes: '' },
    { id: 'hs-ks-1', street: '14 Monument Ave', city: 'Kissimmee', zip: '34741', areaId: 'kissimmee', companyId: 'horizon', lat: 28.30160, lng: -81.40860, job: 'Turnover', status: 'scheduled', window: '2026-11-10', crew: 'Dennis', notes: '' },
    { id: 'hs-ks-2', street: '215 Verona St', city: 'Kissimmee', zip: '34741', areaId: 'kissimmee', companyId: 'horizon', lat: 28.29290, lng: -81.41720, job: 'Interior paint', status: 'scheduled', window: '2026-11-10', crew: 'Fred', notes: '' },
    { id: 'hs-ks-3', street: '112 Broadway', city: 'Kissimmee', zip: '34741', areaId: 'kissimmee', companyId: 'horizon', lat: 28.30870, lng: -81.41240, job: 'Plumbing', status: 'in_progress', window: '2026-11-09', crew: 'Joe', notes: '' },
    { id: 'hs-ks-4', street: '808 Penfield St', city: 'Kissimmee', zip: '34741', areaId: 'kissimmee', companyId: 'horizon', lat: 28.29740, lng: -81.40380, job: 'Make-ready clean', status: 'complete', window: '2026-10-22', crew: 'Ana', notes: '' },
    { id: 'hs-al-1', street: '218 Maitland Ave', city: 'Altamonte Springs', zip: '32701', areaId: 'altamonte', companyId: 'cedar', lat: 28.66440, lng: -81.36850, job: 'Interior paint', status: 'scheduled', window: '2026-11-08', crew: 'Maya', notes: '' },
    { id: 'hs-al-2', street: '120 Boston Ave', city: 'Altamonte Springs', zip: '32701', areaId: 'altamonte', companyId: 'cedar', lat: 28.65880, lng: -81.39220, job: 'Turnover', status: 'scheduled', window: '2026-11-08', crew: 'TendCo Cleaning', notes: '' },
  ];

  const ui = {
    company: 'all',
    scope: 'all',
    q: '',
    focusId: null,
    focusAreaId: null,
    view: 'houses',
  };

  let map = null;
  let layer = null;
  let fitting = false;
  let fitKey = '';
  let exteriorSeq = 0;

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function companyById(id) { return COMPANIES.find(c => c.id === id) || null; }
  function companyName(id) { return (companyById(id) || {}).name || 'Company'; }
  function statusMeta(status) { return STATUS[status] || STATUS.received; }

  function loadExtras() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(EXTRA_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(h => h && h.id && h.street && Number.isFinite(+h.lat) && Number.isFinite(+h.lng));
    } catch { return []; }
  }

  function loadDemoStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { houses: {} };
      if (!raw.houses || typeof raw.houses !== 'object' || Array.isArray(raw.houses)) raw.houses = {};
      return raw;
    } catch { return { houses: {} }; }
  }

  function exteriorPhotoUrl(h) {
    if (!h) return '';
    const row = loadDemoStore().houses[h.id];
    const stored = row && typeof row.exteriorPhotoUrl === 'string' ? row.exteriorPhotoUrl : '';
    return stored || (typeof h.exteriorPhotoUrl === 'string' ? h.exteriorPhotoUrl : '');
  }

  function persistExterior(id, url) {
    const store = loadDemoStore();
    if (url) store.houses[id] = { exteriorPhotoUrl: url };
    else delete store.houses[id];
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(store));
    } catch {
      return false;
    }
    const extras = loadExtras();
    const idx = extras.findIndex(h => h.id === id);
    if (idx >= 0) {
      if (url) extras[idx].exteriorPhotoUrl = url;
      else delete extras[idx].exteriorPhotoUrl;
      try { sessionStorage.setItem(EXTRA_KEY, JSON.stringify(extras)); } catch {}
    }
    return true;
  }

  function allHomes() {
    const houses = loadDemoStore().houses;
    return SEED.concat(loadExtras()).map(h => {
      const row = houses[h.id];
      const url = (row && typeof row.exteriorPhotoUrl === 'string' && row.exteriorPhotoUrl) || h.exteriorPhotoUrl || '';
      if (!url) return h;
      return Object.assign({}, h, { exteriorPhotoUrl: url });
    });
  }

  function homeById(id) {
    return allHomes().find(h => h.id === id) || null;
  }

  function miles(a, b) {
    const R = 3958.8;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180;
    const la2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function fmtMi(n) {
    if (!Number.isFinite(n) || n < 0.05) return 'nearby';
    if (n < 10) return n.toFixed(1) + ' mi';
    return Math.round(n) + ' mi';
  }

  function routeOrder(homes) {
    const unused = homes.slice();
    if (unused.length <= 1) return unused;
    unused.sort((a, b) => a.lng - b.lng || a.lat - b.lat);
    const ordered = [unused.shift()];
    while (unused.length) {
      const last = ordered[ordered.length - 1];
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < unused.length; i++) {
        const d = miles(last, unused[i]);
        if (d < bestD) { bestD = d; best = i; }
      }
      ordered.push(unused.splice(best, 1)[0]);
    }
    return ordered;
  }

  function routeMiles(ordered) {
    let sum = 0;
    for (let i = 1; i < ordered.length; i++) sum += miles(ordered[i - 1], ordered[i]);
    return sum;
  }

  function legs(ordered) {
    const out = [0];
    for (let i = 1; i < ordered.length; i++) out.push(miles(ordered[i - 1], ordered[i]));
    return out;
  }

  function companyMix(homes) {
    const counts = new Map();
    homes.forEach(h => counts.set(h.companyId, (counts.get(h.companyId) || 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => companyName(id) + ' ' + n)
      .join(' · ');
  }

  function sortAreaIds(ids) {
    return ids.slice().sort((a, b) => AREA_ORDER.indexOf(a) - AREA_ORDER.indexOf(b));
  }

  function groupsFrom(homes) {
    const by = new Map();
    homes.forEach(h => {
      if (!by.has(h.areaId)) by.set(h.areaId, []);
      by.get(h.areaId).push(h);
    });
    return sortAreaIds([...by.keys()]).map(areaId => {
      const list = by.get(areaId).slice().sort((a, b) => a.street.localeCompare(b.street));
      const open = list.filter(h => h.status !== 'complete');
      const routed = routeOrder(open.length ? open : list);
      return {
        areaId,
        area: AREAS[areaId],
        homes: list,
        routed,
        lat: list.reduce((s, h) => s + h.lat, 0) / list.length,
        lng: list.reduce((s, h) => s + h.lng, 0) / list.length,
        loopMiles: routeMiles(routed),
      };
    }).filter(g => g.area);
  }

  function houseView() {
    const h = (location.hash || '').replace(/^#/, '').split('/')[0];
    if (h === 'houses' || h === 'houses-map' || h === 'houses-routes') return h;
    return ui.view || 'houses';
  }

  function syncFromHash() {
    const parts = (location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    const view = parts[0] || '';
    if (!view.startsWith('houses')) return;
    ui.view = view;
    ui.focusAreaId = null;
    if (parts[1] && parts[1] !== 'all' && companyById(parts[1])) ui.company = parts[1];
    const areaPart = (parts[2] && AREAS[parts[2]]) ? parts[2] : ((parts[1] && AREAS[parts[1]]) ? parts[1] : '');
    if (areaPart) ui.focusAreaId = areaPart;
  }

  function filteredHomes(opts) {
    const q = ui.q.trim().toLowerCase();
    const areaLimit = !!(opts && opts.area && ui.focusAreaId);
    return allHomes().filter(h => {
      if (ui.company !== 'all' && h.companyId !== ui.company) return false;
      if (ui.scope === 'open' && h.status === 'complete') return false;
      if (areaLimit && h.areaId !== ui.focusAreaId) return false;
      if (!q) return true;
      const area = AREAS[h.areaId];
      const blob = [h.street, h.city, h.zip, area && area.name, companyName(h.companyId), h.job, h.crew, h.notes].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }

  function whenLabel(h) {
    if (typeof fmtDate === 'function') return fmtDate(h.window) || 'TBD';
    return h.window || 'TBD';
  }

  function refreshNavCount() {
    const n = allHomes().filter(h => h.status !== 'complete').length;
    const el = document.getElementById('nav-houses-cnt');
    if (el) el.textContent = String(n);
    const sub = document.getElementById('hs-board-sub');
    if (sub) {
      const homes = allHomes();
      sub.textContent = homes.length + ' addresses · ' + n + ' open. Keyed by street, not unit number. Sample Central Florida book.';
    }
  }

  function filterBarHtml() {
    const homes = allHomes().filter(h => ui.scope === 'open' ? h.status !== 'complete' : true);
    const chips = [{ id: 'all', name: 'All', n: homes.length }].concat(COMPANIES.map(c => ({
      id: c.id,
      name: c.name,
      n: homes.filter(h => h.companyId === c.id).length,
    })));
    return `<div class="hs-filters">
      <div class="hs-chips" role="tablist" aria-label="Company">
        ${chips.map(c => `<button type="button" class="hs-chip${ui.company === c.id ? ' on' : ''}" data-hs-act="company" data-company="${esc(c.id)}" role="tab" aria-selected="${ui.company === c.id ? 'true' : 'false'}">${esc(c.name)} <span>${c.n}</span></button>`).join('')}
      </div>
      <div class="hs-filters-row">
        <input class="hs-search" type="search" placeholder="Search street, city, company…" value="${esc(ui.q)}" aria-label="Search addresses">
        <div class="seg seg-sm" role="group" aria-label="Which houses">
          <button type="button" class="seg-btn${ui.scope === 'all' ? ' on' : ''}" data-hs-act="scope" data-scope="all">All</button>
          <button type="button" class="seg-btn${ui.scope === 'open' ? ' on' : ''}" data-hs-act="scope" data-scope="open">Open</button>
        </div>
      </div>
    </div>`;
  }

  function paintFilterBar(el) {
    if (el) el.innerHTML = filterBarHtml();
  }

  function paintBoard() {
    const root = document.getElementById('hs-board');
    if (!root) return;
    const homes = filteredHomes();
    const groups = groupsFrom(homes);
    if (!groups.length) {
      root.innerHTML = '<p class="hs-empty">No addresses match.</p>';
      return;
    }
    root.innerHTML = groups.map(g => {
      const onlyCompany = new Set(g.homes.map(h => h.companyId)).size === 1 ? g.homes[0].companyId : 'all';
      return `<section class="hs-area">
        <header class="hs-area-h">
          <div>
            <h3>${esc(g.area.name)} <span>${esc(g.area.city)}</span></h3>
            <p>${g.homes.length} home${g.homes.length === 1 ? '' : 's'} · ${esc(companyMix(g.homes))} · about ${esc(fmtMi(g.loopMiles))} straight-line</p>
          </div>
          <button type="button" class="btn sec sm" data-hs-act="route" data-company="${esc(onlyCompany)}" data-area="${esc(g.areaId)}">Route this area</button>
        </header>
        ${g.homes.map(h => {
          const meta = statusMeta(h.status);
          const on = h.id === ui.focusId ? ' on' : '';
          const done = h.status === 'complete' ? ' done' : '';
          return `<button type="button" class="hs-row${on}${done}" data-hs-act="open" data-id="${esc(h.id)}">
            <span class="hs-row-main"><b>${esc(h.street)}</b><small>${esc(h.city)}, FL ${esc(h.zip)} · ${esc(companyName(h.companyId))}</small></span>
            <span class="hs-row-job">${esc(h.job)} · ${esc(whenLabel(h))} · ${esc(h.crew || 'Unassigned')}</span>
            <span class="pill ${meta.pill}">${esc(meta.label)}</span>
          </button>`;
        }).join('')}
      </section>`;
    }).join('');
  }

  function paintRoutes() {
    const root = document.getElementById('hs-routes');
    if (!root) return;
    const homes = filteredHomes();
    const ids = [...new Set(homes.map(h => h.companyId))];
    ids.sort((a, b) => {
      const aa = new Set(homes.filter(h => h.companyId === a).map(h => h.areaId)).size;
      const bb = new Set(homes.filter(h => h.companyId === b).map(h => h.areaId)).size;
      if (bb !== aa) return bb - aa;
      return companyName(a).localeCompare(companyName(b));
    });
    const multi = ids.filter(id => new Set(homes.filter(h => h.companyId === id).map(h => h.areaId)).size > 1).map(companyName);
    const who = multi.length <= 1 ? (multi[0] || '') : (multi.length === 2 ? (multi[0] + ' and ' + multi[1]) : (multi.slice(0, -1).join(', ') + ', and ' + multi[multi.length - 1]));
    const note = multi.length
      ? `<div class="hs-note">${esc(who)} ${multi.length === 1 ? 'has' : 'have'} homes in more than one area. Each area is its own loop so the crew stays nearby.</div>`
      : '<div class="hs-note">Loops are grouped by area. Straight-line order is a routing sketch — not drive time.</div>';
    if (!ids.length) {
      root.innerHTML = note + '<p class="hs-empty">No addresses match.</p>';
      return;
    }
    root.innerHTML = note + ids.map(id => {
      const list = homes.filter(h => h.companyId === id);
      const groups = groupsFrom(list);
      const areaN = groups.length;
      const sub = areaN > 1
        ? (list.length + ' homes · ' + areaN + ' areas — do not run these as one long day.')
        : (list.length + ' home' + (list.length === 1 ? '' : 's') + ' · one area.');
      return `<section class="hs-co">
        <h3>${esc(companyName(id))}</h3>
        <p class="hs-co-sub">${esc(sub)}</p>
        <div class="hs-loops">${groups.map(g => {
          const leg = legs(g.routed);
          return `<article class="card hs-loop">
            <div class="hs-loop-h">
              <div>
                <h4>${esc(g.area.name)}</h4>
                <div class="meta">${g.routed.length} stop${g.routed.length === 1 ? '' : 's'} · about ${esc(fmtMi(g.loopMiles))}</div>
              </div>
              <button type="button" class="btn sec sm" data-hs-act="route" data-company="${esc(id)}" data-area="${esc(g.areaId)}">Show on map</button>
            </div>
            <ol class="hs-stops">${g.routed.map((h, i) => `<li><button type="button" data-hs-act="open" data-id="${esc(h.id)}"><span>${i + 1}. ${esc(h.street)}</span><small>${i === 0 ? 'Start' : esc(fmtMi(leg[i]))}</small></button></li>`).join('')}</ol>
          </article>`;
        }).join('')}</div>
      </section>`;
    }).join('');
  }

  function paintMapSide() {
    const side = document.getElementById('hs-map-side');
    if (!side) return;
    const focused = ui.focusAreaId && AREAS[ui.focusAreaId];
    const homes = filteredHomes({ area: !!focused });
    if (!homes.length) {
      side.innerHTML = '<h3>No addresses</h3><p class="sub">Nothing matches this company or search.</p>';
      return;
    }
    if (focused) {
      const groups = groupsFrom(homes);
      const g = groups[0];
      const mix = companyMix(homes);
      const multiCo = new Set(homes.map(h => h.companyId)).size > 1;
      const leg = g ? legs(g.routed) : [];
      side.innerHTML = `<div class="hs-side-actions"><button type="button" class="btn ghost sm" data-hs-act="clear-focus">All areas</button></div>
        <h3>${esc((ui.company !== 'all' ? companyName(ui.company) + ' · ' : '') + focused.name)}</h3>
        <p class="sub">${multiCo ? 'Proximity loop — every company in this neighborhood.' : 'Company loop — these stops stay in one area.'} ${esc(mix)}. About ${esc(g ? fmtMi(g.loopMiles) : '')} straight-line.</p>
        ${(g ? g.routed : []).map((h, i) => `<button type="button" class="hs-stop${h.id === ui.focusId ? ' on' : ''}" data-hs-act="open" data-id="${esc(h.id)}"><b>${i + 1}. ${esc(h.street)}</b><span>${esc(h.job)} · ${esc(h.crew || 'Unassigned')} · ${i === 0 ? 'Start' : esc(fmtMi(leg[i]))}</span></button>`).join('')}`;
      return;
    }
    const groups = groupsFrom(homes);
    side.innerHTML = `<h3>Areas</h3><p class="sub">Zoomed out, each bubble is a neighborhood. Open one to see a pin per address and a stop order.</p>
      ${groups.map(g => `<button type="button" class="hs-area-btn" data-hs-act="route" data-company="${esc(ui.company)}" data-area="${esc(g.areaId)}"><b>${esc(g.area.name)} · ${g.homes.length}</b><span>${esc(companyMix(g.homes))} · about ${esc(fmtMi(g.loopMiles))}</span></button>`).join('')}`;
  }

  function shouldCluster(homes) {
    if (!map) return true;
    const zoom = map.getZoom();
    if (ui.focusAreaId) return zoom < 14;
    const areas = new Set(homes.map(h => h.areaId)).size;
    if (areas <= 1) return zoom < 14;
    return zoom < 13;
  }

  function drawMap() {
    if (!map || !layer) return;
    const homes = filteredHomes({ area: !!ui.focusAreaId });
    layer.clearLayers();
    if (!homes.length) return;
    const cluster = shouldCluster(homes);
    if (cluster) {
      groupsFrom(homes).forEach(g => {
        const icon = L.divIcon({
          className: 'hs-divicon',
          html: `<div class="hs-cluster" title="${esc(g.area.name)}"><b>${g.homes.length}</b></div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });
        const marker = L.marker([g.lat, g.lng], { icon, keyboard: true, title: g.area.name });
        marker.bindTooltip(g.area.name + ' · ' + g.homes.length, {
          permanent: true, direction: 'bottom', className: 'hs-area-tip', offset: [0, 8],
        });
        marker.on('click', () => {
          const company = ui.company !== 'all' ? ui.company : 'all';
          location.hash = 'houses-map/' + company + '/' + g.areaId;
        });
        marker.addTo(layer);
      });
      return;
    }
    const open = homes.filter(h => h.status !== 'complete');
    const ordered = routeOrder(open.length ? open : homes);
    const orderOf = new Map(ordered.map((h, i) => [h.id, i + 1]));
    if (ui.focusAreaId && ordered.length > 1) {
      L.polyline(ordered.map(h => [h.lat, h.lng]), {
        color: '#1F5BD8', weight: 3, opacity: 0.9,
      }).addTo(layer);
    }
    homes.forEach(h => {
      const n = ui.focusAreaId ? orderOf.get(h.id) : 0;
      const on = h.id === ui.focusId;
      const done = h.status === 'complete';
      const icon = n
        ? L.divIcon({
          className: 'hs-divicon',
          html: `<div class="hs-numpin${on ? ' on' : ''}"><span>${n}</span></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })
        : L.divIcon({
          className: 'hs-divicon',
          html: `<div class="hs-pin${on ? ' on' : ''}${done ? ' done' : ''}"></div>`,
          iconSize: [on ? 18 : 14, on ? 18 : 14],
          iconAnchor: [on ? 9 : 7, on ? 9 : 7],
        });
      const marker = L.marker([h.lat, h.lng], { icon, keyboard: true, title: h.street, zIndexOffset: on ? 400 : 0 });
      marker.bindTooltip(h.street, { direction: 'top', offset: [0, -6], className: 'hs-pin-tip' });
      marker.on('click', () => openHouse(h.id));
      marker.addTo(layer);
    });
  }

  function fitTo(homes) {
    if (!map || !homes.length || typeof L === 'undefined') return;
    fitting = true;
    try {
      const b = L.latLngBounds(homes.map(h => [h.lat, h.lng]));
      const areas = new Set(homes.map(h => h.areaId)).size;
      let maxZoom = 11;
      if (ui.focusAreaId || areas <= 1) maxZoom = 15;
      else if (areas === 2) maxZoom = 12;
      map.fitBounds(b.pad(0.2), { animate: false, maxZoom: maxZoom });
    } catch {} finally {
      fitting = false;
    }
    drawMap();
  }

  function renderFallback(homes) {
    const el = document.getElementById('hs-map');
    if (!el) return;
    const all = allHomes();
    const minLat = Math.min.apply(null, all.map(h => h.lat));
    const maxLat = Math.max.apply(null, all.map(h => h.lat));
    const minLng = Math.min.apply(null, all.map(h => h.lng));
    const maxLng = Math.max.apply(null, all.map(h => h.lng));
    const x = lng => ((lng - minLng) / Math.max(0.0001, maxLng - minLng)) * 86 + 7;
    const y = lat => (1 - (lat - minLat) / Math.max(0.0001, maxLat - minLat)) * 82 + 8;
    const groups = groupsFrom(homes);
    el.innerHTML = `<div class="hs-fallback-map" aria-hidden="true">${groups.map(g => {
      return `<button type="button" class="hs-cluster" style="left:${x(g.lng)}%;top:${y(g.lat)}%" data-hs-act="route" data-company="${esc(ui.company)}" data-area="${esc(g.areaId)}"><b>${g.homes.length}</b></button>`;
    }).join('')}</div>`;
  }

  function ensureMap() {
    if (map) return map;
    if (typeof L === 'undefined') return null;
    const el = document.getElementById('hs-map');
    if (!el) return null;
    el.innerHTML = '';
    map = L.map(el, { scrollWheelZoom: true, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on('zoomend', () => { if (!fitting) drawMap(); });
    return map;
  }

  function renderMap() {
    paintFilterBar(document.getElementById('hs-filters-map'));
    const homes = filteredHomes({ area: !!ui.focusAreaId });
    const fb = document.getElementById('hs-map-fallback');
    const m = ensureMap();
    if (!m) {
      if (fb) fb.hidden = false;
      renderFallback(filteredHomes({ area: false }));
      paintMapSide();
      return;
    }
    if (fb) fb.hidden = true;
    const areaKey = [...new Set(homes.map(h => h.areaId))].sort().join(',');
    const nextKey = [ui.company, ui.focusAreaId || '', ui.scope, areaKey].join('|');
    const sized = map.getSize && map.getSize().y > 40;
    if (nextKey !== fitKey || !sized) {
      fitKey = nextKey;
      fitTo(homes.length ? homes : filteredHomes());
    } else {
      drawMap();
    }
    paintMapSide();
    setTimeout(() => {
      if (!map) return;
      const before = map.getSize().y;
      try { map.invalidateSize(); } catch { return; }
      if (before < 40 && map.getSize().y > 40) fitTo(filteredHomes({ area: !!ui.focusAreaId }));
    }, 80);
  }

  function render(name) {
    syncFromHash();
    ui.view = name || houseView();
    refreshNavCount();
    if (ui.view === 'houses') {
      paintFilterBar(document.getElementById('hs-filters-board'));
      paintBoard();
    } else if (ui.view === 'houses-map') {
      renderMap();
    } else if (ui.view === 'houses-routes') {
      paintFilterBar(document.getElementById('hs-filters-routes'));
      paintRoutes();
    }
  }

  function mapsApiKey() {
    let key = '';
    try { key = String(window.TENDCO_MAPS_KEY || '').trim(); } catch {}
    if (!key) {
      const meta = document.querySelector('meta[name="tendco-maps-key"]');
      key = meta ? String(meta.getAttribute('content') || '').trim() : '';
    }
    if (!key || /^YOUR_/i.test(key) || key === 'GOOGLE_MAPS_API_KEY') return '';
    return key;
  }

  function streetViewHref(h) {
    const lat = Number(h.lat);
    const lng = Number(h.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return 'https://maps.google.com/@?api=1&map_action=pano&viewpoint='
        + lat.toFixed(6) + ',' + lng.toFixed(6) + '&fov=90';
    }
    const q = [h.street, h.city, 'FL', h.zip].filter(Boolean).join(', ');
    return 'https://maps.google.com/?q=' + encodeURIComponent(q);
  }

  /* Heading is omitted so Street View aims the camera at the pin. Outdoor first. */
  function streetViewUrl(h, key, outdoor) {
    const params = new URLSearchParams({
      size: '640x360',
      location: Number(h.lat).toFixed(6) + ',' + Number(h.lng).toFixed(6),
      fov: '90',
      pitch: '0',
      return_error_code: 'true',
      key: key,
    });
    if (outdoor !== false) params.set('source', 'outdoor');
    return 'https://maps.googleapis.com/maps/api/streetview?' + params.toString();
  }

  function curbHtml(h) {
    const has = !!exteriorPhotoUrl(h);
    const href = streetViewHref(h);
    return `<figure class="hs-curb${has ? '' : ' is-empty'}">
      <div class="hs-curb-frame">
        <img class="hs-curb-img" alt="" hidden>
        <div class="hs-curb-ph">
          <div class="hs-curb-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V20h12v-9.5"/></svg></div>
          <p class="hs-curb-ph-title">From the curb</p>
          <p class="hs-curb-ph-copy">Street View appears here once a Maps key is set.</p>
          <a class="hs-curb-open" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open in Street View</a>
        </div>
        <span class="hs-curb-badge" hidden>Street View</span>
      </div>
      <figcaption class="hs-curb-cap">
        <label class="btn ghost sm hs-curb-file">${has ? 'Replace photo' : 'Add exterior photo'}
          <input type="file" accept="image/*" id="hs-exterior-file" aria-label="${has ? 'Replace exterior photo' : 'Add exterior photo'}">
        </label>
        <button type="button" class="btn ghost sm hs-curb-remove" data-hs-act="exterior-remove" data-id="${esc(h.id)}" ${has ? '' : 'hidden'}>Remove</button>
        <a class="hs-curb-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open in Street View</a>
      </figcaption>
    </figure>`;
  }

  function showCurbPlaceholder(frame, copy) {
    const img = frame.querySelector('.hs-curb-img');
    const ph = frame.querySelector('.hs-curb-ph');
    const badge = frame.querySelector('.hs-curb-badge');
    const text = frame.querySelector('.hs-curb-ph-copy');
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.hidden = true;
      img.removeAttribute('src');
    }
    if (ph) ph.hidden = false;
    if (badge) badge.hidden = true;
    if (text) text.textContent = copy;
    frame.classList.add('is-empty');
    frame.classList.remove('is-photo');
  }

  function mountCurb(h) {
    const frame = document.querySelector('#hs-d-body .hs-curb');
    if (!frame) return;
    const img = frame.querySelector('.hs-curb-img');
    const ph = frame.querySelector('.hs-curb-ph');
    const badge = frame.querySelector('.hs-curb-badge');
    const text = frame.querySelector('.hs-curb-ph-copy');
    if (!img || !ph || !badge) return;
    const crew = exteriorPhotoUrl(h);
    const key = mapsApiKey();
    const latOk = Number.isFinite(+h.lat) && Number.isFinite(+h.lng);

    function usePhoto(src, kind) {
      badge.hidden = false;
      badge.dataset.kind = kind;
      badge.textContent = kind === 'crew' ? 'Crew photo' : 'Street View';
      img.alt = 'Curb view of ' + (h.street || 'this house');
      img.referrerPolicy = kind === 'street' ? 'no-referrer-when-downgrade' : 'no-referrer';
      img.hidden = true;
      ph.hidden = false;
      if (text) text.textContent = kind === 'crew' ? 'Loading exterior photo…' : 'Loading curb view…';
      img.onload = function () {
        img.hidden = false;
        ph.hidden = true;
        frame.classList.remove('is-empty');
        frame.classList.add('is-photo');
      };
      img.onerror = function () {
        if (kind === 'crew' && key && latOk) {
          usePhoto(streetViewUrl(h, key, true), 'street');
          return;
        }
        if (kind === 'street' && img.dataset.retried !== '1') {
          img.dataset.retried = '1';
          usePhoto(streetViewUrl(h, key, false), 'street');
          return;
        }
        showCurbPlaceholder(frame, kind === 'crew'
          ? 'That exterior photo didn’t load. Open the curb in Google Maps.'
          : 'No Street View imagery for this address.');
      };
      img.src = src;
    }

    if (crew) {
      usePhoto(crew, 'crew');
      return;
    }
    if (key && latOk) {
      if (text) text.textContent = 'Loading curb view…';
      badge.hidden = false;
      badge.dataset.kind = 'street';
      badge.textContent = 'Street View';
      usePhoto(streetViewUrl(h, key, true), 'street');
      return;
    }
    showCurbPlaceholder(frame, 'Street View appears here once a Maps key is set.');
  }

  function photoApiReady() {
    if (typeof api !== 'function') return false;
    if (typeof isDemoMode === 'function' && isDemoMode()) return false;
    const hub = window.HubState;
    return !!(hub && hub.photosBound);
  }

  async function pushExterior(id, packed) {
    if (!photoApiReady() || !packed) return '';
    try {
      const data = await api('/houses/' + encodeURIComponent(id) + '/exterior', {
        method: 'POST',
        body: JSON.stringify({ kind: 'exterior', ...packed }),
      });
      if (data && data.photos_bound === false) return '';
      return (data && data.url) ? String(data.url) : '';
    } catch {
      return '';
    }
  }

  async function deleteRemoteExterior(id) {
    if (!photoApiReady()) return;
    try {
      await api('/houses/' + encodeURIComponent(id) + '/exterior', { method: 'DELETE' });
    } catch {}
  }

  async function packExteriorFile(file) {
    if (typeof compressImageFile !== 'function') throw new Error('Could not read that photo');
    let packed = await compressImageFile(file, 960, 0.68);
    if (packed && packed.bytes > 450000) packed = await compressImageFile(file, 720, 0.58);
    return packed;
  }

  async function onExteriorFile(e) {
    const input = e.target;
    if (!input || input.id !== 'hs-exterior-file') return;
    const file = input.files && input.files[0];
    input.value = '';
    const id = ui.focusId;
    if (!file || !id) return;
    if (file.type && !/^image\//.test(file.type)) {
      if (typeof toast === 'function') toast('Choose a photo');
      return;
    }
    const seq = ++exteriorSeq;
    try {
      const packed = await packExteriorFile(file);
      if (seq !== exteriorSeq) return;
      const dataUrl = 'data:' + packed.content_type + ';base64,' + packed.data_base64;
      const remote = await pushExterior(id, packed);
      if (seq !== exteriorSeq) return;
      const stored = remote || dataUrl;
      if (!persistExterior(id, stored)) {
        if (typeof toast === 'function') toast('That photo is too large to keep in this browser');
        return;
      }
      if (typeof toast === 'function') {
        toast(remote ? 'Exterior photo saved' : 'Exterior photo saved on this device');
      }
      openHouse(id);
    } catch (err) {
      if (typeof toast === 'function') toast((err && err.message) || 'Could not add that photo');
    }
  }

  function openHouse(id) {
    const h = homeById(id);
    if (!h) return;
    ui.focusId = id;
    if (typeof closeDrawer === 'function') closeDrawer();
    const meta = statusMeta(h.status);
    const area = AREAS[h.areaId];
    document.getElementById('hs-d-title').textContent = h.street;
    document.getElementById('hs-d-sub').textContent = h.city + ', FL ' + (h.zip || '');
    document.getElementById('hs-d-body').innerHTML = `
      ${curbHtml(h)}
      <span class="pill ${meta.pill}">${esc(meta.label)}</span>
      <dl class="hs-kv">
        <dt>Address</dt><dd>${esc(h.street)}<br>${esc(h.city)}, FL ${esc(h.zip || '')}</dd>
        <dt>Area</dt><dd>${esc(area ? area.name : '')}</dd>
        <dt>Company</dt><dd>${esc(companyName(h.companyId))}</dd>
        <dt>Job</dt><dd>${esc(h.job || '—')}</dd>
        <dt>Window</dt><dd>${esc(whenLabel(h))}</dd>
        <dt>Crew</dt><dd>${esc(h.crew || 'Unassigned')}</dd>
        ${h.notes ? `<dt>Notes</dt><dd>${esc(h.notes)}</dd>` : ''}
      </dl>
      <div class="hs-side-actions">
        <button type="button" class="btn pri sm" data-hs-act="show-map" data-id="${esc(h.id)}">Show on map</button>
        ${h.userAdded ? `<button type="button" class="btn ghost sm" data-hs-act="remove" data-id="${esc(h.id)}">Remove</button>` : ''}
      </div>
      <p class="sub" style="color:var(--muted);font-size:12.5px;margin-top:8px">This is a house, tracked by street address — not a make-ready unit.</p>`;
    const drawer = document.getElementById('house-drawer');
    const bg = document.getElementById('house-drawer-bg');
    try { mountCurb(h); } catch {}
    if (drawer) { drawer.classList.add('on'); drawer.setAttribute('aria-hidden', 'false'); }
    if (bg) bg.classList.add('on');
    if (houseView() === 'houses') paintBoard();
    if (houseView() === 'houses-map' && map) drawMap();
    if (houseView() === 'houses-map') paintMapSide();
  }

  function closeHouseDrawer() {
    const drawer = document.getElementById('house-drawer');
    const bg = document.getElementById('house-drawer-bg');
    if (drawer) { drawer.classList.remove('on'); drawer.setAttribute('aria-hidden', 'true'); }
    if (bg) bg.classList.remove('on');
  }

  function fillAddSelects() {
    const area = document.getElementById('hs-area');
    const company = document.getElementById('hs-company');
    const job = document.getElementById('hs-job');
    const crew = document.getElementById('hs-crew');
    if (area && !area.options.length) {
      area.innerHTML = sortAreaIds(Object.keys(AREAS)).map(id => `<option value="${esc(id)}">${esc(AREAS[id].name)}</option>`).join('');
    }
    if (company && !company.options.length) {
      company.innerHTML = COMPANIES.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    }
    if (job && !job.options.length) job.innerHTML = JOBS.map(j => `<option>${esc(j)}</option>`).join('');
    if (crew && !crew.options.length) crew.innerHTML = CREWS.map(j => `<option>${esc(j)}</option>`).join('');
  }

  function openAdd() {
    fillAddSelects();
    const err = document.getElementById('hs-add-err');
    if (err) { err.textContent = ''; err.classList.remove('on'); }
    const street = document.getElementById('hs-street');
    const city = document.getElementById('hs-city');
    const zip = document.getElementById('hs-zip');
    const notes = document.getElementById('hs-notes');
    const date = document.getElementById('hs-date');
    if (street) street.value = '';
    if (city) { city.value = AREAS['college-park'].city; delete city.dataset.touched; }
    if (zip) zip.value = '';
    if (notes) notes.value = '';
    const area = document.getElementById('hs-area');
    if (area) area.value = 'college-park';
    if (date && typeof todayKeyNY === 'function' && typeof addDaysKey === 'function') {
      date.value = addDaysKey(todayKeyNY(), 7);
    }
    const root = document.getElementById('hs-add-root');
    if (root) root.hidden = false;
    setTimeout(() => street && street.focus(), 30);
  }

  function closeAdd() {
    const root = document.getElementById('hs-add-root');
    if (root) root.hidden = true;
  }

  function showAddErr(msg) {
    const el = document.getElementById('hs-add-err');
    if (!el) { if (typeof toast === 'function') toast(msg); return; }
    el.textContent = msg;
    el.classList.add('on');
  }

  function placeInArea(areaId, salt) {
    const area = AREAS[areaId];
    if (!area) return { lat: 28.54, lng: -81.37 };
    let n = 0;
    const s = String(salt || 'house');
    for (let i = 0; i < s.length; i++) n = (n * 33 + s.charCodeAt(i)) >>> 0;
    const homes = allHomes().filter(h => h.areaId === areaId);
    for (let k = 0; k < 12; k++) {
      const ang = ((n + k * 47) % 360) * Math.PI / 180;
      const r = 0.0032 + ((n + k) % 5) * 0.00065;
      const lat = area.lat + Math.cos(ang) * r;
      const lng = area.lng + Math.sin(ang) * r;
      const clash = homes.some(h => miles({ lat, lng }, h) < 0.08);
      if (!clash) return { lat, lng };
    }
    return { lat: area.lat + 0.004, lng: area.lng + 0.004 };
  }

  function saveAdd(e) {
    e.preventDefault();
    const street = (document.getElementById('hs-street').value || '').trim();
    const city = (document.getElementById('hs-city').value || '').trim();
    const zip = (document.getElementById('hs-zip').value || '').trim();
    const areaId = document.getElementById('hs-area').value;
    const companyId = document.getElementById('hs-company').value;
    const job = document.getElementById('hs-job').value;
    const crew = document.getElementById('hs-crew').value;
    const windowDate = document.getElementById('hs-date').value;
    const notes = (document.getElementById('hs-notes').value || '').trim();
    if (street.length < 4) { showAddErr('Enter a street address.'); return; }
    if (!AREAS[areaId] || !companyById(companyId)) { showAddErr('Pick an area and a company.'); return; }
    const dup = allHomes().some(h => h.street.toLowerCase() === street.toLowerCase() && (h.city || '').toLowerCase() === city.toLowerCase());
    if (dup) { showAddErr('That address is already on the board.'); return; }
    const pos = placeInArea(areaId, street + city);
    const row = {
      id: 'hs-user-' + Date.now().toString(36),
      street, city: city || AREAS[areaId].city, zip, areaId, companyId,
      lat: pos.lat, lng: pos.lng, job, status: 'received', window: windowDate, crew, notes,
      userAdded: true, exteriorPhotoUrl: '',
    };
    const extras = loadExtras();
    extras.push(row);
    try { sessionStorage.setItem(EXTRA_KEY, JSON.stringify(extras)); } catch {}
    closeAdd();
    ui.focusId = row.id;
    ui.company = companyId;
    refreshNavCount();
    if (typeof toast === 'function') toast(street + ' added');
    if (!document.body.classList.contains('portfolio-houses')) {
      const sel = document.getElementById('property-mode-app');
      if (sel) { sel.value = 'sfh'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    location.hash = 'houses/' + companyId;
    render('houses');
    openHouse(row.id);
  }

  function removeHouse(id) {
    const next = loadExtras().filter(h => h.id !== id);
    try { sessionStorage.setItem(EXTRA_KEY, JSON.stringify(next)); } catch {}
    persistExterior(id, '');
    deleteRemoteExterior(id);
    if (ui.focusId === id) ui.focusId = null;
    closeHouseDrawer();
    fitKey = '';
    refreshNavCount();
    render(houseView());
    if (typeof toast === 'function') toast('House removed');
  }

  function setCompany(id) {
    ui.company = id || 'all';
    ui.focusAreaId = null;
    const view = houseView();
    const next = ui.company === 'all' ? view : (view + '/' + ui.company);
    if ((location.hash || '').replace(/^#/, '') !== next) location.hash = next;
    else render(view);
  }

  function setScope(scope) {
    ui.scope = scope === 'open' ? 'open' : 'all';
    fitKey = '';
    render(houseView());
  }

  function onAct(e) {
    const el = e.target.closest('[data-hs-act]');
    if (!el) return;
    const act = el.dataset.hsAct;
    if (act === 'company') { e.preventDefault(); setCompany(el.dataset.company || 'all'); }
    else if (act === 'scope') { e.preventDefault(); setScope(el.dataset.scope); }
    else if (act === 'open') { e.preventDefault(); openHouse(el.dataset.id); }
    else if (act === 'route') {
      e.preventDefault();
      const company = el.dataset.company || 'all';
      ui.company = company && company !== 'all' ? company : 'all';
      location.hash = 'houses-map/' + (ui.company === 'all' ? 'all' : ui.company) + '/' + el.dataset.area;
    }
    else if (act === 'show-map') {
      e.preventDefault();
      const h = homeById(el.dataset.id);
      if (!h) return;
      ui.focusId = h.id;
      ui.company = h.companyId;
      location.hash = 'houses-map/' + h.companyId + '/' + h.areaId;
    }
    else if (act === 'clear-focus') {
      e.preventDefault();
      ui.focusAreaId = null;
      location.hash = ui.company !== 'all' ? ('houses-map/' + ui.company) : 'houses-map';
    }
    else if (act === 'remove') { e.preventDefault(); removeHouse(el.dataset.id); }
    else if (act === 'exterior-remove') {
      e.preventDefault();
      const id = el.dataset.id;
      if (!id) return;
      exteriorSeq += 1;
      persistExterior(id, '');
      deleteRemoteExterior(id);
      if (typeof toast === 'function') toast('Exterior photo removed');
      openHouse(id);
    }
  }

  function onSearch(e) {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains('hs-search')) return;
    ui.q = t.value;
    document.querySelectorAll('.hs-search').forEach(el => { if (el !== t) el.value = ui.q; });
    const view = houseView();
    if (view === 'houses') paintBoard();
    else if (view === 'houses-map') { drawMap(); paintMapSide(); }
    else if (view === 'houses-routes') paintRoutes();
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function applyMode(mode, opts) {
    const houses = mode === 'sfh';
    document.body.classList.toggle('portfolio-houses', houses);
    document.getElementById('nav-mf')?.classList.toggle('hidden', houses);
    document.getElementById('nav-hs')?.classList.toggle('hidden', !houses);
    document.getElementById('btn-nav-create-mr')?.classList.toggle('hidden', houses);
    document.getElementById('btn-nav-add-house')?.classList.toggle('hidden', !houses);
    document.getElementById('btn-top-create-mr')?.classList.toggle('hidden', houses);
    document.getElementById('btn-top-add-house')?.classList.toggle('hidden', !houses);
    document.querySelectorAll('[data-portfolio]').forEach(btn => {
      const on = btn.dataset.portfolio === mode;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const sel = document.getElementById('property-mode-app');
    if (sel && sel.value !== mode) sel.value = mode;
    const hs = window.HubState;
    const client = (hs && hs.user && hs.user.client_name) || 'Client';
    const free = document.querySelector('.sb-foot .free');
    if (houses) {
      const homes = allHomes();
      const areas = new Set(homes.map(h => h.areaId)).size;
      setText('prop-name', 'Residential book');
      setText('prop-initials', 'HS');
      setText('prop-meta', homes.length + ' addresses · ' + areas + ' areas');
      setText('banner-client', '· Houses');
      if (free) free.textContent = 'Free for TendCo™ clients — address board and map for houses. Separate from unit make-ready.';
      refreshNavCount();
    } else {
      closeHouseDrawer();
      closeAdd();
      setText('prop-name', client);
      setText('prop-initials', typeof initials === 'function' ? initials(client) : 'TC');
      const units = (hs && hs.units) ? hs.units.length : 0;
      const plural = typeof lex === 'function' ? lex().unit_plural : 'units';
      setText('prop-meta', units + ' ' + plural);
      setText('banner-client', '· ' + client);
      if (free) free.textContent = 'Free for TendCo™ clients — turns board + unit schedules while we run your turns.';
    }
    const navigate = !opts || opts.navigate !== false;
    if (!navigate) return;
    const cur = (location.hash || '').replace(/^#/, '').split('/')[0];
    if (houses) {
      if (!cur.startsWith('houses')) location.hash = 'houses';
    } else if (cur.startsWith('houses')) {
      location.hash = 'make-ready';
    }
  }

  function onRefresh() {
    const mode = (window.HubState && window.HubState.user && window.HubState.user.property_mode) || 'multifamily';
    applyMode(mode, { navigate: false });
  }

  document.querySelectorAll('[data-portfolio]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.portfolio;
      const sel = document.getElementById('property-mode-app');
      if (!sel) return;
      if (sel.value === mode) {
        applyMode(mode, { navigate: true });
        return;
      }
      sel.value = mode;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  document.getElementById('btn-nav-add-house')?.addEventListener('click', openAdd);
  document.getElementById('btn-top-add-house')?.addEventListener('click', openAdd);
  document.getElementById('btn-hs-add')?.addEventListener('click', openAdd);
  document.getElementById('hs-d-close')?.addEventListener('click', closeHouseDrawer);
  document.getElementById('house-drawer-bg')?.addEventListener('click', closeHouseDrawer);
  document.getElementById('hs-add-x')?.addEventListener('click', closeAdd);
  document.getElementById('hs-add-cancel')?.addEventListener('click', closeAdd);
  document.getElementById('hs-add-root')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAdd();
  });
  document.getElementById('hs-add-form')?.addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('hs-add-form')?.addEventListener('submit', saveAdd);
  document.getElementById('hs-area')?.addEventListener('change', () => {
    const area = AREAS[document.getElementById('hs-area').value];
    const city = document.getElementById('hs-city');
    if (area && city && !city.dataset.touched) city.value = area.city;
  });
  document.getElementById('hs-city')?.addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
  document.addEventListener('input', onSearch);
  document.addEventListener('change', onExteriorFile);
  document.addEventListener('click', onAct);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAdd();
    closeHouseDrawer();
  });

  window.HubHouses = {
    applyMode,
    onRefresh,
    render,
    homes: allHomes,
    routeOrder,
    miles,
  };
})();
