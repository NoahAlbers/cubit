# Member portal and DocuSeal foundation

The local member portal is at http://localhost:5001/portal. The sign-in page includes **Demo member** (Alex Example) and **Demo staff** buttons. Both use synthetic local accounts. Members with an existing password can also sign in normally. Public registration and account recovery are not implemented yet; account help is handled by staff.

## Member experience

- Overview: membership status, current plan/rate, balance, past due amount, required waivers to sign.
- Billing: the same effective charges, payments and refunds used by staff, with newest/oldest sorting. This page is a record of entries, without balance, past-due or total-paid summary cards. Members cannot edit billing.
- Waivers: current required/optional waivers, signing requests, and signed version history.
- Details: own name, email/login address, phone, emergency contact. PayPal identity, membership plans, access settings, roles and staff notes stay staff-only.

All portal APIs resolve the member from the verified token's ID. They do not accept a target member ID. Response fields are explicitly selected to exclude staff notes, internal access-hold reasons, password hashes and staff audit details. Every staff API still verifies the account's current role in the database. Legacy local `/task` and `/ACON` APIs now also require staff authentication; real door devices need a separate device-authentication design before deployment.

Cubit does not send emails. Staff handle email personally using their own mail client. Contact addresses remain available for this purpose.

## Staff waiver management

Open **Waivers** in the staff navigation. Staff can publish multiple waivers, publish a new immutable version, archive/restore a waiver, inspect version/signing history, and filter compliance by active/all members, missing/up-to-date signatures and name/email. Individual staff member profiles also show waiver status and signed history.

Required waivers automatically appear for every member, including newly added members. Compliance checks the **current version** of every non-archived required waiver. Publishing a new version requires signing again; earlier signed versions remain available in history. Archiving removes a requirement without deleting records. Demo signatures are labeled and only satisfy demo versions. A real DocuSeal version cannot be completed through the demo endpoint.

The initial seeded waiver contains placeholder demonstration text, not a legal waiver. Some synthetic members have seeded demo signatures; others are missing signatures. Waiver status does not yet block door access or change billing eligibility.

## DocuSeal research and integration

Official references checked September 22, 2026:

- [API reference](https://www.docuseal.com/docs/api): templates, signature requests, signer external IDs, submission status, signed document URLs and webhooks.
- [Signing integration](https://www.docuseal.com/docs/embedded/form): signer-specific `/s/{slug}` links and Angular embedding options.
- [Pricing](https://www.docuseal.com/pricing): free development sandbox; published production pricing currently states Pro at $20/user/month plus $0.20 per completed API/embedded submission. Production API/embedding is also licensed for on-premises use. Verify pricing before choosing a deployment.

This first version uses **individual DocuSeal signing links** rather than loading third-party signing scripts into the local portal. Document design (PDF upload and signature fields) happens in DocuSeal; Cubit manages the membership requirement and version reference. An embedded builder and embedded signer can be added later without changing the member/version associations.

### Connect a sandbox

1. Create a DocuSeal sandbox account/key yourself. Do not paste a key into chat or waiver text.
2. In the ignored `TonicServices/.env.local`, add `DOCUSEAL_ENABLED=true` and `DOCUSEAL_API_KEY=<your sandbox key>`. Restart the local backend. Neither setting is included in frontend assets.
3. Create a template in DocuSeal with exactly one signer role (for example, `Member`). Include the approved document and required signature/name/date fields. This application currently uses the US cloud endpoint `https://api.docuseal.com`; EU/self-hosted endpoints are not configured.
4. In Cubit, publish a new waiver/version with **DocuSeal**, the template ID and matching signer role. Clone the DocuSeal template for each version, and do not edit a template after publication. Cubit prevents reusing a template ID for another version.
5. Sign in as a synthetic member, choose **Review & sign**, open the individual DocuSeal link, then return and **Check signing status**. Staff can also check pending signatures from signing history.

The API creates a single-signer submission with `send_email:false`, `send_sms:false` and a stable `external_id` corresponding to the local signing record. Before connecting, disable DocuSeal's automatic completion copies, reminders and BCC delivery in its account/template settings as well. Cubit does not manage those external settings. The local demo sends nothing to DocuSeal until the connection is explicitly enabled and a DocuSeal waiver is used.

Creation is reserved in the local database before the external call. Duplicate clicks reuse the same record. An uncertain network result stays available for staff review; a status check looks up its external ID instead of blindly creating another submission. An unresolved or expired request needs staff review in DocuSeal in this foundation.

Completion is fetched from DocuSeal server-to-server, checking submission ID, template ID, signer correlation, signer email and completed status. A client callback or posted `status` is never sufficient. Signed document links are only accepted from the configured DocuSeal cloud origin. Completed records cannot regress when older checks return. Real DocuSeal calls have not been exercised without a sandbox account; tests mock the API and verify payloads, recovery and completion validation.

### Before live use

- Replace demo text with the makerspace's approved waiver and explicitly publish a DocuSeal version. Do not migrate demo signatures into real signed evidence.
- Connect authenticated completion webhooks and periodic reconciliation; currently completion is refreshed on demand.
- Decide document retention/download policy and preserve signed PDFs/audit certificates beyond provider URL lifetimes. Current records retain provider IDs and signed document links.
- Add staff-managed account provisioning/recovery, sign-in throttling and production session/security configuration. This remains a loopback-only local development app.
- Decide whether unsigned waivers should prevent activation or door access; the foundation only prompts and reports.

## Verification

`TonicServices/tests/portal-waivers.cjs` covers member isolation, staff access, field allowlists, duplicate emails, session identity after email changes, removal of notification endpoints, concurrent signing requests, signing ownership, version changes, compliance, archive/restore, and DocuSeal request/recovery/completion validation with an offline adapter. Temporary test members and waivers are removed afterward.

Run with the local Node 17 runtime from `TonicServices`:

```powershell
& ../.private/tools/node17/node.exe tests/portal-waivers.cjs
```
