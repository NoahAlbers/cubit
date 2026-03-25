"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export type UninvitedMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
};

export type InvitationResults = {
  sent: number;
  failed: number;
  errors: { memberId: string; email: string; error: string }[];
};

export async function getUninvitedMembers(): Promise<UninvitedMember[]> {
  await requirePermission("members.invite");

  const members = await prisma.member.findMany({
    where: {
      passwordHash: null,
      lastLoginAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return members;
}

export async function sendInvitations(
  memberIds: string[]
): Promise<InvitationResults> {
  await requirePermission("members.invite");

  const results: InvitationResults = { sent: 0, failed: 0, errors: [] };

  if (memberIds.length === 0) return results;

  const members = await prisma.member.findMany({
    where: {
      id: { in: memberIds },
      passwordHash: null,
      lastLoginAt: null,
    },
    select: {
      id: true,
      firstName: true,
      email: true,
    },
  });

  const { resend } = await import("@/lib/resend");
  const { default: WelcomeEmail } = await import("@/emails/welcome");

  for (const member of members) {
    try {
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
        to: member.email,
        subject: "Welcome to Melbourne Makerspace",
        react: WelcomeEmail({ url, firstName: member.firstName }),
      });

      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        memberId: member.id,
        email: member.email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
