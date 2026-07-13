import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { EmbedSnippetBuilder } from "@/components/admin/embed-snippet-builder";

export default async function EmbedsSettingsPage() {
  await requirePermission("settings.view");

  const categories = await prisma.equipment.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Embeds</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Embed a live machine-status board on the public website
          (melbournemakerspace.org) or anywhere else. The widget shows
          equipment status only — no member data — and refreshes itself
          automatically.
        </p>
      </div>
      <EmbedSnippetBuilder
        categories={categories
          .map((c: { category: string | null }) => c.category)
          .filter((c: string | null): c is string => c !== null)}
        appUrl={process.env.NEXT_PUBLIC_APP_URL || null}
      />
    </div>
  );
}
