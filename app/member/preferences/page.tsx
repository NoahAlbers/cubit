import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreferenceToggles } from "./preference-toggles";

export const metadata = { title: "Notification Preferences" };
export const dynamic = "force-dynamic";

const MEMBER_PREF_TYPES: { type: string; label: string; description: string }[] = [
  {
    type: "PAYMENT_RECEIPT",
    label: "Payment receipts",
    description: "A receipt each time a payment is recorded.",
  },
  {
    type: "RENEWAL_REMINDER",
    label: "Renewal reminders",
    description: "Heads-up before your plan's end date.",
  },
  {
    type: "KEY_DEACTIVATED",
    label: "Key status alerts",
    description: "If your door access is deactivated.",
  },
  {
    type: "WAIVER_REMINDER",
    label: "Waiver reminders",
    description: "Reminders about unsigned required waivers.",
  },
  {
    type: "ANNOUNCEMENT",
    label: "Announcements",
    description: "News and updates from the makerspace.",
  },
];

export default async function PreferencesPage() {
  const user = await requireAuth();
  const prefs = await prisma.notificationPreference.findMany({
    where: { memberId: user.id },
  });
  const prefMap = new Map(prefs.map((p) => [p.notificationType as string, p.enabled]));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-brand-blue">
        NOTIFICATIONS
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Email preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferenceToggles
            items={MEMBER_PREF_TYPES.map((p) => ({
              ...p,
              enabled: prefMap.get(p.type) ?? true,
            }))}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Account emails like sign-in links and password resets are always
            delivered.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
