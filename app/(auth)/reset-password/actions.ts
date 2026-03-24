"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { resetRequestSchema } from "@/lib/validations/auth";
import PasswordResetEmail from "@/emails/password-reset";

export async function requestPasswordReset(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const raw = { email: formData.get("email") as string };

  const parsed = resetRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please enter a valid email" };
  }

  const { email } = parsed.data;

  try {
    const member = await prisma.member.findUnique({
      where: { email },
    });

    // Don't reveal whether the email exists
    if (!member) {
      return { success: true };
    }

    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.member.update({
      where: { id: member.id },
      data: {
        resetToken: token,
        resetTokenExpires: expires,
      },
    });

    const url = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/confirm?token=${token}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Cubit <noreply@cubit.org>",
      to: email,
      subject: "Reset your Cubit password",
      react: PasswordResetEmail({ url, firstName: member.firstName }),
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
