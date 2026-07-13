import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { formatDate, enumLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ProfileForm, PasswordForm } from "./profile-forms";

export const metadata = { title: "My Profile" };
export const dynamic = "force-dynamic";

export default async function MemberProfilePage() {
  const user = await requireAuth();
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: user.id },
    include: { role: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-brand-blue">MY PROFILE</h1>

      <Card>
        <CardContent className="flex flex-wrap gap-x-8 gap-y-2 py-4 text-sm">
          <span>
            <span className="text-muted-foreground">Status:</span>{" "}
            <StatusBadge status={member.status} />
          </span>
          <span>
            <span className="text-muted-foreground">Type:</span>{" "}
            {enumLabel(member.membershipType)}
          </span>
          <span>
            <span className="text-muted-foreground">Member since:</span>{" "}
            {formatDate(member.joinDate)}
          </span>
          <span>
            <span className="text-muted-foreground">Email:</span> {member.email}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              firstName: member.firstName,
              lastName: member.lastName,
              phone: member.phone ?? "",
              emergencyContactName: member.emergencyContactName ?? "",
              emergencyContactEmail: member.emergencyContactEmail ?? "",
              emergencyContactPhone: member.emergencyContactPhone ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
