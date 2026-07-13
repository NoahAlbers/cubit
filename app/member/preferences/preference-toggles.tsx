"use client";

import { useOptimistic, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setNotificationPreference } from "../actions";

type Item = { type: string; label: string; description: string; enabled: boolean };

export function PreferenceToggles({ items }: { items: Item[] }) {
  const [optimistic, setOptimistic] = useOptimistic(items);
  const [, startTransition] = useTransition();

  return (
    <div className="divide-y">
      {optimistic.map((item) => (
        <div key={item.type} className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
          <Switch
            checked={item.enabled}
            aria-label={item.label}
            onCheckedChange={(checked: boolean) => {
              startTransition(async () => {
                setOptimistic((prev) =>
                  prev.map((p) =>
                    p.type === item.type ? { ...p, enabled: checked } : p
                  )
                );
                await setNotificationPreference(item.type, checked);
              });
            }}
          />
        </div>
      ))}
    </div>
  );
}
