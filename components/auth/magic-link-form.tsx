"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  resetRequestSchema,
  type ResetRequestInput,
} from "@/lib/validations/auth";
import { requestMagicLink } from "@/app/(auth)/magic-link/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MagicLinkForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ResetRequestInput, string>>
  >({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
    };

    const result = resetRequestSchema.safeParse(data);
    if (!result.success) {
      const errors: Partial<Record<keyof ResetRequestInput, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ResetRequestInput;
        errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      const res = await requestMagicLink(formData);

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
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists with that email, we&apos;ve sent you a sign-in
            link. The link expires in 24 hours.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to login
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in with magic link</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a sign-in link
        </CardDescription>
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
            {fieldErrors.email && (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Sending link..." : "Send magic link"}
          </Button>
        </CardContent>
      </form>
      <CardFooter>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to login
        </Link>
      </CardFooter>
    </Card>
  );
}
