"use client";

import { useTransition, useState } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateEquipment } from "@/app/admin/equipment/[id]/actions";

const EQUIPMENT_STATUSES = ["OPERATIONAL", "MAINTENANCE", "OUT_OF_ORDER", "RETIRED"] as const;

interface EquipmentFormProps {
  equipmentId: string;
  equipment: {
    name: string;
    description: string | null;
    location: string | null;
    category: string | null;
    serialNumber: string | null;
    status: string;
    requiresCertification: boolean;
    purchaseDate: string | null;
    warrantyExpiration: string | null;
  };
}

export function EquipmentForm({ equipmentId, equipment }: EquipmentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [requiresCert, setRequiresCert] = useState(equipment.requiresCertification);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("requiresCertification", requiresCert ? "true" : "false");
    startTransition(async () => {
      await updateEquipment(equipmentId, formData);
    });
  };

  return (
    <CollapsibleCard title="Equipment Details">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={equipment.name}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              defaultValue={equipment.category ?? ""}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={equipment.description ?? ""}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={equipment.location ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              name="serialNumber"
              defaultValue={equipment.serialNumber ?? ""}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select name="status" defaultValue={equipment.status}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchaseDate">Purchase Date</Label>
            <Input
              id="purchaseDate"
              name="purchaseDate"
              type="date"
              defaultValue={equipment.purchaseDate ?? ""}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="warrantyExpiration">Warranty Expiration</Label>
            <Input
              id="warrantyExpiration"
              name="warrantyExpiration"
              type="date"
              defaultValue={equipment.warrantyExpiration ?? ""}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={requiresCert}
                onCheckedChange={(checked) => setRequiresCert(checked === true)}
              />
              <span>Requires certification to operate</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </CollapsibleCard>
  );
}
