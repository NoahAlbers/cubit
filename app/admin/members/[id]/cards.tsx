"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { formatDate, formatMoney, enumLabel } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  Field,
  Input,
  Select,
  Textarea,
  SubmitButton,
} from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/dialog";
import {
  updateMemberProfile,
  changeMemberStatus,
  assignPlan,
  endPlan,
  addKey,
  setKeyStatus,
  deleteKey,
  addTransaction,
  addNote,
  toggleNotePin,
  markWaiverComplete,
  addCertification,
  removeCertification,
  type ActionState,
} from "../actions";

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
      {error}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Profile + emergency contact
// ---------------------------------------------------------------------------

export function ProfileCard({
  memberId,
  defaults,
  canEdit,
}: {
  memberId: string;
  defaults: Record<string, string>;
  canEdit: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await updateMemberProfile(memberId, prev, fd);
      if (r.ok) toast.success("Profile saved");
      return r;
    },
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <fieldset disabled={!canEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" htmlFor="firstName">
                <Input id="firstName" name="firstName" defaultValue={defaults.firstName} required />
              </Field>
              <Field label="Last name" htmlFor="lastName">
                <Input id="lastName" name="lastName" defaultValue={defaults.lastName} required />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" defaultValue={defaults.email} required />
              </Field>
              <Field label="Phone" htmlFor="phone">
                <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="PayPal email" htmlFor="paypalEmail" hint="Used to match PayPal payments.">
                <Input id="paypalEmail" name="paypalEmail" type="email" defaultValue={defaults.paypalEmail} />
              </Field>
              <Field label="Membership type" htmlFor="membershipType">
                <Select id="membershipType" name="membershipType" defaultValue={defaults.membershipType}>
                  <option value="STANDARD">Standard</option>
                  <option value="STUDENT">Student</option>
                  <option value="SCHOLARSHIP">Scholarship</option>
                  <option value="SPONSORSHIP">Sponsorship</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth" htmlFor="dateOfBirth">
                <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={defaults.dateOfBirth} />
              </Field>
              <Field label="Join date" htmlFor="joinDate">
                <Input id="joinDate" name="joinDate" type="date" defaultValue={defaults.joinDate} />
              </Field>
            </div>

            <p className="pt-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Emergency contact
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Name" htmlFor="emergencyContactName">
                <Input id="emergencyContactName" name="emergencyContactName" defaultValue={defaults.emergencyContactName} />
              </Field>
              <Field label="Email" htmlFor="emergencyContactEmail">
                <Input id="emergencyContactEmail" name="emergencyContactEmail" type="email" defaultValue={defaults.emergencyContactEmail} />
              </Field>
              <Field label="Phone" htmlFor="emergencyContactPhone">
                <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" defaultValue={defaults.emergencyContactPhone} />
              </Field>
            </div>
          </fieldset>
          <ErrorNote error={state.error} />
          {canEdit && (
            <div className="flex justify-end">
              <SubmitButton>Save profile</SubmitButton>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const STATUSES = ["PROSPECTIVE", "ACTIVE", "HOLD", "PAST_DUE", "SUSPENDED", "CANCELED", "ALUMNI"];

export function StatusCard({
  memberId,
  current,
  reason,
  canEdit,
}: {
  memberId: string;
  current: string;
  reason: string;
  canEdit: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await changeMemberStatus(memberId, prev, fd);
      if (r.ok) toast.success("Status updated");
      return r;
    },
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
        <StatusBadge status={current} />
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <form action={action} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Change status to" htmlFor="status">
                <Select id="status" name="status" defaultValue={current}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {enumLabel(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason" htmlFor="reason">
                <Input id="reason" name="reason" defaultValue={reason} placeholder="Optional" />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Suspending or canceling deactivates keys automatically (per system
              settings) and emails the member. Changes are logged as notes.
            </p>
            <ErrorNote error={state.error} />
            <div className="flex justify-end">
              <SubmitButton variant="secondary">Update status</SubmitButton>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">{reason || "No status reason recorded."}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export function PlansCard({
  memberId,
  plans,
  availablePlans,
  canAssign,
}: {
  memberId: string;
  plans: { id: string; name: string; cost: string; startDate: string; endDate: string | null }[];
  availablePlans: { id: string; name: string; cost: string }[];
  canAssign: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await assignPlan(memberId, prev, fd);
      if (r.ok) {
        toast.success("Plan assigned");
        setAdding(false);
      }
      return r;
    },
    {}
  );
  const hasOpen = plans.some((p) => !p.endDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership plans</CardTitle>
        {canAssign && !hasOpen && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(!adding)}>
            <Plus /> Assign plan
          </Button>
        )}
      </CardHeader>
      {adding && (
        <CardContent className="border-b bg-muted/40">
          <form action={action} className="flex flex-wrap items-end gap-3">
            <Field label="Plan" htmlFor="planId" className="min-w-48 flex-1">
              <Select id="planId" name="planId" required>
                <option value="">Choose…</option>
                {availablePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.cost)}/mo
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start date" htmlFor="startDate">
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <SubmitButton size="sm">Assign</SubmitButton>
          </form>
          <ErrorNote error={state.error} />
        </CardContent>
      )}
      {plans.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">No plans yet.</p>
        </CardContent>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Plan</TH>
              <TH>Cost</TH>
              <TH>Start</TH>
              <TH>End</TH>
              {canAssign && <TH />}
            </TR>
          </THead>
          <TBody>
            {plans.map((p) => (
              <TR key={p.id}>
                <TD className="font-medium">{p.name}</TD>
                <TD>{formatMoney(p.cost)}/mo</TD>
                <TD className="text-muted-foreground">{formatDate(p.startDate)}</TD>
                <TD className="text-muted-foreground">
                  {p.endDate ? formatDate(p.endDate) : <span className="font-medium text-success">Current</span>}
                </TD>
                {canAssign && (
                  <TD className="text-right">
                    {!p.endDate && (
                      <Button
                        size="sm"
                        variant="destructive-outline"
                        onClick={async () => {
                          await endPlan(memberId, p.id);
                          toast.success("Plan ended");
                        }}
                      >
                        End plan
                      </Button>
                    )}
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export function KeysCard({
  memberId,
  keys,
  keysAllowed,
  canManage,
}: {
  memberId: string;
  keys: { id: string; serialNumber: string; type: string; status: string; assignedDate: string | null }[];
  keysAllowed: number;
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await addKey(memberId, prev, fd);
      if (r.ok) {
        toast.success("Key added");
        setAdding(false);
      }
      return r;
    },
    {}
  );
  const activeCount = keys.filter((k) => k.status === "ACTIVE").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          RFID keys{" "}
          <span className="ml-1 font-normal text-muted-foreground">
            {activeCount} of {keysAllowed || "—"} allowed
          </span>
        </CardTitle>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(!adding)}>
            <Plus /> Add key
          </Button>
        )}
      </CardHeader>
      {adding && (
        <CardContent className="border-b bg-muted/40">
          <form action={action} className="flex flex-wrap items-end gap-3">
            <Field label="Serial number" htmlFor="serialNumber" className="min-w-44 flex-1">
              <Input id="serialNumber" name="serialNumber" required placeholder="8045AB453449" />
            </Field>
            <Field label="Type" htmlFor="keyType">
              <Select id="keyType" name="type" defaultValue="fob">
                <option value="fob">Fob</option>
                <option value="card">Card</option>
              </Select>
            </Field>
            <SubmitButton size="sm">Add</SubmitButton>
          </form>
          <ErrorNote error={state.error} />
        </CardContent>
      )}
      {keys.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No keys assigned. Active keys appear on the door whitelist.
          </p>
        </CardContent>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Serial</TH>
              <TH>Type</TH>
              <TH>Status</TH>
              {canManage && <TH className="text-right">Actions</TH>}
            </TR>
          </THead>
          <TBody>
            {keys.map((k) => (
              <TR key={k.id}>
                <TD className="font-mono text-xs">{k.serialNumber}</TD>
                <TD className="text-muted-foreground capitalize">{k.type}</TD>
                <TD>
                  <StatusBadge status={k.status} />
                </TD>
                {canManage && (
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      {k.status === "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            await setKeyStatus(memberId, k.id, "INACTIVE");
                            toast.success("Key deactivated");
                          }}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            await setKeyStatus(memberId, k.id, "ACTIVE");
                            toast.success("Key activated");
                          }}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="destructive-outline"
                        aria-label={`Delete key ${k.serialNumber}`}
                        onClick={() => setConfirmDelete(k.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete key?"
        description="This removes the key record entirely. Prefer marking it Lost or Returned to keep history."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (confirmDelete) await deleteKey(memberId, confirmDelete);
              setConfirmDelete(null);
              toast.success("Key deleted");
            }}
          >
            Delete key
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export function TransactionsCard({
  memberId,
  balance,
  transactions,
  canCreate,
}: {
  memberId: string;
  balance: number;
  transactions: { id: string; amount: string; date: string; description: string | null; method: string; source: string }[];
  canCreate: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await addTransaction(memberId, prev, fd);
      if (r.ok) {
        toast.success("Transaction recorded");
        setAdding(false);
      }
      return r;
    },
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Payments{" "}
          <span className="ml-1 font-normal text-muted-foreground">
            total {formatMoney(balance)}
          </span>
        </CardTitle>
        {canCreate && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(!adding)}>
            <Plus /> Record payment
          </Button>
        )}
      </CardHeader>
      {adding && (
        <CardContent className="border-b bg-muted/40">
          <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Amount" htmlFor="amount">
              <Input id="amount" name="amount" type="number" step="0.01" required placeholder="60.00" />
            </Field>
            <Field label="Date" htmlFor="transactionDate">
              <Input
                id="transactionDate"
                name="transactionDate"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Method" htmlFor="method">
              <Select id="method" name="method" defaultValue="CASH">
                {["CASH", "PAYPAL", "CHECK", "CREDIT_CARD", "OTHER"].map((m) => (
                  <option key={m} value={m}>
                    {enumLabel(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Confirmation #" htmlFor="confirmation">
              <Input id="confirmation" name="confirmation" />
            </Field>
            <Field label="Description" htmlFor="description" className="col-span-2 sm:col-span-3">
              <Input id="description" name="description" placeholder="Monthly dues" />
            </Field>
            <div className="flex items-end">
              <SubmitButton size="sm">Record</SubmitButton>
            </div>
          </form>
          <ErrorNote error={state.error} />
          <p className="mt-2 text-xs text-muted-foreground">
            Recording a payment for a past-due or suspended member reactivates
            them automatically.
          </p>
        </CardContent>
      )}
      {transactions.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        </CardContent>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Amount</TH>
              <TH>Method</TH>
              <TH>Description</TH>
            </TR>
          </THead>
          <TBody>
            {transactions.map((t) => (
              <TR key={t.id}>
                <TD className="text-muted-foreground">{formatDate(t.date)}</TD>
                <TD className="font-medium tabular-nums">{formatMoney(t.amount)}</TD>
                <TD className="text-muted-foreground">{enumLabel(t.method)}</TD>
                <TD className="text-muted-foreground">{t.description ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function NotesCard({
  memberId,
  notes,
  canCreate,
}: {
  memberId: string;
  notes: { id: string; content: string; isPinned: boolean; isSystem: boolean; author: string; createdAt: string }[];
  canCreate: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await addNote(memberId, prev, fd);
      if (r.ok) toast.success("Note added");
      return r;
    },
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff notes</CardTitle>
      </CardHeader>
      {canCreate && (
        <CardContent className="border-b">
          <form
            action={action}
            className="flex flex-col gap-2"
          >
            <Textarea name="content" placeholder="Add a note (members never see these)…" required />
            <ErrorNote error={state.error} />
            <div className="flex justify-end">
              <SubmitButton size="sm" variant="secondary">
                Add note
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      )}
      <CardContent className="max-h-96 space-y-3 overflow-y-auto">
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              n.isSystem ? "border-dashed bg-muted/40" : "bg-card"
            } ${n.isPinned ? "border-brand-blue/50" : ""}`}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {n.author} · {formatDate(n.createdAt)}
                {n.isSystem && " · system"}
              </span>
              {!n.isSystem && canCreate && (
                <button
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label={n.isPinned ? "Unpin note" : "Pin note"}
                  onClick={() => toggleNotePin(memberId, n.id)}
                >
                  {n.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                </button>
              )}
            </div>
            <p className="whitespace-pre-wrap">{n.content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Waivers
// ---------------------------------------------------------------------------

export function WaiversCard({
  memberId,
  templates,
  signed,
  canManage,
}: {
  memberId: string;
  templates: { id: string; name: string; isRequired: boolean }[];
  signed: { waiverId: string; status: string; completedDate: string | null; signedName: string | null }[];
  canManage: boolean;
}) {
  const byId = new Map(signed.map((s) => [s.waiverId, s]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waivers</CardTitle>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH>Waiver</TH>
            <TH>Status</TH>
            <TH>Signed</TH>
            {canManage && <TH />}
          </TR>
        </THead>
        <TBody>
          {templates.map((t) => {
            const s = byId.get(t.id);
            const complete = s?.status === "COMPLETED";
            return (
              <TR key={t.id}>
                <TD className="font-medium">
                  {t.name}
                  {t.isRequired && (
                    <span className="ml-2 text-[0.65rem] font-semibold text-brand-red uppercase">
                      Required
                    </span>
                  )}
                </TD>
                <TD>
                  <StatusBadge status={s?.status ?? "PENDING"} />
                </TD>
                <TD className="text-muted-foreground">
                  {complete
                    ? `${formatDate(s!.completedDate)}${s!.signedName ? ` — ${s!.signedName}` : ""}`
                    : "—"}
                </TD>
                {canManage && (
                  <TD className="text-right">
                    {!complete && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          await markWaiverComplete(memberId, t.id);
                          toast.success("Marked complete");
                        }}
                      >
                        Mark complete
                      </Button>
                    )}
                  </TD>
                )}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

export function CertificationsCard({
  memberId,
  certifications,
  equipment,
  canCertify,
}: {
  memberId: string;
  certifications: { id: string; equipmentName: string; certifiedDate: string; certifier: string | null }[];
  equipment: { id: string; name: string }[];
  canCertify: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await addCertification(memberId, prev, fd);
      if (r.ok) {
        toast.success("Certification granted");
        setAdding(false);
      }
      return r;
    },
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment certifications</CardTitle>
        {canCertify && equipment.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(!adding)}>
            <Plus /> Certify
          </Button>
        )}
      </CardHeader>
      {adding && (
        <CardContent className="border-b bg-muted/40">
          <form action={action} className="flex flex-wrap items-end gap-3">
            <Field label="Machine" htmlFor="equipmentId" className="min-w-48 flex-1">
              <Select id="equipmentId" name="equipmentId" required>
                <option value="">Choose…</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" htmlFor="certNotes" className="min-w-40 flex-1">
              <Input id="certNotes" name="notes" placeholder="Optional" />
            </Field>
            <SubmitButton size="sm">Grant</SubmitButton>
          </form>
          <ErrorNote error={state.error} />
        </CardContent>
      )}
      {certifications.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">No certifications yet.</p>
        </CardContent>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Machine</TH>
              <TH>Certified</TH>
              <TH>By</TH>
              {canCertify && <TH />}
            </TR>
          </THead>
          <TBody>
            {certifications.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.equipmentName}</TD>
                <TD className="text-muted-foreground">{formatDate(c.certifiedDate)}</TD>
                <TD className="text-muted-foreground">{c.certifier ?? "—"}</TD>
                {canCertify && (
                  <TD className="text-right">
                    <Button
                      size="icon-sm"
                      variant="destructive-outline"
                      aria-label="Revoke certification"
                      onClick={async () => {
                        await removeCertification(memberId, c.id);
                        toast.success("Certification revoked");
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
