import { NextResponse } from "next/server";
import { buildWhitelist, validateRfidToken } from "@/lib/rfid";

export const dynamic = "force-dynamic";

/**
 * Door whitelist for MelbourneMakerSpace/RFIDLock.
 *
 * Returns the exact JSON shape the Raspberry Pi's whitelist updater expects
 * (drop-in replacement for the legacy Seltzer query.php):
 *   [{"firstName":"Josh","lastName":"Pritt","serial":"8045AB453449"}, …]
 *
 * Auth: `Authorization: Bearer <token>` header or `?token=` query param,
 * using the token from Settings → RFID Access.
 */
export async function GET(request: Request) {
  if (!(await validateRfidToken(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const whitelist = await buildWhitelist();
  return NextResponse.json(whitelist);
}
