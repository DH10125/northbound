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
import {
  resolveEventChoice,
  evaluateCondition,
  filterCandidates,
  selectEvent,
} from "./event-engine";
import type { EventDefinition } from "../content/event-definitions";
import {
  EventDefinitionSchema,
  validateEventRegistry,
} from "../content/event-definitions";
import { tickConditions } from "./condition-engine";
import { getConditionDefinition } from "../content/conditions";

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
): {
  state: GameState;
  changes: ResolutionChange[];
  farmEvent: DomainEvent;
  conditionEvents: DomainEvent[];
} {
  const upkeep = computeUpkeep(action);
  const player = state.party.player;
  const m = player.meters;

  // Compute new meter values clamped to [0, 100]
  const newHunger = clamp(m.hunger + upkeep.hunger, 0, 100);
  const newThirst = clamp(m.thirst + upkeep.thirst, 0, 100);
  const newFatigue = clamp(m.fatigue + upkeep.fatigue, 0, 100);
  const newSleepDebt = clamp(m.sleepDebt + upkeep.sleepDebt, 0, 100);

  // Tick conditions
  const isResting = action === "REST";
  const condTickResult = tickConditions(
    player.conditions,
    player.permanentModifiers,
    isResting,
  );

  // Apply condition meter deltas
  let meters = {
    ...m,
    hunger: newHunger,
    thirst: newThirst,
    fatigue: newFatigue,
    sleepDebt: newSleepDebt,
  };
  for (const [key, delta] of Object.entries(condTickResult.meterDeltas)) {
    const mKey = key as keyof typeof meters;
    if (mKey in meters) {
      meters = { ...meters, [mKey]: clamp(meters[mKey] + delta, 0, 100) };
    }
  }

  // Farm clock tick
  const newFarmClockTurns = tickFarmClock(state.farm.clockTurns);

  const changes: ResolutionChange[] = [];
  if (meters.hunger !== m.hunger)
    changes.push({
      field: "hunger",
      before: m.hunger,
      after: meters.hunger,
      delta: meters.hunger - m.hunger,
    });
  if (meters.thirst !== m.thirst)
    changes.push({
      field: "thirst",
      before: m.thirst,
      after: meters.thirst,
      delta: meters.thirst - m.thirst,
    });
  if (meters.fatigue !== m.fatigue)
    changes.push({
      field: "fatigue",
      before: m.fatigue,
      after: meters.fatigue,
      delta: meters.fatigue - m.fatigue,
    });
  if (meters.sleepDebt !== m.sleepDebt)
    changes.push({
      field: "sleepDebt",
      before: m.sleepDebt,
      after: meters.sleepDebt,
      delta: meters.sleepDebt - m.sleepDebt,
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
        meters,
        conditions: condTickResult.conditions,
        permanentModifiers: condTickResult.permanentModifiers,
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

  return {
    state: nextState,
    changes,
    farmEvent,
    conditionEvents: condTickResult.events,
  };
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
    events.push(...upkeepResult.conditionEvents);

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

  // Tick conditions (REST is resting=true, enabling rest-slowed progression)
  const condTickResult = tickConditions(
    player.conditions,
    player.permanentModifiers,
    true,
  );

  // Apply condition meter deltas on top of upkeep meters
  let meters = {
    ...m,
    hunger: newHunger,
    thirst: newThirst,
    fatigue: newFatigue,
    sleepDebt: newSleepDebt,
  };
  for (const [key, delta] of Object.entries(condTickResult.meterDeltas)) {
    const mKey = key as keyof typeof meters;
    if (mKey in meters) {
      meters = { ...meters, [mKey]: clamp(meters[mKey] + delta, 0, 100) };
    }
  }

  // Farm clock ticks once per accepted REST command (not per hour)
  const newFarmClockTurns = tickFarmClock(state.farm.clockTurns);

  const changes: ResolutionChange[] = [];
  if (meters.fatigue !== m.fatigue)
    changes.push({
      field: "fatigue",
      before: m.fatigue,
      after: meters.fatigue,
      delta: meters.fatigue - m.fatigue,
    });
  if (meters.hunger !== m.hunger)
    changes.push({
      field: "hunger",
      before: m.hunger,
      after: meters.hunger,
      delta: meters.hunger - m.hunger,
    });
  if (meters.thirst !== m.thirst)
    changes.push({
      field: "thirst",
      before: m.thirst,
      after: meters.thirst,
      delta: meters.thirst - m.thirst,
    });
  if (meters.sleepDebt !== m.sleepDebt)
    changes.push({
      field: "sleepDebt",
      before: m.sleepDebt,
      after: meters.sleepDebt,
      delta: meters.sleepDebt - m.sleepDebt,
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
    delta: meters.fatigue - player.meters.fatigue,
    newValue: meters.fatigue,
  });

  events.push({
    type: "FARM_CLOCK_TICKED",
    newClockTurns: newFarmClockTurns,
    deadlineTurns: state.farm.deadlineTurns,
  });

  events.push(...condTickResult.events);

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
        meters,
        conditions: condTickResult.conditions,
        permanentModifiers: condTickResult.permanentModifiers,
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
    ...upkeepResult.conditionEvents,
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
 * Parses each definition with EventDefinitionSchema and runs registry
 * validation (duplicates, follow-up references, cycles).
 * Only replaces the registry on total success; failure preserves the
 * previous registry and returns actionable errors.
 */
export function setEventRegistry(
  rawEvents: ReadonlyArray<unknown>,
): { ok: true } | { ok: false; errors: string[] } {
  // Parse each definition
  const parsed: EventDefinition[] = [];
  const parseErrors: string[] = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const result = EventDefinitionSchema.safeParse(rawEvents[i]);
    if (result.success) {
      parsed.push(result.data);
    } else {
      parseErrors.push(
        `Event[${i}]: ${result.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ")}`,
      );
    }
  }
  if (parseErrors.length > 0) {
    return { ok: false, errors: parseErrors };
  }

  // Run registry-level validation
  const registryResult = validateEventRegistry(parsed);
  if (!registryResult.valid) {
    return { ok: false, errors: registryResult.errors };
  }

  eventRegistry = parsed;
  return { ok: true };
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

  // Active-event authorization: must be the pendingFollowUp or activeEventId
  const isPendingFollowUp = state.eventHistory.pendingFollowUp === eventId;
  if (!isPendingFollowUp && state.eventHistory.activeEventId !== eventId) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Event "${eventId}" is not the active or pending event.`,
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

  // Clear pendingFollowUp and activeEventId before resolving (they will be set again if this event chains)
  let stateForResolution = state;
  if (state.eventHistory.pendingFollowUp === eventId) {
    stateForResolution = {
      ...state,
      eventHistory: {
        ...state.eventHistory,
        pendingFollowUp: null,
        activeEventId: null,
      },
    };
  } else {
    stateForResolution = {
      ...state,
      eventHistory: {
        ...state.eventHistory,
        activeEventId: null,
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

  // Emit ENCOUNTER_RESOLVED with the actual outcome text and tier
  const resolvedEvents: DomainEvent[] = [
    ...result.events,
    {
      type: "ENCOUNTER_RESOLVED",
      eventId,
      optionId,
      outcomeText: result.outcomeText,
      tier: result.tier,
    },
  ];

  // Check for terminal failure: health reaching 0
  let finalState = result.state;
  if (finalState.party.player.meters.health <= 0 && finalState.runStatus === "active") {
    finalState = { ...finalState, runStatus: "ended-failure" };
    resolvedEvents.push({
      type: "RUN_ENDED",
      reason: "health-zero",
      newRunStatus: "ended-failure",
    });
  }

  return {
    state: finalState,
    rng: result.rng,
    events: resolvedEvents,
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

// ── Activate event ────────────────────────────────────────────────────────────

function applyActivateEvent(state: GameState, rng: RngState): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  // If a follow-up is pending, activate it directly (deterministic chain)
  if (state.eventHistory.pendingFollowUp !== null) {
    const followUpId = state.eventHistory.pendingFollowUp;
    const nextState: GameState = {
      ...state,
      eventHistory: {
        ...state.eventHistory,
        activeEventId: followUpId,
        pendingFollowUp: null,
      },
    };
    return {
      state: nextState,
      rng,
      events: [{ type: "ENCOUNTER_STARTED", eventId: followUpId }],
    };
  }

  // Already have an active event — reject without consuming RNG
  if (state.eventHistory.activeEventId !== null) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Event "${state.eventHistory.activeEventId}" is already active.`,
        },
      ],
    };
  }

  // Perform deterministic candidate filtering and weighted selection
  const currentTurn = Math.floor(state.world.elapsedHours / 4);
  const candidates = filterCandidates(eventRegistry, state, currentTurn);

  if (candidates.length === 0) {
    return {
      state,
      rng,
      events: [{ type: "NO_EVENT" }],
    };
  }

  const [nextRng, selectionResult] = selectEvent(candidates, rng);

  if (selectionResult.type === "no-event") {
    return {
      state,
      rng: nextRng,
      events: [{ type: "NO_EVENT" }],
    };
  }

  // Set the activeEventId to the deterministically selected event
  const selectedId = selectionResult.event.id;
  const nextState: GameState = {
    ...state,
    eventHistory: {
      ...state.eventHistory,
      activeEventId: selectedId,
    },
  };

  return {
    state: nextState,
    rng: nextRng,
    events: [{ type: "ENCOUNTER_STARTED", eventId: selectedId }],
  };
}

// ── Treat condition ──────────────────────────────────────────────────────────

function applyTreatCondition(
  state: GameState,
  rng: RngState,
  conditionId: string,
): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  // Find the condition definition
  const def = getConditionDefinition(conditionId);
  if (!def) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Unknown condition "${conditionId}".`,
        },
      ],
    };
  }

  // Check if the condition is active on the player
  const condIdx = state.party.player.conditions.findIndex(
    (c) => c.conditionId === conditionId,
  );
  if (condIdx === -1) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Condition "${conditionId}" is not active.`,
        },
      ],
    };
  }

  const activeCond = state.party.player.conditions[condIdx]!;
  if (activeCond.treated) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Condition "${conditionId}" is already being treated.`,
        },
      ],
    };
  }

  // Check if required treatment items are available
  const requiredItemId = def.treatmentItemId;
  const requiredQty = def.treatmentItemCost;

  const item = state.inventory.storages
    .flatMap((s) => s.items)
    .find(
      (i) => i.definitionId === requiredItemId && i.quantity >= requiredQty,
    );

  if (!item) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Insufficient treatment supplies (need ${requiredQty}x ${requiredItemId}).`,
        },
      ],
    };
  }

  // Consume treatment items
  const newStorages = state.inventory.storages.map((storage) => ({
    ...storage,
    items: storage.items
      .map((i) => {
        if (i.instanceId !== item.instanceId) return i;
        return { ...i, quantity: i.quantity - requiredQty };
      })
      .filter((i) => i.quantity > 0),
  }));

  // Mark condition as treated
  const newConditions = state.party.player.conditions.map((c, idx) => {
    if (idx !== condIdx) return c;
    return { ...c, treated: true, treatmentTurns: 0 };
  });

  const events: DomainEvent[] = [
    {
      type: "ITEM_CONSUMED",
      instanceId: item.instanceId,
      definitionId: requiredItemId,
      quantity: requiredQty,
    },
    {
      type: "CONDITION_PROGRESS",
      subjectId: "player",
      conditionId,
      delta: 0,
    },
  ];

  const nextState: GameState = {
    ...state,
    inventory: { ...state.inventory, storages: newStorages },
    party: {
      ...state.party,
      player: {
        ...state.party.player,
        conditions: newConditions,
      },
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

    case "ACTIVATE_EVENT":
      result = applyActivateEvent(state, rng);
      break;

    case "TREAT_CONDITION":
      result = applyTreatCondition(state, rng, command.conditionId);
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

  // Terminal failure check: any command that reduces health to 0 ends the run
  const wasRejected2 = result.events.some(
    (e) => e.type === "COMMAND_REJECTED",
  );
  if (
    !wasRejected2 &&
    result.state.runStatus === "active" &&
    result.state.party.player.meters.health <= 0
  ) {
    result = {
      ...result,
      state: { ...result.state, runStatus: "ended-failure" },
      events: [
        ...result.events,
        {
          type: "RUN_ENDED",
          reason: "health-zero",
          newRunStatus: "ended-failure",
        },
      ],
    };
  }

  return result;
}
