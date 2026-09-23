# Cubit — Melbourne Makerspace

Local development of the makerspace's Tonic application, now becoming **Cubit**.
The backend comes from the September 22, 2026 server snapshot. Editable Angular
source was recovered from the public makerspace frontend's `dev` branch.
Existing Tonic production systems are unchanged. This workspace also has a separate local
review database populated from the September 22 Tonic export. The selected dataset
is saved in `.private/native/settings.json`; the sidebar identifies imported data.
The synthetic demo database is preserved separately.

This repository contains source code only. Credentials, member/payment exports,
database backups, generated builds, and local design/audit output are excluded.
The optional hosted review uses its own database and credentials; see
[hosted review deployment](docs/hosted-review.md).

## Run on Windows (no Docker)

Setup is complete on this PC. From PowerShell:

```powershell
Set-Location 'C:\Users\nalbers\Desktop\Makerspace\Tonic'
.\dev\start-local.cmd
```

Open [Cubit](http://localhost:5001). **For the imported-data review**, use the local
credentials in `.private/imports/local-access.txt`. Those passwords work only in
this copy. Import findings are in `.private/imports/import-summary.md` and detailed
reconciliation files beside it; keep these files private.

For the separate synthetic demo dataset, staff sign-in is:

- Email: `admin@example.test`
- Password: `LocalDemoOnly!2026`

To stop while keeping the database: `.\dev\stop-local.cmd`.

For a fresh checkout, run `.\dev\setup-local.cmd` before starting. The setup
downloads checksum-verified portable Node/MySQL and pnpm into `.private/tools`;
it needs no Windows services, WSL, virtualization, or execution-policy changes.
Repeated starts reuse this workspace's processes. Stop before reinstalling backend
dependencies. Runtime Node is 17.6.0; portable MySQL is 8.0.19. Node 22.16.0 runs
the package manager and frontend build. These legacy application versions are a
compatibility baseline; upgrading them remains future maintenance.

## Make changes

- **API:** edit `TonicServices/src/`; nodemon restarts it automatically.
- **UI:** edit `CubitWeb/src/`, then run `.\dev\build-web.cmd` from the root and
  refresh the browser. This installs frontend dependencies if absent, builds
  Angular, and copies its output into `TonicServices/tonic/`.
- **Brand assets:** supplied originals are in `output/cubit/`; web copies are in
  `CubitWeb/src/assets/`, with the favicon at `CubitWeb/src/favicon.ico`.
- **Login:** the supplied v2 design is integrated in `components/admin/login/`,
  including responsive artwork, password visibility and reduced-motion-aware gear
  animation. Actual authentication determines success/failure; demo sign-ins are
  under **Try the local demo**.
- **Logs:** `.private/native/app.stdout.log` and `app.stderr.log`.

The staff session persists across refreshes in this browser tab until its JWT
expires (one hour). Browser URLs for Members, Overdue, profiles, Access log, and
Reports, Billing & automation, Waivers, and the member portal serve the Angular app; JSON clients
retain the backend's legacy routes.

## First iteration

Members can be searched by first/last/full name, regular email, PayPal email, and
phone number. Combine status, plan, successful key-use recency, and never-used
filters. Lists have pagination and balance/activity sorting. Summary cards show
active members, ongoing past-due members, and distinct members with a successful
check-in in the past 30 days (excluding denied and future-dated entries).

Overdue focuses on ongoing memberships that are behind, sorted longest overdue
first. Ended memberships are available through a checkbox. Access and age filters,
email links, and a shortcut to access keys support staff follow-up. Clicking a
member row opens their profile; charge dates default newest-first and can be
reversed from the column heading. Open a
profile → **End billing** → enter a **final billing date and reason** → **Preview
balance** → **Save final billing date**. Charges on that date are included; later
charges stop. Existing unpaid dues remain. The profile includes the charge
breakdown, payments, and a dated staff change history. PayPal subscriptions are
not changed by this local action.

Profiles include staff notes with author/date, access blocks. One **Billing history** combines charges, payments and refunds.
**Add entry** records payments, refunds or one-time charges; **Edit** corrects an
entry, waives/restores a charge, or removes a mistaken payment. **Change history**
keeps the audit trail collapsed by default. Billing uses stored charges and fixed
membership rates; corrections preserve the original transaction. The initial
migration reconciled all 75 accounts and stored 343 charges.

**Billing & automation** has a configurable 60-day grace period, payment-driven
access restoration, daily processing, run previews/history and a payment-event
review queue. PayPal events are local simulations. Live integrations remain disconnected. **Reports** includes charts and
CSV exports for roster, transactions, overdue and check-ins.

Read [billing rules and limitations](docs/cubit-billing.md) and the
[feature roadmap](docs/cubit-roadmap.md). The full lifecycle/custom-status project
was dropped by request. The **member portal** now supports membership/plan/billing
overviews, contact and emergency-contact editing, and
waiver history. **Waivers** supports versioned local demos, signing and active-member
compliance. A server-side DocuSeal adapter is prepared but remains disconnected
until a sandbox key is configured. See [portal and DocuSeal setup](docs/member-portal-and-waivers.md).
Live integrations and historical retention/workshop reporting remain future work.

## Synthetic data

There are 75 demo members: the original three plus 72 additional scenarios.
They include multiple plans, differing regular/PayPal emails, formatted phones,
partial payments, overdue tiers, canceled accounts with/without debt, credits,
future memberships, and successful/denied access events.

The original empty-database seed and the additive scenario seed are separate.
Scenario seeding uses a reserved plan ID as its completion marker and runs in one
transaction; restarting neither duplicates fixtures nor resets edits. Dates are
relative to first seeding and are not shifted on every start. Members will age
naturally as the calendar advances. One fake record (Casey Brooks) was canceled
through the browser during verification and retains its demonstration audit entry.

New memberships offer Standard ($60), Student ages 18–28 ($30), and Standard with
1/2/3 additional keys ($90/$120/$150), all monthly. A separate additive catalog
seed retires old fixture plans from new assignments, preserving their existing
rates and billing history. It does not reprice existing memberships or provision
additional keys automatically.

## Validation

For the imported-data copy, run `dev/verify-import.cjs` with the local Node 17
runtime from the workspace root. The synthetic integration suites below expect
the separate demo dataset and its demo logins; switch to that dataset first.

With the local app running:

```powershell
Set-Location 'C:\Users\nalbers\Desktop\Makerspace\Tonic\TonicServices'
& '..\.private\tools\node17\node.exe' node_modules/typescript/bin/tsc --noEmit
& '..\.private\tools\node17\node.exe' tests/billing.cjs
& '..\.private\tools\node17\node.exe' tests/local-safety.cjs
& '..\.private\tools\node17\node.exe' tests/native-smoke.cjs
& '..\.private\tools\node17\node.exe' tests/cubit-integration.cjs
& '..\.private\tools\node17\node.exe' tests/operations.cjs
& '..\.private\tools\node17\node.exe' tests/billing-history.cjs
& '..\.private\tools\node17\node.exe' tests/portal-waivers.cjs
& '..\.private\tools\node17\node.exe' tests/membership-history.cjs
```

The billing tests are database-free. Safety tests block external integrations.
Smoke/integration tests use only localhost:5001 and TonicLocalDev. They exercise
search/filter/sort/pagination, permissions, cents, cutoff preview/save/audit,
stale edits, cancellation debt, immutable billing, payment retries, refunds, grace
boundaries, notes permissions, automation and CSV exports. Temporary integration records are removed;
the smoke test restores its temporary phone edit. The legacy smoke fixture's
current balance may naturally change after a later monthly anniversary.

## Local boundaries and source map

The API binds to `127.0.0.1:5001`; native MySQL binds to `127.0.0.1:3307` with its
X Protocol disabled. Database files, generated local credentials, and logs are
under `.private/native/`. Do not delete this folder unless discarding local data.
Configuration rejects production database names/users and nonlocal hosts. The
imported review permits only the dedicated `TonicLocalReview` schema on loopback.
Review startup checks its completed import marker and skips schema synchronization,
all demo seeders, and the daily scheduler. Staff can still test local edits and
manual processing; opening profiles still calculates charges and eligibility.
Cubit has no email sender; staff use their own mail client. All `/paypal` routes
return HTTP 403; no physical
door controller or cron is connected. Browser API requests stay on the same origin.

| Path | Purpose |
| --- | --- |
| `CubitWeb/src/app/components/directory/` | Member search and overdue UI |
| `CubitWeb/src/app/components/member/` | Profiles, payments, cutoff preview and history |
| `CubitWeb/src/sass/_cubit.scss` | Cubit layout and colors |
| `TonicServices/src/billing/` | Calendar/cent calculations and roster filtering |
| `TonicServices/src/api/routes/cubit.ts` | Staff directory and billing API |
| `TonicServices/src/api/routes/ACON.ts` | Local RFID whitelist and entry endpoints |
| `TonicServices/src/entity/` | TypeORM database models |
| `TonicServices/src/dev/` | Local guards, schema conversion, and fixtures |
| `dev/` | Native setup/start/stop and frontend build scripts |

The original archive and Docker metadata remain unchanged under
`.private/tonic-export.aaGoaM/`; they contain production secrets and are excluded
from Git. See [import provenance](docs/import-notes.md). Never publish `.private`.

Synthetic-demo schema startup converts old money columns with preserving `ALTER TABLE`
statements before synchronizing additive entity changes. This development copy
must not be pointed at production. A reviewed migration, balance reconciliation,
security review, runtime upgrades, and staging are required before deployment.

The earlier optional `compose.yaml` remains for a machine with Docker support.
It uses a separate database volume and the same port 5001, so stop native services
first. The Docker build is untested on this PC and is not required here.
