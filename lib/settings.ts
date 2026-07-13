import { prisma } from "@/lib/prisma";

/**
 * Read a system setting, falling back to a default when unset.
 * Values are stored as JSON so they round-trip typed.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return row.value as T;
}

export async function getSettings(keys: string[]) {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key: string, value: unknown, updatedBy?: string) {
  await prisma.systemSetting.update({
    where: { key },
    data: { value: value as object, updatedBy },
  });
}
