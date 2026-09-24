# Remembered login greeting

The greeting endpoint is intentionally not a public email lookup. A successful
login sets a 30-day encrypted, HttpOnly, SameSite=Strict cookie scoped to
`/login/greeting` (Secure in hosted modes). It remembers only the most recently
authenticated account in that browser and persists through sign-out. Clearing
site cookies forgets it. It cannot be used as an authentication token.

The browser makes one attempt when a valid email field loses focus. Any subsequent
email edit clears the greeting and cancels an outstanding response; it cannot
trigger another lookup until a new login page is opened. New browsers, mismatched
emails, missing members, invalid cookies and failures keep the generic greeting.
The synthetic demo accessed through the review proxy does not remember a greeting.

Every IP gets one attempt per five minutes, including unsuccessful attempts. This
uses a bounded in-memory limiter for the existing single-process service, just
like the sign-in limiter. Restarting the process resets it; scaling to multiple
processes requires a shared limiter. Only loopback proxies are trusted in hosted
mode; the public reverse proxy must overwrite forwarded client IP headers.

Run from CubitServices:

```
node tests/remembered-greeting.cjs
node tests/login-greeting-integration.cjs
```

Both use synthetic fixtures and never connect to a database.
