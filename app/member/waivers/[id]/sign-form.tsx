"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Checkbox, SubmitButton } from "@/components/ui/form-controls";
import { SignaturePad } from "@/components/member/signature-pad";
import { signWaiver, type ActionState } from "../../actions";

export function SignWaiverForm({
  waiverId,
  suggestedName,
}: {
  waiverId: string;
  suggestedName: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(signWaiver, {});

  useEffect(() => {
    if (state.ok) {
      toast.success("Waiver signed — thank you!");
      router.push("/member/waivers");
    }
  }, [state.ok, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign electronically</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="waiverId" value={waiverId} />
          <Field
            label="Type your full legal name"
            htmlFor="signedName"
            hint="This acts as your legal signature."
          >
            <Input
              id="signedName"
              name="signedName"
              defaultValue={suggestedName}
              required
              autoComplete="name"
            />
          </Field>
          <Field label="Draw your signature">
            <SignaturePad />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox name="agree" required className="mt-0.5" />
            <span>
              I have read and understood this agreement, and I sign it freely
              and voluntarily. I understand this electronic signature is
              legally binding.
            </span>
          </label>
          {state.error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
              {state.error}
            </p>
          )}
          <SubmitButton className="w-full sm:w-auto">Sign waiver</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
