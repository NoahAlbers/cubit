import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Magic link" };

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (token) {
    const member = await prisma.member.findFirst({
      where: { magicLinkToken: token, magicLinkExpires: { gt: new Date() } },
      select: { id: true },
    });
    if (member) redirect(`/set-password?token=${token}`);
  }

  return (
    <div className="space-y-4 text-center">
      <h1 className="font-display text-lg font-bold text-brand-red">
        LINK EXPIRED
      </h1>
      <p className="text-sm text-muted-foreground">
        This sign-in link is invalid or has expired. Ask a staff member to send
        a new invitation, or sign in with your password.
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
