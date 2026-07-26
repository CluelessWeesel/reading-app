import type { TierId } from "./types";

// Single source of truth for tier -> accent color, shared by the board
// itself and every tier-stats visualization -- keeps the same tier always
// reading as the same color everywhere in the app.
export const TIER_LABEL_CLASS: Record<TierId, string> = {
  S: "text-gold-ink",
  A: "text-accent-purple",
  B: "text-accent-blue",
  C: "text-accent-teal",
  D: "text-accent-coral",
  E: "text-accent-amber",
  F: "text-accent-pink",
  holding: "text-ink-warm-faint",
};

export const TIER_BG_CLASS: Record<TierId, string> = {
  S: "bg-gold-ink",
  A: "bg-accent-purple",
  B: "bg-accent-blue",
  C: "bg-accent-teal",
  D: "bg-accent-coral",
  E: "bg-accent-amber",
  F: "bg-accent-pink",
  holding: "bg-ink-warm-faint",
};

export function tierLabel(tier: TierId): string {
  return tier === "holding" ? "Holding" : tier;
}
