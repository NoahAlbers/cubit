import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/bits";

export const metadata = { title: "Certifications" };
export const dynamic = "force-dynamic";

export default async function MemberCertificationsPage() {
  const user = await requireAuth();

  const [mine, restricted] = await Promise.all([
    prisma.equipmentCertification.findMany({
      where: { memberId: user.id },
      include: {
        equipment: true,
        certifiedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { certifiedDate: "desc" },
    }),
    prisma.equipment.findMany({
      where: { requiresCertification: true, status: { not: "RETIRED" } },
      orderBy: { name: "asc" },
    }),
  ]);

  const certifiedIds = new Set(mine.map((c) => c.equipmentId));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-brand-blue">
        CERTIFICATIONS
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>You&apos;re certified on</CardTitle>
        </CardHeader>
        {mine.length === 0 ? (
          <EmptyState
            title="No certifications yet"
            hint="Ask a staff member about equipment training and orientation."
          />
        ) : (
          <CardContent className="divide-y p-0">
            {mine.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium">{c.equipment.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Certified {formatDate(c.certifiedDate)}
                    {c.certifiedBy &&
                      ` by ${c.certifiedBy.firstName} ${c.certifiedBy.lastName}`}
                  </p>
                </div>
                <Badge variant="green">Certified</Badge>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {restricted.some((e) => !certifiedIds.has(e.id)) && (
        <Card>
          <CardHeader>
            <CardTitle>Requires certification before use</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {restricted
              .filter((e) => !certifiedIds.has(e.id))
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium">{e.name}</p>
                    {e.location && (
                      <p className="text-sm text-muted-foreground">{e.location}</p>
                    )}
                  </div>
                  <Badge variant="yellow">Training needed</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
