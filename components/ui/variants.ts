import { cva, type VariantProps } from "class-variance-authority";

/** Server-safe (no "use client") so server components can compose classes. */

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-brand-blue-dark",
        secondary:
          "border-border bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-brand-red-dark",
        "destructive-outline":
          "border-destructive/40 bg-transparent text-destructive hover:bg-danger-soft",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-[0.8rem]",
        lg: "h-10 px-5",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-muted-foreground",
        blue: "border-transparent bg-info-soft text-brand-blue",
        green: "border-transparent bg-success-soft text-success",
        yellow: "border-transparent bg-warning-soft text-warning",
        red: "border-transparent bg-danger-soft text-brand-red",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export const inputVariants = cva(
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type BadgeVariantProps = VariantProps<typeof badgeVariants>;
