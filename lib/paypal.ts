import { format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { handlePaymentReceived } from "@/lib/automation";
import { sendMemberEmail, sendAdminEmail, appUrl } from "@/lib/email";
import { formatMoney } from "@/lib/utils";
import {
  PaymentReceiptEmail,
  PaymentFailedEmail,
  AdminPaymentAlertEmail,
} from "@/emails/templates";

/**
 * PayPal integration.
 *
 * Melbourne Makerspace bills through PayPal recurring subscriptions — the
 * button on the website. Cubit does NOT charge anyone; it listens.
 * Two feeds, both idempotent by PayPal transaction id:
 *
 *  1. Webhooks (/api/paypal/webhook) — real-time payment + subscription events
 *  2. Reporting sync (/api/cron/paypal-sync) — belt-and-suspenders pull of the
 *     Transaction Search API, catching anything a webhook missed
 *
 * Matching: subscription id → member.paypalSubscriptionId, then payer email →
 * member.paypalEmail, then member.email. No match → admin review queue.
 */

const MODE = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
const API_BASE =
  MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export function paypalConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalStatus() {
  return {
    configured: paypalConfigured(),
    webhookConfigured: !!process.env.PAYPAL_WEBHOOK_ID,
    mode: MODE,
  };
}

// ---------------------------------------------------------------------------
// Auth + raw API helpers
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PayPal auth failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function api(path: string, init?: RequestInit) {
  const token = await accessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PayPal ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Verify a webhook came from PayPal (signature check via the REST API). */
export async function verifyWebhookSignature(
  headers: Headers,
  rawEvent: unknown
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !paypalConfigured()) return false;

  const body = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: rawEvent,
  };
  if (Object.values(body).some((v) => v == null)) return false;

  const result = (await api("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { verification_status?: string };
  return result.verification_status === "SUCCESS";
}

type SubscriptionDetails = {
  id: string;
  subscriber?: {
    email_address?: string;
    name?: { given_name?: string; surname?: string };
  };
};

async function getSubscription(id: string): Promise<SubscriptionDetails | null> {
  try {
    return (await api(`/v1/billing/subscriptions/${id}`)) as SubscriptionDetails;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Matching + ingestion
// ---------------------------------------------------------------------------

export type IncomingPayment = {
  paypalTransactionId: string;
  payerEmail?: string | null;
  payerName?: string | null;
  amount: number;
  currency?: string;
  transactionDate: Date;
  subscriptionId?: string | null;
  source: "webhook" | "sync";
  raw?: unknown;
};

async function findMemberFor(payment: IncomingPayment) {
  if (payment.subscriptionId) {
    const bySub = await prisma.member.findFirst({
      where: { paypalSubscriptionId: payment.subscriptionId },
    });
    if (bySub) return bySub;
  }
  const autoMatch = await getSetting<boolean>("paypal.auto_match_by_email", true);
  if (autoMatch && payment.payerEmail) {
    const email = payment.payerEmail.toLowerCase();
    const byPaypalEmail = await prisma.member.findFirst({
      where: { paypalEmail: { equals: email, mode: "insensitive" } },
    });
    if (byPaypalEmail) return byPaypalEmail;
    const byEmail = await prisma.member.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (byEmail) return byEmail;
  }
  return null;
}

/**
 * Record a PayPal payment. Idempotent on paypalTransactionId. Returns what
 * happened so callers/tests can assert on it.
 */
export async function ingestPayment(
  payment: IncomingPayment
): Promise<"duplicate" | "matched" | "unmatched"> {
  const existing = await prisma.payPalTransaction.findUnique({
    where: { paypalTransactionId: payment.paypalTransactionId },
  });
  if (existing) return "duplicate";

  const member = await findMemberFor(payment);

  const record = await prisma.payPalTransaction.create({
    data: {
      paypalTransactionId: payment.paypalTransactionId,
      payerEmail: payment.payerEmail?.toLowerCase() ?? null,
      payerName: payment.payerName ?? null,
      amount: payment.amount,
      currency: payment.currency ?? "USD",
      transactionDate: payment.transactionDate,
      subscriptionId: payment.subscriptionId ?? null,
      status: member ? "MATCHED" : "UNMATCHED",
      matchedMemberId: member?.id ?? null,
      source: payment.source,
      rawData: payment.raw ? (payment.raw as object) : undefined,
    },
  });

  if (!member) return "unmatched";

  await applyPaymentToMember(record.id, member.id, { sendReceipt: true });
  return "matched";
}

/**
 * Create the member-side Transaction for a PayPalTransaction and run the
 * payment side effects (reactivation, receipt). Used by auto-match and by
 * the admin "link" action.
 */
export async function applyPaymentToMember(
  payPalTransactionId: string,
  memberId: string,
  opts: { sendReceipt?: boolean; rememberPayerEmail?: boolean } = {}
) {
  const record = await prisma.payPalTransaction.findUniqueOrThrow({
    where: { id: payPalTransactionId },
  });
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });

  await prisma.transaction.create({
    data: {
      memberId,
      amount: record.amount,
      transactionDate: record.transactionDate,
      description: "PayPal subscription payment",
      method: "PAYPAL",
      source: "PAYPAL_SYNC",
      paypalTransactionId: record.paypalTransactionId,
      confirmation: record.paypalTransactionId,
    },
  });

  const memberUpdates: Record<string, unknown> = { lastPaymentFailedAt: null };
  if (record.subscriptionId && !member.paypalSubscriptionId) {
    memberUpdates.paypalSubscriptionId = record.subscriptionId;
  }
  if (opts.rememberPayerEmail && record.payerEmail && !member.paypalEmail) {
    memberUpdates.paypalEmail = record.payerEmail;
  }
  await prisma.member.update({ where: { id: memberId }, data: memberUpdates });

  await prisma.payPalTransaction.update({
    where: { id: record.id },
    data: { status: "MATCHED", matchedMemberId: memberId },
  });

  if (Number(record.amount) > 0) {
    await handlePaymentReceived(memberId);
  }

  if (opts.sendReceipt) {
    await sendMemberEmail({
      memberId,
      to: member.email,
      type: "PAYMENT_RECEIPT",
      subject: "Payment received — thank you!",
      body: PaymentReceiptEmail({
        firstName: member.firstName,
        amount: formatMoney(record.amount.toString()),
        date: format(record.transactionDate, "MMMM d, yyyy"),
        confirmation: record.paypalTransactionId,
      }),
    });
  }
}

/** A payment failed / was denied: start the grace-period clock and notify. */
export async function handlePaymentFailure(opts: {
  subscriptionId?: string | null;
  payerEmail?: string | null;
  raw?: unknown;
}) {
  const member = await findMemberFor({
    paypalTransactionId: "",
    amount: 0,
    transactionDate: new Date(),
    source: "webhook",
    subscriptionId: opts.subscriptionId,
    payerEmail: opts.payerEmail,
  });

  const graceDays = await getSetting<number>("membership.grace_period_days", 7);

  if (!member) {
    await sendAdminEmail(
      "PayPal payment failed — unknown payer",
      AdminPaymentAlertEmail({
        title: "Payment failed for an unknown payer",
        detail: `Payer: ${opts.payerEmail ?? "unknown"} · Subscription: ${
          opts.subscriptionId ?? "unknown"
        }. No matching member found — check the PayPal page.`,
      })
    );
    return null;
  }

  await prisma.member.update({
    where: { id: member.id },
    data: { lastPaymentFailedAt: new Date() },
  });
  await prisma.memberNote.create({
    data: {
      memberId: member.id,
      isSystem: true,
      content: `PayPal payment failed. Grace period of ${graceDays} days started.`,
    },
  });
  await sendMemberEmail({
    memberId: member.id,
    to: member.email,
    type: "PAYMENT_FAILED",
    subject: "Your Melbourne Makerspace payment didn't go through",
    body: PaymentFailedEmail({ firstName: member.firstName, graceDays }),
  });
  await sendAdminEmail(
    `PayPal payment failed: ${member.firstName} ${member.lastName}`,
    AdminPaymentAlertEmail({
      title: `Payment failed for ${member.firstName} ${member.lastName}`,
      detail: `Grace period of ${graceDays} days started. Member profile: ${appUrl(
        `/admin/members/${member.id}`
      )}`,
    })
  );
  return member;
}

// ---------------------------------------------------------------------------
// Webhook event processing
// ---------------------------------------------------------------------------

type WebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    state?: string;
    amount?: { total?: string; currency?: string };
    billing_agreement_id?: string;
    create_time?: string;
    update_time?: string;
    subscriber?: {
      email_address?: string;
      name?: { given_name?: string; surname?: string };
    };
    payer?: { payer_info?: { email?: string; first_name?: string; last_name?: string } };
  };
};

export async function processWebhookEvent(
  event: WebhookEvent
): Promise<{ handled: string }> {
  const type = event.event_type ?? "";
  const resource = event.resource ?? {};

  switch (type) {
    case "PAYMENT.SALE.COMPLETED": {
      const subscriptionId = resource.billing_agreement_id ?? null;
      let payerEmail = resource.payer?.payer_info?.email ?? null;
      let payerName: string | null = null;
      const info = resource.payer?.payer_info;
      if (info?.first_name || info?.last_name) {
        payerName = [info.first_name, info.last_name].filter(Boolean).join(" ");
      }

      // Sale events usually omit payer email — pull it from the subscription
      if (!payerEmail && subscriptionId && paypalConfigured()) {
        const sub = await getSubscription(subscriptionId);
        payerEmail = sub?.subscriber?.email_address ?? null;
        if (!payerName && sub?.subscriber?.name) {
          payerName = [sub.subscriber.name.given_name, sub.subscriber.name.surname]
            .filter(Boolean)
            .join(" ");
        }
      }

      const result = await ingestPayment({
        paypalTransactionId: resource.id ?? `evt-${event.id}`,
        payerEmail,
        payerName,
        amount: parseFloat(resource.amount?.total ?? "0"),
        currency: resource.amount?.currency ?? "USD",
        transactionDate: resource.create_time
          ? new Date(resource.create_time)
          : new Date(),
        subscriptionId,
        source: "webhook",
        raw: event,
      });
      return { handled: `sale:${result}` };
    }

    case "PAYMENT.SALE.DENIED": {
      await handlePaymentFailure({
        subscriptionId: resource.billing_agreement_id,
        payerEmail: resource.payer?.payer_info?.email,
        raw: event,
      });
      return { handled: "payment-failed" };
    }

    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      // Learn the subscription id ↔ member mapping as soon as someone subscribes
      const email = resource.subscriber?.email_address;
      const subId = resource.id;
      if (email && subId) {
        const member = await prisma.member.findFirst({
          where: {
            OR: [
              { paypalEmail: { equals: email, mode: "insensitive" } },
              { email: { equals: email, mode: "insensitive" } },
            ],
          },
        });
        if (member && !member.paypalSubscriptionId) {
          await prisma.member.update({
            where: { id: member.id },
            data: { paypalSubscriptionId: subId },
          });
          return { handled: "subscription-linked" };
        }
      }
      return { handled: "subscription-activated" };
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      const subId = resource.id;
      const member = subId
        ? await prisma.member.findFirst({
            where: { paypalSubscriptionId: subId },
          })
        : null;
      if (member) {
        await prisma.memberNote.create({
          data: {
            memberId: member.id,
            isSystem: true,
            content: `PayPal subscription ${
              type === "BILLING.SUBSCRIPTION.CANCELLED" ? "canceled" : "suspended"
            } (${subId}).`,
          },
        });
        await sendAdminEmail(
          `PayPal subscription ${
            type === "BILLING.SUBSCRIPTION.CANCELLED" ? "canceled" : "suspended"
          }: ${member.firstName} ${member.lastName}`,
          AdminPaymentAlertEmail({
            title: `${member.firstName} ${member.lastName}'s subscription ${
              type === "BILLING.SUBSCRIPTION.CANCELLED" ? "was canceled" : "was suspended"
            }`,
            detail: `Review their membership: ${appUrl(`/admin/members/${member.id}`)}`,
          })
        );
      }
      return { handled: "subscription-status" };
    }

    default:
      return { handled: "ignored" };
  }
}

// ---------------------------------------------------------------------------
// Reporting-API sync (cron fallback)
// ---------------------------------------------------------------------------

type ReportingTransaction = {
  transaction_info?: {
    transaction_id?: string;
    transaction_amount?: { value?: string; currency_code?: string };
    transaction_initiation_date?: string;
    transaction_status?: string;
    paypal_reference_id?: string;
    paypal_reference_id_type?: string;
  };
  payer_info?: {
    email_address?: string;
    payer_name?: { alternate_full_name?: string; given_name?: string; surname?: string };
  };
};

/**
 * Pull recent transactions from the Transaction Search API and ingest any
 * we haven't seen. Requires "Transaction Search" enabled on the PayPal app.
 */
export async function runPayPalSync(): Promise<{
  scanned: number;
  matched: number;
  unmatched: number;
  duplicates: number;
}> {
  if (!paypalConfigured()) {
    throw new Error(
      "PayPal credentials are not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)."
    );
  }

  const lastSync = await getSetting<string | null>("paypal.last_sync", null);
  // Overlap the previous window by a day; PayPal allows max 31 days per query
  let start = lastSync
    ? subDays(new Date(lastSync), 1)
    : subDays(new Date(), 30);
  const oldest = subDays(new Date(), 30);
  if (start < oldest) start = oldest;
  const end = new Date();

  const fmt = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss'-0000'");
  const counts = { scanned: 0, matched: 0, unmatched: 0, duplicates: 0 };
  let page = 1;

  for (;;) {
    const data = (await api(
      `/v1/reporting/transactions?start_date=${encodeURIComponent(
        fmt(start)
      )}&end_date=${encodeURIComponent(fmt(end))}&fields=transaction_info,payer_info&page_size=100&page=${page}`
    )) as { transaction_details?: ReportingTransaction[]; total_pages?: number };

    const rows = data.transaction_details ?? [];
    for (const row of rows) {
      const info = row.transaction_info;
      if (!info?.transaction_id) continue;
      // Only settled/successful credits
      if (info.transaction_status && info.transaction_status !== "S") continue;
      const amount = parseFloat(info.transaction_amount?.value ?? "0");
      if (amount <= 0) continue;

      counts.scanned++;
      const payerName =
        row.payer_info?.payer_name?.alternate_full_name ??
        [row.payer_info?.payer_name?.given_name, row.payer_info?.payer_name?.surname]
          .filter(Boolean)
          .join(" ") ??
        null;

      const result = await ingestPayment({
        paypalTransactionId: info.transaction_id,
        payerEmail: row.payer_info?.email_address ?? null,
        payerName: payerName || null,
        amount,
        currency: info.transaction_amount?.currency_code ?? "USD",
        transactionDate: info.transaction_initiation_date
          ? new Date(info.transaction_initiation_date)
          : new Date(),
        subscriptionId:
          info.paypal_reference_id_type === "SUB" ? info.paypal_reference_id : null,
        source: "sync",
        raw: row,
      });
      counts[result === "duplicate" ? "duplicates" : result]++;
    }

    if (!data.total_pages || page >= data.total_pages) break;
    page++;
  }

  await setSetting("paypal.last_sync", end.toISOString());
  return counts;
}
