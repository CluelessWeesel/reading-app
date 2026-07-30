"use client";

import { useState } from "react";
import { fraunces } from "../shared/fonts";
import { CoverThumb } from "../shared/CoverThumb";
import { GatewayPicker, type GatewayValue } from "../shared/GatewayPicker";
import type { Book } from "../shared/bookTypes";

const EMPTY_GATEWAY: GatewayValue = { gateway_book_id: null, gateway_person: "", gateway_source: "", gateway_note: "" };

// Deals untraced books (gateway_checked_at is null) one at a time, same
// house pattern as tbr's MakeCallsFlow. The queue is whatever the library
// page already had loaded, filtered + recency-sorted client-side. Skip is a
// genuine no-op -- no request at all, the book simply comes back next time
// "Trace gateways" runs. "Save & next" and "Found it myself" both stamp
// gateway_checked_at (via the narrow gateway endpoint) and remove the book
// from future runs -- "Found it myself" saves and advances immediately
// (see saveFoundItMyself) rather than staging a value for a separate Save
// click, since on a fresh book the fields are already empty and a second
// "clear the already-empty fields" click would be indistinguishable from
// doing nothing.
export function GatewayTriageFlow({
  initialQueue,
  onTraced,
  onDone,
}: {
  initialQueue: Book[];
  onTraced: (book: Book) => void;
  onDone: () => void;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [gateway, setGateway] = useState<GatewayValue>(EMPTY_GATEWAY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalEligible] = useState(initialQueue.length);

  const current = queue[0] ?? null;
  const doneSoFar = totalEligible - queue.length;

  function advance() {
    setQueue((prev) => prev.slice(1));
    setGateway(EMPTY_GATEWAY);
    setError(null);
  }

  async function persist(overrides?: Partial<Pick<GatewayValue, "gateway_book_id" | "gateway_person" | "gateway_source">>) {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${current.book_id}/gateway`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway_book_id: overrides?.gateway_book_id ?? gateway.gateway_book_id,
          gateway_person: (overrides?.gateway_person ?? gateway.gateway_person).trim() || null,
          gateway_source: (overrides?.gateway_source ?? gateway.gateway_source).trim() || null,
          gateway_note: gateway.gateway_note.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed.");
      onTraced({ ...current, ...body });
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function save() {
    return persist();
  }

  // "Found it myself" is a complete, one-click decision in triage (unlike
  // the bigger TBR/edit-book forms GatewayPicker also appears in) -- it
  // saves and advances immediately rather than staging a value that then
  // needs an explicit "Save & next", which on a fresh (already-empty) book
  // would otherwise look like the click did nothing at all.
  function saveFoundItMyself() {
    return persist({ gateway_book_id: null, gateway_person: "", gateway_source: "" });
  }

  if (!current) {
    return (
      <div className="story-theme-night story-card-bg fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-ink-warm">
        <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">All traced</p>
        <h1 className={`${fraunces.className} mt-3 text-3xl font-semibold text-gold-ink sm:text-4xl`}>
          {doneSoFar} book{doneSoFar === 1 ? "" : "s"} traced
        </h1>
        <button
          type="button"
          onClick={onDone}
          className="mt-8 rounded-full bg-accent px-8 py-3 text-base font-semibold text-on-accent shadow-sm"
        >
          Back to library
        </button>
      </div>
    );
  }

  return (
    <div className="story-theme-night story-card-bg fixed inset-0 z-50 flex flex-col text-ink-warm">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-8">
        <p className="text-xs uppercase tracking-wide opacity-60">
          {doneSoFar} of {totalEligible} traced
        </p>
        <button type="button" onClick={onDone} className="text-xs opacity-60 transition hover:opacity-100">
          Exit
        </button>
      </div>

      {/* items-center + justify-center here would clip the top of this block
          out of reach of scrolling once it grows past viewport height (a
          well-known flexbox trap: centering an overflowing scroll container
          hides the "before center" overflow with no way to scroll to it).
          m-auto on the inner block centers it the same way when it fits,
          but degrades to a normal top-anchored, fully-scrollable block once
          it doesn't -- e.g. once the book combobox's result list renders. */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-6 text-center">
        <div className="m-auto w-full max-w-sm">
          <CoverThumb
            title={current.title}
            coverUrl={current.cover_url}
            className="mx-auto aspect-[2/3] w-40 shadow-2xl sm:w-48"
          />
          <h2 className={`${fraunces.className} mt-6 text-2xl font-semibold sm:text-3xl`}>{current.title}</h2>
          {current.author && <p className="mt-1 text-sm opacity-70">{current.author}</p>}
          <p className="mt-1 text-xs opacity-50">
            {current.genre ?? "No genre"}
            {current.page_count != null ? ` · ${current.page_count} pg` : ""}
          </p>

          <div className="mt-8 w-full rounded-xl border border-white/15 bg-black/20 p-5 text-left">
            <GatewayPicker
              key={current.book_id}
              value={gateway}
              onChange={setGateway}
              onFoundItMyself={saveFoundItMyself}
              foundItMyselfDisabled={saving}
            />

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={advance}
                disabled={saving}
                className="text-xs text-white/50 underline decoration-dotted underline-offset-4 hover:text-white/80 disabled:opacity-50"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-full bg-accent px-6 py-2 text-sm font-semibold text-on-accent shadow-sm transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save & next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
