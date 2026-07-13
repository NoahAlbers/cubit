import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10">
      <Logo markClassName="h-12 w-12" />
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-card sm:p-8">
        {children}
      </div>
      <p className="text-xs text-muted-foreground">
        Cubit · Melbourne Makerspace member portal
      </p>
    </div>
  );
}
