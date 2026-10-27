/* create20 — Freely draggable Tendy + tappable unit refs → make-ready detail. Typed only. */
(function () {
  'use strict';

  const TENDY_IMG = 'assets/tendy-icon.webp';
  const TENDY_IMG_FALLBACK = 'assets/tendy-icon.png';
  const POS_KEY = 'hub_tendy_pos_v1';
  const CITE_PIPELINE = 'Source: Make Ready Board · unit pipeline';

  const FAQ = [
    {
      id: 'keys',
      tags: ['key', 'keys', '3pm', '3 pm', 'unlocked', 'drop box', 'dropbox', 'return key'],
      cite: 'Source: Hub make-ready · key handling (3 PM+)',
      answer:
        'For jobs that start at 3 PM or later, pick how keys are handled:\n' +
        '• Leave unlocked (recommended) — bring keys before you leave and leave the unit unlocked.\n' +
        '• Drop box — leave keys in the property drop box after the job.\n' +
        '• Take & return — take the keys and return them the next day.\n' +
        'Property default is usually Leave unlocked.',
    },
    {
      id: 'utilities',
      tags: ['water', 'electric', 'utilities', 'utility', 'power', 'cleaning blocked'],
      cite: 'Source: Hub make-ready · utilities gate',
      answer:
        'Confirm water and electric are both on before cleaning or carpet cleaning. ' +
        'Those services stay blocked until both utilities are checked. ' +
        'Painting, punch, carpet replace, bathtub, and inspection are not blocked by utilities.',
    },
    {
      id: 'pest',
      tags: ['pest', 'bug', 'infestation', 'pest-block', 'pest block', 'wait'],
      cite: 'Source: Hub make-ready · pest hard gate',
      answer:
        'When pest infestation is active (or pest control is on the unit), other services pause. ' +
        'Only pest work is schedulable until the wait clears — default wait is 2 work days after the last pest day (Sundays skipped). ' +
        'Clear infestation / mark pest complete in the unit drawer to lift the gate.',
    },
    {
      id: 'trash',
      tags: ['trash out', 'trash-out', 'trashout', 'junk'],
      cite: 'Source: Hub make-ready · service order',
      answer:
        'Trash out comes first when it is on the unit (unless eviction lock or active pest reorder the front). ' +
        'It gets its own day in the spread.',
    },
    {
      id: 'eviction',
      tags: ['eviction', 'evict', 'lock then trash'],
      cite: 'Source: Hub make-ready · eviction order',
      answer:
        'Eviction make-readies auto-seed Change of lock → Trash out → Full inspection. ' +
        'Hard order: Lock #1, then Pest if present, then Trash, then Full inspection, middle trades, bathtub last. ' +
        'Drag cannot pull those front steps out of place.',
    },
    {
      id: 'bathtub',
      tags: ['bathtub', 'tub resurface', 'tub', 'resurfacing'],
      cite: 'Source: Hub make-ready · service order',
      answer:
        'Bathtub resurfacing is always last in the pipeline and needs 2 consecutive work days.',
    },
    {
      id: 'schedule',
      tags: ['schedule', 'slot', '8am', '8 am', '12pm', '12 pm', '6pm', '6 pm', 'hours', 'booking'],
      cite: 'Source: Hub schedule · preferred slots',
      answer:
        'Preferred booking windows are 8 AM and 12 PM (~4 hours each). ' +
        'No scheduled work ends past 6 PM. Day grid shows from early morning through evening for planning.',
    },
    {
      id: 'one_per_day',
      tags: ['one service', 'per day', 'double book', 'double-book', 'same day'],
      cite: 'Source: Hub make-ready · date spread',
      answer:
        'Default is one service per day when the MO→MI window allows. ' +
        'Double-book only when the window forces it (amber flag). ' +
        'Special share: Cleaning (AM) + Carpet cleaning (PM) can share one day when tight.',
    },
    {
      id: 'fire_week',
      tags: [
        'fire inspection', 'fire week', 'fire company', 'fire inspect', 'fire alarm',
        'calendar lock', 'busy week', 'fire system', 'sprinkler', 'extinguisher', 'secure pets',
      ],
      cite: 'Source: Hub Viewing · fire inspection week',
      answer:
        'Fire inspection week locks the calendar (team busy). Viewing only — no vendor messages or approvals from Hub.\n\n' +
        'Make sure you send notices to residents before the fire company comes.\n' +
        'Remind residents to take fire extinguishers from inside units out to the hallway (or outside) before the inspection.\n' +
        'Remind residents to secure pets.',
    },
  ];

  const FIRE_WEEK_NUDGES = [
    'Make sure you send notices to residents before the fire company comes.',
    'Remind residents to take fire extinguishers from inside units out to the hallway (or outside) before the inspection.',
    'Remind residents to secure pets.',
  ];
  const FIRE_NUDGE_CITE = 'Source: Hub Viewing · fire inspection week';

  function fireNudgePayload() {
    return {
      text: FIRE_WEEK_NUDGES.join('\n'),
      cite: FIRE_NUDGE_CITE,
      admin: false,
    };
  }

  function isFireWeekActiveNow() {
    try {
      if (typeof fireWeekActive === 'function') return !!fireWeekActive();
    } catch {}
    return false;
  }

  function findUnitStatus(q) {
    const m = String(q || '').match(/\b([A-Z]?\-?\d{2,4}[A-Z]?|[A-Z]\-\d{2,4}|\d{3,4})\b/i);
    const needle = m ? m[1].toUpperCase() : '';
    if (!needle || typeof state === 'undefined' || !state.turns) return null;
    const turns = state.turns || [];
    const hit =
      turns.find((t) => String(t.unit_label || '').toUpperCase() === needle) ||
      turns.find((t) => String(t.unit_label || '').toUpperCase().replace(/-/g, '') === needle.replace(/-/g, '')) ||
      turns.find((t) => String(t.unit_label || '').toUpperCase().includes(needle));
    if (!hit) return null;
    const st = hit.status || 'scheduled';
    const who = hit.owner_name || hit.vendor_name || hit.assignee || 'Unassigned';
    const tradeBit = hit.trade ? String(hit.trade).replace(/_/g, ' ') : '';
    const actions = [];
    // Surface schedule / open actions for primary trade + pipeline services
    try {
      const svcs = (typeof parseTurnServices === 'function' ? parseTurnServices(hit) : hit.services) || [];
      svcs.forEach((s) => {
        if (!s) return;
        const label = s.label || (typeof tradeLabel === 'function' ? tradeLabel(s.trade) : s.trade) || 'service';
        const vendor = s.vendor || who || '';
        const ready = s.confirm === 'confirmed' && s.scheduled_date;
        actions.push({
          serviceId: s.id,
          turnId: hit.id,
          text: ready
            ? label + (vendor ? ' · ' + vendor : '')
            : 'Schedule' + (vendor ? ' ' + vendor : '') + ' · ' + label,
        });
      });
    } catch (_) {}
    if (!actions.length && hit.trade) {
      actions.push({
        serviceId: hit.trade,
        turnId: hit.id,
        text: 'Schedule' + (who && who !== 'Unassigned' ? ' ' + who : '') + ' · ' + tradeBit,
      });
    }
    return {
      text:
        'Unit ' +
        (hit.unit_label || needle) +
        ' is ' +
        st.replace(/_/g, ' ') +
        (who && who !== 'Unassigned' ? ' · ' + who : '') +
        (tradeBit ? ' · ' + tradeBit : '') +
        '.',
      cite: 'Source: Make Ready Board · live unit row',
      admin: false,
      unitLabel: hit.unit_label || needle,
      turnId: hit.id,
      actions: actions.slice(0, 6),
    };
  }

  function matchFaq(q) {
    const n = String(q || '').toLowerCase();
    for (const f of FAQ) {
      if (f.tags.some((t) => n.includes(t))) {
        return { text: f.answer, cite: f.cite, admin: false };
      }
    }
    return null;
  }

  function replyTo(q) {
    const n = String(q || '').toLowerCase();
    if (
      /fire/.test(n) ||
      /secure pets/.test(n) ||
      /extinguisher/.test(n) ||
      /calendar lock/.test(n) ||
      /busy week/.test(n)
    ) {
      const faq = FAQ.find((f) => f.id === 'fire_week');
      return { text: faq.answer, cite: faq.cite, admin: false };
    }
    const unit = findUnitStatus(q);
    if (unit) return unit;
    const faq = matchFaq(q);
    if (faq) return faq;
    if (/vendor|outside|landscap|elevator|common area|pool company/.test(n)) {
      return {
        text:
          'I only help with unit make-ready and fire-inspection Viewing nudges. ' +
          'Common-area vendors and other Viewing reminders stay on their Hub cards — I don’t message outside vendors.',
        cite: 'Source: TendCo Hub · Tendy · Viewing only',
        admin: false,
      };
    }
    return {
      text: 'I don’t know that — looping in your admin.',
      cite: 'Source: TendCo Hub · Tendy',
      admin: true,
    };
  }

  function messageAdmin() {
    if (typeof toast === 'function') toast('Message sent to your admin (demo)');
  }

  function imgTag(size) {
    return (
      '<img src="' +
      TENDY_IMG +
      '" alt="Tendy" width="' +
      size +
      '" height="' +
      size +
      '" decoding="async" onerror="this.onerror=null;this.src=\'' +
      TENDY_IMG_FALLBACK +
      '\'">'
    );
  }

  function loadPos() {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (p && typeof p.left === 'number' && typeof p.top === 'number') return p;
    } catch {}
    return null;
  }

  function savePos(left, top) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ left, top }));
    } catch {}
  }

  function clampPos(left, top, w, h) {
    const pad = 8;
    const maxL = Math.max(pad, window.innerWidth - w - pad);
    const maxT = Math.max(pad, window.innerHeight - h - pad);
    return {
      left: Math.min(maxL, Math.max(pad, left)),
      top: Math.min(maxT, Math.max(pad, top)),
    };
  }

  function defaultPos(w, h) {
    // First visit only — bottom-right start. After drag, localStorage wins; never snap back.
    const left = Math.max(16, window.innerWidth - w - 24);
    const top = Math.max(16, window.innerHeight - h - 24);
    return clampPos(left, top, w, h);
  }

  function buildUi() {
    const mount = document.getElementById('tendy-mount');
    if (!mount) return;
    if (mount.dataset.ready === '1') return;
    mount.dataset.ready = '1';
    mount.className = 'tendy-float';
    mount.setAttribute('data-create', '19');
    mount.innerHTML =
      '<button type="button" class="tendy-teaser" id="tendy-open" aria-expanded="false" aria-controls="tendy-panel" title="Drag me anywhere · click to chat">' +
      '<span class="tendy-av" aria-hidden="true" id="tendy-drag-handle">' +
      imgTag(44) +
      '</span>' +
      '<span class="tendy-bubble-teaser">' +
      '<b>Need help?</b>' +
      '<span>I’m Tendy, your automated assistant. Ask me anything!</span>' +
      '</span>' +
      '</button>' +
      '<div class="tendy-panel" id="tendy-panel" role="dialog" aria-labelledby="tendy-title" hidden>' +
      '<div class="tendy-head">' +
      '<div class="tendy-head-av">' +
      imgTag(28) +
      '</div>' +
      '<div class="tendy-head-meta"><b id="tendy-title">Tendy</b><small>TendCo Hub · typed only · drag anywhere</small></div>' +
      '<button type="button" class="tendy-close" id="tendy-close" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="tendy-msgs" id="tendy-msgs" aria-live="polite"></div>' +
      '<div class="tendy-hints" id="tendy-hints"></div>' +
      '<form class="tendy-compose" id="tendy-form" autocomplete="off">' +
      '<input id="tendy-input" type="text" maxlength="400" placeholder="Ask a unit or make-ready…" aria-label="Message Tendy">' +
      '<button class="tendy-send" type="submit">Send</button>' +
      '</form>' +
      '</div>';

    const openBtn = document.getElementById('tendy-open');
    const panel = document.getElementById('tendy-panel');
    const closeBtn = document.getElementById('tendy-close');
    const form = document.getElementById('tendy-form');
    const input = document.getElementById('tendy-input');
    const msgs = document.getElementById('tendy-msgs');
    const hints = document.getElementById('tendy-hints');

    function applyPos(left, top) {
      const rect = mount.getBoundingClientRect();
      const w = rect.width || 280;
      const h = rect.height || 64;
      const c = clampPos(left, top, w, h);
      mount.style.left = c.left + 'px';
      mount.style.top = c.top + 'px';
      mount.style.right = 'auto';
      mount.style.bottom = 'auto';
      savePos(c.left, c.top);
      // Flip panel above if near bottom
      const spaceBelow = window.innerHeight - (c.top + h);
      mount.classList.toggle('tendy-panel-above', spaceBelow < 360);
    }

    function placeInitial() {
      const saved = loadPos();
      const rect = mount.getBoundingClientRect();
      const w = rect.width || 280;
      const h = rect.height || 64;
      if (saved) {
        // Stay where the user left him — do not re-pin to a corner
        applyPos(saved.left, saved.top);
      } else {
        const d = defaultPos(w, h);
        applyPos(d.left, d.top);
      }
    }

    function setOpen(on) {
      mount.classList.toggle('open', on);
      openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) {
        panel.removeAttribute('hidden');
        greet();
        setTimeout(() => input.focus(), 40);
        // Re-clamp after panel expands
        const r = mount.getBoundingClientRect();
        applyPos(r.left, r.top);
      } else {
        panel.setAttribute('hidden', '');
      }
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function knownUnitLabels() {
      try {
        return (state.turns || [])
          .map((t) => String(t.unit_label || '').trim())
          .filter(Boolean);
      } catch {
        return [];
      }
    }

    /** Linkify unit refs in Tendy reply HTML (unit D-332, Unit G-349, 8-111, H-260, …). */
    function linkifyUnitRefs(text) {
      const labels = knownUnitLabels();
      const byLen = labels.slice().sort((a, b) => b.length - a.length);
      let html = escapeHtml(text);
      const linked = new Set();
      // Prefer exact board labels first
      byLen.forEach((lab) => {
        const key = lab.toUpperCase();
        if (linked.has(key)) return;
        const escLab = lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(
          '\\b((?:[Uu]nit\\s+)?)(' + escLab + ')\\b',
          'g'
        );
        html = html.replace(re, (full, prefix) => {
          linked.add(key);
          return (
            (prefix || '') +
            '<button type="button" class="tendy-unit-link" data-unit-label="' +
            escapeHtml(lab) +
            '">' +
            escapeHtml(lab) +
            '</button>'
          );
        });
      });
      // Generic patterns when not already linked: unit D-332 / Unit G-349 / 8-111
      html = html.replace(
        /\b([Uu]nit\s+)([A-Za-z]?-?\d{2,4}[A-Za-z]?|[A-Za-z]-\d{2,4}|\d{3,4})\b/g,
        (full, prefix, lab) => {
          const key = String(lab).toUpperCase();
          if (linked.has(key)) return full;
          linked.add(key);
          return (
            prefix +
            '<button type="button" class="tendy-unit-link" data-unit-label="' +
            escapeHtml(lab) +
            '">' +
            escapeHtml(lab) +
            '</button>'
          );
        }
      );
      return html.replace(/\n/g, '<br>');
    }

    function openUnitFromTendy(label, serviceId) {
      try {
        if (typeof window.openTurnByUnitLabel === 'function') {
          window.openTurnByUnitLabel(label, serviceId);
          return;
        }
        if (typeof openTurnByUnitLabel === 'function') {
          openTurnByUnitLabel(label, serviceId);
          return;
        }
        const t =
          typeof findTurnByUnitRef === 'function'
            ? findTurnByUnitRef(label)
            : (state.turns || []).find(
                (x) => String(x.unit_label || '').toUpperCase() === String(label || '').toUpperCase()
              );
        if (t && typeof openTurn === 'function') {
          openTurn(t.id);
          if (serviceId && typeof openTurnService === 'function') {
            setTimeout(() => openTurnService(t.id, serviceId), 40);
          }
          return;
        }
      } catch (_) {}
      if (typeof toast === 'function') toast('Open unit ' + label + ' from the board');
    }

    function addBubble(role, payload) {
      const div = document.createElement('div');
      div.className = 'tendy-bubble ' + (role === 'user' ? 'user' : 'bot');
      if (role === 'user') {
        div.textContent = payload.text;
      } else {
        const body = document.createElement('div');
        body.className = 'tendy-bubble-text';
        body.innerHTML = linkifyUnitRefs(payload.text || '');
        div.appendChild(body);
        body.querySelectorAll('.tendy-unit-link').forEach((a) => {
          a.addEventListener('click', (ev) => {
            ev.preventDefault();
            openUnitFromTendy(a.dataset.unitLabel);
          });
        });
        if (payload.actions && payload.actions.length) {
          const row = document.createElement('div');
          row.className = 'tendy-act-row';
          payload.actions.forEach((act) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'tendy-act-btn';
            b.textContent = act.text;
            b.addEventListener('click', () => {
              if (act.turnId && typeof openTurn === 'function') {
                openTurn(act.turnId);
                if (act.serviceId && typeof openTurnService === 'function') {
                  setTimeout(() => openTurnService(act.turnId, act.serviceId), 40);
                }
              } else if (payload.unitLabel) {
                openUnitFromTendy(payload.unitLabel, act.serviceId);
              }
            });
            row.appendChild(b);
          });
          div.appendChild(row);
        } else if (payload.turnId || payload.unitLabel) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'tendy-act-btn';
          b.textContent = 'Open make-ready detail';
          b.addEventListener('click', () => {
            if (payload.turnId && typeof openTurn === 'function') openTurn(payload.turnId);
            else openUnitFromTendy(payload.unitLabel);
          });
          div.appendChild(b);
        }
        if (payload.cite) {
          const cite = document.createElement('span');
          cite.className = 'tendy-cite';
          cite.textContent = payload.cite;
          div.appendChild(cite);
        }
        if (payload.admin) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tendy-admin-btn';
          btn.textContent = 'Message admin';
          btn.addEventListener('click', messageAdmin);
          div.appendChild(btn);
        }
      }
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function greet() {
      if (msgs.childElementCount) return;
      addBubble('bot', {
        text:
          'Hi — I’m Tendy on TendCo Hub. Ask a unit status (e.g. “What’s the status of unit G-349?”) or a make-ready FAQ. I only answer from the board and documented steps — no guessing.',
        cite: 'Source: TendCo Hub · Tendy',
        admin: false,
      });
      if (isFireWeekActiveNow()) {
        addBubble('bot', fireNudgePayload());
      }
      const chips = [
        'Status of unit G-349?',
        'Fire inspection week?',
        'Key handling after 3 PM?',
        'Water and electric before cleaning?',
        'Pest block rules?',
      ];
      hints.innerHTML = '';
      chips.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tendy-hint';
        b.textContent = c;
        b.addEventListener('click', () => {
          input.value = c;
          form.requestSubmit();
        });
        hints.appendChild(b);
      });
    }

    // Drag vs click: pointer on teaser/handle
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let origL = 0;
    let origT = 0;
    const DRAG_THRESH = 6;

    function onPointerDown(ev) {
      if (ev.button != null && ev.button !== 0) return;
      // Don't start drag from inputs/buttons inside open panel
      if (ev.target.closest && ev.target.closest('.tendy-panel')) return;
      dragging = true;
      moved = false;
      startX = ev.clientX;
      startY = ev.clientY;
      const r = mount.getBoundingClientRect();
      origL = r.left;
      origT = r.top;
      mount.classList.add('dragging');
      try {
        openBtn.setPointerCapture(ev.pointerId);
      } catch {}
      ev.preventDefault();
    }

    function onPointerMove(ev) {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESH) return;
      moved = true;
      applyPos(origL + dx, origT + dy);
    }

    function onPointerUp(ev) {
      if (!dragging) return;
      dragging = false;
      mount.classList.remove('dragging');
      try {
        openBtn.releasePointerCapture(ev.pointerId);
      } catch {}
      if (!moved) {
        setOpen(true);
      } else {
        const r = mount.getBoundingClientRect();
        applyPos(r.left, r.top);
      }
    }

    openBtn.addEventListener('pointerdown', onPointerDown);
    openBtn.addEventListener('pointermove', onPointerMove);
    openBtn.addEventListener('pointerup', onPointerUp);
    openBtn.addEventListener('pointercancel', onPointerUp);
    // Prevent native drag ghost on image
    openBtn.addEventListener('dragstart', (e) => e.preventDefault());

    closeBtn.addEventListener('click', () => setOpen(false));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = String(input.value || '').trim();
      if (!q) return;
      addBubble('user', { text: q });
      input.value = '';
      addBubble('bot', replyTo(q));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mount.classList.contains('open')) setOpen(false);
    });
    window.addEventListener('resize', () => {
      const r = mount.getBoundingClientRect();
      applyPos(r.left, r.top);
    });

    placeInitial();
  }

  window.__tendyFireNudge = function (opts) {
    const o = opts || {};
    const mount = document.getElementById('tendy-mount');
    if (!mount) return;
    if (!mount.classList.contains('open')) {
      mount.classList.add('open');
      const panel = document.getElementById('tendy-panel');
      const openBtn = document.getElementById('tendy-open');
      if (panel) panel.removeAttribute('hidden');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
    }
    setTimeout(() => {
      const msgs = document.getElementById('tendy-msgs');
      if (!msgs) return;
      const already = [...msgs.querySelectorAll('.tendy-bubble.bot')].some((el) =>
        /send notices to residents before the fire company/.test(el.textContent || '')
      );
      if (already) return;
      const div = document.createElement('div');
      div.className = 'tendy-bubble bot';
      const payload = fireNudgePayload();
      div.textContent = payload.text;
      const cite = document.createElement('span');
      cite.className = 'tendy-cite';
      cite.textContent = payload.cite + (o.dateKey ? ' · ' + o.dateKey : '');
      div.appendChild(cite);
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }, 80);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUi);
  } else {
    buildUi();
  }
})();
