"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import {
  equipmentSearchSchema,
  createEquipmentSchema,
  type EquipmentSearchInput,
} from "@/lib/validations/equipment";
import { Prisma } from "@/lib/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function getEquipment(params: EquipmentSearchInput) {
  await requirePermission("equipment.view");

  const parsed = equipmentSearchSchema.parse(params);
  const {
    search,
    status,
    category,
    requiresCert,
    sortField,
    sortDirection,
    page,
    pageSize,
  } = parsed;

  const where: Prisma.EquipmentWhereInput = {};

  // Search by name
  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { serialNumber: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  // Status filter
  if (status) {
    where.status = status as Prisma.EnumEquipmentStatusFilter["equals"];
  }

  // Category filter
  if (category) {
    where.category = category;
  }

  // Requires certification filter
  if (requiresCert === "true") {
    where.requiresCertification = true;
  } else if (requiresCert === "false") {
    where.requiresCertification = false;
  }

  // Build orderBy
  let orderBy: Prisma.EquipmentOrderByWithRelationInput[] = [];
  if (sortField === "name") {
    orderBy = [{ name: sortDirection }];
  } else if (sortField === "status") {
    orderBy = [{ status: sortDirection }];
  } else if (sortField === "category") {
    orderBy = [{ category: sortDirection }];
  } else if (sortField === "location") {
    orderBy = [{ location: sortDirection }];
  }

  const skip = (page - 1) * pageSize;

  const [equipment, totalCount, categories] = await Promise.all([
    prisma.equipment.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where: { category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
  ]);

  // Serialize dates for client
  const serializedEquipment = equipment.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    location: e.location,
    status: e.status,
    requiresCertification: e.requiresCertification,
    category: e.category,
    serialNumber: e.serialNumber,
  }));

  const uniqueCategories = categories
    .map((c) => c.category)
    .filter((c): c is string => c !== null);

  return { equipment: serializedEquipment, totalCount, categories: uniqueCategories };
}

export type EquipmentListItem = Awaited<
  ReturnType<typeof getEquipment>
>["equipment"][number];

export async function createEquipment(data: unknown) {
  await requirePermission("equipment.manage");

  const result = createEquipmentSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const {
    name,
    description,
    location,
    category,
    serialNumber,
    status,
    requiresCertification,
  } = result.data;

  try {
    const equipment = await prisma.equipment.create({
      data: {
        name,
        description: description || null,
        location: location || null,
        category: category || null,
        serialNumber: serialNumber || null,
        status: status as "OPERATIONAL" | "MAINTENANCE" | "OUT_OF_ORDER" | "RETIRED",
        requiresCertification,
      },
    });

    revalidatePath("/admin/equipment");
    return { success: true, equipmentId: equipment.id };
  } catch {
    return { error: "Failed to create equipment" };
  }
}
