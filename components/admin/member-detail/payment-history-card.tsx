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
import { addTransaction } from "@/app/admin/members/[id]/actions";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "CHECK", label: "Check" },
  { value: "STRIPE", label: "Stripe" },
  { value: "OTHER", label: "Other" },
] as const;

const METHOD_COLORS: Record<string, string> = {
  CASH: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PAYPAL: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  CREDIT_CARD: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  CHECK: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  STRIPE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  PAYPAL_SYNC: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  STRIPE_WEBHOOK: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
};

interface TransactionData {
  id: string;
  transactionDate: string;
  amount: string;
  description: string | null;
  method: string;
  source: string;
  confirmation: string | null;
}

interface PaymentHistoryCardProps {
  memberId: string;
  transactions: TransactionData[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString();
}

export function PaymentHistoryCard({ memberId, transactions }: PaymentHistoryCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [confirmation, setConfirmation] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const balance = transactions.reduce(
    (sum, t) => sum + parseFloat(t.amount),
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await addTransaction(memberId, {
        transactionDate: txDate,
        amount,
        method,
        confirmation: confirmation || undefined,
        description: description || undefined,
        notes: notes || undefined,
      });
      if (result?.success) {
        setAmount("");
        setConfirmation("");
        setDescription("");
        setNotes("");
        setShowForm(false);
      }
    });
  };

  return (
    <CollapsibleCard
      title="Payment History"
      badge={
        <Badge variant="secondary">
          Balance: ${balance.toFixed(2)}
        </Badge>
      }
    >
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Confirmation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No transactions
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                  <TableCell className="font-mono">
                    ${parseFloat(tx.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>{tx.description ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={METHOD_COLORS[tx.method] ?? ""}>
                      {tx.method.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={SOURCE_COLORS[tx.source] ?? ""}>
                      {tx.source.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {tx.confirmation ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {!showForm ? (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            Add Transaction
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={method} onValueChange={(val) => { if (val) setMethod(val); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Confirmation</Label>
                <Input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Transaction ID / reference"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Monthly dues, etc."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !amount}>
                {isPending ? "Adding..." : "Add Transaction"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </CollapsibleCard>
  );
}
