import { notFound } from "next/navigation";
import { getRoles, getPermissions, deleteRole } from "../actions";
import { RoleForm } from "@/components/admin/role-form";
import { DeleteRoleButton } from "./delete-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RoleEditPage({ params }: Props) {
  const { id } = await params;
  const [roles, permissionGroups] = await Promise.all([
    getRoles(),
    getPermissions(),
  ]);

  const role = roles.find((r: any) => r.id === id);
  if (!role) {
    notFound();
  }

  const isSuperAdmin = role.name === "Super Admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Edit Role: {role.name}
        </h2>
        {!role.isSystem && role.memberCount === 0 && (
          <DeleteRoleButton roleId={role.id} roleName={role.name} />
        )}
        {!role.isSystem && role.memberCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Cannot delete — {role.memberCount} member(s) assigned
          </p>
        )}
        {role.isSystem && (
          <p className="text-xs text-muted-foreground">
            System role — cannot delete
          </p>
        )}
      </div>
      <RoleForm
        mode="edit"
        role={role}
        permissionGroups={permissionGroups}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
