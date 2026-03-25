"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  AVAILABLE_WIDGETS,
  FALLBACK_DEFAULT_IDS,
  buildDefaultWidgets,
  type WidgetConfig,
} from "@/lib/dashboard-widgets";

export async function getDashboardConfig(): Promise<WidgetConfig[]> {
  const user = await requirePermission("dashboard.configure");

  // Check if user has a saved config
  const config = await prisma.dashboardConfig.findUnique({
    where: { memberId: user.id },
  });

  if (config) {
    return config.widgets as unknown as WidgetConfig[];
  }

  // Fall back to system setting defaults
  const systemSetting = await prisma.systemSetting.findUnique({
    where: { key: "dashboard.default_widgets" },
  });

  const defaultIds: string[] =
    systemSetting && Array.isArray(systemSetting.value)
      ? (systemSetting.value as string[])
      : FALLBACK_DEFAULT_IDS;

  return buildDefaultWidgets(defaultIds);
}

export async function updateDashboardConfig(
  widgets: WidgetConfig[]
): Promise<{ success: boolean; error?: string }> {
  const user = await requirePermission("dashboard.configure");

  // Validate widget IDs
  const validIds = new Set<string>(AVAILABLE_WIDGETS.map((w: any) => w.widgetId));
  for (const w of widgets) {
    if (!validIds.has(w.widgetId)) {
      return { success: false, error: `Unknown widget: ${w.widgetId}` };
    }
  }

  await prisma.dashboardConfig.upsert({
    where: { memberId: user.id },
    create: {
      memberId: user.id,
      widgets: widgets as unknown as any,
    },
    update: {
      widgets: widgets as unknown as any,
    },
  });

  revalidatePath("/admin/settings/dashboard");
  return { success: true };
}

export async function resetDashboardConfig(): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requirePermission("dashboard.configure");

  await prisma.dashboardConfig.deleteMany({
    where: { memberId: user.id },
  });

  revalidatePath("/admin/settings/dashboard");
  return { success: true };
}
