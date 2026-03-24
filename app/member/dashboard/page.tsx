import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  User,
  CreditCard,
  Award,
  FileCheck,
  Key,
  AlertTriangle,
} from "lucide-react";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PROSPECTIVE: "bg-blue-100 text-blue-800",
  HOLD: "bg-yellow-100 text-yellow-800",
  PAST_DUE: "bg-orange-100 text-orange-800",
  SUSPENDED: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-100 text-gray-800",
  ALUMNI: "bg-purple-100 text-purple-800",
};

export default async function MemberDashboardPage() {
  const user = await requireAuth();

  const member = await prisma.member.findUnique({
    where: { id: user.id },
    include: {
      plans: {
        where: {
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } },
          ],
        },
        include: { plan: true },
        orderBy: { startDate: "desc" },
        take: 1,
      },
      keys: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      waivers: {
        include: { waiver: true },
      },
    },
  });

  if (!member) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Member not found.
      </div>
    );
  }

  const activePlan = member.plans[0];
  const latestKey = member.keys[0];
  const pendingWaivers = member.waivers.filter(
    (w) => w.status === "PENDING" && w.waiver.isRequired
  );

  return (
    <div className="space-y-6">
      {/* Welcome + Status */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Welcome, {member.firstName}!</h1>
        <span
          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-semibold ${statusColors[member.status] || "bg-gray-100 text-gray-800"}`}
        >
          {member.status}
        </span>
      </div>

      {/* Alerts */}
      {pendingWaivers.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-start gap-3 pt-1">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div>
              <p className="font-medium text-orange-800">
                Required Waivers Pending
              </p>
              <p className="text-sm text-orange-700">
                You have {pendingWaivers.length} required waiver
                {pendingWaivers.length > 1 ? "s" : ""} that need to be
                completed:{" "}
                {pendingWaivers.map((w) => w.waiver.name).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan + Key Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activePlan ? (
              <div>
                <p className="text-lg font-semibold">{activePlan.plan.name}</p>
                <p className="text-sm text-muted-foreground">
                  ${Number(activePlan.plan.monthlyCost).toFixed(2)} / month
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active plan</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Key Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestKey ? (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    latestKey.status === "ACTIVE"
                      ? "bg-green-500"
                      : "bg-yellow-500"
                  }`}
                />
                <span className="text-sm font-medium">
                  {latestKey.status === "ACTIVE"
                    ? "Your key is active"
                    : "Your key is inactive"}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No key assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink
          href="/member/profile"
          icon={User}
          label="Edit Profile"
        />
        <QuickLink
          href="/member/payments"
          icon={CreditCard}
          label="Payment History"
        />
        <QuickLink
          href="/member/certifications"
          icon={Award}
          label="Certifications"
        />
        <QuickLink
          href="/member/certifications"
          icon={FileCheck}
          label="Waivers"
        />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4 text-center text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
    >
      <Icon className="h-6 w-6" />
      {label}
    </Link>
  );
}
