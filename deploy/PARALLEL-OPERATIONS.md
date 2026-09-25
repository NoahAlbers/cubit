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

The first version exposes source lists and member billing comparisons through
`/parallel`, rather than replacing the existing review database. Estimates are
labelled because legacy price and end-date history may be incomplete. Source balances
and source status remain visible. No payment, email, waiver or door automation runs
against the mirror. A stale snapshot is visibly marked after 30 minutes.

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
