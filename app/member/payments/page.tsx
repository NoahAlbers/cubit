import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 15;

interface PaymentsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function MemberPaymentsPage({
  searchParams,
}: PaymentsPageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { memberId: user.id },
      orderBy: { transactionDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.transaction.count({
      where: { memberId: user.id },
    }),
  ]);

  // Calculate running balance (sum of all transactions)
  const balanceResult = await prisma.transaction.aggregate({
    where: { memberId: user.id },
    _sum: { amount: true },
  });
  const balance = Number(balanceResult._sum.amount || 0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payment History</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Balance</span>
            <span
              className={`text-2xl ${balance >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              ${balance.toFixed(2)}
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No transactions found.
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="divide-y sm:hidden">
                {transactions.map((tx) => (
                  <div key={tx.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        ${Number(tx.amount).toFixed(2)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {tx.method}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(tx.transactionDate).toLocaleDateString()}
                    </p>
                    {tx.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tx.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(tx.transactionDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {tx.description || "--"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.method}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(tx.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex gap-2">
                    {page > 1 ? (
                      <Link href={`/member/payments?page=${page - 1}`}>
                        <Button variant="outline" size="sm">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    )}
                    {page < totalPages ? (
                      <Link href={`/member/payments?page=${page + 1}`}>
                        <Button variant="outline" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
