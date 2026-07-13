import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { StatusBadge } from "@/components/ui/badge";
import { InviteButton } from "./invite-button";
import {
  ProfileCard,
  StatusCard,
  PlansCard,
  KeysCard,
  TransactionsCard,
  NotesCard,
  WaiversCard,
  CertificationsCard,
} from "./cards";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("members.view");
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      role: true,
      plans: { include: { plan: true }, orderBy: { startDate: "desc" } },
      keys: { orderBy: { createdAt: "asc" } },
      transactions: { orderBy: { transactionDate: "desc" }, take: 50 },
      notes: {
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      waivers: { include: { waiver: true } },
      certifications: {
        include: {
          equipment: { select: { id: true, name: true } },
          certifiedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { certifiedDate: "desc" },
      },
    },
  });
  if (!member) notFound();

  const [waiverTemplates, equipment] = await Promise.all([
    prisma.waiverTemplate.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.equipment.findMany({
      where: { status: { not: "RETIRED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const openPlan = member.plans.find((p) => !p.endDate);
  const keysAllowed = openPlan?.plan.keysIncluded ?? 0;
  const balance = member.transactions.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold text-brand-blue">
            {member.firstName.toUpperCase()} {member.lastName.toUpperCase()}
          </h1>
          <StatusBadge status={member.status} />
          {member.role.name !== "Member" && (
            <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[0.7rem] font-semibold text-brand-blue uppercase">
              {member.role.name}
            </span>
          )}
        </div>
        {hasPermission(user, "members.invite") && (
          <InviteButton
            memberId={member.id}
            hasPassword={!!member.passwordHash}
            lastLoginAt={member.lastLoginAt?.toISOString() ?? null}
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <ProfileCard
            memberId={member.id}
            defaults={{
              firstName: member.firstName,
              lastName: member.lastName,
              email: member.email,
              phone: member.phone ?? "",
              paypalEmail: member.paypalEmail ?? "",
              membershipType: member.membershipType,
              dateOfBirth: member.dateOfBirth?.toISOString().slice(0, 10) ?? "",
              joinDate: member.joinDate?.toISOString().slice(0, 10) ?? "",
              emergencyContactName: member.emergencyContactName ?? "",
              emergencyContactEmail: member.emergencyContactEmail ?? "",
              emergencyContactPhone: member.emergencyContactPhone ?? "",
            }}
            canEdit={hasPermission(user, "members.edit")}
          />
          <StatusCard
            memberId={member.id}
            current={member.status}
            reason={member.statusReason ?? ""}
            canEdit={hasPermission(user, "members.edit")}
          />
          <KeysCard
            memberId={member.id}
            keysAllowed={keysAllowed}
            keys={member.keys.map((k) => ({
              id: k.id,
              serialNumber: k.serialNumber,
              type: k.type ?? "fob",
              status: k.status,
              assignedDate: k.assignedDate?.toISOString() ?? null,
            }))}
            canManage={hasPermission(user, "keys.manage")}
          />
          <WaiversCard
            memberId={member.id}
            templates={waiverTemplates.map((t) => ({
              id: t.id,
              name: t.name,
              isRequired: t.isRequired,
            }))}
            signed={member.waivers.map((w) => ({
              waiverId: w.waiverId,
              status: w.status,
              completedDate: w.completedDate?.toISOString() ?? null,
              signedName: w.signedName,
            }))}
            canManage={hasPermission(user, "waivers.manage")}
          />
          <CertificationsCard
            memberId={member.id}
            certifications={member.certifications.map((c) => ({
              id: c.id,
              equipmentName: c.equipment.name,
              certifiedDate: c.certifiedDate.toISOString(),
              certifier: c.certifiedBy
                ? `${c.certifiedBy.firstName} ${c.certifiedBy.lastName}`
                : null,
            }))}
            equipment={equipment}
            canCertify={hasPermission(user, "equipment.certify")}
          />
        </div>

        <div className="space-y-4">
          <PlansCard
            memberId={member.id}
            plans={member.plans.map((mp) => ({
              id: mp.id,
              name: mp.plan.name,
              cost: mp.plan.monthlyCost.toString(),
              startDate: mp.startDate.toISOString(),
              endDate: mp.endDate?.toISOString() ?? null,
            }))}
            availablePlans={(
              await prisma.plan.findMany({
                where: { isActive: true },
                orderBy: { monthlyCost: "asc" },
              })
            ).map((p) => ({
              id: p.id,
              name: p.name,
              cost: p.monthlyCost.toString(),
            }))}
            canAssign={hasPermission(user, "plans.assign")}
          />
          <TransactionsCard
            memberId={member.id}
            balance={balance}
            transactions={member.transactions.map((t) => ({
              id: t.id,
              amount: t.amount.toString(),
              date: t.transactionDate.toISOString(),
              description: t.description,
              method: t.method,
              source: t.source,
            }))}
            canCreate={hasPermission(user, "transactions.create")}
          />
          {hasPermission(user, "members.notes.view") && (
            <NotesCard
              memberId={member.id}
              notes={member.notes.map((n) => ({
                id: n.id,
                content: n.content,
                isPinned: n.isPinned,
                isSystem: n.isSystem,
                author: n.author
                  ? `${n.author.firstName} ${n.author.lastName}`
                  : "System",
                createdAt: n.createdAt.toISOString(),
              }))}
              canCreate={hasPermission(user, "members.notes.create")}
            />
          )}
        </div>
      </div>
    </>
  );
}
