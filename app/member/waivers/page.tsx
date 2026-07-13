import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { formatDate, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/variants";

export const metadata = { title: "Waivers" };
export const dynamic = "force-dynamic";

export default async function MemberWaiversPage() {
  const user = await requireAuth();

  const [templates, mine] = await Promise.all([
    prisma.waiverTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ isRequired: "desc" }, { name: "asc" }],
    }),
    prisma.memberWaiver.findMany({ where: { memberId: user.id } }),
  ]);
  const byWaiver = new Map(mine.map((w) => [w.waiverId, w]));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-brand-blue">WAIVERS</h1>
      {templates.map((t) => {
        const signed = byWaiver.get(t.id);
        const complete = signed?.status === "COMPLETED";
        return (
          <Card key={t.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {t.name}
                  {t.isRequired && (
                    <span className="ml-2 text-[0.65rem] font-semibold text-brand-red uppercase">
                      Required
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {complete
                    ? `Signed ${formatDate(signed!.completedDate)} as ${signed!.signedName ?? "recorded by staff"}`
                    : (t.description ?? "Please read and sign.")}
                </p>
              </div>
              {complete ? (
                <StatusBadge status="COMPLETED" />
              ) : (
                <Link
                  href={`/member/waivers/${t.id}`}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Read &amp; sign
                </Link>
              )}
            </CardContent>
          </Card>
        );
      })}
      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">No waivers to sign right now.</p>
      )}
    </div>
  );
}
