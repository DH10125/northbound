/**
 * Tests for the event engine: filtering, selection, resolution, conditions,
 * cooldowns, once-only, follow-ups, skill checks, and atomic effects.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { seedToState } from "../rng";
import { applyCommand, setEventRegistry, getEventRegistry } from "../reducer";
import {
  evaluateCondition,
  filterCandidates,
  selectEvent,
  getOptionAvailability,
  resolveSkillCheck,
  selectOutcome,
  applyEffects,
  resolveEventChoice,
} from "../event-engine";
import type {
  EventDefinition,
  ConditionTree,
} from "../../content/event-definitions";
import { minimalGameState } from "../../testing/fixtures";
import type { GameState } from "../../schemas/game-state";

/** Helper: returns state with activeEventId set for authorization. */
function withActiveEvent(state: GameState, eventId: string): GameState {
  return {
    ...state,
    eventHistory: { ...state.eventHistory, activeEventId: eventId },
  };
}

// ── Test fixtures ────────────────────────────────────────────────────────────

const basicEvent: EventDefinition = {
  id: "event.test.basic",
  version: 1,
  title: "A Test Event",
  text: "Something happens on the road.",
  tags: ["test"],
  trigger: { field: "chapter", op: "eq", value: "pensacola-escape" },
  weight: 10,
  options: [
    {
      id: "opt-a",
      label: "Do thing A",
      outcomes: [{ weight: 1, text: "You did A.", effects: [] }],
    },
    {
      id: "opt-b",
      label: "Do thing B",
      outcomes: [{ weight: 1, text: "You did B.", effects: [] }],
    },
  ],
};

const eventWithEffects: EventDefinition = {
  id: "event.test.effects",
  version: 1,
  title: "Effects Event",
  text: "An event with meter effects.",
  tags: ["test"],
  trigger: { field: "runStatus", op: "eq", value: "active" },
  weight: 10,
  options: [
    {
      id: "opt-heal",
      label: "Heal up",
      outcomes: [
        {
          weight: 1,
          text: "You feel better.",
          effects: [
            { type: "meter", meter: "health", delta: -10 },
            { type: "flag-set", flag: "healed-once" },
          ],
        },
      ],
    },
    {
      id: "opt-skip",
      label: "Skip",
      outcomes: [{ weight: 1, text: "Nothing happens.", effects: [] }],
    },
  ],
};

const eventWithCheck: EventDefinition = {
  id: "event.test.check",
  version: 1,
  title: "Skill Check Event",
  text: "A challenge appears.",
  tags: ["test"],
  trigger: { field: "runStatus", op: "eq", value: "active" },
  weight: 10,
  options: [
    {
      id: "opt-check",
      label: "Attempt the challenge",
      check: { attribute: "strength", difficulty: 10, modifier: 0 },
      outcomes: [
        {
          weight: 1,
          tier: "critical-success",
          text: "Amazing success!",
          effects: [],
        },
        { weight: 1, tier: "success", text: "You succeeded.", effects: [] },
        { weight: 1, tier: "failure", text: "You failed.", effects: [] },
        {
          weight: 1,
          tier: "critical-failure",
          text: "Disaster!",
          effects: [{ type: "meter", meter: "health", delta: -20 }],
        },
      ],
    },
    {
      id: "opt-avoid",
      label: "Walk away",
      outcomes: [{ weight: 1, text: "You left.", effects: [] }],
    },
  ],
};

const onceEvent: EventDefinition = {
  id: "event.test.once",
  version: 1,
  title: "Once Only",
  text: "This happens once.",
  tags: ["test"],
  trigger: { field: "runStatus", op: "eq", value: "active" },
  weight: 10,
  once: true,
  options: [
    {
      id: "opt-1",
      label: "A",
      outcomes: [{ weight: 1, text: "Done.", effects: [] }],
    },
    {
      id: "opt-2",
      label: "B",
      outcomes: [{ weight: 1, text: "Done.", effects: [] }],
    },
  ],
};

const cooldownEvent: EventDefinition = {
  id: "event.test.cooldown",
  version: 1,
  title: "Cooldown Event",
  text: "On cooldown.",
  tags: ["test"],
  trigger: { field: "runStatus", op: "eq", value: "active" },
  weight: 10,
  cooldownTurns: 5,
  options: [
    {
      id: "opt-1",
      label: "A",
      outcomes: [{ weight: 1, text: "Done.", effects: [] }],
    },
    {
      id: "opt-2",
      label: "B",
      outcomes: [{ weight: 1, text: "Done.", effects: [] }],
    },
  ],
};

const eventWithRequirements: EventDefinition = {
  id: "event.test.requirements",
  version: 1,
  title: "Gated Options",
  text: "Some options need things.",
  tags: ["test"],
  trigger: { field: "runStatus", op: "eq", value: "active" },
  weight: 10,
  options: [
    {
      id: "opt-free",
      label: "Free option",
      outcomes: [{ weight: 1, text: "Free.", effects: [] }],
    },
    {
      id: "opt-gated",
      label: "Needs a flag",
      requirements: { field: "flag", op: "has", value: "special-key" },
      outcomes: [{ weight: 1, text: "Gated.", effects: [] }],
    },
  ],
};

// ── Condition evaluation ─────────────────────────────────────────────────────

describe("evaluateCondition", () => {
  it("evaluates simple eq condition", () => {
    const cond: ConditionTree = {
      field: "chapter",
      op: "eq",
      value: "pensacola-escape",
    };
    expect(evaluateCondition(cond, minimalGameState)).toBe(true);
  });

  it("evaluates neq condition", () => {
    const cond: ConditionTree = {
      field: "chapter",
      op: "neq",
      value: "butternut",
    };
    expect(evaluateCondition(cond, minimalGameState)).toBe(true);
  });

  it("evaluates meter gte condition", () => {
    const cond: ConditionTree = {
      field: "meter.health",
      op: "gte",
      value: 100,
    };
    expect(evaluateCondition(cond, minimalGameState)).toBe(true);
  });

  it("evaluates meter lt condition", () => {
    const cond: ConditionTree = { field: "meter.hunger", op: "lt", value: 50 };
    expect(evaluateCondition(cond, minimalGameState)).toBe(true);
  });

  it("evaluates 'all' composite", () => {
    const cond: ConditionTree = {
      all: [
        { field: "chapter", op: "eq", value: "pensacola-escape" },
        { field: "meter.health", op: "gte", value: 50 },
      ],
    };
    expect(evaluateCondition(cond, minimalGameState)).toBe(true);
  });

  it("evaluates 'any' composite", () => {
    const cond: ConditionTree = {
      any: [
        { field: "chapter", op: "eq", value: "butternut" },
        { field: "meter.health", op: "gte", value: 50 },
      ],
    };
    expect(evaluateCondition(cond, minimalGameState)).toBe(true);
  });

  it("evaluates 'not' composite", () => {
    const cond: ConditionTree = {
      not: { field: "chapter", op: "eq", value: "butternut" },
    };
    expect(evaluateCondition(cond, minimalGameState)).toBe(true);
  });

  it("evaluates 'has' flag", () => {
    const cond: ConditionTree = {
      field: "flag",
      op: "has",
      value: "test-flag",
    };
    expect(evaluateCondition(cond, minimalGameState)).toBe(false);

    const withFlag: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        activeFlags: ["test-flag"],
      },
    };
    expect(evaluateCondition(cond, withFlag)).toBe(true);
  });

  it("empty 'all' is always true", () => {
    expect(evaluateCondition({ all: [] }, minimalGameState)).toBe(true);
  });

  it("empty 'any' is always false", () => {
    expect(evaluateCondition({ any: [] }, minimalGameState)).toBe(false);
  });
});

// ── Candidate filtering ──────────────────────────────────────────────────────

describe("filterCandidates", () => {
  it("includes events whose trigger is met", () => {
    const candidates = filterCandidates([basicEvent], minimalGameState, 0);
    expect(candidates).toHaveLength(1);
  });

  it("excludes events whose trigger is not met", () => {
    const wrongChapter: EventDefinition = {
      ...basicEvent,
      id: "event.test.wrong",
      trigger: { field: "chapter", op: "eq", value: "butternut" },
    };
    const candidates = filterCandidates([wrongChapter], minimalGameState, 0);
    expect(candidates).toHaveLength(0);
  });

  it("excludes once-only events already in history", () => {
    const stateWithHistory: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        entries: [
          {
            eventId: "event.test.once" as import("../../schemas/ids").EventId,
            chosenOptionId: "opt-1",
            resolvedAtHour: 0,
            flagsSet: [],
          },
        ],
      },
    };
    const candidates = filterCandidates([onceEvent], stateWithHistory, 10);
    expect(candidates).toHaveLength(0);
  });

  it("excludes events on cooldown", () => {
    const stateWithCooldown: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        cooldowns: { "event.test.cooldown": 3 },
      },
    };
    // Turn 5, cooldown is 5, last was turn 3 → 5-3=2 < 5 → still on cooldown
    const candidates = filterCandidates([cooldownEvent], stateWithCooldown, 5);
    expect(candidates).toHaveLength(0);
  });

  it("includes events whose cooldown has expired", () => {
    const stateWithCooldown: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        cooldowns: { "event.test.cooldown": 3 },
      },
    };
    // Turn 10, cooldown is 5, last was turn 3 → 10-3=7 >= 5 → available
    const candidates = filterCandidates([cooldownEvent], stateWithCooldown, 10);
    expect(candidates).toHaveLength(1);
  });
});

// ── Stable selection (load-order independent) ────────────────────────────────

describe("selectEvent", () => {
  it("returns no-event when candidates are empty", () => {
    const rng = seedToState("select-empty");
    const [, result] = selectEvent([], rng);
    expect(result.type).toBe("no-event");
  });

  it("selection is stable regardless of input order", () => {
    const eventA: EventDefinition = {
      ...basicEvent,
      id: "event.aaa.first",
      weight: 10,
    };
    const eventB: EventDefinition = {
      ...basicEvent,
      id: "event.bbb.second",
      weight: 10,
    };

    const rng = seedToState("order-test");
    const [, resultAB] = selectEvent([eventA, eventB], rng);
    const [, resultBA] = selectEvent([eventB, eventA], rng);

    // Same result regardless of order
    expect(resultAB).toEqual(resultBA);
  });

  it("higher weight events are selected more often", () => {
    const heavy: EventDefinition = {
      ...basicEvent,
      id: "event.aaa.heavy",
      weight: 100,
    };
    const light: EventDefinition = {
      ...basicEvent,
      id: "event.bbb.light",
      weight: 1,
    };

    let rng = seedToState("weight-test");
    let heavyCount = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      let result: ReturnType<typeof selectEvent>[1];
      [rng, result] = selectEvent([heavy, light], rng);
      if (result.type === "event-selected" && result.event.id === heavy.id) {
        heavyCount++;
      }
    }
    // Heavy should dominate (100 vs 1 vs 20 no-event)
    expect(heavyCount / N).toBeGreaterThan(0.5);
  });

  it("no-event can be selected", () => {
    // With very low event weights, no-event should sometimes be chosen
    const lowWeight: EventDefinition = {
      ...basicEvent,
      id: "event.test.low",
      weight: 1,
    };
    let rng = seedToState("no-event-test");
    let noEventCount = 0;
    for (let i = 0; i < 200; i++) {
      let result: ReturnType<typeof selectEvent>[1];
      [rng, result] = selectEvent([lowWeight], rng);
      if (result.type === "no-event") noEventCount++;
    }
    expect(noEventCount).toBeGreaterThan(0);
  });
});

// ── Option availability ──────────────────────────────────────────────────────

describe("getOptionAvailability", () => {
  it("options without requirements are always available", () => {
    const avail = getOptionAvailability(basicEvent.options, minimalGameState);
    expect(avail.every((a) => a.available)).toBe(true);
  });

  it("unavailable options explain requirements", () => {
    const avail = getOptionAvailability(
      eventWithRequirements.options,
      minimalGameState,
    );
    const gated = avail.find((a) => a.optionId === "opt-gated");
    expect(gated?.available).toBe(false);
    expect(gated?.reason).toBeTruthy();
    expect(gated?.reason).toContain("flag");
  });

  it("gated option becomes available when condition is met", () => {
    const withFlag: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        activeFlags: ["special-key"],
      },
    };
    const avail = getOptionAvailability(
      eventWithRequirements.options,
      withFlag,
    );
    const gated = avail.find((a) => a.optionId === "opt-gated");
    expect(gated?.available).toBe(true);
  });
});

// ── Skill check resolution ───────────────────────────────────────────────────

describe("resolveSkillCheck", () => {
  it("returns a valid tier", () => {
    const rng = seedToState("check-test");
    const [, tier] = resolveSkillCheck(
      { attribute: "strength", difficulty: 10, modifier: 0 },
      minimalGameState,
      rng,
    );
    expect([
      "critical-failure",
      "failure",
      "success",
      "critical-success",
    ]).toContain(tier);
  });

  it("is deterministic", () => {
    const rng = seedToState("check-det");
    const [, tier1] = resolveSkillCheck(
      { attribute: "strength", difficulty: 10, modifier: 0 },
      minimalGameState,
      rng,
    );
    const [, tier2] = resolveSkillCheck(
      { attribute: "strength", difficulty: 10, modifier: 0 },
      minimalGameState,
      rng,
    );
    expect(tier1).toBe(tier2);
  });

  it("modifier shifts result", () => {
    // With +100 modifier, should always be critical success (unless nat 1)
    let rng = seedToState("check-mod");
    let crits = 0;
    for (let i = 0; i < 100; i++) {
      let tier: string;
      [rng, tier] = resolveSkillCheck(
        { attribute: "strength", difficulty: 10, modifier: 100 },
        minimalGameState,
        rng,
      );
      if (tier === "critical-success") crits++;
    }
    // At least 90% should be crits (only nat-1 prevents it, which is 5%)
    expect(crits).toBeGreaterThan(90);
  });
});

// ── Outcome selection by tier ────────────────────────────────────────────────

describe("selectOutcome", () => {
  it("filters outcomes by tier", () => {
    const outcomes = eventWithCheck.options[0]!.outcomes;
    const rng = seedToState("outcome-tier");
    const [, outcome] = selectOutcome(outcomes, "success", rng);
    expect(outcome.tier).toBe("success");
  });

  it("falls back to untiered if tier has no matches", () => {
    const outcomes = [{ weight: 1, text: "Generic.", effects: [] }];
    const rng = seedToState("outcome-fallback");
    const [, outcome] = selectOutcome(outcomes, "critical-success", rng);
    expect(outcome.text).toBe("Generic.");
  });
});

// ── Atomic effect application ────────────────────────────────────────────────

describe("applyEffects", () => {
  it("applies meter delta atomically", () => {
    const effects = [
      { type: "meter" as const, meter: "hunger", delta: 20 },
      { type: "meter" as const, meter: "thirst", delta: 15 },
    ];
    const { state } = applyEffects(effects, minimalGameState);
    expect(state.party.player.meters.hunger).toBe(20);
    expect(state.party.player.meters.thirst).toBe(15);
  });

  it("clamps meters to [0, 100]", () => {
    const effects = [{ type: "meter" as const, meter: "health", delta: -200 }];
    const { state } = applyEffects(effects, minimalGameState);
    expect(state.party.player.meters.health).toBe(0);
  });

  it("sets and clears flags", () => {
    const effects = [{ type: "flag-set" as const, flag: "test-flag" }];
    const { state } = applyEffects(effects, minimalGameState);
    expect(state.eventHistory.activeFlags).toContain("test-flag");

    const effects2 = [{ type: "flag-clear" as const, flag: "test-flag" }];
    const { state: state2 } = applyEffects(effects2, state);
    expect(state2.eventHistory.activeFlags).not.toContain("test-flag");
  });

  it("advances time", () => {
    const effects = [{ type: "time" as const, hours: 3 }];
    const { state } = applyEffects(effects, minimalGameState);
    expect(state.world.elapsedHours).toBe(3);
  });

  it("does not mutate original state", () => {
    const original = { ...minimalGameState };
    const effects = [{ type: "meter" as const, meter: "hunger", delta: 50 }];
    applyEffects(effects, minimalGameState);
    expect(minimalGameState.party.player.meters.hunger).toBe(
      original.party.player.meters.hunger,
    );
  });
});

// ── Full event resolution ────────────────────────────────────────────────────

describe("resolveEventChoice", () => {
  it("resolves a basic choice successfully", () => {
    const rng = seedToState("resolve-basic");
    const result = resolveEventChoice(
      basicEvent,
      "opt-a",
      minimalGameState,
      rng,
      0,
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
    expect(result.outcomeText).toBe("You did A.");
    expect(result.state.eventHistory.entries).toHaveLength(1);
  });

  it("rejects unknown option", () => {
    const rng = seedToState("resolve-bad-opt");
    const result = resolveEventChoice(
      basicEvent,
      "opt-nonexistent",
      minimalGameState,
      rng,
      0,
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });

  it("rejects option with unmet requirements", () => {
    const rng = seedToState("resolve-gated");
    const result = resolveEventChoice(
      eventWithRequirements,
      "opt-gated",
      minimalGameState,
      rng,
      0,
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });

  it("applies effects from chosen outcome", () => {
    const rng = seedToState("resolve-effects");
    const result = resolveEventChoice(
      eventWithEffects,
      "opt-heal",
      minimalGameState,
      rng,
      0,
    );
    expect(result.state.party.player.meters.health).toBe(90); // -10 from 100
    expect(result.state.eventHistory.activeFlags).toContain("healed-once");
  });

  it("records cooldown in event history", () => {
    const rng = seedToState("resolve-cd");
    const result = resolveEventChoice(
      cooldownEvent,
      "opt-1",
      minimalGameState,
      rng,
      7,
    );
    expect(result.state.eventHistory.cooldowns["event.test.cooldown"]).toBe(7);
  });

  it("records skill check result in history entry", () => {
    const rng = seedToState("resolve-check-hist");
    const result = resolveEventChoice(
      eventWithCheck,
      "opt-check",
      minimalGameState,
      rng,
      0,
    );
    const entry = result.state.eventHistory.entries[0];
    expect(entry?.skillCheckResult).toBeDefined();
    expect([
      "critical-failure",
      "failure",
      "success",
      "critical-success",
    ]).toContain(entry?.skillCheckResult);
  });
});

// ── Reducer integration ──────────────────────────────────────────────────────

describe("applyCommand – CHOOSE_EVENT_OPTION with event engine", () => {
  beforeEach(() => {
    setEventRegistry([
      basicEvent,
      eventWithEffects,
      eventWithCheck,
      cooldownEvent,
      onceEvent,
      eventWithRequirements,
    ]);
  });

  it("resolves event via reducer", () => {
    const rng = seedToState("reducer-event");
    const cmd = {
      type: "CHOOSE_EVENT_OPTION" as const,
      eventId: "event.test.basic",
      optionId: "opt-a",
    };
    const { state, events } = applyCommand(
      withActiveEvent(minimalGameState, "event.test.basic"),
      cmd,
      rng,
    );
    expect(events.some((e) => e.type === "COMMAND_REJECTED")).toBe(false);
    expect(state.eventHistory.entries).toHaveLength(1);
  });

  it("rejects unknown event ID", () => {
    const rng = seedToState("reducer-unknown");
    const cmd = {
      type: "CHOOSE_EVENT_OPTION" as const,
      eventId: "event.nonexistent.id",
      optionId: "opt-a",
    };
    const { events } = applyCommand(
      withActiveEvent(minimalGameState, "event.nonexistent.id"),
      cmd,
      rng,
    );
    expect(events[0]?.type).toBe("COMMAND_REJECTED");
  });

  it("prevents duplicate resolution in same turn", () => {
    const rng = seedToState("reducer-dup");
    const cmd = {
      type: "CHOOSE_EVENT_OPTION" as const,
      eventId: "event.test.basic",
      optionId: "opt-a",
    };
    const first = applyCommand(
      withActiveEvent(minimalGameState, "event.test.basic"),
      cmd,
      rng,
    );
    // Try to resolve again at same elapsedHours — activeEventId was cleared
    const second = applyCommand(
      withActiveEvent(first.state, "event.test.basic"),
      cmd,
      first.rng,
    );
    expect(second.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });
});

// ── Replay equivalence ───────────────────────────────────────────────────────

describe("event engine – replay equivalence", () => {
  beforeEach(() => {
    setEventRegistry([basicEvent, eventWithEffects]);
  });

  it("same seed and command sequence produces identical results", () => {
    const rng = seedToState("replay-event");
    const cmd = {
      type: "CHOOSE_EVENT_OPTION" as const,
      eventId: "event.test.effects",
      optionId: "opt-heal",
    };

    const r1 = applyCommand(
      withActiveEvent(minimalGameState, "event.test.effects"),
      cmd,
      rng,
    );
    const r2 = applyCommand(
      withActiveEvent(minimalGameState, "event.test.effects"),
      cmd,
      rng,
    );

    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    expect(r1.rng).toEqual(r2.rng);
  });
});

// ── Follow-up chain ──────────────────────────────────────────────────────────

describe("event engine – follow-up chains", () => {
  const chainEvent1: EventDefinition = {
    id: "event.test.chain1",
    version: 1,
    title: "Chain Start",
    text: "First in chain.",
    tags: ["test"],
    trigger: { field: "runStatus", op: "eq", value: "active" },
    weight: 10,
    options: [
      {
        id: "opt-start",
        label: "Begin chain",
        outcomes: [
          {
            weight: 1,
            text: "Chain started.",
            effects: [
              { type: "flag-set", flag: "chain-started" },
              { type: "follow-up", eventId: "event.test.chain2" },
            ],
          },
        ],
      },
      {
        id: "opt-skip",
        label: "Skip",
        outcomes: [{ weight: 1, text: "Skipped.", effects: [] }],
      },
    ],
  };

  const chainEvent2: EventDefinition = {
    id: "event.test.chain2",
    version: 1,
    title: "Chain Follow-up",
    text: "Second in chain.",
    tags: ["test"],
    trigger: { field: "flag", op: "has", value: "chain-started" },
    weight: 10,
    options: [
      {
        id: "opt-end",
        label: "End chain",
        outcomes: [
          {
            weight: 1,
            text: "Chain ended.",
            effects: [{ type: "flag-set", flag: "chain-ended" }],
          },
        ],
      },
      {
        id: "opt-skip",
        label: "Skip",
        outcomes: [{ weight: 1, text: "Skipped.", effects: [] }],
      },
    ],
  };

  beforeEach(() => {
    setEventRegistry([chainEvent1, chainEvent2]);
  });

  it("follow-up flag enables second event in chain", () => {
    const rng = seedToState("chain-test");
    // Resolve first event
    const r1 = applyCommand(
      withActiveEvent(minimalGameState, "event.test.chain1"),
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.chain1",
        optionId: "opt-start",
      },
      rng,
    );
    expect(r1.state.eventHistory.activeFlags).toContain("chain-started");

    // Now chain2 should be eligible
    const candidates = filterCandidates([chainEvent2], r1.state, 1);
    expect(candidates).toHaveLength(1);

    // Resolve second event (authorized via pendingFollowUp)
    const r2 = applyCommand(
      r1.state,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.chain2",
        optionId: "opt-end",
      },
      r1.rng,
    );
    expect(r2.state.eventHistory.activeFlags).toContain("chain-ended");
  });

  it("follow-up event is not available without setup flag", () => {
    const candidates = filterCandidates([chainEvent2], minimalGameState, 0);
    expect(candidates).toHaveLength(0);
  });

  it("resolving chain1 sets pendingFollowUp in state", () => {
    const rng = seedToState("chain-pending");
    const r1 = applyCommand(
      withActiveEvent(minimalGameState, "event.test.chain1"),
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.chain1",
        optionId: "opt-start",
      },
      rng,
    );
    expect(r1.state.eventHistory.pendingFollowUp).toBe("event.test.chain2");
  });

  it("pendingFollowUp blocks resolving unrelated events", () => {
    const stateWithPending: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        pendingFollowUp: "event.test.chain2",
        activeFlags: ["chain-started"],
        activeEventId: "event.test.chain1",
      },
    };
    setEventRegistry([chainEvent1, chainEvent2]);
    const rng = seedToState("block-unrelated");
    const result = applyCommand(
      stateWithPending,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.chain1",
        optionId: "opt-start",
      },
      rng,
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });

  it("pendingFollowUp allows resolving the follow-up event (bypass trigger)", () => {
    // chain2 trigger requires flag "chain-started" — set pendingFollowUp but NOT the flag
    const stateWithPending: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        pendingFollowUp: "event.test.chain2",
      },
    };
    setEventRegistry([chainEvent1, chainEvent2]);
    const rng = seedToState("allow-followup");
    const result = applyCommand(
      stateWithPending,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.chain2",
        optionId: "opt-end",
      },
      rng,
    );
    // Should succeed even without trigger met (follow-up bypasses trigger)
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
    expect(result.state.eventHistory.pendingFollowUp).toBeNull();
  });
});

// ── Resolution legitimacy ─────────────────────────────────────────────────────

describe("applyCommand – resolution legitimacy enforcement", () => {
  beforeEach(() => {
    setEventRegistry([basicEvent, onceEvent, cooldownEvent, eventWithEffects]);
  });

  it("rejects once-only event already resolved", () => {
    const stateResolved: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        activeEventId: "event.test.once",
        entries: [
          {
            eventId: "event.test.once" as import("../../schemas/ids").EventId,
            chosenOptionId: "opt-1",
            resolvedAtHour: 0,
            flagsSet: [],
          },
        ],
      },
    };
    const rng = seedToState("once-reject");
    const result = applyCommand(
      stateResolved,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.once",
        optionId: "opt-1",
      },
      rng,
    );
    expect(result.events[0]?.type).toBe("COMMAND_REJECTED");
  });

  it("rejects event on cooldown", () => {
    const stateOnCooldown: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        activeEventId: "event.test.cooldown",
        cooldowns: { "event.test.cooldown": 0 },
      },
    };
    const rng = seedToState("cd-reject");
    // elapsedHours=0 → currentTurn=0, lastTurn=0, 0-0=0 < 5 → on cooldown
    const result = applyCommand(
      stateOnCooldown,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.cooldown",
        optionId: "opt-1",
      },
      rng,
    );
    expect(result.events[0]?.type).toBe("COMMAND_REJECTED");
  });

  it("rejects event whose trigger is not met", () => {
    // basicEvent trigger requires chapter=pensacola-escape
    const stateWrongChapter: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        activeEventId: "event.test.basic",
      },
      location: { ...minimalGameState.location, chapter: "butternut" },
    };
    const rng = seedToState("trigger-reject");
    const result = applyCommand(
      stateWrongChapter,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.basic",
        optionId: "opt-a",
      },
      rng,
    );
    expect(result.events[0]?.type).toBe("COMMAND_REJECTED");
  });

  it("rejects event not activated (forged ID)", () => {
    const rng = seedToState("forged-reject");
    // basicEvent trigger IS met (chapter=pensacola-escape) but not activated
    const result = applyCommand(
      minimalGameState,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.test.basic",
        optionId: "opt-a",
      },
      rng,
    );
    expect(result.events[0]?.type).toBe("COMMAND_REJECTED");
    expect(result.rng).toEqual(rng); // RNG not consumed
  });
});

// ── ACTIVATE_EVENT deterministic authorization ────────────────────────────────

describe("applyCommand – ACTIVATE_EVENT deterministic authorization", () => {
  beforeEach(() => {
    setEventRegistry([basicEvent, eventWithEffects, onceEvent, cooldownEvent]);
  });

  it("rejects activation of trigger-eligible but not selected event", () => {
    // All registered events are eligible, but seeded selection only picks one.
    const rng = seedToState("activation-wrong");
    const registry = getEventRegistry();
    const candidates = filterCandidates(registry, minimalGameState, 0);
    expect(candidates.length).toBeGreaterThan(1);

    // Run selection to determine which event is actually chosen
    const [, selectionResult] = selectEvent(candidates, rng);
    const selectedId =
      selectionResult.type === "event-selected"
        ? selectionResult.event.id
        : null;

    // Try to activate a DIFFERENT eligible event
    const otherCandidate = candidates.find((c) => c.id !== selectedId);
    if (!otherCandidate) return; // all candidates are the same; skip

    const result = applyCommand(
      minimalGameState,
      { type: "ACTIVATE_EVENT", eventId: otherCandidate.id },
      rng,
    );
    expect(result.events[0]?.type).toBe("COMMAND_REJECTED");
    expect(result.events[0]).toHaveProperty("reason");
  });

  it("allows activation of the exact selected event", () => {
    const rng = seedToState("activation-correct");
    // Use the full registry that beforeEach installed
    const registry = getEventRegistry();
    const candidates = filterCandidates(registry, minimalGameState, 0);
    const [, selectionResult] = selectEvent(candidates, rng);

    if (selectionResult.type !== "event-selected") {
      // no-event was selected; skip this test iteration
      return;
    }

    const result = applyCommand(
      minimalGameState,
      { type: "ACTIVATE_EVENT", eventId: selectionResult.event.id },
      rng,
    );
    expect(result.events.some((e) => e.type === "ENCOUNTER_STARTED")).toBe(
      true,
    );
    expect(result.state.eventHistory.activeEventId).toBe(
      selectionResult.event.id,
    );
  });

  it("emits ENCOUNTER_STARTED exactly once (at activation, not resolution)", () => {
    const rng = seedToState("encounter-once");
    const registry = getEventRegistry();
    const candidates = filterCandidates(registry, minimalGameState, 0);
    const [, selectionResult] = selectEvent(candidates, rng);
    if (selectionResult.type !== "event-selected") return;

    // Activate
    const activateResult = applyCommand(
      minimalGameState,
      { type: "ACTIVATE_EVENT", eventId: selectionResult.event.id },
      rng,
    );
    const activateEncounters = activateResult.events.filter(
      (e) => e.type === "ENCOUNTER_STARTED",
    );
    expect(activateEncounters).toHaveLength(1);

    // Resolve
    const resolveResult = applyCommand(
      activateResult.state,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: selectionResult.event.id,
        optionId: selectionResult.event.options[0]!.id,
      },
      activateResult.rng,
    );
    const resolveEncounters = resolveResult.events.filter(
      (e) => e.type === "ENCOUNTER_STARTED",
    );
    expect(resolveEncounters).toHaveLength(0);
  });

  it("allows activation of exact queued follow-up via pendingFollowUp", () => {
    // Set up chain events
    const chainA: EventDefinition = {
      ...basicEvent,
      id: "event.chain.a",
      options: [
        {
          id: "opt-chain",
          label: "Chain",
          outcomes: [
            {
              weight: 1,
              text: "Chained.",
              effects: [{ type: "follow-up", eventId: "event.chain.b" }],
            },
          ],
        },
        {
          id: "opt-skip",
          label: "Skip",
          outcomes: [{ weight: 1, text: "Skipped.", effects: [] }],
        },
      ],
    };
    const chainB: EventDefinition = {
      ...basicEvent,
      id: "event.chain.b",
    };
    setEventRegistry([chainA, chainB]);

    // Manually set pendingFollowUp to chain B
    const stateWithFollowUp: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        pendingFollowUp: "event.chain.b",
        activeEventId: "event.chain.b",
      },
    };

    // Should be able to resolve chain B via pendingFollowUp (bypass activation)
    const rng = seedToState("followup-resolve");
    const result = applyCommand(
      stateWithFollowUp,
      {
        type: "CHOOSE_EVENT_OPTION",
        eventId: "event.chain.b",
        optionId: "opt-a",
      },
      rng,
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
    expect(result.state.eventHistory.entries).toHaveLength(1);
  });

  it("rejects activation of once-resolved event", () => {
    const stateResolved: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        entries: [
          {
            eventId: "event.test.once" as import("../../schemas/ids").EventId,
            chosenOptionId: "opt-1",
            resolvedAtHour: 0,
            flagsSet: [],
          },
        ],
      },
    };
    const rng = seedToState("once-activate-reject");
    const result = applyCommand(
      stateResolved,
      { type: "ACTIVATE_EVENT", eventId: "event.test.once" },
      rng,
    );
    // once-resolved events are filtered out of candidates
    expect(result.events[0]?.type).toBe("COMMAND_REJECTED");
  });

  it("rejects activation of event on cooldown", () => {
    const stateOnCooldown: GameState = {
      ...minimalGameState,
      eventHistory: {
        ...minimalGameState.eventHistory,
        cooldowns: { "event.test.cooldown": 0 },
      },
    };
    const rng = seedToState("cooldown-activate-reject");
    const result = applyCommand(
      stateOnCooldown,
      { type: "ACTIVATE_EVENT", eventId: "event.test.cooldown" },
      rng,
    );
    expect(result.events[0]?.type).toBe("COMMAND_REJECTED");
  });
});

// ── setEventRegistry validation ───────────────────────────────────────────────

describe("setEventRegistry – schema parsing and validation", () => {
  it("accepts valid event definitions", () => {
    const result = setEventRegistry([basicEvent]);
    expect(result).toEqual({ ok: true });
    expect(getEventRegistry()).toHaveLength(1);
  });

  it("rejects malformed structure (missing required fields)", () => {
    const malformed = { id: "bad", title: "Bad" }; // missing many fields
    const result = setEventRegistry([malformed]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Event[0]");
    }
  });

  it("preserves previous registry on parse failure", () => {
    // Install valid registry first
    setEventRegistry([basicEvent]);
    expect(getEventRegistry()).toHaveLength(1);

    // Try to install malformed — should fail and preserve previous
    const result = setEventRegistry([{ id: "bad" }]);
    expect(result.ok).toBe(false);
    expect(getEventRegistry()).toHaveLength(1);
    expect(getEventRegistry()[0]!.id).toBe("event.test.basic");
  });

  it("rejects invalid follow-up references at installation", () => {
    const eventWithBadFollowUp: EventDefinition = {
      ...basicEvent,
      id: "event.bad-followup",
      options: [
        {
          id: "opt-a",
          label: "A",
          outcomes: [
            {
              weight: 1,
              text: "X",
              effects: [
                { type: "follow-up", eventId: "event.nonexistent.target" },
              ],
            },
          ],
        },
        {
          id: "opt-b",
          label: "B",
          outcomes: [{ weight: 1, text: "Y", effects: [] }],
        },
      ],
    };
    const result = setEventRegistry([eventWithBadFollowUp]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("unknown follow-up"))).toBe(
        true,
      );
    }
  });

  it("rejects duplicate event IDs at installation", () => {
    const dup: EventDefinition = { ...basicEvent };
    const result = setEventRegistry([basicEvent, dup]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("Duplicate"))).toBe(true);
    }
  });

  it("preserves previous registry on reference validation failure", () => {
    setEventRegistry([basicEvent]);
    const eventWithBadRef: EventDefinition = {
      ...basicEvent,
      id: "event.bad-ref",
      options: [
        {
          id: "opt-a",
          label: "A",
          outcomes: [
            {
              weight: 1,
              text: "X",
              effects: [{ type: "follow-up", eventId: "event.missing" }],
            },
          ],
        },
        {
          id: "opt-b",
          label: "B",
          outcomes: [{ weight: 1, text: "Y", effects: [] }],
        },
      ],
    };
    const result = setEventRegistry([eventWithBadRef]);
    expect(result.ok).toBe(false);
    expect(getEventRegistry()).toHaveLength(1);
    expect(getEventRegistry()[0]!.id).toBe("event.test.basic");
  });
});
