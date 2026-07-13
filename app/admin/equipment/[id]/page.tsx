import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EquipmentForm, MaintenanceForm } from "./equipment-forms";

export const dynamic = "force-dynamic";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("equipment.view");
  const { id } = await params;

  const eq = await prisma.equipment.findUnique({
    where: { id },
    include: {
      certifications: {
        include: {
          member: { select: { id: true, firstName: true, lastName: true } },
          certifiedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { certifiedDate: "desc" },
      },
      maintenanceLogs: {
        include: { performedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { maintenanceDate: "desc" },
      },
    },
  });
  if (!eq) notFound();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-bold text-brand-blue">
          {eq.name.toUpperCase()}
        </h1>
        <StatusBadge status={eq.status} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <EquipmentForm
              equipmentId={eq.id}
              defaults={{
                name: eq.name,
                description: eq.description ?? "",
                location: eq.location ?? "",
                category: eq.category ?? "",
                serialNumber: eq.serialNumber ?? "",
                status: eq.status,
                requiresCertification: eq.requiresCertification,
              }}
              canEdit={hasPermission(user, "equipment.manage")}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Certified members{" "}
                <span className="ml-1 font-normal text-muted-foreground">
                  {eq.certifications.length}
                </span>
              </CardTitle>
            </CardHeader>
            {eq.certifications.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No certifications yet. Grant them from a member&apos;s profile.
                </p>
              </CardContent>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Member</TH>
                    <TH>Date</TH>
                    <TH>Certified by</TH>
                  </TR>
                </THead>
                <TBody>
                  {eq.certifications.map((c) => (
                    <TR key={c.id}>
                      <TD>
                        <Link
                          href={`/admin/members/${c.member.id}`}
                          className="font-medium text-brand-blue hover:underline"
                        >
                          {c.member.lastName}, {c.member.firstName}
                        </Link>
                      </TD>
                      <TD className="text-muted-foreground">{formatDate(c.certifiedDate)}</TD>
                      <TD className="text-muted-foreground">
                        {c.certifiedBy
                          ? `${c.certifiedBy.firstName} ${c.certifiedBy.lastName}`
                          : "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maintenance log</CardTitle>
            </CardHeader>
            {hasPermission(user, "equipment.maintenance") && (
              <CardContent className="border-b">
                <MaintenanceForm equipmentId={eq.id} />
              </CardContent>
            )}
            {eq.maintenanceLogs.length === 0 ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">No maintenance recorded.</p>
              </CardContent>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Work</TH>
                    <TH>By</TH>
                    <TH>Cost</TH>
                    <TH>Next due</TH>
                  </TR>
                </THead>
                <TBody>
                  {eq.maintenanceLogs.map((m) => (
                    <TR key={m.id}>
                      <TD className="text-muted-foreground">{formatDate(m.maintenanceDate)}</TD>
                      <TD>{m.description}</TD>
                      <TD className="text-muted-foreground">
                        {m.performedBy
                          ? `${m.performedBy.firstName} ${m.performedBy.lastName}`
                          : "—"}
                      </TD>
                      <TD className="text-muted-foreground">
                        {m.cost ? formatMoney(m.cost.toString()) : "—"}
                      </TD>
                      <TD className="text-muted-foreground">
                        {m.nextDueDate ? formatDate(m.nextDueDate) : "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
