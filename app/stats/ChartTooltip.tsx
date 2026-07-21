// Shared floating hover "board" for the bigger hand-rolled chart sections
// (publication scatter, pages/day scatter, monthly volume) -- a small
// positioned card near the cursor, replacing plain caption text below the
// chart. The parent chart must wrap its <svg> in a `relative` container and
// track hover position in that container's own coordinate space (e.g. via
// e.clientX/clientY minus the container's getBoundingClientRect()).
export function ChartTooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[9rem] max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-lg border border-gold bg-surface-1 px-2.5 py-2 text-xs text-ink-warm shadow-lg"
      style={{ left: x, top: y - 10 }}
    >
      {children}
    </div>
  );
}
