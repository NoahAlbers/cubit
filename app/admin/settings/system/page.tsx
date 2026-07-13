import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { SystemSettingsForm } from "./system-settings-form";

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  const user = await requirePermission("settings.view");

  const settings = await prisma.systemSetting.findMany({
    where: { category: { not: "RFID Access" } },
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });

  return (
    <SystemSettingsForm
      settings={settings.map((s) => ({
        key: s.key,
        label: s.label,
        description: s.description,
        category: s.category,
        fieldType: s.fieldType,
        value: s.value,
        options: (s.options as string[] | null) ?? null,
      }))}
      canManage={hasPermission(user, "settings.manage")}
    />
  );
}
