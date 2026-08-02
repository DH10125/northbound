/**
 * Tests for turn-clock module and its integration with the reducer.
 *
 * Covers:
 *   - Phase derivation (hoursToPhase) at every boundary.
 *   - Action availability rules per phase.
 *   - Disabled-action reasons are non-empty strings.
 *   - Canonical turn durations (ACTION_TURN_HOURS).
 *   - Meter upkeep: correct deltas, clamps to [0,100].
 *   - Farm-clock advances by exactly 1 per accepted turn.
 *   - Time advances exactly once per accepted turn; rejected turns leave time unchanged.
 *   - TURN_RESOLVED and FARM_CLOCK_TICKED events emitted on every accepted action.
 *   - Deterministic replay: same seed + commands → identical state.
 */

import { describe, it, expect } from "vitest";
import {
  hoursToPhase,
  getActionAvailability,
  computeUpkeep,
  tickFarmClock,
  ACTION_TURN_HOURS,
} from "../turn-clock";
import { applyCommand } from "../reducer";
import {
  isActionAvailable,
  disabledReason,
} from "../selectors";
import { seedToState } from "../rng";
import { replay } from "../replay";
import { minimalGameState } from "../../testing/fixtures";

// ── hoursToPhase ──────────────────────────────────────────────────────────────

describe("hoursToPhase", () => {
  it("h=0 → day", () => expect(hoursToPhase(0)).toBe("day"));
  it("h=5 → day", () => expect(hoursToPhase(5)).toBe("day"));
  it("h=6 → dusk", () => expect(hoursToPhase(6)).toBe("dusk"));
  it("h=11 → dusk", () => expect(hoursToPhase(11)).toBe("dusk"));
  it("h=12 → night", () => expect(hoursToPhase(12)).toBe("night"));
  it("h=17 → night", () => expect(hoursToPhase(17)).toBe("night"));
  it("h=18 → dawn", () => expect(hoursToPhase(18)).toBe("dawn"));
  it("h=23 → dawn", () => expect(hoursToPhase(23)).toBe("dawn"));

  it("wraps at 24 → day", () => expect(hoursToPhase(24)).toBe("day"));
  it("wraps at 36 → night", () => expect(hoursToPhase(36)).toBe("night"));
  it("handles large values correctly", () => {
    // 240 hours = 10 days exactly → same as 0 → day
    expect(hoursToPhase(240)).toBe("day");
  });
});

// ── getActionAvailability ─────────────────────────────────────────────────────

describe("getActionAvailability – night phase", () => {
  const nightState = {
    ...minimalGameState,
    world: { ...minimalGameState.world, phase: "night" as const },
  };

  it("TRAVEL is preferred at night", () => {
    const a = getActionAvailability(nightState, "TRAVEL");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("preferred");
    expect(a.reason).toBe("");
  });

  it("REST is discouraged at night (not banned)", () => {
    const a = getActionAvailability(nightState, "REST");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("discouraged");
    expect(a.reason.length).toBeGreaterThan(0);
  });

  it("TRADE is banned at night", () => {
    const a = getActionAvailability(nightState, "TRADE");
    expect(a.available).toBe(false);
    expect(a.restriction).toBe("banned");
    expect(a.reason.length).toBeGreaterThan(0);
  });

  it("SCAVENGE is available at night (no restriction)", () => {
    const a = getActionAvailability(nightState, "SCAVENGE");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("none");
  });

  it("WAIT is available at night (no restriction)", () => {
    const a = getActionAvailability(nightState, "WAIT");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("none");
  });
});

describe("getActionAvailability – day phase", () => {
  const dayState = {
    ...minimalGameState,
    world: { ...minimalGameState.world, phase: "day" as const },
  };

  it("REST is preferred during day", () => {
    const a = getActionAvailability(dayState, "REST");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("preferred");
    expect(a.reason).toBe("");
  });

  it("TRAVEL is discouraged during day (not banned)", () => {
    const a = getActionAvailability(dayState, "TRAVEL");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("discouraged");
    expect(a.reason.length).toBeGreaterThan(0);
  });

  it("TRADE is available during day", () => {
    const a = getActionAvailability(dayState, "TRADE");
    expect(a.available).toBe(true);
  });
});

describe("getActionAvailability – dusk phase", () => {
  const duskState = {
    ...minimalGameState,
    world: { ...minimalGameState.world, phase: "dusk" as const },
  };

  it("TRAVEL is preferred at dusk", () => {
    const a = getActionAvailability(duskState, "TRAVEL");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("preferred");
  });

  it("REST is preferred at dusk", () => {
    const a = getActionAvailability(duskState, "REST");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("preferred");
  });

  it("TRADE is banned at dusk", () => {
    const a = getActionAvailability(duskState, "TRADE");
    expect(a.available).toBe(false);
    expect(a.restriction).toBe("banned");
  });
});

describe("getActionAvailability – ended run", () => {
  it("all actions unavailable when run is ended", () => {
    const ended = { ...minimalGameState, runStatus: "ended-success" as const };
    for (const action of ["TRAVEL", "REST", "SCAVENGE", "TRADE", "WAIT"] as const) {
      const a = getActionAvailability(ended, action);
      expect(a.available).toBe(false);
      expect(a.reason.length).toBeGreaterThan(0);
    }
  });
});

// ── disabledReason selector ───────────────────────────────────────────────────

describe("disabledReason selector", () => {
  const nightState = {
    ...minimalGameState,
    world: { ...minimalGameState.world, phase: "night" as const },
  };

  it("returns empty string for available action", () => {
    expect(disabledReason(nightState, "TRAVEL")).toBe("");
  });

  it("returns non-empty string for banned TRADE at night", () => {
    expect(disabledReason(nightState, "TRADE").length).toBeGreaterThan(0);
  });
});

// ── isActionAvailable selector ────────────────────────────────────────────────

describe("isActionAvailable selector", () => {
  const nightState = {
    ...minimalGameState,
    world: { ...minimalGameState.world, phase: "night" as const },
  };

  it("true for TRAVEL at night", () => {
    expect(isActionAvailable(nightState, "TRAVEL")).toBe(true);
  });

  it("false for TRADE at night", () => {
    expect(isActionAvailable(nightState, "TRADE")).toBe(false);
  });
});

// ── ACTION_TURN_HOURS ─────────────────────────────────────────────────────────

describe("ACTION_TURN_HOURS", () => {
  it("TRAVEL = 4 hours", () => expect(ACTION_TURN_HOURS["TRAVEL"]).toBe(4));
  it("REST = 6 hours", () => expect(ACTION_TURN_HOURS["REST"]).toBe(6));
  it("SCAVENGE = 3 hours", () => expect(ACTION_TURN_HOURS["SCAVENGE"]).toBe(3));
  it("SNEAK = 2 hours (minimum)", () => expect(ACTION_TURN_HOURS["SNEAK"]).toBe(2));
  it("HUNT = 4 hours", () => expect(ACTION_TURN_HOURS["HUNT"]).toBe(4));

  it("all durations are in range [2, 6]", () => {
    for (const [action, hours] of Object.entries(ACTION_TURN_HOURS)) {
      expect(hours, `${action} duration`).toBeGreaterThanOrEqual(2);
      expect(hours, `${action} duration`).toBeLessThanOrEqual(6);
    }
  });
});

// ── computeUpkeep ─────────────────────────────────────────────────────────────

describe("computeUpkeep", () => {
  it("TRAVEL increases hunger, thirst, fatigue", () => {
    const u = computeUpkeep("TRAVEL");
    expect(u.hunger).toBeGreaterThan(0);
    expect(u.thirst).toBeGreaterThan(0);
    expect(u.fatigue).toBeGreaterThan(0);
  });

  it("REST decreases fatigue (negative delta)", () => {
    const u = computeUpkeep("REST");
    expect(u.fatigue).toBeLessThan(0);
  });

  it("REST decreases sleepDebt (negative delta)", () => {
    const u = computeUpkeep("REST");
    expect(u.sleepDebt).toBeLessThan(0);
  });

  it("hours matches ACTION_TURN_HOURS for the action", () => {
    for (const action of ["TRAVEL", "REST", "SCAVENGE", "HUNT"] as const) {
      expect(computeUpkeep(action).hours).toBe(ACTION_TURN_HOURS[action]);
    }
  });
});

// ── tickFarmClock ─────────────────────────────────────────────────────────────

describe("tickFarmClock", () => {
  it("increments by exactly 1", () => {
    expect(tickFarmClock(0)).toBe(1);
    expect(tickFarmClock(5)).toBe(6);
    expect(tickFarmClock(119)).toBe(120);
  });
});

// ── Reducer integration: time advancement ─────────────────────────────────────

describe("reducer – time advances exactly once per accepted turn", () => {
  const rng = seedToState("tc-time");

  it("TRAVEL advances time by TRAVEL hours", () => {
    const before = minimalGameState.world.elapsedHours;
    const { state } = applyCommand(minimalGameState, { type: "TRAVEL", turnsToTravel: 1 }, rng);
    expect(state.world.elapsedHours).toBe(before + ACTION_TURN_HOURS["TRAVEL"]);
  });

  it("REST advances time by the requested hours", () => {
    const before = minimalGameState.world.elapsedHours;
    const { state } = applyCommand(minimalGameState, { type: "REST", hours: 4 }, rng);
    expect(state.world.elapsedHours).toBe(before + 4);
  });

  it("SCAVENGE advances time by SCAVENGE hours", () => {
    const before = minimalGameState.world.elapsedHours;
    const { state } = applyCommand(minimalGameState, { type: "SCAVENGE" }, rng);
    expect(state.world.elapsedHours).toBe(before + ACTION_TURN_HOURS["SCAVENGE"]);
  });

  it("rejected command (USE_ITEM, missing item) leaves time unchanged", () => {
    const before = minimalGameState.world.elapsedHours;
    const { state, events } = applyCommand(
      minimalGameState,
      { type: "USE_ITEM", instanceId: "ghost", quantity: 1 },
      rng,
    );
    expect(state.world.elapsedHours).toBe(before);
    expect(events[0]?.type).toBe("COMMAND_REJECTED");
  });
});

// ── Reducer integration: phase transitions ────────────────────────────────────

describe("reducer – phase transitions", () => {
  it("phase updates correctly after TRAVEL crossing a boundary", () => {
    // Start at h=10 (dusk). TRAVEL costs 4h → h=14 (night).
    const s = {
      ...minimalGameState,
      world: { ...minimalGameState.world, elapsedHours: 10, phase: "dusk" as const },
    };
    const { state } = applyCommand(s, { type: "TRAVEL", turnsToTravel: 1 }, seedToState("phase-t"));
    expect(state.world.phase).toBe("night");
    expect(state.world.elapsedHours).toBe(14);
  });

  it("phase transitions day→dusk→night→dawn over multiple REST commands", () => {
    // Start at h=2 (day). Each REST(6) advances 6h.
    const s = {
      ...minimalGameState,
      world: { ...minimalGameState.world, elapsedHours: 2, phase: "day" as const },
    };
    const rng = seedToState("phase-r");

    // After 6h: h=8 → dusk
    const r1 = applyCommand(s, { type: "REST", hours: 6 }, rng);
    expect(r1.state.world.phase).toBe("dusk");

    // After another 6h: h=14 → night
    const r2 = applyCommand(r1.state, { type: "REST", hours: 6 }, rng);
    expect(r2.state.world.phase).toBe("night");

    // After another 6h: h=20 → dawn
    const r3 = applyCommand(r2.state, { type: "REST", hours: 6 }, rng);
    expect(r3.state.world.phase).toBe("dawn");

    // After another 6h: h=26 mod 24 = 2 → day
    const r4 = applyCommand(r3.state, { type: "REST", hours: 6 }, rng);
    expect(r4.state.world.phase).toBe("day");
  });

  it("day count increments when crossing midnight", () => {
    // Start at h=22 (dawn, day 1). REST(4) → h=26 → day 2.
    const s = {
      ...minimalGameState,
      world: { ...minimalGameState.world, elapsedHours: 22, day: 1, phase: "dawn" as const },
    };
    const { state } = applyCommand(s, { type: "REST", hours: 4 }, seedToState("day-count"));
    expect(state.world.day).toBe(2);
  });
});

// ── Reducer integration: meter upkeep clamps ──────────────────────────────────

describe("reducer – meter upkeep clamps", () => {
  it("meters do not exceed 100 when near maximum", () => {
    // Push hunger to 98 before a TRAVEL (adds hunger)
    const s = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        player: {
          ...minimalGameState.party.player,
          meters: { ...minimalGameState.party.player.meters, hunger: 98, thirst: 98, fatigue: 98, sleepDebt: 98 },
        },
      },
    };
    const { state } = applyCommand(s, { type: "TRAVEL", turnsToTravel: 1 }, seedToState("clamp-max"));
    const m = state.party.player.meters;
    expect(m.hunger).toBeLessThanOrEqual(100);
    expect(m.thirst).toBeLessThanOrEqual(100);
    expect(m.fatigue).toBeLessThanOrEqual(100);
    expect(m.sleepDebt).toBeLessThanOrEqual(100);
  });

  it("fatigue does not go below 0 when resting from low value", () => {
    const s = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        player: {
          ...minimalGameState.party.player,
          meters: { ...minimalGameState.party.player.meters, fatigue: 2 },
        },
      },
    };
    const { state } = applyCommand(s, { type: "REST", hours: 6 }, seedToState("clamp-min"));
    expect(state.party.player.meters.fatigue).toBeGreaterThanOrEqual(0);
  });

  it("meters are always integers after upkeep", () => {
    const { state } = applyCommand(minimalGameState, { type: "REST", hours: 3 }, seedToState("int-check"));
    const m = state.party.player.meters;
    for (const [key, value] of Object.entries(m)) {
      expect(Number.isInteger(value), `${key} should be integer`).toBe(true);
    }
  });
});

// ── Reducer integration: farm clock ───────────────────────────────────────────

describe("reducer – farm clock", () => {
  it("farm clock advances by 1 for each TRAVEL turn", () => {
    const { state } = applyCommand(minimalGameState, { type: "TRAVEL", turnsToTravel: 1 }, seedToState("farm-t"));
    expect(state.farm.clockTurns).toBe(minimalGameState.farm.clockTurns + 1);
  });

  it("farm clock advances by 1 for REST (one command)", () => {
    const { state } = applyCommand(minimalGameState, { type: "REST", hours: 6 }, seedToState("farm-r"));
    expect(state.farm.clockTurns).toBe(minimalGameState.farm.clockTurns + 1);
  });

  it("farm clock advances by 1 for SCAVENGE", () => {
    const { state } = applyCommand(minimalGameState, { type: "SCAVENGE" }, seedToState("farm-s"));
    expect(state.farm.clockTurns).toBe(minimalGameState.farm.clockTurns + 1);
  });

  it("farm clock advances by N for N travel turns", () => {
    const n = 3;
    const { state } = applyCommand(minimalGameState, { type: "TRAVEL", turnsToTravel: n }, seedToState("farm-n"));
    expect(state.farm.clockTurns).toBe(minimalGameState.farm.clockTurns + n);
  });

  it("rejected command does not advance farm clock", () => {
    const { state, events } = applyCommand(
      minimalGameState,
      { type: "USE_ITEM", instanceId: "ghost", quantity: 1 },
      seedToState("farm-reject"),
    );
    expect(state.farm.clockTurns).toBe(minimalGameState.farm.clockTurns);
    expect(events[0]?.type).toBe("COMMAND_REJECTED");
  });

  it("FARM_CLOCK_TICKED event contains correct values", () => {
    const { events } = applyCommand(minimalGameState, { type: "TRAVEL", turnsToTravel: 1 }, seedToState("farm-ev"));
    const farmEvent = events.find((e) => e.type === "FARM_CLOCK_TICKED");
    expect(farmEvent).toBeDefined();
    if (farmEvent?.type === "FARM_CLOCK_TICKED") {
      expect(farmEvent.newClockTurns).toBe(minimalGameState.farm.clockTurns + 1);
      expect(farmEvent.deadlineTurns).toBe(minimalGameState.farm.deadlineTurns);
    }
  });
});

// ── Reducer integration: TURN_RESOLVED event ──────────────────────────────────

describe("reducer – TURN_RESOLVED event", () => {
  it("TRAVEL emits TURN_RESOLVED with correct action and phase", () => {
    const nightState = {
      ...minimalGameState,
      world: { ...minimalGameState.world, phase: "night" as const },
    };
    const { events } = applyCommand(nightState, { type: "TRAVEL", turnsToTravel: 1 }, seedToState("tr-ev"));
    const resolved = events.find((e) => e.type === "TURN_RESOLVED");
    expect(resolved).toBeDefined();
    if (resolved?.type === "TURN_RESOLVED") {
      expect(resolved.action).toBe("TRAVEL");
      expect(resolved.phase).toBe("night");
      expect(resolved.hoursElapsed).toBe(ACTION_TURN_HOURS["TRAVEL"]);
      expect(Array.isArray(resolved.changes)).toBe(true);
    }
  });

  it("REST emits TURN_RESOLVED with actual hours elapsed", () => {
    const { events } = applyCommand(minimalGameState, { type: "REST", hours: 4 }, seedToState("tr-rest"));
    const resolved = events.find((e) => e.type === "TURN_RESOLVED");
    expect(resolved).toBeDefined();
    if (resolved?.type === "TURN_RESOLVED") {
      expect(resolved.action).toBe("REST");
      expect(resolved.hoursElapsed).toBe(4);
    }
  });

  it("SCAVENGE emits TURN_RESOLVED", () => {
    const { events } = applyCommand(minimalGameState, { type: "SCAVENGE" }, seedToState("tr-sc"));
    const resolved = events.find((e) => e.type === "TURN_RESOLVED");
    expect(resolved).toBeDefined();
    if (resolved?.type === "TURN_RESOLVED") {
      expect(resolved.action).toBe("SCAVENGE");
    }
  });

  it("changes array includes changed meters", () => {
    const { events } = applyCommand(minimalGameState, { type: "TRAVEL", turnsToTravel: 1 }, seedToState("tr-changes"));
    const resolved = events.find((e) => e.type === "TURN_RESOLVED");
    if (resolved?.type === "TURN_RESOLVED") {
      const fields = resolved.changes.map((c) => c.field);
      expect(fields).toContain("hunger");
      expect(fields).toContain("thirst");
      expect(fields).toContain("fatigue");
    }
  });
});

// ── Replay determinism ────────────────────────────────────────────────────────

describe("turn-clock replay determinism", () => {
  it("same seed + commands → identical state and events", () => {
    const rng = seedToState("tc-replay");
    const commands = [
      { type: "TRAVEL" as const, turnsToTravel: 1 },
      { type: "REST" as const, hours: 6 },
      { type: "SCAVENGE" as const },
    ];

    const r1 = replay(minimalGameState, rng, commands);
    const r2 = replay(minimalGameState, rng, commands);

    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    expect(JSON.stringify(r1.journal)).toBe(JSON.stringify(r2.journal));
  });

  it("farm clock and meter values are identical across replays", () => {
    const rng = seedToState("tc-replay-farm");
    const commands = [
      { type: "TRAVEL" as const, turnsToTravel: 2 },
      { type: "REST" as const, hours: 4 },
    ];

    const r1 = replay(minimalGameState, rng, commands);
    const r2 = replay(minimalGameState, rng, commands);

    expect(r1.state.farm.clockTurns).toBe(r2.state.farm.clockTurns);
    expect(r1.state.party.player.meters).toEqual(r2.state.party.player.meters);
  });
});

// ── No skip/duplicate time ────────────────────────────────────────────────────

describe("no time skip or duplicate", () => {
  it("each TRAVEL turn advances time by exactly TRAVEL hours once", () => {
    const rng = seedToState("no-skip");
    const n = 3;
    const { state } = applyCommand(minimalGameState, { type: "TRAVEL", turnsToTravel: n }, rng);
    expect(state.world.elapsedHours).toBe(
      minimalGameState.world.elapsedHours + n * ACTION_TURN_HOURS["TRAVEL"],
    );
  });

  it("TIME_ADVANCED events match total hours elapsed", () => {
    const rng = seedToState("no-dup");
    const { events, state } = applyCommand(
      minimalGameState,
      { type: "TRAVEL", turnsToTravel: 2 },
      rng,
    );
    const timeEvents = events.filter((e) => e.type === "TIME_ADVANCED");
    const totalHoursFromEvents = timeEvents.reduce(
      (sum, e) => (e.type === "TIME_ADVANCED" ? sum + e.hours : sum),
      0,
    );
    expect(totalHoursFromEvents).toBe(state.world.elapsedHours - minimalGameState.world.elapsedHours);
  });
});
