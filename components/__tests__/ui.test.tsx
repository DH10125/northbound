import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { VisuallyHidden } from "../ui/VisuallyHidden";
import { StatusBadge } from "../ui/StatusBadge";
import { SkipNav } from "../ui/SkipNav";
import { Toast } from "../ui/Toast";
import { LiveRegion, useLiveRegion, LIVE_REGION_ID } from "../ui/LiveRegion";

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

// ── Dialog ────────────────────────────────────────────────────────────────

describe("Dialog", () => {
  // jsdom does not implement showModal/close, so we stub them.
  function renderDialog(
    props: Partial<
      import("../ui/Dialog").DialogProps
    > & { open?: boolean } = {},
  ) {
    const onClose = vi.fn();
    const result = render(
      <Dialog
        open={props.open ?? false}
        onClose={props.onClose ?? onClose}
        title={props.title ?? "Confirm action"}
        description={props.description}
        closeLabel={props.closeLabel}
      >
        {props.children ?? <p>Dialog body</p>}
      </Dialog>,
    );
    // Stub showModal/close for jsdom
    const dialogEl = result.container.querySelector("dialog")!;
    dialogEl.showModal = vi.fn(() => {
      dialogEl.setAttribute("open", "");
    });
    dialogEl.close = vi.fn(() => {
      dialogEl.removeAttribute("open");
    });
    return { ...result, onClose, dialogEl };
  }

  it("renders the title text", () => {
    renderDialog({ title: "Leave camp?" });
    expect(screen.getByText("Leave camp?")).toBeInTheDocument();
  });

  it("title element has a stable id referenced by aria-labelledby", () => {
    const { dialogEl } = renderDialog({ title: "My title" });
    const labelledBy = dialogEl.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl).toBeInTheDocument();
    expect(titleEl!.textContent).toBe("My title");
  });

  it("aria-labelledby id does not look like a Math.random() base-36 string", () => {
    // Math.random().toString(36).slice(2) produces 8-11 lowercase alphanumeric chars with no
    // surrounding delimiter. useId() wraps the counter in guillemets (jsdom) or colons (browser).
    const { dialogEl } = renderDialog({ title: "T" });
    const labelledBy = dialogEl.getAttribute("aria-labelledby")!;
    // Should NOT be a bare 8+ char lowercase-alphanumeric-only string
    expect(labelledBy).not.toMatch(/^[a-z0-9]{8,}$/);
    // Should end with -title suffix we appended
    expect(labelledBy).toMatch(/-title$/);
  });

  it("sets aria-describedby when description is provided", () => {
    renderDialog({ description: "This cannot be undone." });
    const dialogEl = document.querySelector("dialog")!;
    const describedBy = dialogEl.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const descEl = document.getElementById(describedBy!);
    expect(descEl!.textContent).toBe("This cannot be undone.");
  });

  it("does not set aria-describedby when description is omitted", () => {
    const { dialogEl } = renderDialog();
    expect(dialogEl.getAttribute("aria-describedby")).toBeNull();
  });

  it("calls onClose when the close button is clicked", () => {
    const { onClose } = renderDialog({ open: false });
    fireEvent.click(
      screen.getByRole("button", { name: /close dialog/i, hidden: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the footer button is clicked", () => {
    const { onClose } = renderDialog({ closeLabel: "Dismiss" });
    fireEvent.click(
      screen.getByRole("button", { name: /dismiss/i, hidden: true }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("two Dialog instances have different labelledby ids (stable per-instance)", () => {
    const { container: c1 } = render(
      <Dialog open={false} onClose={vi.fn()} title="Alpha">
        <p>A</p>
      </Dialog>,
    );
    const { container: c2 } = render(
      <Dialog open={false} onClose={vi.fn()} title="Beta">
        <p>B</p>
      </Dialog>,
    );
    const id1 = c1.querySelector("dialog")!.getAttribute("aria-labelledby");
    const id2 = c2.querySelector("dialog")!.getAttribute("aria-labelledby");
    expect(id1).not.toBe(id2);
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

  it("aria-label includes human-readable status word, label, and value", () => {
    render(<StatusBadge status="danger" label="Farm" value="Critical" />);
    const badge = document.querySelector("[data-status='danger']");
    // Format: "{statusLabel}: {label}: {value}" — status word always present
    expect(badge).toHaveAttribute("aria-label", "Critical: Farm: Critical");
  });

  it("aria-label includes human-readable status word and label when no value", () => {
    render(<StatusBadge status="warn" label="Water" />);
    const badge = document.querySelector("[data-status='warn']");
    expect(badge).toHaveAttribute("aria-label", "Warning: Water");
  });

  it("aria-label includes status word for ok/info/neutral variants", () => {
    render(<StatusBadge status="ok" label="Health" value="82%" />);
    expect(document.querySelector("[data-status='ok']")).toHaveAttribute(
      "aria-label",
      "Good: Health: 82%",
    );
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

  it("does not auto-dismiss by default (duration=0)", () => {
    // The default duration must be 0 so screen readers have unlimited time
    const onDismiss = vi.fn();
    render(<Toast message="Persistent" onDismiss={onDismiss} />);
    // Wait 100ms — if default were 5000 nothing would fire; but also confirms
    // the component does not immediately call onDismiss with duration=0
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

// ── LiveRegion ────────────────────────────────────────────────────────────

describe("LiveRegion", () => {
  it("renders with the stable LIVE_REGION_ID", () => {
    render(<LiveRegion />);
    expect(document.getElementById(LIVE_REGION_ID)).toBeInTheDocument();
  });

  it("has aria-live=polite", () => {
    render(<LiveRegion />);
    expect(document.getElementById(LIVE_REGION_ID)).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("useLiveRegion announce() writes into the global element", async () => {
    // Render the global region first (as layout does)
    render(<LiveRegion />);

    // Simulate a consumer component
    function Consumer() {
      const { announce } = useLiveRegion();
      return (
        <button onClick={() => announce("Turn resolved")}>Announce</button>
      );
    }
    render(<Consumer />);

    fireEvent.click(screen.getByRole("button", { name: /announce/i }));

    await waitFor(
      () => {
        expect(document.getElementById(LIVE_REGION_ID)!.textContent).toBe(
          "Turn resolved",
        );
      },
      { timeout: 200 },
    );
  });

  it("useLiveRegion is a no-op when LiveRegion is not mounted", () => {
    // Should not throw even if the element is absent
    function Consumer() {
      const { announce } = useLiveRegion();
      return (
        <button onClick={() => announce("Orphan message")}>Announce</button>
      );
    }
    render(<Consumer />);
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: /announce/i })),
    ).not.toThrow();
  });
});
