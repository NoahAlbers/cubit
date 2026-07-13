"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import {
  Field,
  Input,
  Select,
  Textarea,
  Checkbox,
  SubmitButton,
} from "@/components/ui/form-controls";
import { updateEquipment, addMaintenanceLog, type ActionState } from "../actions";

export function EquipmentForm({
  equipmentId,
  defaults,
  canEdit,
}: {
  equipmentId: string;
  defaults: {
    name: string;
    description: string;
    location: string;
    category: string;
    serialNumber: string;
    status: string;
    requiresCertification: boolean;
  };
  canEdit: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await updateEquipment(equipmentId, prev, fd);
      if (r.ok) toast.success("Equipment saved");
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
          <Textarea id="description" name="description" defaultValue={defaults.description} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="category">
            <Input id="category" name="category" defaultValue={defaults.category} />
          </Field>
          <Field label="Location" htmlFor="location">
            <Input id="location" name="location" defaultValue={defaults.location} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Serial number" htmlFor="serialNumber">
            <Input id="serialNumber" name="serialNumber" defaultValue={defaults.serialNumber} />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={defaults.status}>
              <option value="OPERATIONAL">Operational</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OUT_OF_ORDER">Out of order</option>
              <option value="RETIRED">Retired</option>
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            name="requiresCertification"
            defaultChecked={defaults.requiresCertification}
          />
          Requires certification before use
        </label>
      </fieldset>
      {state.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}
      {canEdit && (
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function MaintenanceForm({ equipmentId }: { equipmentId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await addMaintenanceLog(equipmentId, prev, fd);
      if (r.ok) toast.success("Maintenance logged");
      return r;
    },
    {}
  );

  return (
    <form action={action} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
      <Field label="Date" htmlFor="maintenanceDate">
        <Input
          id="maintenanceDate"
          name="maintenanceDate"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </Field>
      <Field label="Work performed" htmlFor="m-description" className="col-span-2">
        <Input id="m-description" name="description" required placeholder="Replaced lens, cleaned rails" />
      </Field>
      <Field label="Cost" htmlFor="m-cost">
        <Input id="m-cost" name="cost" type="number" step="0.01" placeholder="0.00" />
      </Field>
      <div className="flex items-end gap-2">
        <Field label="Next due" htmlFor="m-next" className="flex-1">
          <Input id="m-next" name="nextDueDate" type="date" />
        </Field>
        <SubmitButton size="sm">Log</SubmitButton>
      </div>
      {state.error && (
        <p className="col-span-full rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}
    </form>
  );
}
