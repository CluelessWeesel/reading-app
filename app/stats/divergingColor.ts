// A three-stop diverging gradient (green -> white -> red) for heat-mapping
// a value against its own column range. Distinct from rankColor.ts's
// two-stop green-to-coral lerp, which is fine for a short ranked list but
// turns muddy brown around the midpoint over a full column of daily values
// -- routing through white at the midpoint avoids that.
const HIGH = { r: 0x16, g: 0xc7, b: 0x60 }; // brighter green than rankColor's BEST
const MID = { r: 0xff, g: 0xff, b: 0xff };
const LOW = { r: 0xe6, g: 0x7c, b: 0x73 }; // same coral as rankColor's WORST

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// percentile: 1 = highest in column (green), 0.5 = mid (white), 0 = lowest (red).
export function divergingColor(percentile: number): { background: string; color: string } {
  const [from, to, t] =
    percentile >= 0.5 ? [MID, HIGH, (percentile - 0.5) / 0.5] : [LOW, MID, percentile / 0.5];

  const r = lerp(from.r, to.r, t);
  const g = lerp(from.g, to.g, t);
  const b = lerp(from.b, to.b, t);
  const background = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const color = relativeLuminance(r, g, b) > 150 ? "#2b1c0e" : "#fff8ec";
  return { background, color };
}
