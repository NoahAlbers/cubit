"use client";

import { useState, useTransition } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeMemberStatus } from "@/app/admin/members/[id]/actions";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  PAST_DUE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  PROSPECTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ALUMNI: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const ALL_STATUSES = [
  "PROSPECTIVE",
  "ACTIVE",
  "HOLD",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELED",
  "ALUMNI",
] as const;

interface StatusCardProps {
  memberId: string;
  status: string;
  statusReason: string | null;
}

export function StatusCard({ memberId, status, statusReason }: StatusCardProps) {
  const [isPending, startTransition] = useTransition();
  const [newStatus, setNewStatus] = useState(status);
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatus === status) return;
    startTransition(async () => {
      const result = await changeMemberStatus(memberId, newStatus, reason);
      if (result?.success) {
        setReason("");
      }
    });
  };

  return (
    <CollapsibleCard
      title="Status"
      badge={
        <Badge variant="secondary" className={STATUS_COLORS[status] ?? ""}>
          {status.replace(/_/g, " ")}
        </Badge>
      }
    >
      <div className="space-y-4">
        {statusReason && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Reason:</span> {statusReason}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(val) => { if (val) setNewStatus(val); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="statusReason">Reason for Change</Label>
            <Textarea
              id="statusReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the status is being changed..."
              rows={2}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isPending || newStatus === status}
            >
              {isPending ? "Changing..." : "Change Status"}
            </Button>
          </div>
        </form>
      </div>
    </CollapsibleCard>
  );
}
