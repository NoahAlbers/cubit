"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { resetRequestSchema } from "@/lib/validations/auth";
import MagicLinkEmail from "@/emails/magic-link";

export async function requestMagicLink(
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
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.member.update({
      where: { id: member.id },
      data: {
        magicLinkToken: token,
        magicLinkExpires: expires,
      },
    });

    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/magic-link?token=${token}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Cubit <noreply@cubit.org>",
      to: email,
      subject: "Sign in to Cubit",
      react: MagicLinkEmail({ url, firstName: member.firstName }),
    });

    return { success: true };
  } catch (error) {
    console.error("Magic link error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
