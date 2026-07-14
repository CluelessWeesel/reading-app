"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/log", label: "Log" },
  { href: "/tbr", label: "TBR" },
  { href: "/library", label: "Library" },
  { href: "/authors", label: "Authors" },
  { href: "/rankings", label: "Rankings" },
  { href: "/stats", label: "Stats" },
  { href: "/weesels", label: "Weesels" },
];

export function NavBar() {
  const pathname = usePathname();

  if (pathname === "/unlock") return null;

  return (
    <nav className="border-b border-hairline bg-paper px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1 text-sm transition ${
                active ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
