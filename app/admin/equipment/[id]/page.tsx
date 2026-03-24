import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { EquipmentForm } from "@/components/admin/equipment-detail/equipment-form";
import { CertifiedMembers } from "@/components/admin/equipment-detail/certified-members";
import { MaintenanceLog } from "@/components/admin/equipment-detail/maintenance-log";

const STATUS_COLORS: Record<string, string> = {
  OPERATIONAL:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  MAINTENANCE:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  OUT_OF_ORDER:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  RETIRED:
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function toDateString(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().split("T")[0];
}

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("equipment.view");
  const { id } = await params;

  const [equipment, allMembers] = await Promise.all([
    prisma.equipment.findUnique({
      where: { id },
      include: {
        certifications: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
            certifiedBy: {
              select: { firstName: true, lastName: true },
            },
          },
          orderBy: { certifiedDate: "desc" },
        },
        maintenanceLogs: {
          include: {
            performedBy: {
              select: { firstName: true, lastName: true },
            },
          },
          orderBy: { maintenanceDate: "desc" },
        },
      },
    }),
    prisma.member.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  if (!equipment) {
    notFound();
  }

  // Serialize for client components
  const equipmentData = {
    name: equipment.name,
    description: equipment.description,
    location: equipment.location,
    category: equipment.category,
    serialNumber: equipment.serialNumber,
    status: equipment.status,
    requiresCertification: equipment.requiresCertification,
    purchaseDate: toDateString(equipment.purchaseDate),
    warrantyExpiration: toDateString(equipment.warrantyExpiration),
  };

  const serializedCertifications = equipment.certifications.map((c) => ({
    id: c.id,
    certifiedDate: c.certifiedDate.toISOString(),
    expirationDate: c.expirationDate?.toISOString() ?? null,
    notes: c.notes,
    member: {
      id: c.member.id,
      firstName: c.member.firstName,
      lastName: c.member.lastName,
    },
    certifiedBy: c.certifiedBy
      ? {
          firstName: c.certifiedBy.firstName,
          lastName: c.certifiedBy.lastName,
        }
      : null,
  }));

  const serializedLogs = equipment.maintenanceLogs.map((l) => ({
    id: l.id,
    maintenanceDate: l.maintenanceDate.toISOString(),
    description: l.description,
    cost: l.cost?.toString() ?? null,
    nextDueDate: l.nextDueDate?.toISOString() ?? null,
    performedBy: l.performedBy
      ? {
          firstName: l.performedBy.firstName,
          lastName: l.performedBy.lastName,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/equipment">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" data-icon="inline-start" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {equipment.name}
            </h1>
            <Badge
              variant="secondary"
              className={STATUS_COLORS[equipment.status] ?? ""}
            >
              {equipment.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {equipment.category ?? "No category"}
            {equipment.location && <> &middot; {equipment.location}</>}
            {equipment.serialNumber && (
              <> &middot; S/N: {equipment.serialNumber}</>
            )}
          </p>
        </div>
      </div>

      {/* Card Sections */}
      <div className="space-y-4">
        <EquipmentForm equipmentId={id} equipment={equipmentData} />
        <CertifiedMembers
          equipmentId={id}
          certifications={serializedCertifications}
          members={allMembers}
        />
        <MaintenanceLog equipmentId={id} logs={serializedLogs} />
      </div>
    </div>
  );
}
