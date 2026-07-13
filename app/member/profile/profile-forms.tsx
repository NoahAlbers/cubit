"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import { Field, Input, SubmitButton } from "@/components/ui/form-controls";
import { updateMyProfile, changeMyPassword, type ActionState } from "../actions";

export function ProfileForm({ defaults }: { defaults: Record<string, string> }) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await updateMyProfile(prev, fd);
      if (r.ok) toast.success("Profile saved");
      return r;
    },
    {}
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" defaultValue={defaults.firstName} required />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" defaultValue={defaults.lastName} required />
        </Field>
      </div>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} />
      </Field>
      <p className="pt-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Emergency contact
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor="ec-name">
          <Input id="ec-name" name="emergencyContactName" defaultValue={defaults.emergencyContactName} />
        </Field>
        <Field label="Email" htmlFor="ec-email">
          <Input id="ec-email" name="emergencyContactEmail" type="email" defaultValue={defaults.emergencyContactEmail} />
        </Field>
        <Field label="Phone" htmlFor="ec-phone">
          <Input id="ec-phone" name="emergencyContactPhone" type="tel" defaultValue={defaults.emergencyContactPhone} />
        </Field>
      </div>
      {state.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await changeMyPassword(prev, fd);
      if (r.ok) {
        toast.success("Password changed");
        formRef.current?.reset();
      }
      return r;
    },
    {}
  );

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Current password" htmlFor="current">
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="New password" htmlFor="new-password">
          <Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Field label="Confirm new" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      {state.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <SubmitButton variant="secondary">Change password</SubmitButton>
      </div>
    </form>
  );
}
