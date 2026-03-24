"use client";

import { useState, useTransition } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addMaintenanceLog } from "@/app/admin/equipment/[id]/actions";

interface MaintenanceEntry {
  id: string;
  maintenanceDate: string;
  description: string;
  cost: string | null;
  nextDueDate: string | null;
  performedBy: { firstName: string; lastName: string } | null;
}

interface MaintenanceLogProps {
  equipmentId: string;
  logs: MaintenanceEntry[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function formatCost(cost: string | null) {
  if (!cost) return "-";
  return `$${parseFloat(cost).toFixed(2)}`;
}

export function MaintenanceLog({ equipmentId, logs }: MaintenanceLogProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [maintenanceDate, setMaintenanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    startTransition(async () => {
      const result = await addMaintenanceLog(equipmentId, {
        maintenanceDate,
        description: description.trim(),
        cost: cost || undefined,
        nextDueDate: nextDueDate || undefined,
      });
      if (result?.success) {
        setDescription("");
        setCost("");
        setNextDueDate("");
        setShowForm(false);
      }
    });
  };

  return (
    <CollapsibleCard
      title="Maintenance Log"
      badge={<Badge variant="secondary">{logs.length}</Badge>}
      defaultOpen={false}
    >
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Next Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No maintenance records
                </TableCell>
              </TableRow>
            ) : (
              logs.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatDate(entry.maintenanceDate)}</TableCell>
                  <TableCell className="max-w-64 truncate">
                    {entry.description}
                  </TableCell>
                  <TableCell>
                    {entry.performedBy
                      ? `${entry.performedBy.firstName} ${entry.performedBy.lastName}`
                      : "-"}
                  </TableCell>
                  <TableCell>{formatCost(entry.cost)}</TableCell>
                  <TableCell>
                    {entry.nextDueDate ? (
                      <span
                        className={
                          new Date(entry.nextDueDate) < new Date()
                            ? "text-destructive"
                            : ""
                        }
                      >
                        {formatDate(entry.nextDueDate)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {!showForm ? (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            Add Entry
          </Button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-lg border p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={maintenanceDate}
                  onChange={(e) => setMaintenanceDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What maintenance was performed?"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Next Due Date</Label>
              <Input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !description.trim()}>
                {isPending ? "Adding..." : "Add Entry"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </CollapsibleCard>
  );
}
