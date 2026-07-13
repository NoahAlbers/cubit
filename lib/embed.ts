// Shared definitions for the public embed widgets (iframe/script embeds that
// external sites like melbournemakerspace.org can drop in).

export type EmbedEquipmentStatus =
  | "OPERATIONAL"
  | "MAINTENANCE"
  | "OUT_OF_ORDER";

export interface EmbedEquipmentItem {
  id: string;
  name: string;
  status: EmbedEquipmentStatus;
  category: string | null;
  location: string | null;
  updatedAt: string;
}

export interface EquipmentStatusResponse {
  generatedAt: string;
  equipment: EmbedEquipmentItem[];
}

export const EMBED_STATUS_META: Record<
  EmbedEquipmentStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  OPERATIONAL: {
    label: "Operational",
    dotClass: "bg-green-500",
    badgeClass:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  MAINTENANCE: {
    label: "Maintenance",
    dotClass: "bg-yellow-500",
    badgeClass:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  OUT_OF_ORDER: {
    label: "Out of order",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

export interface EmbedOptions {
  theme: "light" | "dark";
  category: string | null;
  refreshSeconds: number;
  compact: boolean;
  title: string;
}

export const EMBED_DEFAULT_REFRESH_SECONDS = 60;
export const EMBED_MIN_REFRESH_SECONDS = 15;
export const EMBED_DEFAULT_TITLE = "Machine Status";

/** Parse embed options from a page's searchParams (all values optional). */
export function parseEmbedOptions(
  params: Record<string, string | string[] | undefined>
): EmbedOptions {
  const get = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  const refreshRaw = parseInt(get("refresh") ?? "", 10);
  const refreshSeconds = Number.isFinite(refreshRaw)
    ? Math.max(EMBED_MIN_REFRESH_SECONDS, refreshRaw)
    : EMBED_DEFAULT_REFRESH_SECONDS;

  return {
    theme: get("theme") === "dark" ? "dark" : "light",
    category: get("category")?.trim() || null,
    refreshSeconds,
    compact: get("compact") === "true",
    title: get("title")?.trim() || EMBED_DEFAULT_TITLE,
  };
}
