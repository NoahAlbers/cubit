"use server";

import { requireAuth, isOwnResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  memberSelfEditSchema,
  changePasswordSchema,
} from "@/lib/validations/member-profile";
import bcrypt from "bcryptjs";
import { put } from "@vercel/blob";

export async function updateOwnProfile(formData: FormData) {
  const user = await requireAuth();

  const memberId = formData.get("memberId") as string;
  if (!isOwnResource(user.id, memberId)) {
    return { error: "You can only edit your own profile." };
  }

  const raw = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    phone: (formData.get("phone") as string) || null,
    emergencyContactName:
      (formData.get("emergencyContactName") as string) || null,
    emergencyContactEmail:
      (formData.get("emergencyContactEmail") as string) || null,
    emergencyContactPhone:
      (formData.get("emergencyContactPhone") as string) || null,
  };

  const parsed = memberSelfEditSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.member.update({
    where: { id: memberId },
    data: parsed.data,
  });

  return { success: true };
}

export async function changePassword(formData: FormData) {
  const user = await requireAuth();

  const memberId = formData.get("memberId") as string;
  if (!isOwnResource(user.id, memberId)) {
    return { error: "You can only change your own password." };
  }

  const raw = {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { passwordHash: true },
  });

  if (!member?.passwordHash) {
    return { error: "No password set. Please use the set-password flow." };
  }

  const isValid = await bcrypt.compare(
    parsed.data.currentPassword,
    member.passwordHash
  );
  if (!isValid) {
    return { error: "Current password is incorrect." };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.member.update({
    where: { id: memberId },
    data: { passwordHash: newHash },
  });

  return { success: true };
}

export async function uploadOwnPhoto(formData: FormData) {
  const user = await requireAuth();

  const memberId = formData.get("memberId") as string;
  if (!isOwnResource(user.id, memberId)) {
    return { error: "You can only update your own photo." };
  }

  const file = formData.get("photo") as File;
  if (!file || file.size === 0) {
    return { error: "No file provided." };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image." };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "Image must be less than 5MB." };
  }

  const blob = await put(`member-photos/${memberId}-${Date.now()}`, file, {
    access: "public",
    contentType: file.type,
  });

  await prisma.member.update({
    where: { id: memberId },
    data: { picture: blob.url },
  });

  return { success: true, url: blob.url };
}
