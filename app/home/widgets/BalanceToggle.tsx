"use client";

import { useEffect, useState } from "react";
import { InfoTooltip } from "../../shared/InfoTooltip";
import { BALANCE_WINDOWS } from "../balanceMath";
import type { BalanceWindow, BalanceWindowKey } from "../balanceMath";

type Mode = "type" | "format";
const MODE_STORAGE_KEY = "balance-widget-mode";
const WINDOW_STORAGE_KEY = "balance-widget-window";
const WINDOW_LABELS: Record<BalanceWindowKey, string> = { "3": "3mo", "6": "6mo", "12": "12mo" };

// The Type/Format toggle, the 3/6/12-month window toggle, and their
// persisted state are the only interactive parts of this widget, isolated
// to this leaf so BalanceWidget itself can stay a plain server component
// (see GenreDietWidget/GenreDietBar for why that split matters -- a
// "use client" widget here would lose its static .size property when read
// from the server-component page.tsx).
export function BalanceToggle({ windowsByN }: { windowsByN: Record<BalanceWindowKey, BalanceWindow | null> }) {
  const [mode, setMode] = useState<Mode>("type");
  const [windowKey, setWindowKey] = useState<BalanceWindowKey>("6");
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    if (storedMode === "type" || storedMode === "format") setMode(storedMode);
    const storedWindow = localStorage.getItem(WINDOW_STORAGE_KEY);
    if (storedWindow === "3" || storedWindow === "6" || storedWindow === "12") setWindowKey(storedWindow);
  }, []);

  function selectMode(next: Mode) {
    setMode(next);
    setHovered(null);
    localStorage.setItem(MODE_STORAGE_KEY, next);
  }
  function selectWindow(next: BalanceWindowKey) {
    setWindowKey(next);
    setHovered(null);
    localStorage.setItem(WINDOW_STORAGE_KEY, next);
  }

  const balance = windowsByN[windowKey];
  const slices = balance ? (mode === "type" ? balance.typeSlices : balance.formatSlices) : [];
  const active = slices.find((s) => s.key === hovered) ?? null;

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {BALANCE_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => selectWindow(w)}
              disabled={!windowsByN[w]}
              aria-pressed={windowKey === w}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
                windowKey === w ? "bg-accent-violet text-on-accent" : "text-ink-warm-faint hover:text-ink-warm"
              }`}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => selectMode("type")}
            aria-pressed={mode === "type"}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              mode === "type" ? "bg-accent-violet text-on-accent" : "text-ink-warm-faint hover:text-ink-warm"
            }`}
          >
            Type
          </button>
          <button
            type="button"
            onClick={() => selectMode("format")}
            aria-pressed={mode === "format"}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              mode === "format" ? "bg-accent-violet text-on-accent" : "text-ink-warm-faint hover:text-ink-warm"
            }`}
          >
            Format
          </button>
        </div>
      </div>

      {balance ? (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full" onMouseLeave={() => setHovered(null)}>
            {slices.map((s) => (
              <div
                key={s.key}
                onMouseEnter={() => setHovered(s.key)}
                className="cursor-default transition-[filter] duration-150"
                style={{
                  width: `${s.percent}%`,
                  backgroundColor: s.colorVar,
                  opacity: s.opacity,
                  filter: hovered && hovered !== s.key ? "brightness(0.6)" : undefined,
                }}
              />
            ))}
          </div>

          <div className="mt-2 flex min-h-[2.5em] flex-wrap gap-x-3 gap-y-1">
            {slices.map((s) => (
              <button
                key={s.key}
                type="button"
                onMouseEnter={() => setHovered(s.key)}
                onFocus={() => setHovered(s.key)}
                className="flex items-center gap-1 text-[11px]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.colorVar, opacity: s.opacity }}
                />
                <span className={s.key === hovered ? "text-ink-warm" : "text-ink-warm-faint"}>{s.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-1 text-[11px] text-ink-warm-faint">
            {active ? `${active.label}: ${Math.round(active.percent)}%` : balance.diagnosis ?? balance.rangeLabel}
          </p>

          {balance.method === "finishes" && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-warm-faint/70">
              Based on finishes
              <InfoTooltip text="No per-day reading logs across this whole window yet -- each finished book's pages are counted entirely toward its finish date instead of the days actually spent reading it." />
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-ink-warm-faint">Not enough data for this window yet.</p>
      )}
    </>
  );
}
