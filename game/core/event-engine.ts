/**
 * Event engine — pure, deterministic event selection and resolution.
 *
 * Responsibilities:
 *   1. Filter candidate events from the content registry.
 *   2. Sort candidates by stable ID (load-order independent).
 *   3. Seeded weighted selection (including no-event outcome).
 *   4. Evaluate option availability (conditions).
 *   5. Perform skill checks with success tiers.
 *   6. Apply effects atomically (validate-first, rollback on failure).
 *   7. Track cooldowns, once-only flags, and follow-ups.
 */

import type { GameState } from "../schemas/game-state";
import type { RngState } from "./rng";
import { weightedChoice, nextInt } from "./rng";
import type { DomainEvent } from "./domain-events";
import type {
  EventDefinition,
  EventOption,
  ConditionTree,
  ConditionLeaf,
  SkillCheck,
  SkillCheckTier,
  WeightedOutcome,
  Effect,
} from "../content/event-definitions";
import type { Attributes, Meters } from "../schemas/meters";

// ── Public types ─────────────────────────────────────────────────────────────

export type EventSelectionResult =
  { type: "no-event" } | { type: "event-selected"; event: EventDefinition };

export type OptionAvailability = {
  optionId: string;
  available: boolean;
  reason?: string;
};

export type EventResolutionResult = {
  state: GameState;
  rng: RngState;
  events: DomainEvent[];
  outcomeText: string;
  tier?: SkillCheckTier;
};

// ── Condition evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a condition tree against game state.
 * Returns true if the condition is satisfied.
 */
export function evaluateCondition(
  condition: ConditionTree,
  state: GameState,
): boolean {
  if ("all" in condition) {
    return condition.all.every((c) => evaluateCondition(c, state));
  }
  if ("any" in condition) {
    return condition.any.some((c) => evaluateCondition(c, state));
  }
  if ("not" in condition) {
    return !evaluateCondition(condition.not, state);
  }
  return evaluateLeaf(condition, state);
}

function evaluateLeaf(leaf: ConditionLeaf, state: GameState): boolean {
  const actual = resolveField(leaf.field, state);
  const { op, value } = leaf;

  switch (op) {
    case "eq":
      return actual === value;
    case "neq":
      return actual !== value;
    case "gt":
      return (
        typeof actual === "number" &&
        typeof value === "number" &&
        actual > value
      );
    case "gte":
      return (
        typeof actual === "number" &&
        typeof value === "number" &&
        actual >= value
      );
    case "lt":
      return (
        typeof actual === "number" &&
        typeof value === "number" &&
        actual < value
      );
    case "lte":
      return (
        typeof actual === "number" &&
        typeof value === "number" &&
        actual <= value
      );
    case "has":
      return resolveHas(leaf.field, String(value), state);
    case "not-has":
      return !resolveHas(leaf.field, String(value), state);
  }
}

function resolveField(
  field: string,
  state: GameState,
): string | number | boolean | undefined {
  switch (field) {
    case "chapter":
      return state.location.chapter;
    case "terrain":
      return state.location.terrain;
    case "phase":
      return state.world.phase;
    case "weather":
      return state.world.weather;
    case "day":
      return state.world.day;
    case "elapsedHours":
      return state.world.elapsedHours;
    case "noiseLevel":
      return state.world.noiseLevel;
    case "runStatus":
      return state.runStatus;
    default: {
      if (field.startsWith("meter.")) {
        const meterName = field.slice(6) as keyof Meters;
        return state.party.player.meters[meterName];
      }
      if (field.startsWith("attribute.")) {
        const attrName = field.slice(10) as keyof Attributes;
        return state.party.player.attributes[attrName];
      }
      if (field === "flag") {
        return undefined; // use "has"/"not-has" ops for flags
      }
      if (field === "pursuit.intensity") {
        return state.pursuit.intensity;
      }
      return undefined;
    }
  }
}

function resolveHas(field: string, value: string, state: GameState): boolean {
  if (field === "flag") {
    return state.eventHistory.activeFlags.includes(value);
  }
  if (field === "inventory.tag" || field === "inventory") {
    return state.inventory.storages.some((s) =>
      s.items.some((i) => i.definitionId === value),
    );
  }
  if (field === "companion") {
    return state.party.companions.some((c) => c.id === value);
  }
  if (field === "visitedNode") {
    return state.location.visitedNodeIds.includes(
      value as (typeof state.location.visitedNodeIds)[number],
    );
  }
  if (field === "hazard") {
    return state.world.activeHazards.includes(value);
  }
  return false;
}

// ── Candidate filtering ──────────────────────────────────────────────────────

/**
 * Filter event definitions to those eligible in the current state.
 * Applies trigger conditions, cooldowns, and once-only checks.
 */
export function filterCandidates(
  events: ReadonlyArray<EventDefinition>,
  state: GameState,
  currentTurn: number,
): EventDefinition[] {
  return events.filter((event) => {
    // Once-only: check if already in history
    if (event.once) {
      if (state.eventHistory.entries.some((e) => e.eventId === event.id)) {
        return false;
      }
    }

    // Cooldown check
    if (event.cooldownTurns != null && event.cooldownTurns > 0) {
      const lastTurn = state.eventHistory.cooldowns[event.id];
      if (lastTurn != null && currentTurn - lastTurn < event.cooldownTurns) {
        return false;
      }
    }

    // Trigger condition
    return evaluateCondition(event.trigger, state);
  });
}

// ── Stable weighted selection ────────────────────────────────────────────────

/**
 * NO_EVENT_WEIGHT: probability weight for "no event happens this turn".
 */
const NO_EVENT_WEIGHT = 20;

/**
 * Select an event from candidates using stable ID ordering and seeded RNG.
 * Candidates are sorted by ID before selection so load order doesn't matter.
 */
export function selectEvent(
  candidates: EventDefinition[],
  rng: RngState,
): [RngState, EventSelectionResult] {
  if (candidates.length === 0) {
    return [rng, { type: "no-event" }];
  }

  // Sort by stable ID for load-order independence
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));

  // Build items/weights including no-event
  const items: Array<EventDefinition | null> = [...sorted, null];
  const weights = [...sorted.map((e) => e.weight), NO_EVENT_WEIGHT];

  const [nextRng, chosen] = weightedChoice(rng, items, weights);

  if (chosen === null) {
    return [nextRng, { type: "no-event" }];
  }
  return [nextRng, { type: "event-selected", event: chosen }];
}

// ── Option availability ──────────────────────────────────────────────────────

/**
 * Determine which options are available and why unavailable ones are blocked.
 */
export function getOptionAvailability(
  options: ReadonlyArray<EventOption>,
  state: GameState,
): OptionAvailability[] {
  return options.map((opt) => {
    if (!opt.requirements) {
      return { optionId: opt.id, available: true };
    }
    const met = evaluateCondition(opt.requirements, state);
    if (met) {
      return { optionId: opt.id, available: true };
    }
    return {
      optionId: opt.id,
      available: false,
      reason: describeUnmetRequirements(opt.requirements, state),
    };
  });
}

function describeUnmetRequirements(
  condition: ConditionTree,
  state: GameState,
): string {
  if ("all" in condition) {
    const unmet = condition.all
      .filter((c) => !evaluateCondition(c, state))
      .map((c) => describeUnmetRequirements(c, state));
    return unmet.join("; ");
  }
  if ("any" in condition) {
    return (
      "Requires one of: " + condition.any.map((c) => describeLeaf(c)).join(", ")
    );
  }
  if ("not" in condition) {
    return "Must not: " + describeLeaf(condition.not);
  }
  return describeLeafRequirement(condition);
}

function describeLeaf(c: ConditionTree): string {
  if ("field" in c) return describeLeafRequirement(c);
  return "(complex condition)";
}

function describeLeafRequirement(leaf: ConditionLeaf): string {
  const { field, op, value } = leaf;
  switch (op) {
    case "has":
      return `Requires ${field}: ${value}`;
    case "not-has":
      return `Must not have ${field}: ${value}`;
    case "gte":
      return `${field} must be at least ${value}`;
    case "lte":
      return `${field} must be at most ${value}`;
    case "gt":
      return `${field} must be greater than ${value}`;
    case "lt":
      return `${field} must be less than ${value}`;
    case "eq":
      return `${field} must be ${value}`;
    case "neq":
      return `${field} must not be ${value}`;
  }
}

// ── Skill check resolution ───────────────────────────────────────────────────

/**
 * Perform a skill check and return the tier result.
 *
 * Roll: 1d20 + attribute + modifier vs difficulty.
 * - Roll of 1 (natural): critical failure
 * - Roll of 20 (natural): critical success
 * - Total >= difficulty + 5: critical success
 * - Total >= difficulty: success
 * - Total < difficulty - 5: critical failure (even without nat 1)
 * - Otherwise: failure
 */
export function resolveSkillCheck(
  check: SkillCheck,
  state: GameState,
  rng: RngState,
): [RngState, SkillCheckTier] {
  const attrValue = getAttributeValue(check.attribute, state);
  const [nextRng, dieRoll] = nextInt(rng, 1, 20);

  if (dieRoll === 1) return [nextRng, "critical-failure"];
  if (dieRoll === 20) return [nextRng, "critical-success"];

  const total = dieRoll + attrValue + check.modifier;

  if (total >= check.difficulty + 5) return [nextRng, "critical-success"];
  if (total >= check.difficulty) return [nextRng, "success"];
  if (total < check.difficulty - 5) return [nextRng, "critical-failure"];
  return [nextRng, "failure"];
}

function getAttributeValue(attribute: string, state: GameState): number {
  const attrs = state.party.player.attributes;
  if (attribute in attrs) {
    return attrs[attribute as keyof Attributes];
  }
  return 0;
}

// ── Outcome selection ────────────────────────────────────────────────────────

/**
 * Select an outcome based on the tier (if skill check was made).
 */
export function selectOutcome(
  outcomes: ReadonlyArray<WeightedOutcome>,
  tier: SkillCheckTier | undefined,
  rng: RngState,
): [RngState, WeightedOutcome] {
  let eligible: WeightedOutcome[];

  if (tier) {
    eligible = outcomes.filter((o) => o.tier === tier);
    if (eligible.length === 0) {
      eligible = outcomes.filter((o) => !o.tier);
    }
    if (eligible.length === 0) {
      eligible = [...outcomes];
    }
  } else {
    eligible = outcomes.filter((o) => !o.tier);
    if (eligible.length === 0) {
      eligible = [...outcomes];
    }
  }

  if (eligible.length === 1) {
    return [rng, eligible[0]!];
  }

  const weights = eligible.map((o) => o.weight);
  const [nextRng, chosen] = weightedChoice(rng, eligible, weights);
  return [nextRng, chosen];
}

// ── Effect application ───────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Validate that all effects in the batch can be applied.
 * Returns an error message if validation fails, undefined if valid.
 */
export function validateEffectBatch(
  effects: ReadonlyArray<Effect>,
  state: GameState,
): string | undefined {
  for (const effect of effects) {
    switch (effect.type) {
      case "meter": {
        const key = effect.meter as keyof Meters;
        if (!(key in state.party.player.meters)) {
          return `Unknown meter "${effect.meter}"`;
        }
        break;
      }
      case "flag-set":
      case "flag-clear":
      case "time":
      case "follow-up":
        break;
    }
  }
  return undefined;
}

/**
 * Apply effects atomically to game state.
 * Caller must validate first with validateEffectBatch().
 * Returns the new state, domain events, and any queued follow-up event ID.
 */
export function applyEffects(
  effects: ReadonlyArray<Effect>,
  state: GameState,
): { state: GameState; events: DomainEvent[]; followUp?: string } {
  let s = state;
  const domainEvents: DomainEvent[] = [];
  let followUp: string | undefined;

  for (const effect of effects) {
    switch (effect.type) {
      case "meter": {
        const meters = { ...s.party.player.meters };
        const key = effect.meter as keyof typeof meters;
        const oldVal = meters[key];
        const newVal = clamp(oldVal + effect.delta, 0, 100);
        meters[key] = newVal;
        domainEvents.push({
          type: "METER_CHANGED",
          subjectId: "player",
          meter: effect.meter,
          delta: newVal - oldVal,
          newValue: newVal,
        });
        s = {
          ...s,
          party: {
            ...s.party,
            player: { ...s.party.player, meters },
          },
        };
        break;
      }
      case "flag-set": {
        if (!s.eventHistory.activeFlags.includes(effect.flag)) {
          s = {
            ...s,
            eventHistory: {
              ...s.eventHistory,
              activeFlags: [...s.eventHistory.activeFlags, effect.flag],
            },
          };
        }
        break;
      }
      case "flag-clear": {
        s = {
          ...s,
          eventHistory: {
            ...s.eventHistory,
            activeFlags: s.eventHistory.activeFlags.filter(
              (f) => f !== effect.flag,
            ),
          },
        };
        break;
      }
      case "time": {
        const newElapsed = s.world.elapsedHours + effect.hours;
        s = {
          ...s,
          world: {
            ...s.world,
            elapsedHours: newElapsed,
            day: Math.floor(newElapsed / 24) + 1,
          },
        };
        domainEvents.push({
          type: "TIME_ADVANCED",
          hours: effect.hours,
          newElapsedHours: newElapsed,
        });
        break;
      }
      case "follow-up": {
        followUp = effect.eventId;
        break;
      }
    }
  }

  return { state: s, events: domainEvents, followUp };
}

// ── Full event resolution (CHOOSE_EVENT_OPTION) ──────────────────────────────

/**
 * Resolve a player's choice for an active event.
 *
 * Preconditions (enforced by caller in reducer):
 *   - The event must be the currently active/pending event.
 *   - Once/cooldown rules must be satisfied.
 *   - The event trigger must still be met.
 *   - The option must belong to that event and be available.
 */
export function resolveEventChoice(
  event: EventDefinition,
  optionId: string,
  state: GameState,
  rng: RngState,
  currentTurn: number,
): EventResolutionResult {
  const option = event.options.find((o) => o.id === optionId);
  if (!option) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Option "${optionId}" not found in event "${event.id}".`,
        },
      ],
      outcomeText: "",
    };
  }

  // Check requirements
  if (option.requirements && !evaluateCondition(option.requirements, state)) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Option "${optionId}" requirements not met.`,
        },
      ],
      outcomeText: "",
    };
  }

  // Skill check (if any)
  let tier: SkillCheckTier | undefined;
  let currentRng = rng;

  if (option.check) {
    [currentRng, tier] = resolveSkillCheck(option.check, state, currentRng);
  }

  // Select outcome
  const [rngAfterOutcome, outcome] = selectOutcome(
    option.outcomes,
    tier,
    currentRng,
  );
  currentRng = rngAfterOutcome;

  // Validate effect batch before applying (atomic: all or nothing)
  const validationError = validateEffectBatch(outcome.effects, state);
  if (validationError) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Effect validation failed: ${validationError}`,
        },
      ],
      outcomeText: "",
    };
  }

  // Apply effects atomically
  const effectResult = applyEffects(outcome.effects, state);
  let nextState = effectResult.state;

  // Record in event history
  const flagsSet = outcome.effects
    .filter((e): e is Effect & { type: "flag-set" } => e.type === "flag-set")
    .map((e) => e.flag);

  const entry = {
    eventId: event.id as import("../schemas/ids").EventId,
    chosenOptionId: optionId,
    resolvedAtHour: nextState.world.elapsedHours,
    skillCheckResult: tier,
    flagsSet,
  };

  // Update cooldowns
  const cooldowns = { ...nextState.eventHistory.cooldowns };
  if (event.cooldownTurns != null && event.cooldownTurns > 0) {
    cooldowns[event.id] = currentTurn;
  }

  // Queue follow-up if any
  const pendingFollowUp = effectResult.followUp ?? null;

  nextState = {
    ...nextState,
    eventHistory: {
      ...nextState.eventHistory,
      entries: [...nextState.eventHistory.entries, entry],
      cooldowns,
      pendingFollowUp,
    },
  };

  // Build domain events
  const domainEvents: DomainEvent[] = [
    { type: "ENCOUNTER_STARTED", eventId: event.id },
    ...effectResult.events,
  ];

  return {
    state: nextState,
    rng: currentRng,
    events: domainEvents,
    outcomeText: outcome.text,
    tier,
  };
}
