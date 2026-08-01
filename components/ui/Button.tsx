import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    "bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)]",
    "hover:bg-[var(--interactive-primary-hover)]",
    "border border-transparent",
  ].join(" "),
  secondary: [
    "bg-transparent text-[var(--text-primary)]",
    "border border-[var(--interactive-secondary-border)]",
    "hover:bg-[var(--interactive-secondary-hover)]",
  ].join(" "),
  danger: [
    "bg-[var(--interactive-danger)] text-[var(--interactive-primary-text)]",
    "hover:bg-[var(--interactive-danger-hover)]",
    "border border-transparent",
  ].join(" "),
  ghost: [
    "bg-transparent text-[var(--text-secondary)]",
    "border border-transparent",
    "hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
  ].join(" "),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[length:var(--text-sm)] rounded-[var(--radius-md)]",
  md: "px-4 py-2 text-[length:var(--text-base)] rounded-[var(--radius-md)]",
  lg: "px-5 py-2.5 text-[length:var(--text-lg)] rounded-[var(--radius-lg)]",
};

/**
 * Primary interactive element with keyboard and screen-reader support.
 * Keyboard: Enter/Space activate. Focus: always visible ring.
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center gap-2",
        "font-[var(--font-semibold)] font-semibold",
        "transition-colors duration-[var(--duration-fast)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-offset-[var(--focus-ring-offset)]",
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
