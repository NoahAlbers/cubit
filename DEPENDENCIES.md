# Dependency maintenance

Last registry review: **2026-09-24**. Use stable releases, compatible peer dependencies,
and committed pnpm 9.15.9 lockfiles. Do not merge a version-only update without
building and running its affected workflows.

| Component | Selected release |
| --- | --- |
| Angular / Material / CLI / build | 22.2.0 |
| TypeORM / reflect-metadata | 1.1.1 / 0.2.2 |
| Express / dotenv | 5.2.1 / 18.0.3 |
| Vitest / jsdom / Playwright | 5.0.1 / 30.1.1 / 1.63.0 |
| QR generator / Zone.js / tslib | 2.0.4 / 0.16.3 / 2.8.1 |
| TypeScript / Node types | 6.0.3 / 22.20.4 |
| GitHub checkout / setup-node | 7.0.1 / 7.0.0, immutable commit pins |

Every other direct npm dependency matched the registry's latest stable release
in this review. Transitive dependencies were refreshed within their supported
ranges. Full production **and development** dependency audits reported no known
vulnerabilities in either project; that is a dated audit result, not a guarantee.

## Compatibility constraints

- **TypeScript 6.0.x:** Angular 22.2 requires `>=6.0 <6.1`. The API's ts-node
  10.9.2 also needs the JavaScript compiler API, which TypeScript 7.0 does not
  expose as a stable API. Keep both projects on 6.0.3 until the respective
  upstream tools support the newer compiler, or replace ts-node in a separately
  tested development/tooling migration. See [Angular compatibility](https://angular.dev/reference/versions)
  and [TypeScript 7 release notes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- **Node types 22.x:** use the latest types for the actual Node 22 runtime,
  rather than allowing code to compile against Node 26-only APIs. Node 22.23.3
  and MySQL 8.4.11 remain the runtime baseline required by the upgrade spec;
  plan Node 24 LTS adoption before April 2027.
- **pnpm 9.15.9:** retained as the explicitly specified package-manager version
  across native tools, CI and deployment. Upgrade the package manager and lockfile
  format together in a separate tested change.

Dependabot continues to propose supported updates weekly. Its TypeScript and Node
type constraints prevent repeatedly proposing incompatible major updates. Recheck
those constraints when upgrading Angular, ts-node or the application runtime.

## Verification

Use `pnpm outdated` in each project; the expected exceptions are TypeScript and
Node types above. Run `pnpm audit --audit-level=high` in each project, including
development dependencies. CI builds both projects, runs frontend and security
regressions, creates a disposable MySQL database solely from migrations, checks
schema drift and upgrade preservation, and exercises staff/member browser flows.
Keep review integrations disabled throughout dependency verification.
