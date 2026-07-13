import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { formatDate, formatMoney, enumLabel } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/bits";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function MemberPaymentsPage() {
  const user = await requireAuth();

  const transactions = await prisma.transaction.findMany({
    where: { memberId: user.id },
    orderBy: { transactionDate: "desc" },
  });
  const total = transactions.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold text-brand-blue">PAYMENTS</h1>
        <p className="text-sm text-muted-foreground">
          Lifetime total{" "}
          <span className="font-semibold text-foreground">{formatMoney(total)}</span>
        </p>
      </div>
      <Card>
        {transactions.length === 0 ? (
          <EmptyState
            title="No payments yet"
            hint="Payments synced from PayPal or recorded by staff show up here."
          />
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
                  <TD className="text-muted-foreground">{formatDate(t.transactionDate)}</TD>
                  <TD className="font-medium tabular-nums">{formatMoney(t.amount.toString())}</TD>
                  <TD className="text-muted-foreground">{enumLabel(t.method)}</TD>
                  <TD className="text-muted-foreground">{t.description ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
