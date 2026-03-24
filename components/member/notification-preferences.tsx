"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updatePreference, type PreferenceItem } from "@/app/member/preferences/actions";
import { toast } from "sonner";
import { Bell } from "lucide-react";

const typeLabels: Record<string, { label: string; description: string }> = {
  PAYMENT_RECEIPT: {
    label: "Payment Receipts",
    description: "Receive a confirmation when a payment is processed",
  },
  PAYMENT_FAILED: {
    label: "Payment Failed",
    description: "Get notified when a payment attempt fails",
  },
  RENEWAL_REMINDER: {
    label: "Renewal Reminders",
    description: "Reminder before your membership renews",
  },
  PLAN_EXPIRING: {
    label: "Plan Expiring",
    description: "Notification when your plan is about to expire",
  },
  KEY_DEACTIVATED: {
    label: "Key Deactivated",
    description: "Alert when your access key is deactivated",
  },
  ANNOUNCEMENT: {
    label: "Announcements",
    description: "General makerspace announcements and updates",
  },
};

interface NotificationPreferencesProps {
  preferences: PreferenceItem[];
}

export function NotificationPreferences({
  preferences: initialPreferences,
}: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleToggle(notificationType: string, enabled: boolean) {
    setSaving(notificationType);

    // Optimistically update
    setPreferences((prev) =>
      prev.map((p) =>
        p.notificationType === notificationType ? { ...p, enabled } : p
      )
    );

    const result = await updatePreference(notificationType, enabled);
    setSaving(null);

    if (result.error) {
      toast.error(result.error);
      // Revert on error
      setPreferences((prev) =>
        prev.map((p) =>
          p.notificationType === notificationType
            ? { ...p, enabled: !enabled }
            : p
        )
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {preferences.map((pref) => {
            const meta = typeLabels[pref.notificationType];
            if (!meta) return null;
            return (
              <div
                key={pref.notificationType}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex-1">
                  <Label className="text-sm font-medium">{meta.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                </div>
                <Switch
                  checked={pref.enabled}
                  onCheckedChange={(checked: boolean) =>
                    handleToggle(pref.notificationType, checked)
                  }
                  disabled={saving === pref.notificationType}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
