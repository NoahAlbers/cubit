import { getRoles } from "./actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export default async function RolesPage() {
  const roles = await getRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Roles</h2>
        <Link
          href="/admin/settings/roles/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Members</TableHead>
              <TableHead className="text-center">Permissions</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {role.name}
                    {role.isSystem && (
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {role.description || "\u2014"}
                </TableCell>
                <TableCell className="text-center">
                  {role.memberCount}
                </TableCell>
                <TableCell className="text-center">
                  {role.permissions.length}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/admin/settings/roles/${role.id}`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" })
                    )}
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No roles found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
