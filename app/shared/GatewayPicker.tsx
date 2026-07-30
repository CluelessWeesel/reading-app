"use client";

import { useEffect, useState } from "react";
import { BookCombobox, type BookComboboxItem } from "./BookCombobox";
import { CoverThumb } from "./CoverThumb";
import { fieldClass, modalLabelClass } from "./formControls";

export type GatewayValue = {
  gateway_book_id: number | null;
  gateway_person: string;
  gateway_source: string;
  gateway_note: string;
};

export type ResolvedGatewayBook = {
  title: string;
  author: string | null;
  cover_url: string | null;
};

type Mode = "book" | "person" | "source";

function initialModeFor(value: GatewayValue): Mode {
  if (value.gateway_book_id) return "book";
  if (value.gateway_person) return "person";
  if (value.gateway_source) return "source";
  return "book";
}

// "I read this because of ___" -- reused wherever a gateway gets captured or
// edited (TBR add/edit, a book's dossier, backfill triage). Controlled:
// the host owns persistence and just gets a GatewayValue back on every
// genuine interaction, so it can also track "was this touched at all this
// session" for gateway_checked_at bookkeeping (see the API routes).
// gateway_book_id/gateway_person/gateway_source are mutually exclusive by
// construction here (mirroring the DB's check constraint) -- picking one
// clears the other two. gateway_note is independent of all three.
export function GatewayPicker({
  value,
  onChange,
  initialBook = null,
  onFoundItMyself,
  foundItMyselfDisabled = false,
}: {
  value: GatewayValue;
  onChange: (next: GatewayValue) => void;
  initialBook?: ResolvedGatewayBook | null;
  // Fires after the local value is cleared -- lets a single-decision host
  // (backfill triage) treat the click as complete and save immediately,
  // instead of leaving it as a staged value that needs an explicit Save.
  // Without this, clicking "Found it myself" on a book that was already
  // untouched (the common case) clears fields that were already empty --
  // a genuine no-op with zero visible feedback.
  onFoundItMyself?: () => void;
  foundItMyselfDisabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(() => initialModeFor(value));
  const [pickedBook, setPickedBook] = useState<ResolvedGatewayBook | null>(initialBook);
  const [noteOpen, setNoteOpen] = useState(Boolean(value.gateway_note));
  const [suggestions, setSuggestions] = useState<{ people: string[]; sources: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/gateways/suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestions({ people: data.people ?? [], sources: data.sources ?? [] }))
      .catch(() => setSuggestions({ people: [], sources: [] }));
  }, []);

  const isEmpty = !value.gateway_book_id && !value.gateway_person && !value.gateway_source;

  function selectBook(item: BookComboboxItem) {
    setPickedBook({ title: item.title, author: item.author, cover_url: item.cover_url });
    onChange({ gateway_book_id: item.id, gateway_person: "", gateway_source: "", gateway_note: value.gateway_note });
  }

  function changeBook() {
    setPickedBook(null);
    onChange({ ...value, gateway_book_id: null });
  }

  function setPerson(text: string) {
    onChange({ gateway_book_id: null, gateway_person: text, gateway_source: "", gateway_note: value.gateway_note });
  }

  function setSource(text: string) {
    onChange({ gateway_book_id: null, gateway_person: "", gateway_source: text, gateway_note: value.gateway_note });
  }

  function setNote(text: string) {
    onChange({ ...value, gateway_note: text });
  }

  function foundItMyself() {
    setPickedBook(null);
    onChange({ gateway_book_id: null, gateway_person: "", gateway_source: "", gateway_note: value.gateway_note });
    onFoundItMyself?.();
  }

  return (
    <div>
      <span className={modalLabelClass()}>What led you here?</span>

      <div className="mb-3 flex gap-1 rounded-full border border-gold bg-surface-1 p-1 shadow-sm">
        {(["book", "person", "source"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full px-3 py-1 text-sm capitalize transition ${
              mode === m ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "book" &&
        (pickedBook ? (
          <div className="flex items-center justify-between rounded-lg border border-gold bg-surface-1 px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <CoverThumb title={pickedBook.title} coverUrl={pickedBook.cover_url} className="aspect-[2/3] w-10" />
              <div>
                <p className="font-medium text-ink-warm">{pickedBook.title}</p>
                {pickedBook.author && <p className="text-xs text-ink-warm-faint">{pickedBook.author}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={changeBook}
              className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
            >
              Change
            </button>
          </div>
        ) : (
          <BookCombobox onSelect={selectBook} placeholder="Search your library..." />
        ))}

      {mode === "person" && (
        <div>
          <input
            type="text"
            value={value.gateway_person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="e.g. Dad, Sam from Discord..."
            className={fieldClass()}
          />
          {suggestions && suggestions.people.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.people.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPerson(p)}
                  className="rounded-full border border-gold bg-surface-1 px-2.5 py-1 text-xs text-ink-warm-muted transition hover:bg-surface-2 hover:text-ink-warm"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "source" && (
        <div>
          <input
            type="text"
            value={value.gateway_source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. BookTube, cover caught my eye..."
            className={fieldClass()}
          />
          {suggestions && suggestions.sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.sources.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className="rounded-full border border-gold bg-surface-1 px-2.5 py-1 text-xs text-ink-warm-muted transition hover:bg-surface-2 hover:text-ink-warm"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 text-xs">
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className="text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
        >
          {noteOpen ? "− Also inspired by…" : "+ Also inspired by…"}
        </button>
        {noteOpen && (
          <input
            type="text"
            value={value.gateway_note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. also nudged by a podcast"
            className={`${fieldClass()} mt-2`}
          />
        )}
      </div>

      <button
        type="button"
        onClick={foundItMyself}
        disabled={foundItMyselfDisabled}
        className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 ${
          isEmpty
            ? "border-gold-strong bg-surface-1 text-ink-warm"
            : "border-dashed border-gold-strong text-ink-warm-muted hover:bg-surface-1 hover:text-ink-warm"
        }`}
      >
        Found it myself — no gateway
      </button>
    </div>
  );
}
