"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSetting, type SettingItem } from "@/app/admin/settings/system/actions";
import { Loader2, Check } from "lucide-react";

interface SystemSettingsFormProps {
  settings: SettingItem[];
  updaterNames: Record<string, string>;
}

const CATEGORY_ORDER = [
  "Organization",
  "Membership",
  "Notifications",
  "PayPal",
  "Dashboard",
];

export function SystemSettingsForm({
  settings,
  updaterNames,
}: SystemSettingsFormProps) {
  const [activeTab, setActiveTab] = useState(
    () => categorized(settings)[0]?.[0] ?? "Organization"
  );

  const categories = useMemo(() => categorized(settings), [settings]);

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="flex gap-1 border-b">
        {categories.map(([category]) => (
          <button
            key={category}
            onClick={() => setActiveTab(category)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === category
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Settings for active tab */}
      <div className="space-y-6">
        {categories
          .filter(([cat]) => cat === activeTab)
          .map(([, items]) =>
            items.map((setting) => (
              <SettingField
                key={setting.id}
                setting={setting}
                updaterName={
                  setting.updatedBy
                    ? updaterNames[setting.updatedBy] ?? "Unknown"
                    : null
                }
              />
            ))
          )}
      </div>
    </div>
  );
}

function categorized(
  settings: SettingItem[]
): [string, SettingItem[]][] {
  const grouped: Record<string, SettingItem[]> = {};
  for (const s of settings) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  // Sort by predefined order, then alphabetically for unknown categories
  return Object.entries(grouped).sort(([a], [b]) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function SettingField({
  setting,
  updaterName,
}: {
  setting: SettingItem;
  updaterName: string | null;
}) {
  const currentValue =
    typeof setting.value === "object" && setting.value !== null
      ? JSON.stringify(setting.value, null, 2)
      : String(setting.value ?? "");

  const [value, setValue] = useState(currentValue);
  const [boolValue, setBoolValue] = useState(
    setting.fieldType === "boolean" ? setting.value === true : false
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    setting.fieldType === "boolean"
      ? boolValue !== (setting.value === true)
      : value !== currentValue;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const submitValue =
      setting.fieldType === "boolean"
        ? boolValue
        : setting.fieldType === "number"
          ? Number(value)
          : value;

    const result = await updateSetting(setting.id, submitValue);

    if ("error" in result && result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    setSaving(false);
  }

  const options = Array.isArray(setting.options)
    ? (setting.options as string[])
    : [];

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <Label className="text-sm font-medium">{setting.label}</Label>
          {setting.description && (
            <p className="text-xs text-muted-foreground">
              {setting.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {isDirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Field rendering based on type */}
      {setting.fieldType === "boolean" ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={boolValue}
            onCheckedChange={(checked) =>
              setBoolValue(checked === true)
            }
          />
          <span className="text-sm">
            {boolValue ? "Enabled" : "Disabled"}
          </span>
        </label>
      ) : setting.fieldType === "select" ? (
        <Select value={value} onValueChange={(v) => setValue(v ?? "")}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : setting.fieldType === "json" ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          className="font-mono text-sm max-w-lg"
        />
      ) : setting.fieldType === "number" ? (
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-xs"
        />
      ) : setting.fieldType === "email" ? (
        <Input
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-sm"
        />
      ) : (
        <Input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-sm"
        />
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Last updated info */}
      {updaterName && (
        <p className="text-xs text-muted-foreground">
          Last updated by {updaterName} on{" "}
          {new Date(setting.updatedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
