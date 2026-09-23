# Export current Tonic data for local Cubit testing

The exporter is `dev/export-tonic-data.cjs`. It uses the live application's
existing environment and installed mysql2 client. It never imports the Tonic
application, runs schema synchronization, updates balances, or calls integrations.
It exports selected member/contact, plan, membership, payment, key and access-log
columns. Login passwords and unrelated databases/tables are excluded. Original
IDs, stored statuses/balances, payment references and exact decimal values are
preserved. Dates are strings; source timezone metadata is included.

All six tables must exist and use InnoDB. The script exports in a repeatable-read,
read-only consistent snapshot, paging by primary ID. Avoid a deployment/schema
change during the export. See [MySQL transaction documentation](https://dev.mysql.com/doc/refman/8.0/en/commit.html).
Output includes counts and a final `complete: true` marker only after all reads
succeed. A failed/partial export must not be imported.

## 1. Windows PowerShell

```powershell
Set-Location 'C:\path\to\cubit'
scp .\dev\export-tonic-data.cjs root@TONIC_HOST:/root/cubit-export-data.cjs
ssh root@TONIC_HOST
```

## 2. In the server's SSH terminal

```bash
umask 077
docker exec -i -w /Tonic/TonicServices Tonic node - < /root/cubit-export-data.cjs > /root/cubit-current-data.json &&
gzip -c /root/cubit-current-data.json > /root/cubit-current-data.json.gz &&
sha256sum /root/cubit-current-data.json.gz
```

This runs a separate read-only process in the existing container. It does not
restart Tonic. Files are written under `/root` with private permissions. The export
prints table counts, a completion message, and a compressed-file SHA-256 hash.
If it reports an error, stop and provide only the error text, not database contents.

## 3. Return to Windows PowerShell with `exit`, then download

Run from the workspace root:

```powershell
New-Item -ItemType Directory -Force -Path '.private\imports' | Out-Null
scp root@TONIC_HOST:/root/cubit-current-data.json.gz .\.private\imports\tonic-current-data.json.gz
Get-FileHash '.private\imports\tonic-current-data.json.gz' -Algorithm SHA256
```

The Windows hash must match the server's hash. Keep the export in `.private/`,
which is ignored by Git. It contains real contact details, payment references and
key identifiers even though passwords are omitted. Do not attach it to chat or
send it over email; the local workspace file is sufficient.

## Import preparation

The export has been exercised against the local synthetic MySQL database, not
the live server. Once the current file is downloaded, validate its schema/counts,
back up the demo database, and import into a separate staging schema before
switching the app's local data. Disable all synthetic member/waiver seeders and
daily processing during that migration. Do not import directly into a running
Cubit database: its development startup still synchronizes schema and seeds demos.

Reconcile payments, member/plan relationships and Tonic's stored statuses/balances
before adopting Cubit's reconstructed charges. Cancellation dates missing from
Tonic must be reviewed, not invented. Use local-only test access instead of copying
production login passwords. Preserve the unmodified export for comparison.

This is a snapshot of what Tonic currently stores. It is not independent proof
that Tonic contains every recent PayPal payment or cancellation.

## Completed local import

`dev/import-tonic-data.cjs` stages the export in a new `toniclocalreview` schema.
It verifies the local MySQL data directory, refuses a populated target schema,
checks source counts and references, excludes passwords, and preserves every
exported payment/contact/key/date field. Officer roles map to local staff;
other source roles map to member. Two existing accounts get random local-only
test passwords, recorded privately; no synthetic member is added.

The schema stores original IDs and reconstructs Cubit charges independently.
Source statuses, stored balances and the archived Tonic dynamic formula are
compared in private reconciliation files. Differences are not silently offset
with made-up payments or credit adjustments. UTC source dates are preserved.
Unassigned payments and malformed historical plan dates remain review items.

Activate the completed import by setting `database` to `TonicLocalReview` in
`.private/native/settings.json` while the local app is stopped, then use
`dev/start-local.cmd`. Set it back to `TonicLocalDev` to return to the preserved
demo dataset. Neither schema is overwritten by switching.

`dev/verify-import.cjs` checks record counts/totals, key preservation, separate
demo data, staff/member login, search, portal isolation, reports and disabled
integrations against localhost. It does not post payments or change contacts.
The verification may refresh calculated local balances/statuses through reads.
