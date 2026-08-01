import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../ui/Button";
import { VisuallyHidden } from "../ui/VisuallyHidden";
import { StatusBadge } from "../ui/StatusBadge";
import { SkipNav } from "../ui/SkipNav";
import { Toast } from "../ui/Toast";

// ── Button ────────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders children as button text", () => {
    render(<Button>Save game</Button>);
    expect(
      screen.getByRole("button", { name: /save game/i }),
    ).toBeInTheDocument();
  });

  it("has type=button by default to prevent accidental form submission", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("forwards disabled prop and prevents interaction", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Action
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders all variant classes without crashing", () => {
    const { rerender } = render(<Button variant="primary">X</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    rerender(<Button variant="secondary">X</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    rerender(<Button variant="danger">X</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    rerender(<Button variant="ghost">X</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders all size variants without crashing", () => {
    const { rerender } = render(<Button size="sm">X</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    rerender(<Button size="md">X</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    rerender(<Button size="lg">X</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});

// ── VisuallyHidden ────────────────────────────────────────────────────────

describe("VisuallyHidden", () => {
  it("renders children in the DOM for screen readers", () => {
    render(<VisuallyHidden>Status: critical</VisuallyHidden>);
    expect(screen.getByText(/status: critical/i)).toBeInTheDocument();
  });

  it("applies sr-only class", () => {
    render(<VisuallyHidden>Hidden label</VisuallyHidden>);
    const el = screen.getByText(/hidden label/i);
    expect(el).toHaveClass("sr-only");
  });
});

// ── StatusBadge ───────────────────────────────────────────────────────────

describe("StatusBadge", () => {
  it("renders label text", () => {
    render(<StatusBadge status="ok" label="Health" />);
    expect(screen.getByText(/health/i)).toBeInTheDocument();
  });

  it("sets data-status attribute for CSS shape differentiation", () => {
    render(<StatusBadge status="warn" label="Water" />);
    const badge = screen.getByText(/water/i).closest("[data-status]");
    expect(badge).toHaveAttribute("data-status", "warn");
  });

  it("includes value in aria-label when provided", () => {
    render(<StatusBadge status="danger" label="Farm" value="Critical" />);
    const badge = document.querySelector("[data-status='danger']");
    expect(badge).toHaveAttribute("aria-label", "Farm: Critical");
  });

  it("renders all status variants without crashing", () => {
    const statuses = ["ok", "warn", "danger", "info", "neutral"] as const;
    for (const status of statuses) {
      const { unmount } = render(
        <StatusBadge status={status} label={status} />,
      );
      expect(document.querySelector(`[data-status='${status}']`)).toBeTruthy();
      unmount();
    }
  });
});

// ── SkipNav ───────────────────────────────────────────────────────────────

describe("SkipNav", () => {
  it("renders a link to #main-content by default", () => {
    render(<SkipNav />);
    const link = screen.getByRole("link", { name: /skip to main content/i });
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("accepts a custom targetId", () => {
    render(<SkipNav targetId="game-area" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "#game-area");
  });

  it("has the skip-nav class for CSS positioning", () => {
    render(<SkipNav />);
    expect(screen.getByRole("link")).toHaveClass("skip-nav");
  });
});

// ── Toast ─────────────────────────────────────────────────────────────────

describe("Toast", () => {
  it("renders message text", () => {
    render(<Toast message="Turn complete" />);
    expect(screen.getByText(/turn complete/i)).toBeInTheDocument();
  });

  it("uses role=status for info/ok variants (polite)", () => {
    render(<Toast message="All good" variant="info" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses role=alert for warn/danger variants (assertive)", () => {
    render(<Toast message="Danger!" variant="danger" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("warn variant also uses role=alert", () => {
    render(<Toast message="Low water" variant="warn" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<Toast message="Hello" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not render dismiss button when onDismiss is not provided", () => {
    render(<Toast message="Static note" />);
    expect(
      screen.queryByRole("button", { name: /dismiss/i }),
    ).not.toBeInTheDocument();
  });
});
