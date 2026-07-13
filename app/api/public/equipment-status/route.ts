import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { EquipmentStatusResponse, EmbedEquipmentItem } from "@/lib/embed";

// Public, unauthenticated, read-only endpoint consumed by the embeddable
// widgets on external sites (e.g. melbournemakerspace.org). Exposes only
// non-sensitive equipment fields — never member data.

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category")?.trim();

  const equipment = await prisma.equipment.findMany({
    where: {
      status: { not: "RETIRED" },
      ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
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

  const body: EquipmentStatusResponse = {
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

  return Response.json(body, {
    headers: {
      ...CORS_HEADERS,
      // Let Vercel's CDN absorb polling traffic from many embedded widgets.
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
