"use client";

import { useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleCardProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

export function CollapsibleCard({
  title,
  defaultOpen = true,
  children,
  badge,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="w-full text-left">
          <CardHeader className="cursor-pointer select-none">
            <div className="flex items-center gap-2">
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-90"
                )}
              />
              <CardTitle>{title}</CardTitle>
              {badge}
            </div>
          </CardHeader>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <CardContent>{children}</CardContent>
        </Collapsible.Panel>
      </Collapsible.Root>
    </Card>
  );
}
