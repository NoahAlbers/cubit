import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { paypalConfigured, runPayPalSync } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled PayPal reporting sync — the safety net under the webhooks.
 * Runs every 6 hours via vercel.json; no-ops unless paypal.sync_enabled
 * is on and credentials are present.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await getSetting<boolean>("paypal.sync_enabled", false);
  if (!enabled) return NextResponse.json({ ok: true, skipped: "disabled" });
  if (!paypalConfigured())
    return NextResponse.json({ ok: true, skipped: "not-configured" });

  try {
    const results = await runPayPalSync();
    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    console.error("PayPal sync failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
