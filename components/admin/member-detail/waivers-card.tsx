"use client";

import { useState, useTransition } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { markWaiverComplete } from "@/app/admin/members/[id]/actions";
import { CheckCircle, Clock } from "lucide-react";

interface WaiverTemplateData {
  id: string;
  name: string;
  isRequired: boolean;
}

interface MemberWaiverData {
  waiverId: string;
  status: string;
  completedDate: string | null;
}

interface WaiversCardProps {
  memberId: string;
  waiverTemplates: WaiverTemplateData[];
  memberWaivers: MemberWaiverData[];
}

export function WaiversCard({ memberId, waiverTemplates, memberWaivers }: WaiversCardProps) {
  const [isPending, startTransition] = useTransition();
  const [completionDates, setCompletionDates] = useState<Record<string, string>>({});

  const waiverMap = new Map(
    memberWaivers.map((mw) => [mw.waiverId, mw])
  );

  const handleMarkComplete = (waiverId: string) => {
    const date = completionDates[waiverId] || new Date().toISOString().split("T")[0];
    startTransition(async () => {
      await markWaiverComplete(memberId, waiverId, date);
    });
  };

  const completedCount = waiverTemplates.filter(
    (t) => waiverMap.get(t.id)?.status === "COMPLETED"
  ).length;

  return (
    <CollapsibleCard
      title="Waivers"
      badge={
        <Badge variant="secondary">
          {completedCount}/{waiverTemplates.length}
        </Badge>
      }
      defaultOpen={false}
    >
      <div className="space-y-3">
        {waiverTemplates.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No active waiver templates
          </p>
        ) : (
          waiverTemplates.map((template) => {
            const memberWaiver = waiverMap.get(template.id);
            const isCompleted = memberWaiver?.status === "COMPLETED";

            return (
              <div
                key={template.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle className="size-5 text-green-600" />
                  ) : (
                    <Clock className="size-5 text-yellow-600" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      {template.isRequired && (
                        <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Required
                        </Badge>
                      )}
                    </div>
                    {isCompleted && memberWaiver?.completedDate && (
                      <p className="text-xs text-muted-foreground">
                        Completed: {new Date(memberWaiver.completedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {isCompleted ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  >
                    Completed
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      className="w-36"
                      value={completionDates[template.id] ?? new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setCompletionDates((prev) => ({
                          ...prev,
                          [template.id]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkComplete(template.id)}
                      disabled={isPending}
                    >
                      {isPending ? "..." : "Complete"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </CollapsibleCard>
  );
}
