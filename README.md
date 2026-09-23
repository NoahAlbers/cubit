# Cubit

Cubit is membership-management software for Melbourne Makerspace. It includes a
staff directory, membership and billing history, access records, reports, member
self-service, staff notes, and waiver-management foundations.

## Repository contents and privacy

This repository contains application source, brand assets, development scripts,
and tests. **It does not contain the member database, payment exports, credentials,
or backups.** References to `.private/` in scripts point to files on the operator's
computer; those files are excluded from Git.

A fresh development setup creates synthetic demo members. Imported review data
must be supplied separately and kept outside the repository. Never commit `.env`
files, database exports, access credentials, logs, or screenshots of member data.

## Development on Windows

Docker is optional. From the repository root in PowerShell:

```powershell
.\dev\setup-local.cmd
.\dev\start-local.cmd
```

Open [localhost:5001](http://localhost:5001). The fresh synthetic demo provides
local demo sign-in buttons. Imported review copies use separate credentials
stored privately by their operator; demo sign-ins do not work against them.

```powershell
.\dev\build-web.cmd  # Rebuild after editing the Angular frontend
.\dev\stop-local.cmd # Stop while preserving the local database
```

Setup downloads portable Node, MySQL and pnpm into the ignored `.private/tools/`
folder. It does not require Windows services, WSL, or virtualization. The legacy
Windows compatibility setup uses Node 17 for the API and Node 22 for builds.
The hosted review uses Node 22. Dependency/runtime modernization is still needed
before operational use.

## Project structure

| Path | Purpose |
| --- | --- |
| `CubitWeb/` | Angular frontend and Cubit assets |
| `TonicServices/src/` | Express API, database models, billing and waiver logic |
| `TonicServices/tests/` | Business rules, security boundaries and integration checks |
| `dev/` | Local setup, build, backup and private import utilities |
| `deploy/` | Isolated hosted-review service and update script |
| `docs/` | Behavior, setup and development notes |

## Review environments

Cubit is currently a **non-live review application**. Existing Tonic remains the
operational system. A hosted review uses an independent database and sign-in
credentials. It does not synchronize changes with operational Tonic.

Review mode disables PayPal and door integration, live DocuSeal and scheduled
billing processing. Cubit sends no email. Staff can test edits and manually run
processing against the copied data. The hosted service is additionally restricted
to loopback network access.

See [hosted review setup](docs/hosted-review.md),
[billing rules](docs/cubit-billing.md), and
[member portal and waivers](docs/member-portal-and-waivers.md).
Historical development notes describe earlier iterations and may include
superseded behavior; use the current setup instructions above.

## Checks

GitHub Actions builds both projects and runs database-free safety and billing
tests. Integration tests require the appropriate local dataset and may modify
synthetic records. Do not run demo seed/reset tests against an imported review.

No database, credentials or live integrations are required for the GitHub checks.
