# Read-only snapshot operations

The staff **Parallel workspace** is separate from the editable review and synthetic
demo. Tonic remains the authority for membership, payment import and door access.
This connection must never call Tonic's application endpoints: some GET requests
have payment, email or access side effects.

## Isolation and schedule

- A source-local `cubit_export` database user has column-level SELECT grants on the
  six exported tables. Passwords are excluded. Grants are restricted to Tonic's
  current container addresses; a container address change requires operator review.
- `/opt/cubit-export` contains the exporter, root-only configuration and delivery
  key, outside Tonic's watched source volume. Each export uses one consistent,
  read-only transaction, bounded queries and execution time. It does not load the app.
- `cubit-parallel-export.timer` sends a snapshot every 15 minutes, with up to 20
  seconds of jitter. The SSH key permits only bounded intake, from the source host;
  it provides neither a shell nor forwarding. The destination host key is pinned.
- The destination's `cubit-parallel-publish.timer` checks intake every minute.
  The publisher validates checksums, complete counts, types and references before
  atomically replacing the current generation in **cubit_parallel**. Failed or old
  snapshots leave the last good generation intact. Exact retries are harmless.
- The web app uses a separate SELECT-only reader. Only the operator worker has DML
  rights. Schema creation is a one-time operator step; remove its CREATE/REFERENCES
  grants afterward. Retain three generations and 90 days of change/run history.
- Set `PARALLEL_ENABLED=true` and `PARALLEL_READER_PASSWORD` in a root-owned
  EnvironmentFile for the review service only. The synthetic demo rejects this API.
  No imported identity becomes a Cubit login or grants staff access.

## Normal staff screens

On the review service only, enable `PARALLEL_ENABLED`, `PARALLEL_INTEGRATED` and
`PARALLEL_REQUIRED` in the root-owned reader EnvironmentFile. Restart only Cubit.
Members, Overdue, profiles, Access Log, Reports, four CSV exports and the catalog
use a SELECT-only adapter before normal business handlers. Business mutations,
processing and unsupported reads are denied. The synthetic demo remains separate.

The UI pins a generation and comparison grace window until a full reload or
**Load latest snapshot**. Retained generations allow roughly 30–45 minutes of
navigation. Requests for pruned generations return 409; refresh instead of silently
mixing batches. Snapshots older than 30 minutes are marked stale.

Source status and stored balance remain unchanged. Payments, plans, keys and scans
come from the six allowlisted source datasets. Past-due amounts and historical
membership charts are estimates using source prices/dates and the comparison grace
window. Historical corrections and access holds may be missing. No charges are
posted. Source amounts remain USD; no currency conversion is implied. Member scans
cannot be attributed to individual keys without source attribution. Copied key and
membership flags do not verify physical controller behavior.

Waivers/documents, staff notes, staff audit history, unresolved PayPal events and
portal identities are not in the feed. Their pages state this instead of using old
review records. Account security, staff administration, system health and backups
continue to manage Cubit itself. Subscription annotations remain local and audited.

## Retiring the old review business data

`dev/retire-review-data.cjs` is operator-only and is never called at startup. First
create and verify a fresh encrypted backup and retain a protected recovery archive
on the backup host. Stop Cubit review during the final preview/apply transaction.
The script refuses unexpected schemas or an absent enabled administrator, verifies
its preview, rolls back on failure, and checks zero remaining business rows plus
unchanged staff credential fingerprints before committing. It preserves staff
accounts/security, organization/backup settings, audit history, waiver templates,
and source subscription annotations. Member-linked documents remain recoverable
from the archive. The source mirror, demo and live Tonic are not deleted.

Keep all three flags enabled after retirement. Disabling them does not restore the
old copy: use the operator recovery archive if rollback is needed. The app must not
silently create a new editable member database or provision source identities.

## Subscription matching

Store confirmed merchant account + subscription ID + source membership ID in the
separate review control database, with reason, staff identity and optimistic revision.
The source membership is never edited. One subscription cannot be assigned to two
memberships. Cancellation processing remains disabled.

Email is a candidate lookup, not a subscription identity. A payer can fund multiple
members or replace a subscription. Obtain actual IDs from an authorized provider
export or separate reporting app; do not infer an ID, auto-confirm by email, or change
the operational PayPal importer. Modern `I-` subscription IDs are supported by this
linking form; legacy agreements require an explicit identifier mapping before use.

## Observe, stop and recover

Inspect service journals and `/var/lib/cubit-export/status.json` on the source.
Inspect `parallel_run`, generation counts/times and the workspace's snapshot history
on Cubit. Compare aggregate counts/payment totals against the same source snapshot,
not a later live query. The feed does not make Tonic's nightly PayPal import fresher.

Stop delivery with `systemctl disable --now cubit-parallel-export.timer`; stop
publication with `systemctl disable --now cubit-parallel-publish.timer`. An in-flight
oneshot may finish. Neither action stops Tonic or changes its database rows. To
disconnect completely, revoke only the dedicated export user's grants and delivery
key after identifying their exact host/account entries.

Include `cubit_parallel` in the CRM and backup-server operator schema lists. Deploy
the matching backup worker to both hosts. Restore verification checks six dataset
counts, payment totals and table integrity in an isolated MySQL container. Old backups
without the mirror require their matching schema list when tested; never restore
over a working database. Keep the mirror configuration and reader/writer credentials
in the root-only recovery archive. The backup server retains its own deletion policy;
the CRM receives no deletion rights.

Before cutover, observe several days including a nightly payment import, edits,
new scans and failure recovery. Resolve discrepancies and identify controller/cache
behavior with the makerspace. A running mirror is not approval to switch doors or
payment handling.
