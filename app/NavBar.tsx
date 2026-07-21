"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fraunces } from "./shared/fonts";
import { ThemeToggle } from "./shared/ThemeToggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/log", label: "Log" },
  { href: "/tbr", label: "TBR" },
  { href: "/library", label: "Library" },
  { href: "/authors", label: "Authors" },
  { href: "/rankings", label: "Rankings" },
  { href: "/stats", label: "Stats" },
  { href: "/weesels", label: "Weesels" },
  { href: "/stories", label: "Stories" },
];

export function NavBar() {
  const pathname = usePathname();

  if (pathname === "/unlock") return null;

  return (
    <nav className="border-b border-gold bg-surface-2 px-4 py-3 backdrop-blur-sm transition-colors duration-300 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <Link href="/" className={`${fraunces.className} mr-2 text-lg font-semibold text-ink-warm no-underline hover:no-underline`}>
          The Weeselry
        </Link>
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1 text-sm no-underline transition hover:no-underline ${
                active ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
