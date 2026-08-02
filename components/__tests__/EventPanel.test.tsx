import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventPanel } from "../EventPanel";
import type { EventDefinition } from "@/game/content/event-definitions";
import type { OptionAvailability } from "@/game/core/event-engine";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseEvent: EventDefinition = {
  id: "event.test.river-crossing",
  version: 1,
  title: "River Crossing",
  text: "A swollen river blocks your path.",
  trigger: { field: "chapter", op: "eq", value: "pensacola-escape" },
  weight: 1,
  options: [
    {
      id: "swim",
      label: "Swim across",
      outcomes: [
        {
          weight: 1,
          text: "You swim across safely.",
          effects: [],
        },
      ],
    },
    {
      id: "bridge",
      label: "Find a bridge",
      outcomes: [
        {
          weight: 1,
          text: "You find a rickety bridge.",
          effects: [],
        },
      ],
    },
    {
      id: "wait",
      label: "Wait it out",
      outcomes: [
        {
          weight: 1,
          text: "The waters recede after hours.",
          effects: [],
        },
      ],
    },
  ],
  tags: [],
  once: false,
};

const allAvailable: OptionAvailability[] = [
  { optionId: "swim", available: true },
  { optionId: "bridge", available: true },
  { optionId: "wait", available: true },
];

const oneDisabled: OptionAvailability[] = [
  { optionId: "swim", available: false, reason: "Requires 7 Strength" },
  { optionId: "bridge", available: true },
  { optionId: "wait", available: true },
];

// ── Rendering ────────────────────────────────────────────────────────────────

describe("EventPanel", () => {
  it("renders title and descriptive text", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
      />,
    );
    expect(screen.getByText("River Crossing")).toBeInTheDocument();
    expect(
      screen.getByText("A swollen river blocks your path."),
    ).toBeInTheDocument();
  });

  it("renders all option buttons", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /swim across/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /find a bridge/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /wait it out/i }),
    ).toBeInTheDocument();
  });

  // ── Interaction ──────────────────────────────────────────────────────────

  it("calls onChoose with optionId on click", () => {
    const onChoose = vi.fn();
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={onChoose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /find a bridge/i }));
    expect(onChoose).toHaveBeenCalledWith("bridge");
  });

  it("calls onChoose with optionId on Enter key", () => {
    const onChoose = vi.fn();
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={onChoose}
      />,
    );
    const btn = screen.getByRole("button", { name: /swim across/i });
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith("swim");
  });

  it("calls onChoose with optionId on Space key", () => {
    const onChoose = vi.fn();
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={onChoose}
      />,
    );
    const btn = screen.getByRole("button", { name: /wait it out/i });
    fireEvent.keyDown(btn, { key: " " });
    expect(onChoose).toHaveBeenCalledWith("wait");
  });

  // ── Disabled options ─────────────────────────────────────────────────────

  it("disables unavailable options and shows reason", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={oneDisabled}
        onChoose={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /swim across/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText("Requires 7 Strength")).toBeInTheDocument();
  });

  it("does not call onChoose when disabled button is clicked", () => {
    const onChoose = vi.fn();
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={oneDisabled}
        onChoose={onChoose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /swim across/i }));
    expect(onChoose).not.toHaveBeenCalled();
  });

  // ── Resolving state ──────────────────────────────────────────────────────

  it("disables all buttons while resolving", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
        isResolving
      />,
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  // ── Resolution display ───────────────────────────────────────────────────

  it("shows resolution text in aria-live region", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
        resolutionText="You swim across safely."
      />,
    );
    const liveRegion = screen.getByText("You swim across safely.");
    expect(liveRegion.closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("hides option buttons after resolution", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
        resolutionText="You found a bridge."
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // ── Tier display ─────────────────────────────────────────────────────────

  it("displays tier symbol and label for critical-success", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
        resolutionText="Amazing result!"
        resolutionTier="critical-success"
      />,
    );
    expect(screen.getByText(/★★/)).toBeInTheDocument();
    expect(screen.getByText(/Critical Success/)).toBeInTheDocument();
  });

  it("displays tier symbol for failure", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
        resolutionText="It didn't work."
        resolutionTier="failure"
      />,
    );
    expect(screen.getByText(/✗/)).toBeInTheDocument();
    expect(screen.getByText(/Failure/)).toBeInTheDocument();
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  it("has accessible region with labelledby", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
      />,
    );
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-labelledby", "event-title");
  });

  it("aria-describedby links disabled button to reason", () => {
    render(
      <EventPanel
        event={baseEvent}
        optionAvailability={oneDisabled}
        onChoose={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /swim across/i });
    const describedBy = btn.getAttribute("aria-describedby");
    expect(describedBy).toBe("req-swim");
    const reason = document.getElementById("req-swim");
    expect(reason).toHaveTextContent("Requires 7 Strength");
  });

  // ── XSS safety ──────────────────────────────────────────────────────────

  it("renders unsafe text as text content, not HTML", () => {
    const xssEvent: EventDefinition = {
      ...baseEvent,
      title: '<script>alert("xss")</script>',
      text: '<img src=x onerror=alert("xss")>',
    };
    render(
      <EventPanel
        event={xssEvent}
        optionAvailability={allAvailable}
        onChoose={vi.fn()}
      />,
    );
    // Rendered as text, not executed
    expect(
      screen.getByText('<script>alert("xss")</script>'),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
