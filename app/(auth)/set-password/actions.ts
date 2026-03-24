"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setPasswordSchema } from "@/lib/validations/auth";

export async function setPassword(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const memberId = formData.get("memberId") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!memberId) {
    return { error: "Member ID is required" };
  }

  const parsed = setPasswordSchema.safeParse({ password, confirmPassword });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return { error: "Member not found" };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    await prisma.member.update({
      where: { id: memberId },
      data: { passwordHash },
    });

    return { success: true };
  } catch (error) {
    console.error("Set password error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
