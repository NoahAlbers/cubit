# Cubit

Member management for [Melbourne Makerspace](https://melbournemakerspace.org) (Melbourne, FL). Replaces the legacy [Tonic](https://github.com/MelbourneMakerSpace/Tonic) system.

**What it does**

- **Members** — profiles, statuses with a full lifecycle (Prospective → Active → Hold/Past Due/Suspended → Canceled/Alumni), plans, payment history, staff notes, emergency contacts
- **Automation** — payments auto-reactivate overdue members and their keys; past-due members auto-suspend after a configurable grace window; renewal/waiver reminders and a weekly overdue digest go out via a daily cron
- **RFID door access** — drop-in compatible with [RFIDLock](https://github.com/MelbourneMakerSpace/RFIDLock): serves the key whitelist in the legacy Seltzer JSON format and ingests scan events into an access log
- **Digital waivers** — versioned waiver templates that members read and sign in the portal (typed name + drawn signature), with a compliance dashboard for staff
- **Equipment** — inventory with status, member certifications, and maintenance logs
- **Roles & permissions** — dynamic role builder with granular permissions (create "Front Desk", "Treasurer", etc.)
- **Member portal** — mobile-first self-service: status, plan, payments, certifications, waivers, notification preferences
- **Reports** — CSV exports for roster, transactions, overdue, equipment, and waiver compliance

**Stack**: Next.js (App Router) · TypeScript · PostgreSQL · Prisma · NextAuth · Tailwind CSS · Resend · deployed on Vercel

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET at minimum
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

The seed creates the roles/permissions, default plans, system settings, a required liability waiver, and super-admin accounts (default password `changeme123` — change it immediately).

## RFIDLock integration

On the Raspberry Pi, point the whitelist updater at:

```
GET https://<your-app>/api/rfid/whitelist?token=<API_TOKEN>
```

Optionally report scans for the access log:

```
POST https://<your-app>/api/rfid/access-log
Authorization: Bearer <API_TOKEN>
{"serial": "8045AB453449", "accessPoint": "front-door", "granted": true}
```

The API token lives in **Settings → RFID access**, along with which member statuses are allowed entry and whether completed waivers are required for the whitelist.

## PayPal sync

Cubit listens to the makerspace's existing PayPal recurring billing — it never charges anyone. Setup:

1. Create a REST app at developer.paypal.com (Live), enable **Transaction Search**, and set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=live`.
2. Register a webhook for `https://<your-app>/api/paypal/webhook` with events `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.DENIED`, `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, and set `PAYPAL_WEBHOOK_ID` to the webhook's id (signatures are verified on every delivery).
3. Optionally enable the 6-hourly reporting sync in **Settings → System → PayPal** as a webhook safety net.

Payments auto-match by subscription id, then the member's PayPal email, then account email. Matches create a `Transaction`, email a receipt, and reactivate past-due members. Non-matches land on the **PayPal** admin page to link to a member, create a member, or dismiss. Failed payments start the grace-period clock (member emailed, admins alerted); the daily cron moves them to Past Due when it expires.

## Automation cron

`vercel.json` schedules `GET /api/cron/daily` (noon UTC) with `CRON_SECRET` auth. It handles overdue suspensions, renewal reminders, waiver reminders, and the weekly overdue digest.
