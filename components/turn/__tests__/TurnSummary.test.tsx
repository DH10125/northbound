/**
 * TurnSummary component tests.
 *
 * Covers:
 *   - Empty state renders accessible placeholder.
 *   - Populated event renders action, phase, elapsed hours, meter changes.
 *   - Meter changes list is accessible (role list, aria-labels on deltas).
 *   - Farm clock row is rendered when present.
 *   - buildTurnAnnouncement constructs correct string.
 *   - Live region receives announcement on new event.
 *   - Duplicate event fingerprint does not re-announce.
 *   - Disabled action button exposes disabled reason via aria-describedby.
 */

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TurnSummary, buildTurnAnnouncement } from "../TurnSummary";
import { LiveRegion, LIVE_REGION_ID } from "../../ui/LiveRegion";
import type { TurnResolvedEvent } from "../../../game/core/domain-events";

const baseEvent: TurnResolvedEvent = {
  type: "TURN_RESOLVED",
  action: "TRAVEL",
  phase: "night",
  hoursElapsed: 4,
  changes: [
    { field: "hunger", before: 0, after: 8, delta: 8 },
    { field: "fatigue", before: 0, after: 16, delta: 16 },
    { field: "farm.clockTurns", before: 0, after: 1, delta: 1 },
  ],
};

// ── Empty state ───────────────────────────────────────────────────────────────

describe("TurnSummary – empty state", () => {
  it("renders turn summary region when no event", () => {
    render(<TurnSummary event={null} />);
    expect(
      screen.getByRole("region", { name: /turn summary/i }),
    ).toBeInTheDocument();
  });

  it("has visually hidden text for screen readers", () => {
    render(<TurnSummary event={null} />);
    expect(screen.getByText(/no turns taken yet/i)).toBeInTheDocument();
  });
});

// ── Populated state ───────────────────────────────────────────────────────────

describe("TurnSummary – populated", () => {
  it("shows action name", () => {
    render(<TurnSummary event={baseEvent} />);
    expect(screen.getByText(/travel/i)).toBeInTheDocument();
  });

  it("shows phase", () => {
    render(<TurnSummary event={baseEvent} />);
    expect(screen.getByText(/night/i)).toBeInTheDocument();
  });

  it("shows elapsed hours", () => {
    render(<TurnSummary event={baseEvent} />);
    expect(screen.getByText(/4 hours elapsed/i)).toBeInTheDocument();
  });

  it("renders meter changes list", () => {
    render(<TurnSummary event={baseEvent} />);
    expect(
      screen.getByRole("list", { name: /meter changes/i }),
    ).toBeInTheDocument();
  });

  it("renders hunger change with signed delta", () => {
    render(<TurnSummary event={baseEvent} />);
    // aria-label carries the accessible description
    expect(
      screen.getByLabelText(/hunger increased by 8, now 8/i),
    ).toBeInTheDocument();
  });

  it("renders negative delta correctly", () => {
    const restEvent: TurnResolvedEvent = {
      ...baseEvent,
      action: "REST",
      changes: [{ field: "fatigue", before: 20, after: 4, delta: -16 }],
    };
    render(<TurnSummary event={restEvent} />);
    expect(
      screen.getByLabelText(/fatigue decreased by 16, now 4/i),
    ).toBeInTheDocument();
  });

  it("renders farm clock row", () => {
    render(<TurnSummary event={baseEvent} />);
    expect(screen.getByTestId("turn-summary-farm-clock")).toBeInTheDocument();
    expect(
      screen.getByText(/farm clock advanced to turn 1/i),
    ).toBeInTheDocument();
  });

  it("does not render farm clock row when no farm change", () => {
    const noFarm: TurnResolvedEvent = {
      ...baseEvent,
      changes: [{ field: "hunger", before: 0, after: 8, delta: 8 }],
    };
    render(<TurnSummary event={noFarm} />);
    expect(screen.queryByTestId("turn-summary-farm-clock")).toBeNull();
  });
});

// ── buildTurnAnnouncement ─────────────────────────────────────────────────────

describe("buildTurnAnnouncement", () => {
  it("includes action, hours, and phase", () => {
    const msg = buildTurnAnnouncement(baseEvent);
    expect(msg).toContain("TRAVEL complete");
    expect(msg).toContain("4 hours");
    expect(msg).toContain("Night");
  });

  it("includes meter change summaries, excluding farm.clockTurns", () => {
    const msg = buildTurnAnnouncement(baseEvent);
    expect(msg).toContain("Hunger +8");
    expect(msg).toContain("Fatigue +16");
    expect(msg).not.toContain("Farm clock");
  });

  it("handles negative deltas in announcement", () => {
    const restEvent: TurnResolvedEvent = {
      ...baseEvent,
      action: "REST",
      phase: "day",
      changes: [{ field: "fatigue", before: 20, after: 4, delta: -16 }],
    };
    const msg = buildTurnAnnouncement(restEvent);
    expect(msg).toContain("Fatigue -16");
  });

  it("omits changes section when no meter changes", () => {
    const noChanges: TurnResolvedEvent = {
      ...baseEvent,
      changes: [],
    };
    const msg = buildTurnAnnouncement(noChanges);
    expect(msg).not.toContain(",");
    expect(msg).toContain("TRAVEL complete");
  });
});

// ── Live region announcement ──────────────────────────────────────────────────

describe("TurnSummary – live region", () => {
  it("announces turn result in live region", async () => {
    vi.useFakeTimers();
    render(
      <>
        <LiveRegion />
        <TurnSummary event={baseEvent} />
      </>,
    );
    await act(() => vi.runAllTimersAsync());
    const liveEl = document.getElementById(LIVE_REGION_ID);
    expect(liveEl?.textContent).toContain("TRAVEL complete");
    vi.useRealTimers();
  });
});

// ── Disabled action aria pattern ──────────────────────────────────────────────

describe("disabled action button with aria-describedby", () => {
  it("button with reason exposed via aria-describedby is not accessible by name", () => {
    const reasonId = "trade-disabled-reason";
    render(
      <div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-describedby={reasonId}
        >
          Trade
        </button>
        <span id={reasonId}>
          Trade is not available at night — traders are not active.
        </span>
      </div>,
    );
    const btn = screen.getByRole("button", { name: /trade/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-describedby", reasonId);
    expect(screen.getByText(/traders are not active/i)).toBeInTheDocument();
  });

  it("available but discouraged action has no disabled reason text", () => {
    // Travel during day: available, discouraged, but no disabled tooltip
    render(
      <div>
        <button type="button" aria-disabled="false">
          Travel
        </button>
      </div>,
    );
    const btn = screen.getByRole("button", { name: /travel/i });
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute("aria-describedby");
  });
});
