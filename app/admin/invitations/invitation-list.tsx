"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { sendMagicLinkInvite } from "../members/actions";

type Row = {
  id: string;
  name: string;
  email: string;
  status: string;
  pendingInvite: boolean;
};

export function InvitationList({ members }: { members: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function sendBulk() {
    setConfirming(false);
    const ids = [...selected];
    setProgress({ done: 0, total: ids.length });
    let sent = 0;
    let failed = 0;
    for (const id of ids) {
      const r = await sendMagicLinkInvite(id);
      if (r.ok) sent++;
      else failed++;
      setProgress({ done: sent + failed, total: ids.length });
    }
    setProgress(null);
    setSelected(new Set());
    if (failed === 0) toast.success(`Sent ${sent} invitation${sent === 1 ? "" : "s"}`);
    else toast.error(`Sent ${sent}, failed ${failed} — check the Resend API key.`);
  }

  const allSelected = selected.size === members.length && members.length > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(members.map((m) => m.id)))
            }
          />
          Select all
        </label>
        <Button
          disabled={selected.size === 0 || !!progress}
          onClick={() => setConfirming(true)}
        >
          {progress ? (
            <>
              <Loader2 className="animate-spin" />
              Sending {progress.done}/{progress.total}…
            </>
          ) : (
            <>
              <Mail /> Invite selected ({selected.size})
            </>
          )}
        </Button>
      </div>
      <Table>
        <THead>
          <TR>
            <TH className="w-10" />
            <TH>Member</TH>
            <TH>Email</TH>
            <TH>Status</TH>
            <TH>Invite</TH>
          </TR>
        </THead>
        <TBody>
          {members.map((m) => (
            <TR key={m.id}>
              <TD>
                <Checkbox
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                  aria-label={`Select ${m.name}`}
                />
              </TD>
              <TD className="font-medium">{m.name}</TD>
              <TD className="text-muted-foreground">{m.email}</TD>
              <TD>
                <StatusBadge status={m.status} />
              </TD>
              <TD className="text-muted-foreground">
                {m.pendingInvite ? "Sent — not yet used" : "Never sent"}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Send ${selected.size} invitation${selected.size === 1 ? "" : "s"}?`}
        description="Each member gets a magic link (valid 24 hours) to set their password and access the portal."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button onClick={sendBulk}>Send invitations</Button>
        </div>
      </Dialog>
    </>
  );
}
