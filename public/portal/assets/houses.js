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
    { id: 'hs-hb-1', street: '640 West Harbor Street', city: 'Orlando', zip: '32804', areaId: 'college-park', companyId: 'oak-pine', lat: 28.56740, lng: -81.39320, job: 'House flip', status: 'in_progress', window: '2026-11-02', crew: 'Several crews', notes: 'Longer flip than a unit. Pool, roof, painters, and pressure washing can share a day.', engineer: 'Maya' },
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

  /* One engineer per client book — the apartments supervisor, across street addresses. */
  const ENGINEERS = {
    'oak-pine': 'Maya',
    lakeside: 'Dennis',
    horizon: 'Joe',
    cedar: 'Ana',
  };

  /*
   * Services sit beside the address. Same date = parallel contractors, not a second day.
   * Houses missing from this book still show their single job / window / crew.
   * 640 West Harbor is the long flip (more trades, wider window than a unit).
   */
  const SERVICE_BOOK = {
    'hs-hb-1': [
      { id: 'hb-strip', label: 'Floor stripping', vendor: 'FloorPro Floors', kind: 'vendor', date: '2026-11-02', status: 'in_progress' },
      { id: 'hb-wash', label: 'Pressure washing', vendor: 'Harbor Wash Co.', kind: 'vendor', date: '2026-11-02', status: 'scheduled' },
      { id: 'hb-tile', label: 'Tiles', vendor: 'TileCraft', kind: 'vendor', date: '2026-11-03', status: 'scheduled' },
      { id: 'hb-land', label: 'Landscaping', vendor: 'Greenline Yards', kind: 'vendor', date: '2026-11-03', status: 'scheduled' },
      { id: 'hb-paint', label: 'Painters', vendor: 'TendCo Painting', kind: 'inhouse', date: '2026-11-04', status: 'scheduled' },
      { id: 'hb-roofc', label: 'Roofers', vendor: 'Ridge Roofing', kind: 'vendor', date: '2026-11-04', status: 'scheduled' },
      { id: 'hb-carp', label: 'Carpet', vendor: 'Floor Pro Carpet', kind: 'vendor', date: '2026-11-05', status: 'scheduled' },
      { id: 'hb-tree', label: 'Tree trimming', vendor: 'Canopy Tree Care', kind: 'vendor', date: '2026-11-06', status: 'scheduled' },
      { id: 'hb-gutter', label: 'Gutter cleaning', vendor: 'Ridge Roofing', kind: 'vendor', date: '2026-11-06', status: 'scheduled' },
      { id: 'hb-pool', label: 'Pool services', vendor: 'Clearwater Pool', kind: 'vendor', date: '2026-11-09', status: 'scheduled' },
      { id: 'hb-irr', label: 'Irrigation system', vendor: 'Sprinkler South', kind: 'vendor', date: '2026-11-09', status: 'received' },
      { id: 'hb-roof', label: 'Roof repairs', vendor: 'Ridge Roofing', kind: 'vendor', date: '2026-11-10', status: 'scheduled' },
      { id: 'hb-clean', label: 'Floor cleaning', vendor: 'TendCo Cleaning', kind: 'inhouse', date: '2026-11-12', status: 'scheduled' },
      { id: 'hb-walk', label: 'Final walk', vendor: 'Maya', kind: 'inhouse', date: '2026-11-18', status: 'received' },
    ],
    'hs-cp-1': [
      { id: 'cp1-paint', label: 'Interior paint', vendor: 'TendCo Painting', kind: 'inhouse', date: '2026-11-03', status: 'scheduled' },
      { id: 'cp1-punch', label: 'Punch', vendor: 'Maya', kind: 'inhouse', date: '2026-11-04', status: 'scheduled' },
    ],
    'hs-cp-2': [
      { id: 'cp2-carp', label: 'Carpet', vendor: 'Floor Pro Carpet', kind: 'vendor', date: '2026-11-02', status: 'in_progress' },
      { id: 'cp2-paint', label: 'Interior paint', vendor: 'TendCo Painting', kind: 'inhouse', date: '2026-11-03', status: 'scheduled' },
      { id: 'cp2-clean', label: 'Make-ready clean', vendor: 'TendCo Cleaning', kind: 'inhouse', date: '2026-11-05', status: 'scheduled' },
    ],
    'hs-cw-1': [
      { id: 'cw1-land', label: 'Landscaping', vendor: 'Greenline Yards', kind: 'vendor', date: '2026-11-04', status: 'scheduled' },
      { id: 'cw1-paint', label: 'Painters', vendor: 'TendCo Painting', kind: 'inhouse', date: '2026-11-04', status: 'scheduled' },
      { id: 'cw1-clean', label: 'Make-ready clean', vendor: 'TendCo Cleaning', kind: 'inhouse', date: '2026-11-06', status: 'received' },
    ],
  };

  const SPAN_KEY = 'hub_houses_span_v1';

  const ui = {
    company: 'all',
    scope: 'all',
    q: '',
    focusId: null,
    focusAreaId: null,
    view: 'houses',
    /* all = map shows every location. day/week/month highlight booked houses. */
    spanMode: 'all',
    anchor: '2026-11-02',
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

  function engineerFor(h) {
    if (!h) return '';
    if (h.engineer) return h.engineer;
    return ENGINEERS[h.companyId] || '';
  }

  function vendorKind(name) {
    const n = String(name || '');
    if (/^TendCo\b/.test(n) || /^(Joe|Fred|Dennis|Ana|Maya)$/.test(n)) return 'inhouse';
    return 'vendor';
  }

  function keyParts(key) {
    if (typeof parseKey === 'function') return parseKey(key);
    const [y, m, d] = String(key || '').split('-').map(Number);
    return new Date(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0);
  }

  function shiftKey(key, n) {
    if (typeof addDaysKey === 'function') return addDaysKey(key, n);
    const d = keyParts(key);
    d.setDate(d.getDate() + n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function fmtDay(key) {
    if (!key) return 'TBD';
    if (typeof fmtDate === 'function') return fmtDate(key) || key;
    return key;
  }

  function weekdayShort(key) {
    try { return keyParts(key).toLocaleDateString('en-US', { weekday: 'short' }); }
    catch { return ''; }
  }

  function monthTitle(key) {
    try { return keyParts(key).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
    catch { return key || ''; }
  }

  function weekStart(key) {
    const day = keyParts(key).getDay();
    const delta = day === 0 ? -6 : 1 - day;
    return shiftKey(key, delta);
  }

  function weekEnd(key) { return shiftKey(weekStart(key), 6); }

  function monthStart(key) {
    const d = keyParts(key);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
  }

  function monthEnd(key) {
    const d = keyParts(key);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0);
    return last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0');
  }

  function loadSpan() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(SPAN_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return;
      if (raw.mode !== 'all' && raw.mode !== 'day' && raw.mode !== 'week' && raw.mode !== 'month') return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.anchor || '')) return;
      ui.spanMode = raw.mode;
      ui.anchor = raw.anchor;
    } catch {}
  }

  function saveSpan() {
    try { sessionStorage.setItem(SPAN_KEY, JSON.stringify({ mode: ui.spanMode, anchor: ui.anchor })); } catch {}
  }

  function spanBounds() {
    if (ui.spanMode === 'day') return { start: ui.anchor, end: ui.anchor };
    if (ui.spanMode === 'week') return { start: weekStart(ui.anchor), end: weekEnd(ui.anchor) };
    if (ui.spanMode === 'month') return { start: monthStart(ui.anchor), end: monthEnd(ui.anchor) };
    return null;
  }

  function dateInSpan(date) {
    if (!date || ui.spanMode === 'all') return false;
    const b = spanBounds();
    return !!b && date >= b.start && date <= b.end;
  }

  function decorate(h) {
    const services = (Array.isArray(h.services) && h.services.length) ? h.services : SERVICE_BOOK[h.id];
    const engineer = h.engineer || ENGINEERS[h.companyId] || '';
    if (!services && !engineer) return h;
    const next = Object.assign({}, h);
    if (engineer) next.engineer = engineer;
    if (services) next.services = services;
    return next;
  }

  function homeServices(h) {
    if (!h) return [];
    let list = Array.isArray(h.services) && h.services.length ? h.services : null;
    if (!list && (h.window || h.job)) {
      list = [{
        id: h.id + '-job',
        label: h.job || 'Service',
        vendor: h.crew || 'Unassigned',
        kind: vendorKind(h.crew),
        date: h.window || '',
        status: h.status || 'received',
      }];
    }
    return (list || []).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }

  function groupByDate(services) {
    const map = new Map();
    services.forEach(s => {
      const k = s.date || 'tbd';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    });
    return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }

  function houseInSpan(h) {
    if (ui.spanMode === 'all') return true;
    return homeServices(h).some(s => s.date && dateInSpan(s.date));
  }

  function servicesInSpan(h) {
    return homeServices(h).filter(s => s.date && dateInSpan(s.date));
  }

  function spanLabel() {
    if (ui.spanMode === 'all') return 'All dates';
    if (ui.spanMode === 'day') return weekdayShort(ui.anchor) + ' ' + fmtDay(ui.anchor);
    if (ui.spanMode === 'week') return 'Week of ' + fmtDay(weekStart(ui.anchor));
    return monthTitle(ui.anchor);
  }

  function bookedHomes(list) {
    const homes = list || filteredHomes();
    if (ui.spanMode === 'all') return homes;
    return homes.filter(houseInSpan);
  }

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
      const base = url ? Object.assign({}, h, { exteriorPhotoUrl: url }) : h;
      return decorate(base);
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
      const svcBlob = homeServices(h).map(s => (s.label || '') + ' ' + (s.vendor || '')).join(' ');
      const blob = [h.street, h.city, h.zip, area && area.name, companyName(h.companyId), engineerFor(h), h.job, h.crew, h.notes, svcBlob].join(' ').toLowerCase();
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
      sub.textContent = homes.length + ' addresses · ' + n + ' open. One engineer oversees several homes. Open a house for every service and its calendar.';
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

  function rowSummary(h) {
    const svcs = homeServices(h);
    if (svcs.length <= 1) {
      const s = svcs[0];
      const label = (s && s.label) || h.job || '—';
      const who = (s && s.vendor) || h.crew || 'Unassigned';
      const when = (s && s.date) ? fmtDay(s.date) : whenLabel(h);
      return esc(label) + ' · ' + esc(when) + ' · ' + esc(who);
    }
    const dates = svcs.map(s => s.date).filter(Boolean).sort();
    const max = groupByDate(svcs).reduce((m, pair) => Math.max(m, pair[1].length), 1);
    const range = dates.length
      ? (fmtDay(dates[0]) + (dates[0] !== dates[dates.length - 1] ? ' – ' + fmtDay(dates[dates.length - 1]) : ''))
      : whenLabel(h);
    const parallel = max > 1 ? ' · parallel crews' : '';
    return esc(svcs.length + ' services · ' + range + parallel);
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
    const harbor = homes.find(h => h.id === 'hs-hb-1');
    const jump = harbor
      ? `<div class="hs-note">Open <button type="button" class="hs-jump" data-hs-act="open" data-id="hs-hb-1">640 West Harbor Street</button> — full house profile, overlapping crews on one date, and that house’s calendar.</div>`
      : '';
    root.innerHTML = jump + groups.map(g => {
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
          const marked = ui.spanMode !== 'all' && houseInSpan(h) ? ' in-span' : '';
          const eng = engineerFor(h);
          return `<button type="button" class="hs-row${on}${done}${marked}" data-hs-act="open" data-id="${esc(h.id)}">
            <span class="hs-row-main"><b>${esc(h.street)}</b><small>${esc(h.city)}, FL ${esc(h.zip)} · ${esc(companyName(h.companyId))}${eng ? ' · ' + esc(eng) : ''}</small></span>
            <span class="hs-row-job">${rowSummary(h)}</span>
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

  function housesOnDate(list, date) {
    const seen = new Set();
    list.forEach(h => {
      if (homeServices(h).some(s => s.date === date)) seen.add(h.id);
    });
    return seen.size;
  }

  function monthCellsHtml(countFn) {
    const start = monthStart(ui.anchor);
    const end = monthEnd(ui.anchor);
    const firstDow = keyParts(start).getDay();
    const lead = firstDow === 0 ? 6 : firstDow - 1;
    let html = '';
    for (let i = 0; i < lead; i++) html += '<span class="hs-cal-pad"></span>';
    let cursor = start;
    while (cursor <= end) {
      const n = countFn(cursor) || 0;
      const cls = ['hs-cal-cell'];
      if (n) cls.push('has');
      if (n > 1) cls.push('multi');
      if (dateInSpan(cursor)) cls.push('in-span');
      if (ui.spanMode === 'day' && cursor === ui.anchor) cls.push('on');
      const dots = n ? '<span class="hs-cal-dots">' + '<i></i>'.repeat(Math.min(n, 3)) + (n > 1 ? '<em>' + n + '</em>' : '') + '</span>' : '<span class="hs-cal-dots"></span>';
      html += `<button type="button" class="${cls.join(' ')}" data-hs-act="cal-day" data-date="${cursor}"><b>${Number(cursor.slice(8))}</b>${dots}</button>`;
      cursor = shiftKey(cursor, 1);
    }
    return html;
  }

  function calChromeHtml(note) {
    const modes = [
      ['all', 'All'],
      ['day', 'Day'],
      ['week', 'Week'],
      ['month', 'Month'],
    ].map(([id, label]) => `<button type="button" class="seg-btn${ui.spanMode === id ? ' on' : ''}" data-hs-act="span-mode" data-mode="${id}">${label}</button>`).join('');
    return `<div class="hs-cal-h">
        <div class="hs-cal-nav">
          <button type="button" class="ibtn" data-hs-act="span-nav" data-dir="-1" aria-label="Previous">‹</button>
          <strong>${esc(monthTitle(ui.anchor))}</strong>
          <button type="button" class="ibtn" data-hs-act="span-nav" data-dir="1" aria-label="Next">›</button>
        </div>
        <div class="seg seg-sm hs-cal-modes" role="group" aria-label="Map range">${modes}</div>
      </div>
      <p class="hs-cal-note">${note}</p>
      <div class="hs-cal-dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>`;
  }

  function spanNote() {
    const n = bookedHomes(filteredHomes()).length;
    if (ui.spanMode === 'all') return 'Pick a day, week, or month. The map highlights the houses booked then.';
    if (ui.spanMode === 'day') return esc(spanLabel()) + ' highlights ' + n + ' house' + (n === 1 ? '' : 's') + ' on the map.';
    if (ui.spanMode === 'week') return esc(spanLabel()) + ' shows ' + n + ' house' + (n === 1 ? '' : 's') + ' booked that week.';
    return esc(spanLabel()) + ' shows ' + n + ' house' + (n === 1 ? '' : 's') + ' scheduled that month.';
  }

  function houseCalendarHtml(h) {
    const svcs = homeServices(h);
    const count = date => svcs.filter(s => s.date === date).length;
    return `<section class="hs-cal" id="hs-profile-cal" aria-label="Calendar for this house">
      <h4>House calendar</h4>
      ${calChromeHtml('<span>Dots are crews on this house. ' + spanNote() + '</span>')}
      <div class="hs-cal-grid">${monthCellsHtml(count)}</div>
    </section>`;
  }

  function portfolioCalendarHtml() {
    const homes = filteredHomes();
    const count = date => housesOnDate(homes, date);
    return `<section class="hs-cal hs-cal-map" aria-label="Houses booked by day">
      <h4>Booked houses</h4>
      ${calChromeHtml(spanNote())}
      <div class="hs-cal-grid">${monthCellsHtml(count)}</div>
    </section>`;
  }

  function timelineHtml(h) {
    const services = homeServices(h);
    const groups = groupByDate(services);
    const dates = services.map(s => s.date).filter(Boolean).sort();
    const overlapDays = groups.filter(pair => pair[1].length > 1).length;
    const range = dates.length > 1 ? fmtDay(dates[0]) + ' – ' + fmtDay(dates[dates.length - 1]) : (dates[0] ? fmtDay(dates[0]) : 'TBD');
    const head = services.length + ' service' + (services.length === 1 ? '' : 's')
      + ' · ' + range
      + (overlapDays ? ' · ' + overlapDays + ' day' + (overlapDays === 1 ? '' : 's') + ' with crews on site together' : '');
    const rows = groups.map(([date, list]) => {
      const overlap = list.length > 1;
      const on = date !== 'tbd' && dateInSpan(date) ? ' on' : '';
      const lanes = list.map(s => {
        const kind = s.kind === 'inhouse' ? 'inhouse' : 'vendor';
        const kindLabel = kind === 'inhouse' ? 'In-house' : 'Vendor';
        const st = statusMeta(s.status || 'scheduled');
        return `<article class="hs-lane" data-kind="${kind}">
          <header><b>${esc(s.label)}</b><span class="pill ${st.pill}">${esc(st.label)}</span></header>
          <p>${esc(s.vendor || 'Unassigned')}</p>
          <small>${kindLabel}</small>
        </article>`;
      }).join('');
      const flag = overlap ? `<div class="hs-tl-flag">${list.length} contractors · same day</div>` : '';
      const when = date === 'tbd'
        ? '<b>TBD</b>'
        : `<b>${esc(weekdayShort(date))}</b><span>${esc(fmtDay(date))}</span>`;
      const dateBtn = date === 'tbd'
        ? `<div class="hs-tl-date">${when}</div>`
        : `<button type="button" class="hs-tl-date" data-hs-act="span-day" data-date="${esc(date)}">${when}</button>`;
      return `<div class="hs-tl-day${on}${overlap ? ' overlap' : ''}">${dateBtn}<div class="hs-tl-lanes">${lanes}${flag}</div></div>`;
    }).join('');
    return `<section class="hs-tl" id="hs-profile-tl">
      <h4>Services</h4>
      <p class="hs-tl-sum">${esc(head)}</p>
      ${rows || '<p class="hs-empty">No services on this house yet.</p>'}
    </section>`;
  }

  function spanBarHtml() {
    const n = ui.spanMode === 'all' ? filteredHomes().length : bookedHomes(filteredHomes()).length;
    const title = ui.spanMode === 'all' ? 'Map · all locations' : 'Map · ' + spanLabel();
    const detail = ui.spanMode === 'all'
      ? 'Every address stays on the map until a day, week, or month is selected.'
      : spanLabel() + ' · ' + n + ' house' + (n === 1 ? '' : 's') + ' highlighted.';
    const modes = [
      ['all', 'All'],
      ['day', 'Day'],
      ['week', 'Week'],
      ['month', 'Month'],
    ].map(([id, label]) => `<button type="button" class="seg-btn${ui.spanMode === id ? ' on' : ''}" data-hs-act="span-mode" data-mode="${id}">${label}</button>`).join('');
    return `<div class="hs-span">
      <div><b>${esc(title)}</b><span>${esc(detail)}</span></div>
      <div class="seg seg-sm" role="group" aria-label="Map range">${modes}</div>
    </div>`;
  }

  function paintSpanBars() {
    ['hs-span-board', 'hs-span-map'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = spanBarHtml();
    });
  }

  function shiftAnchor(dir) {
    const n = dir < 0 ? -1 : 1;
    let next = ui.anchor;
    if (ui.spanMode === 'day') next = shiftKey(ui.anchor, n);
    else if (ui.spanMode === 'week') next = shiftKey(ui.anchor, n * 7);
    else {
      const d = keyParts(monthStart(ui.anchor));
      d.setMonth(d.getMonth() + n);
      next = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
    }
    setSpan(ui.spanMode, next);
  }

  function paintProfileLive() {
    const h = homeById(ui.focusId);
    const body = document.getElementById('hs-d-body');
    if (!h || !body) return;
    const tl = body.querySelector('#hs-profile-tl');
    const cal = body.querySelector('#hs-profile-cal');
    if (!tl || !cal) return;
    tl.outerHTML = timelineHtml(h);
    cal.outerHTML = houseCalendarHtml(h);
  }

  function setSpan(mode, anchor) {
    const next = mode || 'all';
    ui.spanMode = (next === 'day' || next === 'week' || next === 'month') ? next : 'all';
    if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) ui.anchor = anchor;
    saveSpan();
    fitKey = '';
    paintSpanBars();
    paintProfileLive();
    const view = houseView();
    if (view === 'houses') paintBoard();
    if (view === 'houses-map') {
      const pool = filteredHomes({ area: !!ui.focusAreaId });
      const hits = ui.spanMode === 'all' ? pool : pool.filter(houseInSpan);
      if (map) fitTo((hits.length ? hits : pool));
      paintMapSide();
    }
  }

  function paintMapSide() {
    const side = document.getElementById('hs-map-side');
    if (!side) return;
    const focused = ui.focusAreaId && AREAS[ui.focusAreaId];
    const homes = filteredHomes({ area: !!focused });
    const cal = portfolioCalendarHtml();
    if (!homes.length) {
      side.innerHTML = cal + '<h3>No addresses</h3><p class="sub">Nothing matches this company or search.</p>';
      return;
    }
    if (ui.spanMode !== 'all') {
      const booked = homes.filter(houseInSpan);
      const clearArea = focused ? `<div class="hs-side-actions"><button type="button" class="btn ghost sm" data-hs-act="clear-focus">All areas</button></div>` : '';
      const noun = ui.spanMode === 'day' ? 'this day' : (ui.spanMode === 'week' ? 'this week' : 'this month');
      side.innerHTML = clearArea + `<h3>${esc(spanLabel())}</h3><p class="sub">${booked.length} house${booked.length === 1 ? '' : 's'} booked ${noun}. Other addresses stay on the map, dimmed.</p>`
        + (booked.length ? booked.map(h => {
          const who = servicesInSpan(h).map(s => s.label).join(' · ');
          return `<button type="button" class="hs-stop${h.id === ui.focusId ? ' on' : ''}" data-hs-act="open" data-id="${esc(h.id)}"><b>${esc(h.street)}</b><span>${esc(who || h.job || 'Booked')}</span></button>`;
        }).join('') : '<p class="hs-empty">No houses booked in this range.</p>')
        + cal;
      return;
    }
    if (focused) {
      const groups = groupsFrom(homes);
      const g = groups[0];
      const mix = companyMix(homes);
      const multiCo = new Set(homes.map(h => h.companyId)).size > 1;
      const leg = g ? legs(g.routed) : [];
      side.innerHTML = cal + `<div class="hs-side-actions"><button type="button" class="btn ghost sm" data-hs-act="clear-focus">All areas</button></div>
        <h3>${esc((ui.company !== 'all' ? companyName(ui.company) + ' · ' : '') + focused.name)}</h3>
        <p class="sub">${multiCo ? 'Proximity loop — every company in this neighborhood.' : 'Company loop — these stops stay in one area.'} ${esc(mix)}. About ${esc(g ? fmtMi(g.loopMiles) : '')} straight-line.</p>
        ${(g ? g.routed : []).map((h, i) => `<button type="button" class="hs-stop${h.id === ui.focusId ? ' on' : ''}" data-hs-act="open" data-id="${esc(h.id)}"><b>${i + 1}. ${esc(h.street)}</b><span>${esc(h.job)} · ${esc(h.crew || 'Unassigned')} · ${i === 0 ? 'Start' : esc(fmtMi(leg[i]))}</span></button>`).join('')}`;
      return;
    }
    const groups = groupsFrom(homes);
    side.innerHTML = cal + `<h3>Areas</h3><p class="sub">Zoomed out, each bubble is a neighborhood. Open one to see a pin per address and a stop order.</p>
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
    const spanOn = ui.spanMode !== 'all';
    const cluster = !spanOn && shouldCluster(homes);
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
    const open = homes.filter(h => h.status !== 'complete' && (!spanOn || houseInSpan(h)));
    const ordered = routeOrder(open.length ? open : homes.filter(h => !spanOn || houseInSpan(h)));
    const orderOf = new Map(ordered.map((h, i) => [h.id, i + 1]));
    if (ui.focusAreaId && !spanOn && ordered.length > 1) {
      L.polyline(ordered.map(h => [h.lat, h.lng]), {
        color: '#1F5BD8', weight: 3, opacity: 0.9,
      }).addTo(layer);
    }
    homes.forEach(h => {
      const hit = !spanOn || houseInSpan(h);
      const dim = spanOn && !hit;
      const n = (ui.focusAreaId && !spanOn) ? orderOf.get(h.id) : 0;
      const on = h.id === ui.focusId;
      const done = h.status === 'complete';
      const pinCls = `${on ? ' on' : ''}${done ? ' done' : ''}${spanOn && hit ? ' hit' : ''}${dim ? ' dim' : ''}`;
      const icon = n
        ? L.divIcon({
          className: 'hs-divicon',
          html: `<div class="hs-numpin${on ? ' on' : ''}"><span>${n}</span></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })
        : L.divIcon({
          className: 'hs-divicon',
          html: `<div class="hs-pin${pinCls}"></div>`,
          iconSize: [(on || (spanOn && hit)) ? 18 : 14, (on || (spanOn && hit)) ? 18 : 14],
          iconAnchor: [(on || (spanOn && hit)) ? 9 : 7, (on || (spanOn && hit)) ? 9 : 7],
        });
      const marker = L.marker([h.lat, h.lng], { icon, keyboard: true, title: h.street, zIndexOffset: (spanOn && hit) ? 500 : (on ? 400 : (dim ? -20 : 0)) });
      const tipNames = (spanOn && hit) ? servicesInSpan(h).map(s => s.label).join(' · ') : '';
      marker.bindTooltip(tipNames ? (h.street + ' · ' + tipNames) : h.street, { direction: 'top', offset: [0, -6], className: 'hs-pin-tip' });
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
    const nextKey = [ui.company, ui.focusAreaId || '', ui.scope, areaKey, ui.spanMode, ui.anchor].join('|');
    const sized = map.getSize && map.getSize().y > 40;
    const spanHits = ui.spanMode === 'all' ? homes : homes.filter(houseInSpan);
    const fitHomes = spanHits.length ? spanHits : homes;
    if (nextKey !== fitKey || !sized) {
      fitKey = nextKey;
      fitTo(fitHomes.length ? fitHomes : filteredHomes());
    } else {
      drawMap();
    }
    paintMapSide();
    setTimeout(() => {
      if (!map) return;
      const before = map.getSize().y;
      try { map.invalidateSize(); } catch { return; }
      if (before < 40 && map.getSize().y > 40) {
        const again = filteredHomes({ area: !!ui.focusAreaId });
        const hits = ui.spanMode === 'all' ? again : again.filter(houseInSpan);
        fitTo(hits.length ? hits : again);
      }
    }, 80);
  }

  function render(name) {
    syncFromHash();
    ui.view = name || houseView();
    refreshNavCount();
    paintSpanBars();
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

  /* maps.google.com/@ 404s — Google treats "/@" as a path. Use the Maps URL scheme. */
  function streetViewHref(h) {
    const lat = Number(h.lat);
    const lng = Number(h.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='
        + lat.toFixed(6) + ',' + lng.toFixed(6) + '&fov=90';
    }
    const q = [h.street, h.city, 'FL', h.zip].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
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
    const eng = engineerFor(h);
    const others = allHomes().filter(x => engineerFor(x) === eng && x.id !== h.id);
    const svcs = homeServices(h);
    const dates = svcs.map(s => s.date).filter(Boolean).sort();
    const spanTxt = dates.length
      ? (fmtDay(dates[0]) + (dates[0] !== dates[dates.length - 1] ? ' – ' + fmtDay(dates[dates.length - 1]) : ''))
      : whenLabel(h);
    document.getElementById('hs-d-title').textContent = h.street;
    document.getElementById('hs-d-sub').textContent = h.city + ', FL ' + (h.zip || '') + ' · House profile';
    document.getElementById('hs-d-body').innerHTML = `
      <div class="hs-prof-head">
        ${curbHtml(h)}
        <div class="hs-prof-facts">
          <div class="hs-prof-top">
            <span class="pill ${meta.pill}">${esc(meta.label)}</span>
            <span class="hs-eng">Engineer ${esc(eng || '—')}</span>
          </div>
          <p class="hs-prof-lead">${esc(eng || 'The engineer')} oversees this home and ${others.length} other${others.length === 1 ? '' : 's'} for ${esc(companyName(h.companyId))}. Each home is its own address.</p>
          <p class="hs-flip">${esc(spanTxt)} · ${svcs.length} service${svcs.length === 1 ? '' : 's'}</p>
          <dl class="hs-kv">
            <dt>Address</dt><dd>${esc(h.street)}, ${esc(h.city)}, FL ${esc(h.zip || '')}</dd>
            <dt>Area</dt><dd>${esc(area ? area.name : '')}</dd>
            <dt>Company</dt><dd>${esc(companyName(h.companyId))}</dd>
            ${h.notes ? `<dt>Notes</dt><dd>${esc(h.notes)}</dd>` : ''}
          </dl>
        </div>
      </div>
      ${timelineHtml(h)}
      ${houseCalendarHtml(h)}
      <div class="hs-side-actions">
        <button type="button" class="btn pri sm" data-hs-act="show-map" data-id="${esc(h.id)}">Show on map</button>
        ${h.userAdded ? `<button type="button" class="btn ghost sm" data-hs-act="remove" data-id="${esc(h.id)}">Remove</button>` : ''}
      </div>`;
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
      closeHouseDrawer();
      let next;
      if (ui.spanMode === 'all') {
        ui.company = h.companyId;
        next = 'houses-map/' + h.companyId + '/' + h.areaId;
      } else {
        ui.focusAreaId = null;
        next = ui.company !== 'all' ? ('houses-map/' + ui.company) : 'houses-map';
      }
      if ((location.hash || '') === '#' + next) render('houses-map');
      else location.hash = next;
    }
    else if (act === 'span-day') {
      e.preventDefault();
      const date = el.dataset.date;
      if (date && date !== 'tbd') setSpan('day', date);
    }
    else if (act === 'cal-day') {
      e.preventDefault();
      const date = el.dataset.date;
      if (!date) return;
      if (ui.spanMode === 'week') setSpan('week', date);
      else if (ui.spanMode === 'month') setSpan('month', date);
      else setSpan('day', date);
    }
    else if (act === 'span-mode') {
      e.preventDefault();
      setSpan(el.dataset.mode || 'all', ui.anchor);
    }
    else if (act === 'span-nav') {
      e.preventDefault();
      shiftAnchor(Number(el.dataset.dir) || 1);
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
      if (free) free.textContent = 'Free for TendCo™ clients — one engineer, several houses. Each address has its own services and calendar.';
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
      else if (typeof route === 'function') route();
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

  // #houses is already in the URL before /board returns. Paint it now — route()
  // after refresh stays in charge of make-ready and every other hash.
  loadSpan();
  const bootHash = (location.hash || '').replace(/^#/, '').split('/')[0];
  if (bootHash.startsWith('houses') && typeof route === 'function') route();
})();
