# Account security operations

Staff can open a member's **Sign-in & staff permissions → Manage sign-in access**
to prepare a single-use invitation or reset link. Links expire after 24 hours and
are invalidated by a replacement link, password change, login-email change, or
session revocation. Only a digest is stored. The browser URL fragment contains
the token so it is not sent in ordinary page requests or access logs. Share it
privately with the verified account owner; Cubit does not email it automatically.
Resetting a password never disables an enrolled authenticator.

The account name in the top bar opens **Account security**. Individual staff can
enroll a TOTP authenticator after entering their current password. Setup must be
confirmed with a six-digit code. The ten recovery codes are displayed once,
stored as digests, and consumed once. Save them in the account owner's password
manager. Setup secrets are encrypted with AES-256-GCM and bound to the member ID.
TOTP steps cannot be replayed. The shared synthetic administrator cannot enroll
an authenticator or change its sign-in details.

The operator must provision `MFA_ENCRYPTION_KEY` as an independently generated
32-byte key encoded as 64 hexadecimal characters in each private service env
file. Use different keys for review and demo. Never commit or print those keys.
`deploy/provision-mfa.py` creates absent keys on the VPS without displaying them;
it refuses to replace an existing key. Restart the relevant service afterward.
Preserve the key outside the VPS under named custody: losing it prevents existing
authenticator secrets from being decrypted, including after a database restore.

After **every individual staff account** has enrolled and its owner has saved
recovery codes, the operator can set `REQUIRE_STAFF_MFA=true` and restart the
review service. This also rejects existing non-MFA staff sessions. Do not enable
it for the shared synthetic demo. The review's shared administrator credentials
are intentionally retained; mandatory MFA is a launch gate, not silently enabled
on a shared account.

Member changes to login email revoke existing sessions and create an in-app staff
notice. Staff see a count on the notification button and review the changes in
Notification Settings. Acknowledgement is audited. This does not prove ownership
of the new address: verified confirmation links still require an approved email
transport and are a remaining launch requirement.

Imported duplicate login emails must be reconciled by staff before imposing the
unique normalized-email index. Authentication and account-link issuance reject
ambiguous addresses; they do not merge records or rewrite billing history.
The owner requested retaining the generated portal testing login on the review.
