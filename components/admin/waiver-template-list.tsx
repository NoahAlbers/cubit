"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, X, Check } from "lucide-react";
import type { WaiverTemplateItem } from "@/app/admin/waivers/actions";
import { updateWaiverTemplate } from "@/app/admin/waivers/actions";
import { WaiverCompliance } from "./waiver-compliance";

interface WaiverTemplateListProps {
  templates: WaiverTemplateItem[];
}

export function WaiverTemplateList({ templates }: WaiverTemplateListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsRequired, setEditIsRequired] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);

  const startEdit = (template: WaiverTemplateItem) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditDescription(template.description ?? "");
    setEditIsRequired(template.isRequired);
    setEditIsActive(template.isActive);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateWaiverTemplate(id, {
        name: editName,
        description: editDescription || undefined,
        isRequired: editIsRequired,
        isActive: editIsActive,
      });
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (template: WaiverTemplateItem) => {
    await updateWaiverTemplate(template.id, {
      name: template.name,
      description: template.description ?? undefined,
      isRequired: template.isRequired,
      isActive: !template.isActive,
    });
    router.refresh();
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No waiver templates found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <>
                  <TableRow key={template.id}>
                    {editingId === template.id ? (
                      <>
                        <TableCell>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={1}
                            className="min-h-8 resize-none"
                          />
                        </TableCell>
                        <TableCell>
                          <label className="flex items-center gap-1.5">
                            <Checkbox
                              checked={editIsRequired}
                              onCheckedChange={(c) =>
                                setEditIsRequired(c === true)
                              }
                            />
                            <Label className="text-xs">Required</Label>
                          </label>
                        </TableCell>
                        <TableCell>
                          <label className="flex items-center gap-1.5">
                            <Checkbox
                              checked={editIsActive}
                              onCheckedChange={(c) =>
                                setEditIsActive(c === true)
                              }
                            />
                            <Label className="text-xs">Active</Label>
                          </label>
                        </TableCell>
                        <TableCell>
                          {template.completedCount}/
                          {template.totalActiveMembers}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => saveEdit(template.id)}
                              disabled={saving}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell
                          className="cursor-pointer font-medium"
                          onClick={() => toggleExpanded(template.id)}
                        >
                          {template.name}
                        </TableCell>
                        <TableCell
                          className="max-w-[300px] cursor-pointer truncate"
                          onClick={() => toggleExpanded(template.id)}
                        >
                          {template.description ?? "-"}
                        </TableCell>
                        <TableCell>
                          {template.isRequired ? (
                            <Badge
                              variant="secondary"
                              className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            >
                              Required
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Optional</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => toggleActive(template)}
                            className="cursor-pointer"
                          >
                            {template.isActive ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              >
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                              >
                                Inactive
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {template.completedCount}/
                            {template.totalActiveMembers} completed
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(template)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                  {expandedId === template.id && (
                    <TableRow key={`${template.id}-compliance`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-0">
                        <WaiverCompliance waiverId={template.id} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
