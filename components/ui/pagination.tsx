"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { Select } from "./form-controls";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function update(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) sp.set(k, v);
    router.push(`?${sp.toString()}`);
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          Per page
          <Select
            className="h-8 w-20"
            value={String(pageSize)}
            onChange={(e) => update({ pageSize: e.target.value, page: "1" })}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) })}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span className="px-2 tabular-nums">
            {page} / {pages}
          </span>
          <Button
            variant="secondary"
            size="icon-sm"
            disabled={page >= pages}
            onClick={() => update({ page: String(page + 1) })}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
