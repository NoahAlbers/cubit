"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  LayoutDashboard,
  Users,
  Wrench,
  FileSignature,
  DoorOpen,
  Mail,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CubitWordmark } from "@/components/logo";

export type NavKey =
  | "dashboard"
  | "members"
  | "equipment"
  | "waivers"
  | "access"
  | "paypal"
  | "invitations"
  | "reports"
  | "settings";

const NAV: { key: NavKey; label: string; href: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { key: "members", label: "Members", href: "/admin/members", icon: Users },
  { key: "equipment", label: "Equipment", href: "/admin/equipment", icon: Wrench },
  { key: "waivers", label: "Waivers", href: "/admin/waivers", icon: FileSignature },
  { key: "access", label: "Door Access", href: "/admin/access", icon: DoorOpen },
  { key: "paypal", label: "PayPal", href: "/admin/paypal", icon: Wallet },
  { key: "invitations", label: "Invitations", href: "/admin/invitations", icon: Mail },
  { key: "reports", label: "Reports", href: "/admin/reports", icon: BarChart3 },
  { key: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
];

function NavLinks({
  visible,
  onNavigate,
}: {
  visible: NavKey[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-3">
      {NAV.filter((n) => visible.includes(n.key)).map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white",
              active && "bg-white/15 text-white"
            )}
          >
            <Icon className="size-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-brand-blue">
      <div className="border-b border-white/10 px-5 py-4">
        <Link href="/admin/dashboard">
          <CubitWordmark onDark sub="Melbourne Makerspace" />
        </Link>
      </div>
      {children}
      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[0.65rem] tracking-wider text-white/40 uppercase">
          Member Management
        </p>
      </div>
    </div>
  );
}

export function AdminShell({
  userName,
  visible,
  children,
}: {
  userName: string;
  visible: NavKey[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <SidebarChrome>
          <NavLinks visible={visible} />
        </SidebarChrome>
      </aside>

      {/* Mobile drawer */}
      <BaseDialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-brand-blue-darker/40 lg:hidden" />
          <BaseDialog.Popup className="fixed inset-y-0 left-0 z-50 w-64 transition-transform data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full lg:hidden">
            <BaseDialog.Title className="sr-only">Navigation</BaseDialog.Title>
            <SidebarChrome>
              <NavLinks visible={visible} onNavigate={() => setDrawerOpen(false)} />
            </SidebarChrome>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
          <button
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <span className="hidden text-sm text-muted-foreground sm:block">
            {userName}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
