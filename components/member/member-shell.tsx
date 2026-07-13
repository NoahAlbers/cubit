"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  User,
  CreditCard,
  Award,
  FileSignature,
  Bell,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CubitWordmark } from "@/components/logo";

const NAV = [
  { label: "Home", href: "/member/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/member/profile", icon: User },
  { label: "Payments", href: "/member/payments", icon: CreditCard },
  { label: "Certs", href: "/member/certifications", icon: Award },
  { label: "Waivers", href: "/member/waivers", icon: FileSignature },
  { label: "Alerts", href: "/member/preferences", icon: Bell },
];

export function MemberShell({
  firstName,
  isStaff,
  children,
}: {
  firstName: string;
  isStaff: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-brand-blue">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/member/dashboard">
            <CubitWordmark onDark />
          </Link>
          <div className="flex items-center gap-1">
            {isStaff && (
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                <ShieldCheck className="size-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        {/* Tab bar */}
        <nav className="mx-auto flex max-w-3xl overflow-x-auto px-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-white text-white"
                    : "border-transparent text-white/65 hover:text-white"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <p className="sr-only">Signed in as {firstName}</p>
        {children}
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Melbourne Makerspace · Florida, USA
      </footer>
    </div>
  );
}
