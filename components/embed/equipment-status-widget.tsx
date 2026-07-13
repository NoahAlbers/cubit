"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  EMBED_STATUS_META,
  type EmbedOptions,
  type EquipmentStatusResponse,
} from "@/lib/embed";

interface EquipmentStatusWidgetProps {
  initialData: EquipmentStatusResponse;
  options: EmbedOptions;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EquipmentStatusWidget({
  initialData,
  options,
}: EquipmentStatusWidgetProps) {
  const [data, setData] = useState(initialData);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const qs = options.category
      ? `?${new URLSearchParams({ category: options.category })}`
      : "";
    const url = `/api/public/equipment-status${qs}`;

    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as EquipmentStatusResponse;
        if (!cancelled) {
          setData(next);
          setStale(false);
        }
      } catch {
        // Keep showing the last good data; just flag it as stale.
        if (!cancelled) setStale(true);
      }
    }

    const interval = setInterval(refresh, options.refreshSeconds * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [options.category, options.refreshSeconds]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, typeof data.equipment>();
    for (const item of data.equipment) {
      const key = item.category ?? "Other";
      const list = byCategory.get(key) ?? [];
      list.push(item);
      byCategory.set(key, list);
    }
    return [...byCategory.entries()];
  }, [data]);

  // Group headers are noise when everything is one category (or one was
  // explicitly requested via ?category=).
  const showGroupHeaders = !options.category && groups.length > 1;

  return (
    <div className={cn(options.theme === "dark" && "dark")}>
      <div
        className={cn(
          "min-h-dvh bg-background text-foreground",
          options.compact ? "p-3" : "p-4 sm:p-6"
        )}
      >
        <div className="mx-auto max-w-2xl">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h1
              className={cn(
                "font-bold tracking-tight",
                options.compact ? "text-base" : "text-xl"
              )}
            >
              {options.title}
            </h1>
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title={stale ? "Trying to reconnect" : "Updating automatically"}
            >
              <span className="relative flex h-2 w-2">
                {!stale && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    stale ? "bg-yellow-500" : "bg-green-500"
                  )}
                />
              </span>
              {stale ? "Reconnecting…" : "Live"}
            </span>
          </header>

          {data.equipment.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No equipment to show
              {options.category ? ` for “${options.category}”` : ""}.
            </p>
          ) : (
            <div className={options.compact ? "space-y-3" : "space-y-5"}>
              {groups.map(([category, items]) => (
                <section key={category}>
                  {showGroupHeaders && (
                    <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {category}
                    </h2>
                  )}
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {items.map((item) => {
                      const meta = EMBED_STATUS_META[item.status];
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between gap-3",
                            options.compact ? "px-3 py-1.5" : "px-4 py-2.5"
                          )}
                        >
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "truncate font-medium",
                                options.compact ? "text-sm" : "text-sm sm:text-base"
                              )}
                            >
                              {item.name}
                            </p>
                            {!options.compact && item.location && (
                              <p className="truncate text-xs text-muted-foreground">
                                {item.location}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                              meta.badgeClass
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                meta.dotClass
                              )}
                            />
                            {meta.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <footer className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            {/* Server renders in its own timezone; the client corrects it. */}
            <span suppressHydrationWarning>
              Updated {formatTime(data.generatedAt)}
            </span>
            <a
              href="https://melbournemakerspace.org"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-foreground"
            >
              Melbourne Makerspace
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}
