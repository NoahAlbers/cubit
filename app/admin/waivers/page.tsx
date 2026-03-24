import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { WaiverTemplateList } from "@/components/admin/waiver-template-list";
import { AddWaiverDialog } from "@/components/admin/add-waiver-dialog";
import { getWaiverTemplates } from "./actions";

export default async function WaiversPage() {
  const { templates } = await getWaiverTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Waivers</h1>
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            {templates.length} templates
          </Badge>
        </div>
        <AddWaiverDialog />
      </div>

      <Suspense fallback={null}>
        <WaiverTemplateList templates={templates} />
      </Suspense>
    </div>
  );
}
