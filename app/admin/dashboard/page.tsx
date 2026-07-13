import Link from "next/link";
import { subMonths, startOfMonth, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { formatMoney, formatDate } from "@/lib/utils";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/bits";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePermission("dashboard.view");

  const now = new Date();
  const monthStart = startOfMonth(now);

  const [
    activeCount,
    activeLastMonth,
    pastDueMembers,
    activeKeys,
    openPlans,
    revenueThisMonth,
    recentNotes,
    recentAccess,
    equipmentDown,
    requiredWaivers,
  ] = await Promise.all([
    prisma.member.count({ where: { status: "ACTIVE" } }),
    prisma.member.count({
      where: { status: "ACTIVE", createdAt: { lt: monthStart } },
    }),
    prisma.member.findMany({
      where: { status: { in: ["PAST_DUE", "SUSPENDED"] } },
      orderBy: { statusChangedAt: "asc" },
      take: 8,
    }),
    prisma.key.count({ where: { status: "ACTIVE" } }),
    prisma.memberPlan.findMany({
      where: { endDate: null, member: { status: { in: ["ACTIVE", "HOLD"] } } },
      include: { plan: true },
    }),
    prisma.transaction.aggregate({
      where: { transactionDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.memberNote.findMany({
      where: { isSystem: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { member: { select: { firstName: true, lastName: true, id: true } } },
    }),
    prisma.accessLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 8,
      include: { member: { select: { firstName: true, lastName: true } } },
    }),
    prisma.equipment.findMany({
      where: { status: { in: ["MAINTENANCE", "OUT_OF_ORDER"] } },
      take: 6,
    }),
    prisma.waiverTemplate.findMany({
      where: { isRequired: true, isActive: true },
      select: { id: true },
    }),
  ]);

  const mrr = openPlans.reduce((sum, mp) => sum + Number(mp.plan.monthlyCost), 0);
  const growth = activeCount - activeLastMonth;

  // Members missing required waivers
  let missingWaiverCount = 0;
  if (requiredWaivers.length > 0) {
    const activeMembers = await prisma.member.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        waivers: {
          where: { status: "COMPLETED", waiverId: { in: requiredWaivers.map((w) => w.id) } },
          select: { waiverId: true },
        },
      },
    });
    missingWaiverCount = activeMembers.filter(
      (m) => new Set(m.waivers.map((w) => w.waiverId)).size < requiredWaivers.length
    ).length;
  }

  // 6-month revenue mini chart
  const revenueByMonth: { label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const from = startOfMonth(subMonths(now, i));
    const to = startOfMonth(subMonths(now, i - 1));
    const agg = await prisma.transaction.aggregate({
      where: { transactionDate: { gte: from, lt: to } },
      _sum: { amount: true },
    });
    revenueByMonth.push({
      label: format(from, "MMM"),
      total: Number(agg._sum.amount ?? 0),
    });
  }
  const maxRevenue = Math.max(1, ...revenueByMonth.map((r) => r.total));

  return (
    <>
      <PageHeader title="DASHBOARD" meta={format(now, "EEEE, MMMM d")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active members"
          value={activeCount}
          tone="blue"
          sub={
            growth === 0
              ? "No change this month"
              : `${growth > 0 ? "+" : ""}${growth} this month`
          }
          href="/admin/members"
        />
        <StatCard
          label="Monthly recurring"
          value={formatMoney(mrr)}
          tone="default"
          sub={`${openPlans.length} open plan${openPlans.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Collected this month"
          value={formatMoney(Number(revenueThisMonth._sum.amount ?? 0))}
          tone="green"
        />
        <StatCard
          label="Past due / suspended"
          value={pastDueMembers.length}
          tone={pastDueMembers.length > 0 ? "red" : "default"}
          href="/admin/members?status=PAST_DUE"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active keys" value={activeKeys} href="/admin/access" />
        <StatCard
          label="Missing waivers"
          value={missingWaiverCount}
          tone={missingWaiverCount > 0 ? "red" : "green"}
          href="/admin/waivers"
        />
        <StatCard
          label="Equipment down"
          value={equipmentDown.length}
          tone={equipmentDown.length > 0 ? "red" : "green"}
          href="/admin/equipment"
        />
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Revenue · 6 months
          </p>
          <div className="mt-3 flex h-12 items-end gap-1.5">
            {revenueByMonth.map((r) => (
              <div key={r.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-brand-blue/80"
                  style={{ height: `${Math.max(4, (r.total / maxRevenue) * 100)}%` }}
                  title={`${r.label}: ${formatMoney(r.total)}`}
                />
                <span className="text-[0.55rem] text-muted-foreground">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue accounts</CardTitle>
            <Link
              href="/admin/members?status=PAST_DUE"
              className="text-xs font-medium text-brand-blue hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          {pastDueMembers.length === 0 ? (
            <EmptyState title="No one is overdue" hint="Every account is current." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
                  <TH>Status</TH>
                  <TH>Since</TH>
                </TR>
              </THead>
              <TBody>
                {pastDueMembers.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <Link
                        href={`/admin/members/${m.id}`}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        {m.lastName}, {m.firstName}
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge status={m.status} />
                    </TD>
                    <TD className="text-muted-foreground">
                      {formatDate(m.statusChangedAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent door activity</CardTitle>
            <Link
              href="/admin/access"
              className="text-xs font-medium text-brand-blue hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          {recentAccess.length === 0 ? (
            <EmptyState
              title="No scans yet"
              hint="Once the RFID reader is pointed at Cubit, entries show up here."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
                  <TH>Type</TH>
                  <TH>When</TH>
                </TR>
              </THead>
              <TBody>
                {recentAccess.map((log) => (
                  <TR key={log.id}>
                    <TD className="font-medium">
                      {log.member
                        ? `${log.member.lastName}, ${log.member.firstName}`
                        : (log.serial ?? "Unknown")}
                    </TD>
                    <TD>
                      <StatusBadge status={log.accessType} />
                    </TD>
                    <TD className="text-muted-foreground">
                      {format(log.timestamp, "MMM d, h:mm a")}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          {recentNotes.length === 0 ? (
            <EmptyState title="Nothing yet" hint="Status changes and system events appear here." />
          ) : (
            <CardContent className="divide-y p-0">
              {recentNotes.map((n) => (
                <div key={n.id} className="flex items-baseline gap-3 px-5 py-2.5 text-sm">
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {format(n.createdAt, "MMM d")}
                  </span>
                  <span>
                    <Link
                      href={`/admin/members/${n.member.id}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {n.member.firstName} {n.member.lastName}
                    </Link>{" "}
                    <span className="text-muted-foreground">{n.content}</span>
                  </span>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}
