"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldClass, labelClass, selectClass } from "../shared/formControls";
import { todayLocalIso } from "../shared/isoDate";
import type { StoryType } from "./types";

function defaultPeriod(storyType: StoryType, today: string): string {
  return storyType === "wrapped" ? today.slice(0, 4) : today.slice(0, 7);
}

export function NewStoryForm() {
  const router = useRouter();
  const today = todayLocalIso();
  const [storyType, setStoryType] = useState<StoryType>("recap");
  const [period, setPeriod] = useState(defaultPeriod("recap", today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeType(next: StoryType) {
    setStoryType(next);
    setPeriod(defaultPeriod(next, today));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story_type: storyType, period }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && body.id) {
          router.push(`/stories/${body.id}`);
          return;
        }
        throw new Error(body.error || "Failed to generate.");
      }
      router.push(`/stories/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <label className={labelClass()} htmlFor="story-type">Type</label>
        <select
          id="story-type"
          className={selectClass()}
          value={storyType}
          onChange={(e) => changeType(e.target.value as StoryType)}
        >
          <option value="recap">Monthly recap</option>
          <option value="wrapped">Wrapped (yearly)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass()} htmlFor="story-period">
          {storyType === "wrapped" ? "Year" : "Month"}
        </label>
        <input
          id="story-period"
          type={storyType === "wrapped" ? "number" : "month"}
          className={fieldClass()}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          min={storyType === "wrapped" ? 2023 : undefined}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent transition disabled:opacity-50"
      >
        {saving ? "Generating..." : "Generate"}
      </button>

      {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
