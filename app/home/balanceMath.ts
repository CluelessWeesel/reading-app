export type BalanceSlice = { key: string; label: string; pages: number; percent: number; colorVar: string; opacity: number };

export type BalanceWindow = {
  rangeLabel: string;
  method: "logs" | "finishes";
  typeSlices: BalanceSlice[];
  formatSlices: BalanceSlice[];
  diagnosis: string | null;
};

export type BalanceWindowKey = "3" | "6" | "12";
export const BALANCE_WINDOWS: BalanceWindowKey[] = ["3", "6", "12"];

const TYPE_COLORS: Record<string, string> = {
  physical: "var(--accent-amber)",
  audio: "var(--accent-purple)",
  ebook: "var(--accent-teal)",
};
const TYPE_LABELS: Record<string, string> = { physical: "Physical", audio: "Audiobook", ebook: "Ebook" };

// Audio-family raw formats all share the audio's purple, at different
// shades, so the family still reads at a glance even in the more granular
// Format view -- same for physical/amber and ebook/teal.
const RAW_FORMAT_FAMILY: Record<string, { colorVar: string; shade: number }> = {
  Audible: { colorVar: TYPE_COLORS.audio, shade: 0 },
  Spotify: { colorVar: TYPE_COLORS.audio, shade: 1 },
  Libby: { colorVar: TYPE_COLORS.audio, shade: 2 },
  Book: { colorVar: TYPE_COLORS.physical, shade: 0 },
  "Hardcover Book": { colorVar: TYPE_COLORS.physical, shade: 1 },
  "Library Book": { colorVar: TYPE_COLORS.physical, shade: 2 },
  "Kindle Paperwhite": { colorVar: TYPE_COLORS.ebook, shade: 0 },
  PDF: { colorVar: TYPE_COLORS.ebook, shade: 1 },
};
const SHADE_OPACITIES = [1, 0.7, 0.45];

function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}
function monthLabelOf(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}
// Plain calendar-month arithmetic on a "YYYY-MM" key -- n months before key.
function subtractMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

type MonthBucket = {
  totalPages: number;
  byType: Record<string, number>;
  byRaw: Record<string, number>;
  // Which format_type each raw label belongs to -- needed for the Format
  // view's color fallback when a raw format isn't in RAW_FORMAT_FAMILY.
  rawTypeOf: Record<string, string>;
  hasLogs: boolean;
};

function emptyBucket(): MonthBucket {
  return { totalPages: 0, byType: {}, byRaw: {}, rawTypeOf: {}, hasLogs: false };
}

function addPages(bucket: MonthBucket, pages: number, formatType: string | null, formatRaw: string | null) {
  if (pages <= 0) return;
  bucket.totalPages += pages;
  const typeKey = formatType ?? "unknown";
  bucket.byType[typeKey] = (bucket.byType[typeKey] ?? 0) + pages;
  const rawKey = formatRaw ?? typeKey;
  bucket.byRaw[rawKey] = (bucket.byRaw[rawKey] ?? 0) + pages;
  bucket.rawTypeOf[rawKey] = typeKey;
}

function sliceStyleFor(rawKey: string, typeKey: string): { colorVar: string; opacity: number } {
  const family = RAW_FORMAT_FAMILY[rawKey];
  if (family) return { colorVar: family.colorVar, opacity: SHADE_OPACITIES[family.shade] ?? 1 };
  return { colorVar: TYPE_COLORS[typeKey] ?? "var(--accent-blue)", opacity: 1 };
}

function buildSlices(byKey: Record<string, number>, total: number, labelFor: (key: string) => string, colorFor: (key: string) => { colorVar: string; opacity: number }): BalanceSlice[] {
  return Object.entries(byKey)
    .filter(([, pages]) => pages > 0)
    .map(([key, pages]) => ({
      key,
      label: labelFor(key),
      pages,
      percent: total > 0 ? (pages / total) * 100 : 0,
      ...colorFor(key),
    }))
    .sort((a, b) => b.pages - a.pages);
}

// Sums n consecutive calendar months ending at (and including) endKey.
// method is "logs" only when EVERY month in the window has real per-day
// rows -- a window that's mostly-but-not-entirely backed by logs still
// reads as degraded, rather than silently mixing the two attribution
// methods together without saying so.
function aggregateWindow(buckets: Map<string, MonthBucket>, endKey: string, n: number): MonthBucket & { allLogs: boolean } {
  const agg = emptyBucket();
  let allLogs = true;
  let key = endKey;
  for (let i = 0; i < n; i++) {
    const bucket = buckets.get(key);
    if (bucket) {
      agg.totalPages += bucket.totalPages;
      for (const [k, v] of Object.entries(bucket.byType)) agg.byType[k] = (agg.byType[k] ?? 0) + v;
      for (const [k, v] of Object.entries(bucket.byRaw)) agg.byRaw[k] = (agg.byRaw[k] ?? 0) + v;
      Object.assign(agg.rawTypeOf, bucket.rawTypeOf);
      if (!bucket.hasLogs) allLogs = false;
    } else {
      allLogs = false;
    }
    key = subtractMonths(key, 1);
  }
  return { ...agg, allLogs };
}

// Which n-month stretch leads/trails on audio share, phrased "since
// {month}" against the most recent past stretch of the same length that
// was at least as ear-heavy (or as ear-light) as the current one --
// standard "highest/lowest since X" framing, just parameterized by window
// size instead of always comparing single months.
function computeDiagnosis(
  buckets: Map<string, MonthBucket>,
  currentEndKey: string,
  n: number,
  earliestKey: string
): string | null {
  const currentAgg = aggregateWindow(buckets, currentEndKey, n);
  if (currentAgg.totalPages <= 0) return null;
  const currentShare = (currentAgg.byType.audio ?? 0) / currentAgg.totalPages;

  const past: { key: string; share: number }[] = [];
  let key = subtractMonths(currentEndKey, 1);
  while (key >= earliestKey) {
    const agg = aggregateWindow(buckets, key, n);
    if (agg.totalPages > 0) past.push({ key, share: (agg.byType.audio ?? 0) / agg.totalPages });
    key = subtractMonths(key, 1);
  }
  if (past.length === 0) return null;

  const avgPast = past.reduce((s, h) => s + h.share, 0) / past.length;
  if (currentShare >= avgPast) {
    const since = past.find((h) => h.share >= currentShare);
    return since ? `Most ear-heavy stretch since ${monthLabelOf(since.key)}.` : "Most ear-heavy stretch on record.";
  }
  const since = past.find((h) => h.share <= currentShare);
  return since ? `Least ear-heavy stretch since ${monthLabelOf(since.key)}.` : "Least ear-heavy stretch on record.";
}

function computeWindow(buckets: Map<string, MonthBucket>, currentKey: string, n: number, earliestKey: string): BalanceWindow | null {
  const agg = aggregateWindow(buckets, currentKey, n);
  if (agg.totalPages <= 0) return null;

  const startKey = subtractMonths(currentKey, n - 1);
  const rangeLabel = n === 1 ? monthLabelOf(currentKey) : `${monthLabelOf(startKey)} - ${monthLabelOf(currentKey)}`;

  return {
    rangeLabel,
    method: agg.allLogs ? "logs" : "finishes",
    typeSlices: buildSlices(
      agg.byType,
      agg.totalPages,
      (k) => TYPE_LABELS[k] ?? k,
      (k) => ({ colorVar: TYPE_COLORS[k] ?? "var(--accent-blue)", opacity: 1 })
    ),
    formatSlices: buildSlices(
      agg.byRaw,
      agg.totalPages,
      (k) => k,
      (k) => sliceStyleFor(k, agg.rawTypeOf[k] ?? "physical")
    ),
    diagnosis: computeDiagnosis(buckets, currentKey, n, earliestKey),
  };
}

export function computeBalance(
  books: { format_type: string | null; format_raw: string | null; page_count: number; date_finished: string | null }[],
  formatDailyRows: { date: string; pages: number; format_type: string | null; format_raw: string | null }[],
  today: string
): Record<BalanceWindowKey, BalanceWindow | null> {
  const buckets = new Map<string, MonthBucket>();

  for (const r of formatDailyRows) {
    const key = monthKeyOf(r.date);
    const bucket = buckets.get(key) ?? emptyBucket();
    bucket.hasLogs = true;
    addPages(bucket, r.pages, r.format_type, r.format_raw);
    buckets.set(key, bucket);
  }

  // Finishes-based figures are only used for months that have no real
  // per-day logs at all -- a month with even partial logs keeps its logged
  // figures rather than mixing two attribution methods together.
  const finishesBuckets = new Map<string, MonthBucket>();
  for (const b of books) {
    if (!b.date_finished || b.page_count <= 0) continue;
    const key = monthKeyOf(b.date_finished);
    const bucket = finishesBuckets.get(key) ?? emptyBucket();
    addPages(bucket, b.page_count, b.format_type, b.format_raw);
    finishesBuckets.set(key, bucket);
  }
  for (const [key, bucket] of finishesBuckets) {
    if (!buckets.has(key)) buckets.set(key, bucket);
  }

  if (buckets.size === 0) return { "3": null, "6": null, "12": null };

  const currentKey = monthKeyOf(today);
  const earliestKey = Array.from(buckets.keys()).sort()[0];

  return {
    "3": computeWindow(buckets, currentKey, 3, earliestKey),
    "6": computeWindow(buckets, currentKey, 6, earliestKey),
    "12": computeWindow(buckets, currentKey, 12, earliestKey),
  };
}
