import { fraunces } from "@/app/shared/fonts";
import { CoverThumb } from "@/app/shared/CoverThumb";
import type { QueuedEntry } from "./types";

export function QueuedStrip({ entries }: { entries: QueuedEntry[] }) {
  return (
    <div>
      <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink-warm`}>
        Queued <span className="text-sm font-normal text-ink-warm-faint">({entries.length})</span>
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <div key={entry.id} className="flex w-20 shrink-0 flex-col gap-1">
            <CoverThumb title={entry.title} coverUrl={entry.cover_url} className="aspect-[2/3] w-20" />
            <p className="truncate text-xs text-ink-warm-faint">{entry.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
