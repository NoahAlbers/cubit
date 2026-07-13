"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MemberStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import {
  memberProfileSchema,
  transactionSchema,
  keySchema,
} from "@/lib/validations";
import { transitionMemberStatus, handlePaymentReceived } from "@/lib/automation";
import { sendMemberEmail, appUrl } from "@/lib/email";
import { MagicLinkEmail } from "@/emails/templates";

export type ActionState = { error?: string; ok?: boolean };

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function dateOrNull(s: string) {
  return s ? new Date(`${s}T12:00:00`) : null;
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export async function createMember(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("members.create");

  const parsed = memberProfileSchema.safeParse({
    firstName: fd(formData, "firstName"),
    lastName: fd(formData, "lastName"),
    email: fd(formData, "email"),
    phone: fd(formData, "phone"),
    paypalEmail: fd(formData, "paypalEmail"),
    membershipType: fd(formData, "membershipType") || "STANDARD",
    dateOfBirth: fd(formData, "dateOfBirth"),
    joinDate: fd(formData, "joinDate"),
    emergencyContactName: "",
    emergencyContactEmail: "",
    emergencyContactPhone: "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.member.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "A member with that email already exists." };

  const memberRole = await prisma.role.findUniqueOrThrow({
    where: { name: "Member" },
  });

  const member = await prisma.member.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      paypalEmail: parsed.data.paypalEmail || null,
      membershipType: parsed.data.membershipType,
      dateOfBirth: dateOrNull(parsed.data.dateOfBirth ?? ""),
      joinDate: dateOrNull(parsed.data.joinDate ?? "") ?? new Date(),
      roleId: memberRole.id,
      status: "PROSPECTIVE",
    },
  });

  revalidatePath("/admin/members");
  redirect(`/admin/members/${member.id}`);
}

export async function updateMemberProfile(
  memberId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("members.edit");

  const parsed = memberProfileSchema.safeParse({
    firstName: fd(formData, "firstName"),
    lastName: fd(formData, "lastName"),
    email: fd(formData, "email"),
    phone: fd(formData, "phone"),
    paypalEmail: fd(formData, "paypalEmail"),
    membershipType: fd(formData, "membershipType"),
    dateOfBirth: fd(formData, "dateOfBirth"),
    joinDate: fd(formData, "joinDate"),
    emergencyContactName: fd(formData, "emergencyContactName"),
    emergencyContactEmail: fd(formData, "emergencyContactEmail"),
    emergencyContactPhone: fd(formData, "emergencyContactPhone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const emailOwner = await prisma.member.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (emailOwner && emailOwner.id !== memberId)
    return { error: "That email belongs to another member." };

  await prisma.member.update({
    where: { id: memberId },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      paypalEmail: parsed.data.paypalEmail || null,
      membershipType: parsed.data.membershipType,
      dateOfBirth: dateOrNull(parsed.data.dateOfBirth ?? ""),
      joinDate: dateOrNull(parsed.data.joinDate ?? ""),
      emergencyContactName: parsed.data.emergencyContactName || null,
      emergencyContactEmail: parsed.data.emergencyContactEmail || null,
      emergencyContactPhone: parsed.data.emergencyContactPhone || null,
    },
  });

  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function changeMemberStatus(
  memberId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePermission("members.edit");
  const to = fd(formData, "status") as MemberStatus;
  const reason = fd(formData, "reason");

  await transitionMemberStatus({
    memberId,
    to,
    reason,
    actorId: user.id,
    actorName: user.name ?? undefined,
  });

  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function changeMemberRole(
  memberId: string,
  roleId: string
): Promise<ActionState> {
  await requirePermission("roles.manage");
  await prisma.member.update({ where: { id: memberId }, data: { roleId } });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function assignPlan(
  memberId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("plans.assign");
  const planId = fd(formData, "planId");
  const startDate = dateOrNull(fd(formData, "startDate"));
  if (!planId || !startDate) return { error: "Pick a plan and start date." };

  const open = await prisma.memberPlan.findFirst({
    where: { memberId, endDate: null },
  });
  if (open)
    return {
      error: "This member already has an open plan. End it before adding another.",
    };

  await prisma.memberPlan.create({
    data: { memberId, planId, startDate },
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function endPlan(
  memberId: string,
  memberPlanId: string
): Promise<ActionState> {
  await requirePermission("plans.assign");
  await prisma.memberPlan.update({
    where: { id: memberPlanId },
    data: { endDate: new Date() },
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export async function addKey(
  memberId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("keys.manage");
  const parsed = keySchema.safeParse({
    serialNumber: fd(formData, "serialNumber"),
    type: fd(formData, "type") || "fob",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.key.findUnique({
    where: { serialNumber: parsed.data.serialNumber },
  });
  if (existing) return { error: "That serial number is already assigned." };

  await prisma.key.create({
    data: {
      memberId,
      serialNumber: parsed.data.serialNumber,
      type: parsed.data.type,
      assignedDate: new Date(),
    },
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function setKeyStatus(
  memberId: string,
  keyId: string,
  status: "ACTIVE" | "INACTIVE" | "LOST" | "RETURNED"
): Promise<ActionState> {
  await requirePermission("keys.manage");
  await prisma.key.update({
    where: { id: keyId },
    data: {
      status,
      deactivatedDate: status === "ACTIVE" ? null : new Date(),
    },
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function deleteKey(memberId: string, keyId: string): Promise<ActionState> {
  await requirePermission("keys.manage");
  await prisma.key.delete({ where: { id: keyId } });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function addTransaction(
  memberId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission("transactions.create");
  const parsed = transactionSchema.safeParse({
    amount: fd(formData, "amount"),
    transactionDate: fd(formData, "transactionDate"),
    description: fd(formData, "description"),
    method: fd(formData, "method") || "OTHER",
    confirmation: fd(formData, "confirmation"),
    notes: fd(formData, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.transaction.create({
    data: {
      memberId,
      amount: parsed.data.amount,
      transactionDate: new Date(`${parsed.data.transactionDate}T12:00:00`),
      description: parsed.data.description || null,
      method: parsed.data.method,
      confirmation: parsed.data.confirmation || null,
      notes: parsed.data.notes || null,
      source: "MANUAL",
    },
  });

  if (parsed.data.amount > 0) await handlePaymentReceived(memberId);

  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNote(
  memberId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePermission("members.notes.create");
  const content = fd(formData, "content").trim();
  if (!content) return { error: "Write a note first." };

  await prisma.memberNote.create({
    data: { memberId, authorId: user.id, content },
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function toggleNotePin(memberId: string, noteId: string): Promise<ActionState> {
  await requirePermission("members.notes.create");
  const note = await prisma.memberNote.findUniqueOrThrow({ where: { id: noteId } });
  await prisma.memberNote.update({
    where: { id: noteId },
    data: { isPinned: !note.isPinned },
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Waivers & certifications
// ---------------------------------------------------------------------------

export async function markWaiverComplete(
  memberId: string,
  waiverId: string
): Promise<ActionState> {
  await requirePermission("waivers.manage");
  await prisma.memberWaiver.upsert({
    where: { memberId_waiverId: { memberId, waiverId } },
    update: { status: "COMPLETED", completedDate: new Date() },
    create: {
      memberId,
      waiverId,
      status: "COMPLETED",
      completedDate: new Date(),
    },
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function addCertification(
  memberId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePermission("equipment.certify");
  const equipmentId = fd(formData, "equipmentId");
  if (!equipmentId) return { error: "Pick a machine." };

  const existing = await prisma.equipmentCertification.findUnique({
    where: { memberId_equipmentId: { memberId, equipmentId } },
  });
  if (existing) return { error: "Already certified on that machine." };

  await prisma.equipmentCertification.create({
    data: {
      memberId,
      equipmentId,
      certifiedDate: new Date(),
      certifiedById: user.id,
      notes: fd(formData, "notes") || null,
    },
  });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

export async function removeCertification(
  memberId: string,
  certId: string
): Promise<ActionState> {
  await requirePermission("equipment.certify");
  await prisma.equipmentCertification.delete({ where: { id: certId } });
  revalidatePath(`/admin/members/${memberId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function sendMagicLinkInvite(memberId: string): Promise<ActionState> {
  await requirePermission("members.invite");
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.member.update({
    where: { id: memberId },
    data: {
      magicLinkToken: token,
      magicLinkExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const result = await sendMemberEmail({
    memberId,
    to: member.email,
    type: member.passwordHash ? "MAGIC_LINK" : "WELCOME",
    subject: member.passwordHash
      ? "Your Melbourne Makerspace sign-in link"
      : "Welcome to Melbourne Makerspace — set up your account",
    body: MagicLinkEmail({
      firstName: member.firstName,
      url: appUrl(`/magic-link?token=${token}`),
      isWelcome: !member.passwordHash,
    }),
    transactional: true,
  });

  revalidatePath("/admin/invitations");
  if ("sent" in result && !result.sent)
    return { error: "Email failed to send — check the Resend API key in your environment." };
  return { ok: true };
}
