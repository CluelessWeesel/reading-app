import type { ReactNode } from "react";
import { fraunces } from "../shared/fonts";

// Shared chrome for a /stats section -- new sections just wrap their content
// in this for a consistent title + spacing, rather than repeating heading
// markup per section.
export function SectionShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className={`${fraunces.className} mb-3 text-xl font-semibold text-ink`}>{title}</h2>
      {children}
    </section>
  );
}
