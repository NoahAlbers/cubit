"use client";

import { useState, useTransition } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addMemberPlan, endMemberPlan } from "@/app/admin/members/[id]/actions";

interface PlansCardProps {
  memberId: string;
  memberPlans: {
    id: string;
    startDate: string;
    endDate: string | null;
    plan: { id: string; name: string; monthlyCost: string };
  }[];
  availablePlans: { id: string; name: string; monthlyCost: string }[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export function PlansCard({ memberId, memberPlans, availablePlans }: PlansCardProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const hasOpenPlan = memberPlans.some((p) => !p.endDate);

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    startTransition(async () => {
      const result = await addMemberPlan(memberId, selectedPlanId, startDate);
      if (result?.success) {
        setSelectedPlanId("");
      }
    });
  };

  const handleEndPlan = (memberPlanId: string) => {
    startTransition(async () => {
      await endMemberPlan(memberPlanId, new Date().toISOString().split("T")[0]);
    });
  };

  return (
    <CollapsibleCard
      title="Plans"
      badge={
        <Badge variant="secondary">{memberPlans.length} plan{memberPlans.length !== 1 ? "s" : ""}</Badge>
      }
    >
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Monthly Cost</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No plans assigned
                </TableCell>
              </TableRow>
            ) : (
              memberPlans.map((mp) => (
                <TableRow key={mp.id}>
                  <TableCell className="font-medium">
                    {mp.plan.name}
                    {!mp.endDate && (
                      <Badge
                        variant="secondary"
                        className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      >
                        Current
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>${mp.plan.monthlyCost}</TableCell>
                  <TableCell>{formatDate(mp.startDate)}</TableCell>
                  <TableCell>{formatDate(mp.endDate)}</TableCell>
                  <TableCell>
                    {!mp.endDate && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleEndPlan(mp.id)}
                      >
                        End Plan
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Add Plan Form */}
        <form onSubmit={handleAddPlan} className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label>Plan</Label>
            <Select
              value={selectedPlanId}
              onValueChange={(val) => setSelectedPlanId(val ?? "")}
              disabled={hasOpenPlan}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={hasOpenPlan ? "End current plan first" : "Select a plan"} />
              </SelectTrigger>
              <SelectContent>
                {availablePlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} (${plan.monthlyCost}/mo)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={hasOpenPlan}
            />
          </div>
          <Button type="submit" disabled={isPending || hasOpenPlan || !selectedPlanId}>
            {isPending ? "Adding..." : "Add Plan"}
          </Button>
        </form>
      </div>
    </CollapsibleCard>
  );
}
