import { NextResponse } from "next/server";
import { runDailyAutomation } from "@/lib/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily automation: overdue suspensions, renewal reminders, waiver
 * reminders, and the weekly overdue digest. Wire this to Vercel Cron
 * (vercel.json) or any scheduler that can send the CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDailyAutomation();
  return NextResponse.json({ ok: true, ...results });
}
