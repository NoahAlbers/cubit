import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";
import { paypalStatus } from "@/lib/paypal";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/bits";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { SyncNowButton, UnmatchedRowActions, RestoreButton } from "./paypal-client";

export const metadata = { title: "PayPal" };
export const dynamic = "force-dynamic";

export default async function PayPalPage() {
  const user = await requirePermission("paypal.view");
  const canManage = hasPermission(user, "paypal.manage");

  const [unmatched, recent, syncEnabled, lastSync, members] = await Promise.all([
    prisma.payPalTransaction.findMany({
      where: { status: "UNMATCHED" },
      orderBy: { transactionDate: "desc" },
    }),
    prisma.payPalTransaction.findMany({
      where: { status: { in: ["MATCHED", "DISMISSED"] } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      include: {
        matchedMember: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    getSetting<boolean>("paypal.sync_enabled", false),
    getSetting<string>("paypal.last_sync", ""),
    prisma.member.findMany({
      where: { status: { notIn: ["CANCELED", "ALUMNI"] } },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  const status = paypalStatus();

  return (
    <>
      <PageHeader
        title="PAYPAL"
        meta={`${status.mode} mode`}
        actions={canManage ? <SyncNowButton /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Credentials"
          value={status.configured ? "Configured" : "Missing"}
          tone={status.configured ? "green" : "red"}
          sub={status.configured ? undefined : "Set PAYPAL_CLIENT_ID / SECRET"}
        />
        <StatCard
          label="Webhook"
          value={status.webhookConfigured ? "Verified" : "Not set"}
          tone={status.webhookConfigured ? "green" : "red"}
          sub={
            status.webhookConfigured ? undefined : "Set PAYPAL_WEBHOOK_ID"
          }
        />
        <StatCard
          label="Scheduled sync"
          value={syncEnabled ? "On" : "Off"}
          tone={syncEnabled ? "green" : "default"}
          sub={lastSync ? `Last: ${formatDateTime(lastSync)}` : "Never run"}
        />
        <StatCard
          label="Needs review"
          value={unmatched.length}
          tone={unmatched.length > 0 ? "red" : "green"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            Unmatched transactions{" "}
            <span className="ml-1 font-normal text-muted-foreground">
              payments Cubit couldn&apos;t tie to a member
            </span>
          </CardTitle>
        </CardHeader>
        {unmatched.length === 0 ? (
          <EmptyState
            title="Nothing to review"
            hint="Every synced PayPal payment is matched to a member."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Payer</TH>
                <TH>Amount</TH>
                <TH>Transaction</TH>
                {canManage && <TH className="text-right">Resolve</TH>}
              </TR>
            </THead>
            <TBody>
              {unmatched.map((t) => (
                <TR key={t.id}>
                  <TD className="text-muted-foreground">{formatDate(t.transactionDate)}</TD>
                  <TD>
                    <span className="font-medium">{t.payerName ?? "Unknown"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.payerEmail ?? "no email"}
                    </span>
                  </TD>
                  <TD className="font-medium tabular-nums">
                    {formatMoney(t.amount.toString())}
                  </TD>
                  <TD className="font-mono text-xs text-muted-foreground">
                    {t.paypalTransactionId}
                  </TD>
                  {canManage && (
                    <TD>
                      <UnmatchedRowActions
                        transaction={{
                          id: t.id,
                          payerName: t.payerName,
                          payerEmail: t.payerEmail,
                          amount: t.amount.toString(),
                        }}
                        members={members.map((m) => ({
                          id: m.id,
                          label: `${m.lastName}, ${m.firstName} — ${m.email}`,
                        }))}
                      />
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recently processed</CardTitle>
        </CardHeader>
        {recent.length === 0 ? (
          <EmptyState
            title="No PayPal activity yet"
            hint="Payments arrive via webhook in real time, or through the 6-hour sync."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Payer</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Member</TH>
                {canManage && <TH />}
              </TR>
            </THead>
            <TBody>
              {recent.map((t) => (
                <TR key={t.id}>
                  <TD className="text-muted-foreground">{formatDate(t.transactionDate)}</TD>
                  <TD className="text-muted-foreground">
                    {t.payerName ?? t.payerEmail ?? "Unknown"}
                  </TD>
                  <TD className="tabular-nums">{formatMoney(t.amount.toString())}</TD>
                  <TD>
                    <StatusBadge status={t.status} />
                  </TD>
                  <TD>
                    {t.matchedMember ? (
                      <Link
                        href={`/admin/members/${t.matchedMember.id}`}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        {t.matchedMember.lastName}, {t.matchedMember.firstName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        {t.dismissReason ?? "—"}
                      </span>
                    )}
                  </TD>
                  {canManage && (
                    <TD className="text-right">
                      {t.status === "DISMISSED" && <RestoreButton id={t.id} />}
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
