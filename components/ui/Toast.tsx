"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type ToastVariant = "info" | "ok" | "warn" | "danger";

export interface ToastProps {
  message: ReactNode;
  variant?: ToastVariant;
  onDismiss?: () => void;
  /** Duration in ms before auto-dismiss. 0 = no auto-dismiss. Default 5000. */
  duration?: number;
}

const variantConfig: Record<
  ToastVariant,
  { label: string; border: string; icon: string }
> = {
  info: {
    label: "Information",
    border: "border-[var(--status-info-color)]",
    icon: "ℹ",
  },
  ok: {
    label: "Success",
    border: "border-[var(--status-ok-color)]",
    icon: "✓",
  },
  warn: {
    label: "Warning",
    border: "border-[var(--status-warn-color)]",
    icon: "⚠",
  },
  danger: {
    label: "Error",
    border: "border-[var(--status-danger-color)]",
    icon: "✕",
  },
};

/**
 * Toast notification.
 * - Uses role="status" (polite) for info/ok; role="alert" (assertive) for warn/danger.
 * - Non-colour status: icon glyph + aria-label convey meaning.
 * - Auto-dismisses after `duration` ms unless 0.
 */
export function Toast({
  message,
  variant = "info",
  onDismiss,
  duration = 5000,
}: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfg = variantConfig[variant];
  const isUrgent = variant === "warn" || variant === "danger";

  useEffect(() => {
    if (duration > 0 && onDismiss) {
      timerRef.current = setTimeout(onDismiss, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onDismiss]);

  return (
    <div
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      aria-atomic="true"
      className={[
        "flex items-start gap-3 px-4 py-3",
        "bg-[var(--surface-raised)] rounded-[var(--radius-lg)]",
        "border-l-4 shadow-[var(--shadow-lg)]",
        "text-[length:var(--text-sm)] text-[var(--text-primary)]",
        "max-w-sm w-full",
        cfg.border,
      ].join(" ")}
    >
      <span aria-hidden="true" className="shrink-0 mt-0.5 font-bold text-base">
        {cfg.icon}
      </span>
      <span className="sr-only">{cfg.label}: </span>
      <span className="flex-1 leading-snug">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={[
            "shrink-0 -mt-0.5 -mr-1 p-1 rounded",
            "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
            "transition-colors duration-[var(--duration-fast)]",
          ].join(" ")}
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  );
}
