"use client";

import { useTransition, useRef } from "react";
import { CollapsibleCard } from "@/components/admin/collapsible-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateMemberProfile, uploadMemberPhoto } from "@/app/admin/members/[id]/actions";
import { User, Upload } from "lucide-react";

const MEMBERSHIP_TYPES = ["STANDARD", "STUDENT", "SCHOLARSHIP", "SPONSORSHIP"] as const;

interface ProfileCardProps {
  memberId: string;
  member: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    paypalEmail: string | null;
    membershipType: string;
    dateOfBirth: string | null;
    joinDate: string | null;
    picture: string | null;
  };
}

export function ProfileCard({ memberId, member }: ProfileCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateMemberProfile(memberId, formData);
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("photo", file);
    startUpload(async () => {
      await uploadMemberPhoto(memberId, formData);
    });
  };

  return (
    <CollapsibleCard title="Profile">
      <div className="flex gap-6">
        {/* Avatar + Upload */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-muted">
            {member.picture ? (
              <img
                src={member.picture}
                alt={`${member.firstName} ${member.lastName}`}
                className="size-full object-cover"
              />
            ) : (
              <User className="size-8 text-muted-foreground" />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3" data-icon="inline-start" />
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
          <div className="mt-1 text-center">
            <p className="text-[10px] text-muted-foreground">Member ID</p>
            <p className="font-mono text-xs">{memberId.slice(0, 8)}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={member.firstName}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={member.lastName}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={member.email}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={member.phone ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paypalEmail">PayPal Email</Label>
              <Input
                id="paypalEmail"
                name="paypalEmail"
                type="email"
                defaultValue={member.paypalEmail ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Membership Type</Label>
              <Select
                name="membershipType"
                defaultValue={member.membershipType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBERSHIP_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                defaultValue={member.dateOfBirth ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="joinDate">Join Date</Label>
              <Input
                id="joinDate"
                name="joinDate"
                type="date"
                defaultValue={member.joinDate ?? ""}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>
    </CollapsibleCard>
  );
}
