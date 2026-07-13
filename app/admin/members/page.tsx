import Link from "next/link";
import type { Prisma, MemberStatus, MembershipType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { formatDate, enumLabel } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/bits";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { MemberFilters } from "./member-filters";
import { AddMemberButton } from "./add-member-dialog";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const SORTS: Record<string, Prisma.MemberOrderByWithRelationInput[]> = {
  name: [{ lastName: "asc" }, { firstName: "asc" }],
  joined: [{ joinDate: "desc" }],
  status: [{ status: "asc" }, { lastName: "asc" }],
  login: [{ lastLoginAt: "desc" }],
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    inactive?: string;
  }>;
}) {
  await requirePermission("members.view");
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const pageSize = [25, 50, 100].includes(parseInt(sp.pageSize ?? ""))
    ? parseInt(sp.pageSize!)
    : 25;
  const q = sp.q?.trim();
  const showInactive = sp.inactive === "1";

  const where: Prisma.MemberWhereInput = {};
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (sp.status) {
    where.status = { in: sp.status.split(",") as MemberStatus[] };
  } else if (!showInactive) {
    where.status = { notIn: ["CANCELED", "ALUMNI"] };
  }
  if (sp.type) {
    where.membershipType = { in: sp.type.split(",") as MembershipType[] };
  }

  const [members, total, activeCount] = await Promise.all([
    prisma.member.findMany({
      where,
      orderBy: SORTS[sp.sort ?? "name"] ?? SORTS.name,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        plans: { where: { endDate: null }, include: { plan: true } },
        keys: { where: { status: "ACTIVE" } },
      },
    }),
    prisma.member.count({ where }),
    prisma.member.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <>
      <PageHeader
        title="MEMBERS"
        meta={`${activeCount} active`}
        actions={<AddMemberButton />}
      />

      <Card>
        <MemberFilters />
        {members.length === 0 ? (
          <EmptyState
            title="No members match"
            hint="Try changing the search or filters."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Status</TH>
                <TH>Type</TH>
                <TH>Plan</TH>
                <TH className="text-center">Keys</TH>
                <TH>Joined</TH>
              </TR>
            </THead>
            <TBody>
              {members.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <Link
                      href={`/admin/members/${m.id}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {m.lastName}, {m.firstName}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{m.email}</TD>
                  <TD>
                    <StatusBadge status={m.status} />
                  </TD>
                  <TD className="text-muted-foreground">
                    {enumLabel(m.membershipType)}
                  </TD>
                  <TD className="text-muted-foreground">
                    {m.plans[0]?.plan.name ?? "—"}
                  </TD>
                  <TD className="text-center tabular-nums">{m.keys.length}</TD>
                  <TD className="text-muted-foreground">{formatDate(m.joinDate)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <div className="border-t">
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      </Card>
    </>
  );
}
