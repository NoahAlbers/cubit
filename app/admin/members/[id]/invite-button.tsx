"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendMagicLinkInvite } from "../actions";

export function InviteButton({
  memberId,
  hasPassword,
  lastLoginAt,
}: {
  memberId: string;
  hasPassword: boolean;
  lastLoginAt: string | null;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {!hasPassword && !lastLoginAt && (
        <span className="text-xs text-muted-foreground">Never logged in</span>
      )}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const r = await sendMagicLinkInvite(memberId);
          setPending(false);
          if (r.ok) toast.success("Invitation sent");
          else toast.error(r.error ?? "Failed to send");
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Mail />}
        {hasPassword ? "Send sign-in link" : "Send invitation"}
      </Button>
    </div>
  );
}
