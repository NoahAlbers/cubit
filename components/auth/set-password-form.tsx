"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setPasswordSchema,
  type SetPasswordInput,
} from "@/lib/validations/auth";
import { setPassword } from "@/app/(auth)/set-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SetPasswordForm({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SetPasswordInput, string>>
  >({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const result = setPasswordSchema.safeParse(data);
    if (!result.success) {
      const errors: Partial<Record<keyof SetPasswordInput, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof SetPasswordInput;
        errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      formData.set("memberId", memberId);
      const res = await setPassword(formData);

      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 2000);
      }
    });
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Password set successfully. Redirecting to login...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set your password</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 8 characters"
            />
            {fieldErrors.password && (
              <p className="text-xs text-destructive">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-destructive">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Setting password..." : "Set password"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
