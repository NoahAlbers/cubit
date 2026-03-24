"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createEquipment } from "@/app/admin/equipment/actions";
import { createEquipmentSchema } from "@/lib/validations/equipment";
import { Plus } from "lucide-react";

const EQUIPMENT_STATUSES = ["OPERATIONAL", "MAINTENANCE", "OUT_OF_ORDER", "RETIRED"] as const;

export function AddEquipmentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<string>("OPERATIONAL");
  const [requiresCertification, setRequiresCertification] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setLocation("");
    setCategory("");
    setSerialNumber("");
    setStatus("OPERATIONAL");
    setRequiresCertification(false);
    setErrors({});
    setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const data = {
      name,
      description: description || undefined,
      location: location || undefined,
      category: category || undefined,
      serialNumber: serialNumber || undefined,
      status,
      requiresCertification,
    };

    const validation = createEquipmentSchema.safeParse(data);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0]?.toString();
        if (field) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await createEquipment(data);
      if ("error" in result && result.error) {
        setServerError(result.error);
      } else {
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch {
      setServerError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" data-icon="inline-start" />
            Add Equipment
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Equipment</DialogTitle>
          <DialogDescription>
            Add a new piece of equipment to the inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="eq-name">Name *</Label>
            <Input
              id="eq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-description">Description</Label>
            <Textarea
              id="eq-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eq-location">Location</Label>
              <Input
                id="eq-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-category">Category</Label>
              <Input
                id="eq-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eq-serial">Serial Number</Label>
              <Input
                id="eq-serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(val) => { if (val) setStatus(val); }}
              >
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
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={requiresCertification}
              onCheckedChange={(checked) =>
                setRequiresCertification(checked === true)
              }
            />
            <span>Requires certification to operate</span>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Equipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
