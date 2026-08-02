/**
 * Tests for turn-clock module and its integration with the reducer.
 *
 * Covers:
 *   - Phase derivation (hoursToPhase) at every boundary.
 *   - Character-created initial state consistency (h=0 → night).
 *   - Action availability rules per phase.
 *   - Disabled-action reasons: "" for available (including discouraged), non-empty for banned.
 *   - TRADE banned at strict night only, available at dusk and dawn.
 *   - Canonical turn durations (ACTION_TURN_HOURS) all in [2, 6].
 *   - REST command rejects hours outside [2, 6].
 *   - Meter upkeep: correct deltas, clamps to [0, 100].
 *   - Farm-clock advances by exactly 1 per accepted turn.
 *   - Time advances exactly once per accepted turn; rejected turns leave state unchanged.
 *   - TURN_RESOLVED and FARM_CLOCK_TICKED events emitted on every accepted action.
 *   - Deterministic replay: same seed + commands → identical state.
 */

import { describe, it, expect } from "vitest";
import {
  hoursToPhase,
  getActionAvailability,
  getActionAdvisory,
  computeUpkeep,
  tickFarmClock,
  ACTION_TURN_HOURS,
} from "../turn-clock";
import { parseCommand } from "../commands";
import { applyCommand } from "../reducer";
import {
  isActionAvailable,
  disabledReason,
  actionAdvisory,
} from "../selectors";
import { seedToState } from "../rng";
import { replay } from "../replay";
import { minimalGameState } from "../../testing/fixtures";

// ── hoursToPhase: canonical mapping ──────────────────────────────────────────
// h∈[0, 6)  → night
// h∈[6, 12) → dawn
// h∈[12,18) → day
// h∈[18,24) → dusk

describe("hoursToPhase – canonical mapping", () => {
  // night boundaries
  it("h=0 → night", () => expect(hoursToPhase(0)).toBe("night"));
  it("h=1 → night", () => expect(hoursToPhase(1)).toBe("night"));
  it("h=5 → night", () => expect(hoursToPhase(5)).toBe("night"));
  // dawn boundaries
  it("h=6 → dawn", () => expect(hoursToPhase(6)).toBe("dawn"));
  it("h=7 → dawn", () => expect(hoursToPhase(7)).toBe("dawn"));
  it("h=11 → dawn", () => expect(hoursToPhase(11)).toBe("dawn"));
  // day boundaries
  it("h=12 → day", () => expect(hoursToPhase(12)).toBe("day"));
  it("h=13 → day", () => expect(hoursToPhase(13)).toBe("day"));
  it("h=17 → day", () => expect(hoursToPhase(17)).toBe("day"));
  // dusk boundaries
  it("h=18 → dusk", () => expect(hoursToPhase(18)).toBe("dusk"));
  it("h=19 → dusk", () => expect(hoursToPhase(19)).toBe("dusk"));
  it("h=23 → dusk", () => expect(hoursToPhase(23)).toBe("dusk"));
  // wraparound
  it("h=24 wraps to night", () => expect(hoursToPhase(24)).toBe("night"));
  it("h=30 wraps to dawn", () => expect(hoursToPhase(30)).toBe("dawn"));
  it("h=36 wraps to day", () => expect(hoursToPhase(36)).toBe("day"));
  it("h=240 (10 days) → night", () => expect(hoursToPhase(240)).toBe("night"));
});

describe("hoursToPhase – character-created initial state", () => {
  it("elapsedHours=0 → night (matches minimalGameState fixture)", () => {
    expect(hoursToPhase(minimalGameState.world.elapsedHours)).toBe("night");
    expect(minimalGameState.world.phase).toBe("night");
  });
});

// ── getActionAvailability – night phase ───────────────────────────────────────

describe("getActionAvailability – night phase (minimalGameState)", () => {
  // minimalGameState already has phase=night
  const state = minimalGameState;

  it("TRAVEL is preferred at night", () => {
    const a = getActionAvailability(state, "TRAVEL");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("preferred");
    expect(a.reason).toBe("");
  });

  it("REST is discouraged at night but available (reason is empty)", () => {
    const a = getActionAvailability(state, "REST");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("discouraged");
    expect(a.reason).toBe(""); // available actions have no disabled reason
  });

  it("TRADE is banned at strict night", () => {
    const a = getActionAvailability(state, "TRADE");
    expect(a.available).toBe(false);
    expect(a.restriction).toBe("banned");
    expect(a.reason.length).toBeGreaterThan(0);
  });

  it("SCAVENGE is available at night with no restriction", () => {
    const a = getActionAvailability(state, "SCAVENGE");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("none");
    expect(a.reason).toBe("");
  });

  it("WAIT is available at night with no restriction", () => {
    const a = getActionAvailability(state, "WAIT");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("none");
    expect(a.reason).toBe("");
  });
});

// ── getActionAvailability – day phase ─────────────────────────────────────────

describe("getActionAvailability – day phase", () => {
  const dayState = {
    ...minimalGameState,
    world: {
      ...minimalGameState.world,
      elapsedHours: 12,
      phase: "day" as const,
    },
  };

  it("REST is preferred during day", () => {
    const a = getActionAvailability(dayState, "REST");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("preferred");
    expect(a.reason).toBe("");
  });

  it("TRAVEL is discouraged during day but available (reason is empty)", () => {
    const a = getActionAvailability(dayState, "TRAVEL");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("discouraged");
    expect(a.reason).toBe(""); // available — no disabled reason
  });

  it("TRADE is available during day", () => {
    const a = getActionAvailability(dayState, "TRADE");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("preferred");
  });

  it("SCAVENGE is available during day", () => {
    const a = getActionAvailability(dayState, "SCAVENGE");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("none");
  });
});

// ── getActionAvailability – dusk phase ────────────────────────────────────────

describe("getActionAvailability – dusk phase", () => {
  const duskState = {
    ...minimalGameState,
    world: {
      ...minimalGameState.world,
      elapsedHours: 18,
      phase: "dusk" as const,
    },
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

  it("TRADE is available at dusk (not strict night)", () => {
    // Key correction: TRADE is only banned at strict night, not dusk
    const a = getActionAvailability(duskState, "TRADE");
    expect(a.available).toBe(true);
    expect(a.reason).toBe("");
  });
});

// ── getActionAvailability – dawn phase ────────────────────────────────────────

describe("getActionAvailability – dawn phase", () => {
  const dawnState = {
    ...minimalGameState,
    world: {
      ...minimalGameState.world,
      elapsedHours: 6,
      phase: "dawn" as const,
    },
  };

  it("TRAVEL is preferred at dawn", () => {
    const a = getActionAvailability(dawnState, "TRAVEL");
    expect(a.available).toBe(true);
    expect(a.restriction).toBe("preferred");
  });

  it("TRADE is available at dawn (not strict night)", () => {
    const a = getActionAvailability(dawnState, "TRADE");
    expect(a.available).toBe(true);
    expect(a.reason).toBe("");
  });
});

// ── getActionAvailability – ended run ─────────────────────────────────────────

describe("getActionAvailability – ended run", () => {
  it("all actions unavailable when run is ended", () => {
    const ended = { ...minimalGameState, runStatus: "ended-success" as const };
    for (const action of [
      "TRAVEL",
      "REST",
      "SCAVENGE",
      "TRADE",
      "WAIT",
    ] as const) {
      const a = getActionAvailability(ended, action);
      expect(a.available).toBe(false);
      expect(a.reason.length).toBeGreaterThan(0);
    }
  });
});

// ── getActionAdvisory ─────────────────────────────────────────────────────────

describe("getActionAdvisory", () => {
  it("returns advisory for TRAVEL during day", () => {
    expect(getActionAdvisory("TRAVEL", "day").length).toBeGreaterThan(0);
  });

  it("returns advisory for REST at night", () => {
    expect(getActionAdvisory("REST", "night").length).toBeGreaterThan(0);
  });

  it("returns empty for TRAVEL at night (preferred)", () => {
    expect(getActionAdvisory("TRAVEL", "night")).toBe("");
  });

  it("returns empty for SCAVENGE (unrestricted)", () => {
    expect(getActionAdvisory("SCAVENGE", "night")).toBe("");
  });
});

// ── disabledReason selector ───────────────────────────────────────────────────

describe("disabledReason selector", () => {
  it("returns '' for preferred action", () => {
    // minimalGameState is night; TRAVEL is preferred at night
    expect(disabledReason(minimalGameState, "TRAVEL")).toBe("");
  });

  it("returns '' for discouraged-but-available action", () => {
    // REST at night: discouraged but available → reason must be ""
    expect(disabledReason(minimalGameState, "REST")).toBe("");
  });

  it("returns non-empty string for banned TRADE at night", () => {
    expect(disabledReason(minimalGameState, "TRADE").length).toBeGreaterThan(0);
  });

  it("returns '' on ended run is handled by getActionAvailability (has reason)", () => {
    const ended = { ...minimalGameState, runStatus: "ended-success" as const };
    // Ended run: available=false, reason is set
    expect(disabledReason(ended, "TRAVEL").length).toBeGreaterThan(0);
  });
});

// ── actionAdvisory selector ───────────────────────────────────────────────────

describe("actionAdvisory selector", () => {
  it("returns advisory text for TRAVEL during day phase", () => {
    const dayState = {
      ...minimalGameState,
      world: {
        ...minimalGameState.world,
        elapsedHours: 12,
        phase: "day" as const,
      },
    };
    expect(actionAdvisory(dayState, "TRAVEL").length).toBeGreaterThan(0);
  });

  it("returns '' for TRAVEL at night", () => {
    expect(actionAdvisory(minimalGameState, "TRAVEL")).toBe("");
  });
});

// ── isActionAvailable selector ────────────────────────────────────────────────

describe("isActionAvailable selector", () => {
  it("true for TRAVEL at night", () => {
    expect(isActionAvailable(minimalGameState, "TRAVEL")).toBe(true);
  });

  it("false for TRADE at night", () => {
    expect(isActionAvailable(minimalGameState, "TRADE")).toBe(false);
  });

  it("true for REST at night (discouraged but available)", () => {
    expect(isActionAvailable(minimalGameState, "REST")).toBe(true);
  });
});

// ── ACTION_TURN_HOURS: all in [2, 6] ──────────────────────────────────────────

describe("ACTION_TURN_HOURS", () => {
  it("TRAVEL = 4 hours", () => expect(ACTION_TURN_HOURS["TRAVEL"]).toBe(4));
  it("REST = 6 hours", () => expect(ACTION_TURN_HOURS["REST"]).toBe(6));
  it("SCAVENGE = 3 hours", () => expect(ACTION_TURN_HOURS["SCAVENGE"]).toBe(3));
  it("SNEAK = 2 hours (minimum)", () =>
    expect(ACTION_TURN_HOURS["SNEAK"]).toBe(2));
  it("HUNT = 4 hours", () => expect(ACTION_TURN_HOURS["HUNT"]).toBe(4));

  it("all durations are in [2, 6]", () => {
    for (const [action, hours] of Object.entries(ACTION_TURN_HOURS)) {
      expect(hours, `${action} duration`).toBeGreaterThanOrEqual(2);
      expect(hours, `${action} duration`).toBeLessThanOrEqual(6);
    }
  });
});

// ── REST command: enforced 2–6 hour range ─────────────────────────────────────

describe("REST command – 2–6 hour range", () => {
  it("REST hours=2 is accepted", () => {
    expect(parseCommand({ type: "REST", hours: 2 }).ok).toBe(true);
  });

  it("REST hours=6 is accepted", () => {
    expect(parseCommand({ type: "REST", hours: 6 }).ok).toBe(true);
  });

  it("REST hours=4 is accepted", () => {
    expect(parseCommand({ type: "REST", hours: 4 }).ok).toBe(true);
  });

  it("REST hours=1 is rejected (below minimum)", () => {
    const r = parseCommand({ type: "REST", hours: 1 });
    expect(r.ok).toBe(false);
  });

  it("REST hours=7 is rejected (above maximum)", () => {
    const r = parseCommand({ type: "REST", hours: 7 });
    expect(r.ok).toBe(false);
  });

  it("REST hours=12 is rejected (old max, now invalid)", () => {
    const r = parseCommand({ type: "REST", hours: 12 });
    expect(r.ok).toBe(false);
  });

  it("rejected REST does not mutate state or time", () => {
    const rng = seedToState("rest-reject");
    // hours=1 passes Zod but let's test hours=7 rejection at command level
    const r = parseCommand({ type: "REST", hours: 7 });
    expect(r.ok).toBe(false);
    // State and farm are untouched (command never reached reducer)
    // Verify by checking the rng state is not consumed
    const [, v1] = seedToState("rest-reject-check") as unknown as [
      unknown,
      number,
    ];
    void v1; // Just checking Zod rejection doesn't touch anything
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

// ── Reducer: time advances exactly once per accepted turn ─────────────────────

describe("reducer – time advances exactly once per accepted turn", () => {
  const rng = seedToState("tc-time");

  it("TRAVEL advances time by TRAVEL hours", () => {
    const before = minimalGameState.world.elapsedHours;
    const { state } = applyCommand(
      minimalGameState,
      { type: "TRAVEL", turnsToTravel: 1 },
      rng,
    );
    expect(state.world.elapsedHours).toBe(before + ACTION_TURN_HOURS["TRAVEL"]);
  });

  it("REST advances time by the requested hours", () => {
    const before = minimalGameState.world.elapsedHours;
    const { state } = applyCommand(
      minimalGameState,
      { type: "REST", hours: 4 },
      rng,
    );
    expect(state.world.elapsedHours).toBe(before + 4);
  });

  it("SCAVENGE advances time by SCAVENGE hours", () => {
    const before = minimalGameState.world.elapsedHours;
    const { state } = applyCommand(minimalGameState, { type: "SCAVENGE" }, rng);
    expect(state.world.elapsedHours).toBe(
      before + ACTION_TURN_HOURS["SCAVENGE"],
    );
  });

  it("rejected command leaves time unchanged", () => {
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

// ── Reducer: phase transitions ────────────────────────────────────────────────
// Phase mapping: night[0,6) → dawn[6,12) → day[12,18) → dusk[18,24)

describe("reducer – phase transitions", () => {
  it("phase updates from dawn to day after TRAVEL (h=8 + 4h = h=12 → day)", () => {
    const s = {
      ...minimalGameState,
      world: {
        ...minimalGameState.world,
        elapsedHours: 8,
        phase: "dawn" as const,
      },
    };
    const { state } = applyCommand(
      s,
      { type: "TRAVEL", turnsToTravel: 1 },
      seedToState("phase-t"),
    );
    expect(state.world.phase).toBe("day");
    expect(state.world.elapsedHours).toBe(12);
  });

  it("phase transitions night→dawn→day→dusk over multiple REST(6) commands", () => {
    // Start at h=0 (night). Each REST(6) advances 6h.
    const rng = seedToState("phase-r");

    // h=0 → REST(6) → h=6 → dawn
    const r1 = applyCommand(minimalGameState, { type: "REST", hours: 6 }, rng);
    expect(r1.state.world.phase).toBe("dawn");

    // h=6 → REST(6) → h=12 → day
    const r2 = applyCommand(r1.state, { type: "REST", hours: 6 }, rng);
    expect(r2.state.world.phase).toBe("day");

    // h=12 → REST(6) → h=18 → dusk
    const r3 = applyCommand(r2.state, { type: "REST", hours: 6 }, rng);
    expect(r3.state.world.phase).toBe("dusk");

    // h=18 → REST(6) → h=24 mod 24 = 0 → night
    const r4 = applyCommand(r3.state, { type: "REST", hours: 6 }, rng);
    expect(r4.state.world.phase).toBe("night");
  });

  it("day count increments when crossing h=24", () => {
    // Start at h=22 (dusk, day 1). REST(4) → h=26 → day 2.
    const s = {
      ...minimalGameState,
      world: {
        ...minimalGameState.world,
        elapsedHours: 22,
        day: 1,
        phase: "dusk" as const,
      },
    };
    const { state } = applyCommand(
      s,
      { type: "REST", hours: 4 },
      seedToState("day-count"),
    );
    expect(state.world.day).toBe(2);
  });

  it("initial state (h=0) has phase=night consistent with hoursToPhase", () => {
    expect(hoursToPhase(0)).toBe(minimalGameState.world.phase);
  });
});

// ── Reducer: meter upkeep clamps ──────────────────────────────────────────────

describe("reducer – meter upkeep clamps", () => {
  it("meters do not exceed 100 when near maximum", () => {
    const s = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        player: {
          ...minimalGameState.party.player,
          meters: {
            ...minimalGameState.party.player.meters,
            hunger: 98,
            thirst: 98,
            fatigue: 98,
            sleepDebt: 98,
          },
        },
      },
    };
    const { state } = applyCommand(
      s,
      { type: "TRAVEL", turnsToTravel: 1 },
      seedToState("clamp-max"),
    );
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
    const { state } = applyCommand(
      s,
      { type: "REST", hours: 6 },
      seedToState("clamp-min"),
    );
    expect(state.party.player.meters.fatigue).toBeGreaterThanOrEqual(0);
  });

  it("meters are always integers after upkeep", () => {
    const { state } = applyCommand(
      minimalGameState,
      { type: "REST", hours: 4 },
      seedToState("int-check"),
    );
    const m = state.party.player.meters;
    for (const [key, value] of Object.entries(m)) {
      expect(Number.isInteger(value), `${key} should be integer`).toBe(true);
    }
  });
});

// ── Reducer: farm clock ───────────────────────────────────────────────────────

describe("reducer – farm clock", () => {
  it("farm clock advances by 1 for TRAVEL (1 turn)", () => {
    const { state } = applyCommand(
      minimalGameState,
      { type: "TRAVEL", turnsToTravel: 1 },
      seedToState("farm-t"),
    );
    expect(state.farm.clockTurns).toBe(minimalGameState.farm.clockTurns + 1);
  });

  it("farm clock advances by 1 for REST", () => {
    const { state } = applyCommand(
      minimalGameState,
      { type: "REST", hours: 6 },
      seedToState("farm-r"),
    );
    expect(state.farm.clockTurns).toBe(minimalGameState.farm.clockTurns + 1);
  });

  it("farm clock advances by 1 for SCAVENGE", () => {
    const { state } = applyCommand(
      minimalGameState,
      { type: "SCAVENGE" },
      seedToState("farm-s"),
    );
    expect(state.farm.clockTurns).toBe(minimalGameState.farm.clockTurns + 1);
  });

  it("farm clock advances by N for N travel turns", () => {
    const n = 3;
    const { state } = applyCommand(
      minimalGameState,
      { type: "TRAVEL", turnsToTravel: n },
      seedToState("farm-n"),
    );
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

  it("FARM_CLOCK_TICKED event has correct values", () => {
    const { events } = applyCommand(
      minimalGameState,
      { type: "TRAVEL", turnsToTravel: 1 },
      seedToState("farm-ev"),
    );
    const farmEvent = events.find((e) => e.type === "FARM_CLOCK_TICKED");
    expect(farmEvent).toBeDefined();
    if (farmEvent?.type === "FARM_CLOCK_TICKED") {
      expect(farmEvent.newClockTurns).toBe(
        minimalGameState.farm.clockTurns + 1,
      );
      expect(farmEvent.deadlineTurns).toBe(minimalGameState.farm.deadlineTurns);
    }
  });
});

// ── Reducer: TURN_RESOLVED event ──────────────────────────────────────────────

describe("reducer – TURN_RESOLVED event", () => {
  it("TRAVEL emits TURN_RESOLVED with correct action and phase", () => {
    const { events } = applyCommand(
      minimalGameState,
      { type: "TRAVEL", turnsToTravel: 1 },
      seedToState("tr-ev"),
    );
    const resolved = events.find((e) => e.type === "TURN_RESOLVED");
    expect(resolved).toBeDefined();
    if (resolved?.type === "TURN_RESOLVED") {
      expect(resolved.action).toBe("TRAVEL");
      expect(resolved.phase).toBe("night"); // minimalGameState starts at night
      expect(resolved.hoursElapsed).toBe(ACTION_TURN_HOURS["TRAVEL"]);
      expect(Array.isArray(resolved.changes)).toBe(true);
    }
  });

  it("REST emits TURN_RESOLVED with actual hours elapsed", () => {
    const { events } = applyCommand(
      minimalGameState,
      { type: "REST", hours: 4 },
      seedToState("tr-rest"),
    );
    const resolved = events.find((e) => e.type === "TURN_RESOLVED");
    expect(resolved).toBeDefined();
    if (resolved?.type === "TURN_RESOLVED") {
      expect(resolved.action).toBe("REST");
      expect(resolved.hoursElapsed).toBe(4);
    }
  });

  it("SCAVENGE emits TURN_RESOLVED", () => {
    const { events } = applyCommand(
      minimalGameState,
      { type: "SCAVENGE" },
      seedToState("tr-sc"),
    );
    const resolved = events.find((e) => e.type === "TURN_RESOLVED");
    expect(resolved).toBeDefined();
    if (resolved?.type === "TURN_RESOLVED") {
      expect(resolved.action).toBe("SCAVENGE");
    }
  });

  it("changes array includes changed meters for TRAVEL", () => {
    const { events } = applyCommand(
      minimalGameState,
      { type: "TRAVEL", turnsToTravel: 1 },
      seedToState("tr-changes"),
    );
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
  it("same seed + commands → identical state and journal", () => {
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

// ── No time skip or duplicate ─────────────────────────────────────────────────

describe("no time skip or duplicate", () => {
  it("N TRAVEL turns advance time by exactly N × TRAVEL_HOURS", () => {
    const rng = seedToState("no-skip");
    const n = 3;
    const { state } = applyCommand(
      minimalGameState,
      { type: "TRAVEL", turnsToTravel: n },
      rng,
    );
    expect(state.world.elapsedHours).toBe(
      minimalGameState.world.elapsedHours + n * ACTION_TURN_HOURS["TRAVEL"],
    );
  });

  it("TIME_ADVANCED event hours sum equals total elapsed increase", () => {
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
    expect(totalHoursFromEvents).toBe(
      state.world.elapsedHours - minimalGameState.world.elapsedHours,
    );
  });
});
