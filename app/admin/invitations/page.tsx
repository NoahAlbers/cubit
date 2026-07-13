import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/ui/bits";
import { Card } from "@/components/ui/card";
import { InvitationList } from "./invitation-list";

export const metadata = { title: "Invitations" };
export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  await requirePermission("members.invite");

  const uninvited = await prisma.member.findMany({
    where: { passwordHash: null, status: { notIn: ["CANCELED", "ALUMNI"] } },
    orderBy: [{ lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      magicLinkExpires: true,
    },
  });

  return (
    <>
      <PageHeader
        title="INVITATIONS"
        meta={`${uninvited.length} member${uninvited.length === 1 ? "" : "s"} without portal access`}
      />
      <Card>
        {uninvited.length === 0 ? (
          <EmptyState
            title="Everyone's onboarded"
            hint="All current members have set up their portal account."
          />
        ) : (
          <InvitationList
            members={uninvited.map((m) => ({
              id: m.id,
              name: `${m.lastName}, ${m.firstName}`,
              email: m.email,
              status: m.status,
              pendingInvite:
                !!m.magicLinkExpires && m.magicLinkExpires > new Date(),
            }))}
          />
        )}
      </Card>
    </>
  );
}
