# Internal CRM inside the Hub

The CRM is a TendCo staff workspace on the Hub. It is not a client portal and not a second product. Property managers, maintenance supervisors, techs, and vendors who can open the Hub still cannot read CRM records, including by calling the API directly.

Live release is blocked. Two old Cloudflare Pages snapshots (`8f0dd8d4` and `33611584` on project `tendcopm`) were flagged because they exposed CRM JSON. This connection cannot list or delete Pages projects (HTTP 403, missing Pages permission). Nothing was deleted and no production database was changed.

## What this branch implements

- Hub nav link **CRM**, shown only after a signed-in `owner`, `staff`, or `admin` session. Hidden in `?demo=1`.
- Page `public/portal/crm.html` using the existing TendCo wordmark and Hub colors.
- API `GET/POST/PATCH /portal/api/crm/*` on the existing `TURN_DB` binding (`tendco-turn-board-db`).
- Session check uses the live Hub `sessions` table: `sessions.id` is the SHA-256 hex of the cookie or bearer token. Client roles `pm`, `maintenance_supervisor`, `tech`, and `vendor` receive 403 and an empty error body.
- Clients `CL-0001`, sites `ST-[original client number]-[001]`, jobs `TC-000001`. Numbers are allocated with `UPDATE ... + 1 RETURNING` and are not reused after archive or restore.
- Site hand-off keeps the original site number, writes transfer history, and does not advance the destination client’s site counter. Management hand-off is blocked while a done job on that site has no QuickBooks reference. A sale is blocked until `sale_balance_cents` is 0.
- Search, notes, follow-up owner and due date, and an activity row for each write.
- AR stages on a job: done, then invoice created, sent, check received, deposited. The QuickBooks invoice number is typed in. There is no Intuit connection. Closing a job requires that reference. If a job has been done for more than 24 hours and the invoice is not marked sent, the page shows an in-app alert. Averages are computed when the page is opened. Nothing polls and nothing sends email or text.
- New job types stay pending until an owner approves them. They stay off the schedule filter until then.
- Message drafts can be saved. There is no send action.
- Owner can raise numbering high water (never lower it) and can mark an existing `@tendcopm.com` Hub user as `staff`.

The migration file is `migrations/0016_crm_internal.sql`. It only creates `crm_*` tables. It does not alter Hub tables (`users`, `turns`, `units`, and the rest).

## What is not done

The Nov 1 master spec, site hand-off spec, AR spec, job-type spec, tech-mobile spec, and AGENT-GUIDE were not in this git checkout. The behavior above follows the sanitized handoff plus the numbered rules in the task. These items are still open:

- Historical preview CRM (schedule month grid, the old public JSON, and any Greystar or other client book) was not copied. Do not scrape those snapshots into git.
- The last issued `CL`, `ST`, and `TC` numbers are not in this repo. Before the first real save, the owner must raise high water with the numbers only. Otherwise the first new client becomes `CL-0001` and could reuse a historical number.
- Tech mobile workflow (on the way, arrive, start, photos, checklist, live status) is not a field app. Job status values exist so a later workflow can use them. Photo upload still depends on the R2 binding called out in `NOTES.md`.
- Lead SLA timers, vendor chase drafts, and dispatch-next loops from AGENT-GUIDE are not built. Drafts stay drafts. No background loop was added.
- Avg rent is stored as text (`avg_rent_note`) because the handoff leaves its meaning open.
- There is no importer. Blank imported fields and the geocode backlog stay out of this branch. Map pins are only sites with coordinates already saved. This branch does not call a geocoder.
- Password hashing in the deployed Hub login is not in this repo (`password_hash`, `password_salt`, `password_iter` default 100000). This branch does not create passwords. Staff use an existing Hub login, then an owner grants `staff`.
- Cookie name is not in this repo. The API hashes every cookie and bearer token and looks that hash up in `sessions`. That matches the table comment. Confirm it against the deployed function source before go-live.
- Marketing pages on tendcopm.com are not in this repository. Deploying this repo as the whole Pages project would replace the live site. Do not do that.

## Local check

```bash
node --test tests/crm.test.mjs
node scripts/crm-local.mjs
```

The local server is synthetic only: `avery@tendcopm.com`, `blair@tendcopm.com`, and `casey@northwind.example`, password `ExampleStaff1!`. Casey is a client PM and receives 403 on the CRM. The database file is `/tmp/tendco-crm-local.sqlite`.

`http://127.0.0.1:4188/portal/app.html?demo=1` is the existing Hub demo and does not show CRM.

## Backup, apply, restore

Do this only after the old Pages snapshots are deleted, a person with Pages access confirms the public CRM JSON is gone, and the owner has the high-water numbers. This branch does not run these commands.

From a checkout that also contains the deployed Hub functions and the marketing site (this git snapshot does not):

```bash
npx wrangler d1 export tendco-turn-board-db --remote --output ./tendco-turn-board-backup.sql
npx wrangler d1 migrations apply tendco-turn-board-db --remote
```

`0016` is additive. Export first anyway. The export file is a full copy of production, including Hub clients. Keep it out of git, previews, tickets, and screenshots.

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
- The deployed Hub function source, to confirm the session hash and cookie before staff rely on it.
- The last issued client, site, and job numbers, with no contact file attached.
- No new Maps key is required for directions links. Street View for Houses is unchanged and still needs `GOOGLE_MAPS_API_KEY` on the Pages project, as `NOTES.md` already says.
