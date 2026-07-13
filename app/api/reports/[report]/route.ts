import { NextResponse } from "next/server";
import { differenceInDays, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasPermission } from "@/lib/permissions";

function csv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? "" : String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
}

function csvResponse(filename: string, rows: (string | number | null | undefined)[][]) {
  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ report: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports.export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { report } = await params;

  switch (report) {
    case "roster": {
      const members = await prisma.member.findMany({
        orderBy: [{ lastName: "asc" }],
        include: { plans: { where: { endDate: null }, include: { plan: true } } },
      });
      return csvResponse("member-roster", [
        ["Last name", "First name", "Email", "Phone", "Status", "Type", "Current plan", "Join date"],
        ...members.map((m) => [
          m.lastName,
          m.firstName,
          m.email,
          m.phone,
          m.status,
          m.membershipType,
          m.plans[0]?.plan.name,
          m.joinDate ? format(m.joinDate, "yyyy-MM-dd") : "",
        ]),
      ]);
    }
    case "transactions": {
      const txns = await prisma.transaction.findMany({
        orderBy: { transactionDate: "desc" },
        include: { member: { select: { firstName: true, lastName: true, email: true } } },
      });
      return csvResponse("transactions", [
        ["Date", "Member", "Email", "Amount", "Method", "Source", "Description", "Confirmation"],
        ...txns.map((t) => [
          format(t.transactionDate, "yyyy-MM-dd"),
          `${t.member.lastName}, ${t.member.firstName}`,
          t.member.email,
          t.amount.toString(),
          t.method,
          t.source,
          t.description,
          t.confirmation,
        ]),
      ]);
    }
    case "overdue": {
      const members = await prisma.member.findMany({
        where: { status: { in: ["PAST_DUE", "SUSPENDED"] } },
        orderBy: { statusChangedAt: "asc" },
      });
      return csvResponse("overdue", [
        ["Last name", "First name", "Email", "Phone", "Status", "Days overdue"],
        ...members.map((m) => [
          m.lastName,
          m.firstName,
          m.email,
          m.phone,
          m.status,
          differenceInDays(new Date(), m.statusChangedAt ?? m.updatedAt),
        ]),
      ]);
    }
    case "equipment": {
      const items = await prisma.equipment.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { certifications: true } } },
      });
      return csvResponse("equipment", [
        ["Name", "Category", "Location", "Status", "Requires certification", "Certified members", "Serial"],
        ...items.map((e) => [
          e.name,
          e.category,
          e.location,
          e.status,
          e.requiresCertification ? "Yes" : "No",
          e._count.certifications,
          e.serialNumber,
        ]),
      ]);
    }
    case "waiver-compliance": {
      const required = await prisma.waiverTemplate.findMany({
        where: { isRequired: true, isActive: true },
      });
      const members = await prisma.member.findMany({
        where: { status: "ACTIVE" },
        include: { waivers: { where: { status: "COMPLETED" } } },
        orderBy: [{ lastName: "asc" }],
      });
      const rows = members
        .map((m) => {
          const done = new Set(m.waivers.map((w) => w.waiverId));
          const missing = required.filter((r) => !done.has(r.id)).map((r) => r.name);
          return { m, missing };
        })
        .filter((r) => r.missing.length > 0);
      return csvResponse("waiver-compliance", [
        ["Last name", "First name", "Email", "Missing waivers"],
        ...rows.map(({ m, missing }) => [m.lastName, m.firstName, m.email, missing.join("; ")]),
      ]);
    }
    default:
      return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }
}
