"use client";

import { useEffect, useState } from "react";
import { getWaiverCompliance } from "@/app/admin/waivers/actions";
import type { WaiverComplianceItem } from "@/app/admin/waivers/actions";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface WaiverComplianceProps {
  waiverId: string;
}

export function WaiverCompliance({ waiverId }: WaiverComplianceProps) {
  const [compliance, setCompliance] = useState<WaiverComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getWaiverCompliance(waiverId)
      .then((result) => {
        if (!cancelled) {
          setCompliance(result.compliance);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [waiverId]);

  if (loading) {
    return (
      <div className="px-6 py-4 text-sm text-muted-foreground">
        Loading compliance data...
      </div>
    );
  }

  if (compliance.length === 0) {
    return (
      <div className="px-6 py-4 text-sm text-muted-foreground">
        No active members found.
      </div>
    );
  }

  const completed = compliance.filter((c) => c.status === "COMPLETED");
  const pending = compliance.filter((c) => c.status !== "COMPLETED");

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center gap-4 text-sm">
        <span className="font-medium">
          Member Compliance: {completed.length}/{compliance.length}
        </span>
        <span className="text-green-600 dark:text-green-400">
          {completed.length} completed
        </span>
        <span className="text-red-600 dark:text-red-400">
          {pending.length} pending
        </span>
      </div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {compliance.map((member) => (
          <div
            key={member.memberId}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            {member.status === "COMPLETED" ? (
              <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
            ) : member.status === "PENDING" ? (
              <Clock className="size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span
              className={
                member.status === "COMPLETED"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }
            >
              {member.firstName} {member.lastName}
            </span>
            {member.status === "COMPLETED" && member.completedDate && (
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(member.completedDate).toLocaleDateString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
