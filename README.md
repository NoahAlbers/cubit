<p align="center">
  <img src="CubitWeb/src/assets/cubit-logo.png" alt="Cubit — Melbourne Makerspace membership management" width="620">
</p>

# Cubit

**Launch status:** review only. See the maintained [pre-launch checklist](PRE-LAUNCH.md) for required work, verification evidence, ownership and cutover sign-off.

**Membership management for Melbourne Makerspace.**

Cubit brings member records, billing, access history, reports, and member self-service into one application. It builds on the makerspace's Tonic codebase, with a redesigned interface and ongoing work to make everyday administration clearer and easier to maintain.

**Current stage: working prototype and isolated hosted review.** Cubit has not replaced the operational membership or door system. Payment-provider integration, door integration, account provisioning, and production waiver signing still need work before a live rollout.

## What works today

### Member directory and profiles

- Search by name, contact email, PayPal email, and phone number; filter by membership status, plan, and recent activity.
- Sort by name, contact, status, plan, last key use, and balance. Choose a page size and jump between pages.
- Members, Overdue and Access log use matching pagination controls above and below the list. First/Previous appear only after page one.
- Return from a profile with the previous list's filters, sort, page, and scroll position preserved. Overdue and access lists also retain their state.
- View contact and emergency-contact details, plans, access keys, billing history, and staff notes in a compact profile.
- Save or cancel contact edits beside the member's name. Changed fields are marked until saved or reverted; the save cue respects reduced-motion settings. Copy buttons stay inside contact fields and beside key values.
- Identify members with consistent identicons and see their last recorded entry. Individual keys show their last recorded use where events can be associated with that key.
- Add staff notes with an author and date. Long notes expand on demand; notes have their own five-entry pagination. Members cannot view staff notes or change their own staff permissions.

### Membership billing and eligibility

- A combined charge-and-payment history shows dated entries, corrections, refunds, and outstanding amounts. Staff can record payments and correct charges with a reason.
- Charges retain their recorded amounts and membership rate snapshots. Corrections are explicit rather than silently rewriting history when a catalog price changes.
- Staff choose a final billing date when ending a plan. The panel shows the last payment and last entry for context. Earlier unpaid charges remain; later charges stop. Activity dates do not automatically determine cancellation.
- A guided profile panel walks through ending, replacing or activating a plan. Staff preview and save the cutoff before choosing a replacement, then confirm its start date and rate. PayPal subscription changes remain a separate manual step.
- Payments cover the oldest charges first. The grace period is configurable and can be switched off. Payment can restore eligibility once the oldest remaining unpaid charge falls within the grace window.
- Staff access blocks and individually disabled keys remain under staff control; payment processing does not remove a manual block.
- Saving a different grace period immediately changes subsequent eligibility checks. Restoring the previous rule reverses its effect; it does not remove manual blocks, enable disabled keys or reopen canceled memberships.
- The overdue view helps staff review members who are behind, contact them manually, and decide how to handle membership and access.
- Processing offers a preview, an explicit apply action, and run history.

### Payment matching and plan catalog

- **Payment matching** holds offline payment, refund, and cancellation events for staff review. Payer email and subscription references suggest existing members, including conflicting matches; suggestions never create or select an account automatically.
- Search by name, contact email, or PayPal email, then explicitly confirm the match. Unknown payers can become new members only after staff enters their details and confirms creation. The new member and payment are saved together; failures roll both back. No plan, key, or login password is assigned automatically.
- Duplicate event IDs and capture references are checked, including concurrent processing. Refunds must match their original payment and cannot exceed it. Cancellation review still requires a staff-selected final billing date.
- **Plans** lets staff create, rename, reprice, retire, and restore catalog entries. New assignments use the current catalog price; existing and already-scheduled memberships retain their assigned rate and name. Posted charges are unchanged. Retiring a plan removes it from new assignments without ending existing memberships.
- Catalog changes record their author, time, and previous/new values. Stale edits are rejected so one staff member cannot silently overwrite another.

This is an offline foundation, with an explicit test-event form. It is not a PayPal importer or verified webhook receiver; live imports remain disabled.

Access eligibility and ending billing are separate decisions: suspending access does not end an open plan. Imported historical balances still need staff review before they can be relied on for a live transition.

### Access history

The access log supports date ranges beyond the last 30 days, search, result filters, sorting, and pagination. Profiles show member activity and per-key activity where recorded events support that association. Events without a key association are not presented as proven use of a particular key.

The hosted review displays copied records. It does not receive live door events, update a controller, or change physical access. Entry eligibility requires both an Active membership and an enabled key; an Inactive or Canceled membership is ineligible even when its key remains enabled. Member profiles highlight this combination. Before cutover, prove revocation on every physical controller, including cached/offline permission expiry and controller acknowledgment. Use the current door system for urgent revocations until that integration is approved.

### Staff audit history and notification preferences

- The sidebar **Audit log** shows recorded changes across the workspace. Each member profile has an **Audit log** button filtered to that account. Both views support date ranges, staff/action/search filters, sortable columns, and pagination with retained navigation state.
- Payment recordings/corrections, assigned plans and final billing dates, manual charges/corrections, fob assignments/status/removal, profile changes, notes, catalog/settings changes, waiver administration, processing, and report exports are recorded. Change records keep the acting staff identity, time, selected before/after values, and reasons where applicable. Password changes record the action only, never the password or hash.
- Account mutations and their audit records commit together. Fob status changes/removal require a reason and reject stale edits. There is no audit editing or deletion API. Direct database/operator changes are outside application auditing.
- Existing billing and note history is preserved once during migration. Preserved rows are identified, and missing historical values are not invented. Staff actions are the default; system/member activity can also be included. Date filters and displayed audit times use UTC.
- **Staff user settings** (the Cubit gear in the top right) stores preferences for the signed-in staff member only. Grouped choices cover members/plans, payments, access/keys, waivers, account security, and backup/processing issues. Staff-account security choices are restricted to Administration. Everything is opted out initially; successful door entries never qualify.
- Unknown and refused fobs remain separate choices, with a configurable repeat window (15 minutes by default). Optional quiet hours support overnight windows and a chosen time zone. Fictional previews demonstrate filtering, duplicate suppression and quiet hours; they do not create email jobs.
- **There is no email transport, delivery worker, live-event subscription, or email queue in this release.** These are saved preferences and previews, not working notification delivery. Some topics also require future payment, controller or monitoring integrations. A live rollout needs verified event sources, durable per-recipient suppression, current-role checks, retry handling and delivery tests. Historical events must not be replayed as alerts. Recurring payment reminders and weekly digests are not included.

### Reports

- Current membership status and summary figures.
- Active members by month, with line and bar views; the line view starts at the lowest count in the selected period.
- Payments and successful check-ins by month, with selectable bar ranges for comparing gains and losses.
- Busiest times by day of week and hour, or month and calendar day. Multi-year month/day views combine matching months into at most 12 rows and average visits across included dates, including dates with no visits.
- Presets for one, three, and six months, one year, and two years, plus custom ranges without the former two-year limit. The default is three calendar months through today.
- CSV exports for supported reports and staff review workflows.

Historical membership counts are estimates reconstructed from available billing history and the current grace rule, not a complete archive of every past staff access decision. Activity charts count recorded visits rather than occupancy.

### Member portal

Members can view their status, current plan, charges and payments, and waiver records, and update their own contact and emergency-contact information. The billing-history page is a record of entries without balance, past-due, or total-paid summary cards.

Staff handle sign-in help and contact requests manually. From a member's **Sign-in & staff permissions**, staff can prepare a single-use invitation or password reset link, valid for 24 hours, and share it privately with the verified account owner. Cubit does not send these links automatically. Login credentials currently remain associated with member records. Member create/edit endpoints cannot set passwords; use the invitation/reset-link process. Staff corrections to a login email require a reason and revoke existing sessions.

### Organization and staff administration

**Organization Management** in the sidebar is available to Administration accounts. Administrators can create staff accounts or explicitly grant access to an existing member, change staff details and roles, disable logins, and prepare private invitation/reset links. Staff Users have operational tools but cannot manage staff accounts or organization settings. Members retain portal-only access. Staff changes require a reason, reject stale edits, revoke existing sessions and record an audit event. The shared demo account and the last enabled administrator are protected.

Organization name and help email are editable here and feed the login page, browser title and member help links. Changing them does not rename historical signed documents or configure domains, time zones or mail delivery. Login identities still share the member-record model; separating those identities remains planned.

### Account security

Sessions are checked against the account on every authenticated request. Password,
role, and login-email changes invalidate prior sessions; **Sign out** revokes sessions
on all devices. Newly assigned passwords require at least 12 characters, reject the
bundled common-password dictionary, and cannot exceed bcrypt's 72-byte input limit.
Ambiguous imported login emails are rejected until staff resolves the duplicates.
Existing review credentials are retained. Staff can enroll an authenticator from
**Staff user settings → Sign-in & security**, once the operator
provisions the private encryption key. Setup offers a locally generated QR code
and a manual setup key; neither is sent to an external QR service. Staff settings
also shows an email-self password-reset control, disabled until a provider is
connected. The disabled endpoint issues no reset token or email job; administrators
can still prepare private reset links. TOTP codes and recovery codes cannot be
reused, and password resets preserve enrolled MFA. Mandatory staff enrollment,
external recovery-key custody, and verified email delivery remain launch requirements.
See [account security operations](deploy/ACCOUNT-SECURITY.md).

Portal login-email changes generate in-app staff notices and remain in the audit
log. Staff can review and acknowledge them from Staff User Settings. This is
not yet verification that the member owns the new email address.

Authenticator attempts use a database-backed, per-account cooldown shared by sign-in and account recovery. Five failed attempts trigger five minutes; subsequent failed attempts after cooldown double the wait, up to 24 hours. Accepted codes clear the counter, and restarting the service does not reset it.

### Digital and uploaded waivers

Demo checkbox signing is restricted to local and synthetic-demo workspaces. Review and production reject demo waiver publication/signing; retained demo signatures do not satisfy compliance there.

Waiver management uses normal staff and member account permissions, with no additional preview password. The foundation includes versioned templates, required and optional documents, signing history, and a view of active members missing required waivers.

Members can sign through a separately hosted DocuSeal signing page or upload a signed PDF, JPG, or PNG. Staff can attach files or use a phone camera on a member profile. Uploads remain pending until staff checks and accepts them; rejected and superseded files remain available. The active-member compliance list counts the current required version only.

Member profiles group each waiver with that member's signed or uploaded records, including historical versions. Selecting an unsigned current waiver opens attachment controls; signed and pending waivers expand to show their associated documents.

With DocuSeal explicitly configured, Cubit verifies completion server-to-server and saves the signed PDF and signing audit certificate in its private database. Pending submissions are checked every five minutes, with retries if downloading fails. Original templates, file hashes, upload dates, review notes, and audit history are retained. Downloads require authentication and are restricted to staff or the owning member. Files are limited to 10 MB each; member-facing forms accept up to five files per upload batch. Manual uploads share a 250 MB allowance per account ID, regardless of email changes, and a persistent limit of ten attempts per 15 minutes. Existing member uploads are attributed to their account during migration.

Publishing a DocuSeal version requires the same original PDF used in its template, a single signer role, and a required signature field. Cubit fingerprints the document and fields; editing the published template blocks new signing requests until staff clones it and publishes a new version. Existing requests keep their original submission. The synthetic demo stays disconnected from DocuSeal, and its signatures are not legal agreements.

Self-hosted setup uses the free template builder and submission API, without paid embedding. Set `DOCUSEAL_ENABLED=true`, `DOCUSEAL_API_KEY`, `DOCUSEAL_API_URL`, and `DOCUSEAL_PUBLIC_URL` in the private service environment. Hosted review permits only `http://127.0.0.1:3000/api`; its public signing URL must use HTTPS. Keep SMTP unconfigured, submission email/SMS disabled, and DocuSeal on an internal Docker network behind the HTTPS proxy. Credentials, waiver PDFs, and signed records do not belong in Git.

**Settings & Automation → Backups & recovery** controls manual, daily, weekly, or monthly encrypted backups, local retention, and isolated restore tests. The saved-backup inventory shows creation times and captured sizes, supports testing a selected local copy, and lets Administration apply local retention after confirmation. Only Administration can change backup settings or prune copies; Staff Users can view backups, create a backup, and run recovery checks. New snapshots include both Cubit databases, uploaded waivers, DocuSeal files and SQLite, and recovery requirements; private service secrets require independent custody. An operator connects a private S3-compatible destination with independently protected retention separately; the VPS cannot run remote deletion or pruning. Until then, backups remain local to the VPS. See [backup and recovery operations](deploy/BACKUPS.md) for setup, key custody, and replacement-server recovery. Same-server backups alone do not protect against losing the VPS.

## Interface and branding

Cubit uses Melbourne Makerspace blue (`#094fa3`), red (`#ed1c24`), and shades of white. The interface includes a sidebar, responsive layouts, SVG navigation icons, member identicons, and contextual help for billing and staff controls. My portal sits separately at the bottom of staff navigation, with a return-to-staff link in the portal. Unsaved-edit prompts and remembered list state help staff move between records without losing work or their place.

## Review environment and data boundaries

The current hosted review runs on a separate VPS with HTTPS, a Node service, and MySQL bound to loopback. Its application service is restricted to loopback network traffic. It uses its own database and administrator credentials.

- Existing Tonic remains operational and unchanged. No review edits synchronize back to it.
- PayPal and physical-door integration stay disabled in review mode. Self-hosted DocuSeal can be explicitly enabled over loopback; the synthetic demo cannot enable it.
- Scheduled billing processing is paused for imported-data reviews. Staff can explicitly preview and apply processing to the copied data.
- Cubit currently sends **no automated emails**. Staff contact members using their own email tools.
- Review passwords are separate from original credentials. Demo logins do not grant access to imported or hosted review data.
- Deployments preserve private data and credentials. They do not reimport the database or reset member records.

Code updates are explicitly deployed from GitHub with a database backup and health check. Failed activation restores the previous code release; database restoration is a separate operation. Scheduled backups use encrypted restic storage. Off-server copies require an operator-configured private destination and are not enabled merely by installing the feature.

### Synthetic demonstration workspace

The hosted sign-in page also supports a separate synthetic demonstration account. Its session is routed to a separate application process and database, with its own database user, signing key, and operating-system account. It never filters the copied member database to create a demo view. Demo requests fail closed when the demo service is unavailable.

The demo contains fictional members, membership plans, payments, access records, and sample waivers. A persistent banner identifies the workspace. Staff-style edits affect only the shared demo; use fictional details when trying it. Demo edits persist across restarts and are not automatically reset. The shared demo sign-in email, password, and administrator role cannot be changed through the interface.

The operator initializes an empty `cubit_demo` schema using `dist/demo/bootstrap.js`, then runs `deploy/cubit-demo.service` on loopback port 5002 under its own restricted account. Initialization refuses a populated schema. Runtime has no schema-management privileges and cannot read the imported review database or its environment file. PayPal, live doors, DocuSeal, email, and scheduled processing remain disconnected. Demo credentials are supplied separately from repository contents.

### Repository privacy

Application source, assets, tests, and development tools belong in Git. Databases, imported exports, credentials, backups, logs, and screenshots of member records belong outside it. `.private/`, environment files, dependencies, and generated builds are ignored.

**Keep this repository private pending publication cleanup.** The old development documentation has been removed from the current tree and archived privately. Earlier commits still contain aggregate figures derived from real review data and environment details; those require a separate history cleanup before a public release. This README contains no review credentials or real financial totals.

## Architecture and project layout

| Area | Implementation |
| --- | --- |
| Staff interface and member portal | Angular 22, Angular Material 22 and TypeScript 6 |
| API | Express 5, TypeORM 1 and TypeScript 6 |
| Persistence | MySQL with TypeORM |
| Authentication | Password hashing, signed sessions, and staff/member API permission checks |
| Hosted review | Node 22, systemd, and Caddy HTTPS |
| Windows development | Portable tools; Docker, WSL, and Windows services are not required |

| Directory | Contents |
| --- | --- |
| `CubitWeb/` | Angular application, Cubit branding, and interface assets |
| `CubitServices/src/` | API routes, database models, billing, access, and waiver logic |
| `CubitServices/tests/` | Business rules, security-boundary tests, and integration checks |
| `CubitServices/public/` | Generated frontend served by the API; excluded from Git |
| `dev/` | Setup, build, backup, legacy import/export, and verification tools |
| `deploy/` | Hosted-review service and deployment scripts |
| `.private/` | Local-only tools, settings, data, archived notes, and backups; excluded from Git |

Existing local database names and legacy export formats remain compatible. They are internal identifiers, not instructions to connect to the operational server. Original private archives remain unchanged for comparison. Current dependency versions and the TypeScript/Node compatibility constraints are documented in [Dependency maintenance](DEPENDENCIES.md). Versioned operator migrations replace startup schema changes. The remaining production requirements, including independent security review, are tracked in [the pre-launch checklist](PRE-LAUNCH.md).

## Run locally on Windows

From the project directory in PowerShell:

```powershell
.\dev\setup-local.cmd
.\dev\build-web.cmd
.\dev\start-local.cmd
```

Open [localhost:5001](http://localhost:5001). A fresh setup creates synthetic demo data and offers local demo sign-in buttons. Imported reviews use separately supplied private data and operator-managed credentials.

```powershell
.\dev\build-web.cmd  # Rebuild after changing the Angular interface
.\dev\stop-local.cmd # Stop the app and database, preserving local data
```

Setup downloads verified portable tools into `.private/tools/`. Windows development,
Docker, CI, and the hosted API use Node **22.23.3** and MySQL **8.4.11 LTS**
(the VPS uses Ubuntu's 8.4.11 package). `.nvmrc` pins Node; both projects declare
supported engine versions. Plan the Node 24 LTS transition before April 2027.
Never point development at an operational database.

Existing Windows installations using MySQL 8.0.19 need a one-time offline upgrade:
stop the old app with its existing `dev/stop-local.cmd`, run the updated setup,
then run `node dev/upgrade-native-mysql.cjs` before starting Cubit. The upgrader
exports the local schemas, restores them into a fresh 8.4 data directory, compares
all table counts, and preserves both the logical backup and original 8.0 directory
under `.private/`. It never starts MySQL 8.4 against the old data directory. Keep
the old portable MySQL binary until this upgrade is verified. Fresh setups do not
need this step. Native startup refuses an unconverted data directory.

`compose.yaml` provides an optional isolated Docker configuration. The native Windows workflow is the verified development path. Docker requires building the frontend first; Docker startup has not been verified in the current Windows environment.

### Legacy data and backups

`dev/export-legacy-data.cjs` creates a read-only snapshot using the legacy application's existing database configuration. It excludes login passwords. Exported contact details, payment references, and key identifiers remain sensitive and must stay outside Git.

`dev/import-legacy-data.cjs` stages and validates an export in a separate local review database. Import and reconciliation tools are operator workflows, not automatic startup tasks. Preserve the original export, review reconciliation differences, and never substitute invented payment records for unresolved history.

`dev/backup-local.cjs` backs up the configured workspace database into `.private/backups/`. Take a backup before imports or schema work. Synthetic seed/reset workflows must never run against imported review data.

## Checks and deployment

Production dependency audits run for both projects in CI and reject high or critical
findings. Dependabot checks the backend, frontend, and GitHub Actions weekly.
The backend uses Express 5, TypeORM 1, mysql2 3, bcrypt 6, and JWT 9
dependencies. The removed legacy PayPal importer and task API are not available;
the PayPal route remains explicitly blocked.

Browser assets, including the Material Icons font, are served locally under a
Content Security Policy. The HTTPS proxy enables HSTS. Login attempts are limited
by IP and account, and unknown-account failures perform password hashing work.
Member edits reject invalid IDs, unsupported roles, and unexpected fields before
database access. See [security upgrade and launch status](SECURITY.md) for the
remaining phases and requirements; these controls do not constitute launch approval.

GitHub Actions installs frozen dependencies, builds both projects, validates deployment shell syntax, and runs frontend, safety and billing tests. Angular's Vitest checks cover login/MFA, directory state, member-profile drafts, portal contact saves, billing forms, SVG rendering, authentication headers, account recovery and backup selection. The synthetic Playwright layer tests the built login at mobile/desktop widths and walks staff/portal screens against an isolated disposable MySQL database, including profile → audit → profile → directory navigation and persisted contact updates. It blocks external requests and never reads imported datasets. Business-rule coverage includes billing-date boundaries, grace periods, payment allocation, staff blocks, review isolation, calendar averages, and staff/member waiver authorization.

For a checkout with Node and pnpm available:

```sh
pnpm --dir CubitServices install --frozen-lockfile
pnpm --dir CubitWeb install --frozen-lockfile
node dev/build-web.cjs
pnpm --dir CubitWeb test
pnpm --dir CubitServices build
cd CubitServices
node tests/local-safety.cjs
node tests/hosted-safety.cjs
node tests/billing.cjs
node tests/activity-patterns.cjs
node tests/review-controls.cjs
```

The CI database suite requires an explicitly empty disposable `cubit_demo` schema and the guarded settings shown in `.github/workflows/checks.yml`; it creates synthetic test records. Set `CUBIT_BROWSER_TESTS=yes` to include the database-backed browser walkthrough. Install its browser with `pnpm --dir CubitWeb exec playwright install chromium`; `PLAYWRIGHT_CHANNEL=msedge` optionally uses an installed Edge browser locally. `node dev/verify-login.cjs` runs the separate mocked login checks. Older import-verification scripts require private local datasets and are deliberately excluded from CI. A successful build does not prove imported history is correct or live integrations are ready.

### Hosted review configuration

The reference service is `deploy/cubit-review.service`; the release updater is
`deploy/update-review.sh`. The service runs the compiled API from
`/opt/cubit/current/CubitServices`, behind Caddy, with private settings in
`/etc/cubit/review.env`. On an x86_64 VPS, run
`sudo bash deploy/install-build-node.sh` before deployment. It installs a
checksum-verified Node 22.23.3 runtime under `/opt/cubit/tools/`, used by both
the API services and release builds. Ubuntu's system Node binary is left intact.
MySQL application accounts must use `caching_sha2_password`; the removed native
password plugin is not enabled. Pin backup restore images to a verified MySQL
8.4.11 image digest.

Use `CUBIT_MODE=hosted-review`, `HOST=127.0.0.1`, a loopback MySQL connection, a separately validated review schema, and strong independently generated credentials. Hosted mode requires `DATABASE_NAME=cubit_review`, `DATABASE_USERNAME=cubit_app`, and a JWT secret of at least 48 characters. Do not enable local development mode on the VPS. Disable copied login passwords before exposing a review database.

The service's loopback-only network restriction is part of the review boundary. Source code and secrets are managed separately. Hosted startup does not synchronize the schema, seed demo members, or enable daily processing.

After committing and pushing an approved update, the configured operator runs:

```powershell
.\dev\deploy-review.ps1
```

The helper fetches GitHub using the operator PC's credentials, sends a source-only Git bundle over SSH, and invokes the VPS updater. GitHub credentials remain on the PC. A push alone does not deploy. Review the configured target before using this environment-specific helper.

The updater builds a new release, runs checks, backs up both installed workspace databases, runs versioned operator migrations and checks entity/schema drift, activates the code and matching service definitions, and checks `/health`. Failure restores the previous release and service definitions; future migrations must retain compatibility with that rollback release. Data reversals require an operator-reviewed backup restoration. It does not import data or change account credentials. App database users retain CRUD-only permissions; only the separate deployment operator runs migrations.

Application startup never synchronizes schemas, runs migrations, or seeds records. It refuses an unmigrated database. Native development setup explicitly runs `node dev/migrate-local.cjs` before starting the app; existing local data is backed up first. Compose uses a separate initialization container with operator credentials, which the app container never receives. Synthetic seeding is an explicit operator step. Frozen migrations live under `CubitServices/src/migrations`; add a new migration when entity definitions change rather than modifying an applied migration. CI verifies fresh creation, existing-schema upgrades, idempotency, data preservation, and schema drift.

Operations, staff preferences, waivers and backup routes validate request bodies with strict Zod schemas before mutation. Unexpected fields and invalid types return a 400 response; business conflicts such as stale revisions still return 409. Backend source uses ESLint and Prettier, enforced in CI. Run `pnpm --dir CubitServices lint` and `pnpm --dir CubitServices format:check` before committing; `pnpm --dir CubitServices format` applies formatting. Existing service internals are being typed incrementally; the four request boundaries prohibit explicit `any`.

## Planned development

These are next steps, not claims of production-ready functionality. Existing foundations are noted where relevant.

### Independent staff accounts

Provide invite-only officer and staff accounts with password recovery and appropriate permissions, separate from membership records. Staff access should not depend on holding an active membership or sharing a member login.

### Verified payment imports

Connect verified PayPal events to the existing offline matching queue after provider authentication, currency handling, reconciliation, and recovery have been reviewed. Live imports must retain explicit matching for unknown payers and duplicate-payment protection.

### Member photo uploads

Restore a usable photo-upload workflow with image validation, appropriate storage, and staff/member permissions. Retain identicons when a member has no photo.

### Resolve fob issues from the access log

Clearly surface scans from unknown fobs and let authorized staff assign a new fob to the correct member directly from the log, with confirmation and recorded history. Validate the actual controller protocol before connecting the doors.

### Focused access-alert emails

Staff preferences and the no-send preview are available. Connect them to verified live access events and an explicitly enabled email transport, with durable per-recipient duplicate suppression, failure recovery, and delivery tests before launch. Successful entries must never generate email. The current software still sends no automatic emails.

### Recovery readiness and operational HTTPS

Configurable backups, retention, isolated restoration tests, and HTTPS status checks are implemented. Before launch, connect protected off-server storage, verify a restore from it, rehearse recovery on a replacement server, and approve retention. Keep the existing VPS hostname for review; the tracked Caddy configuration accepts an operator-configured hostname when the final domain is ready.

### Production digital waivers

The review includes versioned documents, DocuSeal signing, uploaded paper waivers, staff review, retained files and signing certificates, and compliance reporting. Before operational rollout, approve the final document and signing process, configure off-server backup retention, and verify staff/member account provisioning.

### Dedicated Cubit hosting

Run Cubit on its own VPS so member data and credentials remain separate from other makerspace projects. A dedicated review VPS is already in use; operational hardening, monitoring, backup recovery, and the final cutover remain ahead.

### A makerspace address for Cubit

Publish the operational application at **`cubit.melbournemakerspace.com`**, subject to domain-owner coordination and DNS configuration, with HTTPS and a reviewed transition from testing. This is a planned address, not the current review URL.

### System health

Settings & Automation includes read-only, manually refreshed diagnostics for VPS storage, memory, CPU load, database responsiveness, backup-worker heartbeat, recovery checks and the existing public HTTPS probe. Results are cached for 30 seconds. The synthetic demo hides real server diagnostics. This dashboard does not send alerts or replace independent monitoring when the application is unavailable.

### Trusted computers

After a successful authenticator or recovery-code sign-in, users may trust their private browser for 30 days. Email and password remain required; only the MFA challenge is skipped. Trust uses an HttpOnly, Secure, SameSite cookie on hosted deployments and a server-side token hash with an absolute expiry. Account settings can forget all trusted computers and end all sessions. Existing sign-out-on-all-devices and credential/role changes also invalidate trust. A trusted-browser sign-in cannot extend or issue new trust without a fresh authenticator verification.

### Release storage

The VPS retains only the current application release after a successful update. The updater keeps the previous release available while activating and checking the new one, then removes inactive code directories under `/opt/cubit/releases`. Cleanup shares the deployment lock, validates paths, and refuses releases referenced by running processes or containing mounts. Cleanup failure leaves the healthy application running and reports an operator warning. Database backups, uploaded documents and secrets are not removed. Returning to older code after a completed update requires rebuilding a revision from Git; GitHub does not replace database backups or a tested data-restoration plan. Operators can preview cleanup with `sudo python3 deploy/prune-releases.py` from a trusted checkout and add `--apply` to remove the listed inactive code releases.

### Sign-in visibility

Staff account settings show trusted-browser device/IP details and a private, paginated successful sign-in history (up to 500 entries within 180 days). History starts with this release. Browser labels are self-reported; the shared demo does not retain visitor sign-in history or expose IP addresses.

Approximate location is optional: set `GEOIP_DATABASE_PATH` to an operator-maintained GeoLite2/GeoIP2 City MMDB file outside the release directory, readable by the service, and restart after updating it. Cubit uses the local [MaxMind database reader](https://github.com/runk/node-maxmind); it never sends IPs to a remote lookup service. Without a readable database or a match, it displays “Location unavailable.” A location is not proof of a person’s whereabouts.

Organization Management controls the IANA time zone (default `America/New_York`, Eastern Time with daylight saving). Screens, audit date filters, access report groupings, billing “today,” and backup/quiet-hour scheduling use that zone. Stored timestamps remain UTC; existing calendar billing dates do not shift. CSV access timestamps include the organization time-zone offset.
