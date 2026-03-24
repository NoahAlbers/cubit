"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  memberProfileSchema,
  emergencyContactSchema,
  statusChangeSchema,
  addKeySchema,
  addTransactionSchema,
} from "@/lib/validations/member";
import { put } from "@vercel/blob";

function revalidateMember(memberId: string) {
  revalidatePath(`/admin/members/${memberId}`);
}

// ─── Profile Actions ────────────────────────────────────────────────────────

export async function updateMemberProfile(memberId: string, formData: FormData) {
  await requirePermission("members.edit");

  const raw = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || null,
    paypalEmail: (formData.get("paypalEmail") as string) || null,
    membershipType: formData.get("membershipType") as string,
    dateOfBirth: (formData.get("dateOfBirth") as string) || null,
    joinDate: (formData.get("joinDate") as string) || null,
  };

  const result = memberProfileSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;

  try {
    await prisma.member.update({
      where: { id: memberId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        paypalEmail: data.paypalEmail || null,
        membershipType: data.membershipType as "STANDARD" | "STUDENT" | "SCHOLARSHIP" | "SPONSORSHIP",
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        joinDate: data.joinDate ? new Date(data.joinDate) : null,
      },
    });
  } catch {
    return { error: "Failed to update profile" };
  }

  revalidateMember(memberId);
  return { success: true };
}

export async function updateEmergencyContact(memberId: string, formData: FormData) {
  await requirePermission("members.edit");

  const raw = {
    emergencyContactName: (formData.get("emergencyContactName") as string) || null,
    emergencyContactEmail: (formData.get("emergencyContactEmail") as string) || null,
    emergencyContactPhone: (formData.get("emergencyContactPhone") as string) || null,
  };

  const result = emergencyContactSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;

  try {
    await prisma.member.update({
      where: { id: memberId },
      data: {
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactEmail: data.emergencyContactEmail || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
      },
    });
  } catch {
    return { error: "Failed to update emergency contact" };
  }

  revalidateMember(memberId);
  return { success: true };
}

export async function uploadMemberPhoto(memberId: string, formData: FormData) {
  await requirePermission("members.edit");

  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file provided" };
  }

  try {
    const blob = await put(`members/${memberId}/${file.name}`, file, {
      access: "public",
    });

    await prisma.member.update({
      where: { id: memberId },
      data: { picture: blob.url },
    });
  } catch {
    return { error: "Failed to upload photo" };
  }

  revalidateMember(memberId);
  return { success: true };
}

// ─── Status Action ──────────────────────────────────────────────────────────

export async function changeMemberStatus(
  memberId: string,
  newStatus: string,
  reason: string
) {
  const user = await requirePermission("members.edit");

  const result = statusChangeSchema.safeParse({ status: newStatus, reason });
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { status: true },
  });

  if (!member) {
    return { error: "Member not found" };
  }

  const oldStatus = member.status;

  try {
    await prisma.$transaction([
      prisma.member.update({
        where: { id: memberId },
        data: {
          status: result.data.status,
          statusReason: reason || null,
        },
      }),
      prisma.memberNote.create({
        data: {
          memberId,
          authorId: user.id,
          content: `Status changed from ${oldStatus} to ${result.data.status} by ${user.name || "Admin"}. Reason: ${reason || "None provided"}`,
          isSystem: true,
        },
      }),
    ]);
  } catch {
    return { error: "Failed to change status" };
  }

  revalidateMember(memberId);
  return { success: true };
}

// ─── Plan Actions ───────────────────────────────────────────────────────────

export async function addMemberPlan(
  memberId: string,
  planId: string,
  startDate: string
) {
  await requirePermission("plans.assign");

  // Check no open plan exists
  const openPlan = await prisma.memberPlan.findFirst({
    where: { memberId, endDate: null },
  });

  if (openPlan) {
    return { error: "Member already has an active plan. End it before adding a new one." };
  }

  try {
    await prisma.memberPlan.create({
      data: {
        memberId,
        planId,
        startDate: new Date(startDate),
      },
    });
  } catch {
    return { error: "Failed to add plan" };
  }

  revalidateMember(memberId);
  return { success: true };
}

export async function endMemberPlan(memberPlanId: string, endDate: string) {
  await requirePermission("plans.assign");

  const memberPlan = await prisma.memberPlan.findUnique({
    where: { id: memberPlanId },
    select: { memberId: true },
  });

  if (!memberPlan) {
    return { error: "Plan not found" };
  }

  try {
    await prisma.memberPlan.update({
      where: { id: memberPlanId },
      data: { endDate: new Date(endDate) },
    });
  } catch {
    return { error: "Failed to end plan" };
  }

  revalidateMember(memberPlan.memberId);
  return { success: true };
}

// ─── Key Actions ────────────────────────────────────────────────────────────

export async function addKey(
  memberId: string,
  serialNumber: string,
  type: string
) {
  await requirePermission("keys.manage");

  const result = addKeySchema.safeParse({ serialNumber, type });
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  try {
    await prisma.key.create({
      data: {
        memberId,
        serialNumber: result.data.serialNumber,
        type: result.data.type || null,
        status: "ACTIVE",
        assignedDate: new Date(),
      },
    });
  } catch {
    return { error: "Failed to add key. Serial number may already exist." };
  }

  revalidateMember(memberId);
  return { success: true };
}

export async function toggleKeyStatus(keyId: string) {
  await requirePermission("keys.manage");

  const key = await prisma.key.findUnique({
    where: { id: keyId },
    select: { status: true, memberId: true },
  });

  if (!key) {
    return { error: "Key not found" };
  }

  const newStatus = key.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  try {
    await prisma.key.update({
      where: { id: keyId },
      data: {
        status: newStatus,
        deactivatedDate: newStatus === "INACTIVE" ? new Date() : null,
      },
    });
  } catch {
    return { error: "Failed to toggle key status" };
  }

  revalidateMember(key.memberId);
  return { success: true, newStatus };
}

export async function deleteKey(keyId: string) {
  await requirePermission("keys.manage");

  const key = await prisma.key.findUnique({
    where: { id: keyId },
    select: { memberId: true },
  });

  if (!key) {
    return { error: "Key not found" };
  }

  try {
    await prisma.key.delete({ where: { id: keyId } });
  } catch {
    return { error: "Failed to delete key" };
  }

  revalidateMember(key.memberId);
  return { success: true };
}

// ─── Transaction Action ─────────────────────────────────────────────────────

export async function addTransaction(
  memberId: string,
  data: {
    transactionDate: string;
    amount: string;
    method: string;
    confirmation?: string;
    description?: string;
    notes?: string;
  }
) {
  await requirePermission("transactions.create");

  const result = addTransactionSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const parsed = result.data;

  try {
    await prisma.transaction.create({
      data: {
        memberId,
        transactionDate: new Date(parsed.transactionDate),
        amount: parseFloat(parsed.amount),
        method: parsed.method as "PAYPAL" | "CASH" | "CHECK" | "CREDIT_CARD" | "STRIPE" | "OTHER",
        confirmation: parsed.confirmation || null,
        description: parsed.description || null,
        notes: parsed.notes || null,
        source: "MANUAL",
      },
    });
  } catch {
    return { error: "Failed to add transaction" };
  }

  revalidateMember(memberId);
  return { success: true };
}

// ─── Note Actions ───────────────────────────────────────────────────────────

export async function addNote(memberId: string, content: string) {
  const user = await requirePermission("members.notes.create");

  if (!content.trim()) {
    return { error: "Note content is required" };
  }

  try {
    await prisma.memberNote.create({
      data: {
        memberId,
        authorId: user.id,
        content: content.trim(),
      },
    });
  } catch {
    return { error: "Failed to add note" };
  }

  revalidateMember(memberId);
  return { success: true };
}

export async function toggleNotePin(noteId: string) {
  await requirePermission("members.notes.create");

  const note = await prisma.memberNote.findUnique({
    where: { id: noteId },
    select: { isPinned: true, memberId: true },
  });

  if (!note) {
    return { error: "Note not found" };
  }

  try {
    await prisma.memberNote.update({
      where: { id: noteId },
      data: { isPinned: !note.isPinned },
    });
  } catch {
    return { error: "Failed to toggle pin" };
  }

  revalidateMember(note.memberId);
  return { success: true };
}

// ─── Waiver Action ──────────────────────────────────────────────────────────

export async function markWaiverComplete(
  memberId: string,
  waiverId: string,
  completedDate: string
) {
  await requirePermission("waivers.manage");

  try {
    await prisma.memberWaiver.upsert({
      where: {
        memberId_waiverId: { memberId, waiverId },
      },
      create: {
        memberId,
        waiverId,
        status: "COMPLETED",
        completedDate: new Date(completedDate),
      },
      update: {
        status: "COMPLETED",
        completedDate: new Date(completedDate),
      },
    });
  } catch {
    return { error: "Failed to mark waiver complete" };
  }

  revalidateMember(memberId);
  return { success: true };
}

// ─── Certification Action ───────────────────────────────────────────────────

export async function addCertification(
  memberId: string,
  equipmentId: string,
  certifiedDate: string,
  notes: string
) {
  const user = await requirePermission("equipment.certify");

  try {
    await prisma.equipmentCertification.create({
      data: {
        memberId,
        equipmentId,
        certifiedDate: new Date(certifiedDate),
        certifiedById: user.id,
        notes: notes || null,
      },
    });
  } catch {
    return { error: "Failed to add certification. Member may already be certified for this equipment." };
  }

  revalidateMember(memberId);
  return { success: true };
}
