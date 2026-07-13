import { requireAuth, hasPermission } from "@/lib/permissions";
import { AdminShell, type NavKey } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  const visible: NavKey[] = [];
  if (hasPermission(user, "dashboard.view")) visible.push("dashboard");
  if (hasPermission(user, "members.view")) visible.push("members");
  if (hasPermission(user, "equipment.view")) visible.push("equipment");
  if (hasPermission(user, "waivers.view")) visible.push("waivers");
  if (hasPermission(user, "access.view")) visible.push("access");
  if (hasPermission(user, "paypal.view")) visible.push("paypal");
  if (hasPermission(user, "members.invite")) visible.push("invitations");
  if (hasPermission(user, "reports.view")) visible.push("reports");
  if (hasPermission(user, "roles.view") || hasPermission(user, "settings.view"))
    visible.push("settings");

  return (
    <AdminShell userName={user.name ?? ""} visible={visible}>
      {children}
    </AdminShell>
  );
}
