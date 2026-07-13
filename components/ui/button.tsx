"use client";

import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./variants";

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariantProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
