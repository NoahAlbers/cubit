"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, CheckCircle2 } from "lucide-react";
import type { EquipmentListItem } from "@/app/admin/equipment/actions";

const STATUS_COLORS: Record<string, string> = {
  OPERATIONAL: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  MAINTENANCE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  OUT_OF_ORDER: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  RETIRED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const EQUIPMENT_STATUSES = ["OPERATIONAL", "MAINTENANCE", "OUT_OF_ORDER", "RETIRED"] as const;

type SortField = "name" | "status" | "category" | "location";

interface EquipmentListTableProps {
  equipment: EquipmentListItem[];
  categories: string[];
}

export function EquipmentListTable({ equipment, categories }: EquipmentListTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") ?? ""
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const currentSort = (searchParams.get("sortField") ?? "name") as SortField;
  const currentDir = (searchParams.get("sortDirection") ?? "asc") as "asc" | "desc";
  const currentStatus = searchParams.get("status") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentRequiresCert = searchParams.get("requiresCert") ?? "";

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      // Reset page on filter change (except for sort and page)
      if (!("page" in updates) && !("sortField" in updates) && !("sortDirection" in updates)) {
        params.delete("page");
      }
      router.push(`/admin/equipment?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ search: value || null });
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSort = (field: SortField) => {
    if (currentSort === field) {
      updateParams({
        sortDirection: currentDir === "asc" ? "desc" : "asc",
        sortField: field,
      });
    } else {
      updateParams({ sortField: field, sortDirection: "asc" });
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (currentSort !== field)
      return <ArrowUpDown className="ml-1 inline size-3.5 text-muted-foreground" />;
    return currentDir === "asc" ? (
      <ArrowUp className="ml-1 inline size-3.5" />
    ) : (
      <ArrowDown className="ml-1 inline size-3.5" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search equipment..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-[250px] pl-8"
          />
        </div>

        <Select
          value={currentStatus || "all"}
          onValueChange={(val) =>
            updateParams({ status: val === "all" ? null : val })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {EQUIPMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <Select
            value={currentCategory || "all"}
            onValueChange={(val) =>
              updateParams({ category: val === "all" ? null : val })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={currentRequiresCert || "all"}
          onValueChange={(val) =>
            updateParams({ requiresCert: val === "all" ? null : val })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Certification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any certification</SelectItem>
            <SelectItem value="true">Requires cert</SelectItem>
            <SelectItem value="false">No cert required</SelectItem>
          </SelectContent>
        </Select>

        {(currentStatus || currentCategory || currentRequiresCert || searchValue) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchValue("");
              router.push("/admin/equipment");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="inline-flex items-center hover:text-foreground"
                  onClick={() => handleSort("name")}
                >
                  Name
                  <SortIcon field="name" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center hover:text-foreground"
                  onClick={() => handleSort("category")}
                >
                  Category
                  <SortIcon field="category" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center hover:text-foreground"
                  onClick={() => handleSort("status")}
                >
                  Status
                  <SortIcon field="status" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center hover:text-foreground"
                  onClick={() => handleSort("location")}
                >
                  Location
                  <SortIcon field="location" />
                </button>
              </TableHead>
              <TableHead>Requires Cert</TableHead>
              <TableHead>Serial Number</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No equipment found.
                </TableCell>
              </TableRow>
            ) : (
              equipment.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/equipment/${item.id}`)}
                >
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category ?? "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[item.status] ?? ""}
                    >
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.location ?? "-"}</TableCell>
                  <TableCell>
                    {item.requiresCertification && (
                      <CheckCircle2 className="size-4 text-green-600" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.serialNumber ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
