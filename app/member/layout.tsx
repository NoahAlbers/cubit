import { requireAuth } from "@/lib/permissions";
import { MemberHeader } from "@/components/member/member-header";
import { MemberNav } from "@/components/member/member-nav";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="flex min-h-screen flex-col bg-brand-white">
      <MemberHeader firstName={user.name || "Member"} />
      <MemberNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 lg:pb-6">
        {children}
      </main>
    </div>
  );
}
