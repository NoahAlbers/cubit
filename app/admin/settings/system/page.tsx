import { getSettings } from "./actions";
import { prisma } from "@/lib/prisma";
import { SystemSettingsForm } from "@/components/admin/system-settings-form";

export default async function SystemSettingsPage() {
  const settings = await getSettings();

  // Collect unique updatedBy IDs and fetch names
  const updaterIds = [
    ...new Set(
      settings.map((s: any) => s.updatedBy).filter((id: any): id is string => !!id)
    ),
  ];

  const updaterNames: Record<string, string> = {};

  if (updaterIds.length > 0) {
    const members = await prisma.member.findMany({
      where: { id: { in: updaterIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const m of members) {
      updaterNames[m.id] = `${m.firstName} ${m.lastName}`;
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">System Settings</h2>
      {settings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No system settings configured yet. Settings will appear here once
          they are seeded in the database.
        </p>
      ) : (
        <SystemSettingsForm
          settings={settings}
          updaterNames={updaterNames}
        />
      )}
    </div>
  );
}
