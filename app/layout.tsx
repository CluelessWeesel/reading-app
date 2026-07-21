import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "./NavBar";
import { NavigationOverlay } from "./shared/NavigationOverlay";
import { ThemeScript } from "./shared/ThemeScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Weeselry",
  description: "A personal reading tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // ThemeScript sets data-theme on this element directly via the DOM,
      // before React hydrates, so the server-rendered markup never has it
      // -- that's an intentional, expected mismatch (the whole point is to
      // avoid a flash of the wrong theme), not a real bug for React to
      // "fix" by stripping the attribute back out during hydration.
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="bg-texture min-h-full flex flex-col">
        <NavBar />
        {children}
        <NavigationOverlay />
      </body>
    </html>
  );
}
