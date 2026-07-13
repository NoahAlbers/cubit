import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAccessEvent, validateRfidToken } from "@/lib/rfid";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  serial: z.string().trim().min(1).max(64),
  accessPoint: z.string().trim().max(100).optional(),
  granted: z.boolean().optional(),
});

/**
 * Scan-event ingestion from the door controller. Optional — the lock works
 * fine without it, but posting scans gives the makerspace an access log.
 */
export async function POST(request: Request) {
  if (!(await validateRfidToken(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const log = await recordAccessEvent({
    serial: parsed.data.serial,
    accessPoint: parsed.data.accessPoint,
    granted: parsed.data.granted,
    raw: body,
  });

  return NextResponse.json({ ok: true, id: log.id });
}
