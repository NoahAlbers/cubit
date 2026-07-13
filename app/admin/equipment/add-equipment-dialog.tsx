"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Checkbox, SubmitButton } from "@/components/ui/form-controls";
import { createEquipment, type ActionState } from "./actions";

export function AddEquipmentButton() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(createEquipment, {});

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add equipment
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Add equipment">
        <form action={action} className="space-y-4">
          <Field label="Name" htmlFor="eq-name">
            <Input id="eq-name" name="name" required placeholder="Laser cutter — Thunder Nova 35" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="eq-category">
              <Input id="eq-category" name="category" placeholder="Laser" />
            </Field>
            <Field label="Location" htmlFor="eq-location">
              <Input id="eq-location" name="location" placeholder="Main shop" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Serial number" htmlFor="eq-serial">
              <Input id="eq-serial" name="serialNumber" />
            </Field>
            <Field label="Status" htmlFor="eq-status">
              <Select id="eq-status" name="status" defaultValue="OPERATIONAL">
                <option value="OPERATIONAL">Operational</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OUT_OF_ORDER">Out of order</option>
                <option value="RETIRED">Retired</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="requiresCertification" />
            Requires certification before use
          </label>
          {state.error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Add equipment</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
