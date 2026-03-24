"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { MemberListItem } from "@/app/admin/members/actions";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  PAST_DUE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  PROSPECTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ALUMNI: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

type SortField = "name" | "joinDate" | "status" | "lastLoginAt";

const SORTABLE_COLUMNS: { key: SortField; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "joinDate", label: "Join Date" },
  { key: "status", label: "Status" },
  { key: "lastLoginAt", label: "Last Login" },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export function MemberListTable({ members }: { members: MemberListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const currentSort = (searchParams.get("sortField") ?? "name") as SortField;
  const currentDir = (searchParams.get("sortDirection") ?? "asc") as
    | "asc"
    | "desc";

  const handleSort = (field: SortField) => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === field) {
      params.set("sortDirection", currentDir === "asc" ? "desc" : "asc");
    } else {
      params.set("sortField", field);
      params.set("sortDirection", "asc");
    }
    router.push(`/admin/members?${params.toString()}`);
  };

  const toggleAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={
                members.length > 0 && selectedIds.size === members.length
              }
              onCheckedChange={toggleAll}
            />
          </TableHead>
          {SORTABLE_COLUMNS.map((col) =>
            col.key === "name" ? (
              <TableHead key={col.key}>
                <button
                  className="inline-flex items-center hover:text-foreground"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon field={col.key} />
                </button>
              </TableHead>
            ) : col.key === "status" ? (
              <TableHead key="email">Email</TableHead>
            ) : null
          )}
          {/* Email column (not sortable) sits between Name and Status */}
          <TableHead>
            <button
              className="inline-flex items-center hover:text-foreground"
              onClick={() => handleSort("status")}
            >
              Status
              <SortIcon field="status" />
            </button>
          </TableHead>
          <TableHead>Type</TableHead>
          <TableHead>
            <button
              className="inline-flex items-center hover:text-foreground"
              onClick={() => handleSort("joinDate")}
            >
              Join Date
              <SortIcon field="joinDate" />
            </button>
          </TableHead>
          <TableHead>
            <button
              className="inline-flex items-center hover:text-foreground"
              onClick={() => handleSort("lastLoginAt")}
            >
              Last Login
              <SortIcon field="lastLoginAt" />
            </button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
              No members found.
            </TableCell>
          </TableRow>
        ) : (
          members.map((member) => (
            <TableRow
              key={member.id}
              className="cursor-pointer"
              data-state={selectedIds.has(member.id) ? "selected" : undefined}
              onClick={() => router.push(`/admin/members/${member.id}`)}
            >
              <TableCell
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Checkbox
                  checked={selectedIds.has(member.id)}
                  onCheckedChange={() => toggleOne(member.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                {member.lastName}, {member.firstName}
              </TableCell>
              <TableCell>{member.email}</TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={STATUS_COLORS[member.status] ?? ""}
                >
                  {member.status.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>{member.membershipType}</TableCell>
              <TableCell>{formatDate(member.joinDate)}</TableCell>
              <TableCell>{formatDate(member.lastLoginAt)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
