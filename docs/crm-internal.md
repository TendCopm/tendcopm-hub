# Internal CRM inside the Hub

The CRM is a TendCo staff workspace on the Hub. It is not a client portal and not a second product. Property managers, maintenance supervisors, techs, and vendors who can open the Hub still cannot read CRM records, including by calling the API directly.

Live release is blocked. Two old Cloudflare Pages snapshots (`8f0dd8d4` and `33611584` on project `tendcopm`) were flagged because they exposed CRM JSON. This connection cannot list or delete Pages projects (HTTP 403, missing Pages permission). Nothing was deleted and no production database was changed.

## What this branch implements

- Hub nav link **CRM**, shown only after a signed-in `owner`, `staff`, or `admin` session. Hidden in `?demo=1`.
- Page `public/portal/crm.html` using the existing TendCo wordmark and Hub colors.
- API `GET/POST/PATCH /portal/api/crm/*` on the existing `TURN_DB` binding (`tendco-turn-board-db`).
- Session check uses the live Hub `sessions` table: `sessions.id` is the SHA-256 hex of the cookie or bearer token. Client roles `pm`, `maintenance_supervisor`, `tech`, and `vendor` receive 403 and an empty error body.
- Clients `CL-0001`, sites `ST-[original client number]-[001]`, and CRM-only `TC-000001` numbers. Numbers are allocated with `UPDATE ... + 1 RETURNING` and are not reused after archive or restore. A `TC` row is not an accounts-receivable record.
- Site hand-off keeps the original site number and history. The destination site counter does not move. A sale still requires a zero balance on the CRM hand-off form. That form does not decide Hub invoices.
- Search, notes, follow-up owner and due date, and an activity row for each CRM write.
- New job types stay pending until an owner approves them.
- Message drafts can be saved. There is no send action.
- Owner can raise numbering high water (never lower it). The API does not grant Hub roles.

The migration file is `migrations/0016_crm_internal.sql`. It only creates `crm_*` tables. It does not alter Hub tables (`users`, `turns`, `units`, and the rest).

## Hub AR — blocked

The Hub client marks field Done with `PATCH /portal/api/turns/:id` and `{ "status": "complete" }` (`public/portal/assets/app.js`, Log completed work). The label on screen is Tended. The real request does not send `completed_at`. The function that stores that patch, and the `turns` table SQL, are not in this git checkout. A read of the production D1 schema for `turns` returned HTTP 403 on the latest check (`code 7403`). This branch does not guess columns and does not update `turns`, `invoices`, or `notify_outbox`.

`GET /portal/api/crm/ar` for an existing internal session returns `authoritative: false`, `blocked: true`, `code: hub_work_order_source_unavailable`, and `work_orders: []`. `POST /portal/api/crm/ar/close` returns 503 with the same code and writes no job. Patching a `TC` job with `ar_stage`, `qb_invoice_ref`, or `status: closed` returns 409. Opening the page does not create an alert.

The close rule that the missing turn writer must call is `assertInvoiceBeforeClose` in `functions/portal/_lib/crm/hub-ar-contract.js`: a billing close requires a manual QuickBooks reference. There is no Intuit connection.

## 24-hour alert — built, not activated

`functions/portal/_lib/crm/scheduled.js` exports `scheduledArPass`. With the production source it writes one internal row, `ar_feed_blocked`, channel `internal`, recipient role `owner`. A second run does not add another row. When a verified list of Hub work orders is passed in (tests only), a Done older than 24 hours with AR stage still short of sent inserts one `ar_done_to_sent_overdue` row per work-order id and done time (`INSERT ... ON CONFLICT DO NOTHING`). Marking that order sent resolves the row. Nothing in that module calls `fetch` or an email or text API.

The cron is not in `wrangler.toml` and is not deployed. When the turn writer is in the repo, bind a Worker (not this Pages project; Pages has no cron) as follows and do not enable it before that:

- D1 binding `TURN_DB` = `tendco-turn-board-db`
- Cron `17 * * * *`
- Handler `scheduled(event, env, ctx)` calls `scheduledArPass(env.TURN_DB, new Date(event.scheduledTime))`

Deploying that cron today would insert the single internal blocked alert into production. Do not deploy it.

## Bot and team API

Call `/portal/api/crm/*` with the Hub session that already exists: `Authorization: Bearer <session token>` or the session cookie. `sessions.id` must be the SHA-256 hex of that token, `expires_at` must be in the future, and `users.role` must already be `owner`, `staff`, or `admin`. This API does not create users, set passwords, or change roles. Client roles receive 403 and no records. There is no committed password or session token.

## What is not done

The Nov 1 master spec, site hand-off spec, AR spec, job-type spec, tech-mobile spec, and AGENT-GUIDE were not in this git checkout. The behavior above follows the sanitized handoff plus the numbered rules in the task. These items are still open:

- Historical preview CRM (schedule month grid, the old public JSON, and any previously loaded client book) was not copied. Do not scrape those snapshots into git.
- The last issued `CL`, `ST`, and `TC` numbers are not in this repo. Before the first real save, the owner must raise high water with the numbers only. Otherwise the first new client becomes `CL-0001` and could reuse a historical number.
- Tech mobile workflow (on the way, arrive, start, photos, checklist, live status) is not a field app. Job status values exist so a later workflow can use them. Photo upload still depends on the R2 binding called out in `NOTES.md`.
- Lead SLA timers, vendor chase drafts, and dispatch-next loops from AGENT-GUIDE are not built. Drafts stay drafts. No background loop was added.
- Avg rent is stored as text (`avg_rent_note`) because the handoff leaves its meaning open.
- There is no importer. Blank imported fields and the geocode backlog stay out of this branch. Map pins are only sites with coordinates already saved. This branch does not call a geocoder.
- The deployed Hub login source is not in this repo (`password_hash`, `password_salt`, `password_iter` on `users`). Confirm the session hash against that source before staff rely on it. This branch does not create passwords.
- Live AR on real Done turns is blocked until that turn writer is in the repo. High-water numbers are still required before any production CRM client is saved.
- Marketing pages on tendcopm.com are not in this repository. Deploying this repo as the whole Pages project would replace the live site. Do not do that.

## Local check

```bash
node --test tests/crm.test.mjs tests/crm-ar-contract.test.mjs
CRM_LOCAL_EPHEMERAL=1 node scripts/crm-local.mjs
```

The ephemeral flag prints a local-only enter URL. It is not a production session. `http://127.0.0.1:4188/portal/app.html?demo=1` is the existing Hub demo and does not show CRM.

## Backup, apply, restore

Do this only after the old Pages snapshots are deleted, a person with Pages access confirms the public CRM JSON is gone, and the owner has the high-water numbers. This branch does not run these commands.

From a checkout that also contains the deployed Hub functions and the marketing site (this git snapshot does not):

```bash
npx wrangler d1 export tendco-turn-board-db --remote --output ./tendco-turn-board-backup.sql
npx wrangler d1 migrations apply tendco-turn-board-db --remote
```

`0016` and `0017` are additive. `0017` adds `crm_internal_alerts` only. Export first anyway. Neither migration has been applied. The export file is a full copy of production, including Hub clients. Keep it out of git, previews, tickets, and screenshots.

Restore replaces the remote database with that export. Confirm the database name before running it. Restore undoes CRM rows and also undoes Hub rows written after the export, so take the export immediately before the migration and do not keep working in the Hub during that window.

```bash
npx wrangler d1 execute tendco-turn-board-db --remote --file ./tendco-turn-board-backup.sql
```

If Wrangler’s restore command for this account differs, use the export file with the D1 time-travel bookmark Cloudflare shows on the export. Do not hand-edit the export to “just remove CRM tables” unless you have practiced that on a copy.

Rollback of the site, separate from the database: redeploy the previous Pages production deployment. Do not redeploy snapshots `8f0dd8d4` or `33611584`.

After migration, an owner sets high water once:

`POST /portal/api/crm/admin/high-water` with `{ "client_seq": <last CL number>, "job_seq": <last TC number>, "site_counters": [{ "client_seq": <client number>, "next_site_seq": <last site sequence> }] }`.

Values only move forward.

## Credentials still needed

- Cloudflare token with Pages permission, used by a person, to delete snapshots `8f0dd8d4` and `33611584`. This agent cannot request that permission.
- The deployed Hub function source, including `PATCH /portal/api/turns/:id` and the `turns` table SQL, before AR can follow real Done work.
- The last issued client, site, and job numbers, with no contact file attached.
- No new Maps key is required for directions links. Street View for Houses is unchanged and still needs `GOOGLE_MAPS_API_KEY` on the Pages project, as `NOTES.md` already says.
