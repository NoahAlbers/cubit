"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { equipmentSchema } from "@/lib/validations";

export type ActionState = { error?: string; ok?: boolean };

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function parseEquipment(formData: FormData) {
  return equipmentSchema.safeParse({
    name: fd(formData, "name"),
    description: fd(formData, "description"),
    location: fd(formData, "location"),
    category: fd(formData, "category"),
    serialNumber: fd(formData, "serialNumber"),
    status: fd(formData, "status") || "OPERATIONAL",
    requiresCertification: fd(formData, "requiresCertification") === "on",
  });
}

export async function createEquipment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("equipment.manage");
  const parsed = parseEquipment(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const eq = await prisma.equipment.create({
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      category: parsed.data.category || null,
      serialNumber: parsed.data.serialNumber || null,
    },
  });
  revalidatePath("/admin/equipment");
  redirect(`/admin/equipment/${eq.id}`);
}

export async function updateEquipment(
  equipmentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("equipment.manage");
  const parsed = parseEquipment(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      category: parsed.data.category || null,
      serialNumber: parsed.data.serialNumber || null,
    },
  });
  revalidatePath(`/admin/equipment/${equipmentId}`);
  revalidatePath("/admin/equipment");
  return { ok: true };
}

export async function addMaintenanceLog(
  equipmentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePermission("equipment.maintenance");
  const description = fd(formData, "description").trim();
  const date = fd(formData, "maintenanceDate");
  if (!description || !date) return { error: "Date and description are required." };

  const cost = fd(formData, "cost");
  const nextDue = fd(formData, "nextDueDate");

  await prisma.maintenanceLog.create({
    data: {
      equipmentId,
      performedById: user.id,
      maintenanceDate: new Date(`${date}T12:00:00`),
      description,
      cost: cost ? parseFloat(cost) : null,
      nextDueDate: nextDue ? new Date(`${nextDue}T12:00:00`) : null,
    },
  });
  revalidatePath(`/admin/equipment/${equipmentId}`);
  return { ok: true };
}
