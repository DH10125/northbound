"use client";

import { useRef, type ReactNode } from "react";

/**
 * LiveRegion — an off-screen ARIA live region for announcing dynamic
 * content to screen readers (e.g., turn results, state changes).
 *
 * Usage:
 *   const ref = useLiveRegion();
 *   ref.announce("You found 3 litres of water.");
 */
export function LiveRegion({ children }: { children?: ReactNode }) {
  return (
    <div
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

export type LiveRegionHandle = { announce: (msg: string) => void };

export function useLiveRegion() {
  const ref = useRef<HTMLDivElement>(null);

  function announce(msg: string) {
    const el = ref.current;
    if (!el) return;
    // Clear then re-set to guarantee announcement even if message repeats
    el.textContent = "";
    // Defer to next microtask so screen readers notice the change
    setTimeout(() => {
      el.textContent = msg;
    }, 50);
  }

  return { ref, announce };
}
