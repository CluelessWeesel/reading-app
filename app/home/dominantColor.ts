// Color math for the Home altar panels' sampled backgrounds. No image
// dependency exists in this project (covers come from arbitrary external
// hosts, not something this app processes itself), so extraction happens
// client-side via canvas rather than pulling in a server-side image lib.

export const FALLBACK_DEEP_COLOR = "#241c14";

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d) % 6;
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r1, g1, b1] = [0, 0, 0];
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

// Forces a color into the altar's "deep background" range -- capped
// lightness, and a saturation floor so a near-grey average doesn't read as
// muddy -- while keeping the hue that actually came from the cover, so two
// different covers still land on two visibly different backgrounds.
const MAX_LIGHTNESS = 0.22;
const MIN_SATURATION = 0.25;

export function deepenColor(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  const [dr, dg, db] = hslToRgb(h, Math.max(s, MIN_SATURATION), Math.min(l, MAX_LIGHTNESS));
  return toHex(dr, dg, db);
}

// Quantizes every opaque pixel into a coarse RGB bucket and returns the
// most-frequent bucket's own averaged color, deepened for altar use -- a
// simple, well-known "poor man's dominant color" technique: cheap, no
// dependency, good enough for a background tint rather than a precise
// palette extraction.
const BUCKET_SIZE = 24;
const ALPHA_THRESHOLD = 200;

export function extractDominantColor(imageData: ImageData): string | null {
  const { data } = imageData;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_THRESHOLD) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / BUCKET_SIZE)}-${Math.round(g / BUCKET_SIZE)}-${Math.round(b / BUCKET_SIZE)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      existing.r += r;
      existing.g += g;
      existing.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) return null;

  return deepenColor(Math.round(best.r / best.count), Math.round(best.g / best.count), Math.round(best.b / best.count));
}

// Draws an already-loaded image to an offscreen canvas and extracts its
// dominant color. Returns null on any failure -- most notably a tainted
// canvas from a cover host that doesn't send permissive CORS headers,
// which is expected to happen sometimes since covers come from whatever
// URL was pasted in; callers fall back to FALLBACK_DEEP_COLOR.
export function extractDominantColorFromImage(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    const size = 48; // a small sample is plenty for a bucketed average
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    return extractDominantColor(ctx.getImageData(0, 0, size, size));
  } catch {
    return null;
  }
}
