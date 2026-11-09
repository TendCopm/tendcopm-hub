# Historical Hub writer

Inspected archive of local `tendcopm-pages-deploy` commit `2319029bec170de8f8ae0708430d0a6e67c32bfb`, branch `prod-nav-tendyhub`. The archive's own note says this is not verified as the current live Pages deployment. `migrations/` and `SCHEMA.md` were not tracked at that commit and were not in the archive.

Tracked files inspected: `lib/auth.js`, `lib/api.js`, `lib/phase1.js`, `functions/api/[[path]].js`, `functions/portal/api/[[path]].js`, `functions/portal/assets/maps-config.js`. Automated scan on the archive reported no hits. `lib/api.js` calls Resend and FormSubmit when a turn is marked complete. Those functions are not copied into `functions/` and are not invoked by the CRM.

Contracts taken from that source:

- Session cookie name `__Host-tb_session`. Token must match `^[A-Za-z0-9_-]{40,60}$`. `sessions.id` is the SHA-256 hex of the token. Lookup joins `users` and `clients`.
- D1 binding: if `TURN_DB` is set, the writer uses it as `env.DB`.
- Done clock: `PATCH /turns/:id` with `status: "complete"` sets `completed_at` when it was empty, and clears `completed_at` when status leaves `complete`. Punch `done_with_proof` also sets status `complete` and `completed_at`.
- A session user only reads turns for `user.client_id`. Cross-client `GET /admin/turns` requires `X-Admin-Key` equal to `env.ADMIN_KEY`. The CRM does not implement that header.
- Signup in that file inserts role `pm` only. It does not define `owner` or `staff`.
