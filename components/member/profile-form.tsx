"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateOwnProfile, changePassword, uploadOwnPhoto } from "@/app/member/profile/actions";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MemberData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  picture: string | null;
  membershipType: string;
  status: string;
  joinDate: string | null;
  role: string;
  emergencyContactName: string | null;
  emergencyContactEmail: string | null;
  emergencyContactPhone: string | null;
}

interface ProfileFormProps {
  member: MemberData;
}

export function ProfileForm({ member }: ProfileFormProps) {
  return (
    <div className="space-y-6">
      <PhotoSection memberId={member.id} picture={member.picture} />
      <ReadOnlyInfoSection member={member} />
      <EditableProfileSection member={member} />
      <EmergencyContactSection member={member} />
      <ChangePasswordSection memberId={member.id} />
    </div>
  );
}

function PhotoSection({
  memberId,
  picture,
}: {
  memberId: string;
  picture: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(picture);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.set("memberId", memberId);
    formData.set("photo", file);

    const result = await uploadOwnPhoto(formData);
    setUploading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Photo updated");
      if (result.url) setPhotoUrl(result.url);
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-1">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">
                ?
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md transition-colors hover:bg-primary/90"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Profile Photo</p>
          <p className="text-xs text-muted-foreground">
            Tap the camera icon to upload
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadOnlyInfoSection({ member }: { member: MemberData }) {
  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    PROSPECTIVE: "bg-blue-100 text-blue-800",
    HOLD: "bg-yellow-100 text-yellow-800",
    PAST_DUE: "bg-orange-100 text-orange-800",
    SUSPENDED: "bg-red-100 text-red-800",
    CANCELED: "bg-gray-100 text-gray-800",
    ALUMNI: "bg-purple-100 text-purple-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          <p className="text-sm">{member.email}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <div className="mt-1">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[member.status] || "bg-gray-100 text-gray-800"}`}
              >
                {member.status}
              </span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Membership Type
            </Label>
            <div className="mt-1">
              <Badge variant="secondary">{member.membershipType}</Badge>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Role</Label>
            <div className="mt-1">
              <Badge variant="outline">{member.role}</Badge>
            </div>
          </div>
        </div>
        {member.joinDate && (
          <div>
            <Label className="text-xs text-muted-foreground">
              Member Since
            </Label>
            <p className="text-sm">
              {new Date(member.joinDate).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditableProfileSection({ member }: { member: MemberData }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    formData.set("memberId", member.id);
    const result = await updateOwnProfile(formData);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Profile updated");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={member.firstName}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={member.lastName}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={member.phone || ""}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EmergencyContactSection({ member }: { member: MemberData }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    formData.set("memberId", member.id);
    // Carry forward the personal info fields since they share an action
    formData.set("firstName", member.firstName);
    formData.set("lastName", member.lastName);
    const result = await updateOwnProfile(formData);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Emergency contact updated");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emergency Contact</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={member.emergencyContactName || ""}
            />
          </div>
          <div>
            <Label htmlFor="emergencyContactEmail">Email</Label>
            <Input
              id="emergencyContactEmail"
              name="emergencyContactEmail"
              type="email"
              defaultValue={member.emergencyContactEmail || ""}
            />
          </div>
          <div>
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              defaultValue={member.emergencyContactPhone || ""}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Emergency Contact"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ChangePasswordSection({ memberId }: { memberId: string }) {
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    formData.set("memberId", memberId);
    const result = await changePassword(formData);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Password changed successfully");
      formRef.current?.reset();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
