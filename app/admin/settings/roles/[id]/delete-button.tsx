"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteRole } from "../actions";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteRoleButtonProps {
  roleId: string;
  roleName: string;
}

export function DeleteRoleButton({ roleId, roleName }: DeleteRoleButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);

    const result = await deleteRole(roleId);

    if ("error" in result && result.error) {
      setError(result.error);
      setLoading(false);
      setConfirming(false);
      return;
    }

    router.push("/admin/settings/roles");
    router.refresh();
  }

  if (!confirming) {
    return (
      <div className="space-y-1">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Role
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        Delete &quot;{roleName}&quot;?
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={loading}
      >
        {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        Confirm
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
