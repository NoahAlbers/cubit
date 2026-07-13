import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConfirmResetForm } from "./confirm-form";

export const metadata = { title: "Choose a new password" };

export default async function ConfirmResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const valid = token
    ? await prisma.member.findFirst({
        where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
        select: { id: true },
      })
    : null;

  if (!valid || !token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-display text-lg font-bold text-brand-red">
          LINK EXPIRED
        </h1>
        <p className="text-sm text-muted-foreground">
          This reset link is invalid or has expired.
        </p>
        <Link
          href="/reset-password"
          className="inline-block text-sm font-medium text-brand-blue hover:underline"
        >
          Request a new one
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-bold text-brand-blue">
          NEW PASSWORD
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>
      <ConfirmResetForm token={token} />
    </div>
  );
}
