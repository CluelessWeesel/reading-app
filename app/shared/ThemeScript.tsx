// Blocking, pre-hydration script: applies a stored theme choice to <html>
// before first paint, so there's no flash of the wrong theme while React
// boots up. Left out entirely (falls through to the prefers-color-scheme
// media query) if the user has never toggled it.
const SCRIPT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
