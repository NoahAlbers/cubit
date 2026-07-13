import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo";

export function PageHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-xl font-bold text-brand-blue">
          {title}
        </h1>
        {meta && <span className="text-sm text-muted-foreground">{meta}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center",
        className
      )}
    >
      <LogoMark className="h-10 w-10 opacity-15 grayscale" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "blue" | "red" | "green";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-xl border bg-card p-4 shadow-card transition-colors",
        href && "hover:border-brand-blue/40"
      )}
    >
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-display text-2xl font-bold",
          tone === "blue" && "text-brand-blue",
          tone === "red" && "text-brand-red",
          tone === "green" && "text-success",
          tone === "default" && "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function TabNav({
  items,
  current,
}: {
  items: { label: string; href: string }[];
  current: string;
}) {
  return (
    <nav className="mb-6 flex gap-1 border-b">
      {items.map((item) => {
        const active =
          current === item.href || current.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
