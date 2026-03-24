"use client";

import { useState, useTransition } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { addCertification } from "@/app/admin/members/[id]/actions";

interface CertificationData {
  id: string;
  certifiedDate: string;
  expirationDate: string | null;
  notes: string | null;
  equipment: { id: string; name: string };
  certifiedBy: { firstName: string; lastName: string } | null;
}

interface EquipmentOption {
  id: string;
  name: string;
}

interface CertificationsCardProps {
  memberId: string;
  certifications: CertificationData[];
  equipmentOptions: EquipmentOption[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export function CertificationsCard({
  memberId,
  certifications,
  equipmentOptions,
}: CertificationsCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [equipmentId, setEquipmentId] = useState("");
  const [certDate, setCertDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Filter out equipment the member is already certified for
  const certifiedEquipmentIds = new Set(certifications.map((c) => c.equipment.id));
  const availableEquipment = equipmentOptions.filter(
    (eq) => !certifiedEquipmentIds.has(eq.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentId) return;
    startTransition(async () => {
      const result = await addCertification(memberId, equipmentId, certDate, notes);
      if (result?.success) {
        setEquipmentId("");
        setNotes("");
        setShowForm(false);
      }
    });
  };

  return (
    <CollapsibleCard
      title="Certifications"
      badge={<Badge variant="secondary">{certifications.length}</Badge>}
      defaultOpen={false}
    >
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment</TableHead>
              <TableHead>Certified Date</TableHead>
              <TableHead>Certified By</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No certifications
                </TableCell>
              </TableRow>
            ) : (
              certifications.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-medium">{cert.equipment.name}</TableCell>
                  <TableCell>{formatDate(cert.certifiedDate)}</TableCell>
                  <TableCell>
                    {cert.certifiedBy
                      ? `${cert.certifiedBy.firstName} ${cert.certifiedBy.lastName}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {cert.expirationDate ? (
                      <span
                        className={
                          new Date(cert.expirationDate) < new Date()
                            ? "text-destructive"
                            : ""
                        }
                      >
                        {formatDate(cert.expirationDate)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {cert.notes ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {!showForm ? (
          <Button
            variant="outline"
            onClick={() => setShowForm(true)}
            disabled={availableEquipment.length === 0}
          >
            {availableEquipment.length === 0
              ? "No equipment available"
              : "Add Certification"}
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Equipment</Label>
                <Select value={equipmentId} onValueChange={(val) => setEquipmentId(val ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEquipment.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Certified Date</Label>
                <Input
                  type="date"
                  value={certDate}
                  onChange={(e) => setCertDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !equipmentId}>
                {isPending ? "Adding..." : "Add Certification"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </CollapsibleCard>
  );
}
