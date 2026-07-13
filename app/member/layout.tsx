import { requireAuth } from "@/lib/permissions";
import { MemberShell } from "@/components/member/member-shell";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  return (
    <MemberShell firstName={user.name?.split(" ")[0] ?? "Member"} isStaff={user.role !== "Member"}>
      {children}
    </MemberShell>
  );
}
