# Billing cleanup before the Cubit switch

Analysis date: September 22, 2026. Based on the preserved deployed Tonic source and the local export captured at 17:43:01 UTC. This is a proposed review workflow, not an implemented migration or a decision to waive, collect, or erase balances. No member financial records were changed for this analysis.

## What the source actually does

- Tonic reconstructs monthly charges using membership start/end dates and the plan catalog's current monthly price. It does not preserve a historical invoice for each month. Changing a catalog price can therefore change old calculated charges.
- A plan without an end date continues accruing charges. Marking its member inactive does not end the plan. No cancellation handler was found in the archived API routes inspected.
- Every payment attached to a member is subtracted from all their reconstructed charges. Payments with no corresponding plan history become apparent credit. A missing/misdated plan can therefore look like prepayment.
- The PayPal importer matches by PayPal email and creates a member if no match exists, but does not create a membership plan. Its new-member insert is not awaited before saving the payment; this creates a possible path to unassigned payments.
- PayPal retrieval requests a 31-day window and a single page of up to 500 records. Only subjects containing "membership" are imported. Missed runs, additional pages, and differently described transactions are possible gaps, not confirmed missing money in this export.
- The importer does not explicitly filter transaction status before saving. All 7,650 exported PayPal entries carrying the inspected one-letter status codes are S; this audit did not find P/D/V/F entries. Do not claim failed payments caused these balances without evidence.
- The stored member balance and dynamic balance are different concepts in Tonic: its status updater writes zero when no current plan exists, even if the reconstructed history is nonzero. Concurrent, unawaited status refreshes can also leave stale stored values.
- Month-end date rollover and exact timestamp cutoffs differ from Cubit's inclusive calendar-date calculation.

## Patterns in the export

Calculated using Cubit's calendar rules at the export date; these are not verified amounts owed or confirmed prepaid funds. Categories can overlap.

| Review flag | Count / amount |
| --- | --- |
| Accounts with calculated credit | 82; $13,445 total |
| Credit accounts with no membership plan at all | 38; $8,000 total |
| Credit accounts with payments before their first plan | 20 |
| Credit accounts with payments after their final plan ended | 6 |
| Accounts with calculated positive balances of at least $1,000 | 142; all have an open-ended plan |
| Accounts with positive balances, an open plan, and no positive payment in the preceding year | 179 |
| Unassigned payments | 28; $1,200 total |
| Duplicate contact email / PayPal email groups | 11 / 16 |
| Memberships whose end timestamp precedes start | 14 |
| Members with overlapping plan periods | 6 |
| Balances differing from Tonic's stored field / dynamic formula | 99 / 30 |

These observations support missing membership history and missing cancellation dates as major review priorities. They do not establish an individual member's actual cancellation date, prove duplicate people, or justify automatically removing credit.

## Proposed staff workflow

Add one temporary **Migration review** page, with filters for needs review, large balances, missing plans, missing end dates, unmatched payments, duplicate identities, and ready for switch. Sort by amount or issue type. Start with people who currently use the space, then former members and unresolved accounts.

Each account should show a short timeline: plan periods, recorded payments, last successful key use, original stored balance, reconstructed balance, and the reason it was flagged. Key use and last payment are clues, not authoritative cancellation dates.

Keep the main decisions simple:

1. **Confirm the plan and paid-through period.** Correct missing history, rate, or dates when staff has evidence. Preview the result before saving. Historical rate edits need explicit recalculation of affected posted charges; changing today's catalog price must never silently rewrite history.
2. **End the membership.** Staff enters the final billing date, sees which later charges stop, and separately decides what to do with earlier unpaid dues. This builds on Cubit's existing final-date control.
3. **Resolve the opening balance.** Confirm genuine prepaid credit, keep an agreed amount due, or waive disputed/uncollectible legacy dues under the makerspace's policy. Use an explicit, reversible, non-cash migration adjustment with a reason—not a fake payment or refund.
4. **Match records.** Reassign unmatched payments or merge confirmed duplicate member records only after staff review. Show every affected plan/payment/key and potential conflicts. Never merge accounts based only on a shared email address.
5. **Mark reviewed.** Record the reviewer, date, evidence/note, approved balance, membership status, and access outcome together.

For bulk cleanup, select an explicit reviewed group, show per-member before/after effects, require a reason, and retain an audit trail plus undo. Do not automatically zero balances based on an amount threshold.

## The switch

- Keep the original export and original transaction history immutable and available for reference. Label reconstructed legacy charges clearly.
- Choose a cutover date. Carry only staff-approved balances into ongoing eligibility calculations. Retain unresolved accounts as a review queue; decide their access explicitly rather than allowing suspect historical balances to make the decision.
- Avoid double-counting historical charges/payments alongside an opening balance. A reviewed opening-balance boundary or explicit reconciliation entry needs a dedicated implementation and tests.
- Before final import, reconcile payment IDs/totals, account links, plans, approved balances, active status and key access. Take a fresh export and apply only new changes after the reviewed snapshot, with a rollback copy.
- Preview all access changes before activating automation. No automatic emails, payment-provider writes, or key changes are part of this proposal.

## Preventing a repeat

Cubit already records charge amounts and audits billing edits, but imported missing dates and plans still need correction. An open plan still accrues charges in Cubit even after access is suspended. The 60-day access grace period is therefore separate from the decision to stop billing.

The makerspace should explicitly decide whether staff ends memberships from a review queue, or whether a future approved rule also stops billing after nonpayment. Do not infer cancellation automatically from the last payment or last visit. Retain staff-entered final billing dates under the current agreed policy.

Future payment integration should match stable subscription/payer identifiers, process each provider transaction once, handle all pages and missed periods, distinguish successful payments/refunds/reversals, and queue uncertain matches instead of silently inventing accounts. Implement and test those rules before enabling live synchronization.

Reproduce the aggregate analysis with `dev/audit-tonic-export.cjs`; its output stays in `.private/imports/billing-pattern-summary.json`. This tool reads the archived export and never connects to a database.
