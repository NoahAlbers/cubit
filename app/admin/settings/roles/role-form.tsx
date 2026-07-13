"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Checkbox, SubmitButton } from "@/components/ui/form-controls";
import { createRole, updateRole, deleteRole, type ActionState } from "../actions";

type PermissionDef = { key: string; category: string; name: string };

export function RoleForm({
  roleId,
  defaults,
  permissions,
  isSystem,
  isSuperAdmin,
  memberCount,
  canManage,
}: {
  roleId?: string;
  defaults: { name: string; description: string; permissionKeys: string[] };
  permissions: PermissionDef[];
  isSystem?: boolean;
  isSuperAdmin?: boolean;
  memberCount?: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(defaults.permissionKeys));
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = roleId
        ? await updateRole(roleId, prev, fd)
        : await createRole(prev, fd);
      if (r.ok) toast.success("Role saved");
      return r;
    },
    {}
  );

  const categories = [...new Set(permissions.map((p) => p.category))];
  const readOnly = !canManage || isSuperAdmin;

  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{roleId ? "Role details" : "New role"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="role-name">
              <Input
                id="role-name"
                name="name"
                defaultValue={defaults.name}
                required
                disabled={isSystem}
              />
            </Field>
            <Field label="Description" htmlFor="role-desc">
              <Input id="role-desc" name="description" defaultValue={defaults.description} />
            </Field>
          </fieldset>
          {isSuperAdmin && (
            <p className="text-sm text-muted-foreground">
              Super Admin always has every permission — it can&apos;t be edited.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Permissions{" "}
            <span className="ml-1 font-normal text-muted-foreground">
              {isSuperAdmin ? "all" : `${selected.size} selected`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {cat}
              </p>
              <div className="space-y-1.5">
                {permissions
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        name="permissions"
                        value={p.key}
                        checked={isSuperAdmin || selected.has(p.key)}
                        disabled={readOnly}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(p.key);
                          else next.delete(p.key);
                          setSelected(next);
                        }}
                      />
                      {p.name}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {state.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-brand-red">
          {state.error}
        </p>
      )}

      {canManage && !isSuperAdmin && (
        <div className="flex justify-between gap-2">
          {roleId && !isSystem ? (
            <Button
              type="button"
              variant="destructive-outline"
              onClick={async () => {
                const r = await deleteRole(roleId);
                if (r.error) toast.error(r.error);
                else {
                  toast.success("Role deleted");
                  router.push("/admin/settings/roles");
                }
              }}
              disabled={(memberCount ?? 0) > 0}
              title={
                (memberCount ?? 0) > 0
                  ? "Reassign members before deleting"
                  : undefined
              }
            >
              Delete role
            </Button>
          ) : (
            <span />
          )}
          <SubmitButton>{roleId ? "Save role" : "Create role"}</SubmitButton>
        </div>
      )}
    </form>
  );
}
