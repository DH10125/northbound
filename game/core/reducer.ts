/**
 * Pure, deterministic game reducer.
 *
 * Accepts (state, command, rngState) → (nextState, nextRngState, events[]).
 *
 * Rules:
 *   - No Math.random, Date.now, or any wall-clock / browser global.
 *   - An invalid or precondition-failing command returns the original state
 *     byte-equivalent with a COMMAND_REJECTED event.
 *   - All random choices consume the provided RNG state.
 *   - The returned state is a new object (structural sharing is fine, but
 *     the top-level reference must differ from the input).
 */

import type { GameState } from "../schemas/game-state";
import type { RngState } from "./rng";
import { nextInt } from "./rng";
import type { Command } from "./commands";
import type { DomainEvent } from "./domain-events";

// ── Result type ───────────────────────────────────────────────────────────────

export type ReducerResult = {
  state: GameState;
  rng: RngState;
  events: DomainEvent[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Hours per phase slot — used to derive the current phase from elapsed hours. */
const PHASE_HOURS = 6; // day=0-5, dusk=6-11, night=12-17, dawn=18-23 (mod 24)

function hoursToPhase(hours: number): "day" | "dusk" | "night" | "dawn" {
  const h = ((hours % 24) + 24) % 24;
  if (h < PHASE_HOURS) return "day";
  if (h < PHASE_HOURS * 2) return "dusk";
  if (h < PHASE_HOURS * 3) return "night";
  return "dawn";
}

/** Distance covered per travel turn (deterministic base + small rng variance). */
const TRAVEL_BASE_DISTANCE = 25;
const TRAVEL_VARIANCE = 10; // +/- 0..9

/** Hours consumed per travel turn. */
const TRAVEL_HOURS_PER_TURN = 4;

/** Hours consumed per rest hour (1:1). */
const REST_FATIGUE_RECOVERY_PER_HOUR = 5;
const REST_HUNGER_PER_HOUR = 2;
const REST_THIRST_PER_HOUR = 3;

// ── Travel ────────────────────────────────────────────────────────────────────

function applyTravel(
  state: GameState,
  rng: RngState,
  turnsToTravel: number,
): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  let s = { ...state };
  let r = rng;
  const events: DomainEvent[] = [];

  for (let t = 0; t < turnsToTravel; t++) {
    // Advance time
    const hoursThisTurn = TRAVEL_HOURS_PER_TURN;
    const newElapsedHours = s.world.elapsedHours + hoursThisTurn;

    // Random distance variance
    let variance: number;
    [r, variance] = nextInt(r, 0, TRAVEL_VARIANCE - 1);
    const distanceCovered = TRAVEL_BASE_DISTANCE + variance;
    const newDistanceRemaining = Math.max(
      0,
      s.location.distanceRemaining - distanceCovered,
    );

    const newDay = Math.floor(newElapsedHours / 24) + 1;
    const newPhase = hoursToPhase(newElapsedHours);

    // Update meters: hunger and thirst increase while travelling.
    const player = s.party.player;
    const newHunger = clamp(player.meters.hunger + 3, 0, 100);
    const newThirst = clamp(player.meters.thirst + 4, 0, 100);
    const newFatigue = clamp(player.meters.fatigue + 5, 0, 100);

    s = {
      ...s,
      world: {
        ...s.world,
        elapsedHours: newElapsedHours,
        day: newDay,
        phase: newPhase,
      },
      location: {
        ...s.location,
        distanceRemaining: newDistanceRemaining,
      },
      party: {
        ...s.party,
        player: {
          ...player,
          meters: {
            ...player.meters,
            hunger: newHunger,
            thirst: newThirst,
            fatigue: newFatigue,
          },
        },
      },
    };

    events.push({
      type: "TIME_ADVANCED",
      hours: hoursThisTurn,
      newElapsedHours,
    });

    events.push({
      type: "TRAVEL_ADVANCED",
      distanceCovered,
      newDistanceRemaining,
    });

    // Check run completion
    if (newDistanceRemaining === 0) {
      s = { ...s, runStatus: "ended-success" };
      break;
    }
  }

  return { state: s, rng: r, events };
}

// ── Rest ──────────────────────────────────────────────────────────────────────

function applyRest(
  state: GameState,
  rng: RngState,
  hours: number,
): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  const events: DomainEvent[] = [];
  const player = state.party.player;

  const newElapsedHours = state.world.elapsedHours + hours;
  const newDay = Math.floor(newElapsedHours / 24) + 1;
  const newPhase = hoursToPhase(newElapsedHours);

  const newFatigue = clamp(
    player.meters.fatigue - REST_FATIGUE_RECOVERY_PER_HOUR * hours,
    0,
    100,
  );
  const newHunger = clamp(
    player.meters.hunger + REST_HUNGER_PER_HOUR * hours,
    0,
    100,
  );
  const newThirst = clamp(
    player.meters.thirst + REST_THIRST_PER_HOUR * hours,
    0,
    100,
  );

  events.push({
    type: "TIME_ADVANCED",
    hours,
    newElapsedHours,
  });

  events.push({
    type: "METER_CHANGED",
    subjectId: "player",
    meter: "fatigue",
    delta: newFatigue - player.meters.fatigue,
    newValue: newFatigue,
  });

  const nextState: GameState = {
    ...state,
    world: {
      ...state.world,
      elapsedHours: newElapsedHours,
      day: newDay,
      phase: newPhase,
    },
    party: {
      ...state.party,
      player: {
        ...player,
        meters: {
          ...player.meters,
          fatigue: newFatigue,
          hunger: newHunger,
          thirst: newThirst,
        },
      },
    },
  };

  return { state: nextState, rng, events };
}

// ── Use item ──────────────────────────────────────────────────────────────────

function applyUseItem(
  state: GameState,
  rng: RngState,
  instanceId: string,
  quantity: number,
): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  // Find the item in inventory
  let found = false;
  const newStorages = state.inventory.storages.map((storage) => ({
    ...storage,
    items: storage.items
      .map((item) => {
        if (item.instanceId !== instanceId) return item;
        found = true;
        return { ...item, quantity: item.quantity - quantity };
      })
      .filter((item) => item.quantity > 0),
  }));

  if (!found) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Item instance "${instanceId}" not found in inventory.`,
        },
      ],
    };
  }

  const originalItem = state.inventory.storages
    .flatMap((s) => s.items)
    .find((i) => i.instanceId === instanceId);

  if (!originalItem || originalItem.quantity < quantity) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Insufficient quantity for item "${instanceId}".`,
        },
      ],
    };
  }

  const events: DomainEvent[] = [
    {
      type: "ITEM_CONSUMED",
      instanceId,
      definitionId: originalItem.definitionId,
      quantity,
    },
  ];

  const nextState: GameState = {
    ...state,
    inventory: { ...state.inventory, storages: newStorages },
  };

  return { state: nextState, rng, events };
}

// ── Scavenge ──────────────────────────────────────────────────────────────────

function applyScavenge(state: GameState, rng: RngState): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  // Scavenging costs time but currently has no item reward (content not loaded).
  const hours = 3;
  const newElapsedHours = state.world.elapsedHours + hours;
  const newDay = Math.floor(newElapsedHours / 24) + 1;
  const newPhase = hoursToPhase(newElapsedHours);

  const events: DomainEvent[] = [
    {
      type: "TIME_ADVANCED",
      hours,
      newElapsedHours,
    },
  ];

  const nextState: GameState = {
    ...state,
    world: {
      ...state.world,
      elapsedHours: newElapsedHours,
      day: newDay,
      phase: newPhase,
    },
  };

  return { state: nextState, rng, events };
}

// ── Choose event option ───────────────────────────────────────────────────────

function applyChooseEventOption(
  state: GameState,
  rng: RngState,
  eventId: string,
  optionId: string,
): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  // Content-free stub: record the encounter in event history.
  const entry = {
    eventId: eventId as import("../schemas/ids").EventId,
    chosenOptionId: optionId,
    resolvedAtHour: state.world.elapsedHours,
    flagsSet: [] as string[],
  };

  const nextState: GameState = {
    ...state,
    eventHistory: {
      ...state.eventHistory,
      entries: [...state.eventHistory.entries, entry],
    },
  };

  const events: DomainEvent[] = [{ type: "ENCOUNTER_STARTED", eventId }];

  return { state: nextState, rng, events };
}

// ── Main reducer ──────────────────────────────────────────────────────────────

/**
 * Apply a validated command to state.
 *
 * Never throws — invalid preconditions return a COMMAND_REJECTED event with
 * the original state byte-equivalent.
 */
export function applyCommand(
  state: GameState,
  command: Command,
  rng: RngState,
): ReducerResult {
  switch (command.type) {
    case "TRAVEL":
      return applyTravel(state, rng, command.turnsToTravel);

    case "REST":
      return applyRest(state, rng, command.hours);

    case "USE_ITEM":
      return applyUseItem(state, rng, command.instanceId, command.quantity);

    case "SCAVENGE":
      return applyScavenge(state, rng);

    case "CHOOSE_EVENT_OPTION":
      return applyChooseEventOption(
        state,
        rng,
        command.eventId,
        command.optionId,
      );
  }
}
