# Hosted review

The hosted review is a separate copy for staff testing. Existing Tonic remains
the operational system. Changes made here do not synchronize back to Tonic.

The server runs the compiled Node API behind Caddy HTTPS, with MySQL on loopback.
No Docker is required. Source comes from `NoahAlbers/cubit`; database contents
and secrets are managed separately and must never be committed to GitHub.

Set `CUBIT_MODE=hosted-review`, `HOST=127.0.0.1`, `DATABASE_URI=127.0.0.1`,
`DATABASE_NAME=cubit_review`, `DATABASE_USERNAME=cubit_app`, a random database
password and a JWT secret of at least 48 characters in the server environment.
Do not set `LOCAL_DEVELOPMENT=true`. The database must be an independently
validated imported snapshot with its completed import marker. Startup does not
synchronize schema, seed demo members, or run daily automation in this mode.

Before exposing a copied database, disable all copied login passwords and issue
a separate review administrator password. Keep both the database and port 5001
private. PayPal, physical door integration, and live DocuSeal are disabled.
Cubit sends no email. Staff can test billing edits and manual processing against
the copied data.

The systemd service also denies all non-loopback network traffic. Only Caddy
accepts public requests; the Cubit process can reach its local database but cannot
contact the makerspace or external providers. Do not remove this restriction for
review testing. The service has no SSH keys or GitHub credentials.

## Build

Use Node 22 and pnpm 9.15.9. Install each project's frozen lockfile, run the
Angular production build, and copy `CubitWeb/dist/` into `TonicServices/tonic/`.
Build the API with `pnpm --dir TonicServices build`. Run `node dist/app.js` with
`TonicServices` as the working directory and the hosted environment supplied by
the service manager.

GitHub checks build the code and run database-free tests. A code update must not
reimport the database or reset credentials. Keep a database backup and the previous
release before activating an update, and check `/health` after restarting.

## Update the review VPS from GitHub

After committing and pushing changes to `main`, SSH into the VPS and run:

```sh
sudo cubit-update
```

This fetches `main`, builds a new release, runs database-free checks, saves a
private database backup, restarts the service and checks health. Failed health
checks restore the previous code release. It does not import or reset member data,
run migrations, or change credentials. Updates are explicitly triggered; pushing
to GitHub alone does not change the hosted review. Database rollback is a separate
manual operation because staff may have edited data since the last release.
