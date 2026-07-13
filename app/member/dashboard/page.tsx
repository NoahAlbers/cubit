import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { formatMoney, formatDate, enumLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";

export const metadata = { title: "My Dashboard" };
export const dynamic = "force-dynamic";

export default async function MemberDashboard() {
  const user = await requireAuth();

  const member = await prisma.member.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      plans: { where: { endDate: null }, include: { plan: true } },
      keys: true,
      transactions: { orderBy: { transactionDate: "desc" }, take: 3 },
      waivers: { where: { status: "COMPLETED" }, select: { waiverId: true } },
    },
  });

  const requiredWaivers = await prisma.waiverTemplate.findMany({
    where: { isRequired: true, isActive: true },
  });
  const signedIds = new Set(member.waivers.map((w) => w.waiverId));
  const missingWaivers = requiredWaivers.filter((w) => !signedIds.has(w.id));

  const plan = member.plans[0]?.plan;
  const activeKeys = member.keys.filter((k) => k.status === "ACTIVE");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-brand-blue">
          WELCOME, {member.firstName.toUpperCase()}
        </h1>
        <StatusBadge status={member.status} />
      </div>

      {missingWaivers.length > 0 && (
        <Link
          href="/member/waivers"
          className="block rounded-xl border border-brand-red/40 bg-danger-soft px-4 py-3 text-sm font-medium text-brand-red transition-colors hover:bg-danger-soft/70"
        >
          ✍️ Action needed: sign the {missingWaivers.map((w) => w.name).join(", ")} —
          it takes about two minutes.
        </Link>
      )}

      {(member.status === "SUSPENDED" || member.status === "PAST_DUE") && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          Your membership is {enumLabel(member.status).toLowerCase()}. Bring your
          account current to restore full access — door keys reactivate
          automatically after payment.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Current plan
            </p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">
              {plan ? plan.name : "None"}
            </p>
            {plan && (
              <p className="text-sm text-muted-foreground">
                {formatMoney(plan.monthlyCost.toString())}/month
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Door access
            </p>
            <p className="mt-1 font-display text-lg font-bold">
              {activeKeys.length > 0 ? (
                <span className="text-success">Active</span>
              ) : (
                <span className="text-brand-red">No active key</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeKeys.length > 0
                ? `${activeKeys.length} key${activeKeys.length === 1 ? "" : "s"} enabled`
                : "Contact staff for a key"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
          <Link
            href="/member/payments"
            className="text-xs font-medium text-brand-blue hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {member.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {member.transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatDate(t.transactionDate)}
                    {t.description ? ` · ${t.description}` : ""}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(t.amount.toString())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
