import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ProfileCard } from "@/components/admin/member-detail/profile-card";
import { EmergencyContactCard } from "@/components/admin/member-detail/emergency-contact-card";
import { StatusCard } from "@/components/admin/member-detail/status-card";
import { PlansCard } from "@/components/admin/member-detail/plans-card";
import { KeysCard } from "@/components/admin/member-detail/keys-card";
import { PaymentHistoryCard } from "@/components/admin/member-detail/payment-history-card";
import { NotesCard } from "@/components/admin/member-detail/notes-card";
import { WaiversCard } from "@/components/admin/member-detail/waivers-card";
import { CertificationsCard } from "@/components/admin/member-detail/certifications-card";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  PAST_DUE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  PROSPECTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ALUMNI: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function toDateString(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().split("T")[0];
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("members.view");
  const { id } = await params;

  const [member, activePlans, certEquipment, waiverTemplates] = await Promise.all([
    prisma.member.findUnique({
      where: { id },
      include: {
        role: true,
        plans: { include: { plan: true }, orderBy: { startDate: "desc" } },
        keys: { orderBy: { createdAt: "desc" } },
        transactions: { orderBy: { transactionDate: "desc" } },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
        waivers: { include: { waiver: true } },
        certifications: { include: { equipment: true, certifiedBy: true } },
      },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.equipment.findMany({
      where: { requiresCertification: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.waiverTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!member) {
    notFound();
  }

  // Find current active plan for keys included count
  const currentPlan = member.plans.find((p) => !p.endDate);
  const keysIncluded = currentPlan?.plan.keysIncluded ?? 0;

  // Serialize data for client components
  const profileData = {
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: member.phone,
    paypalEmail: member.paypalEmail,
    membershipType: member.membershipType,
    dateOfBirth: toDateString(member.dateOfBirth),
    joinDate: toDateString(member.joinDate),
    picture: member.picture,
  };

  const emergencyData = {
    emergencyContactName: member.emergencyContactName,
    emergencyContactEmail: member.emergencyContactEmail,
    emergencyContactPhone: member.emergencyContactPhone,
  };

  const serializedPlans = member.plans.map((mp) => ({
    id: mp.id,
    startDate: mp.startDate.toISOString(),
    endDate: mp.endDate?.toISOString() ?? null,
    plan: {
      id: mp.plan.id,
      name: mp.plan.name,
      monthlyCost: mp.plan.monthlyCost.toString(),
    },
  }));

  const serializedAvailablePlans = activePlans.map((p) => ({
    id: p.id,
    name: p.name,
    monthlyCost: p.monthlyCost.toString(),
  }));

  const serializedKeys = member.keys.map((k) => ({
    id: k.id,
    serialNumber: k.serialNumber,
    type: k.type,
    status: k.status,
    assignedDate: k.assignedDate?.toISOString() ?? null,
  }));

  const serializedTransactions = member.transactions.map((t) => ({
    id: t.id,
    transactionDate: t.transactionDate.toISOString(),
    amount: t.amount.toString(),
    description: t.description,
    method: t.method,
    source: t.source,
    confirmation: t.confirmation,
  }));

  const serializedNotes = member.notes.map((n) => ({
    id: n.id,
    content: n.content,
    isPinned: n.isPinned,
    isSystem: n.isSystem,
    createdAt: n.createdAt.toISOString(),
    author: {
      firstName: n.author.firstName,
      lastName: n.author.lastName,
    },
  }));

  const serializedMemberWaivers = member.waivers.map((w) => ({
    waiverId: w.waiverId,
    status: w.status,
    completedDate: w.completedDate?.toISOString() ?? null,
  }));

  const serializedWaiverTemplates = waiverTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    isRequired: t.isRequired,
  }));

  const serializedCertifications = member.certifications.map((c) => ({
    id: c.id,
    certifiedDate: c.certifiedDate.toISOString(),
    expirationDate: c.expirationDate?.toISOString() ?? null,
    notes: c.notes,
    equipment: { id: c.equipment.id, name: c.equipment.name },
    certifiedBy: c.certifiedBy
      ? { firstName: c.certifiedBy.firstName, lastName: c.certifiedBy.lastName }
      : null,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/members">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" data-icon="inline-start" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {member.firstName} {member.lastName}
            </h1>
            <Badge
              variant="secondary"
              className={STATUS_COLORS[member.status] ?? ""}
            >
              {member.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {member.email} &middot; {member.role.name} &middot;{" "}
            {member.membershipType}
          </p>
        </div>
      </div>

      {/* Card Sections */}
      <div className="space-y-4">
        <ProfileCard memberId={id} member={profileData} />
        <EmergencyContactCard memberId={id} member={emergencyData} />
        <StatusCard
          memberId={id}
          status={member.status}
          statusReason={member.statusReason}
        />
        <PlansCard
          memberId={id}
          memberPlans={serializedPlans}
          availablePlans={serializedAvailablePlans}
        />
        <KeysCard
          memberId={id}
          keys={serializedKeys}
          keysIncluded={keysIncluded}
        />
        <PaymentHistoryCard
          memberId={id}
          transactions={serializedTransactions}
        />
        <NotesCard memberId={id} notes={serializedNotes} />
        <WaiversCard
          memberId={id}
          waiverTemplates={serializedWaiverTemplates}
          memberWaivers={serializedMemberWaivers}
        />
        <CertificationsCard
          memberId={id}
          certifications={serializedCertifications}
          equipmentOptions={certEquipment}
        />
      </div>
    </div>
  );
}
