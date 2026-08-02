/**
 * Tests for the conditions, illness, injury, and treatment system.
 *
 * Covers: staged progression/recovery, untreated worsening, treatment/resource
 * costs, rest effects, symptom visibility by skill, severe-risk warnings,
 * permanent modifier persistence, malformed content rejection, and command
 * rollback on invalid treatment.
 */

import { describe, it, expect } from "vitest";
import { applyCommand } from "../reducer";
import { seedToState } from "../rng";
import type { RngState } from "../rng";
import { minimalGameState } from "../../testing/fixtures";
import type { GameState } from "../../schemas/game-state";
import type { ActiveCondition } from "../../schemas/conditions";
import {
  tickConditions,
  getSymptomVisibility,
} from "../condition-engine";
import {
  CONDITIONS,
  getConditionDefinition,
  ConditionDefinitionSchema,
} from "../../content/conditions";
import type { ItemInstanceId, ItemId } from "../../schemas/ids";

// ── Helpers ──────────────────────────────────────────────────────────────────

function stateWithCondition(
  conditionId: string,
  stageIndex = 0,
  treated = false,
  turnsAtStage = 0,
): GameState {
  const condition: ActiveCondition = {
    conditionId,
    stageIndex,
    turnsAtStage,
    totalTurns: turnsAtStage,
    treated,
    treatmentTurns: 0,
  };
  return {
    ...minimalGameState,
    party: {
      ...minimalGameState.party,
      player: {
        ...minimalGameState.party.player,
        conditions: [condition],
      },
    },
  };
}

function stateWithTreatmentItems(
  conditionId: string,
  stageIndex = 0,
): GameState {
  const def = getConditionDefinition(conditionId)!;
  const base = stateWithCondition(conditionId, stageIndex);
  return {
    ...base,
    inventory: {
      storages: [
        {
          location: "backpack",
          items: [
            {
              instanceId: "treat-item-001" as ItemInstanceId,
              definitionId: def.treatmentItemId as ItemId,
              quantity: 10,
              condition: 100,
            },
          ],
        },
      ],
    },
  };
}

const rng: RngState = seedToState("condition-test");

// ── Content validation ───────────────────────────────────────────────────────

describe("Condition definitions", () => {
  it("all 6 conditions parse successfully", () => {
    expect(CONDITIONS).toHaveLength(6);
    for (const cond of CONDITIONS) {
      const result = ConditionDefinitionSchema.safeParse(cond);
      expect(result.success).toBe(true);
    }
  });

  it("each condition has valid stage progression", () => {
    for (const cond of CONDITIONS) {
      // mild, moderate, severe should have turnsToProgress > 0
      expect(cond.stages.mild.turnsToProgress).toBeGreaterThan(0);
      expect(cond.stages.moderate.turnsToProgress).toBeGreaterThan(0);
      expect(cond.stages.severe.turnsToProgress).toBeGreaterThan(0);
      // critical is terminal
      expect(cond.stages.critical.turnsToProgress).toBe(0);
    }
  });

  it("severe and critical stages have severeRisk=true with warning", () => {
    for (const cond of CONDITIONS) {
      expect(cond.stages.severe.severeRisk).toBe(true);
      expect(cond.stages.severe.severeRiskWarning).toBeDefined();
      expect(cond.stages.critical.severeRisk).toBe(true);
      expect(cond.stages.critical.severeRiskWarning).toBeDefined();
    }
  });
});

// ── Condition progression ────────────────────────────────────────────────────

describe("Condition tick — untreated progression", () => {
  it("advances turnsAtStage each tick", () => {
    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 0,
      turnsAtStage: 0,
      totalTurns: 0,
      treated: false,
      treatmentTurns: 0,
    };

    const result = tickConditions([cond], [], false);
    expect(result.conditions[0]!.turnsAtStage).toBe(1);
    expect(result.conditions[0]!.totalTurns).toBe(1);
  });

  it("progresses to next stage when threshold reached", () => {
    const def = getConditionDefinition("condition.dehydration")!;
    const threshold = def.stages.mild.turnsToProgress;

    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 0,
      turnsAtStage: threshold - 1, // Next tick hits threshold
      totalTurns: threshold - 1,
      treated: false,
      treatmentTurns: 0,
    };

    const result = tickConditions([cond], [], false);
    expect(result.conditions[0]!.stageIndex).toBe(1);
    expect(result.conditions[0]!.turnsAtStage).toBe(0);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "CONDITION_PROGRESS",
        conditionId: "condition.dehydration",
        delta: 1,
      }),
    );
  });

  it("applies per-turn meter effects", () => {
    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 0,
      turnsAtStage: 0,
      totalTurns: 0,
      treated: false,
      treatmentTurns: 0,
    };

    const result = tickConditions([cond], [], false);
    expect(result.meterDeltas.fatigue).toBe(2);
    expect(result.meterDeltas.thirst).toBe(3);
  });

  it("applies permanent modifier when reaching critical untreated", () => {
    const def = getConditionDefinition("condition.dehydration")!;
    const threshold = def.stages.severe.turnsToProgress;

    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 2, // severe
      turnsAtStage: threshold - 1,
      totalTurns: 20,
      treated: false,
      treatmentTurns: 0,
    };

    const result = tickConditions([cond], [], false);
    expect(result.conditions[0]!.stageIndex).toBe(3); // critical
    expect(result.permanentModifiers).toContainEqual(
      expect.objectContaining({
        sourceConditionId: "condition.dehydration",
        target: "endurance",
        delta: -1,
      }),
    );
  });

  it("does not duplicate permanent modifier if already present", () => {
    const def = getConditionDefinition("condition.dehydration")!;
    const threshold = def.stages.severe.turnsToProgress;

    const existingMod = {
      sourceConditionId: "condition.dehydration",
      target: "endurance",
      delta: -1,
      label: "Kidney strain (past dehydration crisis)",
    };

    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 2,
      turnsAtStage: threshold - 1,
      totalTurns: 20,
      treated: false,
      treatmentTurns: 0,
    };

    const result = tickConditions([cond], [existingMod], false);
    const mods = result.permanentModifiers.filter(
      (m) => m.sourceConditionId === "condition.dehydration",
    );
    expect(mods).toHaveLength(1);
  });
});

// ── Rest slows progression ───────────────────────────────────────────────────

describe("Rest slows progression", () => {
  it("doubles turns to progress for restSlowsProgression conditions when resting", () => {
    // heat-illness has restSlowsProgression: true, mild turnsToProgress: 5
    const cond: ActiveCondition = {
      conditionId: "condition.heat-illness",
      stageIndex: 0,
      turnsAtStage: 4, // Would progress at 5 normally
      totalTurns: 4,
      treated: false,
      treatmentTurns: 0,
    };

    // Without rest — should progress
    const resultNoRest = tickConditions([cond], [], false);
    expect(resultNoRest.conditions[0]!.stageIndex).toBe(1);

    // With rest — should NOT progress (threshold is 10)
    const resultRest = tickConditions([cond], [], true);
    expect(resultRest.conditions[0]!.stageIndex).toBe(0);
    expect(resultRest.conditions[0]!.turnsAtStage).toBe(5);
  });

  it("does NOT slow progression for non-restSlowsProgression conditions", () => {
    // dehydration has restSlowsProgression: false, mild turnsToProgress: 6
    const def = getConditionDefinition("condition.dehydration")!;
    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 0,
      turnsAtStage: def.stages.mild.turnsToProgress - 1,
      totalTurns: 5,
      treated: false,
      treatmentTurns: 0,
    };

    const result = tickConditions([cond], [], true);
    expect(result.conditions[0]!.stageIndex).toBe(1); // Still progresses
  });
});

// ── Treatment and recovery ───────────────────────────────────────────────────

describe("Condition tick — treated recovery", () => {
  it("accumulates treatment turns when treated", () => {
    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 1,
      turnsAtStage: 3,
      totalTurns: 10,
      treated: true,
      treatmentTurns: 0,
    };

    const result = tickConditions([cond], [], false);
    expect(result.conditions[0]!.treatmentTurns).toBe(1);
    expect(result.conditions[0]!.treated).toBe(true);
  });

  it("drops one stage when treatment threshold met", () => {
    const def = getConditionDefinition("condition.dehydration")!;
    const threshold = def.stages.moderate.treatmentTurnsRequired;

    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 1, // moderate
      turnsAtStage: 5,
      totalTurns: 15,
      treated: true,
      treatmentTurns: threshold - 1,
    };

    const result = tickConditions([cond], [], false);
    expect(result.conditions[0]!.stageIndex).toBe(0); // back to mild
    expect(result.conditions[0]!.treated).toBe(false); // must re-treat
    expect(result.events).toContainEqual(
      expect.objectContaining({ delta: -1 }),
    );
  });

  it("fully recovers when treated at mild stage", () => {
    const def = getConditionDefinition("condition.dehydration")!;
    const threshold = def.stages.mild.treatmentTurnsRequired;

    const cond: ActiveCondition = {
      conditionId: "condition.dehydration",
      stageIndex: 0,
      turnsAtStage: 3,
      totalTurns: 20,
      treated: true,
      treatmentTurns: threshold - 1,
    };

    const result = tickConditions([cond], [], false);
    expect(result.conditions).toHaveLength(0);
    expect(result.recovered).toContain("condition.dehydration");
  });
});

// ── TREAT_CONDITION command ──────────────────────────────────────────────────

describe("TREAT_CONDITION command", () => {
  it("rejects when condition not active", () => {
    const result = applyCommand(
      minimalGameState,
      { type: "TREAT_CONDITION", conditionId: "condition.dehydration" },
      rng,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "COMMAND_REJECTED" }),
    );
    expect(result.state).toBe(minimalGameState);
  });

  it("rejects when treatment items unavailable", () => {
    const state = stateWithCondition("condition.dehydration");
    const result = applyCommand(
      state,
      { type: "TREAT_CONDITION", conditionId: "condition.dehydration" },
      rng,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "COMMAND_REJECTED",
        reason: expect.stringContaining("Insufficient"),
      }),
    );
  });

  it("rejects when already treated", () => {
    const state = stateWithTreatmentItems("condition.dehydration");
    // First treat
    const r1 = applyCommand(
      state,
      { type: "TREAT_CONDITION", conditionId: "condition.dehydration" },
      rng,
    );
    // Try again
    const r2 = applyCommand(
      r1.state,
      { type: "TREAT_CONDITION", conditionId: "condition.dehydration" },
      r1.rng,
    );
    expect(r2.events).toContainEqual(
      expect.objectContaining({ type: "COMMAND_REJECTED" }),
    );
  });

  it("consumes items and marks condition as treated on success", () => {
    const state = stateWithTreatmentItems("condition.dehydration");
    const result = applyCommand(
      state,
      { type: "TREAT_CONDITION", conditionId: "condition.dehydration" },
      rng,
    );

    // Should not be rejected
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ type: "COMMAND_REJECTED" }),
    );

    // Condition should be marked treated
    const cond = result.state.party.player.conditions[0]!;
    expect(cond.treated).toBe(true);

    // Item quantity should be reduced
    const items = result.state.inventory.storages[0]!.items;
    const treatItem = items.find(
      (i) => i.instanceId === ("treat-item-001" as ItemInstanceId),
    );
    expect(treatItem!.quantity).toBe(9); // 10 - 1 (dehydration costs 1)
  });

  it("does not consume RNG on rejection", () => {
    const result = applyCommand(
      minimalGameState,
      { type: "TREAT_CONDITION", conditionId: "condition.dehydration" },
      rng,
    );
    expect(result.rng).toEqual(rng);
  });
});

// ── Symptom visibility ───────────────────────────────────────────────────────

describe("Symptom visibility by medical skill", () => {
  const cond: ActiveCondition = {
    conditionId: "condition.dehydration",
    stageIndex: 0,
    turnsAtStage: 2,
    totalTurns: 2,
    treated: false,
    treatmentTurns: 0,
  };

  it("shows only basic symptoms with low medical skill", () => {
    const vis = getSymptomVisibility(cond, 1);
    expect(vis).not.toBeNull();
    expect(vis!.symptoms).toEqual(["Dry mouth", "Mild headache"]);
    expect(vis!.uncertaintyNote).toContain("unclear");
  });

  it("shows detailed symptoms with sufficient medical skill", () => {
    const vis = getSymptomVisibility(cond, 3);
    expect(vis).not.toBeNull();
    expect(vis!.symptoms).toContain("Decreased skin turgor");
    expect(vis!.uncertaintyNote).toContain("uncertain");
  });

  it("shows high confidence with high medical skill", () => {
    const vis = getSymptomVisibility(cond, 5);
    expect(vis).not.toBeNull();
    expect(vis!.uncertaintyNote).toContain("Likely");
  });

  it("exposes severe risk warning at severe stage", () => {
    const severeCond: ActiveCondition = { ...cond, stageIndex: 2 };
    const vis = getSymptomVisibility(severeCond, 5);
    expect(vis!.severeRisk).toBe(true);
    expect(vis!.severeRiskWarning).toBeDefined();
  });
});

// ── Integration: condition effects through reducer ───────────────────────────

describe("Conditions integrated with turn resolution", () => {
  it("condition meter effects applied during TRAVEL", () => {
    const state = stateWithCondition("condition.dehydration", 0);
    const result = applyCommand(state, { type: "TRAVEL", turnsToTravel: 1 }, rng);

    // Dehydration mild: +2 fatigue, +3 thirst per turn (on top of upkeep)
    const player = result.state.party.player;
    expect(player.meters.thirst).toBeGreaterThan(
      minimalGameState.party.player.meters.thirst,
    );
  });

  it("condition meter effects applied during REST", () => {
    const state = stateWithCondition("condition.dehydration", 0);
    const result = applyCommand(state, { type: "REST", hours: 4 }, rng);

    const player = result.state.party.player;
    expect(player.meters.thirst).toBeGreaterThan(0);
  });

  it("permanent modifiers persist through save schema validation", async () => {
    const state: GameState = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        player: {
          ...minimalGameState.party.player,
          permanentModifiers: [
            {
              sourceConditionId: "condition.dehydration",
              target: "endurance",
              delta: -1,
              label: "Kidney strain (past dehydration crisis)",
            },
          ],
        },
      },
    };

    // Validate against schema
    const { GameStateSchema } = await import("../../schemas/game-state");
    const result = GameStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });
});

// ── Malformed content ────────────────────────────────────────────────────────

describe("Malformed condition content", () => {
  it("rejects condition definition with missing fields", () => {
    const bad = { id: "condition.bad", name: "Bad" };
    const result = ConditionDefinitionSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects condition definition with invalid stage", () => {
    const bad = {
      ...CONDITIONS[0],
      stages: {
        ...CONDITIONS[0]!.stages,
        mild: { ...CONDITIONS[0]!.stages.mild, turnsToProgress: -1 },
      },
    };
    const result = ConditionDefinitionSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
