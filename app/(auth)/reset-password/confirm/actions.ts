"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";

export async function confirmPasswordReset(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const parsed = resetPasswordSchema.safeParse({
    token,
    password,
    confirmPassword,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const member = await prisma.member.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!member) {
      return { error: "Invalid or expired reset link" };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    await prisma.member.update({
      where: { id: member.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Confirm password reset error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
