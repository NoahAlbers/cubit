import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import type { MemberStatus } from "@prisma/client";

/**
 * RFIDLock integration.
 *
 * The MelbourneMakerSpace/RFIDLock Raspberry Pi periodically downloads a
 * whitelist of authorized key serials and caches it locally, so the door
 * keeps working even if the network drops. The legacy Seltzer CRM served
 * this as a JSON array of {firstName, lastName, serial}. Cubit serves the
 * exact same shape for drop-in compatibility.
 */

export type WhitelistEntry = {
  firstName: string;
  lastName: string;
  serial: string;
};

export async function validateRfidToken(request: Request): Promise<boolean> {
  const configured = await getSetting<string>("rfid.api_token", "");
  if (!configured) return false;

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const queryToken = new URL(request.url).searchParams.get("token");
  const provided = bearer ?? queryToken;
  return !!provided && provided === configured;
}

export async function buildWhitelist(): Promise<WhitelistEntry[]> {
  const allowedStatuses = await getSetting<MemberStatus[]>(
    "rfid.allowed_statuses",
    ["ACTIVE"]
  );
  const requireWaivers = await getSetting<boolean>("rfid.require_waivers", false);

  const keys = await prisma.key.findMany({
    where: {
      status: "ACTIVE",
      member: { status: { in: allowedStatuses } },
    },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ member: { lastName: "asc" } }],
  });

  let eligibleMemberIds: Set<string> | null = null;
  if (requireWaivers) {
    const required = await prisma.waiverTemplate.findMany({
      where: { isRequired: true, isActive: true },
      select: { id: true },
    });
    if (required.length > 0) {
      const memberIds = [...new Set(keys.map((k) => k.member.id))];
      const completed = await prisma.memberWaiver.groupBy({
        by: ["memberId"],
        where: {
          memberId: { in: memberIds },
          waiverId: { in: required.map((r) => r.id) },
          status: "COMPLETED",
        },
        _count: { waiverId: true },
      });
      eligibleMemberIds = new Set(
        completed
          .filter((c) => c._count.waiverId >= required.length)
          .map((c) => c.memberId)
      );
    }
  }

  return keys
    .filter((k) => !eligibleMemberIds || eligibleMemberIds.has(k.member.id))
    .map((k) => ({
      firstName: k.member.firstName,
      lastName: k.member.lastName,
      serial: k.serialNumber,
    }));
}

/** Record a scan event from the door controller. */
export async function recordAccessEvent(input: {
  serial: string;
  accessPoint?: string;
  granted?: boolean;
  raw?: unknown;
}) {
  const key = await prisma.key.findUnique({
    where: { serialNumber: input.serial },
    select: { id: true, memberId: true },
  });

  return prisma.accessLog.create({
    data: {
      serial: input.serial,
      keyId: key?.id,
      memberId: key?.memberId,
      accessPoint: input.accessPoint,
      accessType: input.granted === false ? "DENIED" : "ENTRY",
      rawData: input.raw ? (input.raw as object) : undefined,
    },
  });
}
