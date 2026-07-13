import type { Metadata } from "next";

export const metadata: Metadata = {
  // Embed pages are meant to live inside iframes on other sites,
  // not to be discovered directly.
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
