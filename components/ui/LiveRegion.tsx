"use client";

import { useCallback, type ReactNode } from "react";

/** Stable DOM id for the singleton live region rendered in app/layout.tsx */
export const LIVE_REGION_ID = "nb-live-region";

/**
 * LiveRegion — off-screen ARIA live region for announcing dynamic content to
 * screen readers (e.g. turn results, state changes).
 *
 * Render exactly once, in the root layout. Use useLiveRegion() anywhere in the
 * tree to obtain an `announce` function that writes into this element.
 */
export function LiveRegion({ children }: { children?: ReactNode }) {
  return (
    <div
      id={LIVE_REGION_ID}
      aria-live="polite"
      aria-atomic="true"
      aria-relevant="additions text"
      className="live-region"
      data-testid="live-region"
    >
      {children}
    </div>
  );
}

/**
 * useLiveRegion — returns an `announce(msg)` function that writes into the
 * global LiveRegion element rendered by the root layout.
 *
 * Clears the element first so the same message can be announced twice in a row.
 */
export function useLiveRegion() {
  const announce = useCallback((msg: string) => {
    const el = document.getElementById(LIVE_REGION_ID);
    if (!el) return;
    // Clear then re-set guarantees AT notices the change even for repeated text
    el.textContent = "";
    setTimeout(() => {
      el.textContent = msg;
    }, 50);
  }, []);

  return { announce };
}
