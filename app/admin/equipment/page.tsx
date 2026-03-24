import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { EquipmentListTable } from "@/components/admin/equipment-list-table";
import { Pagination } from "@/components/admin/pagination";
import { AddEquipmentDialog } from "@/components/admin/add-equipment-dialog";
import { getEquipment } from "./actions";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const category =
    typeof params.category === "string" ? params.category : undefined;
  const requiresCert =
    typeof params.requiresCert === "string"
      ? (params.requiresCert as "true" | "false")
      : undefined;
  const sortField = (
    ["name", "status", "category", "location"].includes(
      params.sortField as string
    )
      ? params.sortField
      : "name"
  ) as "name" | "status" | "category" | "location";
  const sortDirection = params.sortDirection === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(params.page as string) || 1);
  const pageSize = [25, 50, 100].includes(parseInt(params.pageSize as string))
    ? parseInt(params.pageSize as string)
    : 25;

  const { equipment, totalCount, categories } = await getEquipment({
    search,
    status,
    category,
    requiresCert,
    sortField,
    sortDirection,
    page,
    pageSize,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            {totalCount} total
          </Badge>
        </div>
        <AddEquipmentDialog />
      </div>

      <Suspense fallback={null}>
        <EquipmentListTable equipment={equipment} categories={categories} />
      </Suspense>

      <Suspense fallback={null}>
        <Pagination totalCount={totalCount} page={page} pageSize={pageSize} />
      </Suspense>
    </div>
  );
}
