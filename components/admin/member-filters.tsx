"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, ChevronDown } from "lucide-react";

const MEMBER_STATUSES = [
  "ACTIVE",
  "HOLD",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELED",
  "PROSPECTIVE",
  "ALUMNI",
] as const;

const MEMBERSHIP_TYPES = [
  "STANDARD",
  "STUDENT",
  "SCHOLARSHIP",
  "SPONSORSHIP",
] as const;

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="min-w-[120px] justify-between"
      >
        <span className="truncate">
          {selected.length > 0
            ? `${label} (${selected.length})`
            : label}
        </span>
        <ChevronDown className="ml-1 size-3.5" />
      </Button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-lg border bg-popover p-2 shadow-md">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={selected.includes(option)}
                onCheckedChange={() => toggle(option)}
              />
              <span>{option.replace(/_/g, " ")}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function MemberFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") ?? ""
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const selectedStatuses = searchParams.getAll("status");
  const selectedTypes = searchParams.getAll("membershipType");
  const showInactive = searchParams.get("showInactive") === "true";

  const updateParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset to page 1 on filter change
      params.delete("page");

      for (const [key, value] of Object.entries(updates)) {
        params.delete(key);
        if (value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            params.append(key, v);
          }
        } else {
          params.set(key, value);
        }
      }

      router.push(`/admin/members?${params.toString()}`);
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

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-[250px] pl-8"
        />
      </div>

      <MultiSelectDropdown
        label="Status"
        options={MEMBER_STATUSES}
        selected={selectedStatuses}
        onChange={(values) => updateParams({ status: values.length > 0 ? values : null })}
      />

      <MultiSelectDropdown
        label="Type"
        options={MEMBERSHIP_TYPES}
        selected={selectedTypes}
        onChange={(values) =>
          updateParams({ membershipType: values.length > 0 ? values : null })
        }
      />

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={showInactive}
          onCheckedChange={(checked) =>
            updateParams({
              showInactive: checked ? "true" : null,
            })
          }
        />
        <span>Show inactive</span>
      </label>
    </div>
  );
}
