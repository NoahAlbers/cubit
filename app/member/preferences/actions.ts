"use server";

import { requireAuth, isOwnResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/lib/generated/prisma/client";

// Member-facing notification types (exclude system/admin types)
const MEMBER_NOTIFICATION_TYPES: NotificationType[] = [
  "PAYMENT_RECEIPT",
  "PAYMENT_FAILED",
  "RENEWAL_REMINDER",
  "PLAN_EXPIRING",
  "KEY_DEACTIVATED",
  "ANNOUNCEMENT",
];

export type PreferenceItem = {
  notificationType: NotificationType;
  enabled: boolean;
};

export async function getPreferences(): Promise<PreferenceItem[]> {
  const user = await requireAuth();

  const existing = await prisma.notificationPreference.findMany({
    where: { memberId: user.id },
  });

  const existingMap = new Map(
    existing.map((p) => [p.notificationType, p.enabled])
  );

  return MEMBER_NOTIFICATION_TYPES.map((type) => ({
    notificationType: type,
    enabled: existingMap.get(type) ?? true, // default to enabled
  }));
}

export async function updatePreference(
  notificationType: string,
  enabled: boolean
) {
  const user = await requireAuth();

  if (!MEMBER_NOTIFICATION_TYPES.includes(notificationType as NotificationType)) {
    return { error: "Invalid notification type." };
  }

  await prisma.notificationPreference.upsert({
    where: {
      memberId_notificationType: {
        memberId: user.id,
        notificationType: notificationType as NotificationType,
      },
    },
    update: { enabled },
    create: {
      memberId: user.id,
      notificationType: notificationType as NotificationType,
      enabled,
    },
  });

  return { success: true };
}
