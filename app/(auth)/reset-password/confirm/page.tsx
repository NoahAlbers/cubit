import { ResetConfirmForm } from "@/components/auth/reset-confirm-form";

export const metadata = {
  title: "New Password — Cubit",
};

export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Invalid link. Please use the link from your email.
      </p>
    );
  }

  return <ResetConfirmForm token={token} />;
}
