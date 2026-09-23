# Cubit billing and automation

## Stored billing history

Each membership snapshots its plan name and monthly rate. Monthly charges are
posted once, with a unique membership-plan/date key. Changing the catalog cannot
reprice old charges or existing subscriptions. A new subscription uses the current
catalog rate. Start-date anniversaries clamp to the last valid day of the month
without drifting (January 31 → February 28/29 → March 31). There is no proration.

The local migration stored 343 charges for 75 synthetic accounts and compared every
balance and past-due total with the previous calculation, inside one transaction.
It aborts on a mismatch. The completion marker prevents reseeding. A pre-change
SQL backup is in `.private/backups/`. Production requires its own reviewed migration
and reconciliation; this development app still uses local schema synchronization.

Amounts use integer cents for allocation and DECIMAL database columns. Payments
apply to the oldest nonvoided charges first. Due-today charges affect the balance
but become past due tomorrow. Credits may make an account balance negative.
Excess refunds are shown as unallocated debits requiring review.

The profile has one **Billing history**, newest first, with a date-order toggle.
Charges add to the balance; payments subtract from it; refunds add back to it.
The visible current entries reconcile to the balance. Superseded payment entries,
reversals, amount corrections and stopped charges stay in collapsed **Change history**.

- **Add entry:** choose Payment, Refund, or One-time charge; enter a date and amount.
  Amounts are positive in the form. Refunds and charges require a description/reason.
  A refund records money already returned; it does not transfer money.
- **Edit a charge:** set the correct amount, or choose **Waive this charge** to make
  it zero. A reason is required, and the form previews the balance change. Staff can
  increase a charge or restore a waived amount using the same editor. The change
  affects only that entry, never the subscription's recurring rate.
- **Edit a payment/refund:** correct its fields with a reason. **Remove this entry**
  sets its replacement to zero. The backend retains the original and appends a
  reversal and replacement; zero replacements are hidden from ordinary history.
  Imported PayPal entries remain protected and are handled through refund events.
- **End billing / Review cutoff:** enter an inclusive final billing date and reason,
  preview, then save. Later subscription charges are marked void and retained in
  change history. Correcting the cutoff restores the original charges or posts
  missing anniversaries. One-time charges are independent of the subscription.

Internally, signed charge corrections preserve the original amount and the staff
reason. Staff edit the desired total instead of calculating credit/debit adjustments.
Concurrent stale edits are rejected. Payment reversals use the original payment
date so reporting reflects the corrected receipt; creation times preserve the audit.
Member-row locks and unique request IDs prevent double posting when users double
click, retry, or receive duplicate events. Date inputs reject future payments.
Billing days and the local schedule use this PC's calendar/timezone.

## Access policy

The approved initial grace period is **60 days**, configurable from 0–365 days.
A current membership remains eligible through day 60 after its oldest unpaid charge;
it is suspended on day 61. A payment restores eligibility once the oldest unpaid
charge falls back within grace. Fully paid or credited current accounts qualify.
Accounts with excess unallocated refunds require staff review and do not qualify.

A staff access block always wins. Automation never changes a key's Active/Inactive
setting, so a manually disabled key cannot be re-enabled by payment. Eligible
membership plus an individually enabled key is required by the local door-check
and whitelist endpoints. Ended memberships require a current/new plan to qualify.
Existing Active/Inactive/Canceled labels remain; no new lifecycle was introduced.

Eligibility is refreshed by payments, adjustments, cutoff changes, profile/directory
reads, access checks, and daily processing. Suspension/restoration changes are
recorded in the account's operations history. A changed grace setting applies on
the next eligibility calculation, without waiting for the daily job.

## Scheduled processing

While the local app runs, a minute timer checks for a daily run after **9 AM in this
PC's timezone**. One successful run per calendar date is recorded transactionally.
On restart, it catches up after 9 AM. Posting processes all missing anniversaries,
not just today's charges.
Failed runs leave an error record and can retry; settings-row locking serializes runs.
Manual runs are also recorded, with staff identity. **Preview run** changes nothing.

- Daily processing: enabled initially.
- Emails: handled manually by staff outside Cubit.

An optional scheduler-friendly command uses the same guarded local database:

```powershell
& .private/tools/node17/node.exe dev/run-automation.cjs --preview
& .private/tools/node17/node.exe dev/run-automation.cjs
```

Without `--preview` the command runs the daily job or skips an already completed
calendar date. No Windows scheduled task, external cron, or Codex automation was
installed. The database must be running. A production scheduler needs an explicit
makerspace timezone, process supervision.

## Payment-event review

The staff page accepts **local test events**, not real PayPal webhooks. Match a member
or use an existing exact subscription-ID mapping, then process. Unmatched events
and errors remain reviewable/retryable. Payments/refunds deduplicate both event IDs
and resource IDs. Conflicting reuse is rejected. Refunds must reference the original
capture, match its member, and cannot exceed that payment across distinct refunds.
Cancellation events wait for staff to set the final billing date, then retry/review
marks them processed. Cancellation receipt alone never changes charges or access.

All `/paypal` endpoints remain blocked and no production credentials were used.
Live integration still needs authenticated provider webhooks, currency/event-schema
validation, subscription mapping, reconciliation, and staged failure tests. The
simulation endpoint is staff-only and must never stand in for signature validation.

## Staff notes and reports

Staff notes are append-only text with author and timestamp, visible only to staff.
They do not appear in roster exports. Access changes require a reason
and retain an audit entry. Sam Example has one explicitly marked demonstration note.

Reports provide monthly net payments, successful check-ins, unique visitors,
current membership counts, and active members by month. The monthly count is unique
members eligible at month-end (or the selected end date for the final month), including
the billing grace period. Past dates are explicitly estimates: corrected billing
records and today's grace period are used; historical staff blocks are unavailable.
Today's count includes current staff blocks and matches the active-member summary.
Date filters affect payments and entry events; roster and overdue exports are current snapshots.
Net payments include refunds and reversal entries; they are not invoiced revenue.

Staff-only CSV exports: roster, transactions, overdue and check-ins (granted and denied).
Exports quote fields, escape quotes/newlines, neutralize spreadsheet formulas and create export audit records. Waiver compliance is available in the separate Waivers screen.

## Validation

`tests/operations.cjs` covers migration-related rate stability, charge/payment
idempotence, concurrent payment retries, immutable correction amounts, credits,
cutoff void/restore, the exact grace boundary, manual holds and disabled keys,
notes authorization, event matching/refund totals/cancellation, dry-run behavior,
repeat automation runs, report permissions, CSV escaping and local isolation.
Temporary test accounts and their billing records are removed afterward.
`tests/membership-history.cjs` checks monthly counts, overlapping plans, inclusive
dates, grace boundaries, payment timing, corrections and current staff blocks.
