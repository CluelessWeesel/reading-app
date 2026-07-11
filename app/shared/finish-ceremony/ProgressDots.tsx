"use client";

export function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full ${i <= current ? "bg-accent" : "bg-hairline"}`} />
      ))}
    </div>
  );
}
