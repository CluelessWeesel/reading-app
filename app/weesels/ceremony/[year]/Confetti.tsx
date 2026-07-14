"use client";

import { useEffect, useState } from "react";

const COLORS = ["#f59e0b", "#56bb89", "#e67c73", "#6b8fd6", "#c77dd6"];

type Piece = { id: number; left: number; delay: number; duration: number; color: string };

// Restrained, not a screensaver -- ~24 small pieces, cleared after ~2s.
// Re-fires whenever `trigger` changes (bump a counter on each reveal).
export function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const next = Array.from({ length: 24 }).map((_, i) => ({
      id: trigger * 1000 + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.15,
      duration: 1.1 + Math.random() * 0.6,
      color: COLORS[i % COLORS.length],
    }));
    setPieces(next);
    const timer = setTimeout(() => setPieces([]), 2000);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="animate-confetti-fall absolute top-[-10px] block h-2.5 w-1.5 rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
