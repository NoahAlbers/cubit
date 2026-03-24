import { requireAuth } from "@/lib/permissions";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
