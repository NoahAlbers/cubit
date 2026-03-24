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
import { addEquipmentCertification } from "@/app/admin/equipment/[id]/actions";

interface CertificationData {
  id: string;
  certifiedDate: string;
  expirationDate: string | null;
  notes: string | null;
  member: { id: string; firstName: string; lastName: string };
  certifiedBy: { firstName: string; lastName: string } | null;
}

interface MemberOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface CertifiedMembersProps {
  equipmentId: string;
  certifications: CertificationData[];
  members: MemberOption[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export function CertifiedMembers({
  equipmentId,
  certifications,
  members,
}: CertifiedMembersProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [certDate, setCertDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  // Filter out already-certified members
  const certifiedMemberIds = new Set(certifications.map((c) => c.member.id));
  const availableMembers = members.filter((m) => !certifiedMemberIds.has(m.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    startTransition(async () => {
      const result = await addEquipmentCertification(equipmentId, {
        memberId,
        certifiedDate: certDate,
        notes: notes || undefined,
      });
      if (result?.success) {
        setMemberId("");
        setNotes("");
        setShowForm(false);
      }
    });
  };

  return (
    <CollapsibleCard
      title="Certified Members"
      badge={<Badge variant="secondary">{certifications.length}</Badge>}
      defaultOpen={false}
    >
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Certified Date</TableHead>
              <TableHead>Certified By</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certifications.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No certified members
                </TableCell>
              </TableRow>
            ) : (
              certifications.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-medium">
                    {cert.member.firstName} {cert.member.lastName}
                  </TableCell>
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
            disabled={availableMembers.length === 0}
          >
            {availableMembers.length === 0
              ? "All members certified"
              : "Add Certification"}
          </Button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-lg border p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Member</Label>
                <Select
                  value={memberId}
                  onValueChange={(val) => setMemberId(val ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !memberId}>
                {isPending ? "Adding..." : "Add Certification"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </CollapsibleCard>
  );
}
