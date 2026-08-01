export type StatusValue = "ok" | "warn" | "danger" | "info" | "neutral";

export interface StatusBadgeProps {
  status: StatusValue;
  label: string;
  /** Optional value to display alongside the label (e.g. "82%" or "Low") */
  value?: string | number;
}

/**
 * Human-readable equivalents for each status value.
 * Included in the accessible name so screen readers convey meaning without
 * relying on colour or shape alone.
 */
const statusLabel: Record<StatusValue, string> = {
  ok: "Good",
  warn: "Warning",
  danger: "Critical",
  info: "Info",
  neutral: "Neutral",
};

const statusTextColor: Record<StatusValue, string> = {
  ok: "text-[var(--status-ok-color)]",
  warn: "text-[var(--status-warn-color)]",
  danger: "text-[var(--status-danger-color)]",
  info: "text-[var(--status-info-color)]",
  neutral: "text-[var(--status-neutral-color)]",
};

/**
 * StatusBadge — non-colour status indicator.
 *
 * Communicates status via three independent channels so that colour is never
 * the sole signal (WCAG 1.4.1):
 *   1. Shape — CSS ::before pseudo-element shape differs per status level.
 *   2. Colour — token-based colour per status level.
 *   3. Accessible name — aria-label includes the human-readable status word
 *      ("Good", "Warning", "Critical", "Info", "Neutral") so that screen
 *      readers convey the semantic meaning regardless of visual rendering.
 *
 * aria-label format: "{statusLabel}: {label}" or "{statusLabel}: {label}: {value}"
 */
export function StatusBadge({ status, label, value }: StatusBadgeProps) {
  const humanStatus = statusLabel[status];
  const ariaLabel =
    value !== undefined
      ? `${humanStatus}: ${label}: ${value}`
      : `${humanStatus}: ${label}`;

  return (
    <span
      className={["status-indicator", statusTextColor[status]].join(" ")}
      data-status={status}
      aria-label={ariaLabel}
    >
      <span aria-hidden="true">
        {label}
        {value !== undefined && (
          <span className="ml-1 font-bold">{value}</span>
        )}
      </span>
    </span>
  );
}
