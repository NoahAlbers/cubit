"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { resetRequestSchema } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/app/(auth)/reset-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ResetPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    const result = resetRequestSchema.safeParse({ email });
    if (!result.success) {
      setFieldError(result.error.issues[0].message);
      return;
    }

    startTransition(async () => {
      const res = await requestPasswordReset(formData);

      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
      }
    });
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            If an account exists with that email, you&apos;ll receive a reset
            link.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
          >
            Back to login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
            {fieldError && (
              <p className="text-xs text-destructive">{fieldError}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Sending reset link..." : "Send reset link"}
          </Button>
        </CardContent>
      </form>
      <CardFooter className="justify-center text-sm">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground"
        >
          Back to login
        </Link>
      </CardFooter>
    </Card>
  );
}
