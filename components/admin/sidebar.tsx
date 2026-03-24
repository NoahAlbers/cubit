"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Users,
  Wrench,
  FileCheck,
  Mail,
  Settings,
  BarChart,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  { label: "Members", href: "/admin/members", icon: Users },
  { label: "Equipment", href: "/admin/equipment", icon: Wrench },
  { label: "Waivers", href: "/admin/waivers", icon: FileCheck },
  { label: "Invitations", href: "/admin/invitations", icon: Mail },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    children: [
      { label: "Roles", href: "/admin/settings/roles" },
      { label: "System", href: "/admin/settings/system" },
      { label: "Dashboard", href: "/admin/settings/dashboard" },
    ],
  },
  { label: "Reports", href: "/admin/reports", icon: BarChart, disabled: true },
];

function SidebarContent() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/admin/settings")
  );

  function isActive(href: string) {
    if (href === "/admin/settings") {
      return pathname.startsWith("/admin/settings");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex h-full flex-col bg-primary">
      {/* Logo */}
      <div className="flex items-baseline gap-2 px-6 py-5">
        <span className="text-xl font-bold text-white">Cubit</span>
        <span className="text-xs font-medium tracking-wide text-white/60 uppercase">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const hasChildren = item.children && item.children.length > 0;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/40 cursor-not-allowed"
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider">
                  Phase 3
                </span>
              </div>
            );
          }

          if (hasChildren) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                    active && "bg-white/15 text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {settingsOpen ? (
                    <ChevronDown className="ml-auto h-4 w-4" />
                  ) : (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </button>
                {settingsOpen && (
                  <div className="mt-1 ml-4 space-y-1 border-l border-white/20 pl-4">
                    {item.children!.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white",
                          isActive(child.href) && "bg-white/15 text-white"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                active && "bg-white/15 text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

interface SidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar — rendered inline by parent */}
      <div className="hidden lg:flex lg:h-full lg:flex-col">
        <SidebarContent />
      </div>

      {/* Mobile sidebar — Sheet drawer */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-64 p-0 border-none bg-primary"
        >
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
