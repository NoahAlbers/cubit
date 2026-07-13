import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/variants";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await requirePermission("roles.view");

  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { members: true, permissions: true } },
    },
  });

  return (
    <Card>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Create custom roles like &ldquo;Front Desk&rdquo; or
          &ldquo;Treasurer&rdquo; with exactly the permissions they need.
        </p>
        {hasPermission(user, "roles.manage") && (
          <Link
            href="/admin/settings/roles/new"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-4" /> New role
          </Link>
        )}
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Role</TH>
            <TH>Description</TH>
            <TH className="text-center">Members</TH>
            <TH className="text-center">Permissions</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {roles.map((r) => (
            <TR key={r.id}>
              <TD>
                <span className="font-medium">{r.name}</span>
                {r.isSystem && (
                  <Badge className="ml-2" variant="outline">
                    System
                  </Badge>
                )}
              </TD>
              <TD className="text-muted-foreground">{r.description ?? "—"}</TD>
              <TD className="text-center tabular-nums">{r._count.members}</TD>
              <TD className="text-center tabular-nums">
                {r.name === "Super Admin" ? "All" : r._count.permissions}
              </TD>
              <TD className="text-right">
                <Link
                  href={`/admin/settings/roles/${r.id}`}
                  className="text-sm font-medium text-brand-blue hover:underline"
                >
                  {hasPermission(user, "roles.manage") ? "Edit" : "View"}
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
