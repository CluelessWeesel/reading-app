// A continuous green-to-red gradient by relative position in the year's
// ranked list -- rank 1 (best) is green, the bottom of the list is red.
const BEST = { r: 0x56, g: 0xbb, b: 0x89 }; // #56bb89
const WORST = { r: 0xe6, g: 0x7c, b: 0x73 }; // #e67c73

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

// Perceived brightness (ITU-R BT.601) decides whether dark or light text
// reads better on the interpolated background.
function relativeLuminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function rankColor(rank: number, total: number): { background: string; color: string } {
  const percentile = total > 1 ? 1 - (rank - 1) / (total - 1) : 1; // 1 = best (rank 1), 0 = worst
  const r = lerp(WORST.r, BEST.r, percentile);
  const g = lerp(WORST.g, BEST.g, percentile);
  const b = lerp(WORST.b, BEST.b, percentile);
  const background = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const color = relativeLuminance(r, g, b) > 150 ? "#2b1c0e" : "#fff8ec";
  return { background, color };
}
