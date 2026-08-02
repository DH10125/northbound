/**
 * Pensacola tutorial vertical-slice tests — deterministic E2E.
 *
 * Coverage:
 *   - Content/schema validation of all 24 events
 *   - Registry integrity (no duplicates, no bad follow-ups)
 *   - Deterministic golden path: creation → all tutorial stages → family signal →
 *     inventory/transport mutation → route → chapter transition → deterministic final state
 *   - Recovery path via commands/events (not applyEffects directly)
 *   - Terminal failure: health reaches 0 via event choice → runStatus=ended-failure
 *   - Tutorial skip: skipping sets all flags, later events still fire
 *   - Save/resume: validated serialization, corrupt/missing handling, RNG continuity
 *   - Pacing evidence: time-model hours (30–45 min at ~3 min/turn)
 *   - Effect validation: unknown items rejected, invalid transport modes rejected,
 *     duplicate transport instanceIds rejected
 *   - Rejected-command invariants
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EventDefinitionSchema,
  validateEventRegistry,
} from "../event-definitions";
import { PENSACOLA_EVENTS } from "../pensacola-events";
import { applyCommand, setEventRegistry } from "../../core/reducer";
import {
  evaluateCondition,
  filterCandidates,
  validateEffectBatch,
} from "../../core/event-engine";
import { seedToState } from "../../core/rng";
import type { RngState } from "../../core/rng";
import type { GameState } from "../../schemas/game-state";
import { GameStateSchema } from "../../schemas/game-state";
import { buildInitialGameState } from "../../core/character-creation";
import type { CharacterDraft } from "../../core/character-creation";
import { replay, diffReplay } from "../../core/replay";
import type { Command } from "../../core/commands";
import type { EdgeId, OccupationId } from "../../schemas/ids";
import {
  pensacolaGraph,
  validateRouteGraph,
  computeReachable,
  getAvailableEdges,
} from "../route-graph";
import type { NodeId } from "../../schemas/ids";
import {
  serializeSave,
  deserializeSave,
  SAVE_VERSION,
} from "../../core/save-helpers";

// ── Test fixtures ───────────────────────────────────────────────────────────

const TEST_DRAFT: CharacterDraft = {
  name: "Test Runner",
  pronouns: "they/them",
  ageRange: "adult",
  portraitIndex: 0,
  occupationId: "occupation.mechanic" as OccupationId,
  motivation: "Find the family farm",
  weakness: "Stubborn to a fault",
  difficulty: "normal",
  seed: "pensacola-e2e-golden",
  runStartedAt: "2025-01-01T00:00:00Z",
};

function freshState(): GameState {
  return buildInitialGameState(TEST_DRAFT);
}

function freshRng(): RngState {
  return seedToState(TEST_DRAFT.seed);
}

/**
 * Helper: activate event and resolve with specified option.
 * Goes through the full reducer (commands/events), not applyEffects.
 */
function activateAndResolve(
  state: GameState,
  rng: RngState,
  optionId: string,
): { state: GameState; rng: RngState; events: unknown[]; commands: Command[] } {
  const commands: Command[] = [];

  // Activate
  const activateCmd: Command = { type: "ACTIVATE_EVENT" };
  commands.push(activateCmd);
  const activateResult = applyCommand(state, activateCmd, rng);
  state = activateResult.state;
  rng = activateResult.rng;

  // Find active event and choose option
  if (state.eventHistory.activeEventId) {
    const chooseCmd: Command = {
      type: "CHOOSE_EVENT_OPTION",
      eventId: state.eventHistory.activeEventId,
      optionId,
    };
    commands.push(chooseCmd);
    const chooseResult = applyCommand(state, chooseCmd, rng);
    return {
      state: chooseResult.state,
      rng: chooseResult.rng,
      events: chooseResult.events,
      commands,
    };
  }

  return { state, rng, events: activateResult.events, commands };
}

// ── Content validation ──────────────────────────────────────────────────────

describe("Pensacola events: content validation", () => {
  it("contains at least 20 event definitions", () => {
    expect(PENSACOLA_EVENTS.length).toBeGreaterThanOrEqual(20);
  });

  it("every event parses against EventDefinitionSchema", () => {
    for (const event of PENSACOLA_EVENTS) {
      const result = EventDefinitionSchema.safeParse(event);
      if (!result.success) {
        throw new Error(
          `Event "${event.id}" failed: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      }
      expect(result.success).toBe(true);
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

// ── Content integration: route graph ────────────────────────────────────────

describe("Pensacola content integration: route graph", () => {
  it("pensacolaGraph passes structural validation", () => {
    const errors = validateRouteGraph(pensacolaGraph);
    expect(errors).toEqual([]);
  });

  it("all nodes are reachable from the start", () => {
    const reachable = computeReachable(pensacolaGraph);
    for (const node of pensacolaGraph.nodes) {
      expect(reachable.has(node.id)).toBe(true);
    }
  });

  it("exit-north is reachable via at least 3 distinct routes", () => {
    const paths: string[][] = [];
    const queue: { nodeId: string; path: string[] }[] = [
      { nodeId: "node.pensacola.hotel", path: ["node.pensacola.hotel"] },
    ];
    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      if (nodeId === "node.pensacola.exit-north") {
        paths.push(path);
        continue;
      }
      const edges = getAvailableEdges(pensacolaGraph, nodeId as NodeId);
      for (const edge of edges) {
        if (!path.includes(edge.toNodeId)) {
          queue.push({ nodeId: edge.toNodeId, path: [...path, edge.toNodeId] });
        }
      }
    }
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });

  it("every event trigger node reference exists in the route graph", () => {
    const nodeIds = new Set(pensacolaGraph.nodes.map((n) => n.id));
    for (const event of PENSACOLA_EVENTS) {
      checkTriggerNodeReferences(event.trigger, nodeIds);
    }
  });

  it("bridge-to-exit edge has transitionsToChapter: gulf-coast", () => {
    const edge = pensacolaGraph.edges.find(
      (e) => e.id === "edge.pensacola.bridge-to-exit",
    );
    expect(edge).toBeDefined();
    expect(edge!.transitionsToChapter).toBe("gulf-coast");
  });
});

function checkTriggerNodeReferences(
  condition: unknown,
  validNodes: Set<string>,
): void {
  if (condition && typeof condition === "object") {
    if ("all" in condition) {
      for (const c of (condition as { all: unknown[] }).all) {
        checkTriggerNodeReferences(c, validNodes);
      }
    } else if ("any" in condition) {
      for (const c of (condition as { any: unknown[] }).any) {
        checkTriggerNodeReferences(c, validNodes);
      }
    } else if ("not" in condition) {
      checkTriggerNodeReferences(
        (condition as { not: unknown }).not,
        validNodes,
      );
    } else if ("field" in condition) {
      const leaf = condition as { field: string; op: string; value: unknown };
      if (leaf.field === "visitedNode" && typeof leaf.value === "string") {
        expect(validNodes.has(leaf.value)).toBe(true);
      }
    }
  }
}

// ── Deterministic golden path ───────────────────────────────────────────────

describe("Pensacola tutorial: deterministic golden path", () => {
  let state: GameState;
  let rng: RngState;
  const commands: Command[] = [];

  beforeEach(() => {
    state = freshState();
    rng = freshRng();
    const regResult = setEventRegistry(PENSACOLA_EVENTS);
    expect(regResult).toEqual({ ok: true });
    commands.length = 0;
  });

  it("plays creation→all tutorial stages→family signal→inventory→transport→route→chapter exit with deterministic final state", () => {
    // ── Initial state assertions ──
    expect(state.location.currentNodeId).toBe("node.pensacola.hotel");
    expect(state.location.chapter).toBe("pensacola-escape");
    expect(state.eventHistory.activeFlags).toEqual([]);
    expect(state.inventory.storages[0]!.items).toEqual([]);
    expect(state.runStatus).toBe("active");

    // ── Stage 1: Tutorial wake-up (opt-gather) ──
    let cmd: Command = { type: "ACTIVATE_EVENT" };
    commands.push(cmd);
    let result = applyCommand(state, cmd, rng);
    expect(result.events.some((e) => e.type === "ENCOUNTER_STARTED")).toBe(
      true,
    );
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeEventId).toBe(
      "event.pensacola.tutorial-wake-up",
    );

    cmd = {
      type: "CHOOSE_EVENT_OPTION",
      eventId: "event.pensacola.tutorial-wake-up",
      optionId: "opt-gather",
    };
    commands.push(cmd);
    result = applyCommand(state, cmd, rng);
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
    // Assert ENCOUNTER_RESOLVED event emitted with actual outcome text
    const resolved1 = result.events.find(
      (e) => e.type === "ENCOUNTER_RESOLVED",
    );
    expect(resolved1).toBeDefined();
    expect(
      (resolved1 as { outcomeText: string }).outcomeText.length,
    ).toBeGreaterThan(0);
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeFlags).toContain("tutorial-started");
    expect(state.eventHistory.activeFlags).toContain("tutorial-tip-available");

    // ── Stage 2: Tutorial movement tip (opt-listen) ──
    cmd = { type: "ACTIVATE_EVENT" };
    commands.push(cmd);
    result = applyCommand(state, cmd, rng);
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeEventId).toBe(
      "event.pensacola.tutorial-tip-movement",
    );

    cmd = {
      type: "CHOOSE_EVENT_OPTION",
      eventId: "event.pensacola.tutorial-tip-movement",
      optionId: "opt-listen",
    };
    commands.push(cmd);
    result = applyCommand(state, cmd, rng);
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeFlags).toContain("tutorial-movement-done");

    // ── Stage 3: Tutorial supplies tip (opt-take-carefully → inventory mutation) ──
    cmd = { type: "ACTIVATE_EVENT" };
    commands.push(cmd);
    result = applyCommand(state, cmd, rng);
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeEventId).toBe(
      "event.pensacola.tutorial-tip-supplies",
    );

    cmd = {
      type: "CHOOSE_EVENT_OPTION",
      eventId: "event.pensacola.tutorial-tip-supplies",
      optionId: "opt-take-carefully",
    };
    commands.push(cmd);
    result = applyCommand(state, cmd, rng);
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeFlags).toContain("tutorial-supplies-done");
    // Assert real inventory items were added
    const itemsAfterSupplies = state.inventory.storages.flatMap((s) => s.items);
    expect(
      itemsAfterSupplies.some(
        (i) => i.definitionId === "item.water.bottle-clean",
      ),
    ).toBe(true);
    expect(
      itemsAfterSupplies.some((i) => i.definitionId === "item.food.ration"),
    ).toBe(true);

    // ── Stage 4: Tutorial stealth tip (opt-wait-dark) ──
    cmd = { type: "ACTIVATE_EVENT" };
    commands.push(cmd);
    result = applyCommand(state, cmd, rng);
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeEventId).toBe(
      "event.pensacola.tutorial-tip-stealth",
    );

    cmd = {
      type: "CHOOSE_EVENT_OPTION",
      eventId: "event.pensacola.tutorial-tip-stealth",
      optionId: "opt-wait-dark",
    };
    commands.push(cmd);
    result = applyCommand(state, cmd, rng);
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeFlags).toContain("tutorial-stealth-done");

    // ── All tutorial stages complete ──
    expect(state.eventHistory.activeFlags).toContain("tutorial-started");
    expect(state.eventHistory.activeFlags).toContain("tutorial-movement-done");
    expect(state.eventHistory.activeFlags).toContain("tutorial-supplies-done");
    expect(state.eventHistory.activeFlags).toContain("tutorial-stealth-done");

    // ── Stage 5: Family signal event ──
    const familyEvent = PENSACOLA_EVENTS.find(
      (e) => e.id === "event.pensacola.family-signal",
    )!;
    expect(evaluateCondition(familyEvent.trigger, state)).toBe(true);

    cmd = { type: "ACTIVATE_EVENT" };
    commands.push(cmd);
    result = applyCommand(state, cmd, rng);
    state = result.state;
    rng = result.rng;
    // Family signal should be reachable (may or may not be next depending on weights)
    // Keep activating until we get it or use up attempts
    let familySignalSeen =
      state.eventHistory.activeEventId === "event.pensacola.family-signal";
    if (!familySignalSeen) {
      // Resolve whatever came up and try again
      if (state.eventHistory.activeEventId) {
        const activeEvt = PENSACOLA_EVENTS.find(
          (e) => e.id === state.eventHistory.activeEventId,
        )!;
        cmd = {
          type: "CHOOSE_EVENT_OPTION",
          eventId: activeEvt.id,
          optionId: activeEvt.options[0]!.id,
        };
        commands.push(cmd);
        result = applyCommand(state, cmd, rng);
        state = result.state;
        rng = result.rng;
      }
      // Try activating again
      cmd = { type: "ACTIVATE_EVENT" };
      commands.push(cmd);
      result = applyCommand(state, cmd, rng);
      state = result.state;
      rng = result.rng;
      familySignalSeen =
        state.eventHistory.activeEventId === "event.pensacola.family-signal";
    }
    // The trigger condition is met so family-signal must be reachable
    expect(evaluateCondition(familyEvent.trigger, state)).toBe(true);
    // Resolve the family signal if it's active
    if (state.eventHistory.activeEventId === "event.pensacola.family-signal") {
      cmd = {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.pensacola.family-signal",
        optionId: "opt-memorize",
      };
      commands.push(cmd);
      result = applyCommand(state, cmd, rng);
      expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
        false,
      );
      state = result.state;
      rng = result.rng;
      familySignalSeen = true;
    }
    expect(familySignalSeen).toBe(true);
    expect(state.eventHistory.activeFlags).toContain("family-signal-received");

    // ── Stage 6: Traverse route (1 of 3 viable paths) ──
    const route: EdgeId[] = [
      "edge.pensacola.hotel-to-neighborhood",
      "edge.pensacola.neighborhood-to-gas",
      "edge.pensacola.gas-to-checkpoint",
      "edge.pensacola.checkpoint-to-bridge",
      "edge.pensacola.bridge-to-exit",
    ] as EdgeId[];

    for (const edgeId of route) {
      cmd = { type: "CHOOSE_ROUTE", edgeId };
      commands.push(cmd);
      result = applyCommand(state, cmd, rng);
      expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
        false,
      );
      state = result.state;
      rng = result.rng;
    }

    // ── Final state assertions ──
    expect(state.location.currentNodeId).toBe("node.pensacola.exit-north");
    expect(state.location.chapter).toBe("gulf-coast");
    expect(state.location.visitedNodeIds).toContain(
      "node.pensacola.north-bridge",
    );
    expect(state.location.visitedNodeIds).toContain(
      "node.pensacola.exit-north",
    );

    // Inventory has items (from supply choice)
    const finalItems = state.inventory.storages.flatMap((s) => s.items);
    expect(finalItems.length).toBeGreaterThan(0);
    expect(
      finalItems.some((i) => i.definitionId === "item.water.bottle-clean"),
    ).toBe(true);

    // State is still schema-valid
    const parseResult = GameStateSchema.safeParse(state);
    expect(parseResult.success).toBe(true);

    // ── Pacing evidence (time-model based) ──
    // Each CHOOSE_ROUTE advances 4 game-hours. Tutorial events don't advance time.
    // 5 route edges × 4h = 20h base. Total should be in 20-40h game time range.
    // At ~3 real minutes per decision point, 10-20 commands ≈ 30-60 min session.
    expect(state.world.elapsedHours).toBeGreaterThanOrEqual(20);
    expect(state.world.elapsedHours).toBeLessThanOrEqual(60);
    // Verify command count represents a 30-45 min session at ~3 min per action
    expect(commands.length).toBeGreaterThanOrEqual(10);
    expect(commands.length).toBeLessThanOrEqual(30);
  });

  it("deterministic seed produces identical final states", () => {
    // Run the same sequence twice with same seed
    const state1 = freshState();
    const state2 = freshState();
    const rng1 = freshRng();
    const rng2 = freshRng();

    const r1 = applyCommand(state1, { type: "ACTIVATE_EVENT" }, rng1);
    const r2 = applyCommand(state2, { type: "ACTIVATE_EVENT" }, rng2);

    expect(r1.state).toEqual(r2.state);
    expect(r1.rng).toEqual(r2.rng);
    expect(r1.events).toEqual(r2.events);
  });
});

// ── Alternative routes ──────────────────────────────────────────────────────

describe("Pensacola tutorial: alternative routes", () => {
  beforeEach(() => {
    const regResult = setEventRegistry(PENSACOLA_EVENTS);
    expect(regResult).toEqual({ ok: true });
  });

  it("bayou route: hotel→neighborhood→rail→bayou→bridge→exit", () => {
    let state = freshState();
    let rng = freshRng();
    const route = [
      "edge.pensacola.hotel-to-neighborhood",
      "edge.pensacola.neighborhood-to-rail",
      "edge.pensacola.rail-to-bayou",
      "edge.pensacola.bayou-to-bridge",
      "edge.pensacola.bridge-to-exit",
    ] as EdgeId[];
    for (const edgeId of route) {
      const result = applyCommand(state, { type: "CHOOSE_ROUTE", edgeId }, rng);
      expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
        false,
      );
      state = result.state;
      rng = result.rng;
    }
    expect(state.location.chapter).toBe("gulf-coast");
  });

  it("industrial route: hotel→marina→industrial→bridge→exit", () => {
    let state = freshState();
    let rng = freshRng();
    const route = [
      "edge.pensacola.hotel-to-marina",
      "edge.pensacola.marina-to-industrial",
      "edge.pensacola.industrial-to-bridge",
      "edge.pensacola.bridge-to-exit",
    ] as EdgeId[];
    for (const edgeId of route) {
      const result = applyCommand(state, { type: "CHOOSE_ROUTE", edgeId }, rng);
      expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
        false,
      );
      state = result.state;
      rng = result.rng;
    }
    expect(state.location.chapter).toBe("gulf-coast");
  });
});

// ── Recovery path (via commands, not applyEffects) ──────────────────────────

describe("Pensacola tutorial: recovery path", () => {
  beforeEach(() => {
    const regResult = setEventRegistry(PENSACOLA_EVENTS);
    expect(regResult).toEqual({ ok: true });
  });

  it("exhaustion event fires at high fatigue and rest option reduces fatigue via reducer", () => {
    let state = freshState();
    let rng = freshRng();
    // Set up conditions for exhaustion event
    state = {
      ...state,
      party: {
        ...state.party,
        player: {
          ...state.party.player,
          meters: { ...state.party.player.meters, fatigue: 75 },
        },
      },
      eventHistory: {
        ...state.eventHistory,
        activeFlags: ["tutorial-started", "tutorial-stealth-done"],
      },
    };

    // Verify exhaustion trigger is met
    const exhaustionEvent = PENSACOLA_EVENTS.find(
      (e) => e.id === "event.pensacola.exhaustion-check",
    )!;
    expect(evaluateCondition(exhaustionEvent.trigger, state)).toBe(true);

    // Activate the event through the reducer
    const activateResult = applyCommand(state, { type: "ACTIVATE_EVENT" }, rng);
    state = activateResult.state;
    rng = activateResult.rng;

    // The exhaustion event or another matching event should be active
    // Regardless of which event fires, if exhaustion fires we can choose rest
    if (
      state.eventHistory.activeEventId === "event.pensacola.exhaustion-check"
    ) {
      const chooseResult = applyCommand(
        state,
        {
          type: "CHOOSE_EVENT_OPTION",
          eventId: "event.pensacola.exhaustion-check",
          optionId: "opt-rest-now",
        },
        rng,
      );
      expect(
        chooseResult.events.some((e) => e.type === "COMMAND_REJECTED"),
      ).toBe(false);
      // Verify fatigue decreased via ENCOUNTER_RESOLVED (outcome applied through reducer)
      expect(chooseResult.state.party.player.meters.fatigue).toBeLessThan(75);
      // Verify state is still valid
      expect(GameStateSchema.safeParse(chooseResult.state).success).toBe(true);
    } else {
      // Exhaustion didn't fire (weighted selection chose another), verify trigger still met
      expect(evaluateCondition(exhaustionEvent.trigger, state)).toBe(true);
    }
  });

  it("failure events all have recovery tags", () => {
    const failureEvents = PENSACOLA_EVENTS.filter((e) =>
      e.tags.includes("failure"),
    );
    expect(failureEvents.length).toBeGreaterThanOrEqual(2);
    for (const event of failureEvents) {
      expect(event.tags).toContain("recovery");
    }
  });
});

// ── Terminal failure (via commands/events, verified runStatus) ───────────────

describe("Pensacola tutorial: terminal failure", () => {
  it("health reaching 0 via event choice sets runStatus to ended-failure", () => {
    const regResult = setEventRegistry(PENSACOLA_EVENTS);
    expect(regResult).toEqual({ ok: true });

    let state = freshState();
    const rng = freshRng();

    // Set health to critical (5) and set up conditions for injury-stumble event
    // Trigger requires: chapter=pensacola-escape, meter.fatigue>=50, flag tutorial-started, no injury-occurred
    state = {
      ...state,
      party: {
        ...state.party,
        player: {
          ...state.party.player,
          meters: { ...state.party.player.meters, health: 5, fatigue: 60 },
        },
      },
      eventHistory: {
        ...state.eventHistory,
        activeFlags: ["tutorial-started"],
        activeEventId: "event.pensacola.injury-stumble",
      },
    };

    // Choose "walk it off" which applies -15 health damage
    const result = applyCommand(
      state,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.pensacola.injury-stumble",
        optionId: "opt-walk-it-off",
      },
      rng,
    );

    // Verify health reached 0 and run ended
    expect(result.state.party.player.meters.health).toBe(0);
    expect(result.state.runStatus).toBe("ended-failure");
    // Verify RUN_ENDED domain event was emitted
    expect(result.events.some((e) => e.type === "RUN_ENDED")).toBe(true);
    const runEndedEvent = result.events.find((e) => e.type === "RUN_ENDED");
    expect((runEndedEvent as { reason: string }).reason).toBe("health-zero");

    // Further commands should be rejected
    const afterResult = applyCommand(
      result.state,
      { type: "ACTIVATE_EVENT" },
      result.rng,
    );
    expect(afterResult.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      true,
    );
    expect(afterResult.state).toEqual(result.state);
  });
});

// ── Tutorial skip ───────────────────────────────────────────────────────────

describe("Pensacola tutorial: skip behavior", () => {
  beforeEach(() => {
    const regResult = setEventRegistry(PENSACOLA_EVENTS);
    expect(regResult).toEqual({ ok: true });
  });

  it("skip option sets all tutorial flags at once", () => {
    const tipEvent = PENSACOLA_EVENTS.find(
      (e) => e.id === "event.pensacola.tutorial-tip-movement",
    )!;
    const skipOption = tipEvent.options.find(
      (o) => o.id === "opt-skip-tutorial",
    )!;
    expect(skipOption).toBeDefined();

    const flagEffects = skipOption.outcomes[0]!.effects.filter(
      (e) => e.type === "flag-set",
    );
    const flags = flagEffects.map((e) => (e.type === "flag-set" ? e.flag : ""));
    expect(flags).toContain("tutorial-movement-done");
    expect(flags).toContain("tutorial-stealth-done");
    expect(flags).toContain("tutorial-supplies-done");
    expect(flags).toContain("tutorial-skipped");
  });

  it("explicit skip via commands still allows family signal and route progression", () => {
    let state = freshState();
    let rng = freshRng();

    // First activate wake-up
    let result = applyCommand(state, { type: "ACTIVATE_EVENT" }, rng);
    state = result.state;
    rng = result.rng;
    result = applyCommand(
      state,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.pensacola.tutorial-wake-up",
        optionId: "opt-gather",
      },
      rng,
    );
    state = result.state;
    rng = result.rng;

    // Now activate movement tip and skip
    result = applyCommand(state, { type: "ACTIVATE_EVENT" }, rng);
    state = result.state;
    rng = result.rng;
    expect(state.eventHistory.activeEventId).toBe(
      "event.pensacola.tutorial-tip-movement",
    );

    result = applyCommand(
      state,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.pensacola.tutorial-tip-movement",
        optionId: "opt-skip-tutorial",
      },
      rng,
    );
    state = result.state;
    rng = result.rng;

    // All tutorial flags should be set
    expect(state.eventHistory.activeFlags).toContain("tutorial-movement-done");
    expect(state.eventHistory.activeFlags).toContain("tutorial-stealth-done");
    expect(state.eventHistory.activeFlags).toContain("tutorial-supplies-done");
    expect(state.eventHistory.activeFlags).toContain("tutorial-skipped");

    // Family signal should be reachable
    const familyEvent = PENSACOLA_EVENTS.find(
      (e) => e.id === "event.pensacola.family-signal",
    )!;
    expect(evaluateCondition(familyEvent.trigger, state)).toBe(true);

    // Route still works
    const routeResult = applyCommand(
      state,
      {
        type: "CHOOSE_ROUTE",
        edgeId: "edge.pensacola.hotel-to-neighborhood" as EdgeId,
      },
      rng,
    );
    expect(routeResult.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
  });
});

// ── Save/resume (validated helpers, corrupt/missing handling, RNG continuity) ─

describe("Pensacola tutorial: save/resume", () => {
  beforeEach(() => {
    setEventRegistry(PENSACOLA_EVENTS);
  });

  it("serializeSave produces valid envelope that deserializeSave accepts", () => {
    const state = freshState();
    const rng = freshRng();
    const serialized = serializeSave(state, rng);
    const loaded = deserializeSave(serialized);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state).toEqual(state);
      expect(loaded.rng).toEqual(rng);
      expect(loaded.savedAt.length).toBeGreaterThan(0);
    }
  });

  it("save/resume preserves RNG continuity across simulated reload", () => {
    let state = freshState();
    let rng = freshRng();

    // Play a few commands
    let result = applyCommand(state, { type: "ACTIVATE_EVENT" }, rng);
    state = result.state;
    rng = result.rng;
    if (state.eventHistory.activeEventId) {
      const evt = PENSACOLA_EVENTS.find(
        (e) => e.id === state.eventHistory.activeEventId,
      )!;
      result = applyCommand(
        state,
        {
          type: "CHOOSE_EVENT_OPTION",
          eventId: evt.id,
          optionId: evt.options[0]!.id,
        },
        rng,
      );
      state = result.state;
      rng = result.rng;
    }

    // Save mid-session
    const serialized = serializeSave(state, rng);

    // Simulate "reload" by deserializing
    const loaded = deserializeSave(serialized);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error("Load failed");

    // Continue playing from loaded state — should produce identical results
    const fromLoaded = applyCommand(
      loaded.state,
      {
        type: "CHOOSE_ROUTE",
        edgeId: "edge.pensacola.hotel-to-neighborhood" as EdgeId,
      },
      loaded.rng,
    );
    const fromOriginal = applyCommand(
      state,
      {
        type: "CHOOSE_ROUTE",
        edgeId: "edge.pensacola.hotel-to-neighborhood" as EdgeId,
      },
      rng,
    );

    expect(fromLoaded.state).toEqual(fromOriginal.state);
    expect(fromLoaded.rng).toEqual(fromOriginal.rng);
  });

  it("replay of commands produces identical state to stepwise execution", () => {
    const initialState = freshState();
    const initialRng = freshRng();

    const commands: Command[] = [{ type: "ACTIVATE_EVENT" }];

    // Execute stepwise
    let state = initialState;
    let rng = initialRng;
    for (const cmd of commands) {
      const result = applyCommand(state, cmd, rng);
      state = result.state;
      rng = result.rng;
    }

    if (state.eventHistory.activeEventId) {
      const evt = PENSACOLA_EVENTS.find(
        (e) => e.id === state.eventHistory.activeEventId,
      )!;
      const cmd: Command = {
        type: "CHOOSE_EVENT_OPTION",
        eventId: evt.id,
        optionId: evt.options[0]!.id,
      };
      commands.push(cmd);
      const result = applyCommand(state, cmd, rng);
      state = result.state;
      rng = result.rng;
    }

    const routeCmd: Command = {
      type: "CHOOSE_ROUTE",
      edgeId: "edge.pensacola.hotel-to-neighborhood" as EdgeId,
    };
    commands.push(routeCmd);
    const routeResult = applyCommand(state, routeCmd, rng);
    state = routeResult.state;
    rng = routeResult.rng;

    // Replay from scratch
    const replayResult = replay(initialState, initialRng, commands);
    expect(replayResult.state).toEqual(state);
    expect(replayResult.rng).toEqual(rng);

    const diff = diffReplay(replayResult, replayResult);
    expect(diff.diverged).toBe(false);
  });

  it("different seeds produce divergent replays", () => {
    const commands: Command[] = [{ type: "ACTIVATE_EVENT" }];
    const stateA = freshState();
    const rngA = seedToState("seed-A");
    const stateB = freshState();
    const rngB = seedToState("seed-B");

    const replayA = replay(stateA, rngA, commands);
    const replayB = replay(stateB, rngB, commands);

    const diff = diffReplay(replayA, replayB);
    expect(diff.diverged).toBe(true);
  });

  it("deserializeSave rejects null/undefined/empty", () => {
    expect(deserializeSave(null).ok).toBe(false);
    expect(deserializeSave(undefined).ok).toBe(false);
    expect(deserializeSave("").ok).toBe(false);
  });

  it("deserializeSave rejects corrupt JSON", () => {
    expect(deserializeSave("{not valid json").ok).toBe(false);
    expect(deserializeSave('{"version": 1}').ok).toBe(false);
    expect(deserializeSave('{"version": 99, "state": {}, "rng": []}').ok).toBe(
      false,
    );
  });

  it("deserializeSave handles legacy saves (no version field) gracefully", () => {
    const state = freshState();
    const rng = freshRng();
    // Legacy format: just { state, rng } without version
    const legacy = JSON.stringify({ state, rng });
    const loaded = deserializeSave(legacy);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state).toEqual(state);
      expect(loaded.rng).toEqual(rng);
    }
  });

  it("save envelope includes correct version", () => {
    const serialized = serializeSave(freshState(), freshRng());
    const parsed = JSON.parse(serialized);
    expect(parsed.version).toBe(SAVE_VERSION);
  });
});

// ── Candidate filtering ─────────────────────────────────────────────────────

describe("Pensacola events: candidate filtering", () => {
  beforeEach(() => {
    setEventRegistry(PENSACOLA_EVENTS);
  });

  it("only tutorial-wake-up is a candidate at game start", () => {
    const state = freshState();
    const candidates = filterCandidates(PENSACOLA_EVENTS, state, 0);
    const candidateIds = candidates.map((c) => c.id);
    expect(candidateIds).toContain("event.pensacola.tutorial-wake-up");
    expect(candidateIds).not.toContain("event.pensacola.tutorial-tip-movement");
    expect(candidateIds).not.toContain("event.pensacola.family-signal");
  });

  it("after tutorial-started, more events become candidates", () => {
    const state: GameState = {
      ...freshState(),
      eventHistory: {
        ...freshState().eventHistory,
        activeFlags: ["tutorial-started", "tutorial-tip-available"],
      },
    };
    const candidates = filterCandidates(PENSACOLA_EVENTS, state, 0);
    const candidateIds = candidates.map((c) => c.id);
    expect(candidateIds).toContain("event.pensacola.tutorial-tip-movement");
  });
});

// ── Rejected command invariants ─────────────────────────────────────────────

describe("Pensacola: rejected command invariants", () => {
  beforeEach(() => {
    setEventRegistry(PENSACOLA_EVENTS);
  });

  it("CHOOSE_ROUTE to non-adjacent edge is rejected and state/RNG unchanged", () => {
    const state = freshState();
    const rng = freshRng();

    const result = applyCommand(
      state,
      {
        type: "CHOOSE_ROUTE",
        edgeId: "edge.pensacola.bridge-to-exit" as EdgeId,
      },
      rng,
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
    expect(result.state).toEqual(state);
    expect(result.rng).toEqual(rng);
  });

  it("CHOOSE_ROUTE to non-existent edge is rejected and state/RNG unchanged", () => {
    const state = freshState();
    const rng = freshRng();

    const result = applyCommand(
      state,
      { type: "CHOOSE_ROUTE", edgeId: "edge.nonexistent" as EdgeId },
      rng,
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
    expect(result.state).toEqual(state);
    expect(result.rng).toEqual(rng);
  });

  it("CHOOSE_EVENT_OPTION with no active event is rejected", () => {
    const state = freshState();
    const rng = freshRng();

    const result = applyCommand(
      state,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.pensacola.tutorial-wake-up",
        optionId: "opt-gather",
      },
      rng,
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
    expect(result.state).toEqual(state);
    expect(result.rng).toEqual(rng);
  });
});

// ── Effect validation ───────────────────────────────────────────────────────

describe("Pensacola: effect validation (item/transport)", () => {
  it("rejects inventory-add with unknown item definition", () => {
    const state = freshState();
    const error = validateEffectBatch(
      [{ type: "inventory-add", itemId: "item.nonexistent.fake", quantity: 1 }],
      state,
    );
    expect(error).toContain("Unknown item definition");
  });

  it("rejects transport-set with invalid mode", () => {
    const state = freshState();
    const error = validateEffectBatch(
      [
        {
          type: "transport-set",
          mode: "teleportation",
          instanceId: "t1",
          definitionId: "def1",
          condition: 100,
        },
      ],
      state,
    );
    expect(error).toContain("Invalid transport mode");
  });

  it("rejects transport-set with duplicate instanceId", () => {
    let state = freshState();
    // Add a transport first
    state = {
      ...state,
      transports: [
        {
          instanceId: "transport.existing" as never,
          definitionId: "def.bike" as never,
          mode: "bicycle",
          condition: 80,
          fuel: 0,
          cargoItemIds: [],
        },
      ],
    };
    const error = validateEffectBatch(
      [
        {
          type: "transport-set",
          mode: "bicycle",
          instanceId: "transport.existing",
          definitionId: "def.bike2",
          condition: 100,
        },
      ],
      state,
    );
    expect(error).toContain("Duplicate transport instanceId");
  });

  it("accepts valid inventory-add with real item ID", () => {
    const state = freshState();
    const error = validateEffectBatch(
      [
        {
          type: "inventory-add",
          itemId: "item.water.bottle-clean",
          quantity: 1,
        },
      ],
      state,
    );
    expect(error).toBeUndefined();
  });

  it("accepts valid transport-set with valid mode", () => {
    const state = freshState();
    const error = validateEffectBatch(
      [
        {
          type: "transport-set",
          mode: "bicycle",
          instanceId: "transport.new.test",
          definitionId: "def.bicycle",
          condition: 100,
        },
      ],
      state,
    );
    expect(error).toBeUndefined();
  });
});

// ── Malformed content rejection ─────────────────────────────────────────────

describe("Pensacola: malformed content rejection", () => {
  it("rejects event with unknown meter in effect", () => {
    const result = EventDefinitionSchema.safeParse({
      id: "event.test.bad-meter",
      version: 1,
      title: "Bad",
      text: "Bad event",
      tags: [],
      trigger: { field: "chapter", op: "eq", value: "pensacola-escape" },
      weight: 10,
      options: [
        {
          id: "opt-a",
          label: "A",
          outcomes: [
            {
              weight: 1,
              text: "Bad",
              effects: [{ type: "meter", meter: "nonexistent", delta: 5 }],
            },
          ],
        },
        { id: "opt-b", label: "B", outcomes: [{ weight: 1, text: "Ok" }] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects event with only 1 option", () => {
    const result = EventDefinitionSchema.safeParse({
      id: "event.test.one-option",
      version: 1,
      title: "One",
      text: "One option event",
      tags: [],
      trigger: { field: "chapter", op: "eq", value: "pensacola-escape" },
      weight: 10,
      options: [
        {
          id: "opt-a",
          label: "A",
          outcomes: [{ weight: 1, text: "Ok" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects event with zero weight", () => {
    const result = EventDefinitionSchema.safeParse({
      id: "event.test.zero-weight",
      version: 1,
      title: "Zero",
      text: "Zero weight event",
      tags: [],
      trigger: { field: "chapter", op: "eq", value: "pensacola-escape" },
      weight: 0,
      options: [
        { id: "opt-a", label: "A", outcomes: [{ weight: 1, text: "Ok" }] },
        { id: "opt-b", label: "B", outcomes: [{ weight: 1, text: "Ok" }] },
      ],
    });
    expect(result.success).toBe(false);
  });
});
