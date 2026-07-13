import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/ui/bits";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { AddWaiverButton } from "./add-waiver-dialog";

export const metadata = { title: "Waivers" };
export const dynamic = "force-dynamic";

export default async function WaiversPage() {
  const user = await requirePermission("waivers.view");

  const templates = await prisma.waiverTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { memberWaivers: { where: { status: "COMPLETED" } } },
      },
    },
  });

  // Compliance: active members missing required waivers
  const required = templates.filter((t) => t.isRequired && t.isActive);
  let missing: { id: string; name: string; email: string; missing: string[] }[] = [];
  if (required.length > 0) {
    const activeMembers = await prisma.member.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        waivers: { where: { status: "COMPLETED" }, select: { waiverId: true } },
      },
      orderBy: [{ lastName: "asc" }],
    });
    missing = activeMembers
      .map((m) => {
        const done = new Set(m.waivers.map((w) => w.waiverId));
        const miss = required.filter((r) => !done.has(r.id)).map((r) => r.name);
        return {
          id: m.id,
          name: `${m.lastName}, ${m.firstName}`,
          email: m.email,
          missing: miss,
        };
      })
      .filter((m) => m.missing.length > 0);
  }

  return (
    <>
      <PageHeader
        title="WAIVERS"
        meta={`${templates.length} template${templates.length === 1 ? "" : "s"}`}
        actions={hasPermission(user, "waivers.manage") ? <AddWaiverButton /> : undefined}
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
          </CardHeader>
          {templates.length === 0 ? (
            <EmptyState title="No waiver templates" hint="Create one to start collecting signatures." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Required</TH>
                  <TH>Active</TH>
                  <TH>Version</TH>
                  <TH className="text-center">Signatures</TH>
                </TR>
              </THead>
              <TBody>
                {templates.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <Link
                        href={`/admin/waivers/${t.id}`}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        {t.name}
                      </Link>
                    </TD>
                    <TD>
                      {t.isRequired ? <Badge variant="red">Required</Badge> : <Badge>Optional</Badge>}
                    </TD>
                    <TD>
                      {t.isActive ? <Badge variant="green">Active</Badge> : <Badge>Inactive</Badge>}
                    </TD>
                    <TD className="text-muted-foreground">v{t.version}</TD>
                    <TD className="text-center tabular-nums">{t._count.memberWaivers}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Compliance{" "}
              <span className="ml-1 font-normal text-muted-foreground">
                {missing.length} active member{missing.length === 1 ? "" : "s"} missing required waivers
              </span>
            </CardTitle>
          </CardHeader>
          {missing.length === 0 ? (
            <EmptyState title="Everyone is covered" hint="All active members have completed the required waivers." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Member</TH>
                  <TH>Email</TH>
                  <TH>Missing</TH>
                </TR>
              </THead>
              <TBody>
                {missing.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <Link
                        href={`/admin/members/${m.id}`}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        {m.name}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{m.email}</TD>
                    <TD className="text-brand-red">{m.missing.join(", ")}</TD>
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
