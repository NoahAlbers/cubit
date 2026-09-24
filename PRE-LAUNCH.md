# Cubit pre-launch checklist

Last reviewed: **2026-09-24**. **Not cleared for operational launch.**

This is the release gate for replacing the existing membership system, not a
feature wish list. The review VPS must keep live doors, PayPal imports and email
delivery disabled while these gates remain open. Tests use isolated synthetic
data; operational records and credentials never belong in this file.

Update this checklist in the commit that changes a gate. A checked item needs
evidence, the tested release, and a named reviewer. Passing CI or deploying to
review alone does not approve launch. Owners marked **Unassigned** must be named
by the makerspace; target dates and sign-off dates must not be invented.

## Verified foundations

- [x] Patch backend dependencies, remove unused vulnerable packages, add weekly
  dependency updates and CI production audits. Evidence: `ac65a7d`; review verified.
- [x] Harden headers, login timing/limiting and legacy member writes; remove unused
  legacy routes. Evidence: `5e4035f`; review verified. `/ACON` and `/paypal` stay blocked.
- [x] Align local, CI and review application runtime on Node 22 and MySQL 8.4;
  local database migration backed up and table counts checked. Evidence: `1f12083`.
  The configured recovery image was also inspected on 2026-09-24: MySQL 8.4.11,
  digest `sha256:0744ee5ef89ce6ccfa13de3e579fe6b9e27f93dd70da9c06d2c908b1b193fb8d`.
- [x] Revoke sessions on password, role, login-email and sign-out changes; reject
  weak newly assigned passwords. Evidence: `fb25a74`, isolated database regressions.
- [x] Implement and test single-use 24-hour invite/reset links, encrypted TOTP,
  single-use recovery codes, email-change audit/notices and whitespace cleanup.
  Evidence: `1cb6004`, CI run `36024152683`, review deployed and `/health` verified.
  Manual links do not prove email ownership or complete staff enrollment.
- [x] Upgrade the frontend to Angular 22 with production builds and Vitest in CI.
  Full screen/workflow acceptance and the end-to-end CI layer remain below.
- [x] Implement Administration, Staff User and Member permission boundaries and
  organization/staff management. Codex verified on 2026-09-24 with isolated
  database regressions, production builds and component tests: stale updates,
  duplicate addresses, self-demotion protection, session revocation and legacy-API
  permission bypass attempts. This does not replace the operational staff-account
  review or independent authorization review below.

These are implementation checks, not independent security or operational approval.

## 1. Accounts and access

Owner: **Unassigned — account administrator**. Target: **Unassigned**. Sign-off: **Pending**.

- [ ] Reconcile duplicate normalized login emails without silently merging member,
  payment or waiver history. Install and test a unique normalized-email constraint.
  Ambiguous logins currently fail closed; staff must decide the correct identities.
- [ ] Review the administrator list, assign individual staff credentials and verify
  invite/reset identity checks. Record who can grant or revoke staff access.
- [ ] Enroll every operational administrator in TOTP; have each person store their
  recovery codes privately. Enable mandatory staff MFA only after enrollment and
  test recovery without bypassing an enrolled second factor.
- [ ] Store the MFA encryption key outside the VPS, assign its custodian, and prove
  the restored key decrypts enrolled accounts on an isolated recovery server.
- [ ] Configure and test explicitly authorized email transport for invite/reset
  delivery and login-email confirmation. Verify delivery, expiry, resend limits,
  failures and address ownership. Until then staff share links manually and
  email changes generate staff notices; no automatic emails are sent.
- [ ] Review every test/imported login before operational access. The generated
  portal test login stays enabled on **review** by explicit owner request; that
  is not approval to carry it into production. Keep synthetic demo data isolated.
- [ ] Rotate the shared review administrator credential before operational use
  through the separately managed credential process. Never commit credentials.

## 2. Backups and recovery

Owner: **Unassigned — server/backup operator**. Target: **Unassigned**. Sign-off: **Pending**.

Latest local evidence: on 2026-09-24, review release `0c58159` created v2 snapshot
`c2dff18856f1` and successfully restored it into an isolated database, checking
both databases, waiver files and checksums. The deployed inventory shows retained
copies, creation times and captured sizes. CI run `36029780195` passed; Codex
verified the deployed result. This is **not** an off-server or fresh-VPS rehearsal.

- [ ] Choose a private off-server destination, budget, schedule and retention policy.
  No off-server destination has been supplied; same-VPS copies are not disaster recovery.
- [ ] Enable immutable/versioned off-server retention under separate administrative
  control. The VPS credential must not be able to destroy recovery history. Prove
  a VPS-side remote deletion attempt is denied. Remote pruning belongs on a
  separately trusted machine, never in the VPS backup worker.
- [x] Remove private service configuration from new ordinary backup payloads.
  Evidence: release `0c58159`, `cubit-backup-v2` capture regression, 11 worker tests passing,
  reviewed by Codex on 2026-09-24. Previous v1 snapshots remain sensitive and
  restorable; their retention and independent secret custody need operator review.
- [ ] Put the restic repository password and any configuration-decryption key in
  independent secure custody. Record named primary and fallback custodians privately.
- [ ] Verify the configured recovery image's immutable digest and actual MySQL 8.4
  version. Re-run isolated restoration, including both databases, uploaded waivers,
  DocuSeal files, signing certificates and checksums.
- [ ] Rehearse a full restore **from off-server storage onto a fresh server**. Verify
  logins, member/billing totals, retained documents, permissions and integration
  isolation. Record snapshot ID, release, elapsed recovery time and acceptable data
  loss. Built-in container restoration alone does not satisfy this gate.
- [ ] Confirm schedules, retained copies and failure visibility on the deployed
  release. Test interrupted jobs, unavailable storage and a nearly full disk without
  deleting the last usable recovery point. See [operations procedure](deploy/BACKUPS.md).

## 3. Waivers and DocuSeal

Owner: **Unassigned — waiver administrator and server operator**. Target: **Unassigned**. Sign-off: **Pending**.

- [ ] Restrict the public DocuSeal proxy to necessary signing/file/assets paths;
  verify its admin sign-in returns 404 externally or is behind an approved allowlist.
  Prove actual member signing and downloads still work through that restriction.
  Boundary deployed with `0c58159`: external `/sign_in` returned 404, admin/API
  paths were blocked, and an existing signing page plus eight assets loaded
  through trusted HTTPS. Codex verified on 2026-09-24. A complete designated
  signing/download walkthrough still needs the waiver administrator.
- [ ] Give the DocuSeal administrator an individual strong password and MFA; store
  recovery credentials privately. Keep its API/database ports private.
- [ ] Have the makerspace approve the actual waiver document, required signer
  fields, version rules, retention and paper-upload review process.
- [ ] Complete a clearly designated test signing and staff/member upload/download
  walkthrough. Check another member cannot retrieve the document, template changes
  preserve old signatures, and completed PDFs/certificates survive backup restoration.
  Removing Cubit's extra preview password does not complete these launch checks.

## 4. Database, dependencies and application verification

Owner: **Unassigned — technical release owner**. Target: **Unassigned**. Sign-off: **Pending**.

- [x] Replace startup schema changes and synchronization with versioned migrations
  run by the deployment operator. Build a fresh database using only migrations and
  compare it with the review schema; enforce entity/migration drift checks in CI.
  Implementation: `1ef26ce`, CI `36037444971`. Frozen baseline and versioned
  transitions are wired into deployment and explicit local setup; startup performs
  no DDL or seeding. Fresh and existing-schema tests preserve fixture IDs/money and
  detect drift. Local copied data was backed up and migrated on 2026-09-24; app
  privileges were reduced to CRUD. Codex verified hosted release `e87e500` on
  2026-09-24: nine migrations in each database, zero schema drift, CRUD-only app
  grants, three active services and trusted HTTPS health.
- [x] Complete the specified major backend upgrades in separate reviewed pull
  requests: TypeORM 1.x, Express 5.x, compatible current TypeScript, dotenv and
  reflect-metadata. Do not merge dependency branches solely because one check is green.
  Separate PRs #13–#20 cover the backend majors, compatible TypeScript 6, frontend
  libraries/tests and pinned current GitHub Actions. See [dependency maintenance](DEPENDENCIES.md)
  for current versions and upstream compatibility limits. Combined PR #21 passed
  CI `36040603185`; release `e87e500` was deployed and verified by Codex on
  2026-09-24. Full development/runtime audits reported zero known vulnerabilities.
- [x] Add typed request validation throughout operations, staff tools, waivers and
  backups. Enforce linting/formatting in CI and resolve material findings.
  Evidence: `c546c8d`, PR #22, CI `36043351177`; deployed as `a7f7666` and verified
  by Codex on 2026-09-24. Invalid-body/no-mutation tests, valid waiver operations,
  full backend/browser/database checks and lint/format checks passed. Clean builds
  remove retired compiled entities; TypeORM's explicit drift CLI passes. The
  deployment reran zero migrations and both hosted schemas matched the entities.
- [x] Cover login, member directory/profile and portal with frontend smoke tests;
  run isolated end-to-end verification in CI. Evidence: `922b25f`, CI run
  `36034566869`, deployed to review on 2026-09-24. Codex verified 14 component
  tests, login at 320–2560px, and a browser → API → disposable MySQL walkthrough.
  Profile draft/save behavior and copy-control containment at 390px and 1280px
  also passed. Trusted HTTPS health and all three hosted services were verified.
  This does not replace staff acceptance below.
- [ ] Walk every sidebar and portal screen on the review VPS, including saves,
  cancellation, keyboard/mobile use and errors. Record staff acceptance separately
  from the automated synthetic checks.
- [ ] Run the full backend/database/frontend/backup suite and production dependency
  audits against the release candidate. Resolve high/critical runtime findings;
  document any accepted lower-severity findings with an owner and review date.
- [ ] Rehearse deployment failure and code rollback; document when database restore
  is required instead. Back up immediately before operational schema/data changes.

## 5. Doors, payments and imported records

Owner: **Unassigned — door maintainer, payment administrator and membership officer**.
Target: **Unassigned**. Sign-off: **Pending**.

- [ ] Agree on and implement an authenticated per-device door protocol (mTLS or
  HMAC with per-device keys, timestamps and replay protection). Return only
  allow/deny; protect and rate-limit any fob-list endpoint. Keep legacy `/ACON`
  blocked until the replacement is tested with the actual door maintainers.
- [ ] Test valid, unknown, refused, replayed, offline and revoked-device cases;
  agree on door fail-safe behavior and a staffed rollback procedure before cutover.
- [ ] Implement verified PayPal webhook signatures, expected currency and payment
  idempotency. Exercise duplicate, delayed, reversed and unknown-payer events in
  sandbox; unknown payers must enter matching rather than silently create members.
- [ ] Have staff reconcile imported balances and identity collisions. Approve final
  billing dates, corrections/write-offs and grace/access policy, recording reasons.
  Historical unpaid totals must not automatically determine operational access.
- [ ] Agree on a final export/cutover window, reconciliation totals and rollback
  boundary. Test the final import without contacting or changing the existing
  production server during review development. Avoid double-posted payments.
- [ ] If access-alert emails ship at launch, explicitly enable approved recipients
  and transport after testing durable 15-minute duplicate suppression, retries and
  no emails for successful entries. Otherwise record that alerts remain disabled;
  do not replay historical scans into email delivery.

## 6. Hosting, privacy and operational sign-off

Owner: **Unassigned — deployment operator and makerspace launch approver**.
Target: **Unassigned**. Sign-off: **Pending**.

- [ ] Confirm the exact operational hostname and DNS ownership. Prior discussion
  includes both `.org` and `.com`; do not guess. Retain the existing VPS hostname
  for review. Verify trusted HTTPS, HTTP redirect, HSTS and renewal on the final host.
- [ ] Review firewall rules, private MySQL/DocuSeal bindings, service permissions,
  OS patching and SSH recovery. Keep copied data and demo databases/credentials apart.
- [ ] Arrange rotation of previously exposed operational credentials with their
  owners before launch. Existing production credential changes are outside this
  repository task and must be coordinated without interrupting the makerspace.
- [ ] Before making the repository public, review **all Git history** for sensitive
  material, remediate history using an approved plan, and verify a fresh clone.
  Keep it private until that review is signed off. History rewriting is a separately
  reviewed operation; removing a file from the latest commit is insufficient.
- [ ] Obtain an independent review of authentication, authorization, member portal,
  upload/download handling, door and payment integration. Run an authorized security
  scan against the release candidate with safe test data; fix and retest findings.
- [ ] Configure independent health, disk-space and backup-failure monitoring.
  Test alert delivery and acknowledgment. Name the on-call person and backup contact,
  with an incident/restore runbook accessible if this VPS is unavailable.
- [ ] Record final acceptance: release SHA, backup snapshot, recovery evidence,
  staff training/handover, named reviewers and dates. The makerspace launch approver
  explicitly authorizes cutover. Until then Cubit remains a separate review system.

## Sign-off record

| Gate | Named owner | Target date | Evidence / tested release | Reviewer and signed-off date |
| --- | --- | --- | --- | --- |
| Accounts | Unassigned | Unassigned | Pending | Pending |
| Off-server backup and full recovery | Unassigned | Unassigned | Pending | Pending |
| Waivers / DocuSeal | Unassigned | Unassigned | Pending | Pending |
| Migrations / application acceptance | Unassigned | Unassigned | Pending | Pending |
| Doors / PayPal / reconciliation | Unassigned | Unassigned | Pending | Pending |
| Hosting / independent review / on-call | Unassigned | Unassigned | Pending | Pending |
| Final cutover authorization | Unassigned | Unassigned | Pending | Pending |

Optional features such as photos, extra reports and broader member lifecycle work
do not block launch unless the makerspace explicitly adds them to these gates.
Separate staff identities remain planned; individual operational staff credentials,
permissions and MFA are mandatory even while logins share the member-record model.
