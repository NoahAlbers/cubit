import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-bold text-brand-blue">
          SIGN IN
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back to the makerspace.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/reset-password"
          className="font-medium text-brand-blue hover:underline"
        >
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
