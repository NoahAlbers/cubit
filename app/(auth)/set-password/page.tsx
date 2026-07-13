import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SetPasswordForm } from "./set-password-form";

export const metadata = { title: "Set your password" };

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const member = token
    ? await prisma.member.findFirst({
        where: { magicLinkToken: token, magicLinkExpires: { gt: new Date() } },
        select: { firstName: true },
      })
    : null;

  if (!member || !token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="font-display text-lg font-bold text-brand-red">
          LINK EXPIRED
        </h1>
        <p className="text-sm text-muted-foreground">
          This invitation link is invalid or has expired. Ask a staff member to
          send you a new one.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-brand-blue hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-bold text-brand-blue">
          WELCOME, {member.firstName.toUpperCase()}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a password to finish setting up your account.
        </p>
      </div>
      <SetPasswordForm token={token} />
    </div>
  );
}
