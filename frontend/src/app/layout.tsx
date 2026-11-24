import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { PlatformNav } from "@/components/PlatformNav";
import { currentProfile } from "@/lib/supabase/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VQA Clip Pipeline",
  description: "Vietnamese traffic clip review pipeline",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const hosted = process.env.VERCEL === "1" || process.env.PLATFORM_MODE === "hosted";
  const profile = hosted ? await currentProfile() : null;
  return (
    // suppressHydrationWarning on <html> and <body>: browser extensions add attributes there (seen:
    // class "mdl-js" on <html>, ColorZilla's cz-shortcut-listen on <body>), which React reports as a
    // hydration mismatch. It covers each element's own attributes only, not its children.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <header className="px-6 pt-5">
          <h1 className="text-sm font-medium tracking-wide text-foreground">
            VQA Clip Pipeline
          </h1>
        </header>
        {hosted ? <PlatformNav profile={profile} /> : <Nav />}
        {/* A page that needs the room (the labeling page: a 60vh video beside nine cards) opts in with data-wide. */}
        <main className="flex-1 w-full max-w-5xl has-[[data-wide]]:max-w-[1920px] mx-auto px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
