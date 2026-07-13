import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const nasalization = localFont({
  src: "./fonts/nasalization.otf",
  variable: "--font-nasalization",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Cubit — Melbourne Makerspace",
    template: "%s · Cubit",
  },
  description:
    "Member management for Melbourne Makerspace: members, billing, equipment, waivers, and RFID access.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${nasalization.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
