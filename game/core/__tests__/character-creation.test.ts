/**
 * Tests for occupation definitions and character creation initializer.
 */

import { describe, it, expect } from "vitest";
import {
  OCCUPATIONS,
  OCCUPATION_IDS,
  getOccupation,
  applyAttributeDeltas,
  OccupationDefinitionSchema,
} from "../../content/occupations";
import {
  CharacterDraftSchema,
  buildInitialGameState,
} from "../character-creation";
import { GameStateSchema } from "../../schemas/game-state";
import type { OccupationId } from "../../schemas/ids";

// ── Occupation definitions ────────────────────────────────────────────────────

describe("OCCUPATIONS – definition integrity", () => {
  it("contains exactly 8 occupations", () => {
    expect(OCCUPATIONS).toHaveLength(8);
  });

  it("every occupation parses against OccupationDefinitionSchema", () => {
    for (const occ of OCCUPATIONS) {
      const result = OccupationDefinitionSchema.safeParse(occ);
      if (!result.success) console.error(occ.id, result.error.format());
      expect(result.success).toBe(true);
    }
  });

  it("each occupation ID starts with 'occupation.'", () => {
    for (const occ of OCCUPATIONS) {
      expect(occ.id).toMatch(/^occupation\./);
    }
  });

  it("occupation IDs are unique", () => {
    const ids = OCCUPATIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exactly one occupation has isChallenge=true (Tourist)", () => {
    const challenges = OCCUPATIONS.filter((o) => o.isChallenge);
    expect(challenges).toHaveLength(1);
    expect(challenges[0]!.id).toBe("occupation.tourist");
  });

  it("Tourist is not labelled 'joke' or presented dismissively", () => {
    const tourist = OCCUPATIONS.find((o) => o.id === "occupation.tourist")!;
    expect(tourist.description.toLowerCase()).not.toContain("joke");
    // Should be framed as deliberate challenge
    expect(tourist.description.toLowerCase()).toContain("challenge");
  });

  it("all non-challenge occupations have isChallenge=false", () => {
    const nonChallenge = OCCUPATIONS.filter((o) => !o.isChallenge);
    expect(nonChallenge).toHaveLength(7);
  });

  it("every occupation has 2–4 strengths and 1–3 tradeoffs", () => {
    for (const occ of OCCUPATIONS) {
      expect(occ.strengths.length).toBeGreaterThanOrEqual(2);
      expect(occ.strengths.length).toBeLessThanOrEqual(4);
      expect(occ.tradeoffs.length).toBeGreaterThanOrEqual(1);
      expect(occ.tradeoffs.length).toBeLessThanOrEqual(3);
    }
  });

  it("OCCUPATION_IDS matches OCCUPATIONS array order", () => {
    expect(OCCUPATION_IDS).toEqual(OCCUPATIONS.map((o) => o.id));
  });
});

describe("applyAttributeDeltas", () => {
  it("applies positive deltas and clamps to 10", () => {
    const result = applyAttributeDeltas({
      strength: 4,
      endurance: 0,
      agility: 0,
      awareness: 0,
      intelligence: 0,
      technical: 0,
      medical: 0,
      survival: 0,
      social: 0,
      resolve: 0,
    });
    // Base 5 + 4 = 9, clamped
    expect(result.strength).toBe(9);
  });

  it("applies negative deltas and clamps to 1", () => {
    const result = applyAttributeDeltas({
      strength: -4,
      endurance: -4,
      agility: 0,
      awareness: 0,
      intelligence: 0,
      technical: -4,
      medical: -4,
      survival: -4,
      social: 0,
      resolve: 0,
    });
    // Base 5 - 4 = 1
    expect(result.technical).toBe(1);
    expect(result.medical).toBe(1);
  });

  it("produces attributes all in [1,10] for every occupation", () => {
    for (const occ of OCCUPATIONS) {
      const attrs = applyAttributeDeltas(occ.attributeDeltas);
      for (const [key, val] of Object.entries(attrs)) {
        expect(val, `${occ.id} ${key}`).toBeGreaterThanOrEqual(1);
        expect(val, `${occ.id} ${key}`).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("getOccupation", () => {
  it("returns the occupation for a known ID", () => {
    const occ = getOccupation("occupation.mechanic" as OccupationId);
    expect(occ).toBeDefined();
    expect(occ!.name).toBe("Mechanic");
  });

  it("returns undefined for an unknown ID", () => {
    expect(getOccupation("occupation.ghost" as OccupationId)).toBeUndefined();
  });
});

// ── CharacterDraftSchema ──────────────────────────────────────────────────────

describe("CharacterDraftSchema", () => {
  const validDraft = {
    name: "Alex",
    pronouns: "they/them",
    ageRange: "adult",
    portraitIndex: 0,
    occupationId: "occupation.farmer",
    motivation: "Reach the family farm.",
    weakness: "Slow healer.",
    difficulty: "normal",
    seed: "test-seed-001",
    runStartedAt: "2026-08-01T00:00:00.000Z",
  };

  it("accepts a fully valid draft", () => {
    expect(CharacterDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = CharacterDraftSchema.safeParse({ ...validDraft, name: "" });
    expect(r.success).toBe(false);
  });

  it("trims name whitespace", () => {
    const r = CharacterDraftSchema.safeParse({ ...validDraft, name: "  Alex  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Alex");
  });

  it("requires customPronouns when pronouns='custom'", () => {
    const r = CharacterDraftSchema.safeParse({
      ...validDraft,
      pronouns: "custom",
      customPronouns: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "customPronouns")).toBe(true);
    }
  });

  it("accepts custom pronouns when provided", () => {
    const r = CharacterDraftSchema.safeParse({
      ...validDraft,
      pronouns: "custom",
      customPronouns: "xe/xem",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid difficulty preset", () => {
    expect(CharacterDraftSchema.safeParse({ ...validDraft, difficulty: "insane" }).success).toBe(false);
  });

  it("rejects portraitIndex out of range", () => {
    expect(CharacterDraftSchema.safeParse({ ...validDraft, portraitIndex: 8 }).success).toBe(false);
    expect(CharacterDraftSchema.safeParse({ ...validDraft, portraitIndex: -1 }).success).toBe(false);
  });
});

// ── buildInitialGameState ─────────────────────────────────────────────────────

describe("buildInitialGameState", () => {
  const parsedDraft = CharacterDraftSchema.parse({
    name: "Jordan",
    pronouns: "she/her",
    ageRange: "young-adult",
    portraitIndex: 2,
    occupationId: "occupation.nurse-emt",
    motivation: "My parents need me.",
    weakness: "I hesitate under pressure.",
    difficulty: "normal",
    seed: "seed-abc-123",
    runStartedAt: "2026-08-01T12:00:00.000Z",
  });

  it("produces a state that passes GameStateSchema", () => {
    const state = buildInitialGameState(parsedDraft);
    const result = GameStateSchema.safeParse(state);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });

  it("preserves name in the player record", () => {
    const state = buildInitialGameState(parsedDraft);
    expect(state.party.player.name).toBe("Jordan");
  });

  it("applies occupation attribute deltas deterministically", () => {
    const state1 = buildInitialGameState(parsedDraft);
    const state2 = buildInitialGameState(parsedDraft);
    expect(state1.party.player.attributes).toEqual(state2.party.player.attributes);
  });

  it("nurse-emt has medical >= 8 after deltas", () => {
    const state = buildInitialGameState(parsedDraft);
    expect(state.party.player.attributes.medical).toBeGreaterThanOrEqual(8);
  });

  it("every occupation produces a valid initial game state", () => {
    for (const occId of OCCUPATION_IDS) {
      const draft = CharacterDraftSchema.parse({
        name: "Test",
        pronouns: "they/them",
        ageRange: "adult",
        portraitIndex: 0,
        occupationId: occId,
        motivation: "Test motivation.",
        weakness: "Test weakness.",
        difficulty: "normal",
        seed: `seed-${occId}`,
        runStartedAt: "2026-08-01T00:00:00.000Z",
      });
      const state = buildInitialGameState(draft);
      const result = GameStateSchema.safeParse(state);
      if (!result.success) console.error(occId, result.error.format());
      expect(result.success, `${occId} produces invalid GameState`).toBe(true);
    }
  });

  it("runStatus is 'active' on a new run", () => {
    const state = buildInitialGameState(parsedDraft);
    expect(state.runStatus).toBe("active");
  });

  it("seed is preserved from draft", () => {
    const state = buildInitialGameState(parsedDraft);
    expect(state.seed).toBe("seed-abc-123");
  });

  it("throws for unknown occupation ID", () => {
    const badDraft = { ...parsedDraft, occupationId: "occupation.ghost" as OccupationId };
    expect(() => buildInitialGameState(badDraft)).toThrow();
  });
});
