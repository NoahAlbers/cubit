"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea, Checkbox, SubmitButton } from "@/components/ui/form-controls";
import { createWaiverTemplate, type ActionState } from "./actions";

export function AddWaiverButton() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(
    createWaiverTemplate,
    {}
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New template
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="New waiver template"
        description="Members read and sign this text digitally from their portal."
        wide
      >
        <form action={action} className="space-y-4">
          <Field label="Name" htmlFor="w-name">
            <Input id="w-name" name="name" required placeholder="General Liability Waiver" />
          </Field>
          <Field label="Description" htmlFor="w-desc">
            <Input id="w-desc" name="description" placeholder="Shown in waiver lists" />
          </Field>
          <Field label="Waiver text" htmlFor="w-content" hint="The full legal text members agree to.">
            <Textarea id="w-content" name="content" required className="min-h-48 font-mono text-xs" />
          </Field>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isRequired" /> Required for all members
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isActive" defaultChecked /> Active
            </label>
          </div>
          {state.error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Create template</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
