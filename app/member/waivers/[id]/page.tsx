import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignWaiverForm } from "./sign-form";

export const dynamic = "force-dynamic";

export default async function SignWaiverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const template = await prisma.waiverTemplate.findUnique({ where: { id } });
  if (!template || !template.isActive) notFound();

  const existing = await prisma.memberWaiver.findUnique({
    where: { memberId_waiverId: { memberId: user.id, waiverId: id } },
  });
  if (existing?.status === "COMPLETED") redirect("/member/waivers");

  const member = await prisma.member.findUniqueOrThrow({
    where: { id: user.id },
    select: { firstName: true, lastName: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-brand-blue">
        {template.name.toUpperCase()}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>
            Please read carefully{" "}
            <span className="ml-1 font-normal text-muted-foreground">
              version {template.version}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {template.content}
            </p>
          </div>
        </CardContent>
      </Card>
      <SignWaiverForm
        waiverId={template.id}
        suggestedName={`${member.firstName} ${member.lastName}`}
      />
    </div>
  );
}
