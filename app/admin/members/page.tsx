import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { MemberFilters } from "@/components/admin/member-filters";
import { MemberListTable } from "@/components/admin/member-list-table";
import { Pagination } from "@/components/admin/pagination";
import { AddMemberDialog } from "@/components/admin/add-member-dialog";
import { getMembers, getRoles } from "./actions";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : undefined;
  const status = params.status
    ? Array.isArray(params.status)
      ? params.status
      : [params.status]
    : undefined;
  const membershipType = params.membershipType
    ? Array.isArray(params.membershipType)
      ? params.membershipType
      : [params.membershipType]
    : undefined;
  const showInactive = params.showInactive === "true";
  const sortField = (
    ["name", "joinDate", "status", "lastLoginAt"].includes(
      params.sortField as string
    )
      ? params.sortField
      : "name"
  ) as "name" | "joinDate" | "status" | "lastLoginAt";
  const sortDirection = params.sortDirection === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(params.page as string) || 1);
  const pageSize = [25, 50, 100].includes(parseInt(params.pageSize as string))
    ? parseInt(params.pageSize as string)
    : 25;

  const [{ members, totalCount, totalActive }, roles] = await Promise.all([
    getMembers({
      search,
      status,
      membershipType,
      showInactive,
      sortField,
      sortDirection,
      page,
      pageSize,
    }),
    getRoles(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            {totalActive} active
          </Badge>
        </div>
        <AddMemberDialog roles={roles} />
      </div>

      <Suspense fallback={null}>
        <MemberFilters />
      </Suspense>

      <div className="rounded-lg border">
        <Suspense fallback={null}>
          <MemberListTable members={members} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <Pagination totalCount={totalCount} page={page} pageSize={pageSize} />
      </Suspense>
    </div>
  );
}
