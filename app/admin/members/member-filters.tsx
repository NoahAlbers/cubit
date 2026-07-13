"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select, Checkbox } from "@/components/ui/form-controls";

const STATUSES = [
  "PROSPECTIVE",
  "ACTIVE",
  "HOLD",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELED",
  "ALUMNI",
];
const TYPES = ["STANDARD", "STUDENT", "SCHOLARSHIP", "SPONSORSHIP"];

export function MemberFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const first = useRef(true);

  function update(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.set("page", "1");
    router.push(`?${sp.toString()}`);
  }

  // Debounced search
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ q }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
      <div className="relative min-w-52 flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name or email…"
          className="pl-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Select
        className="w-36"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => update({ status: e.target.value })}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </Select>
      <Select
        className="w-36"
        value={searchParams.get("type") ?? ""}
        onChange={(e) => update({ type: e.target.value })}
        aria-label="Filter by membership type"
      >
        <option value="">All types</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Select
        className="w-36"
        value={searchParams.get("sort") ?? "name"}
        onChange={(e) => update({ sort: e.target.value })}
        aria-label="Sort"
      >
        <option value="name">Sort: Name</option>
        <option value="joined">Sort: Joined</option>
        <option value="status">Sort: Status</option>
        <option value="login">Sort: Last login</option>
      </Select>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={searchParams.get("inactive") === "1"}
          onChange={(e) => update({ inactive: e.target.checked ? "1" : "" })}
        />
        Show inactive
      </label>
    </div>
  );
}
