"use server";

import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// Member-facing notification types (exclude system/admin types)
const MEMBER_NOTIFICATION_TYPES = [
  "PAYMENT_RECEIPT",
  "PAYMENT_FAILED",
  "RENEWAL_REMINDER",
  "PLAN_EXPIRING",
  "KEY_DEACTIVATED",
  "ANNOUNCEMENT",
] as const;

export type PreferenceItem = {
  notificationType: string;
  enabled: boolean;
};

export async function getPreferences(): Promise<PreferenceItem[]> {
  const user = await requireAuth();

  const existing = await prisma.notificationPreference.findMany({
    where: { memberId: user.id },
  });

  const existingMap = new Map(
    existing.map((p: any) => [p.notificationType, p.enabled])
  );

  return MEMBER_NOTIFICATION_TYPES.map((type) => ({
    notificationType: type,
    enabled: (existingMap.get(type) as boolean) ?? true,
  }));
}

export async function updatePreference(
  notificationType: string,
  enabled: boolean
) {
  const user = await requireAuth();

  if (!MEMBER_NOTIFICATION_TYPES.includes(notificationType as any)) {
    return { error: "Invalid notification type." };
  }

  await prisma.notificationPreference.upsert({
    where: {
      memberId_notificationType: {
        memberId: user.id,
        notificationType: notificationType as any,
      },
    },
    update: { enabled },
    create: {
      memberId: user.id,
      notificationType: notificationType as any,
      enabled,
    },
  });

  return { success: true };
}
