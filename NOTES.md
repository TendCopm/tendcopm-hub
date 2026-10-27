# Hub Phase 1 blockers (2026-10-26)

## R2 photos (blocks real upload / Complete-with-proof in preview)
Bot API token lacks R2 permissions (`Authentication error [code: 10000]`).

**Fernando / Pico:**
1. Create R2 bucket `tendco-turn-photos`
2. Pages project `tendcopm` → Settings → Bindings → R2 → name `TURN_PHOTOS` → bucket `tendco-turn-photos` (Preview + Production)
3. Uncomment `[[r2_buckets]]` in `wrangler.toml` and redeploy preview

Escalate before adding any paid photo CDN / third party.

## D1 migrations apply
Same token cannot query D1 remotely (`code: 7403`). Apply:
`npx wrangler d1 migrations apply tendco-turn-board-db --remote`
(from `tendcopm-pages-deploy/`, migrations 0005 + 0006). Runtime schema ensure is a safety net only.

## Not blockers
- UI/API for photos, punch, PM strip, adaptive mode, overlap soft-block, done email — shipped in code.
- No GPS / no financials — locked out of Phase 1.

## Make Ready fields (0007) — preview 2026-10-26
Whiteboard lock: move_out_date, move_in_date, paint (full|touch_up), repair_replace, housekeeping, change_lock, inspected_at.
`owner_name` = Comments / assignee on calendar chips. Runtime `ensurePhase1Schema` also ALTERs these.
Apply when token allows: `npx wrangler d1 migrations apply tendco-turn-board-db --remote`
Cycle KPI: avg days move-out (or created) → Tended/inspected (this month).
Vacant-after-handoff prompt (preview UX): if Tended/handoff and not rented, offer touch-up clean/paint; **Mark done** or Mark rented clears reminders. No invoicing.
Pipeline UI on turn drawer: Move out → Paint → Repair/replace → Housekeeping → Change lock → Inspected → Move in (Tended handoff).


## Unit trades + fire calendar lock (preview 2026-10-26 trades1)
Fernando-locked trades on units: pest control, painting, maintenance, cleaning, carpet cleaning, carpet replacement, bathtub resurfacing, counter tops resurfacing, drywall repairs, plumbing, electrical, HVAC.
- Paint keeps full|touch_up; carpet clean/replace map into repair_replace and/or trade labels.
- Severity: most work onsite (TendCo/staff); outside vendor only when severity needs it (demo mixes Joe/Fred/Dennis/Ana/Maya vs Sunshine Carpet / BugFree / Coastal Electric / BathRenew / SurfacePro / FloorPro).
- Fire alarm / fire inspection = **calendar busy lock only** (week/days). No invite, no dispatch, not a WO. Demo locks 2026-11-03..11-07.
- Hub places **tech on unit** (assignee / Comments) on chips, day panel, drawer — not a work-order/dispatch product (that’s Slotify later).
- Share invites: SHAREABLE_TRADES only (excludes fire_*).
- Cache: `?v=20261026trades1`. Preview only — do not promote to tendcopm.com.


## Make Ready Board view (preview 2026-10-26 mrb1)
Nav + view exact name **Make Ready Board** (not “dashboard”). Whiteboard columns: MO, Unit #, Paint (Full|T/U), Repair/replace, Housekeeping, Change lock, Inspected, Move in, Comments (tech), Status. Tap row → existing turn drawer/pipeline. Demo seed ~14 late-Oct 2026 rows. Adaptive Unit/Home/Suite via lexicon. Cache `?v=20261026mrb1`. Preview only.


## Create Make Ready Unit (preview 2026-10-26 create1)
Fernando voice lock: Create on Make Ready Board → MO required / MI optional → default services inspection→painting→punch→carpet→cleaning (drag reorder, add UNIT_TRADES extras) → vendor confirm via link/text/call (confirmed→calendar scheduled; else pending) → carpet-before-paint auto-note "carpet needs to be protected" → statuses received/scheduled/in progress/punch/Tended → rolling 60-day move-out notices by month/week with supervisor reminders → notices reversible if resident stays → schedule month/week/day → no work orders.
- UI: Create wizard + notices strip on #make-ready; Day cal mode.
- API: POST/PATCH turns accept services_json, notice_at, notice_reversed, supervisor_notes + make-ready dates (migration 0008; runtime ensure).
- Demo seed: ~10 Dec 2026 move-outs (notices from late Oct), TendCo pending/confirmed, carpet-before-paint, SFH-style label.
- Cache: `?v=20261026create1`. Preview only — do not promote to tendcopm.com.


## Create Continue fix (preview 2026-10-26 create2)
Continue on Create Make Ready looked like a no-op: missing unit/MO only toasted (easy to miss on mobile), and Back from step 2 called readMrWizardStep1 with no inputs which wiped the draft. Also modal used sibling fixed+transform overlay (weak hit-testing vs backdrop).
Fix: wizard root overlay (dialog above backdrop), inline red error + field highlight, MO prefilled +14 days, Back no longer wipes step-1 draft, Continue stopPropagation + clearer errors. Cache `?v=20261026create2`. Preview only.


## Create modal + nav CTA (preview 2026-10-26 create3)
create2 regression: absolute full-bleed `.mrw-bg` sibling sat over the dialog and ate Continue / X / Cancel taps.
Fix: dim lives on `#mr-wizard-root`; close when `event.target === root`; dialog is the only child; Continue/X/Cancel/Back via `window.__mrw*` + HTML onclick.
Also: prominent **Create a make ready unit** at top of side nav; Make Ready Board is default Hub view (`#make-ready`). Cache `?v=20261026create3`. Preview only.

## Date display off-by-one (preview 2026-10-26 create4)
`fmtDate` treated YYYY-MM-DD as UTC midnight → review showed MO one day early in ET. Now parses date-only keys via `parseKey` (local noon). Cache `?v=20261026create4`.

## Nav Create pin + month→day + vendors (preview 2026-10-26 create5)
- Create CTA moved to pinned `.sb-create` under logo (above prop/mode/Work nav); mobile top bar `+ Create` when sidebar is closed.
- Month cell click switches to Day mode for that date (same as Day schedule view).
- Demo vendors: Sunshine Carpet Cleaning, Floor Pro Carpet, Coastal Electric; TendCo → TendCo Painting / TendCo Cleaning / TendCo Punch.
Cache `?v=20261026create5`. Preview only.

## Hub create6 (preview 2026-10-26 create6)
- Calendar chips: `{shortName}, unit {unit_label}` (name first) in month/week/day; fire locks stay Busy; on-call `{Name}, on call`.
- Demo unit **214**: TendCo Painting + TendCo Punch (drywall) same day **2026-10-27**; TendCo Cleaning separate day **2026-10-28**. Vendor spelling **TendCo** (not Temco). Company **TendCo** / TendCo (onsite) unchanged.
- Log completed work: tech OR supervisor; stores `completed_by_role` / `completed_by_name`; supervisor notes merge; demo works offline; celebrate kept; photo gate kept for non-demo.
- Week view: Sunday — off (empty); Mon–Fri work; Saturday on-call chip + Set Saturday on-call (Joe/Fred/Dennis/Ana/Maya → `state.cal.onCallBySaturday` / sessionStorage).
- Supervisor team setup one-time modal (invite link) + sidebar Invite team.
- Cache: `?v=20261026create6`. Preview only — do not promote to tendcopm.com.

## Create pipeline fix (preview 2026-10-26 create7)
- New units: pipeline starts Created (today), then upcoming Move out + Inspection (MO+1) — not marked done.
- Planned paint/repair no longer counts as done; inspected_at not stamped on create.
- Demo vacant seed only on known A-205 demo row (no longer corrupts first/new units).
Cache `?v=20261026create7`.

## Full make-ready pipeline (preview 2026-10-26 create8)
Fernando sequence: Created → Move out → Inspection → Change lock (alongside inspect) → Painting → Punch → Paint full/repair replace → Maintenance → Carpet repair/replace → Housekeeping → Leasing inspection → Ready for move in → Rented (own date) → Move in. Rented ≠ move-in date. New units only show Created as done.
Cache `?v=20261026create8`.

## Vendor spelling TendCo (preview 2026-10-26 create9)
Fernando: Temdco → TendCo (N not M). Labels TendCo Painting / Cleaning / Punch. Company TendCo (onsite) unchanged.
Cache `?v=20261026create9`.


## Create step 2 date spread + rules (preview 2026-10-26 create10)
Fernando: Request services auto-spreads dates across MO → day-before-MI (skip Sundays), with duration / share / order / utilities / eviction rules.

### Pipeline UI
- Step 2 title: `G-300 · Request services`; lede shows MO → MI (+ Eviction when set).
- Numbered chips: `1 Inspection · Nov 10`, `2 Painting · Nov 11`, …; AM/PM when cleaning+carpet share.
- Drag reorder renumbers 1..N; date slots re-applied after order enforce. Mini calendar preview + review shows dates.
- Cache: `?v=20261026create10`. Preview only.

### Duration / double-book
- Color change & bathtub resurfacing = **2 consecutive** work days.
- Carpet replacement / trash out = own day; carpet cleaning own day except special share.
- **Special share:** Cleaning (AM) + Carpet cleaning (PM) on one day when window is tight.
- Day demand vs work days → amber **You need to double book**; pack compatible pairs first, then best-effort.

### Utilities gate (independent)
- Checklist ☐ Water on / ☐ Electric on on step 2 + unit drawer. Default unchecked (demo shows blocked).
- Cleaning & carpet cleaning blocked until both true — banner “Cleaning blocked — confirm water and electric”; Confirm disabled. Painting / color change / punch / carpet replace / bathtub / inspection not blocked.
- Stored as `utilities: { water, electric }` on wizard draft + turn.

### Hard order
- **Trash out** (addable extra): always first when present (toast snap). Bathtub resurfacing always last.
- **Pest** active: Pest #1, then Trash if present, then middle, bathtub last.
- **Eviction** type (step 1): auto-seed Change of lock → Trash out → Full inspection. Enforce: Lock #1, Pest #2 if present, Trash, Full inspection, middle, bathtub last. Drag cannot pull those out of the front. Non-eviction does not auto-add lock/trash.
- Change of lock = 1 day in spread.

Helpers: `mrwKind`, `mrwWorkDays`, `mrwEnforceOrder`, `mrwSeedEviction`, `mrwApplyDateSpread`, `mrwPipelineStripHtml`, `mrwCalPreviewHtml`, `mrwUtilsChecklistHtml`.


## Create11 pest gate + urgency / flexible (preview 2026-10-26 create11)
Fernando call: finish pest hard gate; urgency when MI set; flexible 10-day show-ready when no MI; cross-unit vendor pull flexible→urgent.

### Pest hard gate
- `pest_infestation` checkbox (step 2 + unit drawer) OR auto-true when pest_control added.
- `pest_wait_days` default 2. Banner: “Pest-blocked — other services paused until [resume date]”.
- Non-pest: `paused_pest`, status “Paused — pest”, Confirm disabled, excluded from active calendar until gate clears.
- Only pest schedulable while blocked. `resume_date` = last pest work day + wait (skip Sundays).
- Drawer: clear infestation / mark pest complete → after wait, lift gate and re-spread from resume.
- Order unchanged: eviction lock #1 → pest → trash → inspection → middle → bathtub last.

### Urgency & flexibility
- MI set = urgent (badge on board/calendar/drawer); all services before MI; no flexible cancel framing.
- No MI = flexible; “Show-ready by [MO+10 work days]” chip (or from today if past MO).
- Default spread: one service per day with wiggle; double-book flag only when window forces it.
- `mrwWorkDays` no-MI window: MO + max(dayDemand, **10**) work days.

### Cross-unit reassign (demo)
- Right-click calendar chip on a **flexible** unit → “Move to urgent unit…” listing urgent units needing that trade.
- Destination gets service/date; source becomes pending with note “Reassigned — no move-in deadline”.
- Demo: G-349 (flex, carpet) → G-354 (urgent, needs carpet).

Cache: `?v=20261026create11`. Preview only — do not promote to tendcopm.com.

## Account creation first-run (preview 2026-10-26 create13)
Fernando: first page when maintenance supervisor / PM receives The Hub.

### URL
- https://preview.tendcopm.pages.dev/portal/?setup=1 → redirects to `/portal/setup.html`
- Direct: https://preview.tendcopm.pages.dev/portal/setup.html
- Finish / Skip → Hub demo `app.html?demo=1`

### Wizard
1. **Create profile** — full name, role (Maintenance supervisor | Property manager), work email, phone, property/community name, optional photo. Admin rule note: only supervisors/PMs create profiles for others; Revoke (Change password / Disconnect) on demo team list (Joe/Fred/Dennis/Ana) with Restore.
2. **Contacts** — Emergencies, Leasing, Regional — each name, title, phone, email.
3. **Vendors** — TendCo pre-seeded for Painting, Cleaning, Punch, Common area (platform). Property-added vendors separate. Required: “Which is the best email to send the service request?” (request_email). Draft persists in sessionStorage.

Demo-only, TendCo branding, mobile-friendly. Cache `?v=20261026create13`. Preview only — do not promote to tendcopm.com.

### create12 (parked)
Keys 3 PM+ prompt, day hour grid / preferred slots, in-house badge, vendor email handoff, replace vendor, color-change approval — helpers drafted, not integrated/deployed yet. Resume after create13.


## Tendy typed AI helper (preview 2026-10-26 create14)
Floating helper **relocated to left sidebar bottom** (Fernando mockup lock) — above “Exit demo · The Hub”. Not a bottom-right FAB.
- Circular Tendy avatar (yellow hard-hat + tablet cutout) + light-blue speech bubble: “Need help? I’m Tendy, your automated assistant. Ask me anything!”
- Click expands typed chat panel anchored in the sidebar dock.
- Scope unchanged: unit status from `state.turns`, hardcoded FAQ bank with cites, unknown → Message admin (demo toast). No voice. TendCo Hub branding.
- Assets: `portal/assets/tendy.js`, `tendy-icon.webp|.png`, CSS in `portal.css`. Mount `#tendy-mount` in `app.html`.
- Cache: `?v=20261026create14` on app.html. create12 `_wip` left alone.
- Preview Hub: https://preview.tendcopm.pages.dev/portal/app.html?demo=1

Preview only — do not promote to tendcopm.com.

## Account setup profile fields (preview 2026-10-26 create15)
Step 1 Profile adds required fields (manual entry — **not** auto-filled from outreach):
1. **Property address** (required text) — Continue blocked without it.
2. **Number of units** (required number ≥ 1).
3. **Building type** (required): Garden style | Mid-rise | High-rise.

Demo name/email/phone/property prefill still ok; address / units / building type stay blank until typed.
Cache: `?v=20261026create15` on setup.html. Finish/Skip → Hub `app.html?demo=1&v=20261026create14`.
Setup URL: https://preview.tendcopm.pages.dev/portal/setup.html (or `/portal/?setup=1`)

Preview only — do not promote to tendcopm.com.

## Common areas + Viewing-only lanes (preview 2026-10-26 create16)
Fernando: Common area services are DISTINCT from Create Make Ready one-service-per-day unit pipeline. Anything outside make-ready is courtesy tracking — never competes for unit MO→MI day slots / `mrwApplyDateSpread`.

### Three calendar lanes
1. **Make-ready** — existing unit pipeline (TendCo/vendors, confirm, urgency).
2. **Common areas** — recurring property jobs with vendor (TendCo Cleaning pre-seeded): Model unit (every Tuesday), Office (Mon+Thu 7–9 AM), Pool (weekly Wednesday).
3. **Viewing** — viewing-only reminders: no vendor communication, no approval, no pipeline. Demo: Landscaper (Fri), Elevator maintenance (monthly day 3), Pool check without a company (Sat). Chips show a **Viewing** badge + dashed gray style.

### UX
- Nav **Common areas** (adjacent to Make Ready Board) with tabs Common areas | Viewing.
- Create/edit modals; copy hint: “Common areas are recurring property jobs — separate from unit make-ready.”
- Request services extras: “Add common-area job…” / “Add viewing reminder…” deep-link out of unit pipeline (`#common-areas/new`, `#common-areas/viewing/new`).
- Schedule lane legend: Make-ready · Common area · Viewing.
- Preserves create14 Tendy sidebar dock + create15 setup address/units/building fields.

Cache: `?v=20261026create16`. Preview only — do not promote to tendcopm.com.
Hub: https://preview.tendcopm.pages.dev/portal/app.html?demo=1&v=20261026create16
Setup: https://preview.tendcopm.pages.dev/portal/setup.html

## Account setup vendor step (preview 2026-10-26 create17)
Fernando: vendor step on account creation.

### Changes
1. Vendor field label **Company name** (make-ready + viewing vendor cards).
2. Clear **Skip · Enter Hub** on the make-ready vendor section — skips remaining vendor prompts and lands in Hub (same destination as finish).
3. After make-ready, optional prompt (exact UI copy):
   > Want to add other vendors to help you schedule your day? Fire companies, landscapers, or anyone else worth tracking — so you can keep an eye on the work without the make-ready pipeline.
   Subline: *Viewing only — no vendor messages, no approvals, no pipeline.*
   - **Yes, add vendors** → company name + optional phone/email; saved to `hub_viewing_items_v1` as create16 Viewing-lane courtesy items (no request-email handoff, no approval).
   - **No thanks · Enter Hub** → Enter Hub immediately.

Preserves create15 required profile fields (address, unit count, building type) and TendCo platform vendors (Painting, Cleaning, Punch, Common area).

Cache: `?v=20261026create17` on setup.html / setup.js / setup.css.
Setup: https://preview.tendcopm.pages.dev/portal/setup.html?v=20261026create17
Also: https://preview.tendcopm.pages.dev/portal/?setup=1

Preview only — do not promote to tendcopm.com.

## Fire inspection Viewing + Tendy nudges (preview 2026-10-26 create17b)
Extends create17. Recurring Viewing-only **Fire inspection** (annual default Nov 3; editable to semi-annual; optional week-block locks calendar — same busy-week behavior as existing fire lock). Suggestions on Common areas → Viewing and setup optional-other-vendors (+ Fire inspection).

### Tendy comment-style nudges ONLY (no vendor email / approval / pipeline)
When fire inspection week is blocked or the user asks about fire inspection week, Tendy says:
1. Make sure you send notices to residents before the fire company comes.
2. Remind residents to take fire extinguishers from inside units out to the hallway (or outside) before the inspection.
3. Remind residents to secure pets.

Cite: `Source: Hub Viewing · fire inspection week`. Proactive on Tendy open during an active fire week, and when tapping a fire lock chip. Scope: Tendy does not handle outside vendors except these Viewing courtesy items.

### Trash out (verified, no change)
`trash_out` remains in `UNIT_TRADES` and in Create Make Ready step-2 **Add extra…** list; eviction still auto-seeds Trash out after Change of lock. create10+ order unchanged.

Cache: `?v=20261026create17b`.
Hub: https://preview.tendcopm.pages.dev/portal/app.html?demo=1&v=20261026create17b
Setup: https://preview.tendcopm.pages.dev/portal/setup.html?v=20261026create17b

Preview only — do not promote to tendcopm.com.

## Floating Tendy + fire window + common-area staffing (preview 2026-10-26 create18)
Extends create16/17/17b.

### Floating draggable Tendy
- Replaces create14 sidebar-bottom dock. Mount is **portal/root** (`#tendy-mount.tendy-float`) so Tendy stays visible across Make Ready Board, Schedule, Common areas, Units, etc.
- Grab avatar / teaser → drag anywhere; position persisted in `localStorage` key `hub_tendy_pos_v1`; clamped to viewport on move/resize.
- Click (no drag) opens typed chat panel anchored to the float; drag does not open. Typed only — no voice.
- Behavior unchanged: unit status, make-ready FAQs, key handling, scheduling, fire Viewing nudge trio with cites. No guessing.

### Fire inspection Viewing — Month + Start day + Length
- Form: **Month**, **Start day** (within month), **Length (days)**, **Block calendar for this window** toggle.
- Window = start → start+(length−1). Examples: start Nov 1 length 4 → Nov 1–4; start Nov 10 length 5 → Nov 10–14.
- Demo seed: annual **Nov 10**, length **5**, week-block on → **2026-11-10 … 2026-11-14** locked + Viewing chips each day (not a single Nov chip).
- Still Viewing-only: no vendor email, no approval, no pipeline.
- Tendy fire nudges (unchanged):
  1. Make sure you send notices to residents before the fire company comes.
  2. Remind residents to take fire extinguishers from inside units out to the hallway (or outside) before the inspection.
  3. Remind residents to secure pets.

### Common areas (still outside unit make-ready pipeline)
Three first-class services — each with **in-house vs outsourced** and shared frequencies:
1. **Model unit cleaning**
2. **Office/amenities cleaning** (renamed from Office cleaning — office, gym, amenities)
3. **Pool cleaning**

Frequencies (all three): Weekly · Peak day · Twice per week · Three weekly (3×/week) · Five days a week.
Demo defaults: Model weekly Tue in-house; Office/amenities 2× Mon+Thu in-house; Pool weekly Wed outsourced.
Chips/cards show e.g. `Pool · outsourced` / `Office/amenities · in-house`. Never enter `mrwApplyDateSpread`.

Cache: `?v=20261026create18`.
Hub: https://preview.tendcopm.pages.dev/portal/app.html?demo=1&v=20261026create18
Setup: https://preview.tendcopm.pages.dev/portal/setup.html?v=20261026create18

Preview only — do not promote to tendcopm.com.

## Freely draggable Tendy (preview 2026-10-26 create19)
Fernando: Tendy is **not** a pinned corner FAB (that looks cluttered). He is freely draggable — grab → move anywhere → drop → stays (localStorage `hub_tendy_pos_v1`). Survives tab/view switches. Typed chat stays with him.

Look (unchanged): yellow hard-hat tablet avatar + light-blue bubble **“Need help? I’m Tendy, your automated assistant. Ask me anything!”**
- Portal-root mount only — **no sidebar dock**.
- First visit defaults bottom-right; after the user moves him he never snaps back to a corner.
- Click opens chat; drag moves (threshold). Viewport clamp on move/resize. Fire nudges + make-ready FAQs unchanged from create17b/18.

Cache: `?v=20261026create19`.
Hub: https://preview.tendcopm.pages.dev/portal/app.html?demo=1&v=20261026create19

Preview only — do not promote to tendcopm.com.


## Make-ready pipeline clicks + Tendy unit links (preview 2026-10-26 create20)
Extends create19.

### Dead-click fixes (make-ready detail)
- **Service pipeline chips** in the unit drawer are buttons — tap opens service schedule/detail panel (vendor, date, Link/Text/Call confirm, Schedule).
- **Trade chips** (Maint, Carpet replace, …) open the matching pipeline service.
- **Schedule on this unit** (demo): rows like **Schedule Maya · Maintenance** / carpet replace — same panel.
- **Calendar** chips resolve by `turn_id`, then `unit_id`, then **unit_label** (fixes demo seed id drift for cancelled Carpet replacement, Maya/H-260, etc.) and focus the matching service when present.
- Demo seed: carpet replace remaps default Carpet → **Carpet replace**; owner_name (e.g. Maya) applied onto matching maintenance service so “Schedule Maya · Maintenance” is real.

### Tendy — tappable unit refs
- Replies linkify board unit labels (`unit D-332`, `Unit G-349`, `H-260`, `8-111`, …).
- Tap → opens that unit’s make-ready detail (same as board).
- Unit-status replies also offer action chips (Schedule Maya · Maintenance, Carpet replace, …) wired to the same service panel.

Cache: `?v=20261026create20`.
Hub: https://preview.tendcopm.pages.dev/portal/app.html?demo=1&v=20261026create20

Preview only — do not promote to tendcopm.com.

## Houses — address board + area map (preview 2026-10-27 houses1)
Fernando lock (Oct 26–27): houses are not units. Clicking **Houses** swaps the side menu. The map pinpoints each street address. When one company has homes in more than one area, those homes cluster by area for routing.

Separate from multifamily make-ready. Apartments / Commercial keep Make Ready Board, units, common areas, and the create-unit flow.

### What shipped
- Portfolio switch under the logo: **Apartments · Houses · Commercial**. Houses hides unit nav and shows **Address board**, **Map**, **Routes**.
- Address board is keyed by street (no unit numbers). Sample Central Florida SFR book: Oak & Pine (College Park + Winter Park), Lakeside (Conway + Belle Isle), Horizon (Winter Park + Kissimmee), Cedar & Co. (Altamonte).
- Map (Leaflet + OpenStreetMap): one pin per address. Zoomed out, pins collapse into area clusters labeled with the neighborhood and a count. Open a cluster for numbered stops and a straight-line loop.
- Routes view splits a company into one loop per area (nearest-neighbor, straight-line miles — not drive time).
- Add a house stores the address in session only and drops a pin in the chosen area. Make-ready create is unchanged.
- `?demo=1` runs without the Worker API (local demo board) so the static Pages preview can open. Cache `?v=20261027houses1pwa`.

### Open locally
Serve `public/` and open the Houses preview:

`python3 -m http.server 4173 --directory public`

http://localhost:4173/portal/app.html?demo=1&v=20261027houses1pwa#houses

Sign-in page: http://localhost:4173/portal/index.html?demo=1 — **Open Houses preview**, or Enter demo (falls through to the app if the API is not bound).

Preview only — do not promote to tendcopm.com. Not Slotify. No production DNS change.

### Follow-ups
- Persist houses in D1 as addresses, not units.
- Geocode added homes (v1 places them near the area center).
- Drive-time routing instead of straight-line nearest neighbor.
- Real client book instead of the Central Florida sample.

## PWA — Add to Home Screen (preview 2026-10-27 houses1pwa)
Fernando approved the Oct 26 placement: **Get Hub on your phone** sits in the Account nav immediately above **Invite team**, and the same action is a card inside the invite-team modal.

### What shipped
- Web app manifest at `/portal/manifest.webmanifest`. Name **TendCo Hub**, short name Hub, `display: standalone`, navy background `#0A1F44`, sky theme `#1F5BD8`. `start_url` and `id` are `/portal/app.html?demo=1` so a home-screen launch opens the portal in demo mode. Scope is `/portal/`.
- Service worker `/portal/sw.js` (cache `tendco-hub-20261027houses1pwa`). Network-first for same-origin GET. Skips `/portal/api` and does not cache map tiles or other cross-origin requests. Shell fallback is the portal app if the network fails.
- Install sheet is opened only by a tap (no automatic prompt). Android/Chrome uses `beforeinstallprompt` and an **Install** button when the browser offers it. iOS Safari, which does not fire that event, shows Share → Add to Home Screen → Add. Other desktop browsers get the Chrome/Edge menu steps plus the iOS note.
- Login page links the same manifest and registers the worker so install criteria can be met. The prompt itself stays on the app, next to Invite team.
- Icons are the real `TendCo-T-Mark-TM.svg` composited onto `#EEF4FF` at 192 and 512 (and the Apple touch icon). The mark was not redrawn.
- Cache-bust query is `?v=20261027houses1pwa` on the app shell.

Preview only — do not promote to tendcopm.com. A production install should drop `?demo=1` from `start_url`.

## Houses curb view (preview 2026-10-27 curb1)

Fernando lock (Oct 27): opening a house shows the curb. **Street View Static** is the default. A **crew exterior photo** overrides it when one is saved. Map pins do not request Street View (quota stays on the open drawer).

### What shipped
- House drawer leads with a 16:9 curb frame (~640×360, fov 90, pitch 0). Heading is omitted so Google aims the camera at the pin. `source=outdoor` first; if that imagery errors, one retry without `source`. `return_error_code=true` so a missing panorama is an image error, not a gray tile.
- Badge reads **Street View** or **Crew photo**.
- No key, a bad key, or no imagery: the frame stays a calm placeholder with **Open in Street View** (`maps.google.com` pano deep link from lat,lng). The drawer still opens.
- **Add exterior photo** / **Replace photo** / **Remove**. The crew photo wins over Street View.
- Demo and any session where R2 is not bound: the photo is compressed (same `compressImageFile` path as turn proof) and stored as `exteriorPhotoUrl` on the house record in `localStorage` key `hub_houses_demo_v1` (`{ houses: { [id]: { exteriorPhotoUrl } } }`). Added houses also keep the field on the session extra. Seed addresses are unchanged and do not include the field until a photo is saved.
- When `state.photosBound` is true (turn-photo R2 already bound) and the page is not `?demo=1`, the client POSTs the compressed JPEG to `/portal/api/houses/:id/exterior` and uses the returned `url`. DELETE clears it. If that route is missing or `photos_bound` is false, the photo still saves on the device. No new CDN.

### Set `GOOGLE_MAPS_API_KEY` (do not commit a key)
This repo ships an empty key. Street View stays on the placeholder until a **browser** key is configured. It will be visible in the page. That is expected for Street View Static. Restrict it.

1. Google Cloud: enable billing on the project. Enable **Street View Static API** (Maps JavaScript API is not enough).
2. Create an API key.
   - Application restriction: **HTTP referrers**
     - `https://tendcopm.com/*`
     - `https://*.tendcopm.com/*`
     - `https://preview.tendcopm.pages.dev/*`
     - `https://*.tendcopm.pages.dev/*`
     - Optional for local checks: `http://localhost:4173/*`
   - API restriction: **Street View Static API** only.
3. Cloudflare Pages project `tendcopm` → Settings → Environment variables → `GOOGLE_MAPS_API_KEY` for **Preview** and **Production**. Do not put the key in `wrangler.toml` `[vars]`.
4. `functions/portal/assets/maps-config.js` serves `window.TENDCO_MAPS_KEY` when that variable is set. With no variable, the static `public/portal/assets/maps-config.js` stays empty.
5. Other safe overrides, still not a committed secret: set `window.TENDCO_MAPS_KEY` before `maps-config.js`, or put the referrer-restricted key in `<meta name="tendco-maps-key" content="">` in `app.html`.
6. The Street View `<img>` uses `referrerpolicy="no-referrer-when-downgrade"` so Google receives the page URL and the referrer rule can match.

### R2 follow-up (not in this preview)
Same blocker as turn photos: the bot token cannot create the bucket. Until Fernando/Pico bind it, crew photos stay in `localStorage`.

1. Create R2 bucket `tendco-turn-photos` (reuse; no second bucket and no paid CDN).
2. Pages project `tendcopm` → Settings → Bindings → R2 → name `TURN_PHOTOS` → bucket `tendco-turn-photos` (Preview + Production).
3. Uncomment `[[r2_buckets]]` in `wrangler.toml` and redeploy preview.
4. Worker route, mirroring turn proof (D1 metadata, object in R2, stable `url` the drawer can load):
   - `POST /portal/api/houses/:id/exterior` body `{ kind:'exterior', data_base64, content_type, width, height, bytes }` → `{ ok:true, photos_bound:true, url }` or `{ ok:true, photos_bound:false }` when the bucket is missing.
   - `DELETE /portal/api/houses/:id/exterior` → `{ ok:true }`.
   - Suggested object key: `houses/{houseId}/exterior.jpg`.

`?demo=1` does not call that route. It keeps the data URL so the static preview works offline.

### Cache
`?v=20261027curb1` on the app shell. Service worker cache `tendco-hub-20261027curb1`. `maps-config.js` is not cached by the worker so a key change is picked up without another cache-bust.

### Preview
Serve `public/` and open:

`python3 -m http.server 4173 --directory public`

http://localhost:4173/portal/app.html?demo=1&v=20261027curb1#houses

Dismiss **Add your maintenance team** if it covers the page. Open **812 W Princeton St**. Expect the curb placeholder and **Open in Street View** (no key in git). Add an exterior photo → badge **Crew photo**. Reload → the photo is still there. Replace, then Remove → placeholder returns. Map pins are unchanged.

With a key set, the same house shows **Street View** instead of the placeholder, unless a crew photo is saved.

Preview only — do not promote to tendcopm.com.
