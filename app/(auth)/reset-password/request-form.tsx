"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input, SubmitButton } from "@/components/ui/form-controls";
import { requestPasswordReset, type AuthActionState } from "../actions";

export function RequestResetForm() {
  const [state, action] = useActionState<AuthActionState, FormData>(
    requestPasswordReset,
    {}
  );

  if (state.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-lg bg-success-soft px-3 py-3 text-sm font-medium text-success">
          If an account exists for that email, a reset link is on its way.
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
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>
      {state.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </form>
  );
}
