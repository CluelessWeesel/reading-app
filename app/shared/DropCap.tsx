const AVAILABLE_LETTERS = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));

// Magazine-style illuminated drop cap for the opening paragraph of a
// meaningful text block (a review, a quote) -- never a heading, label, or
// list item. Falls back to plain text if the block doesn't start with a
// letter we have art for (e.g. a review that opens with a quotation mark).
export function DropCapText({ text, className }: { text: string; className?: string }) {
  const trimmed = text.trim();
  const first = trimmed.charAt(0).toUpperCase();

  if (!AVAILABLE_LETTERS.has(first)) {
    return <p className={className}>{text}</p>;
  }

  return (
    <p className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/deco/initials/${first}.png`} alt="" className="drop-cap" />
      {trimmed.slice(1)}
    </p>
  );
}
