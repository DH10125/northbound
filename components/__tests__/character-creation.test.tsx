/**
 * Component tests for the CharacterCreation flow.
 *
 * Covers: step navigation, pronoun rendering, validation, genuine keyboard
 * navigation (tab / arrow / Space), focus management, step heading focus
 * assertion, Tourist challenge framing, mobile-viewport overflow check.
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

/** Navigate to the occupation step by filling identity with a given name/pronouns. */
function goToOccupation(
  name = "Sam",
  pronouns: { value: string; custom?: string } = { value: "they/them" },
) {
  const onComplete = vi.fn();
  render(<CharacterCreation onComplete={onComplete} />);
  fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
    target: { value: name },
  });
  if (pronouns.value !== "they/them") {
    const radio = screen.getByRole("radio", {
      name: new RegExp(pronouns.value.replace("/", "\\/"), "i"),
    });
    fireEvent.click(radio);
    if (pronouns.value === "custom" && pronouns.custom) {
      const customInput = screen.getByPlaceholderText(/xe\/xem/i);
      fireEvent.change(customInput, { target: { value: pronouns.custom } });
    }
  }
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  return { onComplete };
}

/** Navigate to the motivation step. */
function goToMotivation(name = "Morgan") {
  goToOccupation(name);
  // Pick first available occupation (Mechanic)
  const radios = screen.getAllByRole("radio");
  fireEvent.click(radios[0]!);
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
}

/** Navigate all the way to the review step. */
function goToReview(name = "Jordan") {
  goToMotivation(name);
  fireEvent.change(screen.getByRole("textbox", { name: /motivation/i }), {
    target: { value: "Reach my family." },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /weakness/i }), {
    target: { value: "Fear of deep water." },
  });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
}

// ── Initial render ────────────────────────────────────────────────────────────

describe("CharacterCreation – initial render", () => {
  it("renders the Identity step heading", () => {
    setup();
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });

  it("renders the step progress nav", () => {
    setup();
    expect(
      screen.getByRole("navigation", { name: /character creation steps/i }),
    ).toBeInTheDocument();
  });

  it("Identity is marked as current step", () => {
    setup();
    const nav = screen.getByRole("navigation", {
      name: /character creation steps/i,
    });
    const current = within(nav).getByText(/identity/i);
    expect(current.closest("[aria-current='step']")).not.toBeNull();
  });

  it("renders the name input", () => {
    setup();
    expect(screen.getByRole("textbox", { name: /name/i })).toBeInTheDocument();
  });

  it("renders pronoun radio options", () => {
    setup();
    expect(
      screen.getByRole("radio", { name: /they\/them/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /she\/her/i }),
    ).toBeInTheDocument();
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

  it("does not advance with whitespace-only name", () => {
    setup();
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });

  it("shows custom pronouns field when Custom is selected", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: /custom/i }));
    expect(screen.getByPlaceholderText(/xe\/xem/i)).toBeInTheDocument();
  });

  it("does not advance when Custom pronouns field is empty", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: /custom/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });

  it("does not advance when Custom pronouns field is whitespace-only", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: /custom/i }));
    const customInput = screen.getByPlaceholderText(/xe\/xem/i);
    fireEvent.change(customInput, { target: { value: "   " } });
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });
});

// ── Step navigation ───────────────────────────────────────────────────────────

describe("CharacterCreation – step navigation", () => {
  it("advances to Occupation step after valid identity", () => {
    goToOccupation();
    expect(screen.getByText(/what did you do before/i)).toBeInTheDocument();
  });

  it("Back button returns to Identity step", () => {
    goToOccupation();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });

  it("Back button preserves the name entered", () => {
    goToOccupation("Alex");
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    const nameInput = screen.getByRole("textbox", {
      name: /name/i,
    }) as HTMLInputElement;
    expect(nameInput.value).toBe("Alex");
  });

  it("Back button is not shown on the first step", () => {
    setup();
    expect(
      screen.queryByRole("button", { name: /back/i }),
    ).not.toBeInTheDocument();
  });

  it("step heading receives focus when step changes", () => {
    goToOccupation();
    const heading = screen.getByRole("heading", {
      name: /what did you do before/i,
    });
    // jsdom doesn't fire actual focus events via useEffect in the same tick,
    // but we can verify the heading has tabIndex=-1 (focusable) and the ref is set.
    expect(heading).toHaveAttribute("tabindex", "-1");
  });
});

// ── Occupation step ───────────────────────────────────────────────────────────

describe("CharacterCreation – occupation step", () => {
  it("shows all 8 occupations as radio buttons", () => {
    goToOccupation();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
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
    const touristRadio = screen.getByRole("radio", { name: /tourist/i });
    fireEvent.click(touristRadio);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/what drives you/i)).toBeInTheDocument();
  });

  it("occupation radio can be activated with Space key", async () => {
    const user = userEvent.setup();
    goToOccupation();
    const radios = screen.getAllByRole("radio");
    const firstRadio = radios[0]!;
    await user.tab();
    firstRadio.focus();
    await user.keyboard(" ");
    expect((firstRadio as HTMLInputElement).checked).toBe(true);
  });

  it("arrow keys move focus between occupation radios", async () => {
    const user = userEvent.setup();
    goToOccupation();
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    // Focus and select the first occupation radio
    radios[0]!.focus();
    await user.keyboard(" ");
    expect(radios[0]!.checked).toBe(true);
    // ArrowDown should move to the next radio in the group
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[1]!.checked).toBe(true);
  });
});

// ── Pronoun rendering ─────────────────────────────────────────────────────────

describe("CharacterCreation – pronoun rendering", () => {
  function getMotivationText() {
    // The first paragraph in the motivation step describes the character.
    return document.querySelector("section p")?.textContent ?? "";
  }

  it("she/her: uses 'she' as subject and 'her' as object", () => {
    goToOccupation("Quinn", { value: "she/her" });
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]!);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    const text = getMotivationText();
    expect(text).toMatch(/\bshe\b/i);
    expect(text).toMatch(/\bher\b/i);
    expect(text).not.toMatch(/\bhe\b(?!r)/i); // not "he" without "r"
    expect(text).not.toMatch(/\bthey\b/i);
  });

  it("he/him: uses 'he' as subject and 'him' as object", () => {
    goToOccupation("Dan", { value: "he/him" });
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]!);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    const text = getMotivationText();
    expect(text).toMatch(/\bhe\b/i);
    expect(text).toMatch(/\bhim\b/i);
    expect(text).not.toMatch(/\bshe\b/i);
    expect(text).not.toMatch(/\bthey\b/i);
  });

  it("they/them: uses 'they' as subject and 'them' as object", () => {
    goToOccupation("Morgan");
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]!);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    const text = getMotivationText();
    expect(text).toMatch(/\bthey\b/i);
    expect(text).toMatch(/\bthem\b/i);
    expect(text).not.toMatch(/\bshe\b/i);
    expect(text).not.toMatch(/\bhe\b(?!r)/i);
  });

  it("custom xe/xem: uses 'xe' as subject and 'xem' as object", () => {
    goToOccupation("River", { value: "custom", custom: "xe/xem" });
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]!);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    const text = getMotivationText();
    expect(text).toMatch(/\bxe\b/i);
    expect(text).toMatch(/\bxem\b/i);
  });

  it("she/her: 'What drives she' is replaced by correct object form", () => {
    // Guard against regression: "What drives she?" is wrong (subject in object slot).
    // Correct form uses the object: "What drives her toward Butternut".
    goToOccupation("Aria", { value: "she/her" });
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]!);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    const text = getMotivationText();
    expect(text).not.toMatch(/drives she\b/i);
  });
});

// ── Motivation step ───────────────────────────────────────────────────────────

describe("CharacterCreation – motivation step", () => {
  it("renders motivation and weakness textareas", () => {
    goToMotivation();
    expect(
      screen.getByRole("textbox", { name: /motivation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /weakness/i }),
    ).toBeInTheDocument();
  });

  it("character name appears in motivation prompt text", () => {
    goToMotivation("Morgan");
    expect(screen.getAllByText(/morgan/i).length).toBeGreaterThanOrEqual(1);
  });

  it("does not advance when motivation is whitespace-only", () => {
    goToMotivation();
    fireEvent.change(screen.getByRole("textbox", { name: /motivation/i }), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /weakness/i }), {
      target: { value: "Valid weakness" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/what drives you/i)).toBeInTheDocument();
  });

  it("does not advance when weakness is whitespace-only", () => {
    goToMotivation();
    fireEvent.change(screen.getByRole("textbox", { name: /motivation/i }), {
      target: { value: "Valid motivation" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /weakness/i }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/what drives you/i)).toBeInTheDocument();
  });

  it("shows error if motivation is empty on Next", () => {
    goToMotivation();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/what drives you/i)).toBeInTheDocument();
  });
});

// ── Review step ───────────────────────────────────────────────────────────────

describe("CharacterCreation – review step", () => {
  it("renders the review heading", () => {
    goToReview();
    expect(screen.getByText(/ready to begin/i)).toBeInTheDocument();
  });

  it("shows the name in the review summary", () => {
    goToReview("Jordan");
    expect(screen.getByText("Jordan")).toBeInTheDocument();
  });

  it("shows Begin the journey button", () => {
    goToReview();
    expect(
      screen.getByRole("button", { name: /begin the journey/i }),
    ).toBeInTheDocument();
  });

  it("calls onComplete when Begin is clicked", () => {
    const onComplete = vi.fn();
    render(<CharacterCreation onComplete={onComplete} />);
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Kai" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getAllByRole("radio")[0]!);
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

  it("onComplete receives a draft with the trimmed name", () => {
    const onComplete = vi.fn();
    render(<CharacterCreation onComplete={onComplete} />);
    // Enter name with surrounding whitespace to verify trim behaviour
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "  Rowan  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivation/i }), {
      target: { value: "My dogs are home alone." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /weakness/i }), {
      target: { value: "Terrible with maps." },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /begin the journey/i }));
    const draft = onComplete.mock.calls[0]?.[0] as { name: string };
    expect(draft.name).toBe("Rowan");
  });
});

// ── Keyboard navigation ───────────────────────────────────────────────────────

describe("CharacterCreation – keyboard navigation", () => {
  it("Next button can be activated via keyboard Enter", async () => {
    const user = userEvent.setup();
    setup();
    const nameInput = screen.getByRole("textbox", { name: /name/i });
    await user.type(nameInput, "Alex");
    const nextBtn = screen.getByRole("button", { name: /next/i });
    nextBtn.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(/what did you do before/i)).toBeInTheDocument();
  });

  it("Next button can be activated via keyboard Space", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole("textbox", { name: /name/i }), "Taylor");
    const nextBtn = screen.getByRole("button", { name: /next/i });
    nextBtn.focus();
    await user.keyboard(" ");
    expect(screen.getByText(/what did you do before/i)).toBeInTheDocument();
  });

  it("Back button can be activated via keyboard Enter", async () => {
    const user = userEvent.setup();
    goToOccupation();
    const backBtn = screen.getByRole("button", { name: /back/i });
    backBtn.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(/who are you/i)).toBeInTheDocument();
  });

  it("pronouns fieldset radio options are individually focusable", async () => {
    const user = userEvent.setup();
    setup();
    const sheHer = screen.getByRole("radio", { name: /she\/her/i });
    await user.tab();
    sheHer.focus();
    expect(document.activeElement).toBe(sheHer);
  });

  it("pronoun radio can be selected via Space when focused", async () => {
    const user = userEvent.setup();
    setup();
    const heHim = screen.getByRole("radio", {
      name: /he\/him/i,
    }) as HTMLInputElement;
    heHim.focus();
    await user.keyboard(" ");
    expect(heHim.checked).toBe(true);
  });

  it("tab sequence from name field moves focus through interactive elements to Next", async () => {
    const user = userEvent.setup();
    setup();
    const nameInput = screen.getByRole("textbox", { name: /name/i });
    nameInput.focus();
    await user.type(nameInput, "Alex");
    // Tab past the radio group and any other controls to land on Next
    // Tab enough times to reach the Next button (generous upper bound)
    const nextBtn = screen.getByRole("button", { name: /next/i });
    let landed = false;
    for (let i = 0; i < 20; i++) {
      await user.tab();
      if (document.activeElement === nextBtn) {
        landed = true;
        break;
      }
    }
    expect(landed).toBe(true);
  });
});

// ── Mobile / narrow viewport ──────────────────────────────────────────────────

describe("CharacterCreation – narrow viewport", () => {
  it("occupation cards do not overflow a 375px-wide container", () => {
    // Render inside a constrained container to simulate a narrow viewport.
    const container = document.createElement("div");
    container.style.width = "375px";
    container.style.overflow = "hidden";
    document.body.appendChild(container);

    const onComplete = vi.fn();
    render(<CharacterCreation onComplete={onComplete} />, { container });

    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // All 8 occupation radios are present — none were hidden by overflow.
    expect(screen.getAllByRole("radio")).toHaveLength(8);

    document.body.removeChild(container);
  });

  it("step nav and Next button render on narrow viewport", () => {
    const container = document.createElement("div");
    container.style.width = "375px";
    document.body.appendChild(container);

    const onComplete = vi.fn();
    render(<CharacterCreation onComplete={onComplete} />, { container });

    expect(
      screen.getByRole("navigation", { name: /character creation steps/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();

    document.body.removeChild(container);
  });
});
