import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { WaiverTemplateForm } from "./template-form";

export const dynamic = "force-dynamic";

export default async function WaiverTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("waivers.view");
  const { id } = await params;

  const template = await prisma.waiverTemplate.findUnique({
    where: { id },
    include: {
      memberWaivers: {
        where: { status: "COMPLETED" },
        include: {
          member: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { completedDate: "desc" },
      },
    },
  });
  if (!template) notFound();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-xl font-bold text-brand-blue">
          {template.name.toUpperCase()}
        </h1>
        <Badge>v{template.version}</Badge>
        {template.isRequired && <Badge variant="red">Required</Badge>}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
          </CardHeader>
          <CardContent>
            <WaiverTemplateForm
              templateId={template.id}
              defaults={{
                name: template.name,
                description: template.description ?? "",
                content: template.content,
                isRequired: template.isRequired,
                isActive: template.isActive,
              }}
              canEdit={hasPermission(user, "waivers.manage")}
            />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>
              Signatures{" "}
              <span className="ml-1 font-normal text-muted-foreground">
                {template.memberWaivers.length}
              </span>
            </CardTitle>
          </CardHeader>
          {template.memberWaivers.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted-foreground">No signatures yet.</p>
            </CardContent>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
                  <TH>Signed as</TH>
                  <TH>Date</TH>
                  <TH>Version</TH>
                </TR>
              </THead>
              <TBody>
                {template.memberWaivers.map((w) => (
                  <TR key={w.id}>
                    <TD>
                      <Link
                        href={`/admin/members/${w.member.id}`}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        {w.member.lastName}, {w.member.firstName}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">
                      {w.signedName ?? "Marked by staff"}
                    </TD>
                    <TD className="text-muted-foreground">{formatDate(w.completedDate)}</TD>
                    <TD className="text-muted-foreground">
                      {w.signedVersion ? `v${w.signedVersion}` : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
