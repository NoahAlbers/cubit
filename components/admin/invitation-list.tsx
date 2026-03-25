"use client";

import { useState, useTransition } from "react";
import {
  type UninvitedMember,
  type InvitationResults,
  sendInvitations,
} from "@/app/admin/invitations/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InvitationListProps {
  members: UninvitedMember[];
}

export function InvitationList({ members }: InvitationListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [results, setResults] = useState<InvitationResults | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected =
    members.length > 0 && selected.size === members.length;
  const someSelected = selected.size > 0 && selected.size < members.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(members.map((m) => m.id)));
    }
  }

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleInviteSelected() {
    setSendingAll(false);
    setConfirmOpen(true);
  }

  function handleInviteAll() {
    setSelected(new Set(members.map((m) => m.id)));
    setSendingAll(true);
    setConfirmOpen(true);
  }

  function handleConfirmSend() {
    const ids = sendingAll
      ? members.map((m) => m.id)
      : Array.from(selected);

    setConfirmOpen(false);

    startTransition(async () => {
      const result = await sendInvitations(ids);
      setResults(result);
      setSelected(new Set());
    });
  }

  const targetCount = sendingAll ? members.length : selected.size;

  if (members.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        All members have been invited or have already logged in.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results summary */}
      {results && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="font-medium">
            {results.sent} sent, {results.failed} failed
          </p>
          {results.errors.length > 0 && (
            <div className="space-y-1">
              {results.errors.map((err) => (
                <p key={err.memberId} className="text-sm text-destructive">
                  {err.email}: {err.error}
                </p>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResults(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleInviteAll}
          disabled={isPending}
        >
          Invite All
        </Button>
        <Button
          variant="outline"
          onClick={handleInviteSelected}
          disabled={selected.size === 0 || isPending}
        >
          Invite Selected ({selected.size})
        </Button>
        {isPending && (
          <span className="text-sm text-muted-foreground animate-pulse">
            Sending invitations...
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                    aria-label={`Select ${member.firstName} ${member.lastName}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {member.firstName} {member.lastName}
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  {new Date(member.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invitations</DialogTitle>
            <DialogDescription>
              You are about to send invitations to {targetCount}{" "}
              {targetCount === 1 ? "member" : "members"}. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSend}>
              Send {targetCount} {targetCount === 1 ? "Invitation" : "Invitations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
