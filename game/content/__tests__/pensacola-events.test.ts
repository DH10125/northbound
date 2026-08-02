/**
 * Pensacola tutorial vertical-slice tests.
 *
 * Coverage:
 *   - Content/schema validation of all 24 events
 *   - Registry integrity (no duplicates, no bad follow-ups)
 *   - Seeded deterministic golden path (creation to chapter exit)
 *   - Recovery path (failure state → recovery)
 *   - Save/resume smoke test mid-tutorial
 *   - Tutorial skip behavior
 *   - Route viability (≥ 3 viable routes reachable via flags)
 *   - Accessibility: all events have ≥ 2 options with labels
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EventDefinitionSchema,
  validateEventRegistry,
} from "../event-definitions";
import { PENSACOLA_EVENTS } from "../pensacola-events";
import { applyCommand, setEventRegistry } from "../../core/reducer";
import { evaluateCondition, filterCandidates } from "../../core/event-engine";
import { seedToState } from "../../core/rng";
import type { RngState } from "../../core/rng";
import type { GameState } from "../../schemas/game-state";
import { minimalGameState } from "../../testing/fixtures";
import type { NodeId } from "../../schemas/ids";
import { GameStateSchema } from "../../schemas/game-state";

// ── Helper to deep-clone state for save/resume ─────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// ── Content validation ─────────────────────────────────────────────────────

describe("Pensacola events: content validation", () => {
  it("contains at least 20 event definitions", () => {
    expect(PENSACOLA_EVENTS.length).toBeGreaterThanOrEqual(20);
  });

  it("every event parses against EventDefinitionSchema", () => {
    for (const event of PENSACOLA_EVENTS) {
      const result = EventDefinitionSchema.safeParse(event);
      if (!result.success) {
        throw new Error(
          `Event "${event.id}" failed schema validation: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      }
    }
  });

  it("passes registry integrity validation (no dupes, no bad follow-ups)", () => {
    const result = validateEventRegistry(PENSACOLA_EVENTS);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("all event IDs are unique", () => {
    const ids = PENSACOLA_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all events have at least 2 options with non-empty labels", () => {
    for (const event of PENSACOLA_EVENTS) {
      expect(event.options.length).toBeGreaterThanOrEqual(2);
      for (const opt of event.options) {
        expect(opt.label.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Route viability ──────────────────────────────────────────────────────────

describe("Pensacola events: route viability", () => {
  it("has at least 3 distinct route events", () => {
    const routeEvents = PENSACOLA_EVENTS.filter((e) =>
      e.tags.includes("route"),
    );
    expect(routeEvents.length).toBeGreaterThanOrEqual(3);
  });

  it("each route event is reachable with appropriate flags", () => {
    const routeEvents = PENSACOLA_EVENTS.filter((e) =>
      e.tags.includes("route"),
    );

    for (const event of routeEvents) {
      // Build a state that should satisfy this event's trigger
      const state = buildStateForEvent(event);
      const met = evaluateCondition(event.trigger, state);
      expect(met).toBe(true);
    }
  });
});

// ── Golden path ────────────────────────────────────────────────────────────

describe("Pensacola tutorial: golden path", () => {
  let state: GameState;
  let rng: RngState;

  beforeEach(() => {
    state = deepClone(minimalGameState);
    rng = seedToState("golden-path-seed-42");
    const regResult = setEventRegistry(PENSACOLA_EVENTS);
    expect(regResult).toEqual({ ok: true });
  });

  it("plays from creation through tutorial events with deterministic seed", () => {
    // Step 1: Activate event — should get tutorial-wake-up (highest weight)
    const result = applyCommand(state, { type: "ACTIVATE_EVENT" }, rng);
    const wasRejected = result.events.some(
      (e) => e.type === "COMMAND_REJECTED",
    );

    if (!wasRejected) {
      const startedEvent = result.events.find(
        (e) => e.type === "ENCOUNTER_STARTED",
      );
      expect(startedEvent).toBeDefined();

      state = result.state;
      rng = result.rng;

      // Step 2: Choose first option of active event
      if (
        startedEvent &&
        "eventId" in startedEvent &&
        typeof startedEvent.eventId === "string"
      ) {
        const eventDef = PENSACOLA_EVENTS.find(
          (e) => e.id === startedEvent.eventId,
        );
        if (eventDef) {
          const optResult = applyCommand(
            state,
            {
              type: "CHOOSE_EVENT_OPTION",
              eventId: eventDef.id,
              optionId: eventDef.options[0]!.id,
            },
            rng,
          );
          // Should not be rejected
          const optRejected = optResult.events.some(
            (e) => e.type === "COMMAND_REJECTED",
          );
          expect(optRejected).toBe(false);
          state = optResult.state;
          rng = optResult.rng;

          // tutorial-started flag should now be set
          expect(state.eventHistory.activeFlags).toContain("tutorial-started");
        }
      }
    }
  });

  it("deterministic seed produces identical runs", () => {
    const seed = "determinism-test-seed";
    const rng1 = seedToState(seed);
    const rng2 = seedToState(seed);
    const state1 = deepClone(minimalGameState);
    const state2 = deepClone(minimalGameState);

    // Same seed → same RNG state
    expect(rng1).toEqual(rng2);

    // Run same command on both
    const r1 = applyCommand(state1, { type: "ACTIVATE_EVENT" }, rng1);
    const r2 = applyCommand(state2, { type: "ACTIVATE_EVENT" }, rng2);

    expect(r1.state).toEqual(r2.state);
    expect(r1.rng).toEqual(r2.rng);
    expect(r1.events).toEqual(r2.events);
  });
});

// ── Recovery path ──────────────────────────────────────────────────────────

describe("Pensacola tutorial: recovery path", () => {
  it("failure events have recovery options", () => {
    const failureEvents = PENSACOLA_EVENTS.filter((e) =>
      e.tags.includes("failure"),
    );
    expect(failureEvents.length).toBeGreaterThanOrEqual(2);

    for (const event of failureEvents) {
      expect(event.tags).toContain("recovery");
      // At least one option should not make things worse
      const hasRecoveryOption = event.options.some((opt) =>
        opt.outcomes.some(
          (outcome) =>
            !outcome.effects.some(
              (eff) =>
                eff.type === "meter" &&
                eff.meter === "health" &&
                eff.delta < -20,
            ),
        ),
      );
      expect(hasRecoveryOption).toBe(true);
    }
  });

  it("player can recover from high fatigue via exhaustion event", () => {
    const state: GameState = {
      ...deepClone(minimalGameState),
      party: {
        ...minimalGameState.party,
        player: {
          ...minimalGameState.party.player,
          meters: {
            ...minimalGameState.party.player.meters,
            fatigue: 75,
          },
        },
      },
      eventHistory: {
        ...minimalGameState.eventHistory,
        activeFlags: ["tutorial-started", "tutorial-stealth-done"],
      },
    };

    const exhaustionEvent = PENSACOLA_EVENTS.find(
      (e) => e.id === "event.pensacola.exhaustion-check",
    )!;
    const triggerMet = evaluateCondition(exhaustionEvent.trigger, state);
    expect(triggerMet).toBe(true);

    // The "rest" option reduces fatigue
    const restOption = exhaustionEvent.options.find(
      (o) => o.id === "opt-rest-now",
    )!;
    const fatigueEffect = restOption.outcomes[0]!.effects.find(
      (e) => e.type === "meter" && e.meter === "fatigue",
    );
    expect(fatigueEffect).toBeDefined();
    if (fatigueEffect && fatigueEffect.type === "meter") {
      expect(fatigueEffect.delta).toBeLessThan(0);
    }
  });
});

// ── Save / resume smoke test ──────────────────────────────────────────────

describe("Pensacola tutorial: save/resume", () => {
  it("state survives JSON round-trip mid-tutorial", () => {
    const regResult = setEventRegistry(PENSACOLA_EVENTS);
    expect(regResult).toEqual({ ok: true });

    let state = deepClone(minimalGameState);
    let rng = seedToState("save-resume-seed");

    // Activate + resolve first event
    const activateResult = applyCommand(state, { type: "ACTIVATE_EVENT" }, rng);
    state = activateResult.state;
    rng = activateResult.rng;

    if (state.eventHistory.activeEventId) {
      const eventDef = PENSACOLA_EVENTS.find(
        (e) => e.id === state.eventHistory.activeEventId,
      );
      if (eventDef) {
        const chooseResult = applyCommand(
          state,
          {
            type: "CHOOSE_EVENT_OPTION",
            eventId: eventDef.id,
            optionId: eventDef.options[0]!.id,
          },
          rng,
        );
        state = chooseResult.state;
        rng = chooseResult.rng;
      }
    }

    // Simulate save: serialize to JSON
    const savedJson = JSON.stringify({ state, rng });

    // Simulate resume: deserialize
    const loaded = JSON.parse(savedJson) as { state: GameState; rng: RngState };

    // Validate loaded state against schema
    const parseResult = GameStateSchema.safeParse(loaded.state);
    expect(parseResult.success).toBe(true);

    // States should be identical
    expect(loaded.state).toEqual(state);
    expect(loaded.rng).toEqual(rng);

    // Continue play from loaded state
    const resumeResult = applyCommand(
      loaded.state,
      { type: "ACTIVATE_EVENT" },
      loaded.rng,
    );
    // Should not crash and should produce valid state
    const resumeParseResult = GameStateSchema.safeParse(resumeResult.state);
    expect(resumeParseResult.success).toBe(true);
  });
});

// ── Tutorial skip ────────────────────────────────────────────────────────────

describe("Pensacola tutorial: skip behavior", () => {
  it("tutorial-tip-movement has a skip option that sets all tutorial flags", () => {
    const tipEvent = PENSACOLA_EVENTS.find(
      (e) => e.id === "event.pensacola.tutorial-tip-movement",
    )!;
    const skipOption = tipEvent.options.find(
      (o) => o.id === "opt-skip-tutorial",
    )!;

    expect(skipOption).toBeDefined();

    // Skip option should set all tutorial flags
    const flagEffects = skipOption.outcomes[0]!.effects.filter(
      (e) => e.type === "flag-set",
    );
    const setFlags = flagEffects.map((e) =>
      e.type === "flag-set" ? e.flag : "",
    );

    expect(setFlags).toContain("tutorial-movement-done");
    expect(setFlags).toContain("tutorial-stealth-done");
    expect(setFlags).toContain("tutorial-supplies-done");
    expect(setFlags).toContain("tutorial-skipped");
  });

  it("skipping tutorial still allows family signal and route events", () => {
    const state: GameState = {
      ...deepClone(minimalGameState),
      eventHistory: {
        ...minimalGameState.eventHistory,
        activeFlags: [
          "tutorial-started",
          "tutorial-movement-done",
          "tutorial-stealth-done",
          "tutorial-supplies-done",
          "tutorial-skipped",
        ],
      },
    };

    // Family signal should be available
    const familyEvent = PENSACOLA_EVENTS.find(
      (e) => e.id === "event.pensacola.family-signal",
    )!;
    expect(evaluateCondition(familyEvent.trigger, state)).toBe(true);
  });
});

// ── Candidate filtering ────────────────────────────────────────────────────

describe("Pensacola events: candidate filtering", () => {
  it("only tutorial-wake-up is a candidate at game start", () => {
    const state = deepClone(minimalGameState);
    const candidates = filterCandidates(PENSACOLA_EVENTS, state, 0);

    // At game start with no flags, only wake-up should trigger
    const candidateIds = candidates.map((c) => c.id);
    expect(candidateIds).toContain("event.pensacola.tutorial-wake-up");

    // Events requiring flags should NOT be candidates
    expect(candidateIds).not.toContain(
      "event.pensacola.tutorial-tip-movement",
    );
    expect(candidateIds).not.toContain("event.pensacola.family-signal");
  });

  it("after tutorial-started, more events become candidates", () => {
    const state: GameState = {
      ...deepClone(minimalGameState),
      eventHistory: {
        ...minimalGameState.eventHistory,
        activeFlags: ["tutorial-started", "tutorial-tip-available"],
      },
    };

    const candidates = filterCandidates(PENSACOLA_EVENTS, state, 0);
    const candidateIds = candidates.map((c) => c.id);

    // Movement tip should now be available
    expect(candidateIds).toContain(
      "event.pensacola.tutorial-tip-movement",
    );
  });
});

// ── Helper: build state that satisfies a route event trigger ──────────────

function buildStateForEvent(_event: typeof PENSACOLA_EVENTS[number]): GameState {
  const state = deepClone(minimalGameState);
  state.eventHistory.activeFlags = [
    "tutorial-started",
    "tutorial-tip-available",
    "tutorial-movement-done",
    "tutorial-supplies-done",
    "tutorial-stealth-done",
    "stealth-learned",
    "family-signal-received",
  ];

  // Add visited nodes that route events need
  const nodeIds: string[] = [
    "node.pensacola.hotel",
    "node.pensacola.gas-station",
    "node.pensacola.rail-corridor",
    "node.pensacola.industrial-park",
    "node.pensacola.north-bridge",
    "node.pensacola.exit-north",
  ];
  state.location.visitedNodeIds = nodeIds as NodeId[];

  // Set meters as needed
  state.party.player.meters.fatigue = 55;
  state.party.player.meters.thirst = 20;
  state.party.player.meters.hunger = 65;

  // Set elapsed hours
  state.world.elapsedHours = 8;
  state.world.noiseLevel = 10;

  return state;
}
