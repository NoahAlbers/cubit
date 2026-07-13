import { prisma } from "@/lib/prisma";
import {
  parseEmbedOptions,
  type EmbedEquipmentItem,
  type EquipmentStatusResponse,
} from "@/lib/embed";
import { EquipmentStatusWidget } from "@/components/embed/equipment-status-widget";

// Publicly embeddable live machine-status board. External sites iframe this
// page (or load /embed/widget.js, which injects the iframe for them).
// Options via query string: ?theme=dark&category=Woodshop&refresh=30&compact=true&title=...

export const dynamic = "force-dynamic";

export default async function EquipmentStatusEmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const options = parseEmbedOptions(await searchParams);

  const equipment = await prisma.equipment.findMany({
    where: {
      status: { not: "RETIRED" },
      ...(options.category
        ? { category: { equals: options.category, mode: "insensitive" } }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
      category: true,
      location: true,
      updatedAt: true,
    },
  });

  const initialData: EquipmentStatusResponse = {
    generatedAt: new Date().toISOString(),
    equipment: equipment.map(
      (e: (typeof equipment)[number]): EmbedEquipmentItem => ({
        id: e.id,
        name: e.name,
        status: e.status as EmbedEquipmentItem["status"],
        category: e.category,
        location: e.location,
        updatedAt: e.updatedAt.toISOString(),
      })
    ),
  };

  return <EquipmentStatusWidget initialData={initialData} options={options} />;
}
