/**
 * VisuallyHidden — renders children accessibly for screen readers but
 * visually hidden. Used for icon-only buttons, status labels, etc.
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
