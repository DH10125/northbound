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
import {
  hoursToPhase,
  getActionAvailability,
  computeUpkeep,
  tickFarmClock,
  ACTION_TURN_HOURS,
} from "./turn-clock";
import type { ResolutionChange, TurnSummary } from "./turn-clock";
import { transferItem, consumeItem, advanceSpoilage } from "./inventory";
import type { StorageLocation } from "./inventory-types";
import type { ItemInstanceId } from "../schemas/ids";
import { applyChooseRoute } from "./route-resolution";
import { resolveEventChoice, evaluateCondition } from "./event-engine";
import type { EventDefinition } from "../content/event-definitions";

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

/** Distance covered per travel turn (deterministic base + small rng variance). */
const TRAVEL_BASE_DISTANCE = 25;
const TRAVEL_VARIANCE = 10; // +/- 0..9

/**
 * Apply standard turn upkeep and farm clock tick.
 * Returns the updated state, the changes list for TURN_RESOLVED, and
 * the FARM_CLOCK_TICKED domain event.
 */
function applyTurnUpkeep(
  state: GameState,
  action: "TRAVEL" | "REST" | "SCAVENGE" | "WAIT",
): { state: GameState; changes: ResolutionChange[]; farmEvent: DomainEvent } {
  const upkeep = computeUpkeep(action);
  const player = state.party.player;
  const m = player.meters;

  // Compute new meter values clamped to [0, 100]
  const newHunger = clamp(m.hunger + upkeep.hunger, 0, 100);
  const newThirst = clamp(m.thirst + upkeep.thirst, 0, 100);
  const newFatigue = clamp(m.fatigue + upkeep.fatigue, 0, 100);
  const newSleepDebt = clamp(m.sleepDebt + upkeep.sleepDebt, 0, 100);

  // Farm clock tick
  const newFarmClockTurns = tickFarmClock(state.farm.clockTurns);

  const changes: ResolutionChange[] = [];
  if (newHunger !== m.hunger)
    changes.push({
      field: "hunger",
      before: m.hunger,
      after: newHunger,
      delta: newHunger - m.hunger,
    });
  if (newThirst !== m.thirst)
    changes.push({
      field: "thirst",
      before: m.thirst,
      after: newThirst,
      delta: newThirst - m.thirst,
    });
  if (newFatigue !== m.fatigue)
    changes.push({
      field: "fatigue",
      before: m.fatigue,
      after: newFatigue,
      delta: newFatigue - m.fatigue,
    });
  if (newSleepDebt !== m.sleepDebt)
    changes.push({
      field: "sleepDebt",
      before: m.sleepDebt,
      after: newSleepDebt,
      delta: newSleepDebt - m.sleepDebt,
    });
  if (newFarmClockTurns !== state.farm.clockTurns)
    changes.push({
      field: "farm.clockTurns",
      before: state.farm.clockTurns,
      after: newFarmClockTurns,
      delta: newFarmClockTurns - state.farm.clockTurns,
    });

  const nextState: GameState = {
    ...state,
    party: {
      ...state.party,
      player: {
        ...player,
        meters: {
          ...m,
          hunger: newHunger,
          thirst: newThirst,
          fatigue: newFatigue,
          sleepDebt: newSleepDebt,
        },
      },
    },
    farm: {
      ...state.farm,
      clockTurns: newFarmClockTurns,
    },
  };

  const farmEvent: DomainEvent = {
    type: "FARM_CLOCK_TICKED",
    newClockTurns: newFarmClockTurns,
    deadlineTurns: state.farm.deadlineTurns,
  };

  return { state: nextState, changes, farmEvent };
}

/** Build a TURN_RESOLVED event from a completed turn. */
function buildTurnResolvedEvent(summary: TurnSummary): DomainEvent {
  return {
    type: "TURN_RESOLVED",
    action: summary.action,
    phase: summary.phase,
    hoursElapsed: summary.hoursElapsed,
    changes: summary.changes,
  };
}

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

  // Phase-availability check (travel is discouraged in day but not banned)
  const avail = getActionAvailability(state, "TRAVEL");
  if (!avail.available) {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: avail.reason }],
    };
  }

  let s = { ...state };
  let r = rng;
  const events: DomainEvent[] = [];

  for (let t = 0; t < turnsToTravel; t++) {
    const phaseAtStart = s.world.phase;
    const hoursThisTurn = ACTION_TURN_HOURS["TRAVEL"];
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

    // Apply upkeep + farm clock
    const upkeepResult = applyTurnUpkeep(s, "TRAVEL");
    s = upkeepResult.state;

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

    events.push(upkeepResult.farmEvent);

    events.push(
      buildTurnResolvedEvent({
        action: "TRAVEL",
        phase: phaseAtStart,
        hoursElapsed: hoursThisTurn,
        changes: upkeepResult.changes,
      }),
    );

    // Spoilage: one tick per accepted travel turn
    const spoilageResult = advanceSpoilage(s.inventory);
    s = { ...s, inventory: spoilageResult.inventory };
    for (const spoiled of spoilageResult.spoiledItems) {
      events.push({
        type: "ITEM_SPOILED",
        instanceId: spoiled.instanceId,
        definitionId: spoiled.definitionId,
      });
    }

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

  const avail = getActionAvailability(state, "REST");
  if (!avail.available) {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: avail.reason }],
    };
  }

  const phaseAtStart = state.world.phase;
  const events: DomainEvent[] = [];
  const player = state.party.player;

  const newElapsedHours = state.world.elapsedHours + hours;
  const newDay = Math.floor(newElapsedHours / 24) + 1;
  const newPhase = hoursToPhase(newElapsedHours);

  // Use upkeep for one REST turn (canonical REST hours = 6; caller may pass any 1-12)
  const upkeep = computeUpkeep("REST");
  // Scale upkeep linearly to the actual hours passed
  const scale = hours / upkeep.hours;
  const m = player.meters;
  const newFatigue = clamp(
    m.fatigue + Math.round(upkeep.fatigue * scale),
    0,
    100,
  );
  const newHunger = clamp(m.hunger + Math.round(upkeep.hunger * scale), 0, 100);
  const newThirst = clamp(m.thirst + Math.round(upkeep.thirst * scale), 0, 100);
  const newSleepDebt = clamp(
    m.sleepDebt + Math.round(upkeep.sleepDebt * scale),
    0,
    100,
  );

  // Farm clock ticks once per accepted REST command (not per hour)
  const newFarmClockTurns = tickFarmClock(state.farm.clockTurns);

  const changes: ResolutionChange[] = [];
  if (newFatigue !== m.fatigue)
    changes.push({
      field: "fatigue",
      before: m.fatigue,
      after: newFatigue,
      delta: newFatigue - m.fatigue,
    });
  if (newHunger !== m.hunger)
    changes.push({
      field: "hunger",
      before: m.hunger,
      after: newHunger,
      delta: newHunger - m.hunger,
    });
  if (newThirst !== m.thirst)
    changes.push({
      field: "thirst",
      before: m.thirst,
      after: newThirst,
      delta: newThirst - m.thirst,
    });
  if (newSleepDebt !== m.sleepDebt)
    changes.push({
      field: "sleepDebt",
      before: m.sleepDebt,
      after: newSleepDebt,
      delta: newSleepDebt - m.sleepDebt,
    });
  if (newFarmClockTurns !== state.farm.clockTurns)
    changes.push({
      field: "farm.clockTurns",
      before: state.farm.clockTurns,
      after: newFarmClockTurns,
      delta: 1,
    });

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

  events.push({
    type: "FARM_CLOCK_TICKED",
    newClockTurns: newFarmClockTurns,
    deadlineTurns: state.farm.deadlineTurns,
  });

  events.push(
    buildTurnResolvedEvent({
      action: "REST",
      phase: phaseAtStart,
      hoursElapsed: hours,
      changes,
    }),
  );

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
          sleepDebt: newSleepDebt,
        },
      },
    },
    farm: {
      ...state.farm,
      clockTurns: newFarmClockTurns,
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

  const avail = getActionAvailability(state, "SCAVENGE");
  if (!avail.available) {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: avail.reason }],
    };
  }

  const phaseAtStart = state.world.phase;
  const hours = ACTION_TURN_HOURS["SCAVENGE"];
  const newElapsedHours = state.world.elapsedHours + hours;
  const newDay = Math.floor(newElapsedHours / 24) + 1;
  const newPhase = hoursToPhase(newElapsedHours);

  // Apply upkeep + farm clock
  const upkeepResult = applyTurnUpkeep(state, "SCAVENGE");
  const s = {
    ...upkeepResult.state,
    world: {
      ...upkeepResult.state.world,
      elapsedHours: newElapsedHours,
      day: newDay,
      phase: newPhase,
    },
  };

  const events: DomainEvent[] = [
    {
      type: "TIME_ADVANCED",
      hours,
      newElapsedHours,
    },
    upkeepResult.farmEvent,
    buildTurnResolvedEvent({
      action: "SCAVENGE",
      phase: phaseAtStart,
      hoursElapsed: hours,
      changes: upkeepResult.changes,
    }),
  ];

  return { state: s, rng, events };
}

// ── Choose event option ───────────────────────────────────────────────────────

/** Content registry used by the event engine. Set via setEventRegistry(). */
let eventRegistry: ReadonlyArray<EventDefinition> = [];

/**
 * Register event definitions for use by the reducer.
 * Called once at startup with validated content.
 */
export function setEventRegistry(events: ReadonlyArray<EventDefinition>): void {
  eventRegistry = events;
}

/** Get the current event registry (for testing). */
export function getEventRegistry(): ReadonlyArray<EventDefinition> {
  return eventRegistry;
}

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

  // Look up event definition
  const event = eventRegistry.find((e) => e.id === eventId);
  if (!event) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Event "${eventId}" not found in registry.`,
        },
      ],
    };
  }

  // ── Resolution legitimacy checks ──────────────────────────────────────────

  // If there is a pendingFollowUp, only that event can be resolved next
  if (
    state.eventHistory.pendingFollowUp !== null &&
    state.eventHistory.pendingFollowUp !== eventId
  ) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Pending follow-up "${state.eventHistory.pendingFollowUp}" must be resolved first.`,
        },
      ],
    };
  }

  // Once-only: cannot resolve if already in history
  if (event.once) {
    if (state.eventHistory.entries.some((e) => e.eventId === eventId)) {
      return {
        state,
        rng,
        events: [
          {
            type: "COMMAND_REJECTED",
            reason: `Event "${eventId}" is once-only and already resolved.`,
          },
        ],
      };
    }
  }

  // Cooldown check
  const currentTurn = Math.floor(state.world.elapsedHours / 4);
  if (event.cooldownTurns != null && event.cooldownTurns > 0) {
    const lastTurn = state.eventHistory.cooldowns[eventId];
    if (lastTurn != null && currentTurn - lastTurn < event.cooldownTurns) {
      return {
        state,
        rng,
        events: [
          {
            type: "COMMAND_REJECTED",
            reason: `Event "${eventId}" is on cooldown.`,
          },
        ],
      };
    }
  }

  // Trigger condition must still be met (unless it's a pending follow-up)
  if (state.eventHistory.pendingFollowUp !== eventId) {
    if (!evaluateCondition(event.trigger, state)) {
      return {
        state,
        rng,
        events: [
          {
            type: "COMMAND_REJECTED",
            reason: `Event "${eventId}" trigger conditions not met.`,
          },
        ],
      };
    }
  }

  // Prevent duplicate resolution in same hour
  const alreadyResolved = state.eventHistory.entries.some(
    (e) =>
      e.eventId === eventId && e.resolvedAtHour === state.world.elapsedHours,
  );
  if (alreadyResolved) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Event "${eventId}" already resolved this turn.`,
        },
      ],
    };
  }

  // Clear pendingFollowUp before resolving (it will be set again if this event chains)
  let stateForResolution = state;
  if (state.eventHistory.pendingFollowUp === eventId) {
    stateForResolution = {
      ...state,
      eventHistory: {
        ...state.eventHistory,
        pendingFollowUp: null,
      },
    };
  }

  const result = resolveEventChoice(
    event,
    optionId,
    stateForResolution,
    rng,
    currentTurn,
  );

  return {
    state: result.state,
    rng: result.rng,
    events: result.events,
  };
}

// ── Transfer item ────────────────────────────────────────────────────────────

function applyTransferItem(
  state: GameState,
  rng: RngState,
  instanceId: string,
  fromLocation: string,
  toLocation: string,
  quantity: number,
): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  const result = transferItem(
    state.inventory,
    instanceId as ItemInstanceId,
    fromLocation as StorageLocation,
    toLocation as StorageLocation,
    quantity,
  );

  if (!result.ok) {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: result.reason }],
    };
  }

  // Find the definitionId for the event
  const item = state.inventory.storages
    .flatMap((s) => s.items)
    .find((i) => i.instanceId === instanceId);

  const nextState: GameState = {
    ...state,
    inventory: result.inventory,
  };

  const events: DomainEvent[] = [
    {
      type: "ITEM_TRANSFERRED",
      instanceId,
      definitionId: item?.definitionId ?? "unknown",
      quantity,
      fromLocation,
      toLocation,
    },
  ];

  return { state: nextState, rng, events };
}

// ── Consume item ─────────────────────────────────────────────────────────────

function applyConsumeItem(
  state: GameState,
  rng: RngState,
  instanceId: string,
): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  const result = consumeItem(state.inventory, instanceId as ItemInstanceId);

  if (!result.ok) {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: result.reason }],
    };
  }

  // Apply consume effects to player meters
  const player = state.party.player;
  const meters = { ...player.meters };
  const events: DomainEvent[] = [];

  for (const [key, delta] of Object.entries(result.effects)) {
    if (key in meters) {
      const oldVal = meters[key as keyof typeof meters];
      const newVal = clamp(oldVal + delta, 0, 100);
      meters[key as keyof typeof meters] = newVal;
      events.push({
        type: "METER_CHANGED",
        subjectId: "player",
        meter: key,
        delta: newVal - oldVal,
        newValue: newVal,
      });
    }
  }

  events.unshift({
    type: "ITEM_CONSUMED",
    instanceId,
    definitionId: result.definitionId,
    quantity: 1,
  });

  const nextState: GameState = {
    ...state,
    inventory: result.inventory,
    party: {
      ...state.party,
      player: { ...player, meters },
    },
  };

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
  let result: ReducerResult;

  switch (command.type) {
    case "CHOOSE_ROUTE":
      result = applyChooseRoute(state, rng, command.edgeId);
      break;

    case "TRAVEL":
      result = applyTravel(state, rng, command.turnsToTravel);
      break;

    case "REST":
      result = applyRest(state, rng, command.hours);
      break;

    case "USE_ITEM":
      result = applyUseItem(state, rng, command.instanceId, command.quantity);
      break;

    case "SCAVENGE":
      result = applyScavenge(state, rng);
      break;

    case "CHOOSE_EVENT_OPTION":
      result = applyChooseEventOption(
        state,
        rng,
        command.eventId,
        command.optionId,
      );
      break;

    case "TRANSFER_ITEM":
      result = applyTransferItem(
        state,
        rng,
        command.instanceId,
        command.fromLocation,
        command.toLocation,
        command.quantity,
      );
      break;

    case "CONSUME_ITEM":
      result = applyConsumeItem(state, rng, command.instanceId);
      break;
  }

  // Advance spoilage once for REST/SCAVENGE (TRAVEL handles per-turn internally).
  // Only on accepted commands — rejected commands must not alter state.
  if (command.type === "REST" || command.type === "SCAVENGE") {
    const wasRejected = result.events.some(
      (e) => e.type === "COMMAND_REJECTED",
    );
    if (!wasRejected) {
      const spoilageResult = advanceSpoilage(result.state.inventory);
      result = {
        ...result,
        state: { ...result.state, inventory: spoilageResult.inventory },
        events: [
          ...result.events,
          ...spoilageResult.spoiledItems.map((spoiled) => ({
            type: "ITEM_SPOILED" as const,
            instanceId: spoiled.instanceId,
            definitionId: spoiled.definitionId,
          })),
        ],
      };
    }
  }

  return result;
}
