"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  EMBED_DEFAULT_REFRESH_SECONDS,
  EMBED_DEFAULT_TITLE,
  EMBED_MIN_REFRESH_SECONDS,
} from "@/lib/embed";

interface EmbedSnippetBuilderProps {
  categories: string[];
  appUrl: string | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-HTTPS) — user can select manually.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-600" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" /> Copy
        </>
      )}
    </Button>
  );
}

export function EmbedSnippetBuilder({
  categories,
  appUrl,
}: EmbedSnippetBuilderProps) {
  // Prefer the configured public URL; fall back to the browser origin
  // (empty during SSR, resolved after hydration).
  const browserOrigin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const baseUrl = appUrl ?? browserOrigin;

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [category, setCategory] = useState<string>("all");
  const [refresh, setRefresh] = useState(EMBED_DEFAULT_REFRESH_SECONDS);
  const [compact, setCompact] = useState(false);
  const [title, setTitle] = useState("");
  const [height, setHeight] = useState(480);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (theme !== "light") params.set("theme", theme);
    if (category !== "all") params.set("category", category);
    if (refresh !== EMBED_DEFAULT_REFRESH_SECONDS)
      params.set("refresh", String(refresh));
    if (compact) params.set("compact", "true");
    if (title.trim()) params.set("title", title.trim());
    return params.toString();
  }, [theme, category, refresh, compact, title]);

  const embedUrl = `${baseUrl}/embed/equipment-status${query ? `?${query}` : ""}`;

  const iframeSnippet = `<iframe
  src="${embedUrl}"
  title="Melbourne Makerspace — live machine status"
  width="100%"
  height="${height}"
  style="border: 0;"
  loading="lazy"
></iframe>`;

  const dataAttrs = [
    theme !== "light" ? `  data-theme="${theme}"` : null,
    category !== "all" ? `  data-category="${category}"` : null,
    refresh !== EMBED_DEFAULT_REFRESH_SECONDS
      ? `  data-refresh="${refresh}"`
      : null,
    compact ? `  data-compact="true"` : null,
    title.trim() ? `  data-title="${title.trim()}"` : null,
    height !== 480 ? `  data-height="${height}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const scriptSnippet = `<div
  data-cubit-widget="equipment-status"
${dataAttrs ? dataAttrs + "\n" : ""}></div>
<script src="${baseUrl}/embed/widget.js" async></script>`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Widget options</CardTitle>
            <CardDescription>
              Configure the widget, then copy the snippet on the right into any
              website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select
                  value={theme}
                  onValueChange={(v) => setTheme(v as "light" | "dark")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v ?? "all")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="embed-refresh">Refresh (seconds)</Label>
                <Input
                  id="embed-refresh"
                  type="number"
                  min={EMBED_MIN_REFRESH_SECONDS}
                  value={refresh}
                  onChange={(e) =>
                    setRefresh(
                      Math.max(
                        EMBED_MIN_REFRESH_SECONDS,
                        parseInt(e.target.value, 10) ||
                          EMBED_DEFAULT_REFRESH_SECONDS
                      )
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="embed-height">Height (px)</Label>
                <Input
                  id="embed-height"
                  type="number"
                  min={200}
                  value={height}
                  onChange={(e) =>
                    setHeight(Math.max(200, parseInt(e.target.value, 10) || 480))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="embed-title">Custom title</Label>
              <Input
                id="embed-title"
                placeholder={EMBED_DEFAULT_TITLE}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="embed-compact">Compact mode</Label>
                <p className="text-xs text-muted-foreground">
                  Tighter rows, hides machine locations.
                </p>
              </div>
              <Switch
                id="embed-compact"
                checked={compact}
                onCheckedChange={setCompact}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Embed code</CardTitle>
            <CardDescription>
              The iframe works everywhere. The script tag is easier to paste
              into WordPress and auto-sizes options via data attributes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="iframe">
              <TabsList>
                <TabsTrigger value="iframe">iframe</TabsTrigger>
                <TabsTrigger value="script">Script tag</TabsTrigger>
              </TabsList>
              <TabsContent value="iframe" className="space-y-2">
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                  <code>{iframeSnippet}</code>
                </pre>
                <CopyButton text={iframeSnippet} />
              </TabsContent>
              <TabsContent value="script" className="space-y-2">
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                  <code>{scriptSnippet}</code>
                </pre>
                <CopyButton text={scriptSnippet} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Live preview
            <a
              href={embedUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </CardTitle>
          <CardDescription>
            Exactly what visitors will see on the website.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {baseUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title="Embed preview"
              width="100%"
              height={height}
              className="rounded-lg border"
              loading="lazy"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading preview…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
