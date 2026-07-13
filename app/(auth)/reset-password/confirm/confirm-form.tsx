"use client";

import { useActionState, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Field, Input, SubmitButton } from "@/components/ui/form-controls";
import { resetPasswordWithToken, type AuthActionState } from "../../actions";

export function ConfirmResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [state, action] = useActionState<AuthActionState, FormData>(
    resetPasswordWithToken,
    {}
  );

  useEffect(() => {
    if (state.ok && state.email) {
      signIn("credentials", {
        email: state.email,
        password,
        callbackUrl: "/",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.email]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      {state.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}
      <SubmitButton className="w-full">Save &amp; sign in</SubmitButton>
    </form>
  );
}
