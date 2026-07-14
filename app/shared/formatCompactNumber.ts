// Formats a count compactly, e.g. 41200000 -> "41.2M".
export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
