import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/permissions";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? homeFor(user.role) : "/login");
}
