"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, UserPlus, X, RefreshCw, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Field,
  Input,
  Select,
  Checkbox,
  SubmitButton,
} from "@/components/ui/form-controls";
import {
  linkTransaction,
  createMemberFromTransaction,
  dismissTransaction,
  restoreTransaction,
  syncNow,
  type ActionState,
} from "./actions";

export function SyncNowButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const r = await syncNow();
        setPending(false);
        if (r.ok) toast.success(r.info ?? "Sync complete");
        else toast.error(r.error ?? "Sync failed");
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Sync now
    </Button>
  );
}

export function RestoreButton({ id }: { id: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        await restoreTransaction(id);
        toast.success("Moved back to review");
      }}
    >
      <Undo2 /> Restore
    </Button>
  );
}

type Txn = {
  id: string;
  payerName: string | null;
  payerEmail: string | null;
  amount: string;
};

export function UnmatchedRowActions({
  transaction,
  members,
}: {
  transaction: Txn;
  members: { id: string; label: string }[];
}) {
  const [mode, setMode] = useState<null | "link" | "create" | "dismiss">(null);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button size="sm" variant="secondary" onClick={() => setMode("link")}>
        <Link2 /> Link
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setMode("create")}>
        <UserPlus /> New member
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setMode("dismiss")}>
        <X /> Dismiss
      </Button>

      {mode === "link" && (
        <LinkDialog transaction={transaction} members={members} onClose={() => setMode(null)} />
      )}
      {mode === "create" && (
        <CreateDialog transaction={transaction} onClose={() => setMode(null)} />
      )}
      {mode === "dismiss" && (
        <DismissDialog transaction={transaction} onClose={() => setMode(null)} />
      )}
    </div>
  );
}

function LinkDialog({
  transaction,
  members,
  onClose,
}: {
  transaction: Txn;
  members: { id: string; label: string }[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q
      ? members.filter((m) => m.label.toLowerCase().includes(q))
      : members;
  }, [members, query]);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Link payment to a member"
      description={`${transaction.payerName ?? transaction.payerEmail ?? "Unknown payer"} · $${transaction.amount}`}
    >
      <div className="space-y-4">
        <Field label="Search members" htmlFor="link-search">
          <Input
            id="link-search"
            placeholder="Type a name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Field label="Member" htmlFor="link-member">
          <Select
            id="link-member"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            size={Math.min(6, Math.max(2, filtered.length))}
            className="h-auto"
          >
            {filtered.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        {transaction.payerEmail && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Save {transaction.payerEmail} as this member&apos;s PayPal email for
            future auto-matching
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!memberId || pending}
            onClick={async () => {
              setPending(true);
              const r = await linkTransaction(transaction.id, memberId, remember);
              setPending(false);
              if (r.ok) {
                toast.success("Payment linked");
                onClose();
              } else toast.error(r.error ?? "Failed");
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            Link payment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CreateDialog({
  transaction,
  onClose,
}: {
  transaction: Txn;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await createMemberFromTransaction(transaction.id, prev, fd);
      if (r.ok) {
        toast.success("Member created and payment linked");
        onClose();
      }
      return r;
    },
    {}
  );

  const [first = "", ...rest] = (transaction.payerName ?? "").split(" ");

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Create member from payment"
      description="Creates an Active member with this payment attached."
    >
      <form action={action} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="pp-first">
            <Input id="pp-first" name="firstName" defaultValue={first} required />
          </Field>
          <Field label="Last name" htmlFor="pp-last">
            <Input id="pp-last" name="lastName" defaultValue={rest.join(" ")} required />
          </Field>
        </div>
        <Field label="Email" htmlFor="pp-email">
          <Input
            id="pp-email"
            name="email"
            type="email"
            defaultValue={transaction.payerEmail ?? ""}
            required
          />
        </Field>
        {state.error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
            {state.error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton>Create &amp; link</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

function DismissDialog({
  transaction,
  onClose,
}: {
  transaction: Txn;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Dismiss this payment?"
      description="Use for payments that aren't membership dues — donations, shop sales, event fees."
    >
      <div className="space-y-4">
        <Field label="Reason" htmlFor="dismiss-reason">
          <Input
            id="dismiss-reason"
            placeholder="e.g. Donation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await dismissTransaction(transaction.id, reason);
              toast.success("Dismissed");
              onClose();
            }}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
