"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  updateEquipmentSchema,
  maintenanceLogSchema,
  equipmentCertificationSchema,
} from "@/lib/validations/equipment";

function revalidateEquipment(equipmentId: string) {
  revalidatePath(`/admin/equipment/${equipmentId}`);
}

// ─── Update Equipment ────────────────────────────────────────────────────────

export async function updateEquipment(equipmentId: string, formData: FormData) {
  await requirePermission("equipment.manage");

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    location: (formData.get("location") as string) || null,
    category: (formData.get("category") as string) || null,
    serialNumber: (formData.get("serialNumber") as string) || null,
    status: formData.get("status") as string,
    requiresCertification: formData.get("requiresCertification") === "true",
    purchaseDate: (formData.get("purchaseDate") as string) || null,
    warrantyExpiration: (formData.get("warrantyExpiration") as string) || null,
  };

  const result = updateEquipmentSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;

  try {
    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        name: data.name,
        description: data.description || null,
        location: data.location || null,
        category: data.category || null,
        serialNumber: data.serialNumber || null,
        status: data.status as "OPERATIONAL" | "MAINTENANCE" | "OUT_OF_ORDER" | "RETIRED",
        requiresCertification: data.requiresCertification,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        warrantyExpiration: data.warrantyExpiration ? new Date(data.warrantyExpiration) : null,
      },
    });
  } catch {
    return { error: "Failed to update equipment" };
  }

  revalidateEquipment(equipmentId);
  return { success: true };
}

// ─── Add Certification ───────────────────────────────────────────────────────

export async function addEquipmentCertification(
  equipmentId: string,
  data: { memberId: string; certifiedDate: string; notes?: string }
) {
  const user = await requirePermission("equipment.certify");

  const result = equipmentCertificationSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { memberId, certifiedDate, notes } = result.data;

  try {
    await prisma.equipmentCertification.create({
      data: {
        equipmentId,
        memberId,
        certifiedDate: new Date(certifiedDate),
        certifiedById: user.id,
        notes: notes || null,
      },
    });
  } catch {
    return { error: "Failed to add certification. Member may already be certified for this equipment." };
  }

  revalidateEquipment(equipmentId);
  return { success: true };
}

// ─── Add Maintenance Log ─────────────────────────────────────────────────────

export async function addMaintenanceLog(
  equipmentId: string,
  data: { maintenanceDate: string; description: string; cost?: string; nextDueDate?: string }
) {
  const user = await requirePermission("equipment.maintenance");

  const result = maintenanceLogSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { maintenanceDate, description, cost, nextDueDate } = result.data;

  try {
    await prisma.maintenanceLog.create({
      data: {
        equipmentId,
        performedById: user.id,
        maintenanceDate: new Date(maintenanceDate),
        description,
        cost: cost ? parseFloat(cost) : null,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      },
    });
  } catch {
    return { error: "Failed to add maintenance log" };
  }

  revalidateEquipment(equipmentId);
  return { success: true };
}
