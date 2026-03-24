import { getDashboardConfig } from "./actions";
import { DashboardConfigForm } from "@/components/admin/dashboard-config-form";

export default async function DashboardConfigPage() {
  const widgets = await getDashboardConfig();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Dashboard Configuration</h2>
      <DashboardConfigForm initialWidgets={widgets} />
    </div>
  );
}
