"use client";

import { usePathname } from "next/navigation";
import { TabNav } from "@/components/ui/bits";

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <TabNav
      current={pathname}
      items={[
        { label: "Roles & permissions", href: "/admin/settings/roles" },
        { label: "System", href: "/admin/settings/system" },
        { label: "RFID access", href: "/admin/settings/rfid" },
      ]}
    />
  );
}
