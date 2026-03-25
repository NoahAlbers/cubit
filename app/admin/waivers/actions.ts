"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { waiverTemplateSchema } from "@/lib/validations/waiver";
import { revalidatePath } from "next/cache";

export async function getWaiverTemplates() {
  await requirePermission("waivers.view");

  const [templates, activeMemberCount] = await Promise.all([
    prisma.waiverTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            memberWaivers: {
              where: { status: "COMPLETED" },
            },
          },
        },
      },
    }),
    prisma.member.count({
      where: {
        status: { in: ["ACTIVE", "HOLD", "PAST_DUE"] },
      },
    }),
  ]);

  const serialized = templates.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isRequired: t.isRequired,
    isActive: t.isActive,
    completedCount: t._count.memberWaivers,
    totalActiveMembers: activeMemberCount,
    createdAt: t.createdAt.toISOString(),
  }));

  return { templates: serialized };
}

export type WaiverTemplateItem = Awaited<
  ReturnType<typeof getWaiverTemplates>
>["templates"][number];

export async function createWaiverTemplate(data: unknown) {
  await requirePermission("waivers.manage");

  const result = waiverTemplateSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { name, description, isRequired, isActive } = result.data;

  try {
    const template = await prisma.waiverTemplate.create({
      data: {
        name,
        description: description || null,
        isRequired,
        isActive,
      },
    });

    revalidatePath("/admin/waivers");
    return { success: true, templateId: template.id };
  } catch {
    return { error: "Failed to create waiver template" };
  }
}

export async function updateWaiverTemplate(id: string, data: unknown) {
  await requirePermission("waivers.manage");

  const result = waiverTemplateSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { name, description, isRequired, isActive } = result.data;

  try {
    await prisma.waiverTemplate.update({
      where: { id },
      data: {
        name,
        description: description || null,
        isRequired,
        isActive,
      },
    });

    revalidatePath("/admin/waivers");
    return { success: true };
  } catch {
    return { error: "Failed to update waiver template" };
  }
}

export async function getWaiverCompliance(waiverId: string) {
  await requirePermission("waivers.view");

  const [members, waivers] = await Promise.all([
    prisma.member.findMany({
      where: {
        status: { in: ["ACTIVE", "HOLD", "PAST_DUE"] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.memberWaiver.findMany({
      where: { waiverId },
      select: {
        memberId: true,
        status: true,
        completedDate: true,
      },
    }),
  ]);

  const waiverMap = new Map<string, { memberId: string; status: string; completedDate: Date | null }>(
    waivers.map((w: any) => [w.memberId, w])
  );

  const compliance = members.map((m: any) => {
    const waiver = waiverMap.get(m.id);
    return {
      memberId: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      status: waiver?.status ?? ("NOT_STARTED" as const),
      completedDate: waiver?.completedDate?.toISOString() ?? null,
    };
  });

  return { compliance };
}

export type WaiverComplianceItem = Awaited<
  ReturnType<typeof getWaiverCompliance>
>["compliance"][number];
