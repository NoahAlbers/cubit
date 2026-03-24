"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { confirmPasswordReset } from "@/app/(auth)/reset-password/confirm/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ResetPasswordInput, string>>
  >({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      token,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const result = resetPasswordSchema.safeParse(data);
    if (!result.success) {
      const errors: Partial<Record<keyof ResetPasswordInput, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ResetPasswordInput;
        errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      formData.set("token", token);
      const res = await confirmPasswordReset(formData);

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
            Password reset successfully. Redirecting to login...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
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
            <Label htmlFor="confirmPassword">Confirm new password</Label>
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
            {isPending ? "Resetting password..." : "Reset password"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
