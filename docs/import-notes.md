# Import notes — September 22, 2026

These notes describe the original import. The Cubit iteration below supersedes
the earlier statements about missing frontend source and refresh/login behavior.

## Cubit iteration

Recovered `MelbourneMakerSpace/Tonic`, branch `dev`, commit
`e345b371f6ea1fdcbbc772b22c4c1c77e702731d`. The public master README describes the
older Firebase application; dev contains Angular 15 and the MySQL API client.
This source was not verified as the exact revision of the deployed bundle.
The untouched checkout stays in `.private/frontend-upstream`; edited source is in
`CubitWeb/`, with a newly resolved pnpm lockfile. Unused Firebase dependencies and
production environment configuration were removed. API requests use `/`.

The frontend is now rebuilt from source as Cubit, using user-supplied logos and
the makerspace colors. Authentication state persists per browser tab, and HTML
navigation to inner routes serves the app. Search, overdue, billing cutoff/audit,
and expanded synthetic fixtures are documented in `cubit-billing.md` and
`cubit-roadmap.md`. The import manifest remains a record of the original import
hashes; it is not a hash manifest of subsequent Cubit changes.

During development, TypeORM's automatic integer-to-decimal schema conversion
reset the original demo plan/payment amounts. The known $50 plan and two original
$50 synthetic payments were restored. Startup now uses a preserving ALTER before
schema synchronization; integration tests verify cent-valued payments and balances.
No production data was present or affected.

## Captured source

- Server: `198.199.65.211`, container `Tonic`.
- Volume: `Tonic`, mounted at `/Tonic`.
- Working directory: `/Tonic/TonicServices`.
- Startup: `/bin/bash -c "npm run dev"`.
- Observed Node: `17.6.0`.
- Running image ID: `sha256:36fad710e29d2ed3aa59868f1da909d4a6338ea6776553e05ae6ace70c443cbf`.
- Archived Git branch: `dev`.
- Archived branch commit: `4c60d731611ae2497cbdfeb05680a8df8ea4c1cd`.
- Archive SHA-256: `b0412656accf671cc02ee1d696d7eaad9ff1db6df8c33de0abd74f5dc950fab6`.

The branch commit describes the archived Git reference, not a verified clean
checkout. Deployed files may include uncommitted changes. The archive's file
contents are the imported baseline.

The 47 MB compressed archive was verified locally. It includes the application
files, production configuration, Git history, Linux dependencies, and pnpm cache.
It is preserved unchanged under the ignored `.private/` directory. Separate
private extraction directories were used for inspection; they are not used at
runtime or included in the Docker build context.

Only Docker **metadata** was downloaded, not the approximately 991 MB image
itself. The development Dockerfile recreates a compatible runtime and does not
claim to reproduce the exact image layers. A full image export is still useful
for archival purposes but is not needed to edit the copied backend source.

## Dependency discrepancy

The npm `package-lock.json` does not match the deployed `package.json`; it is
excluded from the working copy to prevent accidental use. The pnpm v9 lockfile
matches the manifest and is copied byte-for-byte.

The actual archived Linux `node_modules` links differ from that lockfile for at
least two direct dependencies: nodemon points to 2.0.22 while the lockfile specifies
3.1.0, and `@types/body-parser` points to 1.19.2 while the lockfile specifies 1.19.5.
The local setup uses the manifest and pnpm lockfile, so it is not a byte-identical
reconstruction of the installed dependency tree. The original tree remains in the
archive if needed for a deeper comparison. Other observed direct runtime versions
include Express 4.18.2, TypeORM 0.3.17, mysql2 3.4.2, and bcrypt 5.1.0.

## Development changes

- Copied backend TypeScript, custom types, package manifest, pnpm lockfile,
  TypeScript/nodemon configuration, and current frontend assets.
- Excluded production environment files, legacy ORM connection configuration,
  `.rest` request examples, `testapi.html`, and `src/api/output.txt`. These are kept
  only in the private snapshot because they may contain credentials or member data.
- Preserved historical migrations for study; startup uses entity synchronization,
  not automatic migration execution.
- Removed hardcoded integration and authentication secrets. Replaced Mailjet and
  Gmail senders with no-network adapters. Disabled PayPal token acquisition and
  blocked its routes before dispatch.
- Added explicit local-only database configuration and synthetic demo seeding.
- Moved initialization into `startLocalApp()` so the application listens only
  after database setup and seeding succeed. Added `/health`.
- Kept only the JavaScript/CSS referenced by the deployed `index.html`, plus assets
  and license notices. Replaced the production API base in the active main bundle
  with `/`; added a local page title and a browser connection policy.
- Enabled nodemon polling for reliable source reloads through Windows bind mounts.
- Added Docker Compose isolation, a localhost proxy, local safety tests, and docs.

## What remains unknown or unverified

- Actual production database contents, schema drift, and MySQL image ID. No member
  or payment database was downloaded.
- Which frontend source revision produced the deployed Angular bundle.
- Whether the captured credentials are still valid. They were not tested.
- The optional Docker build remains untested. Native Windows startup and browser workflows have been verified.

## Useful follow-up work

1. Verify Docker startup and demo login, then trace member → plan → payment →
   balance → active status → RFID whitelist using the synthetic records.
2. Obtain and match editable frontend source to the deployed bundle.
3. Review authentication/authorization across member, payment, and door routes.
4. Review unawaited async iteration in balance refresh and PayPal processing,
   login error handling, and schema changes before any production deployment.
5. Upgrade Node and dependencies with behavior tests, then replace automatic
   production schema synchronization with reviewed migrations.

## Native Windows setup

The user chose native Windows after Docker reported unavailable virtualization.
No BIOS, WSL, Windows feature, execution-policy, or IT configuration was changed.

Portable Node 17.6.0 and MySQL 8.0.19 run as user processes. Setup uses a separate
Node 22.16.0 with pnpm 9.15.9. All tooling, local credentials, logs, and database
files remain in `.private/`. Start and stop entry points are `dev/start-local.cmd`
and `dev/stop-local.cmd`; neither installs a Windows service.

The native configuration disables MySQL X Protocol and binds both services to
IPv4 loopback. MySQL uses port 3307; Tonic uses 5001. Database credentials are
randomly generated for this workspace. Email and PayPal remain disabled.

Windows MySQL defaults to lowercase schema/table identifiers. TypeORM initially
failed to recognize existing tables on restart, so the local config now lowercases
its schema name and uses a Windows-only naming strategy for table names, including
`memberKey`. This preserves the existing synthetic data and lets schema sync run
again. Linux retains its original naming behavior.

The compiled Angular frontend stores login state in memory. Browser navigation to
known inner pages therefore redirects to the root login page, while JSON API
requests continue using their original routes. Normal client-side navigation
works; a full refresh requires signing in again.

Verified type-checking, safety tests, native setup/start/stop/repeated start,
synthetic data persistence, browser login and member editing, plan/payment views,
and API whitelist behavior. No production data or credentials were used.
