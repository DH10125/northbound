/**
 * SkipNav — keyboard-accessible skip-to-main-content link.
 * Visually hidden until focused; appears at top-left on Tab.
 */
export function SkipNav({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a href={`#${targetId}`} className="skip-nav">
      Skip to main content
    </a>
  );
}
