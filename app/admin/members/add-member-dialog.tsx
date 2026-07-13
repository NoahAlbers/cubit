"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, SubmitButton } from "@/components/ui/form-controls";
import { createMember, type ActionState } from "./actions";

export function AddMemberButton() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(createMember, {});

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add member
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add member"
        description="Creates a Prospective member record. Send them an invitation afterward."
      >
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="firstName">
              <Input id="firstName" name="firstName" required />
            </Field>
            <Field label="Last name" htmlFor="lastName">
              <Input id="lastName" name="lastName" required />
            </Field>
          </div>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" />
            </Field>
            <Field label="Membership type" htmlFor="membershipType">
              <Select id="membershipType" name="membershipType" defaultValue="STANDARD">
                <option value="STANDARD">Standard</option>
                <option value="STUDENT">Student</option>
                <option value="SCHOLARSHIP">Scholarship</option>
                <option value="SPONSORSHIP">Sponsorship</option>
              </Select>
            </Field>
          </div>
          <Field label="Join date" htmlFor="joinDate" hint="Defaults to today.">
            <Input id="joinDate" name="joinDate" type="date" />
          </Field>
          {state.error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Create member</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
