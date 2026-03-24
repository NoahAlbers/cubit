"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  updateDashboardConfig,
  resetDashboardConfig,
} from "@/app/admin/settings/dashboard/actions";
import {
  AVAILABLE_WIDGETS,
  type WidgetConfig,
} from "@/lib/dashboard-widgets";
import {
  Loader2,
  Check,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from "lucide-react";

interface DashboardConfigFormProps {
  initialWidgets: WidgetConfig[];
}

const widgetMeta = Object.fromEntries(
  AVAILABLE_WIDGETS.map((w) => [w.widgetId, w])
);

export function DashboardConfigForm({
  initialWidgets,
}: DashboardConfigFormProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialWidgets);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    JSON.stringify(widgets) !== JSON.stringify(initialWidgets);

  const toggleWidget = useCallback((widgetId: string) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.widgetId === widgetId ? { ...w, enabled: !w.enabled } : w
      )
    );
    setSaved(false);
  }, []);

  const moveWidget = useCallback(
    (index: number, direction: "up" | "down") => {
      setWidgets((prev) => {
        const next = [...prev];
        const swapIndex = direction === "up" ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= next.length) return prev;

        // Swap the items
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];

        // Re-assign positions
        return next.map((w, i) => ({ ...w, position: i }));
      });
      setSaved(false);
    },
    []
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await updateDashboardConfig(widgets);

    if (!result.success) {
      setError(result.error ?? "Failed to save configuration");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    setSaving(false);
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    setSaved(false);

    const result = await resetDashboardConfig();

    if (!result.success) {
      setError(result.error ?? "Failed to reset configuration");
    } else {
      // Reload page to get fresh defaults
      window.location.reload();
    }

    setResetting(false);
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Choose which widgets appear on your admin dashboard and set their
          order. Drag widgets using the arrow buttons to reorder.
        </p>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={resetting || saving}
          >
            {resetting && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            Save Configuration
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Widget list */}
      <div className="space-y-2">
        {widgets.map((widget, index) => {
          const meta = widgetMeta[widget.widgetId];
          if (!meta) return null;

          return (
            <Card
              key={widget.widgetId}
              className={
                widget.enabled
                  ? "border-primary/30 bg-primary/5"
                  : "opacity-60"
              }
            >
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-4">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => moveWidget(index, "up")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === widgets.length - 1}
                      onClick={() => moveWidget(index, "down")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Position number */}
                  <span className="text-xs text-muted-foreground font-mono w-5 text-center">
                    {index + 1}
                  </span>

                  {/* Toggle */}
                  <Checkbox
                    checked={widget.enabled}
                    onCheckedChange={() => toggleWidget(widget.widgetId)}
                  />

                  {/* Widget info */}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium">
                      {meta.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {meta.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
