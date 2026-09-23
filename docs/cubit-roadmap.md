# Cubit roadmap

## Delivered locally

- Cubit branding, SVG navigation, searchable member directory and operational
  overdue view. Existing Active/Inactive/Canceled statuses are retained.
- Staff account notes with author/date; manual access blocks,
  and audited access changes.
- Stored charges, membership rate snapshots, audited credits, append-only payment
  corrections, idempotent processing, and staff-entered final billing dates.
- Configurable grace (initially 60 days), payment-driven access restoration,
  daily processing and run previews/history.
- Local payment-event inbox with matching, retries, duplicate protection, refunds,
  and cancellation review. Live PayPal remains disconnected.
- Reports for current membership status, monthly active members, net payments and entry
  activity; CSV exports for roster, transactions, overdue and check-ins.
- Synthetic scenarios and automated integration tests. No production systems changed.

The full lifecycle/custom-status project is out of scope by request. Staff notes
were added independently rather than introducing new membership states.

## Next: connect live services

Review and reconcile real data in staging. Replace local schema synchronization
with a reviewed migration and rollback plan. Configure authenticated PayPal webhook
verification, supported event/currency schemas, real subscription mapping, event
retention and delivery retry monitoring. The local simulation path is not a webhook
verifier. All email is handled manually by staff outside Cubit.
Choose an explicit makerspace timezone and supervised
production scheduler. See [billing behavior](cubit-billing.md) for local boundaries.

Review staff and device authorization, rotate exposed credentials, upgrade legacy
runtime/database/frontend versions, and test door-controller behavior in staging.

## Member portal

Available locally: own membership status, plans, billing history, waivers, contact
and emergency details, with member-only API access.
Next: staff-managed account provisioning/recovery and certifications.
Plan/billing/access edits remain staff-only. See [portal setup](member-portal-and-waivers.md).

## Digital waivers

Available locally: versioned demo documents, signing history, archive/restore and
active-member compliance. The DocuSeal API adapter supports individual signing links
and verified status checks once connected to a sandbox. Next: approved documents,
completion webhooks and durable PDF/audit retention.
Required new versions require a new signature. Decide minors/guardians and access policy.

## Further reporting

Monthly active-member estimates are reconstructed from corrected billing records,
with current grace rules and no historical staff blocks. Exact historical counts
and retention require captured membership transitions. Workshop and certification
analytics require their respective records.
