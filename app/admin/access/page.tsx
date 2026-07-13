import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/ui/bits";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Door Access" };
export const dynamic = "force-dynamic";

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  await requirePermission("access.view");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const pageSize = [25, 50, 100].includes(parseInt(sp.pageSize ?? ""))
    ? parseInt(sp.pageSize!)
    : 25;

  const [logs, total, whitelistCount] = await Promise.all([
    prisma.accessLog.findMany({
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        key: { select: { serialNumber: true } },
      },
    }),
    prisma.accessLog.count(),
    prisma.key.count({
      where: { status: "ACTIVE", member: { status: { in: ["ACTIVE", "HOLD"] } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="DOOR ACCESS"
        meta={`${whitelistCount} keys on the current whitelist`}
      />
      <Card>
        {logs.length === 0 ? (
          <>
            <EmptyState
              title="No access events yet"
              hint="Point the RFIDLock reader at Cubit's whitelist endpoint and scans will appear here."
            />
            <CardContent className="border-t bg-muted/30 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">RFIDLock setup</p>
              <p className="mt-1">
                Whitelist (drop-in Seltzer replacement):{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  GET /api/rfid/whitelist?token=…
                </code>
                &nbsp;· Scan logging:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  POST /api/rfid/access-log
                </code>
                . Find the API token under Settings → RFID Access.
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Member</TH>
                  <TH>Key serial</TH>
                  <TH>Access point</TH>
                  <TH>Result</TH>
                </TR>
              </THead>
              <TBody>
                {logs.map((log) => (
                  <TR key={log.id}>
                    <TD className="text-muted-foreground tabular-nums">
                      {format(log.timestamp, "MMM d, yyyy h:mm a")}
                    </TD>
                    <TD>
                      {log.member ? (
                        <Link
                          href={`/admin/members/${log.member.id}`}
                          className="font-medium text-brand-blue hover:underline"
                        >
                          {log.member.lastName}, {log.member.firstName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unknown key</span>
                      )}
                    </TD>
                    <TD className="font-mono text-xs">
                      {log.key?.serialNumber ?? log.serial ?? "—"}
                    </TD>
                    <TD className="text-muted-foreground">{log.accessPoint ?? "—"}</TD>
                    <TD>
                      <StatusBadge status={log.accessType} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="border-t">
              <Pagination page={page} pageSize={pageSize} total={total} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
