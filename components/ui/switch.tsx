"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: BaseSwitch.Root.Props & { className?: string }) {
  return (
    <BaseSwitch.Root
      className={cn(
        "relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 data-[checked]:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <BaseSwitch.Thumb className="inline-block size-4.5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[checked]:translate-x-5" />
    </BaseSwitch.Root>
  );
}
