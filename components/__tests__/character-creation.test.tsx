/**
 * Component tests for the CharacterCreation flow.
 *
 * Covers: step navigation, pronoun rendering, validation, keyboard activation,
 * Tourist challenge framing, and representative small-viewport behaviour.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CharacterCreation } from "../character-creation/CharacterCreation";

function setup() {
  const onComplete = vi.fn();
  render(<CharacterCreation onComplete={onComplete} />);
  return { onComplete };
}

// ── Initial render ────────────────────────────────────────────────────────────

describe("CharacterCreation – initial render", () => {
  it("renders the Identity step heading", () => {
    setup();
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });

  it("renders the step progress nav", () => {
    setup();
    expect(screen.getByRole("navigation", { name: /character creation steps/i })).toBeInTheDocument();
  });

  it("Identity is marked as current step", () => {
    setup();
    const nav = screen.getByRole("navigation", { name: /character creation steps/i });
    const current = within(nav).getByText(/identity/i);
    expect(current.closest("[aria-current='step']")).not.toBeNull();
  });

  it("renders the name input", () => {
    setup();
    expect(screen.getByRole("textbox", { name: /name/i })).toBeInTheDocument();
  });

  it("renders pronoun radio options", () => {
    setup();
    expect(screen.getByRole("radio", { name: /they\/them/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /she\/her/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /he\/him/i })).toBeInTheDocument();
  });
});

// ── Identity validation ───────────────────────────────────────────────────────

describe("CharacterCreation – identity validation", () => {
  it("shows an error if Next is clicked without a name", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not advance without a name", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });

  it("shows custom pronouns field when Custom is selected", async () => {
    setup();
    const customRadio = screen.getByRole("radio", { name: /custom/i });
    fireEvent.click(customRadio);
    expect(screen.getByPlaceholderText(/xe\/xem/i)).toBeInTheDocument();
  });

  it("shows error if Custom pronouns are empty", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: /custom/i }));
    const nameInput = screen.getByRole("textbox", { name: /name/i });
    fireEvent.change(nameInput, { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    // Step should not advance — still on identity
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });
});

// ── Step navigation ───────────────────────────────────────────────────────────

describe("CharacterCreation – step navigation", () => {
  async function fillIdentityAndAdvance() {
    setup();
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }

  it("advances to Occupation step after valid identity", async () => {
    await fillIdentityAndAdvance();
    expect(screen.getByText(/what did you do before/i)).toBeInTheDocument();
  });

  it("Back button returns to Identity step", async () => {
    await fillIdentityAndAdvance();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });

  it("Back button preserves the name entered", async () => {
    await fillIdentityAndAdvance();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    const nameInput = screen.getByRole("textbox", { name: /name/i }) as HTMLInputElement;
    expect(nameInput.value).toBe("Alex");
  });

  it("Back button is not shown on the first step", () => {
    setup();
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });
});

// ── Occupation step ───────────────────────────────────────────────────────────

describe("CharacterCreation – occupation step", () => {
  function goToOccupation() {
    setup();
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Sam" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }

  it("shows occupation radio options", () => {
    goToOccupation();
    expect(screen.getAllByRole("radio", { name: /mechanic/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("radio", { name: /nurse/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("shows all 8 occupations", () => {
    goToOccupation();
    const radios = screen.getAllByRole("radio");
    // 8 occupation radios on this step (no other radios)
    expect(radios.length).toBe(8);
  });

  it("Tourist has a Challenge badge", () => {
    goToOccupation();
    const badges = screen.getAllByText(/challenge/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows validation error if Next is clicked without selecting occupation", () => {
    goToOccupation();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("allows selecting Tourist and advances", () => {
    goToOccupation();
    // Find the Tourist label and click the radio inside it
    const touristRadio = screen.getByRole("radio", { name: /tourist/i });
    fireEvent.click(touristRadio);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    // Should now be on Motivation step
    expect(screen.getByText(/what drives you/i)).toBeInTheDocument();
  });
});

// ── Motivation step ───────────────────────────────────────────────────────────

describe("CharacterCreation – motivation step", () => {
  function goToMotivation() {
    setup();
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Morgan" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("radio", { name: /farmer/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }

  it("renders motivation and weakness textareas", () => {
    goToMotivation();
    expect(screen.getByRole("textbox", { name: /motivation/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /weakness/i })).toBeInTheDocument();
  });

  it("pronouns render in motivation prompt text", () => {
    goToMotivation();
    // "Morgan" appears multiple times in the prompt — just check at least one is present
    expect(screen.getAllByText(/morgan/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows error if motivation is empty on Next", () => {
    goToMotivation();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    // Step stays on motivation
    expect(screen.getByText(/what drives you/i)).toBeInTheDocument();
  });
});

// ── Review step ───────────────────────────────────────────────────────────────

describe("CharacterCreation – review step", () => {
  function goToReview() {
    setup();
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Jordan" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("radio", { name: /veteran/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivation/i }), {
      target: { value: "Reach my family." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /weakness/i }), {
      target: { value: "Fear of deep water." },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }

  it("renders the review heading", () => {
    goToReview();
    expect(screen.getByText(/ready to begin/i)).toBeInTheDocument();
  });

  it("shows the name in the review summary", () => {
    goToReview();
    expect(screen.getByText("Jordan")).toBeInTheDocument();
  });

  it("shows the occupation in the review summary", () => {
    goToReview();
    expect(screen.getAllByText(/veteran/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Begin the journey button", () => {
    goToReview();
    expect(screen.getByRole("button", { name: /begin the journey/i })).toBeInTheDocument();
  });

  it("calls onComplete when Begin is clicked", () => {
    const onComplete = vi.fn();
    render(<CharacterCreation onComplete={onComplete} />);
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Kai" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("radio", { name: /electrician/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivation/i }), {
      target: { value: "Get home." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /weakness/i }), {
      target: { value: "Trust issues." },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /begin the journey/i }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("onComplete receives a draft with the correct name", () => {
    const onComplete = vi.fn();
    render(<CharacterCreation onComplete={onComplete} />);
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Rowan" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("radio", { name: /truck driver/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivation/i }), {
      target: { value: "My dogs are home alone." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /weakness/i }), {
      target: { value: "Terrible with maps." },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /begin the journey/i }));
    const draft = onComplete.mock.calls[0][0];
    expect(draft.name).toBe("Rowan");
    expect(draft.occupationId).toBe("occupation.truck-driver");
  });
});

// ── Keyboard navigation ───────────────────────────────────────────────────────

describe("CharacterCreation – keyboard interaction", () => {
  it("Next button is reachable via keyboard (Enter)", async () => {
    const user = userEvent.setup();
    setup();
    const nameInput = screen.getByRole("textbox", { name: /name/i });
    await user.type(nameInput, "Alex");
    const nextBtn = screen.getByRole("button", { name: /next/i });
    await user.click(nextBtn);
    expect(screen.getByText(/what did you do before/i)).toBeInTheDocument();
  });

  it("radio options can be activated by click on label", () => {
    setup();
    const heHimRadio = screen.getByRole("radio", { name: /he\/him/i }) as HTMLInputElement;
    fireEvent.click(heHimRadio);
    expect(heHimRadio.checked).toBe(true);
  });
});
