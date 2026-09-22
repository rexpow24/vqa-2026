import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="px-6 pt-5">
          <h1 className="text-sm font-medium tracking-wide text-foreground">
            VQA Clip Pipeline
          </h1>
        </header>
        <Nav />
        <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
