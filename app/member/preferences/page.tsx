import { getPreferences } from "./actions";
import { NotificationPreferences } from "@/components/member/notification-preferences";

export default async function MemberPreferencesPage() {
  const preferences = await getPreferences();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Preferences</h1>
      <NotificationPreferences preferences={preferences} />
    </div>
  );
}
