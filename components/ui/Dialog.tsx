"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional label for the primary close/confirm button */
  closeLabel?: string;
}

/**
 * Accessible dialog using the native <dialog> element.
 * - Traps focus inside when open.
 * - Escape key closes.
 * - Announces title via aria-labelledby and description via aria-describedby.
 * - No animations that gate input; motion respects prefers-reduced-motion.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  closeLabel = "Close",
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useRef(
    `dialog-title-${Math.random().toString(36).slice(2)}`,
  );
  const descId = useRef(`dialog-desc-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId.current}
      aria-describedby={description ? descId.current : undefined}
      className={[
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        "bg-[var(--surface-raised)] text-[var(--text-primary)]",
        "rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)]",
        "border border-[var(--surface-border)]",
        "w-full max-w-lg mx-auto p-6",
        "open:flex open:flex-col open:gap-4",
      ].join(" ")}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <h2
          id={titleId.current}
          className="text-[length:var(--text-xl)] font-semibold text-[var(--text-primary)] leading-snug"
        >
          {title}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close dialog"
          className="shrink-0 -mt-0.5 -mr-1"
        >
          ✕
        </Button>
      </div>

      {description && (
        <p
          id={descId.current}
          className="text-[length:var(--text-sm)] text-[var(--text-secondary)]"
        >
          {description}
        </p>
      )}

      <div className="flex-1">{children}</div>

      <div className="flex justify-end pt-2">
        <Button variant="secondary" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </dialog>
  );
}
