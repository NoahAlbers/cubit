"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { regenerateRfidToken } from "../actions";

export function RfidTokenPanel({
  token,
  canManage,
}: {
  token: string;
  canManage: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">API token:</span>
      <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
        {visible ? token : "•".repeat(24)}
      </code>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={visible ? "Hide token" : "Show token"}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Copy token"
        onClick={async () => {
          await navigator.clipboard.writeText(token);
          toast.success("Token copied");
        }}
      >
        <Copy />
      </Button>
      {canManage && (
        <>
          <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
            <RefreshCw /> Regenerate
          </Button>
          <Dialog
            open={confirming}
            onOpenChange={setConfirming}
            title="Regenerate API token?"
            description="The door reader keeps working off its cached whitelist, but it can't fetch updates until you put the new token on the Pi."
          >
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await regenerateRfidToken();
                  setConfirming(false);
                  toast.success("Token regenerated");
                }}
              >
                Regenerate
              </Button>
            </div>
          </Dialog>
        </>
      )}
    </div>
  );
}
