"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import {
  Field,
  Input,
  Textarea,
  Checkbox,
  SubmitButton,
} from "@/components/ui/form-controls";
import { updateWaiverTemplate, type ActionState } from "../actions";

export function WaiverTemplateForm({
  templateId,
  defaults,
  canEdit,
}: {
  templateId: string;
  defaults: {
    name: string;
    description: string;
    content: string;
    isRequired: boolean;
    isActive: boolean;
  };
  canEdit: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await updateWaiverTemplate(templateId, prev, fd);
      if (r.ok) toast.success("Template saved");
      return r;
    },
    {}
  );

  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" defaultValue={defaults.name} required />
        </Field>
        <Field label="Description" htmlFor="description">
          <Input id="description" name="description" defaultValue={defaults.description} />
        </Field>
        <Field
          label="Waiver text"
          htmlFor="content"
          hint="Editing this text bumps the version — existing signatures keep the version they signed."
        >
          <Textarea
            id="content"
            name="content"
            defaultValue={defaults.content}
            required
            className="min-h-72 font-mono text-xs leading-relaxed"
          />
        </Field>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isRequired" defaultChecked={defaults.isRequired} /> Required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isActive" defaultChecked={defaults.isActive} /> Active
          </label>
        </div>
      </fieldset>
      {state.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}
      {canEdit && (
        <div className="flex justify-end">
          <SubmitButton>Save template</SubmitButton>
        </div>
      )}
    </form>
  );
}
