import { NextResponse } from "next/server";
import { verifyWebhookSignature, processWebhookEvent } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PayPal webhook receiver.
 *
 * Register this URL in the PayPal developer dashboard for the events:
 *   PAYMENT.SALE.COMPLETED, PAYMENT.SALE.DENIED,
 *   BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED,
 *   BILLING.SUBSCRIPTION.SUSPENDED
 * then set PAYPAL_WEBHOOK_ID to the webhook's id. Every event is verified
 * against PayPal's signature API before it's processed.
 */
export async function POST(request: Request) {
  let event: unknown;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verified = await verifyWebhookSignature(request.headers, event);
  if (!verified) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  try {
    const result = await processWebhookEvent(
      event as Parameters<typeof processWebhookEvent>[0]
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // 500 → PayPal retries the delivery later
    console.error("PayPal webhook processing failed:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
