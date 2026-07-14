// A pure-CSS hover tooltip -- native title-attribute tooltips depend on the
// OS/browser's own delay and sometimes just don't fire, so this uses
// Tailwind's group-hover instead for an instant, reliable show/hide.
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group/info relative inline-flex shrink-0">
      <span
        aria-label={text}
        tabIndex={0}
        className="cursor-help text-[10px] leading-none text-ink-faint/70 hover:text-ink focus:text-ink"
      >
        ⓘ
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-48 whitespace-pre-line rounded-md border border-hairline bg-card p-2 text-[11px] font-normal normal-case leading-snug text-ink shadow-md group-hover/info:block group-focus-within/info:block"
      >
        {text}
      </span>
    </span>
  );
}
