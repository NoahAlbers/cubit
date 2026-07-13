import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { appUrl } from "@/lib/email";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RfidTokenPanel } from "./rfid-token-panel";
import { SystemSettingsForm } from "../system/system-settings-form";

export const dynamic = "force-dynamic";

export default async function RfidSettingsPage() {
  const user = await requirePermission("settings.view");

  const settings = await prisma.systemSetting.findMany({
    where: { category: "RFID Access", key: { not: "rfid.api_token" } },
    orderBy: { label: "asc" },
  });
  const tokenRow = await prisma.systemSetting.findUnique({
    where: { key: "rfid.api_token" },
  });
  const token = (tokenRow?.value as string) ?? "";
  const canManage = hasPermission(user, "settings.manage");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>RFIDLock integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Cubit serves the door whitelist in the same JSON format the{" "}
            <a
              href="https://github.com/MelbourneMakerSpace/RFIDLock"
              className="font-medium text-brand-blue hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              RFIDLock
            </a>{" "}
            Raspberry Pi already understands —{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              [{"{"}&quot;firstName&quot;, &quot;lastName&quot;, &quot;serial&quot;{"}"}]
            </code>
            . Point the reader&apos;s whitelist URL at:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-brand-blue-darker px-4 py-3 font-mono text-xs text-white">
{`# Download whitelist (cron on the Pi)
curl -s "${appUrl("/api/rfid/whitelist")}?token=<API_TOKEN>" > whitelist.json

# Optionally report scans back for the access log
curl -s -X POST "${appUrl("/api/rfid/access-log")}" \\
  -H "Authorization: Bearer <API_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"serial":"8045AB453449","accessPoint":"front-door","granted":true}'`}
          </pre>
          <RfidTokenPanel token={token} canManage={canManage} />
        </CardContent>
      </Card>

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
        canManage={canManage}
      />
    </div>
  );
}
