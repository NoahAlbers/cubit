# Security upgrade and launch checklist

Cubit remains a review deployment. Production door access and payment imports are disabled.
Changes to this repository must not connect to or modify the existing membership system.

The maintained [pre-launch checklist](PRE-LAUNCH.md) records required gates,
evidence, missing owners, and sign-off. Update it with each completed milestone.

The September 2026 specification contains eight numbered phases (its introduction
and some cross-references say nine). Work follows the numbered phases below.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Patched runtime dependencies, dependency alerts, CI audits | Verified locally and in CI; review deployed and healthy |
| 2 | Headers, login hardening, legacy-route validation and removal | Verified locally and in CI; review deployed |
| 3 | Node 22 and MySQL 8.4 alignment | Local logical upgrade, CI, and review deployment verified |
| 4 | Revocable sessions, account recovery, MFA, identity cleanup | Sessions, single-use links, TOTP, account notices and audited email trimming verified in CI and deployed; staff enrollment, duplicate reconciliation and email ownership verification remain launch requirements |
| 5 | Backup confidentiality, immutable offsite recovery, DocuSeal boundary | `0c58159` deployed after green CI; v2 backup restored in isolation; public DocuSeal admin returns 404 and signing assets load. Offsite policy, external key custody, full signing and fresh-server recovery remain pending |
| 6 | Angular modernization and frontend regression coverage | Angular 22 implemented; `922b25f` passed CI run `36034566869` and deployed; 14 component tests and synthetic browser/database walkthrough pass. Staff acceptance remains pending |
| 7 | Versioned schema migrations, backend major upgrades, request validation | Frozen baseline builds a disposable database with zero entity drift; runtime/deployment migration wiring, existing-data upgrade checks and major upgrades remain pending |
| 8 | Independent review and operational launch gates | Not signed off |

## Verification

Before each milestone: build the backend and frontend, run the CI regression
suite locally (database tests use an isolated disposable schema), and audit both
production dependency trees. Commit lockfiles with pnpm 9.15.9. CI must pass before
review deployment. Back up the database before schema changes and verify health
after deployment. Keep imported records, credentials, backup archives, and local
audit evidence out of Git.

Phase 1 local checks: backend build, frontend build and five frontend tests,
backend CI regression tests including database integration tests, and backup
worker tests. Production audits: no high/critical findings; the backend has one
low finding and the frontend has none. These counts are a point-in-time result,
not a guarantee that future audits will remain unchanged.

## External launch requirements

Launch still requires an offsite storage destination with independently controlled
retention, external recovery-key custody, a fresh-server restore rehearsal,
staff reconciliation of imported billing records, authenticated door integration,
verified payment imports, an independent security review, monitoring, and a named
on-call owner. Each requires an owner and a dated sign-off before cutover.
The shared review administrator password is outside this upgrade's scope.

Imported contact-email collisions require staff reconciliation before a unique
normalized-email index can be installed. Ambiguous login addresses fail closed;
accounts and financial history must not be merged automatically. The generated
portal test login is intentionally retained for testing at the owner's request.

## September 25 security follow-up

Backup settings and retention cleanup require Administration. Upload quotas use immutable account IDs, with a database-backed upload-attempt limit. Demo waivers cannot be published, signed, or counted toward compliance outside local and synthetic-demo modes. Legacy member writes reject passwords and require reasons for login-email changes. Authenticator guessing limits persist across restarts, escalate after failures, and apply to recovery as well as sign-in. The unbounded member list is retired in favor of the paginated directory; profile responses omit authentication internals. Malformed portal profile requests return 400.

Synthetic regression tests cover these boundaries, concurrent upload quota checks, email-change attempts, restart persistence, and retained historical records. Migration 12 adds uploader attribution and persistent throttle storage without deleting documents. Operational MFA enrollment, email ownership verification, independent security review, and off-server recovery remain required in PRE-LAUNCH.md.
