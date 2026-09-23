# Performance and navigation — September 22, 2026

The 542-member review database is modest. The main directory bottleneck was per-member billing transactions on every list request: 5,965 SQL queries and 542 writes even when all accounts were unchanged.

The directory now fetches billing inputs in eight batch queries, groups them by member, and calculates the same ledger/access decisions. Only accounts with missing due charges, missing rate snapshots, or changed stored eligibility/balance use the existing locked posting/audit path. Nothing is cached across requests; midnight dues, payment changes, final dates, adjustments, manual holds and grace changes remain effective.

Local direct-directory timings before: 2,153 / 1,849 ms. After: 231 / 177 ms, eight queries and zero writes on unchanged accounts. A hash comparison confirmed matching billing, plan, key-use and access results for every member. These timings measure directory computation, not the complete browser rendering time. The 69-month reports API verification improved from 3,961 ms to 1,332 ms and reconciled monthly/overall payment totals.

Member profiles no longer make three initial requests that calculate the same billing state. Access log now paginates rendered rows and supports search, result filtering and sortable name/time/result columns. Backend access events have stable IDs and deterministic ordering.

Member links carry their originating list URL. Back links return to Members, Overdue, Access log, Waivers, or Billing & automation as appropriate. Page, size, filters, sort and applied report dates live in query parameters. The sidebar remembers each section's most recent view for the current session; list scroll positions are restored after data loads. Signing out clears that navigation memory. Browser Back and profile reloads preserve the return URL. In-progress edit forms and financial-operation previews are deliberately not treated as list settings.

Remaining work if measurements justify it: profile unusually slow pages, reuse grouped billing inputs across report months, avoid calculating charts when only a CSV is requested, introduce database pagination for much larger access logs, and inspect query plans before adding indexes. Caching billing results should only be considered with explicit invalidation for every billing/access edit and date rollover.

Verification: backend typecheck; directory sorting, snapshot and report-period unit tests; real-data directory hash comparison; 69-month reports and CSV reconciliation; browser tests for Members/Overdue/Access log/Waivers return navigation, remembered sidebar views and every report preset.
