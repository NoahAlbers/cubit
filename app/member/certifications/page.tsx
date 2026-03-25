import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Award, FileCheck } from "lucide-react";

export default async function MemberCertificationsPage() {
  const user = await requireAuth();

  const [certifications, waivers] = await Promise.all([
    prisma.equipmentCertification.findMany({
      where: { memberId: user.id },
      include: { equipment: true },
      orderBy: { certifiedDate: "desc" },
    }),
    prisma.memberWaiver.findMany({
      where: { memberId: user.id },
      include: { waiver: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Certifications & Waivers</h1>

      {/* Equipment Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Equipment Certifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {certifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No equipment certifications yet.
            </p>
          ) : (
            <div className="divide-y">
              {certifications.map((cert: any) => {
                const isExpired =
                  cert.expirationDate &&
                  new Date(cert.expirationDate) < new Date();
                return (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {cert.equipment.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Certified:{" "}
                        {new Date(cert.certifiedDate).toLocaleDateString()}
                      </p>
                      {cert.expirationDate && (
                        <p className="text-xs text-muted-foreground">
                          Expires:{" "}
                          {new Date(
                            cert.expirationDate
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {isExpired ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waivers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Waivers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {waivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No waivers found.</p>
          ) : (
            <div className="divide-y">
              {waivers.map((mw: any) => (
                <div
                  key={mw.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{mw.waiver.name}</p>
                      {mw.waiver.isRequired && (
                        <Badge variant="destructive" className="text-[10px]">
                          Required
                        </Badge>
                      )}
                    </div>
                    {mw.completedDate && (
                      <p className="text-xs text-muted-foreground">
                        Completed:{" "}
                        {new Date(mw.completedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {mw.status === "COMPLETED" ? (
                    <Badge variant="default">Completed</Badge>
                  ) : mw.status === "EXPIRED" ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
