"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/validations";
import { sendMemberEmail, appUrl } from "@/lib/email";
import { PasswordResetEmail } from "@/emails/templates";

export type AuthActionState = { error?: string; ok?: boolean; email?: string };

/** Consume a magic-link token and set the member's password. */
export async function setPasswordWithToken(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: "Passwords don't match." };

  const member = await prisma.member.findFirst({
    where: { magicLinkToken: token, magicLinkExpires: { gt: new Date() } },
  });
  if (!member) return { error: "This link is invalid or has expired. Ask staff to send a new invitation." };

  await prisma.member.update({
    where: { id: member.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      magicLinkToken: null,
      magicLinkExpires: null,
    },
  });

  return { ok: true, email: member.email };
}

/** Request a password-reset email. Always reports success to avoid enumeration. */
export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email) return { error: "Enter your email address." };

  const member = await prisma.member.findUnique({ where: { email } });
  if (member) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.member.update({
      where: { id: member.id },
      data: {
        resetToken: token,
        resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await sendMemberEmail({
      memberId: member.id,
      to: member.email,
      type: "PASSWORD_RESET",
      subject: "Reset your Melbourne Makerspace password",
      body: PasswordResetEmail({
        firstName: member.firstName,
        url: appUrl(`/reset-password/confirm?token=${token}`),
      }),
      transactional: true,
    });
  }
  return { ok: true };
}

/** Consume a reset token and set a new password. */
export async function resetPasswordWithToken(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: "Passwords don't match." };

  const member = await prisma.member.findFirst({
    where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
  });
  if (!member) return { error: "This reset link is invalid or has expired." };

  await prisma.member.update({
    where: { id: member.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      resetToken: null,
      resetTokenExpires: null,
    },
  });
  return { ok: true, email: member.email };
}
