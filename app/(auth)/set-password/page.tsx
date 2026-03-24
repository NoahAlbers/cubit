import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata = {
  title: "Set Password — Cubit",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { memberId } = await searchParams;

  if (!memberId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Invalid link. Please use the link from your email.
      </p>
    );
  }

  return <SetPasswordForm memberId={memberId} />;
}
