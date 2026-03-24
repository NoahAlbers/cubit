import { getPermissions } from "../actions";
import { RoleForm } from "@/components/admin/role-form";

export default async function NewRolePage() {
  const permissionGroups = await getPermissions();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Create Role</h2>
      <RoleForm mode="create" permissionGroups={permissionGroups} />
    </div>
  );
}
