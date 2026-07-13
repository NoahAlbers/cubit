import { cn, enumLabel } from "@/lib/utils";
import { badgeVariants, type BadgeVariantProps } from "./variants";

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & BadgeVariantProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

const STATUS_COLORS: Record<string, BadgeVariantProps["variant"]> = {
  // member statuses
  PROSPECTIVE: "blue",
  ACTIVE: "green",
  HOLD: "yellow",
  PAST_DUE: "yellow",
  SUSPENDED: "red",
  CANCELED: "red",
  ALUMNI: "default",
  // key statuses
  INACTIVE: "default",
  LOST: "red",
  RETURNED: "default",
  // equipment
  OPERATIONAL: "green",
  MAINTENANCE: "yellow",
  OUT_OF_ORDER: "red",
  RETIRED: "default",
  // waivers
  PENDING: "yellow",
  COMPLETED: "green",
  EXPIRED: "red",
  // notifications
  QUEUED: "blue",
  SENT: "green",
  FAILED: "red",
  // access
  ENTRY: "green",
  EXIT: "blue",
  DENIED: "red",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_COLORS[status] ?? "default"} className={className}>
      {enumLabel(status)}
    </Badge>
  );
}
