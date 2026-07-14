// Satori (which `next/og`'s ImageResponse uses) only accepts ttf/otf/woff,
// not the woff2 Google Fonts serves by default -- the standard workaround is
// requesting the CSS with an old-browser User-Agent, which gets Google to
// respond with a ttf/otf @font-face instead. Fetched at request time rather
// than bundled locally; if the network call fails for any reason this
// returns null and the caller falls back to Satori's default font, so a
// share image never hard-fails just because of a font hiccup.
// Modern UAs (even old-Chrome-string ones) get served woff2, which Satori
// can't parse -- only a genuinely ancient UA (pre-woff-support browsers)
// gets Google's ttf fallback, confirmed by inspecting the raw CSS response.
const LEGACY_USER_AGENT = "Mozilla/5.0 (Linux; U; Android 2.2)";

export async function loadFraunces(text: string, weight: 400 | 600 | 700 = 600): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Fraunces:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_USER_AGENT } }).then((res) => res.text());
    const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}
