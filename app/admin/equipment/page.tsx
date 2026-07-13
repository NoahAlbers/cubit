import Link from "next/link";
import type { Prisma, EquipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { enumLabel } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/bits";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { AddEquipmentButton } from "./add-equipment-dialog";
import { EquipmentFilters } from "./equipment-filters";

export const metadata = { title: "Equipment" };
export const dynamic = "force-dynamic";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}) {
  const user = await requirePermission("equipment.view");
  const sp = await searchParams;

  const where: Prisma.EquipmentWhereInput = {};
  if (sp.q) where.name = { contains: sp.q, mode: "insensitive" };
  if (sp.status) where.status = sp.status as EquipmentStatus;
  if (sp.category) where.category = sp.category;

  const [items, categories] = await Promise.all([
    prisma.equipment.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { certifications: true } } },
    }),
    prisma.equipment.findMany({
      where: { category: { not: null } },
      distinct: ["category"],
      select: { category: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="EQUIPMENT"
        meta={`${items.length} item${items.length === 1 ? "" : "s"}`}
        actions={hasPermission(user, "equipment.manage") ? <AddEquipmentButton /> : undefined}
      />
      <Card>
        <EquipmentFilters
          categories={categories.map((c) => c.category!).filter(Boolean)}
        />
        {items.length === 0 ? (
          <EmptyState
            title="No equipment yet"
            hint="Add your machines to track status, maintenance, and member certifications."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Category</TH>
                <TH>Location</TH>
                <TH>Status</TH>
                <TH className="text-center">Cert required</TH>
                <TH className="text-center">Certified members</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <Link
                      href={`/admin/equipment/${e.id}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {e.name}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{e.category ?? "—"}</TD>
                  <TD className="text-muted-foreground">{e.location ?? "—"}</TD>
                  <TD>
                    <StatusBadge status={e.status} />
                  </TD>
                  <TD className="text-center">
                    {e.requiresCertification ? enumLabel("YES") : "—"}
                  </TD>
                  <TD className="text-center tabular-nums">{e._count.certifications}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
