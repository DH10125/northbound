import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConditionPanel } from "../ConditionPanel";
import type { ConditionUIEntry } from "../ConditionPanel";
import type { PermanentModifier } from "@/game/schemas/conditions";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const treatable: ConditionUIEntry = {
  visibility: {
    conditionId: "condition.dehydration",
    name: "Dehydration",
    stage: "mild",
    symptoms: ["Dry mouth", "Mild headache"],
    severeRisk: false,
    uncertaintyNote: "Cause unclear — could be several things.",
  },
  canTreat: true,
  treatmentCostLabel: "1x Clean Water",
  isTreated: false,
};

const untreatable: ConditionUIEntry = {
  visibility: {
    conditionId: "condition.wound-infection",
    name: "Wound Infection",
    stage: "severe",
    symptoms: ["High fever", "Wound smells foul", "Red streaks"],
    severeRisk: true,
    severeRiskWarning:
      "The infection is spreading fast. Needs treatment immediately.",
    uncertaintyNote: "Consistent with wound infection, but uncertain.",
  },
  canTreat: false,
  disabledReason: "Need 1x medicine.antibiotics.",
  treatmentCostLabel: "1x Antibiotics",
  isTreated: false,
};

const alreadyTreated: ConditionUIEntry = {
  visibility: {
    conditionId: "condition.fracture",
    name: "Broken Bone",
    stage: "moderate",
    symptoms: ["Can't bear weight", "Visible bend"],
    severeRisk: false,
    uncertaintyNote: "Likely broken bone.",
  },
  canTreat: false,
  treatmentCostLabel: "2x Bandage",
  isTreated: true,
};

const modifiers: PermanentModifier[] = [
  {
    sourceConditionId: "condition.dehydration",
    target: "endurance",
    delta: -1,
    label: "Worn out (past dehydration crisis)",
  },
];

// ── Rendering ──────────────────────────────────────────────────────────────────

describe("ConditionPanel", () => {
  it("renders nothing when no conditions or modifiers", () => {
    const { container } = render(
      <ConditionPanel
        conditions={[]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders condition names and symptoms", () => {
    render(
      <ConditionPanel
        conditions={[treatable]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    expect(screen.getByText("Dehydration")).toBeInTheDocument();
    expect(screen.getByText("Dry mouth")).toBeInTheDocument();
    expect(screen.getByText("Mild headache")).toBeInTheDocument();
  });

  it("shows uncertainty note", () => {
    render(
      <ConditionPanel
        conditions={[treatable]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Cause unclear — could be several things."),
    ).toBeInTheDocument();
  });

  it("shows severe risk warning when present", () => {
    render(
      <ConditionPanel
        conditions={[untreatable]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "The infection is spreading fast. Needs treatment immediately.",
      ),
    ).toBeInTheDocument();
  });

  // ── Treatment interaction ──────────────────────────────────────────────────

  it("calls onTreat when treat button clicked", () => {
    const onTreat = vi.fn();
    render(
      <ConditionPanel
        conditions={[treatable]}
        permanentModifiers={[]}
        onTreat={onTreat}
      />,
    );
    fireEvent.click(screen.getByTestId("treat-btn-condition.dehydration"));
    expect(onTreat).toHaveBeenCalledWith("condition.dehydration");
  });

  it("disables treat button when canTreat is false", () => {
    render(
      <ConditionPanel
        conditions={[untreatable]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    const btn = screen.getByTestId("treat-btn-condition.wound-infection");
    expect(btn).toBeDisabled();
  });

  it("does not call onTreat when disabled button clicked", () => {
    const onTreat = vi.fn();
    render(
      <ConditionPanel
        conditions={[untreatable]}
        permanentModifiers={[]}
        onTreat={onTreat}
      />,
    );
    fireEvent.click(screen.getByTestId("treat-btn-condition.wound-infection"));
    expect(onTreat).not.toHaveBeenCalled();
  });

  it("shows disabled reason linked via aria-describedby", () => {
    render(
      <ConditionPanel
        conditions={[untreatable]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    const btn = screen.getByTestId("treat-btn-condition.wound-infection");
    const describedById = btn.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const reason = document.getElementById(describedById!);
    expect(reason).toHaveTextContent("Need 1x medicine.antibiotics.");
  });

  it("shows 'Currently being treated' for treated conditions", () => {
    render(
      <ConditionPanel
        conditions={[alreadyTreated]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    expect(screen.getByText("Currently being treated")).toBeInTheDocument();
  });

  // ── Permanent modifiers ──────────────────────────────────────────────────

  it("renders permanent modifiers", () => {
    render(
      <ConditionPanel
        conditions={[]}
        permanentModifiers={modifiers}
        onTreat={vi.fn()}
      />,
    );
    expect(screen.getByText("Lasting Effects")).toBeInTheDocument();
    expect(
      screen.getByText(/Worn out \(past dehydration crisis\)/),
    ).toBeInTheDocument();
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it("has accessible region", () => {
    render(
      <ConditionPanel
        conditions={[treatable]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-labelledby");
  });

  it("severe warning has role=alert", () => {
    render(
      <ConditionPanel
        conditions={[untreatable]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The infection is spreading fast");
  });

  // ── XSS safety ──────────────────────────────────────────────────────────

  it("renders unsafe text as text content, not HTML", () => {
    const xssEntry: ConditionUIEntry = {
      ...treatable,
      visibility: {
        ...treatable.visibility,
        name: '<script>alert("xss")</script>',
        symptoms: ['<img src=x onerror=alert("xss")>'],
      },
    };
    render(
      <ConditionPanel
        conditions={[xssEntry]}
        permanentModifiers={[]}
        onTreat={vi.fn()}
      />,
    );
    expect(
      screen.getByText('<script>alert("xss")</script>'),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
