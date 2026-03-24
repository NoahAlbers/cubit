"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { validateSettingValue } from "@/lib/validations/settings";
import { revalidatePath } from "next/cache";

export async function getSettings() {
  await requirePermission("settings.view");

  const settings = await prisma.systemSetting.findMany({
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });

  return settings.map((s) => ({
    id: s.id,
    key: s.key,
    value: s.value,
    category: s.category,
    label: s.label,
    description: s.description,
    fieldType: s.fieldType,
    options: s.options,
    updatedAt: s.updatedAt.toISOString(),
    updatedBy: s.updatedBy,
  }));
}

export type SettingItem = Awaited<ReturnType<typeof getSettings>>[number];

export async function updateSetting(settingId: string, value: unknown) {
  const user = await requirePermission("settings.manage");

  const setting = await prisma.systemSetting.findUnique({
    where: { id: settingId },
  });

  if (!setting) {
    return { error: "Setting not found" };
  }

  // Validate value based on fieldType
  const validation = validateSettingValue(
    setting.fieldType,
    value,
    setting.options
  );

  if (!validation.success) {
    return { error: validation.error };
  }

  await prisma.systemSetting.update({
    where: { id: settingId },
    data: {
      value: validation.data as any,
      updatedBy: user.id,
    },
  });

  revalidatePath("/admin/settings/system");
  return { success: true };
}
