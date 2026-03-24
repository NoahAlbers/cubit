"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  createRole,
  updateRole,
  type RoleItem,
  type PermissionGroup,
} from "@/app/admin/settings/roles/actions";
import { Loader2 } from "lucide-react";

interface RoleFormProps {
  mode: "create" | "edit";
  role?: RoleItem;
  permissionGroups: PermissionGroup;
  isSuperAdmin?: boolean;
}

export function RoleForm({
  mode,
  role,
  permissionGroups,
  isSuperAdmin = false,
}: RoleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    () => new Set(role?.permissions.map((p) => p.id) ?? [])
  );

  const isSystemRole = role?.isSystem ?? false;
  const isDisabled = isSuperAdmin || (isSystemRole && role?.name === "Member");

  // All permission IDs flat
  const allPermissionIds = useMemo(() => {
    const ids: string[] = [];
    for (const perms of Object.values(permissionGroups)) {
      for (const p of perms) {
        ids.push(p.id);
      }
    }
    return ids;
  }, [permissionGroups]);

  function togglePermission(id: string) {
    if (isDisabled) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleCategory(category: string) {
    if (isDisabled) return;
    const categoryPerms = permissionGroups[category] ?? [];
    const allSelected = categoryPerms.every((p) =>
      selectedPermissions.has(p.id)
    );

    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      for (const p of categoryPerms) {
        if (allSelected) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      }
      return next;
    });
  }

  // Build preview summary
  const previewSummary = useMemo(() => {
    const actions: string[] = [];
    for (const perms of Object.values(permissionGroups)) {
      for (const p of perms) {
        if (isSuperAdmin || selectedPermissions.has(p.id)) {
          actions.push(p.name.toLowerCase());
        }
      }
    }
    if (actions.length === 0) return "This role has no permissions.";
    if (actions.length === allPermissionIds.length)
      return "This role has all permissions.";
    return `This role can: ${actions.slice(0, 8).join(", ")}${actions.length > 8 ? `, and ${actions.length - 8} more` : ""}`;
  }, [
    selectedPermissions,
    permissionGroups,
    isSuperAdmin,
    allPermissionIds.length,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name,
      description: description || undefined,
      permissionIds: Array.from(selectedPermissions),
    };

    try {
      const result =
        mode === "create"
          ? await createRole(payload)
          : await updateRole(role!.id, payload);

      if ("error" in result && result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      router.push("/admin/settings/roles");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Role Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSystemRole}
            required
          />
          {isSystemRole && (
            <p className="text-xs text-muted-foreground">
              System role names cannot be changed.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Permission grid */}
      <div className="space-y-6">
        <h3 className="text-sm font-semibold">Permissions</h3>

        {isSuperAdmin && (
          <p className="text-sm text-muted-foreground">
            Super Admin has all permissions and cannot be modified.
          </p>
        )}

        {isSystemRole && role?.name === "Member" && (
          <p className="text-sm text-muted-foreground">
            The Member system role cannot have its permissions modified.
          </p>
        )}

        <div className="grid gap-6">
          {Object.entries(permissionGroups).map(([category, perms]) => {
            const allSelected = perms.every((p) =>
              isSuperAdmin ? true : selectedPermissions.has(p.id)
            );
            const someSelected =
              !allSelected &&
              perms.some((p) =>
                isSuperAdmin ? true : selectedPermissions.has(p.id)
              );

            return (
              <div
                key={category}
                className="rounded-lg border p-4"
              >
                <div className="mb-3 flex items-center gap-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => toggleCategory(category)}
                    disabled={isDisabled}
                    aria-label={`Select all ${category}`}
                  />
                  <span className="text-sm font-semibold capitalize">
                    {category}
                  </span>
                  {someSelected && (
                    <Badge variant="secondary" className="text-xs">
                      Partial
                    </Badge>
                  )}
                </div>

                <div className="ml-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {perms.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-start gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={
                          isSuperAdmin || selectedPermissions.has(perm.id)
                        }
                        onCheckedChange={() => togglePermission(perm.id)}
                        disabled={isDisabled}
                      />
                      <div className="space-y-0.5">
                        <span className="text-sm">{perm.name}</span>
                        {perm.description && (
                          <p className="text-xs text-muted-foreground">
                            {perm.description}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview summary */}
      <div className="rounded-md bg-muted px-4 py-3">
        <p className="text-sm text-muted-foreground">{previewSummary}</p>
      </div>

      {/* Actions */}
      {!isDisabled && (
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Role" : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/settings/roles")}
          >
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
}
