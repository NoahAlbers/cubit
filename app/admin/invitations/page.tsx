import { Badge } from "@/components/ui/badge";
import { InvitationList } from "@/components/admin/invitation-list";
import { getUninvitedMembers } from "./actions";

export default async function InvitationsPage() {
  const members = await getUninvitedMembers();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Invitations</h1>
        <Badge variant="secondary">
          {members.length} uninvited
        </Badge>
      </div>

      <InvitationList members={members} />
    </div>
  );
}
