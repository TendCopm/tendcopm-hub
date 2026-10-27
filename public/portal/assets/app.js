const API = '/portal/api';
/** Main board columns — return_requested / cancelled stay secondary (history / drawer). */
const STATUSES = ['received','scheduled','in_progress','punch','complete'];
const ALL_STATUSES = ['received','scheduled','in_progress','punch','complete','return_requested','cancelled'];
const STATUS_META = {
  received: { label:'Received', color:'#8A95A8', pill:'n' },
  scheduled: { label:'Scheduled', color:'var(--blue)', pill:'b' },
  in_progress: { label:'In progress', color:'var(--amber)', pill:'a' },
  punch: { label:'Punch', color:'#4338CA', pill:'p' },
  complete: { label:'Tended', color:'var(--green)', pill:'g' },
  return_requested: { label:'Return requested', color:'var(--red)', pill:'r' },
  cancelled: { label:'Cancelled', color:'#8A95A8', pill:'n' },
};


/** Fernando-locked trades that go to units (preview vocab). */
const UNIT_TRADES = [
  { id:'pest_control', label:'Pest control', short:'Pest' },
  { id:'trash_out', label:'Trash out', short:'Trash out' },
  { id:'change_lock', label:'Change of lock', short:'Lock' },
  { id:'painting', label:'Painting', short:'Paint' },
  { id:'color_change', label:'Color change', short:'Color change' },
  { id:'maintenance', label:'Maintenance', short:'Maint' },
  { id:'cleaning', label:'Cleaning', short:'Clean' },
  { id:'carpet_cleaning', label:'Carpet cleaning', short:'Carpet clean' },
  { id:'carpet_replacement', label:'Carpet replacement', short:'Carpet replace' },
  { id:'bathtub_resurfacing', label:'Bathtub resurfacing', short:'Tub resurface' },
  { id:'countertops_resurfacing', label:'Counter tops resurfacing', short:'Counters' },
  { id:'drywall_repairs', label:'Drywall repairs', short:'Drywall' },
  { id:'plumbing', label:'Plumbing', short:'Plumbing' },
  { id:'electrical', label:'Electrical', short:'Electrical' },
  { id:'hvac', label:'HVAC', short:'HVAC' },
  // Calendar busy locks only — enter units, scheduled ahead. NOT dispatch / no invites.
  { id:'fire_alarm', label:'Fire alarm', short:'Fire alarm', noInvite:true, calendarLock:true },
  { id:'fire_inspection', label:'Fire inspection', short:'Fire inspect', noInvite:true, calendarLock:true },
];
/** Trades eligible for vendor share invites (excludes fire calendar locks). */
const SHAREABLE_TRADES = UNIT_TRADES.filter(t => !t.noInvite);
const UNIT_TRADE_BY_ID = Object.fromEntries(UNIT_TRADES.map(t => [t.id, t]));

/** Default make-ready service pipeline (Fernando lock). Cleaning last. */
const DEFAULT_MR_SERVICES = [
  { id: 'inspection', trade: 'maintenance', label: 'Move-out inspection', hint: 'Maintenance schedules the walk' },
  { id: 'painting', trade: 'painting', label: 'Painting', hint: 'Full or touch-up' },
  { id: 'punch', trade: 'maintenance', label: 'Punch', hint: 'Maintenance punch list' },
  { id: 'carpet', trade: 'carpet_cleaning', label: 'Carpet', hint: 'Clean or replace' },
  { id: 'cleaning', trade: 'cleaning', label: 'Cleaning', hint: 'Final clean — always last by default' },
];

const DEMO_VENDORS = [
  { id: '', label: 'Unassigned' },
  { id: 'TendCo', label: 'TendCo (onsite)' },
  { id: 'TendCo Painting', label: 'TendCo Painting' },
  { id: 'TendCo Cleaning', label: 'TendCo Cleaning' },
  { id: 'TendCo Punch', label: 'TendCo Punch' },
  { id: 'Joe', label: 'Joe' },
  { id: 'Fred', label: 'Fred' },
  { id: 'Dennis', label: 'Dennis' },
  { id: 'Ana', label: 'Ana' },
  { id: 'Maya', label: 'Maya' },
  { id: 'Sunshine Carpet Cleaning', label: 'Sunshine Carpet Cleaning' },
  { id: 'Floor Pro Carpet', label: 'Floor Pro Carpet' },
  { id: 'BugFree Pest', label: 'BugFree Pest' },
  { id: 'BathRenew', label: 'BathRenew' },
  { id: 'SurfacePro', label: 'SurfacePro' },
  { id: 'Coastal Electric', label: 'Coastal Electric' },
];

function cloneDefaultServices(){
  return DEFAULT_MR_SERVICES.map(s => ({
    id: s.id,
    trade: s.trade,
    label: s.label,
    hint: s.hint || '',
    vendor: '',
    confirm: '',
    confirm_via: '',
    scheduled_date: '',
    slot_n: 0,
  }));
}

function isCarpetTrade(trade){
  const t = normalizeTradeId(trade);
  return t === 'carpet_cleaning' || t === 'carpet_replacement' || t === 'carpet';
}
function isPaintTrade(trade){
  return normalizeTradeId(trade) === 'painting';
}
/** Carpet before painting → supervisor must protect carpet. */
function carpetBeforePaintNote(services){
  const list = services || [];
  const carpetIdx = list.findIndex(s => isCarpetTrade(s.trade) || /carpet/i.test(s.label || ''));
  const paintIdx = list.findIndex(s => isPaintTrade(s.trade) || /paint/i.test(s.label || ''));
  if (carpetIdx >= 0 && paintIdx >= 0 && carpetIdx < paintIdx) {
    return 'carpet needs to be protected';
  }
  return '';
}

/* ─── create16 · Common areas (recurring) + Viewing-only (reminders) ───
 * Distinct from Create Make Ready unit pipeline / mrwApplyDateSpread.
 * Calendar lanes: (1) make-ready (2) common-area (3) viewing-only.
 */
const CA_TYPES = [
  { id: 'model', label: 'Model unit cleaning', short: 'Model', defaultDays: [2], defaultCadence: 'weekly', defaultStaffing: 'in_house', defaultVendor: 'TendCo Cleaning' },
  { id: 'office', label: 'Office/amenities cleaning', short: 'Office/amenities', defaultDays: [1, 4], defaultCadence: '2x', defaultStart: '07:00', defaultEnd: '09:00', defaultStaffing: 'in_house', defaultVendor: 'TendCo Cleaning' },
  { id: 'pool', label: 'Pool cleaning', short: 'Pool', defaultDays: [3], defaultCadence: 'weekly', defaultStaffing: 'outsourced', defaultVendor: 'TendCo Cleaning' },
];
const CA_TYPE_BY_ID = Object.fromEntries(CA_TYPES.map(x => [x.id, x]));
const CA_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CA_CADENCES = [
  { id: 'weekly', label: 'Weekly', daysNeeded: 1 },
  { id: 'peak', label: 'Peak day', daysNeeded: 1 },
  { id: '2x', label: 'Twice per week', daysNeeded: 2 },
  { id: '3x', label: 'Three weekly (3×/week)', daysNeeded: 3 },
  { id: '5x', label: 'Five days a week', daysNeeded: 5 },
];
const CA_CADENCE_BY_ID = Object.fromEntries(CA_CADENCES.map(x => [x.id, x]));
const CA_SS_KEY = 'hub_common_areas_v1';
const VW_SS_KEY = 'hub_viewing_items_v1';

function caDemoSeed(){
  return [
    { id: 'ca-demo-model', type: 'model', label: 'Model unit cleaning', cadence: 'weekly', days: [2],
      time_start: '', time_end: '', staffing: 'in_house', vendor: 'In-house', notes: 'Weekly Tuesday · in-house', demo: true },
    { id: 'ca-demo-office', type: 'office', label: 'Office/amenities cleaning', cadence: '2x', days: [1, 4],
      time_start: '07:00', time_end: '09:00', staffing: 'in_house', vendor: 'In-house', notes: 'Mon+Thu before staff · in-house', demo: true },
    { id: 'ca-demo-pool', type: 'pool', label: 'Pool cleaning', cadence: 'weekly', days: [3],
      time_start: '', time_end: '', staffing: 'outsourced', vendor: 'TendCo Cleaning', notes: 'Weekly Wednesday · outsourced', demo: true },
  ];
}
function vwDemoSeed(){
  return [
    // create18 — Fire inspection: month Nov, start day 10, length 5 → Nov 10–14 + week lock
    { id: 'vw-demo-fire', title: 'Fire inspection', kind: 'fire_inspection', cadence: 'annual', days: [],
      month: 11, monthday: 10, once: '', length_days: 5, week_block_days: 5,
      notes: 'Viewing only · start Nov 10 · length 5 days · calendar blocked', demo: true },
    { id: 'vw-demo-land', title: 'Landscaper visit', kind: 'landscaper', cadence: 'weekly', days: [5],
      monthday: null, once: '', notes: 'Viewing only — no vendor attached', demo: true },
    { id: 'vw-demo-elev', title: 'Elevator maintenance', kind: 'elevator', cadence: 'monthly', days: [],
      monthday: 3, once: '', notes: 'Reminder only', demo: true },
    { id: 'vw-demo-pool', title: 'Pool check (no company)', kind: 'pool_view', cadence: 'weekly', days: [6],
      monthday: null, once: '', notes: 'Courtesy tracking — no pool company', demo: true },
  ];
}

/** Suggested Viewing templates users can one-tap add (create17b). */
const VW_SUGGESTIONS = [
  { kind: 'fire_inspection', title: 'Fire inspection', cadence: 'annual', month: 11, monthday: 10, length_days: 5, week_block_days: 5,
    notes: 'Viewing only · pick month, start day, and length' },
  { kind: 'landscaper', title: 'Landscaper visit', cadence: 'weekly', days: [5], notes: 'Viewing only' },
  { kind: 'elevator', title: 'Elevator maintenance', cadence: 'monthly', monthday: 1, notes: 'Viewing only' },
];

function fireWeekActive(aroundKey){
  ensureCalState();
  const key = aroundKey || todayKeyNY();
  const items = state.cal?.items || [];
  // Active if any lock chip on/near this date, or viewing fire with week block covering key
  if (items.some(it => (it.calendarLock || it.kind === 'lock') && it.trade === 'fire_inspection' && it.dateKey === key)) return true;
  const locks = items.filter(it => (it.calendarLock || it.kind === 'lock') && (it.trade === 'fire_inspection' || /fire/i.test(it.title || '')));
  if (locks.some(it => it.dateKey === key)) return true;
  // Also treat demo fire week span
  for (const it of locks) {
    const span = it.lockSpan;
    if (!span || !span.start) continue;
    const end = addDaysKey(span.start, (span.days || 1) - 1);
    if (key >= span.start && key <= end) return true;
  }
  ensurePropertySchedule();
  for (const v of state.viewingItems || []) {
    if (v.kind !== 'fire_inspection' || !v.week_block_days) continue;
    const starts = fireOccurrenceStarts(v, '2026-10-01', '2027-01-31');
    for (const start of starts) {
      const end = addDaysKey(start, Number(v.week_block_days) - 1);
      if (key >= start && key <= end) return true;
    }
  }
  return false;
}

function fireOccurrenceStarts(it, fromKey, toKey){
  const out = [];
  if (!it) return out;
  if (it.cadence === 'once' && it.once) {
    if (it.once >= fromKey && it.once <= toKey) out.push(it.once);
    return out;
  }
  let k = fromKey;
  let guard = 0;
  while (k <= toKey && guard < 400) {
    if (caMatchesDate(it, k)) out.push(k);
    // For annual/semiannual only push the start day (caMatchesDate hits once per occurrence)
    k = addDaysKey(k, 1);
    guard++;
  }
  return out;
}
function caNormalizeJob(job){
  if (!job || typeof job !== 'object') return job;
  const meta = CA_TYPE_BY_ID[job.type] || {};
  const out = { ...job };
  if (out.type === 'office' && (!out.label || /\bOffice cleaning\b/i.test(out.label) && !/amenities/i.test(out.label))) {
    out.label = 'Office/amenities cleaning';
  }
  if (!out.label) out.label = meta.label || out.label;
  const cad = String(out.cadence || 'weekly');
  if (cad === 'weekly' || cad === 'peak' || cad === '2x' || cad === '3x' || cad === '5x') out.cadence = cad;
  else if (cad === 'biweekly') out.cadence = '2x';
  else out.cadence = 'weekly';
  if (out.staffing !== 'in_house' && out.staffing !== 'outsourced') {
    out.staffing = meta.defaultStaffing || 'outsourced';
  }
  if (out.staffing === 'in_house' && (!out.vendor || out.vendor === 'TendCo Cleaning' && out.demo)) {
    // keep explicit In-house label for chips when demo in-house
    if (!out.vendor || out.demo) out.vendor = out.vendor === 'TendCo Cleaning' && out.staffing === 'in_house' ? 'In-house' : (out.vendor || 'In-house');
  }
  if (out.staffing === 'in_house' && !out.vendor) out.vendor = 'In-house';
  return out;
}
function loadCommonAreas(){
  try {
    const raw = sessionStorage.getItem(CA_SS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        const norm = parsed.map(caNormalizeJob);
        // create18 migrate: rename office + ensure staffing on all three types
        let changed = false;
        for (let i = 0; i < norm.length; i++) {
          const before = JSON.stringify(parsed[i]);
          if (JSON.stringify(norm[i]) !== before) changed = true;
        }
        if (changed) {
          try { sessionStorage.setItem(CA_SS_KEY, JSON.stringify(norm)); } catch {}
        }
        return norm;
      }
    }
  } catch {}
  return caDemoSeed();
}
function saveCommonAreas(list){
  state.commonAreas = (list || []).map(caNormalizeJob);
  try { sessionStorage.setItem(CA_SS_KEY, JSON.stringify(state.commonAreas)); } catch {}
}
function loadViewingItems(){
  try {
    const raw = sessionStorage.getItem(VW_SS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        let changed = false;
        const out = parsed.map(it => {
          if (it && it.id === 'vw-demo-fire' && it.kind === 'fire_inspection') {
            const next = { ...it };
            if (!Number(next.length_days)) { next.length_days = Number(next.week_block_days) || 5; changed = true; }
            if (!Number(next.week_block_days)) { next.week_block_days = Number(next.length_days) || 5; changed = true; }
            if (!next.monthday || Number(next.monthday) === 3 || Number(next.monthday) === 11) {
              next.monthday = 10; changed = true;
            }
            if (Number(next.month) !== 11) { next.month = 11; changed = true; }
            if (changed) next.notes = 'Viewing only · start Nov 10 · length 5 days · calendar blocked';
            return next;
          }
          return it;
        });
        if (changed) {
          try { sessionStorage.setItem(VW_SS_KEY, JSON.stringify(out)); } catch {}
        }
        return out;
      }
    }
  } catch {}
  return vwDemoSeed();
}
function saveViewingItems(list){
  state.viewingItems = list || [];
  try { sessionStorage.setItem(VW_SS_KEY, JSON.stringify(state.viewingItems)); } catch {}
}
function ensurePropertySchedule(){
  if (!Array.isArray(state.commonAreas)) state.commonAreas = loadCommonAreas();
  if (!Array.isArray(state.viewingItems)) state.viewingItems = loadViewingItems();
}
function caFmtTime(t){
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  let h = Number(m[1]); const min = m[2];
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (!h) h = 12;
  return h + (min === '00' ? '' : ':' + min) + ' ' + ap;
}
function caWindowLabel(job){
  if (!job) return '';
  if (job.time_start && job.time_end) return caFmtTime(job.time_start) + '–' + caFmtTime(job.time_end);
  if (job.time_start) return caFmtTime(job.time_start);
  return '';
}
function caDaysLabel(days){
  const arr = (days || []).slice().sort((a,b)=>a-b);
  return arr.map(d => CA_DOW[d] || '?').join('+') || '—';
}
function caStaffingLabel(job){
  if (!job) return '';
  return job.staffing === 'in_house' ? 'in-house' : (job.staffing === 'outsourced' ? 'outsourced' : '');
}
function caCadenceLabel(job){
  if (!job) return '';
  if (job.cadence === 'peak') return 'Peak day · ' + caDaysLabel(job.days);
  if (job.cadence === '2x') return 'Twice/week · ' + caDaysLabel(job.days);
  if (job.cadence === '3x') return '3×/week · ' + caDaysLabel(job.days);
  if (job.cadence === '5x') return '5 days/week · ' + caDaysLabel(job.days);
  if (job.cadence === 'weekly') return 'Weekly · ' + caDaysLabel(job.days);
  if (job.cadence === 'monthly') return 'Monthly · day ' + (job.monthday || 1);
  if (job.cadence === 'annual') {
    const mo = Number(job.month) || 1;
    const md = Number(job.monthday) || 1;
    const len = Number(job.length_days) || Number(job.week_block_days) || 0;
    const lock = job.week_block_days ? (' · locked') : '';
    return 'Annual · ' + mo + '/' + md + (len ? (' · ' + len + '-day window') : '') + lock;
  }
  if (job.cadence === 'semiannual') {
    const len = Number(job.length_days) || Number(job.week_block_days) || 0;
    return 'Semi-annual · ' + (job.month || 5) + '/' + (job.monthday || 1) + ' & +6mo' + (len ? (' · ' + len + '-day window') : '') + (job.week_block_days ? ' · locked' : '');
  }
  if (job.cadence === 'once') {
    const len = Number(job.length_days) || Number(job.week_block_days) || 0;
    return 'Once · ' + (job.once || '—') + (len ? (' · ' + len + '-day window') : '') + (job.week_block_days ? ' · locked' : '');
  }
  return 'Weekly · ' + caDaysLabel(job.days);
}
function caMatchesDate(job, dateKey){
  if (!job || !dateKey) return false;
  const d = parseKey(dateKey);
  const dow = d.getDay();
  if (job.cadence === 'once') return job.once === dateKey;
  if (job.cadence === 'monthly') {
    const md = Number(job.monthday) || 1;
    return d.getDate() === md;
  }
  if (job.cadence === 'annual') {
    const mo = Number(job.month) || 1;
    const md = Number(job.monthday) || 1;
    return (d.getMonth() + 1) === mo && d.getDate() === md;
  }
  if (job.cadence === 'semiannual') {
    const mo = Number(job.month) || 5;
    const md = Number(job.monthday) || 1;
    const m2 = ((mo - 1 + 6) % 12) + 1;
    const m = d.getMonth() + 1;
    return d.getDate() === md && (m === mo || m === m2);
  }
  const days = job.days || [];
  return days.map(Number).includes(dow);
}
function expandLaneItems(fromKey, toKey){
  ensurePropertySchedule();
  const out = [];
  if (!fromKey || !toKey) return out;
  let k = fromKey;
  let guard = 0;
  while (k <= toKey && guard < 120) {
    for (const job of state.commonAreas || []) {
      if (!caMatchesDate(job, k)) continue;
      const meta = CA_TYPE_BY_ID[job.type] || {};
      const win = caWindowLabel(job);
      const short = meta.short || job.label || 'Common';
      const staffBit = caStaffingLabel(job);
      const chipTitle = staffBit
        ? ((meta.short || job.label || short) + ' · ' + staffBit)
        : (job.label || meta.label || short);
      out.push({
        id: 'ca-' + job.id + '-' + k,
        kind: 'common',
        lane: 'common',
        dateKey: k,
        title: chipTitle,
        subtitle: [staffBit ? staffBit[0].toUpperCase() + staffBit.slice(1) : '', job.vendor, win, 'Common area', caCadenceLabel(job)].filter(Boolean).join(' · '),
        unit_label: '',
        tone: 'common',
        status: 'scheduled',
        trade: 'common_' + (job.type || 'area'),
        assignee: job.staffing === 'in_house' ? (job.vendor || 'In-house') : (job.vendor || ''),
        vendor_name: job.vendor || '',
        owner_name: job.vendor || '',
        common_id: job.id,
        common_type: job.type,
        staffing: job.staffing || '',
        time_window: win,
        demo: !!job.demo,
      });
    }
    for (const it of state.viewingItems || []) {
      const isFire = it.kind === 'fire_inspection';
      const lengthN = isFire ? Math.max(1, Number(it.length_days) || Number(it.week_block_days) || 1) : 0;
      const blockN = isFire ? Math.max(0, Number(it.week_block_days) || 0) : 0;
      // Multi-day fire window from start day; locks when week-block is on (blockN > 0)
      if (isFire && lengthN > 0) {
        const spanN = Math.max(lengthN, blockN || 0);
        const starts = [];
        if (caMatchesDate(it, k)) starts.push(k);
        for (let back = 1; back < spanN; back++) {
          const startCand = addDaysKey(k, -back);
          if (startCand >= fromKey && caMatchesDate(it, startCand)) { starts.push(startCand); break; }
        }
        for (const start of starts) {
          const offset = (parseKey(k) - parseKey(start)) / 86400000;
          const dayOffset = Math.round(offset);
          if (dayOffset < 0 || dayOffset >= spanN) continue;
          if (blockN > 0 && dayOffset < blockN) {
            out.push({
              id: 'vw-lock-' + it.id + '-' + k,
              kind: 'lock',
              lane: 'viewing',
              dateKey: k,
              title: 'Fire inspection',
              subtitle: 'Calendar locked · Viewing window · team busy',
              unit_label: '',
              tone: 'lock',
              status: 'locked',
              trade: 'fire_inspection',
              assignee: '',
              vendor_name: null,
              owner_name: null,
              viewing_id: it.id,
              viewing_kind: 'fire_inspection',
              demo: !!it.demo,
              calendarLock: true,
              viewing: true,
              lockSpan: { start, days: blockN, label: 'Fire inspection window' },
            });
          }
          // Viewing chip every day of the length window (visible multi-day span)
          out.push({
            id: 'vw-' + it.id + '-' + k,
            kind: 'viewing',
            lane: 'viewing',
            dateKey: k,
            title: it.title || 'Fire inspection',
            subtitle: ['Viewing only', 'Day ' + (dayOffset + 1) + '/' + spanN, caCadenceLabel(it), it.notes].filter(Boolean).join(' · '),
            unit_label: '',
            tone: 'viewing',
            status: 'viewing',
            trade: 'fire_inspection',
            assignee: '',
            vendor_name: '',
            owner_name: '',
            viewing_id: it.id,
            viewing_kind: it.kind,
            demo: !!it.demo,
            viewing: true,
            week_block: blockN > 0,
            length_days: spanN,
          });
        }
        continue;
      }
      if (!caMatchesDate(it, k)) continue;
      out.push({
        id: 'vw-' + it.id + '-' + k,
        kind: 'viewing',
        lane: 'viewing',
        dateKey: k,
        title: it.title || 'Reminder',
        subtitle: ['Viewing only', caCadenceLabel(it), it.notes].filter(Boolean).join(' · '),
        unit_label: '',
        tone: 'viewing',
        status: 'viewing',
        trade: isFire ? 'fire_inspection' : null,
        assignee: '',
        vendor_name: '',
        owner_name: '',
        viewing_id: it.id,
        viewing_kind: it.kind,
        demo: !!it.demo,
        viewing: true,
      });
    }
    k = addDaysKey(k, 1);
    guard++;
  }
  return out;
}

function renderCommonAreasView(){
  ensurePropertySchedule();
  const tab = state.caTab || 'common';
  document.querySelectorAll('[data-ca-tab]').forEach(b => b.classList.toggle('on', b.dataset.caTab === tab));
  const commonPanel = document.getElementById('ca-common-panel');
  const viewingPanel = document.getElementById('ca-viewing-panel');
  if (commonPanel) commonPanel.classList.toggle('hidden', tab !== 'common');
  if (viewingPanel) viewingPanel.classList.toggle('hidden', tab !== 'viewing');
  const btn = document.getElementById('btn-ca-create');
  if (btn) btn.textContent = tab === 'viewing' ? '+ Add viewing' : '+ Add job';

  const list = document.getElementById('ca-list');
  const empty = document.getElementById('ca-empty');
  if (list) {
    const jobs = state.commonAreas || [];
    if (empty) empty.hidden = jobs.length > 0;
    list.innerHTML = jobs.map(job => {
      const meta = CA_TYPE_BY_ID[job.type] || {};
      const win = caWindowLabel(job);
      const staff = caStaffingLabel(job);
      const staffTag = staff ? `<span class="ca-staff-tag ${job.staffing === 'in_house' ? 'in' : 'out'}">${esc(staff)}</span>` : '';
      return `<button type="button" class="ca-row" data-ca-id="${esc(job.id)}">
        <div class="ca-row-main">
          <div class="ca-row-title"><span class="ca-lane-tag">Common</span> ${esc(job.label || meta.label)} ${staffTag}</div>
          <div class="ca-row-sub">${esc(caCadenceLabel(job))}${win ? ' · ' + esc(win) : ''}${job.vendor ? ' · ' + esc(job.vendor) : ''}${staff ? ' · ' + esc(staff) : ''}</div>
          ${job.notes ? `<div class="ca-row-notes">${esc(job.notes)}</div>` : ''}
        </div>
        <span class="ca-row-chev" aria-hidden="true">›</span>
      </button>`;
    }).join('');
    list.querySelectorAll('[data-ca-id]').forEach(el => {
      el.addEventListener('click', () => openCaModal(el.dataset.caId));
    });
  }

  const vlist = document.getElementById('vw-list');
  const vempty = document.getElementById('vw-empty');
  const sugHost = document.getElementById('vw-suggestions');
  if (sugHost) {
    const have = new Set((state.viewingItems || []).map(x => x.kind));
    sugHost.innerHTML = VW_SUGGESTIONS.filter(s => !have.has(s.kind)).map(s =>
      `<button type="button" class="vw-suggest" data-vw-suggest="${esc(s.kind)}">+ ${esc(s.title)}</button>`
    ).join('') || '<span class="hint" style="font-size:12px;color:var(--faint);font-weight:600">Suggestions added</span>';
    sugHost.querySelectorAll('[data-vw-suggest]').forEach(btn => {
      btn.addEventListener('click', () => addViewingSuggestion(btn.dataset.vwSuggest));
    });
  }
  if (vlist) {
    const items = state.viewingItems || [];
    if (vempty) vempty.hidden = items.length > 0;
    vlist.innerHTML = items.map(it => {
      return `<button type="button" class="ca-row ca-row-vw" data-vw-id="${esc(it.id)}">
        <div class="ca-row-main">
          <div class="ca-row-title"><span class="vw-badge">Viewing</span> ${esc(it.title)}</div>
          <div class="ca-row-sub">${esc(caCadenceLabel(it))}${it.notes ? ' · ' + esc(it.notes) : ''}</div>
        </div>
        <span class="ca-row-chev" aria-hidden="true">›</span>
      </button>`;
    }).join('');
    vlist.querySelectorAll('[data-vw-id]').forEach(el => {
      el.addEventListener('click', () => openVwModal(el.dataset.vwId));
    });
  }
}

function setCaTab(tab){
  state.caTab = tab === 'viewing' ? 'viewing' : 'common';
  renderCommonAreasView();
}

function caVendorOptions(selected){
  const preferred = ['TendCo Cleaning', 'TendCo', 'TendCo Painting', 'TendCo Punch'];
  const opts = DEMO_VENDORS.slice();
  // Ensure TendCo Cleaning exists
  if (!opts.some(v => v.id === 'TendCo Cleaning')) {
    opts.splice(3, 0, { id: 'TendCo Cleaning', label: 'TendCo Cleaning' });
  }
  const order = [...preferred, ...opts.map(v => v.id).filter(id => id && !preferred.includes(id))];
  const seen = new Set();
  const html = ['<option value="">Unassigned</option>'];
  for (const id of order) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = opts.find(v => v.id === id)?.label || id;
    html.push(`<option value="${esc(id)}" ${selected===id?'selected':''}>${esc(label)}</option>`);
  }
  return html.join('');
}

function caGetStaffing(){
  const el = document.querySelector('input[name="ca-staffing"]:checked');
  return el && el.value === 'in_house' ? 'in_house' : 'outsourced';
}
function caSetStaffing(v){
  const inEl = document.getElementById('ca-staff-inhouse');
  const outEl = document.getElementById('ca-staff-outsourced');
  const val = v === 'in_house' ? 'in_house' : 'outsourced';
  if (inEl) inEl.checked = val === 'in_house';
  if (outEl) outEl.checked = val === 'outsourced';
  caSyncVendorVisibility();
}
function caSyncVendorVisibility(){
  const wrap = document.getElementById('ca-vendor-wrap');
  const staff = caGetStaffing();
  if (wrap) wrap.style.opacity = staff === 'in_house' ? '0.55' : '1';
  const hint = document.getElementById('ca-vendor-hint');
  if (hint) {
    hint.textContent = staff === 'in_house'
      ? 'In-house — onsite staff / TendCo onsite. Vendor optional.'
      : 'Outsourced — pick the vendor for this recurring job.';
  }
}
function caDaysForCadence(cadence, picked, meta){
  const need = (CA_CADENCE_BY_ID[cadence] || {}).daysNeeded || 1;
  let days = (picked || []).map(Number).filter(d => d >= 1 && d <= 6);
  if (cadence === '5x') {
    return [1, 2, 3, 4, 5];
  }
  if (!days.length) days = (meta?.defaultDays || [2]).slice();
  if (need === 1) return [days[0]];
  // pad from defaults / Mon–Fri if short
  const pool = [1, 2, 3, 4, 5, 6];
  for (const d of (meta?.defaultDays || []).concat(pool)) {
    if (days.length >= need) break;
    if (!days.includes(d)) days.push(d);
  }
  return days.slice(0, need).sort((a, b) => a - b);
}
function openCaModal(editId){
  ensurePropertySchedule();
  const bg = document.getElementById('ca-modal-bg');
  const modal = document.getElementById('ca-modal');
  if (!modal) return;
  const job = editId ? (state.commonAreas || []).find(j => j.id === editId) : null;
  document.getElementById('ca-edit-id').value = job ? job.id : '';
  document.getElementById('ca-modal-title').textContent = job ? 'Edit common-area job' : 'Add common-area job';
  const typeEl = document.getElementById('ca-type');
  const cadEl = document.getElementById('ca-cadence');
  typeEl.value = job?.type || 'model';
  const cad = job?.cadence && CA_CADENCE_BY_ID[job.cadence] ? job.cadence : 'weekly';
  cadEl.value = cad;
  document.getElementById('ca-time-start').value = job?.time_start || '';
  document.getElementById('ca-time-end').value = job?.time_end || '';
  document.getElementById('ca-notes').value = job?.notes || '';
  const staff = job?.staffing || (CA_TYPE_BY_ID[typeEl.value]?.defaultStaffing) || 'outsourced';
  caSetStaffing(staff);
  const vend = job?.staffing === 'in_house'
    ? (job?.vendor && job.vendor !== 'In-house' ? job.vendor : 'TendCo Cleaning')
    : (job?.vendor || 'TendCo Cleaning');
  document.getElementById('ca-vendor').innerHTML = caVendorOptions(vend);
  const days = job?.days || (CA_TYPE_BY_ID[typeEl.value]?.defaultDays || [2]);
  document.querySelectorAll('#ca-days input[type=checkbox]').forEach(cb => {
    cb.checked = days.map(Number).includes(Number(cb.value));
  });
  const del = document.getElementById('ca-delete');
  if (del) del.hidden = !job;
  applyCaTypeDefaults(!job);
  bg.style.display = 'block';
  modal.style.display = 'block';
}
function applyCaTypeDefaults(force){
  const type = document.getElementById('ca-type')?.value || 'model';
  const meta = CA_TYPE_BY_ID[type];
  if (!meta) return;
  if (force) {
    const cad = meta.defaultCadence || 'weekly';
    document.getElementById('ca-cadence').value = cad;
    const days = caDaysForCadence(cad, meta.defaultDays || [2], meta);
    document.querySelectorAll('#ca-days input[type=checkbox]').forEach(cb => {
      cb.checked = days.map(Number).includes(Number(cb.value));
    });
    document.getElementById('ca-time-start').value = meta.defaultStart || '';
    document.getElementById('ca-time-end').value = meta.defaultEnd || '';
    caSetStaffing(meta.defaultStaffing || 'outsourced');
    document.getElementById('ca-vendor').innerHTML = caVendorOptions(meta.defaultVendor || 'TendCo Cleaning');
  }
  caSyncVendorVisibility();
}
function closeCaModal(){
  const bg = document.getElementById('ca-modal-bg');
  const modal = document.getElementById('ca-modal');
  if (bg) bg.style.display = 'none';
  if (modal) modal.style.display = 'none';
}
function saveCaModal(){
  ensurePropertySchedule();
  const id = document.getElementById('ca-edit-id')?.value || '';
  const type = document.getElementById('ca-type')?.value || 'model';
  const meta = CA_TYPE_BY_ID[type] || CA_TYPES[0];
  const cadenceRaw = document.getElementById('ca-cadence')?.value || 'weekly';
  const cadence = CA_CADENCE_BY_ID[cadenceRaw] ? cadenceRaw : 'weekly';
  const picked = [...document.querySelectorAll('#ca-days input[type=checkbox]:checked')].map(cb => Number(cb.value));
  const days = caDaysForCadence(cadence, picked, meta);
  const need = (CA_CADENCE_BY_ID[cadence] || {}).daysNeeded || 1;
  if (cadence !== '5x' && picked.length < Math.min(need, 1)) { toast('Pick at least one day'); return; }
  if (cadence !== '5x' && picked.length < need) {
    toast('Pick ' + need + ' day' + (need > 1 ? 's' : '') + ' for ' + (CA_CADENCE_BY_ID[cadence].label || cadence));
    return;
  }
  const staffing = caGetStaffing();
  let vendor = document.getElementById('ca-vendor')?.value || '';
  if (staffing === 'in_house') vendor = vendor || 'In-house';
  const job = {
    id: id || ('ca-' + Date.now().toString(36)),
    type,
    label: meta.label,
    cadence,
    days,
    time_start: document.getElementById('ca-time-start')?.value || '',
    time_end: document.getElementById('ca-time-end')?.value || '',
    staffing,
    vendor,
    notes: (document.getElementById('ca-notes')?.value || '').trim(),
    demo: false,
  };
  const list = (state.commonAreas || []).slice();
  const idx = list.findIndex(j => j.id === job.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...job, demo: list[idx].demo };
  else list.push(job);
  saveCommonAreas(list);
  closeCaModal();
  renderCommonAreasView();
  try { renderCalendar(); } catch {}
  toast((meta.short || 'Common area') + ' · ' + caStaffingLabel(job) + ' saved · recurring on calendar');
}
function deleteCaModal(){
  const id = document.getElementById('ca-edit-id')?.value;
  if (!id) return;
  saveCommonAreas((state.commonAreas || []).filter(j => j.id !== id));
  closeCaModal();
  renderCommonAreasView();
  try { renderCalendar(); } catch {}
  toast('Common-area job removed');
}

function addViewingSuggestion(kind){
  ensurePropertySchedule();
  const spec = VW_SUGGESTIONS.find(s => s.kind === kind);
  if (!spec) return;
  if ((state.viewingItems || []).some(x => x.kind === kind)) {
    toast('Already on Viewing');
    return;
  }
  const item = {
    id: 'vw-' + kind + '-' + Date.now().toString(36),
    title: spec.title,
    kind: spec.kind,
    cadence: spec.cadence || 'weekly',
    days: (spec.days || []).slice(),
    month: spec.month || null,
    monthday: spec.monthday != null ? spec.monthday : null,
    once: '',
    length_days: spec.length_days || spec.week_block_days || 0,
    week_block_days: spec.week_block_days || 0,
    notes: spec.notes || 'Viewing only',
    demo: false,
  };
  saveViewingItems((state.viewingItems || []).concat([item]));
  renderCommonAreasView();
  try { renderCalendar(); } catch {}
  toast(spec.title + ' added · Viewing only');
}

function openVwModal(editId){
  ensurePropertySchedule();
  const bg = document.getElementById('vw-modal-bg');
  const modal = document.getElementById('vw-modal');
  if (!modal) return;
  const it = editId ? (state.viewingItems || []).find(j => j.id === editId) : null;
  document.getElementById('vw-edit-id').value = it ? it.id : '';
  document.getElementById('vw-modal-title').textContent = it ? 'Edit viewing reminder' : 'Add viewing reminder';
  document.getElementById('vw-title').value = it?.title || '';
  const kindEl = document.getElementById('vw-kind');
  if (kindEl) {
    // Ensure fire_inspection option exists
    if (![...kindEl.options].some(o => o.value === 'fire_inspection')) {
      const opt = document.createElement('option');
      opt.value = 'fire_inspection';
      opt.textContent = 'Fire inspection';
      kindEl.insertBefore(opt, kindEl.firstChild);
    }
    kindEl.value = it?.kind || 'fire_inspection';
  }
  const cad = it?.cadence || (it?.kind === 'fire_inspection' || !it ? 'annual' : 'weekly');
  const cadEl = document.getElementById('vw-cadence');
  if (cadEl) {
    for (const v of ['annual', 'semiannual']) {
      if (![...cadEl.options].some(o => o.value === v)) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v === 'annual' ? 'Annual (pick month/day)' : 'Semi-annual';
        cadEl.appendChild(o);
      }
    }
    cadEl.value = cad;
  }
  document.getElementById('vw-notes').value = it?.notes || '';
  const md = it?.monthday != null ? it.monthday : 10;
  const mdEl = document.getElementById('vw-monthday');
  if (mdEl) mdEl.value = md;
  const mdAnn = document.getElementById('vw-monthday-annual');
  if (mdAnn) mdAnn.value = md;
  const monthEl = document.getElementById('vw-month');
  if (monthEl) monthEl.value = it?.month || 11;
  document.getElementById('vw-once').value = it?.once || '';
  const len = Number(it?.length_days) || Number(it?.week_block_days) || 5;
  const weekEl = document.getElementById('vw-week-block');
  // Default ON for fire inspection so week lock is visible
  if (weekEl) weekEl.checked = it ? !!(it.week_block_days) : true;
  const weekDaysEl = document.getElementById('vw-week-days');
  if (weekDaysEl) weekDaysEl.value = len;
  const days = it?.days || [5];
  document.querySelectorAll('#vw-days input[type=checkbox]').forEach(cb => {
    cb.checked = days.map(Number).includes(Number(cb.value));
  });
  syncVwCadenceUI();
  const del = document.getElementById('vw-delete');
  if (del) del.hidden = !it;
  bg.style.display = 'block';
  modal.style.display = 'block';
}
function syncVwCadenceUI(){
  const cad = document.getElementById('vw-cadence')?.value || 'weekly';
  const daysW = document.getElementById('vw-days-wrap');
  const mdW = document.getElementById('vw-monthday-wrap');
  const onceW = document.getElementById('vw-once-wrap');
  const annualW = document.getElementById('vw-annual-wrap');
  if (daysW) daysW.hidden = !(cad === 'weekly' || cad === '2x');
  // Monthly uses its own day field; annual/semi use Peak date (month + day) in annual wrap
  if (mdW) mdW.hidden = cad !== 'monthly';
  if (onceW) onceW.hidden = cad !== 'once';
  if (annualW) annualW.hidden = !(cad === 'annual' || cad === 'semiannual');
  const kind = document.getElementById('vw-kind')?.value;
  const weekWrap = document.getElementById('vw-week-wrap');
  if (weekWrap) weekWrap.hidden = kind !== 'fire_inspection';
}
function vwReadMonthday(cadence){
  if (cadence === 'monthly') {
    return Math.min(28, Math.max(1, Number(document.getElementById('vw-monthday')?.value) || 1));
  }
  // annual / semiannual — prefer dedicated annual day field
  const ann = document.getElementById('vw-monthday-annual');
  if (ann && ann.value) return Math.min(28, Math.max(1, Number(ann.value) || 10));
  return Math.min(28, Math.max(1, Number(document.getElementById('vw-monthday')?.value) || 10));
}
function closeVwModal(){
  const bg = document.getElementById('vw-modal-bg');
  const modal = document.getElementById('vw-modal');
  if (bg) bg.style.display = 'none';
  if (modal) modal.style.display = 'none';
}
function saveVwModal(){
  ensurePropertySchedule();
  const id = document.getElementById('vw-edit-id')?.value || '';
  const title = (document.getElementById('vw-title')?.value || '').trim();
  if (!title) { toast('Add a title'); return; }
  const cadence = document.getElementById('vw-cadence')?.value || 'weekly';
  const days = [...document.querySelectorAll('#vw-days input[type=checkbox]:checked')].map(cb => Number(cb.value));
  if ((cadence === 'weekly' || cadence === '2x') && !days.length) { toast('Pick at least one day'); return; }
  if (cadence === 'once' && !document.getElementById('vw-once')?.value) { toast('Pick a date'); return; }
  if ((cadence === 'annual' || cadence === 'semiannual') && !vwReadMonthday(cadence)) {
    toast('Pick a day within the month'); return;
  }
  if ((cadence === 'annual' || cadence === 'semiannual') && !document.getElementById('vw-month')?.value) {
    toast('Pick a month'); return;
  }
  const kind = document.getElementById('vw-kind')?.value || 'other';
  const lengthDays = kind === 'fire_inspection'
    ? Math.min(14, Math.max(1, Number(document.getElementById('vw-week-days')?.value) || 5))
    : 0;
  const weekOn = kind === 'fire_inspection' && !!document.getElementById('vw-week-block')?.checked;
  const weekDays = weekOn ? lengthDays : 0;
  const item = {
    id: id || ('vw-' + Date.now().toString(36)),
    title,
    kind,
    cadence,
    days: cadence === 'weekly' ? days.slice(0, 1) : (cadence === '2x' ? days.slice(0, 3) : []),
    month: (cadence === 'annual' || cadence === 'semiannual')
      ? Math.min(12, Math.max(1, Number(document.getElementById('vw-month')?.value) || 11))
      : null,
    monthday: (cadence === 'monthly' || cadence === 'annual' || cadence === 'semiannual')
      ? vwReadMonthday(cadence)
      : null,
    once: cadence === 'once' ? (document.getElementById('vw-once')?.value || '') : '',
    length_days: lengthDays || undefined,
    week_block_days: weekDays,
    notes: (document.getElementById('vw-notes')?.value || '').trim(),
    demo: false,
  };
  const list = (state.viewingItems || []).slice();
  const idx = list.findIndex(j => j.id === item.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...item };
  else list.push(item);
  saveViewingItems(list);
  closeVwModal();
  renderCommonAreasView();
  try { renderCalendar(); } catch {}
  toast('Viewing reminder saved · tracking only');
}
function deleteVwModal(){
  const id = document.getElementById('vw-edit-id')?.value;
  if (!id) return;
  saveViewingItems((state.viewingItems || []).filter(j => j.id !== id));
  closeVwModal();
  renderCommonAreasView();
  try { renderCalendar(); } catch {}
  toast('Viewing item removed');
}

function openCommonAreaCreate(opts){
  const o = opts || {};
  location.hash = 'common-areas';
  state.caTab = o.viewing ? 'viewing' : 'common';
  showView('common-areas');
  setTimeout(() => {
    if (o.viewing) openVwModal(null);
    else openCaModal(null);
  }, 40);
}



/** Short label for pipeline chips (e.g. Move-out inspection → Inspection). */
function mrwSvcShort(s){
  if (!s) return 'Service';
  const k = mrwKind(s);
  if (k === 'inspection') return /full/i.test(s.label || '') ? 'Full inspection' : 'Inspection';
  if (k === 'trash') return 'Trash out';
  if (k === 'lock') return 'Change of lock';
  if (k === 'pest') return 'Pest control';
  if (k === 'bathtub') return 'Bathtub';
  if (k === 'carpet_replace') return 'Carpet replace';
  if (k === 'carpet_clean') return 'Carpet cleaning';
  if (k === 'color_change') return 'Color change';
  if (k === 'cleaning') return 'Cleaning';
  if (k === 'painting') return 'Painting';
  if (k === 'punch') return 'Punch';
  if (s.id === 'carpet' || /^carpet$/i.test(s.label || '')) return 'Carpet';
  return s.label || tradeLabel(s.trade) || 'Service';
}

function mrwSvcText(s){
  return [s?.id, s?.trade, s?.label, s?.hint].filter(Boolean).join(' ').toLowerCase();
}

/** Classify a service for order / duration / utility rules (fuzzy on trade + name). */
function mrwKind(s){
  if (!s) return 'other';
  const t = normalizeTradeId(s.trade);
  const txt = mrwSvcText(s);
  const id = String(s.id || '');
  if (id === 'trash_out' || t === 'trash_out' || /\btrash\s*out\b/.test(txt)) return 'trash';
  if (id === 'change_lock' || t === 'change_lock' || /\bchange\s*(of\s*)?lock\b|\block\s*change\b/.test(txt)) return 'lock';
  if (id === 'pest' || t === 'pest_control' || /\bpest\b/.test(txt)) return 'pest';
  if (t === 'bathtub_resurfacing' || /\bbathtub|\btub\s*resurface/.test(txt)) return 'bathtub';
  if (t === 'color_change' || /\bcolor\s*change\b/.test(txt)) return 'color_change';
  if (t === 'carpet_replacement' || /\bcarpet\s*replac/.test(txt)) return 'carpet_replace';
  if (t === 'carpet_cleaning' || id === 'carpet' || /\bcarpet\s*clean/.test(txt) || /\bcarpet\b/.test(txt)) {
    if (/\breplac/.test(txt)) return 'carpet_replace';
    return 'carpet_clean';
  }
  if (id === 'cleaning' || t === 'cleaning' || /\bhousekeep|\bcleaning\b/.test(txt)) return 'cleaning';
  if (id === 'inspection' || /\binspection/.test(txt)) return 'inspection';
  if (id === 'punch' || /\bpunch/.test(txt)) return 'punch';
  if (id === 'painting' || t === 'painting' || /\bpaint/.test(txt)) return 'painting';
  return 'other';
}

function mrwDayCost(kind){
  if (kind === 'color_change' || kind === 'bathtub') return 2;
  return 1;
}

function mrwNeedsUtilities(s){
  const k = mrwKind(s);
  return k === 'cleaning' || k === 'carpet_clean';
}

function mrwUtilitiesOk(utils){
  return !!(utils && utils.water && utils.electric);
}


function mrwAddWorkDays(fromKey, n){
  if (!fromKey) return '';
  let cur = fromKey;
  let added = 0;
  const need = Math.max(0, Number(n) || 0);
  let guard = 0;
  while (added < need && guard++ < 400) {
    cur = addDaysKey(cur, 1);
    if (parseKey(cur).getDay() !== 0) added++;
  }
  // Ensure resume lands on a work day (skip Sunday)
  guard = 0;
  while (parseKey(cur).getDay() === 0 && guard++ < 8) cur = addDaysKey(cur, 1);
  return cur;
}

function mrwHasPestService(w){
  return !!(w && (w.services || []).some(s => mrwKind(s) === 'pest'));
}

/** Pest infestation flag OR auto-true when pest_control is on the pipeline. */
function mrwSyncPestFlag(w){
  if (!w) return false;
  if (mrwHasPestService(w)) w.pest_infestation = true;
  w.pest_wait_days = Number(w.pest_wait_days) > 0 ? Number(w.pest_wait_days) : 2;
  return !!w.pest_infestation;
}

function mrwPestWaitDays(w){
  return Number(w?.pest_wait_days) > 0 ? Number(w.pest_wait_days) : 2;
}

function mrwPestLastWorkDay(w){
  const pest = (w?.services || []).find(s => mrwKind(s) === 'pest');
  if (!pest) return w?.move_out_date || todayKeyNY();
  return pest.scheduled_end || pest.scheduled_date || w?.move_out_date || todayKeyNY();
}

function mrwPestResumeDate(w){
  return mrwAddWorkDays(mrwPestLastWorkDay(w), mrwPestWaitDays(w));
}

function mrwPestComplete(w){
  const pest = (w?.services || []).find(s => mrwKind(s) === 'pest');
  if (!pest) return !!w?.pest_cleared;
  const st = String(pest.status || pest.confirm || '').toLowerCase();
  return !!w?.pest_cleared || st === 'complete' || st === 'completed' || pest.completed === true;
}

/** Gate active while infestation/pest present and not yet cleared after wait. */
function mrwPestGateActive(w){
  if (!w) return false;
  mrwSyncPestFlag(w);
  if (!w.pest_infestation && !mrwHasPestService(w)) return false;
  // Lift when pest complete/cleared AND wait days elapsed
  if (mrwPestComplete(w) && todayKeyNY() >= mrwPestResumeDate(w)) return false;
  return true;
}

function mrwIsUrgent(t){
  if (!t) return false;
  if (t.urgent === true || t.priority === 'urgent') return true;
  return !!(t.move_in_date && String(t.move_in_date).trim());
}

function mrwIsFlexible(t){
  if (!t) return false;
  return !mrwIsUrgent(t);
}

function mrwShowReadyDate(t){
  const mo = t?.move_out_date || todayKeyNY();
  const today = todayKeyNY();
  const start = mo < today ? today : mo;
  return mrwAddWorkDays(start, 10);
}

function mrwUrgencyChipHtml(t){
  if (!t) return '';
  if (mrwIsUrgent(t)) {
    return `<span class="urg-badge urg-urgent" title="Move-in set — all services before MI">Urgent</span>`;
  }
  const by = mrwShowReadyDate(t);
  return `<span class="urg-badge urg-flex" title="No move-in — show-ready target">Show-ready by ${esc(fmtDate(by))}</span>`;
}


function mrwIsEviction(w){
  return !!(w && (w.make_ready_type === 'eviction' || w.eviction === true));
}

function mrwMakeService(spec){
  return {
    id: spec.id,
    trade: spec.trade,
    label: spec.label,
    hint: spec.hint || '',
    vendor: '',
    confirm: '',
    confirm_via: '',
    scheduled_date: '',
    scheduled_end: '',
    day_part: '',
    slot_n: 0,
    blocked_utils: false,
  };
}

/** Seed eviction head services: Change of lock → Trash out → Full inspection. */
function mrwSeedEviction(w){
  if (!w || !mrwIsEviction(w)) return;
  w.services = w.services || [];
  const has = (kind) => w.services.some(s => mrwKind(s) === kind);
  if (!has('lock')) {
    w.services.unshift(mrwMakeService({
      id: 'change_lock', trade: 'change_lock', label: 'Change of lock',
      hint: 'Eviction — secure the unit first',
    }));
  }
  if (!has('trash')) {
    const lockIdx = w.services.findIndex(s => mrwKind(s) === 'lock');
    const trash = mrwMakeService({
      id: 'trash_out', trade: 'trash_out', label: 'Trash out',
      hint: 'Eviction — clear debris before trades',
    });
    w.services.splice(lockIdx >= 0 ? lockIdx + 1 : 0, 0, trash);
  }
  let insp = w.services.find(s => mrwKind(s) === 'inspection');
  if (!insp) {
    insp = mrwMakeService({
      id: 'inspection', trade: 'maintenance', label: 'Full inspection',
      hint: 'Eviction full inspection',
    });
    w.services.push(insp);
  } else {
    insp.label = 'Full inspection';
    if (!/eviction/i.test(insp.hint || '')) insp.hint = 'Eviction full inspection';
  }
}

/**
 * Hard pipeline order:
 * Eviction: Change of lock → (Pest if present) → Trash out → Full inspection → middle → Bathtub last.
 * Standard + pest: Pest → Trash (if any) → middle → Bathtub last.
 * Standard: Trash (if any) → middle → Bathtub last.
 */
function mrwEnforceOrder(w){
  if (!w || !Array.isArray(w.services)) return { snapped: false };
  if (mrwIsEviction(w)) mrwSeedEviction(w);
  const before = w.services.map(s => s.id + ':' + mrwKind(s)).join('|');
  const list = w.services.slice();
  const take = (kind) => {
    const i = list.findIndex(s => mrwKind(s) === kind);
    if (i < 0) return null;
    return list.splice(i, 1)[0];
  };
  const head = [];
  const eviction = mrwIsEviction(w);
  if (eviction) {
    const lock = take('lock'); if (lock) head.push(lock);
    const pest = take('pest'); if (pest) head.push(pest);
    const trash = take('trash'); if (trash) head.push(trash);
    const insp = take('inspection'); if (insp) head.push(insp);
  } else {
    const pest = take('pest'); if (pest) head.push(pest);
    const trash = take('trash'); if (trash) head.push(trash);
  }
  const tub = take('bathtub');
  w.services = head.concat(list).concat(tub ? [tub] : []);
  const after = w.services.map(s => s.id + ':' + mrwKind(s)).join('|');
  return { snapped: before !== after, before, after };
}

/**
 * Work days: MO inclusive → day before MI (buffer), skip Sundays.
 * If no MI, window ends at MO + max(dayDemand, 6).
 */
function mrwWorkDays(mo, mi, dayDemand){
  if (!mo) return [];
  const need = Math.max(1, Number(dayDemand) || 1);
  let endExclusive;
  if (mi) {
    endExclusive = mi;
  } else {
    // No MI = flexible: MO + max(dayDemand, 10) work days (show-ready default)
    const span = Math.max(need, 10);
    endExclusive = addDaysKey(mo, span + 1);
  }
  const days = [];
  let cur = mo;
  let guard = 0;
  while (cur < endExclusive && guard++ < 400) {
    if (parseKey(cur).getDay() !== 0) days.push(cur);
    cur = addDaysKey(cur, 1);
  }
  if (!days.length) {
    let c = mo;
    let g = 0;
    while (parseKey(c).getDay() === 0 && g++ < 8) c = addDaysKey(c, 1);
    days.push(c);
  }
  return days;
}

function mrwMinDayDemand(services, shareCleanCarpet){
  let demand = 0;
  let clean = false, carpetClean = false;
  for (const s of services) {
    const k = mrwKind(s);
    if (k === 'cleaning') { clean = true; continue; }
    if (k === 'carpet_clean') { carpetClean = true; continue; }
    demand += mrwDayCost(k);
  }
  if (clean && carpetClean) demand += shareCleanCarpet ? 1 : 2;
  else {
    if (clean) demand += 1;
    if (carpetClean) demand += 1;
  }
  return Math.max(demand, 1);
}

/**
 * Spread scheduled_date / slot_n with duration + share rules.
 * Date slots stay position-anchored after reorder (re-applied every render).
 */
function mrwApplyDateSpread(w){
  if (!w) return w;
  mrwEnforceOrder(w);
  mrwSyncPestFlag(w);
  const services = w.services || [];
  services.forEach(s => {
    s.day_part = '';
    s.scheduled_end = '';
    s.blocked_utils = false;
    s.paused_pest = false;
  });
  const utilsOk = mrwUtilitiesOk(w.utilities);
  services.forEach(s => {
    if (mrwNeedsUtilities(s) && !utilsOk) s.blocked_utils = true;
  });

  const pestGate = mrwPestGateActive(w);
  // While pest gate active: only pest is actively schedulable; others paused
  if (pestGate) {
    services.forEach(s => {
      if (mrwKind(s) !== 'pest') s.paused_pest = true;
    });
  }

  const cleanIdx = services.findIndex(s => mrwKind(s) === 'cleaning');
  const carpetCleanIdx = services.findIndex(s => mrwKind(s) === 'carpet_clean');
  const canShare = cleanIdx >= 0 && carpetCleanIdx >= 0;

  // Prefer one-per-day: only share cleaning+carpet when window forces it
  let shareCleanCarpet = false;
  const demandShared = mrwMinDayDemand(services, true);
  const demandSeparate = mrwMinDayDemand(services, false);
  let days = mrwWorkDays(w.move_out_date, w.move_in_date || '', demandSeparate);
  if (canShare && demandSeparate > days.length) shareCleanCarpet = true;
  const demand = shareCleanCarpet ? demandShared : demandSeparate;
  days = mrwWorkDays(w.move_out_date, w.move_in_date || '', demand);
  // Prefer not packing tight — leave buffer before MI when possible (already day-before-MI)
  const doubleBook = demand > days.length && days.length > 0;

  // Build assignment blocks in pipeline order
  const skip = new Set();
  const blocks = []; // { indices: number[], cost: 1|2, exclusive: bool, share: bool }
  for (let i = 0; i < services.length; i++) {
    if (skip.has(i)) continue;
    const k = mrwKind(services[i]);
    if (shareCleanCarpet && (i === cleanIdx || i === carpetCleanIdx)) {
      blocks.push({ indices: [cleanIdx, carpetCleanIdx], cost: 1, exclusive: true, share: true });
      skip.add(cleanIdx); skip.add(carpetCleanIdx);
      continue;
    }
    const cost = mrwDayCost(k);
    const exclusive = (k === 'carpet_replace' || k === 'carpet_clean' || k === 'trash'
      || k === 'color_change' || k === 'bathtub' || k === 'lock');
    blocks.push({ indices: [i], cost, exclusive, share: false, kind: k });
  }

  // Pack blocks onto days
  const dayOcc = days.map(() => []); // each: list of { blockIdx, part }
  let cursor = 0;
  const placeExclusive = (cost) => {
    // Find run of `cost` consecutive free days from cursor, else from 0, else force
    const tryFrom = (start) => {
      for (let d = start; d <= days.length - cost; d++) {
        let ok = true;
        for (let j = 0; j < cost; j++) {
          if (dayOcc[d + j].length) { ok = false; break; }
        }
        if (ok) return d;
      }
      return -1;
    };
    let at = tryFrom(cursor);
    if (at < 0) at = tryFrom(0);
    if (at < 0) {
      // Best-effort: pin at last possible start
      at = Math.max(0, days.length - cost);
    }
    return at;
  };
  const placeFlexible = (cost) => {
    // Prefer free day from cursor; if double-booking needed, use mid-window day with only flexible occupants
    for (let d = cursor; d < days.length; d++) {
      if (!dayOcc[d].length) return d;
    }
    for (let d = 0; d < cursor; d++) {
      if (!dayOcc[d].length) return d;
    }
    // Forced double-book: prefer earlier mid-window that has no exclusive block
    const midStart = days.length >= 3 ? 1 : 0;
    for (let n = 0; n < days.length; n++) {
      const d = (midStart + n) % days.length;
      const occ = dayOcc[d];
      const hasEx = occ.some(o => o.exclusive);
      if (!hasEx) return d;
    }
    return Math.min(cursor, days.length - 1);
  };

  blocks.forEach((b, bi) => {
    let at;
    if (b.cost === 2 || b.exclusive) {
      at = placeExclusive(b.cost);
    } else {
      at = placeFlexible(b.cost);
    }
    if (at < 0) at = 0;
    for (let j = 0; j < b.cost; j++) {
      const di = Math.min(at + j, days.length - 1);
      if (b.share) {
        dayOcc[di].push({ blockIdx: bi, exclusive: true, share: true });
      } else {
        dayOcc[di].push({ blockIdx: bi, exclusive: !!b.exclusive, kind: b.kind });
      }
    }
    b.at = at;
    cursor = Math.min(at + b.cost, days.length - 1);
  });

  // Apply to services
  const slots = [];
  blocks.forEach((b) => {
    const start = days[Math.min(b.at || 0, days.length - 1)] || days[0] || w.move_out_date || '';
    const end = b.cost === 2
      ? (days[Math.min((b.at || 0) + 1, days.length - 1)] || start)
      : '';
    if (b.share) {
      const [ci, cci] = b.indices;
      services[ci].scheduled_date = start;
      services[ci].scheduled_end = '';
      services[ci].day_part = 'AM';
      services[cci].scheduled_date = start;
      services[cci].scheduled_end = '';
      services[cci].day_part = 'PM';
      slots[ci] = start;
      slots[cci] = start;
    } else {
      const i = b.indices[0];
      services[i].scheduled_date = start;
      services[i].scheduled_end = end || '';
      services[i].day_part = '';
      slots[i] = start;
    }
  });

  services.forEach((s, i) => {
    s.slot_n = i + 1;
    if (!s.scheduled_date) s.scheduled_date = days[0] || w.move_out_date || '';
  });

  // Pest hard gate: pause non-pest; only pest stays on active calendar until resume
  const resume = mrwPestResumeDate(w);
  w.pest_resume_date = resume || '';
  if (pestGate) {
    // Re-place non-pest from resume_date onward (preview dates) but keep paused + off active cal
    const afterPest = services.filter(s => mrwKind(s) !== 'pest');
    const resumeDays = [];
    if (resume) {
      let cur = resume;
      let g = 0;
      const mi = w.move_in_date || '';
      const endEx = mi || addDaysKey(resume, Math.max(afterPest.length, 10) + 1);
      while (cur < endEx && g++ < 400) {
        if (parseKey(cur).getDay() !== 0) resumeDays.push(cur);
        cur = addDaysKey(cur, 1);
      }
      if (!resumeDays.length) resumeDays.push(resume);
    }
    let ri = 0;
    afterPest.forEach(s => {
      s.paused_pest = true;
      const cost = mrwDayCost(mrwKind(s));
      if (resumeDays.length) {
        const at = Math.min(ri, resumeDays.length - 1);
        s.scheduled_date = resumeDays[at];
        s.scheduled_end = cost === 2 ? (resumeDays[Math.min(at + 1, resumeDays.length - 1)] || s.scheduled_date) : '';
        ri = Math.min(at + cost, resumeDays.length - 1);
      } else {
        s.scheduled_date = '';
        s.scheduled_end = '';
      }
      // pending confirm while paused — not actively scheduled on calendar
      if (s.confirm === 'confirmed') { /* keep vendor, but cal excludes via paused_pest */ }
    });
  } else {
    services.forEach(s => { s.paused_pest = false; });
  }

  w.spread = {
    days,
    doubleBook,
    demand,
    shareCleanCarpet,
    slots,
    tight: doubleBook,
    pestGate,
    pest_resume_date: w.pest_resume_date,
  };
  // Urgency flags on wizard draft
  w.urgent = mrwIsUrgent(w);
  w.flexible = !w.urgent;
  w.show_ready_by = w.urgent ? '' : mrwShowReadyDate(w);
  return w;
}

function mrwChipLabel(s){
  let name = mrwSvcShort(s);
  if (s.day_part === 'AM') name += ' (AM)';
  if (s.day_part === 'PM') name += ' (PM)';
  return name;
}

/** Numbered pipeline chips: "1 Inspection · Nov 10". */
function mrwPipelineStripHtml(w){
  const services = w?.services || [];
  if (!services.length) return '';
  const chips = services.map((s, i) => {
    const n = s.slot_n || (i + 1);
    let date = s.scheduled_date ? fmtDate(s.scheduled_date) : '—';
    if (s.scheduled_end && s.scheduled_end !== s.scheduled_date) {
      date = fmtDate(s.scheduled_date) + '–' + fmtDate(s.scheduled_end);
    }
    const blocked = s.blocked_utils ? ' blocked' : (s.paused_pest ? ' paused' : '');
    const pauseBit = s.paused_pest ? ' (paused)' : '';
    return `<span class="mrw-pipe-chip${blocked}" title="${esc(s.label || '')} · ${esc(date)}${pauseBit}"><b>${n}</b> ${esc(mrwChipLabel(s))} · ${esc(date)}${pauseBit}</span>`;
  }).join('');
  return `<div class="mrw-pipe-strip" aria-label="Service pipeline order">${chips}</div>`;
}

/** Mini calendar preview grouped by date under the strip. */
function mrwCalPreviewHtml(w){
  const services = w?.services || [];
  if (!services.length) return '';
  const byDate = new Map();
  for (const s of services) {
    const key = s.scheduled_date || '';
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(s);
    if (s.scheduled_end && s.scheduled_end !== s.scheduled_date) {
      const k2 = s.scheduled_end;
      if (!byDate.has(k2)) byDate.set(k2, []);
      byDate.get(k2).push({ ...s, day_part: (s.day_part || '') + ' day2', _cont: true });
    }
  }
  const unit = w.unit_label || '';
  const rows = [...byDate.entries()].map(([date, list]) => {
    const names = list.map(s => {
      let bit = mrwChipLabel(s);
      if (s._cont) bit = mrwSvcShort(s) + ' (cont.)';
      return unit ? `${bit}, ${unit}` : bit;
    }).join(' · ');
    const multi = list.filter(s => !s._cont).length > 1 ? ' multi' : '';
    return `<div class="mrw-cal-row${multi}"><span class="mrw-cal-d">${esc(date ? fmtDate(date) : 'TBD')}</span><span class="mrw-cal-n">${esc(names)}</span></div>`;
  }).join('');
  return `<div class="mrw-cal-preview" aria-label="Calendar preview"><div class="mrw-cal-h">Calendar preview</div>${rows}</div>`;
}

function mrwUtilsChecklistHtml(w, idPrefix){
  const u = w?.utilities || { water: false, electric: false };
  const p = idPrefix || 'mrw-util';
  return `<div class="mrw-utils" id="${p}-box">
    <div class="mrw-utils-h">Utilities — maintenance verify before cleaning</div>
    <label class="mrw-util-item"><input type="checkbox" id="${p}-water" ${u.water ? 'checked' : ''}> Water on</label>
    <label class="mrw-util-item"><input type="checkbox" id="${p}-electric" ${u.electric ? 'checked' : ''}> Electric on</label>
  </div>`;
}

function mrwCleaningBlockedBanner(w){
  const hasCleanish = (w?.services || []).some(s => mrwNeedsUtilities(s));
  if (!hasCleanish) return '';
  if (mrwUtilitiesOk(w?.utilities)) return '';
  return `<div class="mrw-util-flag" role="status">Cleaning blocked — confirm water and electric</div>`;
}

function mrwPestChecklistHtml(w, idPrefix){
  const p = idPrefix || 'mrw-pest';
  const on = !!w?.pest_infestation || mrwHasPestService(w);
  const wait = mrwPestWaitDays(w);
  return `<div class="mrw-pest-box" id="${p}-box">
    <label class="mrw-util-item"><input type="checkbox" id="${p}-infest" ${on ? 'checked' : ''}> Pest infestation (hard gate)</label>
    <label class="mrw-util-item" style="gap:4px">Wait <input type="number" id="${p}-wait" min="1" max="14" value="${wait}" style="width:52px;padding:4px 6px;border:1.5px solid var(--border);border-radius:8px;font-weight:750"> work days</label>
  </div>`;
}

function mrwPestBlockedBanner(w){
  if (!mrwPestGateActive(w)) return '';
  const resume = w.pest_resume_date || mrwPestResumeDate(w);
  const when = resume ? fmtDate(resume) : 'resume date';
  return `<div class="mrw-pest-flag" role="status">Pest-blocked — other services paused until ${esc(when)}</div>`;
}


function parseTurnServices(t){
  if (!t) return [];
  if (Array.isArray(t.services) && t.services.length) return t.services;
  if (typeof t.services_json === 'string' && t.services_json) {
    try {
      const arr = JSON.parse(t.services_json);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }
  return [];
}


/** Severity: most work stays onsite (TendCo / staff). Outside vendor only when severity needs it. */
const TRADE_SEVERITY = {
  pest_control: 'outside_ok',       // often specialized
  painting: 'onsite',
  maintenance: 'onsite',
  cleaning: 'onsite',
  carpet_cleaning: 'outside_ok',
  carpet_replacement: 'outside_ok',
  bathtub_resurfacing: 'outside_ok',
  countertops_resurfacing: 'outside_ok',
  drywall_repairs: 'onsite',
  plumbing: 'onsite_first',         // onsite unless severity needs vendor
  electrical: 'onsite_first',
  hvac: 'onsite_first',
  fire_alarm: 'calendar_lock',      // busy days only — no invite / no dispatch
  fire_inspection: 'calendar_lock',
};

function tradeLabel(idOrLabel){
  if (idOrLabel == null || idOrLabel === '') return '';
  const raw = String(idOrLabel).trim();
  const key = raw.toLowerCase().replace(/[\s\-]+/g, '_');
  if (UNIT_TRADE_BY_ID[key]) return UNIT_TRADE_BY_ID[key].label;
  const byLabel = UNIT_TRADES.find(t => t.label.toLowerCase() === raw.toLowerCase() || t.short.toLowerCase() === raw.toLowerCase());
  if (byLabel) return byLabel.label;
  // Soft aliases
  const aliases = {
    paint: 'painting', painting: 'painting', 'paint_t/u': 'painting', paint_full: 'painting',
    carpet_clean: 'carpet_cleaning', carpet: 'carpet_cleaning',
    carpet_replace: 'carpet_replacement',
    drywall: 'drywall_repairs', 'patch_drywall': 'drywall_repairs',
    tub: 'bathtub_resurfacing', bathtub: 'bathtub_resurfacing',
    counters: 'countertops_resurfacing', countertops: 'countertops_resurfacing', 'counter_tops': 'countertops_resurfacing',
    pest: 'pest_control',
    clean: 'cleaning', housekeeping: 'cleaning',
    maint: 'maintenance',
    fire: 'fire_inspection', fire_inspect: 'fire_inspection', fire_alarm_test: 'fire_alarm',
  };
  if (aliases[key] && UNIT_TRADE_BY_ID[aliases[key]]) return UNIT_TRADE_BY_ID[aliases[key]].label;
  return raw;
}

function normalizeTradeId(idOrLabel){
  if (idOrLabel == null || idOrLabel === '') return '';
  const raw = String(idOrLabel).trim();
  const key = raw.toLowerCase().replace(/[\s\-]+/g, '_');
  if (UNIT_TRADE_BY_ID[key]) return key;
  const byLabel = UNIT_TRADES.find(t => t.label.toLowerCase() === raw.toLowerCase() || t.short.toLowerCase() === raw.toLowerCase());
  if (byLabel) return byLabel.id;
  const aliases = {
    paint: 'painting', 'paint_t/u': 'painting', paint_full: 'painting', paint_touch_up: 'painting',
    carpet_clean: 'carpet_cleaning', carpet: 'carpet_cleaning',
    carpet_replace: 'carpet_replacement',
    drywall: 'drywall_repairs', patch_drywall: 'drywall_repairs',
    tub: 'bathtub_resurfacing', bathtub: 'bathtub_resurfacing',
    counters: 'countertops_resurfacing', countertops: 'countertops_resurfacing', counter_tops: 'countertops_resurfacing',
    pest: 'pest_control',
    clean: 'cleaning', housekeeping: 'cleaning',
    maint: 'maintenance',
    fire: 'fire_inspection', fire_inspect: 'fire_inspection', fire_alarm_test: 'fire_alarm',
  };
  return aliases[key] || '';
}

/** Map carpet clean/replace (and paint) into make-ready fields; keep paint full|touch_up. */
function repairReplaceFromTrade(tradeId){
  if (tradeId === 'carpet_cleaning') return 'Carpet clean';
  if (tradeId === 'carpet_replacement') return 'Carpet replace';
  if (tradeId === 'drywall_repairs') return 'Drywall repairs';
  if (tradeId === 'bathtub_resurfacing') return 'Bathtub resurfacing';
  if (tradeId === 'countertops_resurfacing') return 'Counter tops resurfacing';
  if (tradeId === 'plumbing') return 'Plumbing';
  if (tradeId === 'electrical') return 'Electrical';
  if (tradeId === 'hvac') return 'HVAC';
  return '';
}

function tradesOnTurn(t){
  const out = [];
  const seen = new Set();
  const push = (id, extra) => {
    const tid = normalizeTradeId(id);
    if (!tid || seen.has(tid)) return;
    seen.add(tid);
    const meta = UNIT_TRADE_BY_ID[tid];
    out.push({ id: tid, label: meta ? meta.label : tradeLabel(id), short: meta ? meta.short : tradeLabel(id), ...extra });
  };
  if (t.trade) push(t.trade);
  if (isTruthyDone(t.paint) || t.paint) push('painting', { paint: paintLabel(t.paint) });
  if (isTruthyDone(t.housekeeping) || t.housekeeping) push('cleaning');
  const rr = String(t.repair_replace || '').toLowerCase();
  if (rr.includes('carpet clean')) push('carpet_cleaning');
  else if (rr.includes('carpet replace')) push('carpet_replacement');
  else if (rr.includes('drywall')) push('drywall_repairs');
  else if (rr.includes('bathtub') || rr.includes('tub')) push('bathtub_resurfacing');
  else if (rr.includes('counter')) push('countertops_resurfacing');
  else if (rr.includes('plumb')) push('plumbing');
  else if (rr.includes('electric')) push('electrical');
  else if (rr.includes('hvac') || rr.includes('a/c') || rr.includes('ac ')) push('hvac');
  else if (rr.includes('pest')) push('pest_control');
  else if (rr.trim()) {
    // free-text repair still shows as chip label
    const tid = normalizeTradeId(t.repair_replace);
    if (tid) push(tid);
  }
  return out;
}

function tradeChipHtml(trades, opts){
  const list = trades || [];
  if (!list.length) return '';
  const cls = (opts && opts.className) || 'trade-chips';
  return `<div class="${cls}">${list.map(t => {
    const extra = t.paint ? ` · ${t.paint}` : '';
    return `<span class="trade-chip" data-trade="${esc(t.id)}">${esc(t.short || t.label)}${esc(extra)}</span>`;
  }).join('')}</div>`;
}

/** Calendar chip colors = status (not priority / service type). */
const CAL_STATUS = {
  go: 'st-go',       // blue — scheduled / in progress
  attn: 'st-attn',   // amber — needs attention
  done: 'st-done',   // green — complete / ready
  cancel: 'st-cancel'// soft gray — cancelled
};

function isHighPriority(raw){
  if (raw == null || raw === false || raw === '') return false;
  if (raw === true || raw === 1) return true;
  const s = String(raw).trim().toLowerCase();
  return ['high','urgent','priority','p1','critical'].includes(s);
}

function calStatusClass(it){
  const st = String(it?.status || '').toLowerCase();
  if (it?.calendarLock || it?.kind === 'lock' || st === 'locked') return 'st-lock';
  if (it?.kind === 'oncall' || it?.oncall || st === 'oncall') return 'st-oncall';
  if (it?.kind === 'viewing' || it?.lane === 'viewing' || it?.viewing || st === 'viewing') return 'st-viewing';
  if (it?.kind === 'common' || it?.lane === 'common') return 'st-common';
  if (st === 'cancelled' || st === 'canceled') return CAL_STATUS.cancel;
  if (st === 'complete' || st === 'completed' || st === 'ready') return CAL_STATUS.done;
  // Needs attention: return, blocked, punch, pending confirm, explicit overlap
  if (
    it?.overlap ||
    st === 'return_requested' ||
    st === 'blocked' ||
    st === 'punch' ||
    st === 'pending'
  ) return CAL_STATUS.attn;
  // scheduled / in progress / confirmed / received (on calendar = dated work)
  return CAL_STATUS.go;
}

function priBadgeHtml(it, compact){
  if (!it?.highPriority && !it?.urgent) return '';
  const urgent = !!(it?.urgent || String(it?.priority || '').toLowerCase() === 'urgent');
  if (compact) return `<span class="cal-pri${urgent?' urg':''}" title="${urgent?'Urgent — MI deadline':'High priority'}" aria-label="${urgent?'Urgent':'High priority'}"></span>`;
  return `<span class="cal-pri-badge${urgent?' urg':''}" title="${urgent?'Urgent — MI deadline':'High priority'}">${urgent?'Urgent':'High'}</span>`;
}

function truncateLabel(s, max){
  const t = String(s || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, Math.max(1, max - 1)).trimEnd() + '…';
}

/** Assigned person/company — TendCo tech OR outside vendor (whiteboard "Comments" names). */
function assigneeOf(it){
  return String(it?.assignee || it?.vendor_name || it?.owner_name || '').trim();
}

function calStatusLabel(it){
  const st = String(it?.status || '').toLowerCase();
  if (it?.calendarLock || it?.kind === 'lock' || st === 'locked') return 'Busy · locked';
  if (it?.kind === 'oncall' || it?.oncall || st === 'oncall') return 'On call';
  if (it?.kind === 'viewing' || it?.lane === 'viewing' || it?.viewing || st === 'viewing') return 'Viewing';
  if (it?.kind === 'common' || it?.lane === 'common') return 'Common area';
  if (st === 'complete' || st === 'completed' || st === 'ready') return 'Tended';
  if (st === 'cancelled' || st === 'canceled') return 'Cancelled';
  if (st === 'return_requested') return 'Return';
  if (st === 'in_progress') return 'In progress';
  if (st === 'confirmed') return 'Confirmed';
  if (st === 'pending') return 'Needs confirm';
  if (st === 'blocked') return 'Blocked';
  if (st === 'punch') return 'Punch';
  if (st === 'scheduled') return 'Scheduled';
  if (st === 'received') return 'Received';
  if (it?.overlap) return 'Needs attention';
  return (STATUS_META[it?.status]?.label) || it?.status || '';
}

/** Shorten long vendor names for month/week chips (day view can pass longer max). */
function shortChipName(name, max){
  let t = String(name || '').trim();
  if (!t) return '';
  // Drop trailing generic words so "Sunshine Carpet Cleaning" → "Sunshine Carpet"
  // Keep single-token brands intact (e.g. "TendCo Cleaning" stays "TendCo Cleaning")
  const shortened = t.replace(/\s+(Cleaning|Services|Service|Company|Inc\.?|LLC|Co\.?)$/i, '').trim();
  if (shortened && /\s/.test(shortened)) t = shortened;
  return truncateLabel(t, max);
}

/** Chip text: name first, then unit — "{shortName}, unit {unit_label}". Fire locks stay Busy. On-call: "{Name}, on call". */
function calChipLabel(it, opts){
  const o = opts || {};
  const maxName = o.long ? 24 : 16;
  if (it?.calendarLock || it?.kind === 'lock') {
    return truncateLabel(UNIT_TRADE_BY_ID[normalizeTradeId(it.trade)]?.short || it.title || 'Busy', 18);
  }
  if (it?.kind === 'oncall' || it?.oncall) {
    const who = shortChipName(assigneeOf(it), maxName) || 'Team';
    return who + ', on call';
  }
  if (it?.kind === 'viewing' || it?.lane === 'viewing' || it?.viewing) {
    const tip = truncateLabel(it.title || 'Reminder', o.long ? 28 : 18);
    return o.long ? ('Viewing · ' + tip) : tip;
  }
  if (it?.kind === 'common' || it?.lane === 'common') {
    const meta = CA_TYPE_BY_ID[it.common_type] || {};
    const short = meta.short || truncateLabel(it.title || 'Common', 14);
    const win = it.time_window || '';
    if (o.long) {
      const who = shortChipName(assigneeOf(it), maxName);
      return [short, win, who].filter(Boolean).join(' · ');
    }
    return win ? (short + ' · ' + win.replace(/\s/g, '')) : short;
  }
  const who = shortChipName(assigneeOf(it), maxName);
  const unit = String(it?.unit_label || '').trim();
  if (who && unit) return who + ', unit ' + unit;
  if (who) return who;
  if (unit) return 'unit ' + unit;
  return truncateLabel(it?.title || '', 22);
}

function buzzLight(){
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([14, 36, 18]);
    }
  } catch (_) { /* no-op on unsupported browsers */ }
}

function paintLabel(p){
  const s = String(p || '').toLowerCase();
  if (s === 'full') return 'Full';
  if (s === 'touch_up' || s === 't/u' || s === 'tu') return 'T/U';
  return p || '';
}

function isTruthyDone(v){
  if (v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return !['no','0','false','pending','todo','—','-'].includes(s);
}

/** Fernando lock (Oct 26 2026): Created → MO → Inspection (+ change lock alongside) → trades → leasing inspect → ready → Rented (own date) → Move in. Planned ≠ done. */
function fieldActuallyDone(v){
  if (v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  if (['no','0','false','pending','todo','—','-','full','touch_up','t/u','tu','scheduled','in progress','in_progress'].includes(s)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  return ['done','yes','y','✓','complete','completed','tended'].includes(s);
}

function inspectionScheduleKey(t){
  const services = parseTurnServices(t);
  const insp = services.find(s => s.id === 'inspection' || /inspect/i.test(s.label || ''));
  if (insp?.scheduled_date) return insp.scheduled_date;
  if (t.move_out_date) return addDaysKey(t.move_out_date, 1);
  return '';
}

function rentedDateKey(t){
  if (t?.rented_at) return String(t.rented_at).slice(0, 10);
  const s = String(t?.rented || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function svcScheduleOrLabel(t, pred, fallbackLabel){
  const services = parseTurnServices(t);
  const hit = services.find(pred);
  if (hit?.scheduled_date) return { sub: 'Scheduled ' + fmtDate(hit.scheduled_date), vendor: hit.vendor || '' };
  if (hit?.vendor) return { sub: hit.vendor + (hit.confirm === 'confirmed' ? ' · confirmed' : ' · pending'), vendor: hit.vendor };
  return { sub: fallbackLabel, vendor: '' };
}

function makeReadyPipeline(t){
  const paint = paintLabel(t.paint);
  const createdKey = String(t.created_at || t.notice_at || '').slice(0, 10) || todayKeyNY();
  const today = todayKeyNY();
  const mo = t.move_out_date || '';
  const inspKey = inspectionScheduleKey(t);
  const inspDone = !!t.inspected_at;
  const moDone = ['in_progress','punch','complete'].includes(t.status)
    || (t.status === 'scheduled' && mo && mo <= today);
  const isNew = t.status === 'received' || !!t._localCreate || !!t._userCreated;
  const repair = t.repair_replace || '';
  const isCarpetRepair = /carpet/i.test(repair);
  const generalRepair = repair && !isCarpetRepair ? repair : '';
  const carpetRepair = isCarpetRepair ? repair : (/carpet/i.test(String(t.trade||'')) ? repairReplaceFromTrade(normalizeTradeId(t.trade)) : '');
  const paintSvc = svcScheduleOrLabel(t, s => s.id === 'painting' || isPaintTrade(s.trade), paint || 'Full or T/U');
  const punchSvc = svcScheduleOrLabel(t, s => s.id === 'punch' || /punch/i.test(s.label||''), 'Maintenance punch');
  const maintSvc = svcScheduleOrLabel(t, s => s.id !== 'punch' && s.id !== 'inspection' && normalizeTradeId(s.trade) === 'maintenance', 'Onsite maintenance');
  const carpetSvc = svcScheduleOrLabel(t, s => s.id === 'carpet' || isCarpetTrade(s.trade), carpetRepair || 'Clean or replace');
  const cleanSvc = svcScheduleOrLabel(t, s => s.id === 'cleaning' || normalizeTradeId(s.trade) === 'cleaning', t.housekeeping || 'Final clean');
  const rentedKey = rentedDateKey(t);
  const rentedDone = isRented(t) || !!rentedKey;
  const readyDone = t.status === 'complete' || !!t.handoff_at;
  const leaseInspDone = !!t.leasing_inspected_at || readyDone;
  const miDone = !!(t.move_in_date && t.move_in_date <= today && (readyDone || rentedDone));

  const nd = (done) => (isNew ? false : !!done);

  // Order (Fernando): Created → MO → Inspection → Change lock (alongside inspect) → Painting → Punch
  // → Paint full/repair replace → Maintenance → Carpet repair/replace → Housekeeping → Leasing inspection
  // → Ready for move in → Rented (own date) → Move in
  const stages = [
    { id:'created', label:'Created', sub: fmtDate(createdKey), done: true },
    { id:'move_out', label:'Move out', sub: mo ? fmtDate(mo) : 'Set move-out', done: nd(moDone) },
    { id:'inspection', label:'Inspection', sub: inspDone ? fmtDate(t.inspected_at) : (inspKey ? 'Scheduled ' + fmtDate(inspKey) : 'Day after move-out'), done: nd(inspDone) },
    { id:'change_lock', label:'Change lock', sub: t.change_lock ? String(t.change_lock) : 'With inspection', done: nd(fieldActuallyDone(t.change_lock)) },
    { id:'painting', label:'Painting', sub: paintSvc.sub, done: nd(fieldActuallyDone(t.paint) || (t.status === 'punch' || t.status === 'complete')) },
    { id:'punch', label:'Punch', sub: punchSvc.sub, done: nd(t.status === 'punch' || t.status === 'complete') },
    { id:'paint_repair', label:'Paint full / repair replace', sub: generalRepair || (paint ? ('Paint · ' + paint) : 'Paint + repairs'), done: nd(fieldActuallyDone(t.paint) && (!!generalRepair ? fieldActuallyDone(repair) : fieldActuallyDone(t.paint))) },
    { id:'maintenance', label:'Maintenance', sub: maintSvc.sub, done: nd(t.status === 'complete' || (t.status === 'punch' && normalizeTradeId(t.trade) === 'maintenance')) },
    { id:'carpet', label:'Repair replace carpet', sub: carpetSvc.sub || carpetRepair || 'Carpet clean / replace', done: nd(isCarpetRepair ? fieldActuallyDone(repair) : false) || nd(t.status === 'complete' && isCarpetTrade(t.trade)) },
    { id:'housekeeping', label:'Housekeeping / cleaning', sub: cleanSvc.sub, done: nd(fieldActuallyDone(t.housekeeping) || t.status === 'complete') },
    { id:'leasing_inspection', label:'Leasing inspection', sub: t.leasing_inspected_at ? fmtDate(t.leasing_inspected_at) : 'After all work is done', done: nd(leaseInspDone) && !isNew },
    { id:'ready_move_in', label:'Ready for move in', sub: readyDone ? (t.handoff_at ? fmtDate(String(t.handoff_at).slice(0,10)) : 'Tended · handoff') : 'Maintenance sign-off', done: nd(readyDone) },
    { id:'rented', label:'Rented', sub: rentedKey ? fmtDate(rentedKey) : (rentedDone ? 'Rented' : 'Own date — separate from move-in'), done: rentedDone },
    { id:'move_in', label:'Move in', sub: t.move_in_date ? fmtDate(t.move_in_date) : 'Move-in date', done: !!(t.move_in_date && miDone) },
  ];

  // Soft progress for mid-pipeline statuses (never on brand-new creates)
  if (!isNew) {
    if (t.status === 'complete') {
      // Everything through ready is done; rented/move-in stay on their own dates
      for (const id of ['created','move_out','inspection','change_lock','painting','punch','paint_repair','maintenance','carpet','housekeeping','leasing_inspection','ready_move_in']) {
        const s = stages.find(x => x.id === id); if (s) s.done = true;
      }
    } else if (t.status === 'punch') {
      for (const id of ['created','move_out','inspection','painting']) {
        const s = stages.find(x => x.id === id); if (s) s.done = true;
      }
      stages.find(s => s.id === 'punch').done = true;
    } else if (t.status === 'in_progress') {
      for (const id of ['created','move_out','inspection']) {
        const s = stages.find(x => x.id === id); if (s) s.done = true;
      }
    } else if (t.status === 'scheduled') {
      stages.find(s => s.id === 'created').done = true;
      if (moDone) stages.find(s => s.id === 'move_out').done = true;
    }
  }

  let current = stages.findIndex(s => !s.done);
  if (current < 0) current = stages.length - 1;
  return stages.map((s, i) => ({
    ...s,
    state: s.done && i < current ? 'done' : (i === current ? (s.done && i === stages.length - 1 ? 'done' : 'current') : (s.done ? 'done' : 'todo')),
  }));
}

function renderMakeReadyGrid(t){
  const el = document.getElementById('d-make-ready');
  if (!el) return;
  const L = lex();
  const trades = tradesOnTurn(t);
  const paint = paintLabel(t.paint);
  // Carpet clean/replace map into repair/replace; paint keeps Full|T/U
  let repair = t.repair_replace || '';
  if (!repair) {
    const tid = normalizeTradeId(t.trade);
    repair = repairReplaceFromTrade(tid);
  }
  const rows = [
    { k: L.Unit + ' #', v: t.unit_label || '—' },
    { k: 'Created', v: fmtDate(String(t.created_at || t.notice_at || todayKeyNY()).slice(0,10)) },
    { k: 'Move out', v: t.move_out_date ? fmtDate(t.move_out_date) : '' },
    { k: 'Inspection', v: t.inspected_at ? fmtDate(t.inspected_at) : (inspectionScheduleKey(t) ? 'Scheduled ' + fmtDate(inspectionScheduleKey(t)) : '') },
    { k: 'Change lock', v: t.change_lock || '' },
    { k: 'Paint', v: paint },
    { k: 'Repair / replace', v: repair },
    { k: 'Housekeeping', v: t.housekeeping || '' },
    { k: 'Rented', v: rentedDateKey(t) ? fmtDate(rentedDateKey(t)) : (isRented(t) ? 'Yes' : '') },
    { k: 'Move in', v: t.move_in_date ? fmtDate(t.move_in_date) : '' },
    { k: 'Tech on unit', v: t.owner_name || t.assignee || '' },
  ];
  const chips = trades.length
    ? `<div class="mr-trades"><span class="k">Trades on unit</span>${tradeChipHtml(trades, { className:'trade-chips' })}</div>`
    : `<div class="mr-trades muted"><span class="k">Trades on unit</span><span class="v faint">Pest · paint · maint · clean · carpet · resurface · drywall · plumb · electric · HVAC · fire (calendar lock)</span></div>`;
  const services = parseTurnServices(t);
  const svcHtml = services.length ? `<div class="mr-trades"><span class="k">Service pipeline</span>
    <div class="svc-pipe-mini">${services.map(s => {
      const cls = s.confirm === 'confirmed' ? 'ok' : (s.vendor ? 'wait' : '');
      return `<span class="${cls}">${esc(s.label)}${s.vendor ? ' · ' + esc(s.vendor) : ''}</span>`;
    }).join('')}</div></div>` : '';
  const note = t.supervisor_notes || carpetBeforePaintNote(services);
  const noteHtml = note ? `<div class="mr-trades" style="background:var(--amber-bg);border-color:color-mix(in srgb,var(--amber) 30%,transparent)"><span class="k">Supervisor note</span><span class="v" style="color:var(--amber);font-weight:750">${esc(note)}</span></div>` : '';
  const utils = t.utilities || { water: false, electric: false };
  const utilsOk = mrwUtilitiesOk(utils);
  const hasCleanish = services.some(s => mrwNeedsUtilities(s)) || /clean|housekeep|carpet\s*clean/i.test(String(t.housekeeping||'') + String(t.trade||''));
  const utilFlag = (hasCleanish && !utilsOk)
    ? `<div class="mrw-util-flag" style="margin:0 0 10px">Cleaning blocked — confirm water and electric</div>` : '';
  // Sync pest pause on services for drawer display
  const draftLike = {
    ...t,
    services: services.map(s => ({ ...s })),
    pest_infestation: t.pest_infestation,
    pest_wait_days: t.pest_wait_days || 2,
    pest_cleared: t.pest_cleared,
    move_out_date: t.move_out_date,
    move_in_date: t.move_in_date,
  };
  mrwSyncPestFlag(draftLike);
  const pestGate = mrwPestGateActive(draftLike);
  const resume = t.pest_resume_date || mrwPestResumeDate(draftLike);
  if (pestGate) {
    draftLike.services.forEach(s => { if (mrwKind(s) !== 'pest') s.paused_pest = true; });
  }
  const pestFlag = pestGate
    ? `<div class="mrw-pest-flag" style="margin:0 0 10px" role="status">Pest-blocked — other services paused until ${esc(fmtDate(resume))}</div>` : '';
  const urgHtml = `<div class="mr-trades"><span class="k">Urgency</span><div style="margin-top:4px">${mrwUrgencyChipHtml(t)}</div></div>`;
  const typeHtml = t.make_ready_type === 'eviction'
    ? `<div class="mr-trades"><span class="k">Make-ready type</span><span class="v" style="font-weight:800;color:var(--amber)">Eviction</span></div>` : '';
  const pestHtml = `<div class="mr-trades mrw-pest-drawer" data-turn-id="${esc(t.id || '')}">
    <span class="k">Pest gate</span>
    <div class="mrw-utils" style="margin-top:6px;border:0;padding:0;background:transparent">
      <label class="mrw-util-item"><input type="checkbox" data-pest="infest" ${draftLike.pest_infestation?'checked':''}> Pest infestation</label>
      <label class="mrw-util-item"><input type="checkbox" data-pest="cleared" ${t.pest_cleared?'checked':''}> Infestation cleared / pest complete</label>
      <label class="mrw-util-item" style="gap:4px">Wait <input type="number" data-pest="wait" min="1" max="14" value="${mrwPestWaitDays(draftLike)}" style="width:52px;padding:4px 6px;border:1.5px solid var(--border);border-radius:8px;font-weight:750"> days</label>
    </div>
  </div>`;
  const utilHtml = `<div class="mr-trades mrw-utils-drawer" data-turn-id="${esc(t.id || '')}">
    <span class="k">Utilities (maintenance)</span>
    <div class="mrw-utils" style="margin-top:6px;border:0;padding:0;background:transparent">
      <label class="mrw-util-item"><input type="checkbox" data-util="water" ${utils.water?'checked':''}> Water on</label>
      <label class="mrw-util-item"><input type="checkbox" data-util="electric" ${utils.electric?'checked':''}> Electric on</label>
    </div>
  </div>`;
  const svcHtml2 = services.length ? `<div class="mr-trades"><span class="k">Service pipeline</span>
    <div class="svc-pipe-mini">${draftLike.services.map(s => {
      const blocked = !!(s.blocked_utils || (mrwNeedsUtilities(s) && !mrwUtilitiesOk(utils)));
      const cls = s.paused_pest ? 'paused' : (blocked ? 'blocked' : (s.confirm === 'confirmed' ? 'ok' : (s.vendor ? 'wait' : '')));
      const bit = s.paused_pest ? ' · Paused — pest' : (s.vendor ? ' · ' + s.vendor : '');
      return `<button type="button" class="svc-pipe-btn ${cls}" data-svc-id="${esc(s.id)}" title="Open ${esc(s.label)} schedule / detail">${esc(s.label)}${esc(bit)}</button>`;
    }).join('')}</div></div>` : '';
  // Trade chips: clickable → matching service detail
  const chipsClick = trades.length
    ? `<div class="mr-trades"><span class="k">Trades on unit</span><div class="trade-chips">${trades.map(tr => {
        return `<button type="button" class="trade-chip" data-trade="${esc(tr.id)}" title="Open ${esc(tr.label)}">${esc(tr.short || tr.label)}${tr.paint ? ' · ' + esc(tr.paint) : ''}</button>`;
      }).join('')}</div></div>`
    : chips;
  el.innerHTML = typeHtml + urgHtml + chipsClick + svcHtml2 + noteHtml + pestHtml + pestFlag + utilHtml + utilFlag + rows.map(r => {
    const empty = !r.v;
    return `<div class="mr-cell${empty?' empty':''}"><span class="k">${esc(r.k)}</span><span class="v">${esc(r.v || '—')}</span></div>`;
  }).join('');
  el.querySelectorAll('.svc-pipe-btn[data-svc-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTurnService(t.id, btn.dataset.svcId);
    });
  });
  el.querySelectorAll('.trade-chip[data-trade]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tid = btn.dataset.trade;
      const svcs = parseTurnServices(t);
      const hit = svcs.find(s => normalizeTradeId(s.trade) === normalizeTradeId(tid) || mrwKind(s) === mrwKind({ trade: tid }))
        || svcs.find(s => s.id === tid);
      if (hit) openTurnService(t.id, hit.id);
      else {
        // No pipeline row yet — still open turn and toast
        toast((tradeLabel(tid) || tid) + ' — add it on Create / Request services');
      }
    });
  });
  el.querySelectorAll('input[data-util]').forEach(inp => {
    inp.addEventListener('change', () => {
      const turn = (state.turns || []).find(x => x.id === t.id) || t;
      turn.utilities = turn.utilities || { water: false, electric: false };
      turn.utilities[inp.dataset.util] = !!inp.checked;
      if (turn.id && !String(turn.id).startsWith('local-') && !turn.demo) {
        api('/turns/' + turn.id, { method:'PATCH', body: JSON.stringify({ utilities: turn.utilities }) }).catch(() => {});
      }
      renderMakeReadyGrid(turn);
    });
  });
  const persistPest = (turn) => {
    if (turn.id && !String(turn.id).startsWith('local-') && !turn.demo) {
      api('/turns/' + turn.id, { method:'PATCH', body: JSON.stringify({
        pest_infestation: turn.pest_infestation,
        pest_wait_days: turn.pest_wait_days,
        pest_cleared: turn.pest_cleared,
        pest_resume_date: turn.pest_resume_date,
        services: turn.services,
      }) }).catch(() => {});
    }
  };
  el.querySelectorAll('[data-pest]').forEach(inp => {
    inp.addEventListener('change', () => {
      const turn = (state.turns || []).find(x => x.id === t.id) || t;
      const key = inp.dataset.pest;
      if (key === 'infest') turn.pest_infestation = !!inp.checked;
      if (key === 'cleared') turn.pest_cleared = !!inp.checked;
      if (key === 'wait') turn.pest_wait_days = Math.max(1, Number(inp.value) || 2);
      turn.pest_resume_date = mrwPestResumeDate(turn);
      // When cleared after wait, lift gate and re-spread remaining from resume
      let svcs = parseTurnServices(turn);
      if (!svcs.length) svcs = turn.services || [];
      const w = {
        ...turn,
        services: svcs.map(s => ({ ...s })),
        pest_infestation: turn.pest_infestation,
        pest_wait_days: turn.pest_wait_days,
        pest_cleared: turn.pest_cleared,
      };
      if (!mrwPestGateActive(w)) {
        mrwApplyDateSpread(w);
        turn.services = w.services;
        toast('Pest gate lifted — remaining services re-spread from ' + fmtDate(w.pest_resume_date || turn.pest_resume_date));
      } else {
        mrwApplyDateSpread(w);
        turn.services = w.services;
        turn.pest_resume_date = w.pest_resume_date;
      }
      persistPest(turn);
      renderMakeReadyGrid(turn);
      try { renderCalendar(); } catch {}
    });
  });
}

function renderPipeline(t){
  const el = document.getElementById('d-pipeline');
  if (!el) return;
  const stages = makeReadyPipeline(t);
  el.innerHTML = stages.map(s => {
    const mark = s.state === 'done' ? '✓' : (s.state === 'current' ? '●' : '');
    return `<div class="mr-step ${s.state}">
      <div class="dot" aria-hidden="true">${mark}</div>
      <div><div class="lbl">${esc(s.label)}</div>${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}</div>
    </div>`;
  }).join('');
}

function isRented(t){
  if (t?.rented_at) return true;
  const s = String(t?.rented || '').trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  return ['yes','y','true','1','rented'].includes(s);
}

function touchupRemindersCleared(t){
  const s = String(t?.rented || '').trim().toLowerCase();
  // Mark rented OR Mark done stops the vacant touch-up prompt
  return isRented(t) || s === 'done' || s === 'cleared' || s === 'dismissed';
}

function renderVacantOffer(t){
  const el = document.getElementById('d-vacant-offer');
  if (!el) return;
  const handed = t.status === 'complete' || !!t.handoff_at || !!t.inspected_at;
  const show = handed && !touchupRemindersCleared(t);
  if (!show) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const L = lex();
  el.innerHTML = `
    <div class="vo-title">Still vacant — offer touch-up clean / paint?</div>
    <div class="vo-body">Maintenance signed off (Tended) and handed to leasing. This ${esc(L.unit)} is not marked rented — a light touch-up clean or paint is an easy revenue follow-up.</div>
    <div class="vo-actions">
      <button type="button" class="btn pri sm" data-vo="touchup-clean">Touch-up clean</button>
      <button type="button" class="btn sec sm" data-vo="touchup-paint">Touch-up paint</button>
      <button type="button" class="btn ghost sm" data-vo="mark-rented">Mark rented</button>
      <button type="button" class="btn ghost sm" data-vo="mark-done">Mark done</button>
    </div>`;
  el.querySelectorAll('[data-vo]').forEach(btn => {
    btn.onclick = async () => {
      const act = btn.dataset.vo;
      try {
        if (act === 'mark-rented') {
          const rentedAt = todayKeyNY();
          if (t.demo || t._mrbDemo || t._localCreate) {
            t.rented = 'yes';
            t.rented_at = rentedAt;
            toast('Marked rented ' + fmtDate(rentedAt) + ' — reminders cleared');
            renderVacantOffer(t);
            renderPipeline(t);
            renderMakeReadyBoard();
            return;
          }
          await api('/turns/' + t.id, { method:'PATCH', body: JSON.stringify({ rented: 'yes', rented_at: rentedAt }) });
          toast('Marked rented ' + fmtDate(rentedAt) + ' — reminders cleared');
        } else if (act === 'mark-done') {
          // Clears touch-up reminder stream without claiming rented
          if (t.demo || t._mrbDemo || t._localCreate) {
            t.rented = 'done';
            toast('Mark done — touch-up reminders stopped');
            renderVacantOffer(t);
            renderMakeReadyBoard();
            return;
          }
          await api('/turns/' + t.id, { method:'PATCH', body: JSON.stringify({ rented: 'done' }) });
          toast('Mark done — touch-up reminders stopped');
        } else if (act === 'touchup-clean') {
          toast('Touch-up clean noted — follow up with leasing');
          return;
        } else if (act === 'touchup-paint') {
          toast('Touch-up paint noted — follow up with leasing');
          return;
        }
        await refresh();
        openTurn(t.id);
      } catch (e) { toast(e.message); }
    };
  });
}



function buildDemoServicesForRow(row){
  const list = cloneDefaultServices();
  // Carpet-before-paint demo: put carpet ahead of painting
  if (row.carpet_before_paint) {
    const carpet = list.find(s => s.id === 'carpet');
    const paint = list.find(s => s.id === 'painting');
    if (carpet && paint) {
      const ci = list.indexOf(carpet);
      const pi = list.indexOf(paint);
      if (ci > pi) {
        list.splice(ci, 1);
        list.splice(pi, 0, carpet);
      }
      carpet.trade = 'carpet_cleaning';
    }
  }
  // Attach vendor demo on carpet or first outside-ok trade
  if (row.vendor_demo) {
    const vd = String(row.vendor_demo);
    const tendcoCrewByTrade = (trade, svcId) => {
      const t = normalizeTradeId(trade) || svcId || '';
      if (t === 'painting' || svcId === 'painting') return 'TendCo Painting';
      if (t === 'cleaning' || svcId === 'cleaning') return 'TendCo Cleaning';
      if (t === 'punch' || svcId === 'punch' || t === 'maintenance') return 'TendCo Punch';
      if (t.includes('carpet')) return 'TendCo Cleaning';
      return 'TendCo Painting';
    };
    const isTendCoCrewDemo = (v) => /^(temco|tendco|tendco)$/i.test(String(v || '').trim());
    const applyVendor = (svc) => {
      if (!svc) return;
      let name = vd;
      if (isTendCoCrewDemo(vd)) name = tendcoCrewByTrade(svc.trade, svc.id);
      else if (/sunshine/i.test(vd) && !/cleaning/i.test(vd)) name = 'Sunshine Carpet Cleaning';
      else if (/floor\s*pro|floorpro/i.test(vd)) name = 'Floor Pro Carpet';
      svc.vendor = name;
      svc.confirm = row.status === 'scheduled' || row.status === 'in_progress' ? 'confirmed' : 'pending';
      svc.confirm_via = svc.confirm === 'confirmed' ? 'text' : '';
      if (svc.confirm === 'confirmed') svc.scheduled_date = row.move_out_date;
    };
    if (isTendCoCrewDemo(vd)) {
      list.forEach(s => {
        if (['painting','cleaning','punch'].includes(s.id) || /paint|clean|punch|maint/i.test(s.trade||'')) {
          applyVendor(s);
        }
      });
    } else {
      const target = list.find(s => s.id === 'carpet') || list.find(s => normalizeTradeId(s.trade) === normalizeTradeId(row.trade)) || list[0];
      applyVendor(target);
    }
  }
  // Carpet replace: remap default Carpet (cleaning) → Carpet replace so pipeline matches board
  const rr = String(row.repair_replace || '').toLowerCase();
  const wantReplace = normalizeTradeId(row.trade) === 'carpet_replacement' || rr.includes('carpet replace');
  if (wantReplace) {
    const carpet = list.find(s => s.id === 'carpet' || normalizeTradeId(s.trade) === 'carpet_cleaning' || normalizeTradeId(s.trade) === 'carpet_replacement');
    if (carpet) {
      carpet.id = 'carpet_replacement';
      carpet.trade = 'carpet_replacement';
      carpet.label = 'Carpet replace';
      carpet.hint = carpet.hint || 'Replace — own day';
      if (row.owner_name && !carpet.vendor) {
        carpet.vendor = row.owner_name;
        carpet.confirm = ['scheduled','in_progress','punch','complete'].includes(row.status) ? 'confirmed' : (row.owner_name ? 'pending' : '');
        carpet.confirm_via = carpet.confirm === 'confirmed' ? 'text' : '';
        if (carpet.confirm === 'confirmed') carpet.scheduled_date = row.move_out_date || carpet.scheduled_date || '';
      }
    }
  }
  // Seed trade-specific extras
  const tid = normalizeTradeId(row.trade);
  if (tid && !list.some(s => normalizeTradeId(s.trade) === tid) && UNIT_TRADE_BY_ID[tid] && !UNIT_TRADE_BY_ID[tid].noInvite) {
    // insert before cleaning
    const cleanIdx = list.findIndex(s => s.id === 'cleaning');
    const extra = {
      id: tid,
      trade: tid,
      label: UNIT_TRADE_BY_ID[tid].label,
      hint: '',
      vendor: row.owner_name || '',
      confirm: row.owner_name ? (['scheduled','in_progress','punch','complete'].includes(row.status) ? 'confirmed' : 'pending') : '',
      confirm_via: '',
      scheduled_date: '',
    };
    if (extra.confirm === 'confirmed') extra.scheduled_date = row.move_out_date || '';
    if (cleanIdx >= 0) list.splice(cleanIdx, 0, extra);
    else list.push(extra);
  }
  // create20: apply owner_name onto matching pipeline service (e.g. Maya → Maintenance on H-260)
  if (row.owner_name) {
    const want = normalizeTradeId(row.trade);
    let target = null;
    if (want === 'maintenance') {
      target = list.find(s => s.id === 'punch') || list.find(s => s.id === 'inspection') || list.find(s => normalizeTradeId(s.trade) === 'maintenance');
    } else if (want) {
      target = list.find(s => normalizeTradeId(s.trade) === want) || list.find(s => s.id === want);
    }
    if (target && !target.vendor) {
      target.vendor = row.owner_name;
      if (!target.confirm) {
        target.confirm = ['scheduled','in_progress','punch','complete'].includes(row.status) ? 'confirmed' : 'pending';
        target.confirm_via = target.confirm === 'confirmed' ? 'text' : '';
        if (target.confirm === 'confirmed') target.scheduled_date = target.scheduled_date || row.move_out_date || '';
      }
      // Prefer a clear Maintenance label when trade is maintenance on punch/inspection
      if (want === 'maintenance' && (target.id === 'punch' || target.id === 'inspection')) {
        if (target.id === 'punch') { target.label = 'Maintenance'; target.trade = 'maintenance'; }
      }
    }
  }
  // create11: flexible unit with scheduled carpet (pull source)
  if (row.services_preset === 'carpet_flex_demo') {
    const carpet = list.find(s => s.id === 'carpet' || normalizeTradeId(s.trade) === 'carpet_cleaning') || {
      id: 'carpet_cleaning', trade: 'carpet_cleaning', label: 'Carpet cleaning', hint: 'Flexible — no MI',
    };
    if (!list.includes(carpet) && !list.some(s => s.id === carpet.id)) list.unshift(carpet);
    carpet.trade = 'carpet_cleaning';
    carpet.label = 'Carpet cleaning';
    carpet.vendor = row.owner_name || 'Sunshine Carpet Cleaning';
    carpet.confirm = 'confirmed';
    carpet.confirm_via = 'text';
    carpet.scheduled_date = row.move_out_date || todayKeyNY();
  }
  // create11: urgent unit needs carpet (pull destination) — painting only, no carpet yet
  if (row.services_preset === 'urgent_needs_carpet') {
    // ensure no carpet on pipeline so it "needs" the trade
    for (let i = list.length - 1; i >= 0; i--) {
      if (mrwKind(list[i]) === 'carpet_clean' || mrwKind(list[i]) === 'carpet_replace') list.splice(i, 1);
    }
    const paint = list.find(s => s.id === 'painting');
    if (paint) {
      paint.vendor = row.owner_name || 'Ana';
      paint.confirm = 'confirmed';
      paint.confirm_via = 'call';
      paint.scheduled_date = row.move_out_date;
    }
  }
  return list;
}

/** Demo-only whiteboard roster (inspired by physical Make Ready Manager board). */
function ensureDemoWhiteboardRows(){
  if (!isDemoMode()) return;
  const existing = new Set((state.turns || []).map(t => String(t.unit_label || '').toUpperCase()));
  const roster = [
    { unit_label:'G-349', address:'Oakridge Bldg G', city:'Winter Park', bedrooms:2, move_out_date:'2026-10-27', move_in_date:'', paint:'', repair_replace:'Carpet clean', housekeeping:'', change_lock:'', inspected_at:'', status:'scheduled', owner_name:'Sunshine Carpet Cleaning', trade:'carpet_cleaning', notice_at:'2026-10-20', flexible:true, services_preset:'carpet_flex_demo', vendor_demo:'Sunshine Carpet Cleaning' },
    { unit_label:'F-356', address:'Oakridge Bldg F', city:'Winter Park', bedrooms:2, move_out_date:'2026-10-12', move_in_date:'2026-10-25', paint:'full', repair_replace:'Carpet clean', housekeeping:'2026-10-08', change_lock:'349', inspected_at:'2026-10-24', status:'complete', owner_name:'Fred', trade:'carpet_cleaning', rented:'yes', handoff_at:'2026-10-24T14:00:00-04:00', completed_at:'2026-10-24T13:20:00-04:00' },
    { unit_label:'2-170', address:'Oakridge Bldg 2', city:'Winter Park', bedrooms:1, move_out_date:'2026-10-06', move_in_date:'2026-10-20', paint:'full', repair_replace:'Carpet clean', housekeeping:'2026-10-09', change_lock:'467', inspected_at:'', status:'punch', owner_name:'Dennis', trade:'carpet_cleaning' },
    { unit_label:'A-111', address:'Oakridge Bldg A', city:'Winter Park', bedrooms:1, move_out_date:'2026-10-08', move_in_date:'2026-10-22', paint:'full', repair_replace:'Carpet clean', housekeeping:'2026-10-12', change_lock:'135', inspected_at:'', status:'in_progress', owner_name:'Dennis', trade:'painting' },
    { unit_label:'D-332', address:'Oakridge Bldg D', city:'Winter Park', bedrooms:1, move_out_date:'2026-10-04', move_in_date:'2026-10-15', paint:'touch_up', repair_replace:'Carpet replace', housekeeping:'2026-10-14', change_lock:'329', inspected_at:'2026-10-14', status:'complete', owner_name:'Fred', trade:'carpet_replacement', rented:'yes', completed_at:'2026-10-14T17:00:00-04:00' },
    { unit_label:'A-205', address:'Oakridge Bldg A', city:'Winter Park', bedrooms:1, move_out_date:'2026-10-07', move_in_date:'2026-10-16', paint:'full', repair_replace:'Carpet clean', housekeeping:'2026-10-15', change_lock:'225', inspected_at:'2026-10-15', status:'complete', owner_name:'Joe', trade:'carpet_cleaning', rented:'no', handoff_at:'2026-10-15T16:00:00-04:00', completed_at:'2026-10-15T15:00:00-04:00' },
    { unit_label:'D-135', address:'Oakridge Bldg D', city:'Winter Park', bedrooms:1, move_out_date:'2026-10-08', move_in_date:'2026-10-22', paint:'full', repair_replace:'Carpet replace', housekeeping:'2026-10-16', change_lock:'111', inspected_at:'', status:'punch', owner_name:'Fred', trade:'carpet_replacement' },
    { unit_label:'B-329', address:'Oakridge Bldg B', city:'Winter Park', bedrooms:3, move_out_date:'2026-10-13', move_in_date:'2026-11-07', paint:'full', repair_replace:'Carpet clean', housekeeping:'2026-10-16', change_lock:'332', inspected_at:'', status:'in_progress', owner_name:'Ana', trade:'painting' },
    { unit_label:'H-260', address:'Oakridge Bldg H', city:'Winter Park', bedrooms:2, move_out_date:'2026-10-18', move_in_date:'2026-10-30', paint:'', repair_replace:'', housekeeping:'', change_lock:'', inspected_at:'', status:'scheduled', owner_name:'Maya', trade:'maintenance' },
    { unit_label:'2-368', address:'Oakridge Bldg 2', city:'Winter Park', bedrooms:2, move_out_date:'2026-10-20', move_in_date:'2026-11-01', paint:'touch_up', repair_replace:'Drywall repairs', housekeeping:'', change_lock:'', inspected_at:'', status:'scheduled', owner_name:'Dennis', trade:'drywall_repairs' },
    { unit_label:'2-467', address:'Oakridge Bldg 2', city:'Winter Park', bedrooms:1, move_out_date:'2026-10-21', move_in_date:'2026-11-02', paint:'', repair_replace:'Plumbing', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'Joe', trade:'plumbing' },
    { unit_label:'H-259', address:'Oakridge Bldg H', city:'Winter Park', bedrooms:2, move_out_date:'2026-10-22', move_in_date:'2026-11-03', paint:'full', repair_replace:'', housekeeping:'', change_lock:'', inspected_at:'', status:'scheduled', owner_name:'Fred', trade:'painting' },
    { unit_label:'A-410', address:'Oakridge Bldg A', city:'Winter Park', bedrooms:1, move_out_date:'2026-10-24', move_in_date:'2026-11-05', paint:'', repair_replace:'Electrical', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'Coastal Electric', trade:'electrical' },
    { unit_label:'E-137', address:'Oakridge Bldg E', city:'Winter Park', bedrooms:1, move_out_date:'2026-10-25', move_in_date:'2026-11-06', paint:'touch_up', repair_replace:'HVAC', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'Joe', trade:'hvac' },
    // Rolling 60-day: notices given in late Oct for Dec move-outs → land in December weeks
    { unit_label:'C-220', address:'Oakridge Bldg C', city:'Winter Park', bedrooms:2, move_out_date:'2026-12-02', move_in_date:'2026-12-12', paint:'full', repair_replace:'Carpet clean', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'', trade:'painting', notice_at:'2026-10-26', services_preset:'default', vendor_demo:'TendCo' },
    { unit_label:'101', address:'Oakridge Tower', city:'Winter Park', bedrooms:1, move_out_date:'2026-12-03', move_in_date:'2026-12-14', paint:'touch_up', repair_replace:'', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'Maya', trade:'maintenance', notice_at:'2026-10-20' },
    { unit_label:'102', address:'Oakridge Tower', city:'Winter Park', bedrooms:1, move_out_date:'2026-12-04', move_in_date:'', paint:'full', repair_replace:'Carpet replace', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'', trade:'carpet_replacement', notice_at:'2026-10-22', carpet_before_paint:true },
    { unit_label:'B-118', address:'Oakridge Bldg B', city:'Winter Park', bedrooms:2, move_out_date:'2026-12-05', move_in_date:'2026-12-15', paint:'', repair_replace:'', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'Fred', trade:'maintenance', notice_at:'2026-10-18' },
    { unit_label:'G-401', address:'Oakridge Bldg G', city:'Winter Park', bedrooms:3, move_out_date:'2026-12-06', move_in_date:'2026-12-18', paint:'full', repair_replace:'Drywall repairs', housekeeping:'', change_lock:'', inspected_at:'', status:'scheduled', owner_name:'Dennis', trade:'painting', notice_at:'2026-10-15' },
    { unit_label:'D-210', address:'Oakridge Bldg D', city:'Winter Park', bedrooms:1, move_out_date:'2026-12-08', move_in_date:'2026-12-20', paint:'touch_up', repair_replace:'Pest control', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'BugFree Pest', trade:'pest_control', notice_at:'2026-10-24' },
    { unit_label:'H-312', address:'Oakridge Bldg H', city:'Winter Park', bedrooms:2, move_out_date:'2026-12-09', move_in_date:'', paint:'', repair_replace:'', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'', trade:'cleaning', notice_at:'2026-10-25', flexible:true },
    { unit_label:'G-354', address:'Oakridge Bldg G', city:'Winter Park', bedrooms:2, move_out_date:'2026-10-26', move_in_date:'2026-11-02', paint:'touch_up', repair_replace:'', housekeeping:'', change_lock:'', inspected_at:'', status:'in_progress', owner_name:'Ana', trade:'painting', notice_at:'2026-10-18', urgent:true, services_preset:'urgent_needs_carpet' },
    { unit_label:'A-308', address:'Oakridge Bldg A', city:'Winter Park', bedrooms:1, move_out_date:'2026-12-10', move_in_date:'2026-12-22', paint:'full', repair_replace:'Bathtub resurfacing', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'BathRenew', trade:'bathtub_resurfacing', notice_at:'2026-10-21' },
    { unit_label:'F-144', address:'Oakridge Bldg F', city:'Winter Park', bedrooms:2, move_out_date:'2026-12-11', move_in_date:'2026-12-23', paint:'touch_up', repair_replace:'', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'Ana', trade:'painting', notice_at:'2026-10-19' },
    { unit_label:'2-255', address:'Oakridge Bldg 2', city:'Winter Park', bedrooms:2, move_out_date:'2026-12-12', move_in_date:'2026-12-24', paint:'', repair_replace:'', housekeeping:'', change_lock:'', inspected_at:'', status:'received', owner_name:'Joe', trade:'maintenance', notice_at:'2026-10-23' },
    // SFH-style address unit (lexicon flex)
    { unit_label:'1842 Willow', address:'1842 Willow Creek Dr', city:'Winter Park', bedrooms:3, move_out_date:'2026-11-28', move_in_date:'2026-12-08', paint:'full', repair_replace:'Carpet clean', housekeeping:'', change_lock:'', inspected_at:'', status:'scheduled', owner_name:'TendCo Cleaning', trade:'carpet_cleaning', notice_at:'2026-10-10', vendor_demo:'TendCo' },
  ];
  let added = 0;
  for (const row of roster) {
    const key = String(row.unit_label).toUpperCase();
    if (existing.has(key)) continue;
    const id = 'demo-mrb-' + row.unit_label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if ((state.turns || []).some(t => t.id === id)) continue;
    const meta = STATUS_META[row.status] || STATUS_META.received;
    const services = buildDemoServicesForRow(row);
    const carpetNote = row.carpet_before_paint ? 'carpet needs to be protected' : carpetBeforePaintNote(services);
    state.turns.push({
      id,
      unit_id: 'demo-unit-' + row.unit_label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      unit_label: row.unit_label,
      address: row.address,
      city: row.city,
      bedrooms: row.bedrooms,
      status: row.status,
      status_label: row.status === 'complete' ? 'Tended' : meta.label,
      pill: meta.pill,
      notes: carpetNote ? ('Make Ready Board demo · ' + carpetNote) : 'Make Ready Board demo',
      move_out_date: row.move_out_date,
      move_in_date: row.move_in_date,
      paint: row.paint,
      repair_replace: row.repair_replace,
      housekeeping: row.housekeeping,
      change_lock: row.change_lock,
      inspected_at: row.inspected_at,
      owner_name: row.owner_name,
      assignee: row.owner_name || row.vendor_demo || '',
      trade: row.trade,
      rented: row.rented || '',
      handoff_at: row.handoff_at || null,
      completed_at: row.completed_at || null,
      scheduled_date: row.move_out_date,
      created_at: (row.notice_at || row.move_out_date) + 'T12:00:00-04:00',
      notice_at: row.notice_at || row.move_out_date,
      notice_reversed: false,
      services,
      supervisor_notes: carpetNote || '',
      photo_count: row.status === 'complete' ? 4 : 0,
      has_photo_proof: row.status === 'complete',
      demo: true,
      _mrbDemo: true,
      urgent: row.urgent === true || !!(row.move_in_date && String(row.move_in_date).trim()),
      flexible: row.flexible === true || !(row.move_in_date && String(row.move_in_date).trim()),
      show_ready_by: (row.move_in_date ? '' : (row.show_ready_by || '')),
      pest_infestation: !!row.pest_infestation,
      pest_wait_days: row.pest_wait_days || 2,
      pest_cleared: !!row.pest_cleared,
    });
    existing.add(key);
    added++;
  }
  if (added && state.units) {
    for (const t of state.turns) {
      if (!t._mrbDemo) continue;
      if (!(state.units || []).some(u => u.id === t.unit_id)) {
        state.units.push({ id: t.unit_id, label: t.unit_label, address: t.address, city: t.city });
      }
    }
  }
}

/** Demo overlay: make-ready fields + mid-pipeline + one vacant-after-handoff. */
function ensureDemoMakeReady(){
  if (!isDemoMode()) return;
  // Onsite TendCo/staff names — most trades stay here unless severity needs outside.
  const people = ['Joe','Fred','Dennis','Ana','Maya'];
  const packs = [
    { move_out_date:'2026-10-18', move_in_date:'2026-10-28', paint:'touch_up', repair_replace:'Carpet clean', housekeeping:'done', change_lock:'done', inspected_at:'2026-10-26', rented:'no', handoff_at:'2026-10-26T16:00:00-04:00', force_complete:true, trade:'carpet_cleaning', owner_name:'Sunshine Carpet Cleaning' },
    { move_out_date:'2026-10-22', move_in_date:'2026-11-01', paint:'full', repair_replace:'Drywall repairs', housekeeping:'in progress', change_lock:'', inspected_at:'', rented:'', trade:'painting', owner_name:'Fred' },
    { move_out_date:'2026-10-24', move_in_date:'2026-11-03', paint:'touch_up', repair_replace:'Plumbing', housekeeping:'', change_lock:'', inspected_at:'', rented:'', trade:'plumbing', owner_name:'Joe' },
    { move_out_date:'2026-10-15', move_in_date:'2026-10-25', paint:'full', repair_replace:'Carpet replace', housekeeping:'done', change_lock:'A412', inspected_at:'2026-10-24', rented:'yes', handoff_at:'2026-10-24T12:00:00-04:00', trade:'carpet_replacement', owner_name:'Floor Pro Carpet' },
    { move_out_date:'2026-10-20', move_in_date:'2026-10-30', paint:'touch_up', repair_replace:'Drywall repairs', housekeeping:'scheduled', change_lock:'pending', inspected_at:'', rented:'', trade:'drywall_repairs', owner_name:'Dennis' },
    { move_out_date:'2026-10-21', move_in_date:'2026-10-31', paint:'', repair_replace:'HVAC', housekeeping:'', change_lock:'', inspected_at:'', rented:'', trade:'hvac', owner_name:'Joe' },
    { move_out_date:'2026-10-19', move_in_date:'2026-10-29', paint:'', repair_replace:'Electrical', housekeeping:'', change_lock:'', inspected_at:'', rented:'', trade:'electrical', owner_name:'Coastal Electric' },
  ];
  let vacantSeeded = false;
  state.turns.forEach((t, i) => {
    const pack = packs[i % packs.length];
    if (!t.owner_name) t.owner_name = pack.owner_name || people[i % people.length];
    if (!t.assignee) t.assignee = t.owner_name;
    if (!t.trade && pack.trade) t.trade = pack.trade;
    if (!t.move_out_date) {
      Object.assign(t, {
        move_out_date: pack.move_out_date,
        move_in_date: pack.move_in_date,
        paint: pack.paint,
        repair_replace: pack.repair_replace,
        housekeeping: pack.housekeeping,
        change_lock: pack.change_lock,
        inspected_at: pack.inspected_at,
        rented: t.rented || pack.rented || '',
        handoff_at: t.handoff_at || pack.handoff_at || null,
        trade: t.trade || pack.trade || null,
        owner_name: t.owner_name || pack.owner_name || people[i % people.length],
      });
    }
    // One handed-off vacant unit for revenue prompt — ONLY a known demo row, never a freshly created unit
    const isFreshCreate = !!(t._localCreate || t._userCreated);
    const canVacantSeed = !isFreshCreate && t._mrbDemo && String(t.unit_label || '').toUpperCase() === 'A-205' && (t.status === 'complete' || pack.force_complete);
    if (!vacantSeeded && canVacantSeed) {
      t.status = 'complete';
      t.status_label = 'Tended';
      t.pill = 'g';
      t.completed_at = t.completed_at || '2026-10-26T15:30:00-04:00';
      t.inspected_at = t.inspected_at || '2026-10-26';
      t.handoff_at = t.handoff_at || '2026-10-26T16:00:00-04:00';
      t.rented = 'no';
      t.owner_name = t.owner_name || 'Joe';
      t.assignee = t.assignee || t.owner_name;
      t.paint = t.paint || 'touch_up';
      t.housekeeping = t.housekeeping || 'done';
      t.change_lock = t.change_lock || 'done';
      t.move_out_date = t.move_out_date || '2026-10-18';
      t.move_in_date = t.move_in_date || '2026-10-28';
      vacantSeeded = true;
    }
  });
  // Whiteboard-style demo rows so Make Ready Board looks populated (late Oct 2026)
  ensureDemoWhiteboardRows();

  // Cycle KPI demo fill
  if (state.kpi && (state.kpi.avg_cycle_days == null || state.kpi.cycle_sample_n === 0)) {
    const samples = [];
    for (const t of state.turns) {
      if (t.status !== 'complete') continue;
      const end = t.inspected_at || (t.completed_at || '').slice(0, 10);
      const start = t.move_out_date || (t.created_at || '').slice(0, 10);
      if (!end || !start) continue;
      const a = Date.parse(start + 'T12:00:00Z');
      const b = Date.parse(end + 'T12:00:00Z');
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) samples.push((b - a) / 86400000);
    }
    if (samples.length) {
      state.kpi.avg_cycle_days = Math.round((samples.reduce((x,y)=>x+y,0) / samples.length) * 10) / 10;
      state.kpi.cycle_sample_n = samples.length;
    } else {
      state.kpi.avg_cycle_days = 4.2;
      state.kpi.cycle_sample_n = 6;
      state.kpi.cycle_spark = [5.1, 4.8, 4.5, 4.2];
    }
  }
}


let state = {
  user:null, turns:[], units:[], events:[], kpi:{}, focusUnitId:null, focusTurnId:null,
  photos:[], photosBound:false, punchDraft:null,
  cal:{ cursor:null, mode:'month', selected:null, tab:'cal', items:[] },
  mrw: null, // Create Make Ready wizard draft
  // create16 — outside unit make-ready pipeline
  commonAreas: null,   // recurring Model/Office/Pool (vendor OK)
  viewingItems: null,  // viewing-only reminders (no vendor / no approval)
  caTab: 'common',
};
window.HubState = state;

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('on'), 2600);
}

/** Offline preview board so `?demo=1` works on static Pages (no Worker API). */
let demoOffline = false;
let demoBoardMemory = null;

function portfolioMode(){
  try {
    const stored = sessionStorage.getItem('hub_property_mode');
    if (stored === 'sfh' || stored === 'multifamily' || stored === 'commercial') return stored;
  } catch {}
  try {
    const qm = (new URLSearchParams(location.search).get('mode') || '').toLowerCase();
    if (qm === 'houses' || qm === 'sfh') return 'sfh';
    if (qm === 'commercial') return 'commercial';
    if (qm === 'apartments' || qm === 'multifamily') return 'multifamily';
  } catch {}
  const hash = (location.hash || '').replace(/^#/, '').split('/')[0];
  if (hash.startsWith('houses')) return 'sfh';
  return (state.user && state.user.property_mode) || 'multifamily';
}

function lexiconForMode(mode){
  const base = {
    Place:'Building', place:'building', board:'Make Ready Board',
    open_turns:'Open turns', ready_to_walk:'Ready to walk', due_today:'Due today',
    waiting_photos:'Waiting on photos', request_turn:'Request a turn',
    empty_board:'Nothing open yet', done_subject_noun:'unit',
  };
  if (mode === 'commercial') {
    return Object.assign({}, base, { Unit:'Suite', unit:'suite', Unit_plural:'Suites', unit_plural:'suites', done_subject_noun:'suite', request_turn:'Request a suite' });
  }
  if (mode === 'sfh') {
    return Object.assign({}, base, { Unit:'Home', unit:'home', Unit_plural:'Homes', unit_plural:'homes', Place:'Street', place:'street', done_subject_noun:'home', request_turn:'Request a home', open_turns:'Open homes' });
  }
  return Object.assign({}, base, { Unit:'Unit', unit:'unit', Unit_plural:'Units', unit_plural:'units' });
}

function localDemoApi(path, opts){
  const method = String((opts && opts.method) || 'GET').toUpperCase();
  const p = String(path || '').split('?')[0];
  if (p === '/board' && method === 'GET') {
    const mode = portfolioMode();
    const mem = demoBoardMemory;
    return {
      ok: true,
      user: {
        name: 'Alex Rivera',
        email: 'alex@oakridgepm.example',
        role: 'pm',
        client_name: 'Oakridge SFR',
        property_mode: mode,
      },
      turns: mem ? mem.turns : [],
      units: mem ? mem.units : [],
      kpi: mem && mem.kpi ? mem.kpi : {},
      lexicon: lexiconForMode(mode),
      photos_bound: false,
    };
  }
  if (p === '/client' && method === 'PATCH') {
    try {
      const body = JSON.parse((opts && opts.body) || '{}');
      if (body.property_mode) {
        sessionStorage.setItem('hub_property_mode', body.property_mode);
        if (state.user) state.user.property_mode = body.property_mode;
      }
    } catch {}
    return { ok: true };
  }
  if (p === '/service-requests' && method === 'GET') return { ok: true, requests: [] };
  if (p === '/schedule' && method === 'GET') return { ok: true, events: (demoBoardMemory && demoBoardMemory.events) || state.events || [] };
  if (/\/photos$/.test(p) && method === 'GET') return { ok: true, photos: [], photos_bound: false };
  if (p === '/auth/logout') return { ok: true };
  // Mutations fall through to each caller's existing demo/offline path.
  if (method !== 'GET') throw new Error('offline');
  return { ok: true };
}

async function api(path, opts = {}){
  if (demoOffline && isDemoMode()) return localDemoApi(path, opts);
  try {
    const r = await fetch(API + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      if (isDemoMode()) {
        demoOffline = true;
        return localDemoApi(path, opts);
      }
      location.href = 'index.html';
      throw new Error('auth');
    }
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    if (err && err.message === 'auth') throw err;
    if (!isDemoMode()) throw err;
    demoOffline = true;
    return localDemoApi(path, opts);
  }
}

function initials(name){
  return String(name || '?').split(/\s+/).map(s => s[0]).join('').slice(0,2).toUpperCase();
}

function fmtDate(iso){
  if (!iso) return '';
  try {
    // YYYY-MM-DD is a calendar day (move-out/move-in) — parse as local noon, not UTC midnight
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) {
      const p = parseKey(iso.trim());
      return p.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    }
    return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone:'America/New_York' });
  } catch { return String(iso); }
}

function fmtWhen(start, end){
  if (!start) return 'TBD';
  const s = new Date(start);
  const day = s.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'America/New_York' });
  const t1 = s.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'America/New_York' });
  if (!end) return day + ' · ' + t1;
  const e = new Date(end);
  const t2 = e.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'America/New_York' });
  return day + '<small>' + t1 + ' – ' + t2 + '</small>';
}

function progHtml(n){
  let h = '<div class="prog">';
  for (let i = 1; i <= 5; i++) h += '<i' + (i <= n ? ' class="d"' : '') + '></i>';
  return h + '</div>';
}

function renderKpi(){
  const k = state.kpi || {};
  const cycle = k.avg_cycle_days;
  const cycleVal = cycle == null ? '—' : (Number.isInteger(cycle) ? String(cycle) : String(cycle));
  const spark = k.cycle_spark || null;
  const sparkHtml = spark && spark.length
    ? `<div class="spark" aria-hidden="true">${spark.map((n,i) => {
        const max = Math.max(...spark, 0.1);
        const h = Math.max(3, Math.round((n / max) * 20));
        return `<i class="${i===spark.length-1?'on':''}" style="height:${h}px"></i>`;
      }).join('')}</div>`
    : '';
  const tiles = [
    { key:'open', label:'Open turns', meta:'Active on the board', val:k.open||0 },
    { key:'due_today', label:'Due today', meta:'Scheduled for today', val:k.due_today||0 },
    { key:'avg_cycle', label:'Avg to Tended', meta: (k.cycle_sample_n ? (k.cycle_sample_n + ' this month · days') : 'Move-out → Tended'), val: cycleVal, spark: sparkHtml, sm: true },
    { key:'ready_to_walk', label:'Ready to walk', meta:'Punch or photo-ready', val:k.ready_to_walk||0 },
  ];
  document.getElementById('kpi-row').innerHTML = tiles.map(t => `
    <div class="card kpi home-tile" data-kpi="${t.key}">
      <div class="lbl">${t.label}</div>
      <div class="val${t.sm?' sm':''}">${t.val}${t.key==='avg_cycle' && t.val!=='—' ? '<small style="font-size:12px;font-weight:700;margin-left:4px;color:var(--muted)">days</small>' : ''}</div>
      <div class="meta">${t.meta}</div>
      ${t.spark || ''}
    </div>`).join('');
  document.getElementById('nav-turns-cnt').textContent = k.open || 0;
}

function turnCard(t){
  const meta = STATUS_META[t.status] || STATUS_META.received;
  const when = t.status === 'complete' && t.completed_at
    ? 'Tended ' + fmtDate(t.completed_at)
    : t.status === 'return_requested' ? ('Return · ' + (t.return_reason ? esc(t.return_reason).slice(0,48) : 'callback'))
    : t.scheduled_date ? 'ETA ' + fmtDate(t.scheduled_date)
    : 'In ' + fmtDate(t.created_at);
  const scope = (tradeLabel(t.trade) || (t.notes || '').split(/[\n·|]/)[0] || '').trim().slice(0, 72);
  const owner = t.owner_name ? esc(t.owner_name) : '';
  const photos = Number(t.photo_count || 0);
  const proofOk = !!t.has_photo_proof;
  const tended = t.status === 'complete'
    ? `<span class="tended-badge" title="Tended by TendCo™"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>Tended</span>`
    : '';
  return `<div class="ucard dense ${t.status==='complete'?'tended':''}" data-turn="${t.id}" data-unit="${t.unit_id}" data-status="${t.status}">
    ${tended}
    <div class="ucard-top">
      <div class="u">${esc(lex().Unit)} ${esc(t.unit_label)} ${mrwUrgencyChipHtml(t)}</div>
      <span class="pill ${meta.pill}">${meta.label}</span>
    </div>
    <div class="addr">${esc([t.address, t.city].filter(Boolean).join(' · ')) || '—'}</div>
    ${scope ? `<div class="scope">${esc(scope)}</div>` : ''}
    <div class="ucard-foot">
      <span class="mi">${when}${owner ? ' · ' + owner : ''}</span>
      <span class="photo-chip ${proofOk?'ok':(photos?'':'empty')}" title="${proofOk?'Photo proof ready':'Photo proof'}">${photos} photo${photos===1?'':'s'}</span>
    </div>
  </div>`;
}

function renderBoard(){
  const board = document.getElementById('board');
  const by = {};
  for (const s of STATUSES) by[s] = [];
  const secondary = [];
  for (const t of state.turns) {
    if (STATUSES.includes(t.status)) by[t.status].push(t);
    else if (t.status === 'return_requested') secondary.push(t);
  }
  const cols = STATUSES.map(s => {
    const m = STATUS_META[s];
    const cards = by[s].map(turnCard).join('') || `<div class="col-empty">Nothing here</div>`;
    return `<div class="col" data-col="${s}">
      <div class="col-h"><span class="cdot" style="background:${m.color}"></span> ${m.label} <span class="n">${by[s].length}</span></div>
      ${cards}
    </div>`;
  }).join('');
  const sec = secondary.length ? `<div class="board-secondary">
    <div class="board-secondary-h">Returns / callbacks <span>${secondary.length}</span></div>
    <div class="board-secondary-row">${secondary.map(turnCard).join('')}</div>
  </div>` : '';
  board.innerHTML = cols;
  // secondary sits below board grid
  let wrap = document.getElementById('board-secondary-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'board-secondary-wrap';
    board.after(wrap);
  }
  wrap.innerHTML = sec;
  document.querySelectorAll('.ucard[data-turn]').forEach(el => {
    el.addEventListener('click', () => openTurn(el.dataset.turn));
  });
}

function renderUnits(){
  const byUnit = {};
  for (const t of state.turns) {
    if (!byUnit[t.unit_id] || t.status !== 'complete') byUnit[t.unit_id] = t;
  }
  document.getElementById('unit-grid').innerHTML = state.units.map(u => {
    const t = byUnit[u.id];
    const status = t ? t.status : 'received';
    const m = STATUS_META[status];
    const meta = t ? (t.notes || t.status_label) : 'No open turn';
    const tended = status === 'complete'
      ? `<span class="tended-badge" title="Tended by TendCo™"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>Tended</span>`
      : '';
    return `<div class="card unit-card" data-unit="${u.id}">
      ${tended}
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;padding-right:${status==='complete'?'78px':'0'}"><b>Unit ${esc(u.label)}</b><span class="pill ${m.pill}">${m.label}</span></div>
      <p style="font-size:12.5px;color:var(--muted);margin-top:6px">${esc([u.address,u.city].filter(Boolean).join(' · '))}</p>
      <p style="font-size:12px;margin-top:10px;color:var(--muted)">${esc(meta)}</p>
    </div>`;
  }).join('') || '<p style="color:var(--muted)">No units yet. Request a turn to add one.</p>';
  document.getElementById('unit-grid').querySelectorAll('[data-unit]').forEach(el => {
    el.addEventListener('click', () => {
      state.focusUnitId = el.dataset.unit;
      const t = state.turns.find(x => x.unit_id === el.dataset.unit && x.status !== 'complete')
        || state.turns.find(x => x.unit_id === el.dataset.unit);
      if (t) openTurn(t.id);
      else { location.hash = 'schedule'; loadSchedule(el.dataset.unit); }
    });
  });
}


/** Short whiteboard-style date: 10/26 */
function fmtBoardDate(iso){
  if (!iso) return '';
  try {
    const key = nyDateKey(iso);
    if (!key) return '';
    const [, m, d] = key.split('-');
    return String(Number(m)) + '/' + String(Number(d));
  } catch { return ''; }
}

function mrbMark(val, opts){
  opts = opts || {};
  if (val == null || val === '') {
    return '<span class="mrb-mark empty">—</span>';
  }
  const s = String(val).trim();
  const low = s.toLowerCase();
  if (opts.asPaint) {
    const pl = paintLabel(s);
    if (!pl) return '<span class="mrb-mark empty">—</span>';
    const done = isTruthyDone(s);
    return `<span class="mrb-mark ${done?'done':'date'}" title="Paint">${esc(pl)}</span>`;
  }
  if (['done','yes','y','✓','check','complete','completed','ok'].includes(low)) {
    return '<span class="mrb-mark done" title="Done">✓</span>';
  }
  if (['pending','todo','scheduled','in progress','in_progress'].includes(low)) {
    return `<span class="mrb-mark prog">${esc(s === 'in_progress' ? 'In progress' : s.charAt(0).toUpperCase() + s.slice(1))}</span>`;
  }
  // ISO / date-like
  if (/^\d{4}-\d{2}-\d{2}/.test(s) || opts.asDate) {
    const short = fmtBoardDate(s) || s;
    const cls = opts.mi ? 'mrb-mark mi' : 'mrb-mark date';
    return `<span class="${cls}">${esc(short)}</span>`;
  }
  if (opts.lock) {
    return `<span class="mrb-mark lock date">${esc(s)}</span>`;
  }
  // free text (repair / housekeeping label)
  if (isTruthyDone(s) && !opts.keepText) {
    // show label + soft done tint
    return `<span class="mrb-mark done" title="${esc(s)}">${esc(s.length > 18 ? s.slice(0,16)+'…' : s)}</span>`;
  }
  return `<span class="mrb-mark date">${esc(s.length > 20 ? s.slice(0,18)+'…' : s)}</span>`;
}

function mrbRowTone(t){
  if (t.status === 'complete') return 'done';
  if (t.status === 'punch' || t.status === 'return_requested') return 'attn';
  if (['scheduled','in_progress','received'].includes(t.status)) return 'go';
  return '';
}

function makeReadyBoardRows(){
  const rows = (state.turns || []).slice();
  rows.sort((a, b) => {
    const am = a.move_out_date || a.scheduled_date || a.created_at || '';
    const bm = b.move_out_date || b.scheduled_date || b.created_at || '';
    return String(am).localeCompare(String(bm)) || String(a.unit_label||'').localeCompare(String(b.unit_label||''));
  });
  return rows;
}

function renderMakeReadyBoard(){
  const body = document.getElementById('mrb-body');
  const empty = document.getElementById('mrb-empty');
  const thUnit = document.getElementById('mrb-th-unit');
  if (!body) return;
  const L = lex();
  if (thUnit) thUnit.textContent = L.Unit + ' #';
  const sub = document.getElementById('mrb-page-sub');
  if (sub) {
    sub.textContent = L.Unit_plural + ' in turn — paint, repair, housekeeping, locks, inspect, handoff to leasing';
  }
  const rows = makeReadyBoardRows();
  if (!rows.length) {
    body.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  body.innerHTML = rows.map(t => {
    const meta = STATUS_META[t.status] || STATUS_META.received;
    const statusLabel = t.status === 'complete' ? 'Tended' : (t.status_label || meta.label);
    const tech = assigneeOf(t) || t.owner_name || '';
    const repair = t.repair_replace || repairReplaceFromTrade(normalizeTradeId(t.trade)) || '';
    const tone = mrbRowTone(t);
    const tendedCls = t.status === 'complete' ? ' tended' : '';
    const paintCell = mrbMark(t.paint, { asPaint:true });
    const hk = t.housekeeping;
    let hkCell;
    if (!hk) hkCell = mrbMark('');
    else if (/^\d{4}-\d{2}-\d{2}/.test(String(hk))) hkCell = mrbMark(hk, { asDate:true });
    else hkCell = mrbMark(hk);
    const insp = t.inspected_at
      ? mrbMark(t.inspected_at, { asDate:true })
      : (t.status === 'complete' ? mrbMark('done') : mrbMark(''));
    const lock = t.change_lock
      ? (isTruthyDone(t.change_lock) && ['done','yes','y','✓'].includes(String(t.change_lock).toLowerCase())
          ? mrbMark('done')
          : mrbMark(t.change_lock, { lock:true }))
      : mrbMark('');
    return `<tr class="mrb-row${tendedCls}" data-turn="${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(L.Unit + ' ' + (t.unit_label||''))}">
      <td class="mrb-sticky"><span class="mrb-row-bar ${tone}"></span>${t.move_out_date ? esc(fmtBoardDate(t.move_out_date)) : '—'}</td>
      <td class="mrb-sticky2"><div class="mrb-unit"><b>${esc(t.unit_label || '—')}</b> ${mrwUrgencyChipHtml(t)}${t.address ? `<small>${esc(t.address)}</small>` : ''}</div></td>
      <td>${paintCell}</td>
      <td>${mrbMark(repair)}</td>
      <td>${hkCell}</td>
      <td>${lock}</td>
      <td>${insp}</td>
      <td>${t.move_in_date ? mrbMark(t.move_in_date, { asDate:true, mi:true }) : mrbMark('')}</td>
      <td><span class="mrb-tech${tech?'':' faint'}">${esc(tech || '—')}</span></td>
      <td><span class="pill ${meta.pill}">${esc(statusLabel)}</span></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('tr[data-turn]').forEach(tr => {
    const open = () => openTurn(tr.dataset.turn);
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
  try { renderRollingNotices(); } catch {}
}

function renderShareUnitSelect(){
  const sel = document.getElementById('share-unit');
  if (!sel) return;
  const L = lex();
  sel.innerHTML = state.units.map(u =>
    `<option value="${u.id}" ${u.id===state.focusUnitId?'selected':''}>${esc(L.Unit)} ${esc(u.label)}</option>`
  ).join('');
}

function isDemoMode(){
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('demo') === '1' || p.get('demo') === 'true') return true;
  } catch {}
  const email = (state.user && state.user.email) || '';
  return /oakridgepm\.example$/i.test(email) || /^alex@/i.test(email);
}

function nyParts(d){
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit', weekday:'short'
  }).formatToParts(d instanceof Date ? d : new Date(d));
  const get = t => (parts.find(p => p.type === t) || {}).value;
  return { y:get('year'), m:get('month'), d:get('day'), wd:get('weekday') };
}

function nyDateKey(input){
  if (!input) return '';
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  try {
    const p = nyParts(input);
    return `${p.y}-${p.m}-${p.d}`;
  } catch { return ''; }
}

function todayKeyNY(){
  return nyDateKey(new Date());
}

function parseKey(key){
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function addDaysKey(key, n){
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthLabel(cursor){
  return cursor.toLocaleDateString('en-US', { month:'long', year:'numeric', timeZone:'America/New_York' });
}

const DEMO_TEAM_ROSTER = ['Joe', 'Fred', 'Dennis', 'Ana', 'Maya'];
const ONCALL_SS_KEY = 'hub_oncall_by_saturday';

function loadOnCallMap(){
  try {
    const raw = sessionStorage.getItem(ONCALL_SS_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch {}
  return {};
}
function saveOnCallMap(map){
  try { sessionStorage.setItem(ONCALL_SS_KEY, JSON.stringify(map || {})); } catch {}
}

function ensureCalState(){
  if (!state.cal) state.cal = { cursor:null, mode:'month', selected:null, tab:'cal', items:[], onCallBySaturday:{} };
  if (!state.cal.onCallBySaturday) state.cal.onCallBySaturday = loadOnCallMap();
  if (!state.cal.cursor) {
    const t = todayKeyNY();
    state.cal.cursor = parseKey(t);
  }
  if (!state.cal.selected) state.cal.selected = todayKeyNY();
}

/** Seed onCallBySaturday from demo oncall items without overwriting supervisor picks. */
function ensureOnCallFromItems(items){
  ensureCalState();
  const map = state.cal.onCallBySaturday || (state.cal.onCallBySaturday = {});
  let changed = false;
  for (const it of items || []) {
    if (!(it.kind === 'oncall' || it.oncall)) continue;
    const key = it.dateKey;
    if (!key) continue;
    if (!map[key] && assigneeOf(it)) {
      map[key] = assigneeOf(it);
      changed = true;
    }
  }
  // Default demo Saturdays if empty
  if (!map['2026-10-31']) { map['2026-10-31'] = 'Joe'; changed = true; }
  if (!map['2026-11-07']) { map['2026-11-07'] = 'Fred'; changed = true; }
  if (changed) saveOnCallMap(map);
}

function openSetOnCall(dateKey){
  ensureCalState();
  const cur = (state.cal.onCallBySaturday || {})[dateKey] || '';
  const root = document.getElementById('oncall-modal');
  const bg = document.getElementById('oncall-modal-bg');
  const sel = document.getElementById('oncall-who');
  const dateEl = document.getElementById('oncall-date');
  if (!root || !sel) {
    // Fallback prompt if HTML not present
    const name = prompt('Saturday on-call (' + dateKey + ') — pick: ' + DEMO_TEAM_ROSTER.join(', '), cur || 'Joe');
    if (!name) return;
    state.cal.onCallBySaturday[dateKey] = name.trim();
    saveOnCallMap(state.cal.onCallBySaturday);
    toast(name.trim() + ' · on call ' + dateKey);
    renderCalendar();
    return;
  }
  if (dateEl) dateEl.textContent = dateKey;
  sel.innerHTML = DEMO_TEAM_ROSTER.map(n =>
    `<option value="${esc(n)}" ${n===cur?'selected':''}>${esc(n)}</option>`
  ).join('');
  root.dataset.date = dateKey;
  root.style.display = 'block';
  if (bg) bg.style.display = 'block';
}

function closeOnCallModal(){
  const root = document.getElementById('oncall-modal');
  const bg = document.getElementById('oncall-modal-bg');
  if (root) root.style.display = 'none';
  if (bg) bg.style.display = 'none';
}

function confirmOnCallModal(){
  const root = document.getElementById('oncall-modal');
  const sel = document.getElementById('oncall-who');
  if (!root || !sel) return;
  const dateKey = root.dataset.date;
  const name = sel.value || DEMO_TEAM_ROSTER[0];
  ensureCalState();
  state.cal.onCallBySaturday[dateKey] = name;
  saveOnCallMap(state.cal.onCallBySaturday);
  // Mirror into cal items if present
  const it = (state.cal.items || []).find(x => x.dateKey === dateKey && (x.kind === 'oncall' || x.oncall));
  if (it) { it.assignee = name; it.owner_name = name; it.subtitle = name + ' · Saturday on-call'; }
  closeOnCallModal();
  toast(name + ' · on call ' + dateKey);
  renderCalendar();
}

/** Completion logging — tech on site OR supervisor. */
function openLogComplete(turnId){
  const t = state.turns.find(x => x.id === turnId);
  if (!t) return;
  const root = document.getElementById('log-complete-modal');
  const bg = document.getElementById('log-complete-modal-bg');
  if (!root) { toast('Log complete UI missing'); return; }
  root.dataset.turnId = turnId;
  const roleTech = document.getElementById('lc-role-tech');
  const roleSup = document.getElementById('lc-role-sup');
  const notes = document.getElementById('lc-notes');
  const supWrap = document.getElementById('lc-sup-wrap');
  const supNotes = document.getElementById('lc-sup-notes');
  if (roleTech) roleTech.checked = true;
  if (roleSup) roleSup.checked = false;
  if (notes) notes.value = '';
  if (supNotes) supNotes.value = '';
  if (supWrap) supWrap.hidden = true;
  const who = document.getElementById('lc-who-hint');
  if (who) who.textContent = t.owner_name || t.assignee || t.vendor_name || 'On-site tech';
  root.style.display = 'block';
  if (bg) bg.style.display = 'block';
}

function closeLogComplete(){
  const root = document.getElementById('log-complete-modal');
  const bg = document.getElementById('log-complete-modal-bg');
  if (root) root.style.display = 'none';
  if (bg) bg.style.display = 'none';
}

function syncLogCompleteRoleUI(){
  const roleSup = document.getElementById('lc-role-sup');
  const supWrap = document.getElementById('lc-sup-wrap');
  if (supWrap) supWrap.hidden = !(roleSup && roleSup.checked);
}

async function confirmLogComplete(){
  const root = document.getElementById('log-complete-modal');
  if (!root) return;
  const turnId = root.dataset.turnId;
  const t = state.turns.find(x => x.id === turnId);
  if (!t) return;
  const isSup = !!(document.getElementById('lc-role-sup')?.checked);
  const notes = (document.getElementById('lc-notes')?.value || '').trim();
  const supNotes = (document.getElementById('lc-sup-notes')?.value || '').trim();
  const role = isSup ? 'supervisor' : 'tech';
  const byName = isSup ? 'Supervisor' : (t.owner_name || t.assignee || t.vendor_name || 'Tech');
  const wasComplete = t.status === 'complete';
  const isDemo = !!(t.demo || t._mrbDemo || isDemoMode());

  // Demo: allow log complete without photo proof. Real: keep existing photo gate.
  if (!isDemo && !t.has_photo_proof) {
    toast('Add before & after photos first');
    return;
  }

  const patch = {
    status: 'complete',
    completed_by_role: role,
    completed_by_name: byName,
  };
  if (isSup) {
    const merged = [t.supervisor_notes, supNotes || notes].filter(Boolean).join('\n').trim();
    patch.supervisor_notes = merged || (supNotes || notes || t.supervisor_notes || '');
  } else if (notes) {
    patch.notes = [t.notes, notes].filter(Boolean).join('\n').trim();
  }

  try {
    if (isDemo) {
      t.status = 'complete';
      t.status_label = 'Tended';
      t.pill = (STATUS_META.complete || {}).pill || 'g';
      t.completed_at = t.completed_at || new Date().toISOString();
      t.inspected_at = t.inspected_at || nyDateKey(new Date());
      t.handoff_at = t.handoff_at || new Date().toISOString();
      t.completed_by_role = role;
      t.completed_by_name = byName;
      if (isSup) t.supervisor_notes = patch.supervisor_notes;
      else if (notes) t.notes = patch.notes;
      if (!wasComplete) celebrateComplete(t);
      else toast('Updated · logged by ' + byName);
      closeLogComplete();
      renderMakeReadyBoard();
      openTurn(turnId);
      return;
    }
    await api('/turns/' + turnId, { method:'PATCH', body: JSON.stringify(patch) });
    if (!wasComplete) celebrateComplete(t);
    else toast('Logged complete · ' + byName);
    closeLogComplete();
    await refresh();
    openTurn(turnId);
  } catch (e) { toast(e.message); }
}

const TEAM_SETUP_FLAG = 'hub_team_setup_seen';
const TEAM_INVITE_URL = 'https://preview.tendcopm.pages.dev/portal/?invite=TEAM-DEMO';

function openTeamSetupModal(force){
  try {
    if (!force && sessionStorage.getItem(TEAM_SETUP_FLAG)) return;
  } catch {}
  const root = document.getElementById('team-setup-modal');
  const bg = document.getElementById('team-setup-modal-bg');
  if (!root) return;
  const link = document.getElementById('team-invite-link');
  if (link) link.textContent = TEAM_INVITE_URL;
  const roster = document.getElementById('team-roster-list');
  if (roster) roster.innerHTML = DEMO_TEAM_ROSTER.map(n => `<li>${esc(n)}</li>`).join('');
  root.style.display = 'block';
  if (bg) bg.style.display = 'block';
}

function dismissTeamSetup(markSeen){
  const root = document.getElementById('team-setup-modal');
  const bg = document.getElementById('team-setup-modal-bg');
  if (root) root.style.display = 'none';
  if (bg) bg.style.display = 'none';
  if (markSeen) {
    try { sessionStorage.setItem(TEAM_SETUP_FLAG, '1'); } catch {}
  }
}

async function copyTeamInvite(){
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(TEAM_INVITE_URL);
      toast('Invite link copied');
    } else {
      toast(TEAM_INVITE_URL);
    }
  } catch { toast(TEAM_INVITE_URL); }
}


function demoCalSeed(units){
  const L = lex();
  // Prefer a real unit labeled 214; else force demo unit 214 (TendCo drywall+paint story).
  const by214 = (units || []).find(u => String(u.label) === '214');
  const u0 = by214 || { id:(units[0] && units[0].id) || 'demo-u1', label:'214', address:'1842 Willow Creek Dr', city:'Winter Park' };
  const u1 = (units || []).find(u => u.id !== u0.id) || { id:'demo-u2', label:'108', address:'900 Lake Ave', city:'Altamonte Springs' };
  const u2 = (units || []).find(u => u.id !== u0.id && u.id !== u1.id) || u0;
  // Late Oct 2026 — TendCo crew: drywall + painting SAME day on 214; cleaning SEPARATE day.
  // Saturdays = on-call; Sundays stay empty (no work seeded on Sun).
  return [
    { id:'demo-t1', kind:'turn', dateKey:'2026-10-26', title: L.Unit + ' ' + u0.label + ' · Painting', subtitle:'Paint T/U · Joe · onsite', unit_id:u0.id, unit_label:u0.label, turn_id:null, tone:'turn', status:'scheduled', priority:'high', highPriority:true, trade:'painting', assignee:'Joe', owner_name:'Joe', demo:true },
    // Oct 27 (Tue): TendCo Painting + TendCo Punch/drywall on unit 214 — same crew, same day
    { id:'demo-e1', kind:'event', dateKey:'2026-10-27', title:'TendCo Painting', subtitle: L.Unit + ' ' + u0.label + ' · TendCo Painting · drywall+paint day', unit_id:u0.id, unit_label:u0.label, tone:'vendor', status:'confirmed', trade:'painting', vendor_type:'painting', assignee:'TendCo Painting', vendor_name:'TendCo Painting', owner_name:'TendCo Painting', demo:true },
    { id:'demo-t2', kind:'turn', dateKey:'2026-10-27', title: L.Unit + ' ' + u0.label + ' · Drywall', subtitle:'Drywall / punch · TendCo Punch · same crew', unit_id:u0.id, unit_label:u0.label, tone:'turn', status:'punch', trade:'drywall_repairs', assignee:'TendCo Punch', owner_name:'TendCo Punch', vendor_name:'TendCo Punch', demo:true, overlap:true },
    // Oct 28 (Wed): TendCo Cleaning on 214 — SEPARATE day from drywall/paint
    { id:'demo-e2', kind:'event', dateKey:'2026-10-28', title:'TendCo Cleaning', subtitle: L.Unit + ' ' + u0.label + ' · TendCo Cleaning · after punch', unit_id:u0.id, unit_label:u0.label, tone:'vendor', status:'confirmed', trade:'cleaning', vendor_type:'cleaning', assignee:'TendCo Cleaning', vendor_name:'TendCo Cleaning', owner_name:'TendCo Cleaning', demo:true },
    // Sunshine carpet on a different unit so 214 story stays clear
    { id:'demo-e2b', kind:'event', dateKey:'2026-10-28', title:'Carpet cleaning', subtitle: L.Unit + ' ' + u1.label + ' · Sunshine Carpet Cleaning · 1:00 – 3:00 PM', unit_id:u1.id, unit_label:u1.label, tone:'vendor', status:'confirmed', trade:'carpet_cleaning', vendor_type:'carpet_cleaning', assignee:'Sunshine Carpet Cleaning', vendor_name:'Sunshine Carpet Cleaning', demo:true },
    { id:'demo-e3', kind:'event', dateKey:'2026-10-29', title:'Pest control', subtitle: L.Unit + ' ' + u1.label + ' · BugFree Pest', unit_id:u1.id, unit_label:u1.label, tone:'vendor', status:'pending', priority:'urgent', highPriority:true, trade:'pest_control', vendor_type:'pest_control', assignee:'BugFree Pest', vendor_name:'BugFree Pest', demo:true },
    { id:'demo-e5', kind:'event', dateKey:'2026-10-29', title:'Plumbing', subtitle: L.Unit + ' ' + u1.label + ' · Joe · onsite (low severity)', unit_id:u1.id, unit_label:u1.label, tone:'tendco', status:'confirmed', trade:'plumbing', vendor_type:'plumbing', assignee:'Joe', vendor_name:'Joe', owner_name:'Joe', demo:true, overlap:true },
    { id:'demo-t3', kind:'turn', dateKey:'2026-10-30', title: L.Unit + ' ' + u1.label + ' · Cleaning', subtitle:'Cleaning · Ana · onsite', unit_id:u1.id, unit_label:u1.label, tone:'turn', status:'in_progress', trade:'cleaning', assignee:'Ana', owner_name:'Ana', demo:true },
    { id:'demo-e6', kind:'event', dateKey:'2026-10-30', title:'HVAC', subtitle: L.Unit + ' ' + u1.label + ' · Joe · onsite filter/check', unit_id:u1.id, unit_label:u1.label, tone:'tendco', status:'confirmed', trade:'hvac', vendor_type:'hvac', assignee:'Joe', vendor_name:'Joe', owner_name:'Joe', demo:true, overlap:true },
    // Sat 2026-10-31 — on-call (Joe); keep cancelled carpet on u1 for status demo
    { id:'demo-oncall-1031', kind:'oncall', dateKey:'2026-10-31', title:'On call', subtitle:'Joe · Saturday on-call', unit_id:null, unit_label:'', tone:'oncall', status:'oncall', trade:null, assignee:'Joe', owner_name:'Joe', demo:true, oncall:true },
    { id:'demo-e4', kind:'event', dateKey:'2026-10-31', title:'Carpet replacement', subtitle: L.Unit + ' ' + u1.label + ' · Floor Pro Carpet · cancelled', unit_id:u1.id, unit_label:u1.label, tone:'vendor', status:'cancelled', trade:'carpet_replacement', vendor_type:'carpet_replacement', assignee:'Floor Pro Carpet', vendor_name:'Floor Pro Carpet', demo:true },
    // Move inspected/complete off Saturday onto Fri so Sat stays on-call clean
    { id:'demo-t5', kind:'turn', dateKey:'2026-10-30', title: L.Unit + ' ' + u0.label, subtitle:'Inspected · Move In · Joe', unit_id:u0.id, unit_label:u0.label, tone:'turn', status:'complete', assignee:'Joe', owner_name:'Joe', paint:'touch_up', housekeeping:'done', change_lock:'done', inspected_at:'2026-10-30', move_out_date:'2026-10-22', move_in_date:'2026-11-01', rented:'no', handoff_at:'2026-10-30', trade:'maintenance', demo:true },
    // Mon Nov 2 (was Sun Nov 1 — Sundays stay empty)
    { id:'demo-e7', kind:'event', dateKey:'2026-11-02', title:'Electrical', subtitle: L.Unit + ' ' + (u2.label || '302') + ' · Coastal Electric · severity', unit_id:u2.id, unit_label:u2.label, tone:'vendor', status:'confirmed', trade:'electrical', vendor_type:'electrical', assignee:'Coastal Electric', vendor_name:'Coastal Electric', demo:true },
    { id:'demo-e8', kind:'event', dateKey:'2026-11-02', title:'Bathtub resurfacing', subtitle: L.Unit + ' ' + u0.label + ' · BathRenew', unit_id:u0.id, unit_label:u0.label, tone:'vendor', status:'confirmed', trade:'bathtub_resurfacing', vendor_type:'bathtub_resurfacing', assignee:'BathRenew', vendor_name:'BathRenew', demo:true },
    { id:'demo-e9', kind:'event', dateKey:'2026-11-03', title:'Counter tops resurfacing', subtitle: L.Unit + ' ' + u1.label + ' · SurfacePro', unit_id:u1.id, unit_label:u1.label, tone:'vendor', status:'pending', trade:'countertops_resurfacing', vendor_type:'countertops_resurfacing', assignee:'SurfacePro', vendor_name:'SurfacePro', demo:true },
    { id:'demo-t4', kind:'turn', dateKey:'2026-11-02', title: L.Unit + ' ' + (u2.label || '302') + ' · Maintenance', subtitle:'Pre-MO inspect · Maya · onsite', unit_id:u2.id, unit_label:u2.label, tone:'turn', status:'scheduled', trade:'maintenance', assignee:'Maya', owner_name:'Maya', demo:true },
    // Next Saturday on-call seed (2026-11-07) — Fred
    { id:'demo-oncall-1107', kind:'oncall', dateKey:'2026-11-07', title:'On call', subtitle:'Fred · Saturday on-call', unit_id:null, unit_label:'', tone:'oncall', status:'oncall', trade:null, assignee:'Fred', owner_name:'Fred', demo:true, oncall:true },
    // Fire inspection week locks come from Viewing expand (Nov 11 + 5-day block).
    // Keep a seed fallback only when Viewing fire week_block is absent (deduped in buildCalItems).
    ...demoFireLockDays('2026-11-10', 5),
  ];
}

function demoFireLockDays(startKey, nDays){
  const out = [];
  for (let i = 0; i < nDays; i++) {
    const key = addDaysKey(startKey, i);
    out.push({
      id: 'demo-fire-lock-' + key,
      kind: 'lock',
      dateKey: key,
      title: 'Fire inspection',
      subtitle: 'Calendar locked · units entered · team busy',
      unit_id: null,
      unit_label: '',
      tone: 'lock',
      status: 'locked',
      trade: 'fire_inspection',
      assignee: '',
      vendor_name: null,
      owner_name: null,
      demo: true,
      calendarLock: true,
      lockSpan: { start: startKey, days: nDays, label: 'Fire inspection week' },
    });
  }
  return out;
}

function isCalLockedDay(key){
  return (state.cal.items || []).some(it => it.dateKey === key && (it.calendarLock || it.kind === 'lock'));
}

function locksForDay(key){
  return (state.cal.items || []).filter(it => it.dateKey === key && (it.calendarLock || it.kind === 'lock'));
}


function buildCalItems(){
  const L = lex();
  const items = [];
  for (const t of state.turns || []) {
    if (!t.scheduled_date) continue;
    const dateKey = nyDateKey(t.scheduled_date);
    if (!dateKey) continue;
    const meta = STATUS_META[t.status] || STATUS_META.scheduled;
    const priority = t.priority ?? t.urgency ?? null;
    const assignee = t.owner_name || t.vendor_name || t.assignee || null;
    const tradeId = normalizeTradeId(t.trade) || (t.paint ? 'painting' : '') || (t.housekeeping ? 'cleaning' : '');
    const tradeTxt = tradeLabel(tradeId || t.trade);
    items.push({
      id: 'turn-' + t.id,
      kind: 'turn',
      dateKey,
      title: tradeTxt ? `${L.Unit} ${t.unit_label} · ${tradeTxt}` : `${L.Unit} ${t.unit_label}`,
      subtitle: [assignee, tradeTxt || meta.label, t.address].filter(Boolean).join(' · '),
      unit_id: t.unit_id,
      unit_label: t.unit_label,
      turn_id: t.id,
      tone: 'turn',
      status: t.status,
      priority,
      highPriority: isHighPriority(priority),
      trade: tradeId || t.trade || null,
      assignee,
      owner_name: t.owner_name || null,
      vendor_name: t.vendor_name || null,
    });
  }
  for (const e of state.events || []) {
    if (!e.starts_at) continue;
    const dateKey = nyDateKey(e.starts_at);
    if (!dateKey) continue;
    const tone = e.vendor_type === 'tendco' ? 'tendco' : 'vendor';
    const timeBit = (() => {
      try {
        return new Date(e.starts_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'America/New_York' });
      } catch { return ''; }
    })();
    const priority = e.priority ?? e.urgency ?? null;
    const assignee = e.vendor_name || e.owner_name || e.assignee || null;
    const tradeId = normalizeTradeId(e.trade || e.vendor_type);
    const tradeTxt = tradeLabel(tradeId || e.trade || e.vendor_type);
    const titleBase = tradeTxt || e.title || e.vendor_name || 'Visit';
    items.push({
      id: 'ev-' + e.id,
      kind: 'event',
      dateKey,
      title: titleBase,
      subtitle: [assignee, timeBit, e.unit_label ? (L.Unit + ' ' + e.unit_label) : '', tradeTxt && tradeTxt !== titleBase ? tradeTxt : ''].filter(Boolean).join(' · '),
      unit_id: e.unit_id,
      unit_label: e.unit_label,
      event_id: e.id,
      tone,
      status: e.status,
      priority,
      highPriority: isHighPriority(priority),
      trade: tradeId || null,
      assignee,
      vendor_name: e.vendor_name || null,
      owner_name: e.owner_name || null,
    });
  }

  // Confirmed / pending services from make-ready pipeline (not work orders)
  for (const t of state.turns || []) {
    const services = parseTurnServices(t);
    const urgent = mrwIsUrgent(t);
    // Apply pest pause for calendar exclusion
    const pestGate = mrwPestGateActive({
      ...t, services,
      pest_infestation: t.pest_infestation,
      pest_wait_days: t.pest_wait_days,
      pest_cleared: t.pest_cleared,
    });
    for (const s of services) {
      if (!s.vendor && s.confirm !== 'confirmed') continue;
      const paused = !!s.paused_pest || (pestGate && mrwKind(s) !== 'pest');
      // Exclude paused (non-pest) from active calendar placement
      if (paused) continue;
      const dateKey = nyDateKey(s.scheduled_date || (s.confirm === 'confirmed' ? t.move_out_date : '') || t.move_out_date);
      if (!dateKey) continue;
      const confirmed = s.confirm === 'confirmed';
      items.push({
        id: 'svc-' + t.id + '-' + s.id,
        kind: 'event',
        dateKey,
        title: s.label || tradeLabel(s.trade),
        subtitle: [s.vendor, confirmed ? 'Confirmed' : 'Pending confirm', t.unit_label ? (L.Unit + ' ' + t.unit_label) : '', urgent ? 'Urgent' : ''].filter(Boolean).join(' · '),
        unit_id: t.unit_id,
        unit_label: t.unit_label,
        turn_id: t.id,
        service_id: s.id,
        tone: confirmed ? 'vendor' : 'vendor',
        status: confirmed ? 'scheduled' : 'pending',
        trade: s.trade,
        assignee: s.vendor,
        vendor_name: s.vendor,
        owner_name: s.vendor,
        demo: !!t.demo,
        priority: urgent ? 'urgent' : null,
        highPriority: urgent,
        urgent,
        flexible: mrwIsFlexible(t),
      });
    }
  }

  // create16 — common-area + viewing-only lanes (never enter mrwApplyDateSpread)
  ensurePropertySchedule();
  const laneFrom = '2026-10-01';
  const laneTo = '2027-01-31';
  for (const it of expandLaneItems(laneFrom, laneTo)) items.push(it);

  // Mark same-unit same-day overlaps (unit make-ready only — skip common/viewing)
  const byDayUnit = {};
  for (const it of items) {
    if (it.lane === 'common' || it.lane === 'viewing' || it.kind === 'common' || it.kind === 'viewing') continue;
    if (!it.unit_id) continue;
    const k = it.dateKey + '|' + it.unit_id;
    byDayUnit[k] = (byDayUnit[k] || 0) + 1;
  }
  for (const it of items) {
    if (it.lane === 'common' || it.lane === 'viewing' || it.kind === 'common' || it.kind === 'viewing') continue;
    if (!it.unit_id) continue;
    const k = it.dateKey + '|' + it.unit_id;
    if (byDayUnit[k] > 1) it.overlap = true;
  }

  // Demo seed if empty in late-Oct window (unit work only — keep lane items)
  const hasReal = items.some(it =>
    it.dateKey >= '2026-10-01' && it.dateKey <= '2026-11-15' &&
    it.kind !== 'common' && it.kind !== 'viewing' && it.lane !== 'common' && it.lane !== 'viewing'
  );
  if (!hasReal && isDemoMode()) {
    const seeded = demoCalSeed(state.units || []);
    const map = {};
    for (const it of seeded) {
      if (!it.unit_id) continue;
      const k = it.dateKey + '|' + it.unit_id;
      map[k] = (map[k] || 0) + 1;
    }
    for (const it of seeded) {
      if (it.unit_id && map[it.dateKey + '|' + it.unit_id] > 1) it.overlap = true;
    }
    const lanes = expandLaneItems(laneFrom, laneTo);
    return dedupeFireLocks(seeded.concat(lanes)).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || String(a.title||'').localeCompare(String(b.title||'')));
  }
  return dedupeFireLocks(items).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || String(a.title||'').localeCompare(String(b.title||'')));
}
/** Prefer Viewing-lane fire week locks over demo seed locks on the same date. */
function dedupeFireLocks(list){
  const items = list || [];
  const viewingLockDays = new Set(
    items.filter(it => (it.calendarLock || it.kind === 'lock') && it.trade === 'fire_inspection' && (it.lane === 'viewing' || it.viewing))
      .map(it => it.dateKey)
  );
  if (!viewingLockDays.size) return items;
  return items.filter(it => {
    if (!(it.calendarLock || it.kind === 'lock')) return true;
    if (it.trade !== 'fire_inspection') return true;
    if (it.lane === 'viewing' || it.viewing) return true;
    // Drop demo seed lock when Viewing already covers the day
    return !viewingLockDays.has(it.dateKey);
  });
}

function itemsForDay(key){
  return (state.cal.items || []).filter(it => it.dateKey === key);
}

function openCalItem(it){
  if (!it) return;
  if (it.calendarLock || it.kind === 'lock') {
    selectCalDay(it.dateKey);
    const span = it.lockSpan;
    toast(span
      ? (tradeLabel(it.trade) || 'Fire inspection') + ' · locked ' + span.days + ' days (team busy)'
      : (tradeLabel(it.trade) || 'Calendar') + ' · day locked — team busy');
    // Proactive Viewing nudge pointer — full comments live in Tendy
    if ((it.trade === 'fire_inspection' || /fire/i.test(it.title || '')) && typeof window.__tendyFireNudge === 'function') {
      try { window.__tendyFireNudge({ proactive: true, dateKey: it.dateKey }); } catch {}
    }
    return;
  }
  if (it.kind === 'oncall' || it.oncall) {
    selectCalDay(it.dateKey);
    toast((assigneeOf(it) || 'Team') + ' · on call ' + (it.dateKey || ''));
    return;
  }
  if (it.kind === 'viewing' || it.lane === 'viewing' || it.viewing) {
    selectCalDay(it.dateKey);
    state.caTab = 'viewing';
    toast('Viewing · ' + (it.title || 'Reminder') + ' — tracking only, no vendor');
    return;
  }
  if (it.kind === 'common' || it.lane === 'common') {
    selectCalDay(it.dateKey);
    if (it.common_id) openCaModal(it.common_id);
    else toast((it.title || 'Common area') + ' · recurring property job');
    return;
  }
  if (it.turn_id) {
    openTurn(it.turn_id);
    if (it.service_id) setTimeout(() => openTurnService(it.turn_id, it.service_id), 40);
    return;
  }
  if (it.unit_id) {
    state.focusUnitId = it.unit_id;
    const t = state.turns.find(x => x.unit_id === it.unit_id && x.status !== 'complete' && x.status !== 'cancelled')
      || state.turns.find(x => x.unit_id === it.unit_id);
    if (t) {
      openTurn(t.id);
      if (it.service_id) setTimeout(() => openTurnService(t.id, it.service_id), 40);
      else if (it.trade) {
        const svcs = parseTurnServices(t);
        const hit = svcs.find(s => normalizeTradeId(s.trade) === normalizeTradeId(it.trade));
        if (hit) setTimeout(() => openTurnService(t.id, hit.id), 40);
      }
      return;
    }
  }
  // create20: also match by unit_label (demo seed unit_ids often diverge from whiteboard)
  if (it.unit_label) {
    const t = findTurnByUnitRef(it.unit_label);
    if (t) {
      openTurn(t.id);
      if (it.service_id) setTimeout(() => openTurnService(t.id, it.service_id), 40);
      else if (it.trade) {
        const svcs = parseTurnServices(t);
        const hit = svcs.find(s => normalizeTradeId(s.trade) === normalizeTradeId(it.trade));
        if (hit) setTimeout(() => openTurnService(t.id, hit.id), 40);
      }
      return;
    }
  }
  // Fall back: show day panel + toast
  selectCalDay(it.dateKey);
  toast(it.title);
}

function selectCalDay(key, opts){
  ensureCalState();
  const o = opts || {};
  state.cal.selected = key;
  // From month (or when asked): jump into the real Day schedule view for that date
  if (o.toDay || state.cal.mode === 'month') {
    state.cal.mode = 'day';
    try { state.cal.cursor = parseKey(key); } catch { state.cal.cursor = new Date(); }
    renderCalendar();
    return;
  }
  renderCalDayPanel();
  document.querySelectorAll('.cal-cell').forEach(el => {
    el.classList.toggle('selected', el.dataset.date === key);
  });
}

function renderCalDayPanel(){
  const L = lex();
  const key = state.cal.selected || todayKeyNY();
  const dayItems = itemsForDay(key);
  const d = parseKey(key);
  const titleEl = document.getElementById('cal-day-title');
  const subEl = document.getElementById('cal-day-sub');
  const list = document.getElementById('cal-day-list');
  const closeBtn = document.getElementById('cal-day-close');
  if (!titleEl || !list) return;
  titleEl.textContent = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  const overlapCount = dayItems.filter(x => x.overlap).length;
  const lockCount = dayItems.filter(x => x.calendarLock || x.kind === 'lock').length;
  subEl.textContent = dayItems.length
    ? (dayItems.length + ' on this day'
        + (lockCount ? ' · calendar locked (fire)' : '')
        + (overlapCount ? ' · overlap on a ' + L.unit : ''))
    : 'Nothing on this day yet';
  if (closeBtn) closeBtn.hidden = false;

  if (!dayItems.length) {
    list.innerHTML = `<div class="cal-empty">Nothing scheduled.<br><span style="color:var(--faint)">Open a turn on the board, or share a vendor link.</span></div>`;
    return;
  }
  list.innerHTML = dayItems.map(it => {
    const st = calStatusClass(it);
    const statusLabel = calStatusLabel(it);
    const who = assigneeOf(it);
    const isLock = !!(it.calendarLock || it.kind === 'lock');
    const isOncall = !!(it.kind === 'oncall' || it.oncall);
    const head = isLock
      ? (tradeLabel(it.trade) || it.title || 'Busy')
      : (isOncall ? calChipLabel(it, { long:true }) : calChipLabel(it, { long:true }));
    const tradeTxt = (isLock || isOncall) ? '' : tradeLabel(it.trade);
    const subBits = [who ? it.title : '', tradeTxt && (!it.title || !String(it.title).includes(tradeTxt)) ? tradeTxt : '', it.subtitle || ''].filter(Boolean).join(' · ');
    const chip = tradeTxt ? `<span class="trade-chip sm">${esc(UNIT_TRADE_BY_ID[normalizeTradeId(it.trade)]?.short || tradeTxt)}</span>` : '';
    return `
    <button type="button" class="cal-item ${st}" data-cal-id="${esc(it.id)}">
      <div class="when">${esc(it.dateKey.slice(5).replace('-','/'))}${it.demo ? '<small>Sample</small>' : (statusLabel ? '<small>' + esc(statusLabel) + '</small>' : '')}</div>
      <div class="what">
        <b>${esc(head)}${priBadgeHtml(it, false)}</b>
        <span>${esc(subBits)}</span>
        ${chip}
      </div>
      <div class="cal-item-actions">
        ${it.overlap ? '<span class="cal-overlap">Overlap</span>' : ''}
        <span class="pill ${st === 'st-done' ? 'g' : st === 'st-attn' ? 'a' : st === 'st-cancel' ? 'n' : 'b'}">${esc(statusLabel || 'Scheduled')}</span>
      </div>
    </button>`;
  }).join('');
  list.querySelectorAll('[data-cal-id]').forEach(btn => {
    btn.onclick = () => {
      const it = state.cal.items.find(x => x.id === btn.dataset.calId);
      openCalItem(it);
    };
  });
}


/** Urgent units that still need a given trade (for cross-unit reassign). */
function urgentUnitsNeedingTrade(tradeId, excludeTurnId){
  const want = normalizeTradeId(tradeId);
  if (!want) return [];
  return (state.turns || []).filter(t => {
    if (!mrwIsUrgent(t)) return false;
    if (t.status === 'complete' || t.status === 'cancelled') return false;
    if (excludeTurnId && t.id === excludeTurnId) return false;
    const svcs = parseTurnServices(t);
    // Needs trade if missing OR present but pending/unscheduled
    const hit = svcs.find(s => normalizeTradeId(s.trade) === want || mrwKind(s) === mrwKind({ trade: want }));
    if (!hit) return true;
    if (hit.confirm !== 'confirmed' || !hit.scheduled_date || hit.paused_pest) return true;
    // Already has scheduled confirmed — still allow if status pending-ish
    return false;
  });
}

function reassignServiceToUrgent(srcTurnId, serviceId, destTurnId){
  const src = (state.turns || []).find(t => t.id === srcTurnId);
  const dest = (state.turns || []).find(t => t.id === destTurnId);
  if (!src || !dest) { toast('Unit not found'); return false; }
  if (!mrwIsFlexible(src)) { toast('Only pull from flexible units (no move-in)'); return false; }
  if (!mrwIsUrgent(dest)) { toast('Destination must be urgent (has move-in)'); return false; }
  let srcSvcs = parseTurnServices(src);
  if (!srcSvcs.length) srcSvcs = src.services || [];
  const idx = srcSvcs.findIndex(s => String(s.id) === String(serviceId));
  if (idx < 0) { toast('Service not found on source'); return false; }
  const svc = { ...srcSvcs[idx] };
  // Destination gets service/date
  let destSvcs = parseTurnServices(dest);
  if (!destSvcs.length) destSvcs = (dest.services || []).slice();
  const existing = destSvcs.findIndex(s => normalizeTradeId(s.trade) === normalizeTradeId(svc.trade));
  const incoming = {
    ...svc,
    id: svc.id + '-re-' + Date.now().toString(36),
    confirm: svc.confirm || 'confirmed',
    confirm_via: svc.confirm_via || 'call',
    hint: (svc.hint || '') + (svc.hint ? ' · ' : '') + 'Pulled from ' + (src.unit_label || 'flexible unit'),
    paused_pest: false,
  };
  if (existing >= 0) destSvcs[existing] = { ...destSvcs[existing], ...incoming, id: destSvcs[existing].id };
  else destSvcs.push(incoming);
  dest.services = destSvcs;
  // Source becomes pending unscheduled
  srcSvcs[idx] = {
    ...srcSvcs[idx],
    confirm: 'pending',
    confirm_via: '',
    scheduled_date: '',
    scheduled_end: '',
    day_part: '',
    hint: 'Reassigned — no move-in deadline',
    note: 'Reassigned — no move-in deadline',
  };
  src.services = srcSvcs;
  toast('Priority: moved ' + (svc.label || tradeLabel(svc.trade)) + ' → urgent ' + (dest.unit_label || '') + ' · source pending');
  try { renderCalendar(); } catch {}
  try { renderMakeReadyBoard(); } catch {}
  try { renderBoard(); } catch {}
  return true;
}

function openMoveToUrgentMenu(it, clientX, clientY){
  document.getElementById('cal-move-menu')?.remove();
  if (!it || !it.turn_id || !it.flexible) return;
  const targets = urgentUnitsNeedingTrade(it.trade, it.turn_id);
  if (!targets.length) {
    toast('No urgent units need ' + (tradeLabel(it.trade) || 'that trade'));
    return;
  }
  const menu = document.createElement('div');
  menu.id = 'cal-move-menu';
  menu.className = 'cal-move-menu';
  menu.innerHTML = `<div class="cal-move-h">Move to urgent unit…</div>
    <div class="cal-move-hint">Pull from flexible (no MI) → urgent (has MI)</div>
    ${targets.map(t => `<button type="button" data-dest="${esc(t.id)}">${esc(t.unit_label || t.id)} · MI ${esc(fmtDate(t.move_in_date))}</button>`).join('')}`;
  document.body.appendChild(menu);
  const x = Math.min(clientX, window.innerWidth - 220);
  const y = Math.min(clientY, window.innerHeight - 40 - targets.length * 36);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.querySelectorAll('[data-dest]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      reassignServiceToUrgent(it.turn_id, it.service_id, btn.dataset.dest);
      menu.remove();
    });
  });
  const closer = (ev) => {
    if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', closer); }
  };
  setTimeout(() => document.addEventListener('mousedown', closer), 0);
}

function renderCalendar(){
  ensureCalState();
  const grid = document.getElementById('cal-grid');
  const weekdays = document.getElementById('cal-weekdays');
  const title = document.getElementById('cal-title');
  const panel = document.getElementById('sched-cal-panel');
  if (!grid || !title) return;

  state.cal.items = buildCalItems();
  const mode = state.cal.mode || 'month';

  const cursor = state.cal.cursor;
  const today = todayKeyNY();
  const selected = state.cal.selected || today;

  // Weekday headers Sun–Sat
  if (weekdays) {
    weekdays.innerHTML = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      .map(d => `<div>${d}</div>`).join('');
  }

  let startKey, days;
  if (panel) {
    panel.classList.toggle('cal-mode-week', mode === 'week');
    panel.classList.toggle('cal-mode-day', mode === 'day');
  }
  if (mode === 'day') {
    startKey = selected || today;
    days = 1;
    const d0 = parseKey(startKey);
    title.textContent = d0.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  } else if (mode === 'week') {
    const sel = selected;
    const selDate = parseKey(sel);
    const sunOffset = selDate.getDay();
    startKey = addDaysKey(sel, -sunOffset);
    days = 7;
    const end = addDaysKey(startKey, 6);
    title.textContent = parseKey(startKey).toLocaleDateString('en-US', { month:'short', day:'numeric' })
      + ' – ' + parseKey(end).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  } else {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    title.textContent = monthLabel(cursor);
    const first = new Date(y, m, 1, 12, 0, 0);
    const startPad = first.getDay(); // Sun=0
    const start = new Date(y, m, 1 - startPad, 12, 0, 0);
    const y0 = start.getFullYear();
    const m0 = String(start.getMonth() + 1).padStart(2, '0');
    const d0 = String(start.getDate()).padStart(2, '0');
    startKey = `${y0}-${m0}-${d0}`;
    days = 42;
  }

  const monthNum = cursor.getMonth();
  // Ensure demo on-call seeds land in onCallBySaturday map (supervisor can override)
  ensureOnCallFromItems(state.cal.items || []);
  let html = '';
  for (let i = 0; i < days; i++) {
    const key = addDaysKey(startKey, i);
    const d = parseKey(key);
    const dowNum = d.getDay(); // 0=Sun … 6=Sat
    const inMonth = d.getMonth() === monthNum;
    let dayItems = itemsForDay(key).slice();
    // Week view: Sundays empty (off); Saturdays emphasize on-call
    if (mode === 'week' && dowNum === 0) {
      dayItems = []; // strip Sunday work from week display
    }
    // Inject / prefer on-call chip for Saturdays from map
    if (dowNum === 6) {
      const onName = (state.cal.onCallBySaturday || {})[key];
      if (onName) {
        const existing = dayItems.find(x => x.kind === 'oncall' || x.oncall);
        if (existing) {
          existing.assignee = onName;
          existing.owner_name = onName;
          existing.title = 'On call';
        } else {
          dayItems.unshift({
            id: 'oncall-' + key,
            kind: 'oncall',
            dateKey: key,
            title: 'On call',
            subtitle: onName + ' · Saturday on-call',
            unit_label: '',
            tone: 'oncall',
            status: 'oncall',
            assignee: onName,
            owner_name: onName,
            oncall: true,
            demo: true,
          });
        }
      }
    }
    const hasOverlap = dayItems.some(x => x.overlap);
    const show = dayItems.slice(0, mode === 'day' ? 50 : (mode === 'week' ? 6 : 3));
    const more = dayItems.length - show.length;
    const dow = d.toLocaleDateString('en-US', { weekday:'short' });
    // Surface fire/week locks first so month view (max 3 chips) still shows the week block
    dayItems.sort((a, b) => {
      const al = (a.calendarLock || a.kind === 'lock') ? 0 : 1;
      const bl = (b.calendarLock || b.kind === 'lock') ? 0 : 1;
      if (al !== bl) return al - bl;
      const av = (a.kind === 'viewing' || a.lane === 'viewing') ? 0 : 1;
      const bv = (b.kind === 'viewing' || b.lane === 'viewing') ? 0 : 1;
      return av - bv;
    });
    const dayLocks = dayItems.filter(x => x.calendarLock || x.kind === 'lock');
    const isLocked = dayLocks.length > 0;
    const isSunOff = mode === 'week' && dowNum === 0;
    const isSat = dowNum === 6;
    if (mode === 'day' && !dayItems.length) {
      html += `<div class="cal-cell today selected has-items" data-date="${key}" role="gridcell">
        <div class="num"><span>${d.getDate()}</span><span class="dow-m">${dow}</span></div>
        <div class="cal-day-empty">Nothing on this day yet.<br><span style="color:var(--faint)">Open a turn or confirm a vendor.</span></div>
      </div>`;
      continue;
    }
    if (isSunOff) {
      html += `<button type="button" class="cal-cell cal-sun-off${inMonth || mode==='week' ? '' : ' out'}${key===today?' today':''}${key===selected?' selected':''}" data-date="${key}" role="gridcell" aria-label="${key} · Sunday off">
        <div class="num"><span>${d.getDate()}</span><span class="dow-m">${dow}</span></div>
        <div class="cal-sun-empty">Sunday — off</div>
      </button>`;
      continue;
    }
    const satCtrl = (mode === 'week' && isSat)
      ? `<button type="button" class="cal-oncall-set" data-oncall-date="${key}">Set Saturday on-call</button>`
      : '';
    html += `<button type="button" class="cal-cell${inMonth || mode==='week' || mode==='day' ? '' : ' out'}${key===today?' today':''}${key===selected?' selected':''}${dayItems.length?' has-items':''}${isLocked?' locked':''}${isSat && mode==='week'?' cal-sat':''}" data-date="${key}" role="gridcell" aria-label="${key}${isLocked?' · calendar locked':''}">
      <div class="num"><span>${d.getDate()}</span><span class="dow-m">${dow}</span>${isLocked ? '<span class="cal-lock-tag" title="Fire inspection — team busy">Busy</span>' : (hasOverlap ? '<span class="cal-overlap">!</span>' : '')}</div>
      <div class="chips">
        ${show.map(it => {
          const st = calStatusClass(it);
          const label = mode === 'day'
            ? (it.kind === 'oncall' || it.oncall
                ? calChipLabel(it, { long:true })
                : [calChipLabel(it, { long:true }), tradeLabel(it.trade), calStatusLabel(it)].filter(Boolean).join(' · '))
            : calChipLabel(it);
          const who = assigneeOf(it);
          const unitBit = it.unit_label ? ('unit ' + it.unit_label) : '';
          const tip = it.kind === 'oncall' || it.oncall
            ? [who, 'on call', it.dateKey].filter(Boolean).join(' · ')
            : (it.kind === 'viewing' || it.lane === 'viewing' || it.viewing)
              ? ['Viewing', it.title, it.subtitle, 'No vendor · no approval'].filter(Boolean).join(' · ')
              : (it.kind === 'common' || it.lane === 'common')
                ? ['Common area', it.title, who, it.time_window, 'Recurring · not unit make-ready'].filter(Boolean).join(' · ')
                : [who || it.title, unitBit, tradeLabel(it.trade), calStatusLabel(it), it.highPriority ? 'High priority' : '', it.overlap ? 'Overlap' : '', it.calendarLock ? 'Calendar locked' : ''].filter(Boolean).join(' · ');
          const flexCls = it.flexible ? ' flex-src' : '';
          const tip2 = tip + (it.flexible ? ' · Right-click: Move to urgent unit…' : '');
          const laneCls = (it.kind==='viewing'||it.lane==='viewing'||it.viewing) ? ' lane-vw' : ((it.kind==='common'||it.lane==='common') ? ' lane-ca' : ' lane-mr');
          const vwBadge = (it.kind==='viewing'||it.lane==='viewing'||it.viewing) ? '<span class="cal-vw-tag">Viewing</span>' : '';
          return `<span class="cal-chip ${st}${laneCls}${it.demo?' demo':''}${it.highPriority||it.urgent?' has-pri':''}${it.calendarLock?' lock':''}${it.kind==='oncall'||it.oncall?' oncall':''}${flexCls}" data-cal-id="${esc(it.id)}" title="${esc(tip2)}">${priBadgeHtml(it, true)}${vwBadge}<span class="cal-chip-txt">${esc(label)}</span></span>`;
        }).join('')}
        ${more > 0 ? `<span class="cal-more">+${more} more</span>` : ''}
        ${satCtrl}
      </div>
    </button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-cell').forEach(cell => {
    cell.addEventListener('click', (ev) => {
      const setBtn = ev.target.closest('[data-oncall-date]');
      if (setBtn) {
        ev.stopPropagation();
        openSetOnCall(setBtn.dataset.oncallDate);
        return;
      }
      const chip = ev.target.closest('[data-cal-id]');
      if (chip) {
        ev.stopPropagation();
        const it = (state.cal.items || []).find(x => x.id === chip.dataset.calId)
          || { id: chip.dataset.calId, kind:'oncall', dateKey: cell.dataset.date, oncall:true,
               assignee: (state.cal.onCallBySaturday||{})[cell.dataset.date] };
        if (it) { openCalItem(it); return; }
      }
      selectCalDay(cell.dataset.date);
    });
  });
  // Cross-unit reassign: right-click flexible chip → Move to urgent unit…
  grid.querySelectorAll('.cal-chip[data-cal-id]').forEach(chip => {
    chip.addEventListener('contextmenu', (ev) => {
      const it = (state.cal.items || []).find(x => x.id === chip.dataset.calId);
      if (!it || !it.flexible || !it.turn_id || !it.trade) return;
      ev.preventDefault();
      ev.stopPropagation();
      openMoveToUrgentMenu(it, ev.clientX, ev.clientY);
    });
  });

  document.querySelectorAll('[data-cal-mode]').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.calMode === mode);
  });

  renderCalDayPanel();
}

function setSchedTab(tab){
  ensureCalState();
  state.cal.tab = tab;
  const cal = document.getElementById('sched-cal-panel');
  const list = document.getElementById('sched-list-panel');
  if (cal) cal.classList.toggle('hidden', tab !== 'cal');
  if (list) list.classList.toggle('hidden', tab !== 'list');
  document.querySelectorAll('[data-sched-tab]').forEach(b => b.classList.toggle('on', b.dataset.schedTab === tab));
}

async function loadSchedule(unitId){
  ensureCalState();
  if (unitId) state.focusUnitId = unitId;
  // Calendar wants all events; list can filter
  const filterId = document.getElementById('sched-unit-filter')?.value || '';
  const listUnit = filterId || state.focusUnitId || '';
  const q = ''; // always fetch all for calendar
  const data = await api('/schedule' + q);
  state.events = data.events || [];

  const L = lex();
  const pageTitle = document.getElementById('sched-page-title');
  const pageSub = document.getElementById('sched-page-sub');
  if (pageTitle) pageTitle.textContent = 'Schedule';
  if (pageSub) pageSub.textContent = `${L.Unit_plural} + vendor visits — by date`;

  // Unit filter select
  const filt = document.getElementById('sched-unit-filter');
  if (filt) {
    const cur = filt.value;
    filt.innerHTML = `<option value="">All ${esc(L.unit_plural)}</option>` +
      state.units.map(u => `<option value="${u.id}">${esc(L.Unit)} ${esc(u.label)}</option>`).join('');
    if (cur && [...filt.options].some(o => o.value === cur)) filt.value = cur;
    else if (state.focusUnitId) filt.value = state.focusUnitId;
  }

  const u = state.units.find(x => x.id === (filt?.value || state.focusUnitId));
  const titleEl = document.getElementById('sched-unit-title');
  const subEl = document.getElementById('sched-unit-sub');
  if (titleEl) titleEl.textContent = u ? (`${L.Unit} ${u.label}` + (u.address ? ' · ' + u.address : '')) : `All ${L.unit_plural}`;
  if (subEl) subEl.textContent = u ? ([u.city, 'Upcoming'].filter(Boolean).join(' · ')) : 'Upcoming visits';

  const listEvents = (filt?.value)
    ? state.events.filter(e => e.unit_id === filt.value)
    : state.events;
  const listEl = document.getElementById('sched-list');
  if (listEl) {
    listEl.innerHTML = listEvents.map(e => `
      <div class="sched-row" data-unit="${esc(e.unit_id||'')}" style="cursor:pointer">
        <div class="when">${fmtWhen(e.starts_at, e.ends_at)}</div>
        <div class="what"><b>${esc(e.title || e.vendor_name)}</b><span>${esc(e.vendor_name)} · ${esc(L.Unit)} ${esc(e.unit_label||'')} · ${esc(e.status)}</span></div>
        <span class="pill ${e.vendor_type==='tendco'?'b':'n'}">${e.vendor_type==='tendco'?'TendCo':'Vendor'}</span>
      </div>`).join('') || `<p style="color:var(--muted);font-size:13px">Nothing scheduled yet. Use Calendar to see turn dates.</p>`;
    listEl.querySelectorAll('.sched-row[data-unit]').forEach(row => {
      row.onclick = () => {
        const t = state.turns.find(x => x.unit_id === row.dataset.unit && x.status !== 'complete')
          || state.turns.find(x => x.unit_id === row.dataset.unit);
        if (t) openTurn(t.id);
      };
    });
  }

  renderCalendar();
  setSchedTab(state.cal.tab || 'cal');
  renderShareUnitSelect();
  fillServiceUnitSelect();
}

function lex(){ return state.lexicon || { Unit:'Unit', unit:'unit', Unit_plural:'Units', unit_plural:'units', Place:'Building', place:'building', board:'Make Ready Board', open_turns:'Open turns', ready_to_walk:'Ready to walk', due_today:'Due today', waiting_photos:'Waiting on photos', request_turn:'Request a turn', empty_board:'Nothing open yet', done_subject_noun:'unit' }; }

function nextActionFor(t){
  if (!t) return null;
  if (t.status === 'complete') return null;
  if (!t.has_photo_proof && ['in_progress','punch','scheduled'].includes(t.status)) {
    return { label: 'Add photo proof', focus: 'photos' };
  }
  if (t.status === 'punch') return { label: 'Close out with proof', focus: 'punch' };
  if (t.status === 'received') return { label: 'Mark scheduled', status: 'scheduled' };
  if (t.status === 'scheduled') return { label: 'Start work', status: 'in_progress' };
  if (t.status === 'in_progress') return { label: 'Move to punch', status: 'punch' };
  return null;
}

async function compressImageFile(file, maxSide = 1280, quality = 0.72){
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not compress photo');
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return { data_base64: btoa(bin), content_type: 'image/jpeg', width, height, bytes: bytes.length };
}

async function loadTurnPhotos(turnId){
  try {
    const data = await api('/turns/' + turnId + '/photos');
    state.photos = data.photos || [];
    state.photosBound = !!data.photos_bound;
    return data;
  } catch (e) {
    state.photos = [];
    document.getElementById('d-photo-status').textContent = e.message || 'Photos unavailable';
    return null;
  }
}

function renderPhotoThumbs(){
  const el = document.getElementById('d-photos');
  if (!el) return;
  const photos = state.photos || [];
  if (!photos.length) {
    el.innerHTML = `<div class="photo-empty">No photos yet — add a before shot when work starts.</div>`;
    return;
  }
  el.innerHTML = photos.map(p => `
    <figure class="photo-thumb" data-id="${p.id}">
      <img src="${esc(p.url)}" alt="${esc(p.kind)}" loading="lazy">
      <figcaption>${esc(p.kind)}</figcaption>
    </figure>`).join('');
}

function renderPunch(t){
  const list = document.getElementById('d-punch');
  const items = (t.punch_checklist && t.punch_checklist.length)
    ? t.punch_checklist
    : [
        { id:'floors', label:'Floors clean / ready', done:false },
        { id:'walls', label:'Walls & paint touch-ups', done:false },
        { id:'fixtures', label:'Fixtures / appliances work', done:false },
        { id:'keys', label:'Keys / lockbox confirmed', done:false },
        { id:'photos', label:'Before & after photos uploaded', done:false },
      ];
  state.punchDraft = items.map(x => ({ ...x }));
  list.innerHTML = state.punchDraft.map((item, i) => `
    <label class="punch-item">
      <input type="checkbox" data-punch-i="${i}" ${item.done?'checked':''}>
      <span>${esc(item.label)}</span>
    </label>`).join('');
  list.querySelectorAll('[data-punch-i]').forEach(cb => {
    cb.onchange = () => {
      const i = parseInt(cb.dataset.punchI, 10);
      state.punchDraft[i].done = cb.checked;
    };
  });
  const note = document.getElementById('d-punch-note');
  if (note) note.value = t.punch_note || '';
}


/** create20 — open make-ready service detail / schedule action (pipeline chips, calendar, Tendy). */
function findTurnByUnitRef(ref){
  const needle = String(ref || '').trim().toUpperCase();
  if (!needle) return null;
  const turns = state.turns || [];
  return turns.find(t => String(t.unit_label || '').toUpperCase() === needle)
    || turns.find(t => String(t.unit_label || '').toUpperCase().replace(/-/g, '') === needle.replace(/-/g, ''))
    || turns.find(t => String(t.unit_label || '').toUpperCase().includes(needle))
    || null;
}

window.openTurnByUnitLabel = openTurnByUnitLabel;
window.openTurnService = openTurnService;
window.findTurnByUnitRef = findTurnByUnitRef;
function openTurnByUnitLabel(label, serviceId){
  const t = findTurnByUnitRef(label);
  if (!t) { toast('Unit not on the board'); return false; }
  openTurn(t.id);
  if (serviceId) setTimeout(() => openTurnService(t.id, serviceId), 40);
  return true;
}

function openTurnService(turnId, serviceId){
  const t = (state.turns || []).find(x => x.id === turnId);
  if (!t) return;
  if (state.focusTurnId !== turnId) openTurn(turnId);
  renderTurnSvcPanel(t, serviceId);
  const panel = document.getElementById('d-svc-panel');
  if (panel) {
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function persistTurnServices(turn){
  if (!turn) return;
  if (turn.id && !String(turn.id).startsWith('local-') && !turn.demo && !turn._mrbDemo && !turn._localCreate) {
    api('/turns/' + turn.id, { method:'PATCH', body: JSON.stringify({ services: turn.services }) }).catch(() => {});
  }
}

function renderTurnSvcPanel(t, serviceId){
  let host = document.getElementById('d-svc-panel');
  if (!host) {
    const grid = document.getElementById('d-make-ready');
    if (!grid || !grid.parentNode) return;
    host = document.createElement('div');
    host.id = 'd-svc-panel';
    host.className = 'd-svc-panel';
    grid.insertAdjacentElement('afterend', host);
  }
  const services = parseTurnServices(t);
  let svc = services.find(s => String(s.id) === String(serviceId));
  if (!svc && serviceId) {
    svc = services.find(s => normalizeTradeId(s.trade) === normalizeTradeId(serviceId) || mrwKind(s) === mrwKind({ trade: serviceId }));
  }
  if (!svc) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  const blocked = !!(svc.blocked_utils || (mrwNeedsUtilities(svc) && !mrwUtilitiesOk(t.utilities || {})));
  const paused = !!svc.paused_pest || (mrwPestGateActive(t) && mrwKind(svc) !== 'pest');
  const st = paused ? 'paused' : (blocked ? 'blocked' : (svc.confirm === 'confirmed' ? 'confirmed' : (svc.vendor ? 'pending' : 'open')));
  const stLabel = paused ? 'Paused — pest' : (blocked ? 'Blocked — utilities' : (st === 'confirmed' ? 'Scheduled' : (st === 'pending' ? 'Pending confirm' : 'Open — pick vendor')));
  const vendorOpts = DEMO_VENDORS.map(v =>
    `<option value="${esc(v.id)}" ${svc.vendor===v.id?'selected':''}>${esc(v.label)}</option>`
  ).join('');
  // Ensure current vendor is in the list
  if (svc.vendor && !DEMO_VENDORS.some(v => v.id === svc.vendor)) {
    // prepend as selected option already handled by value match — add synthetic
  }
  const extraVendor = (svc.vendor && !DEMO_VENDORS.some(v => v.id === svc.vendor))
    ? `<option value="${esc(svc.vendor)}" selected>${esc(svc.vendor)}</option>` : '';
  const when = svc.scheduled_date ? fmtDate(svc.scheduled_date) : '—';
  const confirmDis = (!svc.vendor || blocked || paused) ? 'disabled' : '';
  const scheduleLabel = svc.confirm === 'confirmed'
    ? ('Scheduled' + (svc.vendor ? ' · ' + svc.vendor : ''))
    : ('Schedule' + (svc.vendor ? ' ' + svc.vendor : '') + ' · ' + (svc.label || tradeLabel(svc.trade) || 'service'));
  host.hidden = false;
  host.innerHTML = `
    <div class="d-svc-card" data-svc-id="${esc(svc.id)}">
      <div class="d-svc-h">
        <div>
          <div class="d-svc-title">${esc(svc.label || tradeLabel(svc.trade) || 'Service')}</div>
          <div class="d-svc-sub">${esc(tradeLabel(svc.trade) || '')}${svc.hint ? ' · ' + esc(svc.hint) : ''}</div>
        </div>
        <span class="svc-status ${st}">${esc(stLabel)}</span>
      </div>
      <div class="d-svc-row">
        <label>Vendor / tech</label>
        <select data-svc-act="vendor" aria-label="Vendor">${extraVendor}${vendorOpts}</select>
      </div>
      <div class="d-svc-row">
        <label>Date</label>
        <input type="date" data-svc-act="date" value="${esc(svc.scheduled_date || t.move_out_date || todayKeyNY())}">
      </div>
      <div class="d-svc-confirm">
        <button type="button" data-via="link" class="${svc.confirm_via==='link'?'on':''}" ${confirmDis}>Link</button>
        <button type="button" data-via="text" class="${svc.confirm_via==='text'?'on':''}" ${confirmDis}>Text</button>
        <button type="button" data-via="call" class="${svc.confirm_via==='call'?'on':''}" ${confirmDis}>Call</button>
      </div>
      <div class="d-svc-actions">
        <button type="button" class="btn pri sm" data-svc-act="schedule">${esc(scheduleLabel)}</button>
        <button type="button" class="btn ghost sm" data-svc-act="close">Close</button>
      </div>
      <p class="d-hint" style="margin:8px 0 0">Same confirm path as Create — confirmed lands on the calendar; unconfirmed stays pending.</p>
    </div>`;

  const turn = (state.turns || []).find(x => x.id === t.id) || t;
  const syncSvc = () => {
    let svcs = parseTurnServices(turn);
    if (!svcs.length) svcs = (turn.services || []).slice();
    const idx = svcs.findIndex(s => String(s.id) === String(svc.id));
    if (idx >= 0) svcs[idx] = { ...svcs[idx], ...svc };
    else svcs.push(svc);
    turn.services = svcs;
  };

  host.querySelector('[data-svc-act="vendor"]')?.addEventListener('change', (e) => {
    svc.vendor = e.target.value;
    if (!svc.vendor) { svc.confirm = ''; svc.confirm_via = ''; }
    else if (svc.confirm !== 'confirmed') svc.confirm = 'pending';
    syncSvc();
    renderTurnSvcPanel(turn, svc.id);
    renderMakeReadyGrid(turn);
    renderDemoUnitSchedule(turn);
  });
  host.querySelector('[data-svc-act="date"]')?.addEventListener('change', (e) => {
    svc.scheduled_date = e.target.value;
    syncSvc();
  });
  host.querySelectorAll('.d-svc-confirm [data-via]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!svc.vendor) { toast('Pick a vendor first'); return; }
      if (paused) { toast('Pest-blocked — other services paused'); return; }
      if (blocked) { toast('Cleaning blocked — confirm water and electric'); return; }
      const via = btn.dataset.via;
      if (svc.confirm === 'confirmed' && svc.confirm_via === via) {
        svc.confirm = 'pending';
        svc.confirm_via = '';
        toast(svc.vendor + ' back to pending');
      } else {
        svc.confirm = 'confirmed';
        svc.confirm_via = via;
        if (!svc.scheduled_date) svc.scheduled_date = t.move_out_date || todayKeyNY();
        toast(svc.label + ' · confirmed via ' + via);
      }
      syncSvc();
      persistTurnServices(turn);
      try { renderCalendar(); } catch {}
      try { renderMakeReadyBoard(); } catch {}
      renderTurnSvcPanel(turn, svc.id);
      renderMakeReadyGrid(turn);
      renderDemoUnitSchedule(turn);
    });
  });
  host.querySelector('[data-svc-act="schedule"]')?.addEventListener('click', () => {
    if (!svc.vendor) { toast('Pick a vendor / tech first'); return; }
    if (paused) { toast('Pest-blocked — other services paused'); return; }
    if (blocked) { toast('Cleaning blocked — confirm water and electric'); return; }
    const dateEl = host.querySelector('[data-svc-act="date"]');
    svc.scheduled_date = (dateEl && dateEl.value) || svc.scheduled_date || t.move_out_date || todayKeyNY();
    svc.confirm = 'confirmed';
    if (!svc.confirm_via) svc.confirm_via = 'text';
    syncSvc();
    persistTurnServices(turn);
    toast('Scheduled ' + (svc.vendor || '') + ' · ' + (svc.label || tradeLabel(svc.trade)) + ' · ' + fmtDate(svc.scheduled_date));
    try { renderCalendar(); } catch {}
    try { renderMakeReadyBoard(); } catch {}
    try { renderBoard(); } catch {}
    renderTurnSvcPanel(turn, svc.id);
    renderMakeReadyGrid(turn);
    renderDemoUnitSchedule(turn);
  });
  host.querySelector('[data-svc-act="close"]')?.addEventListener('click', () => {
    host.hidden = true;
  });
}

function renderDemoUnitSchedule(t){
  const el = document.getElementById('d-sched');
  if (!el || !(t.demo || t._mrbDemo || t._localCreate)) return;
  const L = lex();
  const services = parseTurnServices(t);
  if (!services.length) {
    el.innerHTML = `<p style="font-size:12px;color:var(--muted)">Demo ${L.unit} — add services on Create, or tap pipeline chips above.</p>`;
    return;
  }
  el.innerHTML = services.map(s => {
    const ready = s.confirm === 'confirmed' && s.scheduled_date;
    const who = s.vendor || t.owner_name || '';
    const label = ready
      ? `${esc(s.label || tradeLabel(s.trade))} · ${esc(who || 'Unassigned')} · ${esc(fmtDate(s.scheduled_date))}`
      : `Schedule${who ? ' ' + esc(who) : ''} · ${esc(s.label || tradeLabel(s.trade) || 'service')}`;
    const cls = ready ? 'ok' : (s.vendor ? 'wait' : '');
    const blocked = !!(s.blocked_utils || (mrwNeedsUtilities(s) && !mrwUtilitiesOk(t.utilities || {})));
    const red = blocked ? ' blocked' : '';
    return `<button type="button" class="d-sched-svc ${cls}${red}" data-svc-id="${esc(s.id)}">
      <span class="d-sched-svc-label">${label}</span>
      <span class="d-sched-svc-go">${ready ? 'Open' : 'Schedule'}</span>
    </button>`;
  }).join('') + `<p style="font-size:11px;color:var(--faint);margin:8px 0 0">Demo ${L.unit} — tap a row or pipeline chip to schedule / open detail.</p>`;
  el.querySelectorAll('[data-svc-id]').forEach(btn => {
    btn.addEventListener('click', () => openTurnService(t.id, btn.dataset.svcId));
  });
}

function openTurn(turnId){
  const t = state.turns.find(x => x.id === turnId);
  if (!t) return;
  const L = lex();
  state.focusTurnId = turnId;
  state.focusUnitId = t.unit_id;
  state._demoTurn = !!(t.demo || t._mrbDemo);
  document.getElementById('d-title').textContent = L.Unit + ' ' + t.unit_label;
  document.getElementById('d-addr').textContent = [t.address, t.city].filter(Boolean).join(' · ');
  const st = document.getElementById('d-status');
  const meta = STATUS_META[t.status] || STATUS_META.received;
  st.textContent = t.status === 'complete' ? 'Tended' : (t.status_label || meta.label);
  st.className = 'pill ' + (t.pill || meta.pill);
  const proof = document.getElementById('d-proof');
  if (proof) {
    proof.hidden = false;
    proof.textContent = t.has_photo_proof ? 'Photo proof ✓' : 'Needs photos';
    proof.className = 'd-proof ' + (t.has_photo_proof ? 'ok' : 'need');
  }
  const metaEl = document.getElementById('d-meta');
  if (metaEl) {
    const bits = [];
    if (t.trade) bits.push(tradeLabel(t.trade));
    if (t.owner_name) bits.push(t.owner_name);
    if (t.completed_by_role) bits.push('Logged by ' + (t.completed_by_name || t.completed_by_role));
    if (t.scheduled_date) bits.push('ETA ' + fmtDate(t.scheduled_date));
    if (t.paint) bits.push('Paint ' + paintLabel(t.paint));
    bits.push((t.photo_count || 0) + ' photos');
    metaEl.textContent = bits.join(' · ');
  }
  renderMakeReadyGrid(t);
  const svcPanel = document.getElementById('d-svc-panel');
  if (svcPanel) { svcPanel.hidden = true; svcPanel.innerHTML = ''; }
  renderPipeline(t);
  renderVacantOffer(t);
  document.getElementById('d-notes').textContent = t.notes || 'No notes yet';

  // One clear next action + compact status chips
  const next = nextActionFor(t);
  const canLogComplete = t.status !== 'complete' && t.status !== 'cancelled';
  const logCompleteBtn = canLogComplete
    ? `<button class="btn pri sm" type="button" id="d-log-complete">Log completed work</button>`
    : '';
  document.getElementById('d-status-btns').innerHTML = [
    logCompleteBtn,
    next && next.status && next.status !== 'complete' ? `<button class="btn sec sm" type="button" data-set-status="${next.status}">${esc(next.label)}</button>` : '',
    next && next.focus === 'photos' ? `<button class="btn sec sm" type="button" id="d-focus-photos">${esc(next.label)}</button>` : '',
    next && next.focus === 'punch' ? `<button class="btn sec sm" type="button" id="d-focus-punch">${esc(next.label)}</button>` : '',
    ...STATUSES.filter(s => s !== t.status && s !== 'complete' && !(next && next.status === s)).map(s => {
      const m = STATUS_META[s];
      return `<button class="btn sec sm" type="button" data-set-status="${s}">${m.label}</button>`;
    }),
  ].filter(Boolean).join('');
  document.getElementById('d-log-complete')?.addEventListener('click', () => openLogComplete(turnId));

  document.getElementById('d-status-btns').querySelectorAll('[data-set-status]').forEach(btn => {
    btn.onclick = async () => {
      try {
        const nextStatus = btn.dataset.setStatus;
        const wasComplete = t.status === 'complete';
        if (t.demo || t._mrbDemo) {
          t.status = nextStatus;
          const meta = STATUS_META[nextStatus] || STATUS_META.received;
          t.status_label = nextStatus === 'complete' ? 'Tended' : meta.label;
          t.pill = meta.pill;
          if (nextStatus === 'complete') {
            t.completed_at = t.completed_at || new Date().toISOString();
            t.inspected_at = t.inspected_at || nyDateKey(new Date());
            t.handoff_at = t.handoff_at || new Date().toISOString();
          }
          if (nextStatus === 'complete' && !wasComplete) celebrateComplete(t);
          else toast('Demo · status updated locally');
          renderMakeReadyBoard();
          openTurn(turnId);
          return;
        }
        await api('/turns/' + turnId, { method:'PATCH', body: JSON.stringify({ status: nextStatus }) });
        if (nextStatus === 'complete' && !wasComplete) celebrateComplete(t);
        else toast('Status updated');
        await refresh();
        openTurn(turnId);
      } catch (e) { toast(e.message); }
    };
  });
  document.getElementById('d-focus-photos')?.addEventListener('click', () => {
    document.getElementById('d-photos')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  });
  document.getElementById('d-focus-punch')?.addEventListener('click', () => {
    document.getElementById('d-punch')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  });

  renderPunch(t);
  if (t.demo || t._mrbDemo) {
    state.photos = [];
    renderPhotoThumbs();
    const hint = document.getElementById('d-photo-status');
    if (hint) hint.textContent = t.has_photo_proof ? 'Demo · photo proof on file' : 'Demo sample — photos not stored';
    renderDemoUnitSchedule(t);
  } else loadTurnPhotos(turnId).then((data) => {
    renderPhotoThumbs();
    const hint = document.getElementById('d-photo-status');
    if (!hint) return;
    if (data?.has_photo_proof) hint.textContent = 'Proof ready — you can mark Tended.';
    else if (!state.photosBound) hint.textContent = 'Photo storage not bound yet (R2). UI is ready — Pico/Fernando: create bucket + bind TURN_PHOTOS.';
    else hint.textContent = 'Need 1 before + 1 after (or 2 proof photos) before Tended.';
  });

  if (!(t.demo || t._mrbDemo)) api('/schedule?unit_id=' + encodeURIComponent(t.unit_id)).then(data => {
    document.getElementById('d-sched').innerHTML = (data.events||[]).map(e => `
      <div class="sched-row" style="padding:10px 12px;grid-template-columns:90px 1fr">
        <div class="when">${fmtWhen(e.starts_at, e.ends_at)}</div>
        <div>
          <div class="what" style="display:flex;justify-content:space-between;gap:8px;align-items:start">
            <div><b>${esc(e.title||e.vendor_name)}</b><span>${esc(e.vendor_name)} · ${esc(e.status)}</span></div>
            <span class="pill ${e.status==='cancelled'?'n':(e.vendor_type==='tendco'?'b':'n')}">${e.status==='cancelled'?'Cancelled':(e.vendor_type==='tendco'?'TendCo':'Vendor')}</span>
          </div>
          ${e.status!=='cancelled' ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <button class="btn sec sm" type="button" data-ev-resched="${e.id}">Reschedule</button>
            <button class="btn sec sm" type="button" data-ev-cancel="${e.id}">Cancel</button>
          </div>` : ''}
        </div>
      </div>`).join('') || `<p style="font-size:12px;color:var(--muted)">No visits on this ${L.unit} yet</p>`;
    document.getElementById('d-sched').querySelectorAll('[data-ev-resched]').forEach(btn => {
      btn.onclick = () => openActionModal({ kind:'reschedule_event', eventId: btn.dataset.evResched, turnId: t.id });
    });
    document.getElementById('d-sched').querySelectorAll('[data-ev-cancel]').forEach(btn => {
      btn.onclick = () => openActionModal({ kind:'cancel_event', eventId: btn.dataset.evCancel, turnId: t.id });
    });
  }).catch(()=>{});

  document.getElementById('drawer').classList.add('on');
  document.getElementById('drawer-bg').classList.add('on');
  document.getElementById('drawer').setAttribute('aria-hidden','false');
}

function closeDrawer(){
  document.getElementById('drawer').classList.remove('on');
  document.getElementById('drawer-bg').classList.remove('on');
  document.getElementById('drawer').setAttribute('aria-hidden','true');
}


function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}




let actionCtx = null; // { kind, turnId, eventId }

function openActionModal(ctx){
  actionCtx = ctx;
  const L = lex();
  const title = {
    return: 'Request return',
    cancel_turn: 'Cancel turn',
    reschedule: 'Reschedule',
    cancel_event: 'Cancel visit',
    reschedule_event: 'Reschedule visit',
  }[ctx.kind] || 'Action';
  const lede = {
    return: `Tell TendCo™ what needs a callback on this ${L.unit}. We’ll mark Return requested and email workorders.`,
    cancel_turn: 'Cancel when it’s no longer needed. Set the effective date and a short reason.',
    reschedule: `Pick the new date. Open visits on this ${L.unit} can shift with it.`,
    cancel_event: 'Cancel this visit. Set the effective date if it differs from today.',
    reschedule_event: 'Move this visit — we’ll warn if it overlaps another booking.',
  }[ctx.kind] || '';
  document.getElementById('a-title').textContent = title;
  document.getElementById('a-lede').textContent = lede;
  const needDate = ['reschedule','reschedule_event','cancel_turn','cancel_event'].includes(ctx.kind);
  const needShift = ctx.kind === 'reschedule' || ctx.kind === 'reschedule_event';
  document.getElementById('a-date-wrap').style.display = needDate ? 'block' : 'none';
  document.getElementById('a-shift-wrap').style.display = needShift ? 'block' : 'none';
  const dateLabel = document.querySelector('#a-date-wrap label');
  if (dateLabel) dateLabel.textContent = (ctx.kind.startsWith('cancel') ? 'Effective date' : 'New date');
  document.getElementById('a-reason').value = '';
  if (needDate) {
    const d = new Date();
    if (!ctx.kind.startsWith('cancel')) d.setDate(d.getDate() + 1);
    document.getElementById('a-date').value = d.toISOString().slice(0,10);
  }
  if (needShift) document.getElementById('a-shift').value = '1';
  document.getElementById('action-modal').style.display = 'block';
  document.getElementById('action-modal-bg').style.display = 'block';
}
function closeActionModal(){
  actionCtx = null;
  document.getElementById('action-modal').style.display = 'none';
  document.getElementById('action-modal-bg').style.display = 'none';
}

async function submitActionModal(){
  if (!actionCtx) return;
  const reason = document.getElementById('a-reason').value.trim();
  const kind = actionCtx.kind;
  try {
    if (kind === 'return') {
      if (reason.length < 3) { toast('Add what needs a return'); return; }
      await api('/turns/' + actionCtx.turnId + '/return', { method:'POST', body: JSON.stringify({ reason }) });
      toast('Return requested — TendCo notified');
    } else if (kind === 'cancel_turn') {
      if (reason.length < 2) { toast('Add a cancel reason'); return; }
      const effective_date = document.getElementById('a-date').value || undefined;
      await api('/turns/' + actionCtx.turnId + '/cancel', { method:'POST', body: JSON.stringify({ reason, effective_date }) });
      toast('Turn cancelled');
    } else if (kind === 'reschedule') {
      const scheduled_date = document.getElementById('a-date').value;
      const shift_days = parseInt(document.getElementById('a-shift').value, 10);
      await api('/turns/' + actionCtx.turnId + '/reschedule', {
        method:'POST',
        body: JSON.stringify({ scheduled_date, shift_days, reason: reason || undefined }),
      });
      toast('Rescheduled');
    } else if (kind === 'cancel_event') {
      const effective_date = document.getElementById('a-date').value || undefined;
      await api('/schedule/' + actionCtx.eventId + '/cancel', { method:'POST', body: JSON.stringify({ reason: reason || 'Cancelled by PM', effective_date }) });
      toast('Visit cancelled');
    } else if (kind === 'reschedule_event') {
      const shift_days = parseInt(document.getElementById('a-shift').value, 10);
      const scheduled_date = document.getElementById('a-date').value;
      try {
        await api('/schedule/' + actionCtx.eventId + '/reschedule', {
          method:'POST',
          body: JSON.stringify({ shift_days, reason: reason || undefined }),
        });
        toast('Visit rescheduled');
      } catch (err) {
        if (String(err.message||'').toLowerCase().includes('overlap')) {
          if (confirm(err.message + '\n\nSave anyway?')) {
            await api('/schedule/' + actionCtx.eventId + '/reschedule', {
              method:'POST',
              body: JSON.stringify({ shift_days, reason: reason || undefined, force_overlap: true }),
            });
            toast('Saved with overlap noted');
          } else return;
        } else throw err;
      }
    }
    closeActionModal();
    await refresh();
    if (actionCtx && actionCtx.turnId) openTurn(actionCtx.turnId);
    else if (state.focusTurnId) openTurn(state.focusTurnId);
    if (state.focusUnitId) loadSchedule(state.focusUnitId).catch(()=>{});
  } catch (e) { toast(e.message); }
}


const celebratedIds = new Set();

function celebrateComplete(turn){
  const L = lex();
  const noun = (L.done_subject_noun || L.unit || 'unit');
  const id = turn && turn.id;
  const toastMsg = 'Tended! · ' + noun;
  if (id && celebratedIds.has(id)) { toast(toastMsg); buzzLight(); return; }
  if (id) celebratedIds.add(id);
  const root = document.getElementById('celebrate');
  buzzLight();
  if (!root) { toast(toastMsg); return; }
  root.innerHTML = '';
  root.classList.add('on');
  root.setAttribute('aria-hidden', 'false');
  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg><span>Tended!</span>';
  root.appendChild(badge);
  const burst = document.createElement('div');
  burst.className = 'burst';
  root.appendChild(burst);
  const colors = ['#1F5BD8','#2B6EF2','#0A1F44','#7dd3a0','#D6E4FF','#1849B0','#15803D'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('i');
    p.className = 'p';
    const ang = (Math.PI * 2 * i) / 18 + (Math.random() * 0.15);
    const dist = 56 + Math.random() * 72;
    p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    p.style.setProperty('--rot', (Math.random() * 180 - 90) + 'deg');
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.05) + 's';
    if (i % 3 === 0) { p.style.width = '5px'; p.style.height = '11px'; p.style.borderRadius = '2px'; }
    burst.appendChild(p);
  }
  toast(toastMsg);
  clearTimeout(root._tm);
  root._tm = setTimeout(() => {
    root.classList.remove('on');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '';
  }, 900);
}

function weekKey(d){
  // Monday-start week key in America/New_York
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const get = t => parts.find(p => p.type === t).value;
  const local = new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00`);
  const day = local.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // days since Monday
  local.setDate(local.getDate() - diff);
  return local.toISOString().slice(0, 10);
}

function weekLabel(key){
  try {
    const d = new Date(key + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone:'America/New_York' });
  } catch { return key; }
}

function renderKpiChart(){
  const el = document.getElementById('kpi-chart');
  const legend = document.getElementById('kpi-chart-legend');
  if (!el) return;
  // last 4 weeks ending this week
  const now = new Date();
  const keys = [];
  let cursor = new Date(now);
  for (let i = 0; i < 4; i++) {
    keys.unshift(weekKey(cursor));
    cursor = new Date(cursor.getTime() - 7 * 86400000);
  }
  const doneBy = Object.fromEntries(keys.map(k => [k, 0]));
  let openNow = 0;
  let doneAll = 0;
  let done30 = 0;
  const monthAgo = Date.now() - 30 * 86400000;
  for (const t of state.turns) {
    if (t.status === 'complete') {
      doneAll++;
      const when = t.completed_at || t.updated_at || t.created_at;
      if (when) {
        const d = new Date(when);
        if (!Number.isNaN(d.getTime())) {
          if (d.getTime() >= monthAgo) done30++;
          const k = weekKey(d);
          if (k in doneBy) doneBy[k]++;
        }
      }
    } else openNow++;
  }
  const maxDone = Math.max(1, ...Object.values(doneBy));
  el.innerHTML = keys.map(k => {
    const n = doneBy[k];
    const h = Math.max(6, Math.round((n / maxDone) * 72));
    // open bar is a thin reference of current open (same height scale, capped)
    const openH = Math.max(4, Math.round((openNow / Math.max(maxDone, openNow, 1)) * 40));
    return `<div class="kpi-bar">
      <div class="val">${n}</div>
      <div class="bars" title="${n} completed · week of ${weekLabel(k)}">
        <i class="done" style="height:${h}px"></i>
        <i class="open" style="height:${openH}px"></i>
      </div>
      <div class="lbl">W of ${weekLabel(k)}</div>
    </div>`;
  }).join('');
  if (legend) {
    legend.innerHTML = `<div class="kpi-legend">
      <span><i class="d"></i> Completed</span>
      <span><i class="o"></i> Open now (${openNow})</span>
      <span style="color:var(--faint)">${done30} done · 30d</span>
    </div>`;
  }
}

function renderHistory(filter){
  const list = document.getElementById('hist-list');
  if (!list) return;
  const q = String(filter || '').trim().toLowerCase();
  const done = state.turns
    .filter(t => t.status === 'complete' || t.status === 'cancelled' || t.status === 'return_requested')
    .sort((a, b) => String(b.completed_at || b.updated_at || '').localeCompare(String(a.completed_at || a.updated_at || '')));
  const filtered = !q ? done : done.filter(t => {
    const hay = [t.unit_label, t.address, t.city, t.notes, t.status_label].join(' ').toLowerCase();
    return hay.includes(q);
  });
  list.innerHTML = filtered.map(t => {
    const where = [t.address, t.city].filter(Boolean).join(' · ');
    const when = t.completed_at ? ('Done ' + fmtDate(t.completed_at)) : ('Updated ' + fmtDate(t.updated_at));
    return `<button type="button" class="hist-row" data-turn="${t.id}">
      <div>
        <b>Unit ${esc(t.unit_label)}</b>
        <div class="meta">${esc(where || 'No address')} · ${esc(when)}</div>
        ${t.notes ? `<div class="note">${esc(t.notes)}</div>` : '<div class="note" style="color:var(--faint)">No notes</div>'}
      </div>
      <span class="pill ${(STATUS_META[t.status]||STATUS_META.complete).pill}">${esc((STATUS_META[t.status]||STATUS_META.complete).label)}</span>
    </button>`;
  }).join('') || `<p style="color:var(--muted);font-size:13px">${q ? 'No matches.' : 'No completed turns yet. Mark one Complete on the board to build history.'}</p>`;
  list.querySelectorAll('[data-turn]').forEach(el => {
    el.addEventListener('click', () => openTurn(el.dataset.turn));
  });
}


function fillServiceUnitSelect(){
  const sel = document.getElementById('svc-unit');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Other / new address…</option>' +
    state.units.map(u => {
      const label = [u.label ? ('Unit ' + u.label) : null, u.address, u.city].filter(Boolean).join(' · ');
      return `<option value="${u.id}">${esc(label || u.label || u.id)}</option>`;
    }).join('');
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function onServiceUnitChange(){
  const id = document.getElementById('svc-unit').value;
  const u = state.units.find(x => x.id === id);
  if (u) {
    document.getElementById('svc-addr').value = u.address || '';
    document.getElementById('svc-city').value = u.city || '';
  }
}

async function loadService(){
  if (state.user) {
    document.getElementById('svc-client').value = state.user.client_name || '';
    document.getElementById('svc-email').value = state.user.email || '';
  }
  fillServiceUnitSelect();
  const data = await api('/service-requests');
  const list = document.getElementById('svc-list');
  const rows = data.requests || [];
  list.innerHTML = rows.map(r => {
    const where = [r.property_label || r.unit_label, r.address, r.city].filter(Boolean).join(' · ');
    return `<div class="svc-row">
      <div class="top">
        <b>${esc(r.service_type_label || r.service_type)}</b>
        <span class="pill n">${esc(r.status || 'submitted')}</span>
      </div>
      <div class="meta">${esc(where || 'No address')} · ${esc(r.urgency_label || r.urgency)} · ${esc(fmtDate(r.created_at))}${r.po_number ? ' · PO ' + esc(r.po_number) : ''}</div>
      <div class="desc">${esc(r.description)}</div>
    </div>`;
  }).join('') || '<p style="color:var(--muted);font-size:13px">No service requests yet. Submit one on the left — TendCo gets notified.</p>';
}

async function refresh(){
  if (demoOffline && demoBoardMemory && state.turns && state.turns.length) {
    demoBoardMemory = {
      turns: state.turns,
      units: state.units || [],
      kpi: state.kpi || {},
      events: state.events || [],
    };
  }
  const data = await api('/board');
  state.user = data.user;
  state.turns = data.turns || [];
  state.units = data.units || [];
  state.kpi = data.kpi || {};
  ensureDemoMakeReady();
  ensurePropertySchedule();
  if (demoOffline) {
    const openN = (state.turns || []).filter(t => ['received','scheduled','in_progress','punch'].includes(t.status)).length;
    state.kpi = state.kpi || {};
    if (!state.kpi.open) state.kpi.open = openN;
  }
  state.lexicon = data.lexicon || state.lexicon || null;
  state.photosBound = !!data.photos_bound;
  const L = lex();
  const client = data.user.client_name || 'Client';
  document.getElementById('banner-client').textContent = '· ' + client;
  document.getElementById('prop-name').textContent = client;
  document.getElementById('prop-meta').textContent = (data.units||[]).length + ' ' + L.unit_plural;
  document.getElementById('prop-initials').textContent = initials(client);
  document.getElementById('user-foot').textContent = data.user.name + ' · ' + (data.user.role || 'PM').toUpperCase();
  document.getElementById('avatar').textContent = initials(data.user.name);
  document.getElementById('avatar').title = data.user.name;
  document.getElementById('top-crumb').textContent = client;
  const turnsH = document.querySelector('#view-turns .page-h h2');
  if (turnsH) turnsH.textContent = 'Turns';
  const turnsP = document.querySelector('#view-turns .page-h p');
  if (turnsP) turnsP.textContent = 'Clear status · photo proof · ready to walk';
  const mrbH = document.querySelector('#view-make-ready .page-h h2');
  if (mrbH) mrbH.textContent = 'Make Ready Board';
  const unitsH = document.querySelector('#view-units .page-h h2');
  if (unitsH) unitsH.textContent = L.Unit_plural;
  const unitsNav = document.querySelector('.nav a[data-view="units"]');
  if (unitsNav) {
    const svg = unitsNav.querySelector('svg');
    unitsNav.innerHTML = '';
    if (svg) unitsNav.appendChild(svg);
    unitsNav.appendChild(document.createTextNode(L.Unit_plural));
  }
  const reqBtn = document.getElementById('btn-request-turn');
  if (reqBtn) reqBtn.textContent = '+ ' + L.request_turn;
  renderKpi();
  // adapt KPI labels
  const kpiMap = {
    open: L.open_turns,
    due_today: L.due_today,
    waiting_on_photos: L.waiting_photos,
    ready_to_walk: L.ready_to_walk,
  };
  document.querySelectorAll('#kpi-row .home-tile').forEach(el => {
    const k = el.dataset.kpi;
    if (kpiMap[k]) el.querySelector('.lbl').textContent = kpiMap[k];
  });
  renderKpiChart();
  renderBoard();
  renderMakeReadyBoard();
  renderUnits();
  renderHistory(document.getElementById('hist-q')?.value || '');
  renderShareUnitSelect();
  fillServiceUnitSelect();
  const modeSel = document.getElementById('property-mode-app');
  if (modeSel && data.user?.property_mode) modeSel.value = data.user.property_mode;
  const schedSub = document.getElementById('sched-page-sub');
  if (schedSub) schedSub.textContent = L.Unit_plural + ' + vendor visits — by date';
  if ((location.hash || '').slice(1).split('/')[0] === 'schedule') {
    try { renderCalendar(); } catch {}
  }
  if (demoOffline) {
    demoBoardMemory = {
      turns: state.turns,
      units: state.units || [],
      kpi: state.kpi || {},
      events: state.events || [],
    };
  }
  if (window.HubHouses) {
    try { window.HubHouses.onRefresh(); } catch {}
  }
}

document.getElementById('property-mode-app')?.addEventListener('change', async (e) => {
  const mode = e.target.value;
  try { sessionStorage.setItem('hub_property_mode', mode); } catch {}
  if (state.user) state.user.property_mode = mode;
  try {
    await api('/client', { method:'PATCH', body: JSON.stringify({ property_mode: mode }) });
  } catch (err) {
    if (!isDemoMode() && !demoOffline) { toast(err.message); return; }
  }
  if (mode !== 'sfh') {
    try { await refresh(); } catch {}
  }
  if (window.HubHouses) window.HubHouses.applyMode(mode, { navigate: true });
  else toast(mode === 'sfh' ? 'Houses' : 'Portfolio updated');
});


/* ═══════════════════════════════════════════════════════════
   Create Make Ready Unit wizard + rolling 60-day notices
   ═══════════════════════════════════════════════════════════ */

function openCreateMrWizard(){
  const L = lex();
  state.mrw = {
    step: 1,
    unit_label: '',
    address: '',
    city: '',
    // Prefill MO so Continue isn't a silent dead-end if the date field is skipped on mobile
    move_out_date: addDaysKey(todayKeyNY(), 14),
    move_in_date: '',
    services: cloneDefaultServices(),
    notice_at: todayKeyNY(),
    make_ready_type: 'standard', // 'standard' | 'eviction'
    utilities: { water: false, electric: false }, // demo default unchecked → cleaning blocked until verified
    pest_infestation: false,
    pest_wait_days: 2,
    pest_cleared: false,
  };
  renderMrWizard();
  const root = document.getElementById('mr-wizard-root');
  if (root) root.hidden = false;
  // Focus unit label so the next action is obvious
  setTimeout(() => document.getElementById('mrw-unit')?.focus(), 30);
}

function closeMrWizard(){
  const root = document.getElementById('mr-wizard-root');
  if (root) root.hidden = true;
  state.mrw = null;
}

function showMrWizardError(msg, fieldIds){
  const body = document.getElementById('mrw-body');
  if (!body) { toast(msg); return; }
  let err = document.getElementById('mrw-err');
  if (!err) {
    err = document.createElement('div');
    err.id = 'mrw-err';
    err.className = 'mrw-err';
    err.setAttribute('role', 'alert');
    body.prepend(err);
  }
  err.textContent = msg;
  err.classList.add('on');
  body.querySelectorAll('.field.bad').forEach(el => el.classList.remove('bad'));
  (fieldIds || []).forEach(id => {
    const input = document.getElementById(id);
    input?.closest('.field')?.classList.add('bad');
    if (id === fieldIds[0]) input?.focus();
  });
  toast(msg);
}

function renderMrWizard(){
  const w = state.mrw;
  if (!w) return;
  const L = lex();
  const body = document.getElementById('mrw-body');
  const title = document.getElementById('mrw-title');
  const lede = document.getElementById('mrw-lede');
  const back = document.getElementById('mrw-back');
  const next = document.getElementById('mrw-next');
  document.querySelectorAll('#mrw-steps span').forEach(el => {
    const s = Number(el.dataset.step);
    el.classList.toggle('on', s === w.step);
    el.classList.toggle('done', s < w.step);
  });
  back.hidden = w.step <= 1;
  if (w.step === 1) {
    title.textContent = 'Create a Make Ready ' + L.unit;
    lede.textContent = 'Move-out date is required. Move-in is optional.';
    next.textContent = 'Continue';
    if (next) next.disabled = false;
    body.innerHTML = `
      <div id="mrw-err" class="mrw-err" role="alert"></div>
      <div class="field">
        <label for="mrw-unit">${esc(L.Unit)} # / label <span class="req">*</span></label>
        <input id="mrw-unit" type="text" placeholder="G-349 · 101 · 1842 Willow Creek" value="${esc(w.unit_label)}" autocomplete="off">
        <div class="mrw-hint">Flexes per community — unit #, suite, or home address.</div>
      </div>
      <div class="mrw-row2">
        <div class="field">
          <label for="mrw-addr">Address</label>
          <input id="mrw-addr" type="text" placeholder="Optional street" value="${esc(w.address)}">
        </div>
        <div class="field">
          <label for="mrw-city">City</label>
          <input id="mrw-city" type="text" placeholder="Winter Park" value="${esc(w.city)}">
        </div>
      </div>
      <div class="mrw-row2">
        <div class="field">
          <label for="mrw-mo">Move-out date <span class="req">*</span></label>
          <input id="mrw-mo" type="date" value="${esc(w.move_out_date)}" required>
        </div>
        <div class="field">
          <label for="mrw-mi">Move-in date <span style="font-weight:500;color:var(--faint)">(optional)</span></label>
          <input id="mrw-mi" type="date" value="${esc(w.move_in_date)}">
        </div>
      </div>
      <div class="field">
        <label for="mrw-type">Make-ready type</label>
        <select id="mrw-type">
          <option value="standard" ${w.make_ready_type!=='eviction'?'selected':''}>Standard</option>
          <option value="eviction" ${w.make_ready_type==='eviction'?'selected':''}>Eviction</option>
        </select>
        <div class="mrw-hint">Eviction auto-seeds Change of lock → Trash out → Full inspection (lock stays #1; pest inserts after lock if present; bathtub last).</div>
      </div>`;
  } else if (w.step === 2) {
    if (mrwIsEviction(w)) mrwSeedEviction(w);
    const orderSnap = mrwEnforceOrder(w);
    mrwApplyDateSpread(w);
    const unitBit = (w.unit_label || '').trim();
    title.textContent = unitBit ? (unitBit + ' · Request services') : 'Request services';
    const moLbl = fmtDate(w.move_out_date) || '—';
    const miLbl = w.move_in_date ? fmtDate(w.move_in_date) : 'TBD';
    const typeBit = mrwIsEviction(w) ? ' · Eviction' : '';
    lede.textContent = 'MO ' + moLbl + ' → MI ' + miLbl + typeBit + ' · Drag to reorder (hard-ordered services snap back). Confirm vendors by link, text, or call.';
    next.textContent = 'Continue';
    if (next) next.disabled = false;
    const note = carpetBeforePaintNote(w.services);
    const dbl = w.spread?.doubleBook
      ? `<div class="mrw-dbl-flag" role="status">You need to double book — day demand exceeds the MO→MI work window (Sundays off). Compatible share: Cleaning (AM) + Carpet cleaning (PM).</div>`
      : '';
    const urgBit = mrwUrgencyChipHtml(w);
    body.innerHTML = `
      <div class="mrw-urg-row">${urgBit}</div>
      ${mrwPipelineStripHtml(w)}
      ${dbl}
      ${mrwPestChecklistHtml(w, 'mrw-pest')}
      ${mrwPestBlockedBanner(w)}
      ${mrwUtilsChecklistHtml(w, 'mrw-util')}
      ${mrwCleaningBlockedBanner(w)}
      ${mrwCalPreviewHtml(w)}
      <div class="mrw-carpet-banner${note?' on':''}" id="mrw-carpet-banner">${note ? 'Supervisor note: ' + esc(note) : ''}</div>
      <div class="svc-list" id="mrw-svc-list">${w.services.map((s, i) => svcRowHtml(s, i)).join('')}</div>
      <div class="svc-add">
        <select id="mrw-add-trade" aria-label="Add extra service">
          <option value="">Add extra…</option>
          ${UNIT_TRADES.filter(t => !t.noInvite).map(t =>
            `<option value="${t.id}">${esc(t.label)}</option>`
          ).join('')}
        </select>
        <button class="btn sec sm" type="button" id="mrw-add-btn">Add</button>
      </div>
      <div class="mrw-ca-deeplink">
        <button type="button" class="btn ghost sm" id="mrw-ca-link">Add common-area job…</button>
        <button type="button" class="btn ghost sm" id="mrw-vw-link">Add viewing reminder…</button>
        <span class="mrw-hint">Common areas &amp; viewing sit beside make-ready — not in this unit pipeline.</span>
      </div>
      <p class="mrw-hint" style="margin-top:10px">Not work orders — make-ready pipeline only. Confirmed vendors land on the calendar as scheduled; unconfirmed stay pending. Sundays are off. Cleaning / carpet cleaning need water + electric. Pest infestation pauses other services until wait clears.</p>`;
    bindSvcListInteractions();
    if (orderSnap?.snapped && state.mrw?._toastOrder) {
      toast(state.mrw._toastOrder);
      state.mrw._toastOrder = '';
    }
  } else {
    mrwApplyDateSpread(w);
    title.textContent = 'Review & create';
    lede.textContent = 'Lands on the Make Ready Board as Received.';
    next.textContent = 'Create ' + L.unit;
    const note = carpetBeforePaintNote(w.services);
    body.innerHTML = `<div class="mrw-review">
      <div class="rv-card"><div class="k">${esc(L.Unit)}</div><div class="v">${esc(w.unit_label || '—')}</div>
        <div class="mrw-hint" style="margin-top:4px">${esc([w.address, w.city].filter(Boolean).join(' · ') || 'No address')}</div></div>
      <div class="rv-card"><div class="k">Dates</div><div class="v">MO ${esc(fmtDate(w.move_out_date) || '—')}${w.move_in_date ? ' · MI ' + esc(fmtDate(w.move_in_date)) : ' · MI TBD'}</div></div>
      <div class="rv-card"><div class="k">Type</div><div class="v">${mrwIsEviction(w) ? 'Eviction' : 'Standard'}</div></div>
      <div class="rv-card"><div class="k">Urgency</div><div class="v">${w.move_in_date ? 'Urgent — MI ' + esc(fmtDate(w.move_in_date)) : 'Flexible — show-ready by ' + esc(fmtDate(w.show_ready_by || mrwShowReadyDate(w)))}</div></div>
      <div class="rv-card"><div class="k">Pest</div><div class="v">${w.pest_infestation ? ('Infestation · wait ' + mrwPestWaitDays(w) + ' days · resume ' + esc(fmtDate(w.pest_resume_date || mrwPestResumeDate(w)))) : 'None'}</div></div>
      <div class="rv-card"><div class="k">Utilities</div><div class="v">${(w.utilities?.water ? 'Water on' : 'Water off')} · ${(w.utilities?.electric ? 'Electric on' : 'Electric off')}</div></div>
      ${note ? `<div class="rv-card" style="border-color:color-mix(in srgb,var(--amber) 35%,var(--border));background:var(--amber-bg)"><div class="k">Supervisor note</div><div class="v" style="color:var(--amber)">${esc(note)}</div></div>` : ''}
      ${w.spread?.doubleBook ? `<div class="rv-card" style="border-color:color-mix(in srgb,var(--amber) 35%,var(--border));background:var(--amber-bg)"><div class="k">Schedule</div><div class="v" style="color:var(--amber)">You need to double book — some days have two services.</div></div>` : ''}
      <div class="rv-card"><div class="k">Services</div>
        ${w.services.map(s => {
          const st = s.confirm === 'confirmed' ? 'confirmed' : (s.vendor && s.confirm !== 'confirmed' ? 'pending' : 'open');
          const stLabel = s.paused_pest ? 'Paused — pest' : (st === 'confirmed' ? 'Scheduled' : (st === 'pending' ? 'Pending' : 'Open'));
          const stCls = s.paused_pest ? 'paused' : st;
          const when = s.scheduled_date ? fmtDate(s.scheduled_date) : '—';
          const slot = s.slot_n ? (s.slot_n + '. ') : '';
          return `<div class="rv-svc"><span><b>${esc(slot + s.label)}</b>${s.vendor ? ' · ' + esc(s.vendor) : ''}${s.confirm_via ? ' · via ' + esc(s.confirm_via) : ''}<span class="mrw-rv-date">${esc(when)}</span></span><span class="svc-status ${stCls}">${stLabel}</span></div>`;
        }).join('')}
      </div>
    </div>`;
  }
}

function svcRowHtml(s, i){
  const blocked = !!s.blocked_utils;
  const paused = !!s.paused_pest;
  const st = paused ? 'paused' : (blocked ? 'blocked' : (s.confirm === 'confirmed' ? 'confirmed' : (s.vendor ? 'pending' : 'open')));
  const stLabel = paused ? 'Paused — pest' : (blocked ? 'Blocked — utilities' : (st === 'confirmed' ? 'Scheduled' : (st === 'pending' ? 'Pending confirm' : 'No vendor')));
  const vendorOpts = DEMO_VENDORS.map(v =>
    `<option value="${esc(v.id)}" ${s.vendor===v.id?'selected':''}>${esc(v.label)}</option>`
  ).join('');
  const slot = s.slot_n || (i + 1);
  let when = s.scheduled_date ? fmtDate(s.scheduled_date) : '—';
  if (s.scheduled_end && s.scheduled_end !== s.scheduled_date) when = fmtDate(s.scheduled_date) + '–' + fmtDate(s.scheduled_end);
  if (s.day_part) when += ' · ' + s.day_part;
  const confirmDis = (!s.vendor || blocked || paused) ? 'disabled' : '';
  const blockTitle = paused ? 'Pest-blocked — other services paused' : (blocked ? 'Cleaning blocked — confirm water and electric' : 'Confirm via link');
  const labelShow = s.day_part ? (s.label + ' (' + s.day_part + ')') : s.label;
  return `<div class="svc-row${blocked?' svc-blocked':''}${paused?' svc-paused':''}" draggable="true" data-idx="${i}" data-kind="${esc(mrwKind(s))}">
    <div class="grip" aria-hidden="true">⠿</div>
    <div class="svc-main">
      <div class="svc-title"><span class="svc-slot">${slot}</span> ${esc(labelShow)} <span class="svc-date-chip">${esc(when)}</span> <span class="svc-status ${st}">${stLabel}</span></div>
      <div class="svc-sub">${esc(s.hint || tradeLabel(s.trade) || '')}${paused ? ' · Paused until pest wait clears' : ''}${blocked ? ' · Needs water + electric before confirm' : ''}</div>
      <div class="svc-vend">
        <select data-act="vendor" aria-label="Vendor for ${esc(s.label)}" ${paused?'disabled':''}>${vendorOpts}</select>
        <div class="svc-confirm" data-confirm-for="${i}">
          <button type="button" data-via="link" class="${s.confirm_via==='link'?'on':''}" ${confirmDis} title="${esc(blockTitle)}">Link</button>
          <button type="button" data-via="text" class="${s.confirm_via==='text'?'on':''}" ${confirmDis} title="${paused?'Pest-blocked — other services paused':(blocked?'Cleaning blocked — confirm water and electric':'Confirm via text')}">Text</button>
          <button type="button" data-via="call" class="${s.confirm_via==='call'?'on':''}" ${confirmDis} title="${paused?'Pest-blocked — other services paused':(blocked?'Cleaning blocked — confirm water and electric':'Confirm via call')}">Call</button>
        </div>
      </div>
    </div>
    <div class="svc-actions">
      <button type="button" class="svc-rm" data-act="rm" aria-label="Remove">Remove</button>
    </div>
  </div>`;
}

function bindSvcListInteractions(){
  const list = document.getElementById('mrw-svc-list');
  if (!list || !state.mrw) return;
  let dragIdx = null;
  list.querySelectorAll('.svc-row').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      dragIdx = Number(row.dataset.idx);
      row.classList.add('dragging');
      try { e.dataTransfer.setData('text/plain', String(dragIdx)); e.dataTransfer.effectAllowed = 'move'; } catch {}
    });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); dragIdx = null; });
    row.addEventListener('dragover', (e) => { e.preventDefault(); });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const to = Number(row.dataset.idx);
      const from = dragIdx != null ? dragIdx : Number(e.dataTransfer?.getData('text/plain'));
      if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return;
      const arr = state.mrw.services;
      const moved = arr[from];
      const movedKind = mrwKind(moved);
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      const snap = mrwEnforceOrder(state.mrw);
      if (snap.snapped) {
        if (movedKind === 'trash') state.mrw._toastOrder = 'Trash out stays first';
        else if (movedKind === 'pest') state.mrw._toastOrder = 'Pest control stays first';
        else if (movedKind === 'lock') state.mrw._toastOrder = 'Change of lock stays first on eviction';
        else if (movedKind === 'bathtub') state.mrw._toastOrder = 'Bathtub resurfacing stays last';
        else if (mrwIsEviction(state.mrw) && (movedKind === 'inspection' || movedKind === 'trash' || movedKind === 'lock'))
          state.mrw._toastOrder = 'Eviction order: lock → trash → inspection stay up front';
        else state.mrw._toastOrder = 'Pipeline order adjusted';
      }
      renderMrWizard();
    });
    row.querySelector('[data-act="rm"]')?.addEventListener('click', () => {
      state.mrw.services.splice(Number(row.dataset.idx), 1);
      renderMrWizard();
    });
    row.querySelector('[data-act="vendor"]')?.addEventListener('change', (e) => {
      const s = state.mrw.services[Number(row.dataset.idx)];
      if (!s) return;
      s.vendor = e.target.value;
      if (!s.vendor) { s.confirm = ''; s.confirm_via = ''; /* keep spread scheduled_date */ }
      else if (s.confirm !== 'confirmed') s.confirm = 'pending';
      renderMrWizard();
    });
    row.querySelectorAll('.svc-confirm button[data-via]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = state.mrw.services[Number(row.dataset.idx)];
        if (!s || !s.vendor) { toast('Pick a vendor first'); return; }
        if (s.paused_pest || (mrwPestGateActive(state.mrw) && mrwKind(s) !== 'pest')) {
          toast('Pest-blocked — other services paused until ' + fmtDate(state.mrw.pest_resume_date || mrwPestResumeDate(state.mrw)));
          return;
        }
        if (s.blocked_utils || (mrwNeedsUtilities(s) && !mrwUtilitiesOk(state.mrw.utilities))) {
          toast('Cleaning blocked — confirm water and electric');
          return;
        }
        const via = btn.dataset.via;
        // Toggle: same via again → unconfirm back to pending
        if (s.confirm === 'confirmed' && s.confirm_via === via) {
          s.confirm = 'pending';
          s.confirm_via = '';
          // Keep spread scheduled_date — confirm only toggles vendor status
          toast(s.vendor + ' back to pending');
        } else {
          s.confirm = 'confirmed';
          s.confirm_via = via;
          // Preserve auto-spread date (do not overwrite with MO / MO+1)
          if (!s.scheduled_date) mrwApplyDateSpread(state.mrw);
          toast(s.vendor + ' confirmed via ' + via + ' — on calendar ' + (s.scheduled_date ? fmtDate(s.scheduled_date) : 'as scheduled'));
        }
        renderMrWizard();
      });
    });
  });
  document.getElementById('mrw-add-btn')?.addEventListener('click', () => {
    const sel = document.getElementById('mrw-add-trade');
    const tid = normalizeTradeId(sel?.value || '');
    if (!tid) { toast('Pick a trade to add'); return; }
    const meta = UNIT_TRADE_BY_ID[tid];
    if (!meta) return;
    if (state.mrw.services.some(s => normalizeTradeId(s.trade) === tid && s.label === meta.label)) {
      toast('Already on the pipeline');
      return;
    }
    // Insert before cleaning if present
    const cleanIdx = state.mrw.services.findIndex(s => s.id === 'cleaning' || normalizeTradeId(s.trade) === 'cleaning');
    const extra = { id: tid + '-' + Date.now().toString(36), trade: tid, label: meta.label, hint: 'Extra', vendor: '', confirm: '', confirm_via: '', scheduled_date: '', slot_n: 0 };
    if (cleanIdx >= 0) state.mrw.services.splice(cleanIdx, 0, extra);
    else state.mrw.services.push(extra);
    mrwEnforceOrder(state.mrw);
    if (mrwKind(extra) === 'trash') state.mrw._toastOrder = 'Trash out stays first';
    if (mrwKind(extra) === 'bathtub') state.mrw._toastOrder = 'Bathtub resurfacing stays last';
    if (mrwKind(extra) === 'pest') {
      state.mrw.pest_infestation = true;
      state.mrw._toastOrder = 'Pest control stays first — other services paused until wait clears';
    }
    sel.value = '';
    renderMrWizard();
  });
  // Utilities checklist
  const syncUtils = () => {
    if (!state.mrw) return;
    state.mrw.utilities = state.mrw.utilities || { water: false, electric: false };
    state.mrw.utilities.water = !!document.getElementById('mrw-util-water')?.checked;
    state.mrw.utilities.electric = !!document.getElementById('mrw-util-electric')?.checked;
    renderMrWizard();
  };
  document.getElementById('mrw-util-water')?.addEventListener('change', syncUtils);
  document.getElementById('mrw-util-electric')?.addEventListener('change', syncUtils);
  // Pest infestation checklist
  const syncPest = () => {
    if (!state.mrw) return;
    const checked = !!document.getElementById('mrw-pest-infest')?.checked;
    state.mrw.pest_infestation = checked || mrwHasPestService(state.mrw);
    const waitEl = document.getElementById('mrw-pest-wait');
    if (waitEl) state.mrw.pest_wait_days = Math.max(1, Number(waitEl.value) || 2);
    if (checked && !mrwHasPestService(state.mrw)) {
      // Auto-add pest control when flag checked
      const meta = UNIT_TRADE_BY_ID.pest_control;
      if (meta) {
        state.mrw.services.unshift({
          id: 'pest-' + Date.now().toString(36), trade: 'pest_control', label: meta.label,
          hint: 'Hard gate — other trades wait', vendor: '', confirm: '', confirm_via: '',
          scheduled_date: '', slot_n: 0,
        });
        mrwEnforceOrder(state.mrw);
      }
    }
    renderMrWizard();
  };
  document.getElementById('mrw-pest-infest')?.addEventListener('change', syncPest);
  document.getElementById('mrw-pest-wait')?.addEventListener('change', syncPest);
  document.getElementById('mrw-ca-link')?.addEventListener('click', () => {
    try { window.__mrwClose && window.__mrwClose(); } catch {}
    openCommonAreaCreate({ viewing: false });
  });
  document.getElementById('mrw-vw-link')?.addEventListener('click', () => {
    try { window.__mrwClose && window.__mrwClose(); } catch {}
    openCommonAreaCreate({ viewing: true });
  });
}

function readMrWizardStep1(){
  const w = state.mrw;
  if (!w) return false;
  const unitEl = document.getElementById('mrw-unit');
  const moEl = document.getElementById('mrw-mo');
  const miEl = document.getElementById('mrw-mi');
  // Only overwrite draft fields when the step-1 inputs are actually on screen
  if (!unitEl && !moEl) return true;
  w.unit_label = (unitEl?.value || '').trim();
  w.address = (document.getElementById('mrw-addr')?.value || '').trim();
  w.city = (document.getElementById('mrw-city')?.value || '').trim();
  w.move_out_date = moEl?.value || '';
  w.move_in_date = miEl?.value || '';
  const typeEl = document.getElementById('mrw-type');
  if (typeEl) w.make_ready_type = typeEl.value === 'eviction' ? 'eviction' : 'standard';
  if (!w.unit_label) {
    showMrWizardError('Add a unit # / label to continue.', ['mrw-unit']);
    return false;
  }
  if (!w.move_out_date) {
    showMrWizardError('Move-out date is required.', ['mrw-mo']);
    return false;
  }
  if (w.move_in_date && w.move_in_date < w.move_out_date) {
    showMrWizardError('Move-in should be on or after move-out.', ['mrw-mi', 'mrw-mo']);
    return false;
  }
  return true;
}

function fieldsFromServices(services){
  const paint = (services || []).find(s => isPaintTrade(s.trade));
  const carpet = (services || []).find(s => isCarpetTrade(s.trade));
  const clean = (services || []).find(s => normalizeTradeId(s.trade) === 'cleaning');
  const extra = (services || []).find(s => !['inspection','painting','punch','carpet','cleaning'].includes(s.id) && !isPaintTrade(s.trade) && normalizeTradeId(s.trade) !== 'cleaning' && !isCarpetTrade(s.trade));
  let repair = '';
  if (carpet) repair = carpet.trade === 'carpet_replacement' ? 'Carpet replace' : 'Carpet clean';
  else if (extra) repair = repairReplaceFromTrade(extra.trade) || tradeLabel(extra.trade);
  const owner = (services || []).find(s => s.confirm === 'confirmed' && s.vendor)?.vendor
    || (services || []).find(s => s.vendor)?.vendor || '';
  return {
    paint: paint ? 'full' : '',
    repair_replace: repair,
    housekeeping: clean ? 'pending' : '',
    trade: (services || []).find(s => s.trade)?.trade || 'maintenance',
    owner_name: owner,
  };
}

async function submitMrWizard(){
  const w = state.mrw;
  if (!w) return;
  const L = lex();
  const note = carpetBeforePaintNote(w.services);
  const fields = fieldsFromServices(w.services);
  const payload = {
    unit_label: w.unit_label,
    address: w.address,
    city: w.city,
    notes: note ? ('Make ready · ' + note) : 'Make ready',
    status: 'received',
    move_out_date: w.move_out_date,
    move_in_date: w.move_in_date || null,
    scheduled_date: w.move_out_date,
    paint: fields.paint || null,
    repair_replace: fields.repair_replace || null,
    housekeeping: fields.housekeeping || null,
    trade: fields.trade || null,
    owner_name: fields.owner_name || null,
    services: w.services,
    notice_at: w.notice_at || todayKeyNY(),
    supervisor_notes: note || null,
    make_ready_type: w.make_ready_type || 'standard',
    utilities: w.utilities || { water: false, electric: false },
    pest_infestation: !!w.pest_infestation,
    pest_wait_days: mrwPestWaitDays(w),
    pest_resume_date: w.pest_resume_date || mrwPestResumeDate(w) || null,
    pest_cleared: !!w.pest_cleared,
    urgent: !!w.move_in_date,
    flexible: !w.move_in_date,
    show_ready_by: w.move_in_date ? null : (w.show_ready_by || mrwShowReadyDate(w)),
  };
  const nextBtn = document.getElementById('mrw-next');
  if (nextBtn) nextBtn.disabled = true;
  try {
    let created = null;
    try {
      const data = await api('/turns', { method:'POST', body: JSON.stringify(payload) });
      created = data.turn;
      if (created) {
        created._userCreated = true;
        created.inspected_at = created.inspected_at || null;
        // Planned inspection = day after MO when not already scheduled
        const svcs = parseTurnServices(created);
        if (svcs.length && created.move_out_date) {
          let changed = false;
          for (const s of svcs) {
            if ((s.id === 'inspection' || /inspect/i.test(s.label || '')) && !s.scheduled_date) {
              s.scheduled_date = addDaysKey(created.move_out_date, 1);
              changed = true;
            }
          }
          if (changed) { created.services = svcs; }
        }
      }
      // Ensure make-ready fields persist (older deploys may ignore on POST)
      if (created?.id) {
        try {
          await api('/turns/' + created.id, {
            method:'PATCH',
            body: JSON.stringify({
              move_out_date: payload.move_out_date,
              move_in_date: payload.move_in_date,
              paint: payload.paint,
              repair_replace: payload.repair_replace,
              housekeeping: payload.housekeeping,
              trade: payload.trade,
              owner_name: payload.owner_name,
              services: payload.services,
              notice_at: payload.notice_at,
              supervisor_notes: payload.supervisor_notes,
              scheduled_date: payload.scheduled_date,
            }),
          });
        } catch {}
      }
    } catch (apiErr) {
      // Demo / offline fallback — local board row
      if (!isDemoMode()) throw apiErr;
      const id = 'local-mr-' + Date.now().toString(36);
      const unitId = 'local-unit-' + Date.now().toString(36);
      // Ensure inspection has a planned date (day after MO) without marking it done
      const servicesOut = (w.services || []).map(s => {
        const copy = { ...s };
        const isInsp = copy.id === 'inspection' || /inspect/i.test(copy.label || '');
        if (isInsp && !copy.scheduled_date && w.move_out_date) {
          copy.scheduled_date = addDaysKey(w.move_out_date, 1);
        }
        return copy;
      });
      created = {
        id, unit_id: unitId, unit_label: w.unit_label, address: w.address, city: w.city,
        status: 'received', status_label: 'Received', pill: 'n',
        notes: payload.notes, move_out_date: w.move_out_date, move_in_date: w.move_in_date || '',
        paint: fields.paint, repair_replace: fields.repair_replace, housekeeping: fields.housekeeping,
        trade: fields.trade, owner_name: fields.owner_name, assignee: fields.owner_name,
        services: servicesOut, notice_at: payload.notice_at, notice_reversed: false,
        supervisor_notes: note || '', scheduled_date: w.move_out_date,
        make_ready_type: w.make_ready_type || 'standard',
        utilities: w.utilities || { water: false, electric: false },
        pest_infestation: !!w.pest_infestation,
        pest_wait_days: mrwPestWaitDays(w),
        pest_resume_date: w.pest_resume_date || mrwPestResumeDate(w) || '',
        pest_cleared: !!w.pest_cleared,
        urgent: !!w.move_in_date,
        flexible: !w.move_in_date,
        show_ready_by: w.move_in_date ? '' : (w.show_ready_by || mrwShowReadyDate(w)),
        created_at: new Date().toISOString(), inspected_at: null, handoff_at: null, completed_at: null,
        photo_count: 0, has_photo_proof: false, demo: true, _localCreate: true, _userCreated: true,
      };
      state.turns.push(created);
      if (!(state.units || []).some(u => u.id === unitId)) {
        state.units.push({ id: unitId, label: w.unit_label, address: w.address, city: w.city });
      }
    }
    // Push confirmed services onto calendar as events (demo / local)
    for (const s of w.services) {
      if (s.confirm === 'confirmed' && s.vendor && !s.blocked_utils && !s.paused_pest) {
        const dateKey = s.scheduled_date || w.move_out_date;
        state.events = state.events || [];
        state.events.push({
          id: 'svc-' + (created?.id || 'x') + '-' + s.id,
          unit_id: created?.unit_id,
          unit_label: w.unit_label,
          vendor_name: s.vendor,
          vendor_type: s.trade,
          trade: s.trade,
          title: s.label,
          status: 'scheduled',
          starts_at: dateKey + 'T09:00:00-04:00',
          ends_at: dateKey + 'T11:00:00-04:00',
          owner_name: s.vendor,
          assignee: s.vendor,
          demo: true,
        });
      }
    }
    closeMrWizard();
    toast((L.Unit) + ' ' + w.unit_label + ' created — on the board');
    try { await refresh(); } catch {
      renderMakeReadyBoard();
      renderBoard();
      renderRollingNotices();
    }
    location.hash = 'make-ready';
  } catch (e) {
    toast(e.message || 'Could not create');
  } finally {
    if (nextBtn) nextBtn.disabled = false;
  }
}

async function mrwNext(){
  const w = state.mrw;
  if (!w) {
    toast('Create form closed — tap + Create again');
    return;
  }
  if (w.step === 1) {
    if (!readMrWizardStep1()) return;
    w.step = 2;
    renderMrWizard();
    return;
  }
  if (w.step === 2) {
    if (!w.services.length) {
      showMrWizardError('Add at least one service to the pipeline.');
      return;
    }
    w.step = 3;
    renderMrWizard();
    return;
  }
  await submitMrWizard();
}

function mrwBack(){
  const w = state.mrw;
  if (!w || w.step <= 1) return;
  // Do NOT call readMrWizardStep1 here — step 2/3 have no unit/MO inputs and would wipe the draft
  w.step -= 1;
  renderMrWizard();
}

/* ── Rolling 60-day move-out notices ── */

function rollingNoticeTurns(){
  const today = todayKeyNY();
  const end = addDaysKey(today, 60);
  return (state.turns || []).filter(t => {
    if (!t.move_out_date) return false;
    if (t.status === 'cancelled') return false;
    const mo = nyDateKey(t.move_out_date);
    return mo >= today && mo <= end;
  }).sort((a, b) => String(a.move_out_date).localeCompare(String(b.move_out_date)));
}

function weekStartKey(key){
  const d = parseKey(key);
  const sun = addDaysKey(key, -d.getDay());
  return sun;
}

function weekLabel(startKey){
  const end = addDaysKey(startKey, 6);
  const a = parseKey(startKey);
  const b = parseKey(end);
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  const right = b.toLocaleDateString('en-US', sameMonth ? { day:'numeric' } : { month:'short', day:'numeric' });
  // "first week of December" style when start is near month start
  const dayNum = a.getDate();
  const monthName = a.toLocaleDateString('en-US', { month:'long' });
  let ordinal = '';
  if (dayNum <= 7) ordinal = 'first week of ' + monthName;
  else if (dayNum <= 14) ordinal = 'second week of ' + monthName;
  else if (dayNum <= 21) ordinal = 'third week of ' + monthName;
  else ordinal = 'late ' + monthName;
  return { range: left + ' – ' + right, ordinal };
}

function renderRollingNotices(){
  const groupsEl = document.getElementById('mrb-notice-groups');
  const remEl = document.getElementById('mrb-reminders');
  const countEl = document.getElementById('mrb-notices-count');
  const subEl = document.getElementById('mrb-notices-sub');
  if (!groupsEl) return;
  const L = lex();
  const rows = rollingNoticeTurns();
  const active = rows.filter(t => !t.notice_reversed);
  if (countEl) countEl.textContent = String(active.length);
  if (subEl) subEl.textContent = active.length
    ? (active.length + ' ' + (active.length === 1 ? L.unit : L.unit_plural) + ' moving out in the next 60 days')
    : 'No move-outs in the next 60 days';

  // Supervisor reminders by week
  const byWeek = {};
  for (const t of active) {
    const wk = weekStartKey(nyDateKey(t.move_out_date));
    byWeek[wk] = byWeek[wk] || [];
    byWeek[wk].push(t);
  }
  const reminderKeys = Object.keys(byWeek).sort().filter(k => byWeek[k].length >= 3);
  if (remEl) {
    remEl.innerHTML = reminderKeys.slice(0, 4).map(k => {
      const lab = weekLabel(k);
      const n = byWeek[k].length;
      return `<div class="mrb-reminder"><div class="ri">${n}</div><div><b>${esc(lab.ordinal)}</b> has ${n} ${n===1?L.unit:L.unit_plural} moving out <span style="color:var(--muted);font-weight:600">(${esc(lab.range)})</span></div></div>`;
    }).join('') || (active.length ? '' : '');
  }

  if (!rows.length) {
    groupsEl.innerHTML = `<div class="mrb-notices-empty">Notices show here by move-out month and week — e.g. an Oct notice for a Dec move-out lands in December.</div>`;
    return;
  }

  // Group by month then week
  const byMonth = {};
  for (const t of rows) {
    const mo = nyDateKey(t.move_out_date);
    const monthKey = mo.slice(0, 7);
    byMonth[monthKey] = byMonth[monthKey] || {};
    const wk = weekStartKey(mo);
    byMonth[monthKey][wk] = byMonth[monthKey][wk] || [];
    byMonth[monthKey][wk].push(t);
  }
  const monthKeys = Object.keys(byMonth).sort();
  groupsEl.innerHTML = monthKeys.map(mk => {
    const [y, m] = mk.split('-').map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month:'long', year:'numeric' });
    const weeks = Object.keys(byMonth[mk]).sort();
    const weeksHtml = weeks.map(wk => {
      const lab = weekLabel(wk);
      const list = byMonth[mk][wk];
      return `<div class="mrb-ng-week">
        <div class="mrb-ng-week-h">${esc(lab.ordinal)} <span class="n">${list.filter(t=>!t.notice_reversed).length}</span>
          <span style="font-weight:600;color:var(--faint)">${esc(lab.range)}</span></div>
        <div class="mrb-ng-list">${list.map(t => {
          const rev = !!t.notice_reversed;
          const who = assigneeOf(t) || '';
          return `<div class="mrb-notice${rev?' reversed':''}" data-turn="${esc(t.id)}">
            <div>
              <div class="nu">${esc(L.Unit)} ${esc(t.unit_label)}${rev ? ' · stayed' : ''}</div>
              <div class="nm">MO ${esc(fmtDate(t.move_out_date))}${t.notice_at ? ' · notice ' + esc(fmtDate(t.notice_at)) : ''}${who ? ' · ' + esc(who) : ''}</div>
            </div>
            <div class="nr">
              <span class="pill ${rev?'n':(STATUS_META[t.status]?.pill||'n')}">${esc(rev ? 'Reversed' : (t.status==='complete'?'Tended':(STATUS_META[t.status]?.label||t.status)))}</span>
              <button type="button" class="btn-rev" data-rev="${esc(t.id)}">${rev ? 'Restore notice' : 'Resident stayed'}</button>
            </div>
          </div>`;
        }).join('')}</div>
      </div>`;
    }).join('');
    return `<div><div class="mrb-ng-month">${esc(monthName)}</div>${weeksHtml}</div>`;
  }).join('');

  groupsEl.querySelectorAll('.mrb-notice[data-turn]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-rev]')) return;
      openTurn(el.dataset.turn);
    });
  });
  groupsEl.querySelectorAll('[data-rev]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.rev;
      const t = state.turns.find(x => x.id === id);
      if (!t) return;
      const next = !t.notice_reversed;
      t.notice_reversed = next;
      try {
        if (!String(id).startsWith('demo-') && !String(id).startsWith('local-')) {
          await api('/turns/' + id, { method:'PATCH', body: JSON.stringify({ notice_reversed: next }) });
        }
      } catch {}
      toast(next ? 'Notice reversed — resident stayed' : 'Notice restored');
      renderRollingNotices();
      renderMakeReadyBoard();
    });
  });
}


const titles = { turns:'Turns', 'make-ready':'Make Ready Board', 'common-areas':'Common areas', schedule:'Schedule', units:'Units', history:'History', service:'Request service', houses:'Address board', 'houses-map':'House map', 'houses-routes':'House routes' };
function showView(name){
  document.documentElement.removeAttribute('data-boot-view');
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = document.getElementById('view-' + name);
  if (el) { el.classList.remove('hidden'); el.classList.add('view'); }
  const L = lex();
  const titleMap = { ...titles, units: L.Unit_plural };
  document.getElementById('top-title').textContent = titleMap[name] || name;
  document.querySelectorAll('.nav a[data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === name));
  closeSb();
  if (name === 'schedule') loadSchedule().catch(e => toast(e.message));
  if (name === 'service') loadService().catch(e => toast(e.message));
  if (name === 'history') renderHistory(document.getElementById('hist-q')?.value || '');
  if (name === 'make-ready') renderMakeReadyBoard();
  if (name === 'common-areas') renderCommonAreasView();
  if (name === 'houses' || name === 'houses-map' || name === 'houses-routes') {
    try { window.HubHouses && window.HubHouses.render(name); } catch (err) { toast(err.message || 'Houses view failed'); }
  }
}
function route(){
  const raw = (location.hash || '#make-ready').slice(1);
  const parts = raw.split('/');
  const h = parts[0];
  if (h.startsWith('houses') && window.HubHouses) {
    const sel = document.getElementById('property-mode-app');
    if (sel && sel.value !== 'sfh') sel.value = 'sfh';
    if (state.user) state.user.property_mode = 'sfh';
    try { sessionStorage.setItem('hub_property_mode', 'sfh'); } catch {}
    window.HubHouses.applyMode('sfh', { navigate: false });
  }
  const allowed = ['turns','make-ready','common-areas','schedule','units','history','service','houses','houses-map','houses-routes'];
  const fallback = document.body.classList.contains('portfolio-houses') ? 'houses' : 'make-ready';
  showView(allowed.includes(h) ? h : fallback);
  // Deep-links: #common-areas/new · #common-areas/viewing · #common-areas/viewing/new
  if (h === 'common-areas') {
    if (parts[1] === 'viewing') {
      state.caTab = 'viewing';
      renderCommonAreasView();
      if (parts[2] === 'new') setTimeout(() => openVwModal(null), 50);
    } else if (parts[1] === 'new') {
      state.caTab = 'common';
      renderCommonAreasView();
      setTimeout(() => openCaModal(null), 50);
    }
  }
}
window.addEventListener('hashchange', route);

const sb = document.getElementById('sidebar');
const ov = document.getElementById('sb-overlay');
function closeSb(){ sb.classList.remove('open'); ov.classList.remove('open'); }
document.getElementById('burger').onclick = () => { sb.classList.add('open'); ov.classList.add('open'); };
ov.onclick = closeSb;
document.getElementById('drawer-close').onclick = closeDrawer;
document.getElementById('drawer-bg').onclick = closeDrawer;

document.getElementById('btn-signout').onclick = async (e) => {
  e.preventDefault();
  await api('/auth/logout', { method:'POST', body:'{}' }).catch(()=>{});
  location.href = 'index.html';
};

document.getElementById('btn-request-turn').onclick = () => {
  document.getElementById('modal').style.display = 'block';
  document.getElementById('modal-bg').style.display = 'block';
};
document.getElementById('m-cancel').onclick = () => {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-bg').style.display = 'none';
};
document.getElementById('modal-bg').onclick = document.getElementById('m-cancel').onclick;
document.getElementById('m-save').onclick = async () => {
  try {
    await api('/turns', {
      method:'POST',
      body: JSON.stringify({
        unit_label: document.getElementById('m-unit').value.trim(),
        address: document.getElementById('m-addr').value.trim(),
        city: document.getElementById('m-city').value.trim(),
        notes: document.getElementById('m-notes').value.trim(),
        status: 'received',
      }),
    });
    document.getElementById('m-cancel').onclick();
    toast('Turn requested');
    await refresh();
  } catch (e) { toast(e.message); }
};

async function createShare(){
  const unitId = document.getElementById('share-unit').value || state.focusUnitId;
  const vendor = document.getElementById('share-vendor').value.trim() || 'Vendor';
  const tradeSel = document.getElementById('share-trade');
  const tradeId = normalizeTradeId((tradeSel && tradeSel.value) || 'carpet_cleaning') || 'carpet_cleaning';
  const tradeTxt = tradeLabel(tradeId);
  if (!unitId) { toast('Pick a unit first'); return; }
  if (UNIT_TRADE_BY_ID[tradeId]?.noInvite) {
    toast('Fire alarm / inspection locks the calendar — no vendor invite');
    return;
  }
  try {
    const data = await api('/schedule', {
      method:'POST',
      body: JSON.stringify({
        unit_id: unitId,
        vendor_name: vendor,
        vendor_type: tradeId,
        title: tradeTxt || vendor,
        status: 'pending',
        create_share_link: true,
      }),
    });
    const url = location.origin + (data.event.share_url || ('/portal/share.html?t=' + data.event.share_token));
    document.getElementById('share-url').textContent = url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      toast('Share link copied');
    } else toast('Share link ready');
    state.focusUnitId = unitId;
    await loadSchedule(unitId);
  } catch (e) { toast(e.message); }
}
document.getElementById('btn-share').onclick = createShare;
document.getElementById('btn-create-share').onclick = createShare;
(function fillShareTradeOptions(){
  const sel = document.getElementById('share-trade');
  if (!sel || sel.options.length > 1) return;
  // Fire alarm/inspection are calendar locks only — never offer invite
  sel.innerHTML = SHAREABLE_TRADES.map(t =>
    `<option value="${t.id}" ${t.id==='carpet_cleaning'?'selected':''}>${t.label}</option>`
  ).join('');
})();
document.getElementById('d-share').onclick = () => {
  location.hash = 'schedule';
  createShare();
};

// Calendar controls — obvious, big taps, one next action
document.getElementById('sched-tab-cal')?.addEventListener('click', () => { setSchedTab('cal'); renderCalendar(); });
document.getElementById('sched-tab-list')?.addEventListener('click', () => { setSchedTab('list'); });
document.getElementById('cal-prev')?.addEventListener('click', () => {
  ensureCalState();
  const c = state.cal.cursor;
  if (state.cal.mode === 'day') {
    state.cal.selected = addDaysKey(state.cal.selected || todayKeyNY(), -1);
    state.cal.cursor = parseKey(state.cal.selected);
  } else if (state.cal.mode === 'week') {
    state.cal.selected = addDaysKey(state.cal.selected || todayKeyNY(), -7);
    state.cal.cursor = parseKey(state.cal.selected);
  } else {
    state.cal.cursor = new Date(c.getFullYear(), c.getMonth() - 1, 1, 12, 0, 0);
  }
  renderCalendar();
});
document.getElementById('cal-next')?.addEventListener('click', () => {
  ensureCalState();
  const c = state.cal.cursor;
  if (state.cal.mode === 'day') {
    state.cal.selected = addDaysKey(state.cal.selected || todayKeyNY(), 1);
    state.cal.cursor = parseKey(state.cal.selected);
  } else if (state.cal.mode === 'week') {
    state.cal.selected = addDaysKey(state.cal.selected || todayKeyNY(), 7);
    state.cal.cursor = parseKey(state.cal.selected);
  } else {
    state.cal.cursor = new Date(c.getFullYear(), c.getMonth() + 1, 1, 12, 0, 0);
  }
  renderCalendar();
});
document.getElementById('cal-today')?.addEventListener('click', () => {
  ensureCalState();
  const t = todayKeyNY();
  state.cal.selected = t;
  state.cal.cursor = parseKey(t);
  renderCalendar();
});
document.getElementById('cal-mode-month')?.addEventListener('click', () => {
  ensureCalState();
  state.cal.mode = 'month';
  renderCalendar();
});
document.getElementById('cal-mode-week')?.addEventListener('click', () => {
  ensureCalState();
  state.cal.mode = 'week';
  renderCalendar();
});
document.getElementById('cal-mode-day')?.addEventListener('click', () => {
  ensureCalState();
  state.cal.mode = 'day';
  if (!state.cal.selected) state.cal.selected = todayKeyNY();
  state.cal.cursor = parseKey(state.cal.selected);
  renderCalendar();
});
document.getElementById('cal-day-close')?.addEventListener('click', () => {
  const list = document.getElementById('cal-day-list');
  if (list) list.innerHTML = '<div class="cal-empty">Pick a day on the calendar</div>';
  document.getElementById('cal-day-title').textContent = 'Pick a day';
  document.getElementById('cal-day-sub').textContent = 'Tap a date to open turns and visits';
  document.getElementById('cal-day-close').hidden = true;
  document.querySelectorAll('.cal-cell.selected').forEach(el => el.classList.remove('selected'));
});
document.getElementById('sched-unit-filter')?.addEventListener('change', () => {
  loadSchedule().catch(e => toast(e.message));
});




document.getElementById('d-return')?.addEventListener('click', () => {
  if (!state.focusTurnId) return;
  openActionModal({ kind:'return', turnId: state.focusTurnId });
});
document.getElementById('d-reschedule')?.addEventListener('click', () => {
  if (!state.focusTurnId) return;
  openActionModal({ kind:'reschedule', turnId: state.focusTurnId });
});
document.getElementById('d-cancel-turn')?.addEventListener('click', () => {
  if (!state.focusTurnId) return;
  openActionModal({ kind:'cancel_turn', turnId: state.focusTurnId });
});
document.getElementById('a-cancel')?.addEventListener('click', closeActionModal);
document.getElementById('action-modal-bg')?.addEventListener('click', closeActionModal);
document.getElementById('a-save')?.addEventListener('click', submitActionModal);

document.getElementById('hist-q')?.addEventListener('input', (e) => {
  renderHistory(e.target.value);
});

document.getElementById('svc-unit')?.addEventListener('change', onServiceUnitChange);
document.getElementById('svc-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('svc-submit');
  const unitId = document.getElementById('svc-unit').value || null;
  const address = document.getElementById('svc-addr').value.trim();
  const city = document.getElementById('svc-city').value.trim();
  const description = document.getElementById('svc-desc').value.trim();
  if (!description) { toast('Add a short description'); return; }
  if (!unitId && !address) { toast('Pick a property/unit or enter an address'); return; }
  const unit = unitId ? state.units.find(x => x.id === unitId) : null;
  btn.disabled = true;
  try {
    await api('/service-requests', {
      method: 'POST',
      body: JSON.stringify({
        unit_id: unitId,
        property_label: unit ? unit.label : (address || null),
        address: address || (unit && unit.address) || null,
        city: city || (unit && unit.city) || null,
        service_type: document.getElementById('svc-type').value,
        urgency: document.getElementById('svc-urgency').value,
        description,
        po_number: document.getElementById('svc-po').value.trim() || null,
        contact_phone: document.getElementById('svc-phone').value.trim() || null,
      }),
    });
    document.getElementById('svc-desc').value = '';
    document.getElementById('svc-po').value = '';
    document.getElementById('svc-phone').value = '';
    toast('Request sent to TendCo');
    await refresh();
    await loadService();
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; }
});


document.querySelectorAll('.photo-upload-btn input[type=file]').forEach(input => {
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    const kind = input.dataset.kind || 'proof';
    input.value = '';
    if (!file || !state.focusTurnId) return;
    const status = document.getElementById('d-photo-status');
    try {
      if (status) status.textContent = 'Compressing…';
      const compressed = await compressImageFile(file);
      if (status) status.textContent = 'Uploading…';
      await api('/turns/' + state.focusTurnId + '/photos', {
        method: 'POST',
        body: JSON.stringify({ kind, ...compressed }),
      });
      toast((kind.charAt(0).toUpperCase()+kind.slice(1)) + ' photo added');
      await refresh();
      openTurn(state.focusTurnId);
    } catch (e) { toast(e.message); if (status) status.textContent = e.message; }
  });
});

document.getElementById('d-punch-save')?.addEventListener('click', async () => {
  if (!state.focusTurnId) return;
  try {
    await api('/turns/' + state.focusTurnId + '/punch', {
      method: 'POST',
      body: JSON.stringify({
        checklist: state.punchDraft || [],
        note: document.getElementById('d-punch-note')?.value || '',
        set_punch: true,
      }),
    });
    toast('Punch list saved');
    await refresh();
    openTurn(state.focusTurnId);
  } catch (e) { toast(e.message); }
});

document.getElementById('d-punch-done')?.addEventListener('click', async () => {
  if (!state.focusTurnId) return;
  try {
    const data = await api('/turns/' + state.focusTurnId + '/punch', {
      method: 'POST',
      body: JSON.stringify({
        checklist: state.punchDraft || [],
        note: document.getElementById('d-punch-note')?.value || '',
        done_with_proof: true,
      }),
    });
    celebrateComplete(state.turns.find(t => t.id === state.focusTurnId) || { id: state.focusTurnId });
    if (data.notify) toast('Tended — PM notified by email');
    else toast('Marked ready');
    await refresh();
    openTurn(state.focusTurnId);
  } catch (e) { toast(e.message); }
});


function bindCreateMrWizardControls(){
  const open = (e) => { e?.preventDefault?.(); openCreateMrWizard(); };
  document.getElementById('btn-create-mr')?.addEventListener('click', open);
  document.getElementById('btn-nav-create-mr')?.addEventListener('click', open);
  document.getElementById('btn-top-create-mr')?.addEventListener('click', open);

  window.__mrwClose = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    closeMrWizard();
  };
  window.__mrwBack = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    mrwBack();
  };
  window.__mrwNext = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    mrwNext().catch(err => toast(err.message || 'Could not continue'));
  };

  // Dimmed backdrop = the root itself (not a covering sibling). Only close when the tap is on the dim, not the card.
  document.getElementById('mr-wizard-root')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeMrWizard();
  });
  // Keep card taps from bubbling to root
  document.getElementById('mr-wizard')?.addEventListener('click', (e) => e.stopPropagation());

  // Buttons use HTML onclick → window.__mrw* (avoids double-binding with addEventListener)
}
bindCreateMrWizardControls();

// On-call modal
document.getElementById('oncall-cancel')?.addEventListener('click', closeOnCallModal);
document.getElementById('oncall-modal-bg')?.addEventListener('click', closeOnCallModal);
document.getElementById('oncall-save')?.addEventListener('click', confirmOnCallModal);

// Log complete modal
document.getElementById('lc-cancel')?.addEventListener('click', closeLogComplete);
document.getElementById('log-complete-modal-bg')?.addEventListener('click', closeLogComplete);
document.getElementById('lc-save')?.addEventListener('click', () => { confirmLogComplete().catch(e => toast(e.message)); });
document.getElementById('lc-role-tech')?.addEventListener('change', syncLogCompleteRoleUI);
document.getElementById('lc-role-sup')?.addEventListener('change', syncLogCompleteRoleUI);

// Team setup / invite
document.getElementById('team-later')?.addEventListener('click', () => dismissTeamSetup(true));
document.getElementById('team-ready')?.addEventListener('click', () => dismissTeamSetup(true));
document.getElementById('team-copy')?.addEventListener('click', () => { copyTeamInvite(); });
document.getElementById('team-setup-modal-bg')?.addEventListener('click', () => dismissTeamSetup(true));
document.getElementById('btn-invite-team')?.addEventListener('click', (e) => {
  e.preventDefault();
  openTeamSetupModal(true);
});

/* create16 — Common areas + Viewing modal wiring */
document.getElementById('btn-ca-create')?.addEventListener('click', () => {
  if ((state.caTab || 'common') === 'viewing') openVwModal(null);
  else openCaModal(null);
});
document.querySelectorAll('[data-ca-tab]').forEach(btn => {
  btn.addEventListener('click', () => setCaTab(btn.dataset.caTab));
});
document.getElementById('ca-cancel')?.addEventListener('click', closeCaModal);
document.getElementById('ca-modal-bg')?.addEventListener('click', closeCaModal);
document.getElementById('ca-save')?.addEventListener('click', saveCaModal);
document.getElementById('ca-delete')?.addEventListener('click', deleteCaModal);
document.getElementById('ca-type')?.addEventListener('change', () => applyCaTypeDefaults(true));
document.getElementById('ca-cadence')?.addEventListener('change', () => {
  const cad = document.getElementById('ca-cadence')?.value || 'weekly';
  const meta = CA_TYPE_BY_ID[document.getElementById('ca-type')?.value || 'model'] || {};
  if (cad === '5x') {
    document.querySelectorAll('#ca-days input[type=checkbox]').forEach(cb => {
      cb.checked = [1,2,3,4,5].includes(Number(cb.value));
    });
  }
});
document.getElementById('ca-staff-inhouse')?.addEventListener('change', caSyncVendorVisibility);
document.getElementById('ca-staff-outsourced')?.addEventListener('change', caSyncVendorVisibility);
document.getElementById('vw-cancel')?.addEventListener('click', closeVwModal);
document.getElementById('vw-modal-bg')?.addEventListener('click', closeVwModal);
document.getElementById('vw-save')?.addEventListener('click', saveVwModal);
document.getElementById('vw-delete')?.addEventListener('click', deleteVwModal);
document.getElementById('vw-cadence')?.addEventListener('change', syncVwCadenceUI);
document.getElementById('vw-kind')?.addEventListener('change', (e) => {
  const k = e.target.value;
  const title = document.getElementById('vw-title');
  if (!title || title.value.trim()) return;
  const map = { fire_inspection: 'Fire inspection', landscaper: 'Landscaper visit', elevator: 'Elevator maintenance', pool_view: 'Pool check (no company)', other: '' };
  syncVwCadenceUI();
  if (map[k]) title.value = map[k];
});

refresh().then(() => {
  const qMode = (new URLSearchParams(location.search).get('mode') || '').toLowerCase();
  const hashView = (location.hash || '').replace(/^#/, '').split('/')[0];
  const wantHouses = (state.user && state.user.property_mode === 'sfh') || qMode === 'houses' || qMode === 'sfh' || hashView.startsWith('houses');
  // Make Ready Board stays the default. Houses is an explicit portfolio switch.
  if (wantHouses) {
    if (state.user) state.user.property_mode = 'sfh';
    try { sessionStorage.setItem('hub_property_mode', 'sfh'); } catch {}
    const sel = document.getElementById('property-mode-app');
    if (sel) sel.value = 'sfh';
    try { if (window.HubHouses) window.HubHouses.applyMode('sfh', { navigate: false }); } catch {}
    if (!hashView.startsWith('houses')) location.hash = 'houses';
  } else if (!location.hash || location.hash === '#' || location.hash === '#turns') {
    location.hash = 'make-ready';
  }
  route();
  if (isDemoMode()) {
    setTimeout(() => openTeamSetupModal(false), 600);
  }
}).catch(e => {
  if (e.message !== 'auth') toast(e.message || 'Failed to load');
  const hashView = (location.hash || '').replace(/^#/, '').split('/')[0];
  if (hashView.startsWith('houses')) {
    try { route(); } catch {}
  }
});
