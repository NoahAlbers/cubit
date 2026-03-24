"use client";

import { useState, useTransition, useOptimistic } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addKey, toggleKeyStatus, deleteKey } from "@/app/admin/members/[id]/actions";
import { Trash2 } from "lucide-react";

interface KeyData {
  id: string;
  serialNumber: string;
  type: string | null;
  status: string;
  assignedDate: string | null;
}

interface KeysCardProps {
  memberId: string;
  keys: KeyData[];
  keysIncluded: number;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export function KeysCard({ memberId, keys: initialKeys, keysIncluded }: KeysCardProps) {
  const [isPending, startTransition] = useTransition();
  const [serialNumber, setSerialNumber] = useState("");
  const [keyType, setKeyType] = useState("fob");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  const [optimisticKeys, addOptimistic] = useOptimistic(
    initialKeys,
    (state: KeyData[], toggledId: string) =>
      state.map((k) =>
        k.id === toggledId
          ? { ...k, status: k.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }
          : k
      )
  );

  const activeCount = optimisticKeys.filter((k) => k.status === "ACTIVE").length;

  const handleToggle = (keyId: string) => {
    addOptimistic(keyId);
    startTransition(async () => {
      await toggleKeyStatus(keyId);
    });
  };

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) return;
    startTransition(async () => {
      const result = await addKey(memberId, serialNumber.trim(), keyType);
      if (result?.success) {
        setSerialNumber("");
      }
    });
  };

  const handleDelete = () => {
    if (!keyToDelete) return;
    startTransition(async () => {
      await deleteKey(keyToDelete);
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
    });
  };

  return (
    <CollapsibleCard
      title="Keys"
      badge={
        <Badge variant="secondary">
          {activeCount} of {keysIncluded} keys
        </Badge>
      }
    >
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No keys assigned
                </TableCell>
              </TableRow>
            ) : (
              optimisticKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono text-sm">{key.serialNumber}</TableCell>
                  <TableCell>{key.type ?? "-"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(key.id)}
                      disabled={isPending}
                    >
                      <Badge
                        variant="secondary"
                        className={
                          key.status === "ACTIVE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        }
                      >
                        {key.status}
                      </Badge>
                    </Button>
                  </TableCell>
                  <TableCell>{formatDate(key.assignedDate)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setKeyToDelete(key.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Add Key Form */}
        <form onSubmit={handleAddKey} className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label>Serial Number</Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Enter serial number"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={keyType} onValueChange={(val) => { if (val) setKeyType(val); }}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fob">Fob</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending || !serialNumber.trim()}>
            {isPending ? "Adding..." : "Add Key"}
          </Button>
        </form>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Key</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this key? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                {isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CollapsibleCard>
  );
}
