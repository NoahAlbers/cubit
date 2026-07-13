import { Download } from "lucide-react";
import { requirePermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/variants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reports" };

const REPORTS = [
  {
    key: "roster",
    title: "Member roster",
    description: "All members with contact info, status, type, plan, and join date.",
  },
  {
    key: "transactions",
    title: "Transactions",
    description: "Every recorded payment with member, amount, method, and source.",
  },
  {
    key: "overdue",
    title: "Overdue accounts",
    description: "Past-due and suspended members with days overdue and contact info.",
  },
  {
    key: "equipment",
    title: "Equipment",
    description: "Inventory with status, certification requirements, and certified member counts.",
  },
  {
    key: "waiver-compliance",
    title: "Waiver compliance",
    description: "Active members missing required waivers.",
  },
];

export default async function ReportsPage() {
  await requirePermission("reports.view");

  return (
    <>
      <PageHeader title="REPORTS" meta="CSV exports" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.key}>
            <CardHeader>
              <CardTitle>{r.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{r.description}</p>
              <a
                href={`/api/reports/${r.key}`}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "self-start")}
                download
              >
                <Download className="size-4" /> Download CSV
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
