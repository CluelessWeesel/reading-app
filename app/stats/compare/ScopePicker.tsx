"use client";

import { labelClass, selectClass } from "@/app/shared/formControls";
import type { CompareScope } from "./compareScopeMath";

function scopeKey(s: CompareScope): string {
  if (s.kind === "all") return "all";
  if (s.kind === "projection") return `proj-${s.year}`;
  return String(s.year);
}

function parseScopeKey(key: string): CompareScope {
  if (key === "all") return { kind: "all" };
  if (key.startsWith("proj-")) return { kind: "projection", year: Number(key.slice(5)) };
  return { kind: "year", year: Number(key) };
}

function ScopeSelect({
  id,
  label,
  value,
  onChange,
  years,
  currentYear,
}: {
  id: string;
  label: string;
  value: CompareScope;
  onChange: (scope: CompareScope) => void;
  years: number[];
  currentYear: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass()} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={selectClass()}
        value={scopeKey(value)}
        onChange={(e) => onChange(parseScopeKey(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
        <option value="all">All-time</option>
        {/* Projection only makes sense for the year still in progress --
            for any completed year it'd just reproduce the actual total. */}
        {years.includes(currentYear) && <option value={`proj-${currentYear}`}>{currentYear} (projected)</option>}
      </select>
    </div>
  );
}

export function ScopePicker({
  left,
  right,
  onLeftChange,
  onRightChange,
  years,
  currentYear,
}: {
  left: CompareScope;
  right: CompareScope;
  onLeftChange: (scope: CompareScope) => void;
  onRightChange: (scope: CompareScope) => void;
  years: number[];
  currentYear: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <ScopeSelect id="compare-left" label="Left" value={left} onChange={onLeftChange} years={years} currentYear={currentYear} />
      <span className="pb-2 text-sm text-ink-warm-faint">vs</span>
      <ScopeSelect id="compare-right" label="Right" value={right} onChange={onRightChange} years={years} currentYear={currentYear} />
    </div>
  );
}
