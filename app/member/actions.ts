"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { passwordSchema, waiverSignatureSchema } from "@/lib/validations";
import type { NotificationType } from "@prisma/client";

export type ActionState = { error?: string; ok?: boolean };

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function updateMyProfile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();

  const firstName = fd(formData, "firstName").trim();
  const lastName = fd(formData, "lastName").trim();
  if (!firstName || !lastName) return { error: "Name is required." };

  await prisma.member.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      phone: fd(formData, "phone").trim() || null,
      emergencyContactName: fd(formData, "emergencyContactName").trim() || null,
      emergencyContactEmail: fd(formData, "emergencyContactEmail").trim() || null,
      emergencyContactPhone: fd(formData, "emergencyContactPhone").trim() || null,
    },
  });
  revalidatePath("/member/profile");
  return { ok: true };
}

export async function changeMyPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  const current = fd(formData, "current");
  const password = fd(formData, "password");
  const confirm = fd(formData, "confirm");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: "New passwords don't match." };

  const member = await prisma.member.findUniqueOrThrow({ where: { id: user.id } });
  if (!member.passwordHash || !(await bcrypt.compare(current, member.passwordHash)))
    return { error: "Current password is incorrect." };

  await prisma.member.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  return { ok: true };
}

/** Digitally sign a waiver: typed legal name + drawn signature. */
export async function signWaiver(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();

  const parsed = waiverSignatureSchema.safeParse({
    waiverId: fd(formData, "waiverId"),
    signedName: fd(formData, "signedName"),
    signatureData: fd(formData, "signatureData"),
    agree: fd(formData, "agree"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const template = await prisma.waiverTemplate.findUnique({
    where: { id: parsed.data.waiverId },
  });
  if (!template || !template.isActive)
    return { error: "This waiver is no longer available." };

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    null;

  await prisma.memberWaiver.upsert({
    where: {
      memberId_waiverId: { memberId: user.id, waiverId: template.id },
    },
    update: {
      status: "COMPLETED",
      completedDate: new Date(),
      signedName: parsed.data.signedName,
      signatureData: parsed.data.signatureData,
      signedVersion: template.version,
      signedIpAddress: ip,
    },
    create: {
      memberId: user.id,
      waiverId: template.id,
      status: "COMPLETED",
      completedDate: new Date(),
      signedName: parsed.data.signedName,
      signatureData: parsed.data.signatureData,
      signedVersion: template.version,
      signedIpAddress: ip,
    },
  });

  revalidatePath("/member/waivers");
  revalidatePath("/member/dashboard");
  return { ok: true };
}

export async function setNotificationPreference(
  type: string,
  enabled: boolean
): Promise<ActionState> {
  const user = await requireAuth();
  await prisma.notificationPreference.upsert({
    where: {
      memberId_notificationType: {
        memberId: user.id,
        notificationType: type as NotificationType,
      },
    },
    update: { enabled },
    create: {
      memberId: user.id,
      notificationType: type as NotificationType,
      enabled,
    },
  });
  revalidatePath("/member/preferences");
  return { ok: true };
}
