import { PageHeader } from "@/components/ui/bits";
import { SettingsTabs } from "./settings-tabs";

export const metadata = { title: "Settings" };

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title="SETTINGS" />
      <SettingsTabs />
      {children}
    </>
  );
}
