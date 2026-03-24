import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/member/profile-form";

export default async function MemberProfilePage() {
  const user = await requireAuth();

  const member = await prisma.member.findUnique({
    where: { id: user.id },
    include: { role: true },
  });

  if (!member) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Member not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <ProfileForm
        member={{
          id: member.id,
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          phone: member.phone,
          picture: member.picture,
          membershipType: member.membershipType,
          status: member.status,
          joinDate: member.joinDate?.toISOString() || null,
          role: member.role.name,
          emergencyContactName: member.emergencyContactName,
          emergencyContactEmail: member.emergencyContactEmail,
          emergencyContactPhone: member.emergencyContactPhone,
        }}
      />
    </div>
  );
}
