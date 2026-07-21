"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingSpinner } from "./LoadingSpinner";

// A global "you're navigating" indicator that floats over the CURRENT page
// rather than replacing it -- unlike a route's loading.tsx, which is a
// Suspense fallback that unmounts the old page's content entirely while
// the new one loads. There's no public "is any navigation pending" hook
// in the App Router (useLinkStatus only tracks one specific <Link>), so
// this uses the same pattern as most on-page nav-progress indicators:
// watch for a click on an internal link, show the overlay, then hide it
// once the URL actually changes (proof the new page has taken over).
//
// MIN_VISIBLE_MS exists because Next prefetches linked routes -- a
// navigation between two already-prefetched pages can complete in a single
// frame, which without a floor would set pending true then false before
// the browser ever paints it, i.e. it would never visibly show at all.
const MIN_VISIBLE_MS = 400;
const SAFETY_TIMEOUT_MS = 8000;

export function NavigationOverlay() {
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  const shownAtRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Not checking e.defaultPrevented here -- Next's <Link> always calls
      // preventDefault() to do its own client-side navigation instead of a
      // real browser load, and it does so before this listener (attached
      // to document, so it fires after React's own handling) ever runs.
      // Checking that flag meant this bailed out on literally every Link
      // click, every time -- the overlay never showed at all.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      shownAtRef.current = Date.now();
      setPending(true);
      // If the pathname never changes (a failed navigation, a click that
      // got intercepted), don't leave the overlay stuck up forever.
      safetyTimerRef.current = setTimeout(() => {
        shownAtRef.current = null;
        setPending(false);
      }, SAFETY_TIMEOUT_MS);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // The URL actually changing is the real signal that the new page has
  // taken over. Guard on shownAtRef so this doesn't fire spuriously on
  // mount or on a pathname change that wasn't preceded by a tracked click.
  useEffect(() => {
    if (shownAtRef.current == null) return;
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);

    const elapsed = Date.now() - shownAtRef.current;
    const remaining = MIN_VISIBLE_MS - elapsed;
    if (remaining <= 0) {
      shownAtRef.current = null;
      setPending(false);
      return;
    }
    hideTimerRef.current = setTimeout(() => {
      shownAtRef.current = null;
      setPending(false);
    }, remaining);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <LoadingSpinner size={72} />
    </div>
  );
}
