"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Renders after mount only -- the very first paint has no data-theme
// attribute to read yet (that's what ThemeScript's inline script is for),
// so this starts blank rather than guessing and risking a mismatch flash.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setTheme(stored === "dark" || stored === "light" ? stored : systemTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-full px-2 py-1 text-sm text-ink-warm-muted transition hover:bg-hover hover:text-ink-warm"
    >
      {theme == null ? "" : theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
