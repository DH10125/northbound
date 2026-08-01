export type StatusValue = "ok" | "warn" | "danger" | "info" | "neutral";

export interface StatusBadgeProps {
  status: StatusValue;
  label: string;
  /** Optional numeric value to display alongside the label */
  value?: string | number;
}

const statusText: Record<StatusValue, string> = {
  ok: "text-[var(--status-ok-color)]",
  warn: "text-[var(--status-warn-color)]",
  danger: "text-[var(--status-danger-color)]",
  info: "text-[var(--status-info-color)]",
  neutral: "text-[var(--status-neutral-color)]",
};

/**
 * StatusBadge — non-colour status indicator.
 * Communicates status via shape (CSS ::before), colour, and visible text label.
 * The status word ("ok", "warn", etc.) is always rendered visually and for AT.
 */
export function StatusBadge({ status, label, value }: StatusBadgeProps) {
  return (
    <span
      className={[
        "status-indicator",
        statusText[status],
      ].join(" ")}
      data-status={status}
      aria-label={value !== undefined ? `${label}: ${value}` : label}
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
