import { RequestResetForm } from "./request-form";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-bold text-brand-blue">
          RESET PASSWORD
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>
      <RequestResetForm />
    </div>
  );
}
