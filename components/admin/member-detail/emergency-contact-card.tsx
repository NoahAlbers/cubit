"use client";

import { useTransition } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEmergencyContact } from "@/app/admin/members/[id]/actions";

interface EmergencyContactCardProps {
  memberId: string;
  member: {
    emergencyContactName: string | null;
    emergencyContactEmail: string | null;
    emergencyContactPhone: string | null;
  };
}

export function EmergencyContactCard({ memberId, member }: EmergencyContactCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateEmergencyContact(memberId, formData);
    });
  };

  return (
    <CollapsibleCard title="Emergency Contact" defaultOpen={false}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={member.emergencyContactName ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactEmail">Email</Label>
            <Input
              id="emergencyContactEmail"
              name="emergencyContactEmail"
              type="email"
              defaultValue={member.emergencyContactEmail ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              defaultValue={member.emergencyContactPhone ?? ""}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Contact"}
          </Button>
        </div>
      </form>
    </CollapsibleCard>
  );
}
