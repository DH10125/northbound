/**
 * Turn clock and phase rules.
 *
 * Encodes:
 *   - Phase derivation from elapsed hours (day/dusk/night/dawn).
 *   - Canonical turn durations per action type (2–6 hours each).
 *   - Phase-gated action availability with machine-readable reasons for
 *     disabled actions.
 *   - Per-turn meter upkeep deltas (clamped to [0, 100] before storing).
 *   - Farm-clock advancement (one tick per accepted turn).
 *
 * Pure, deterministic, no React/browser imports.
 */

import type { GameState } from "../schemas/game-state";

// ── Phase boundaries ──────────────────────────────────────────────────────────

/** Hours per phase slot when dividing a 24-hour day into four equal phases. */
const PHASE_HOURS = 6;

/**
 * Derive the narrative phase from total elapsed in-world hours.
 * Wraps mod-24 so any hour count is valid.
 *
 *   h ∈ [0,  6) → day
 *   h ∈ [6, 12) → dusk
 *   h ∈ [12, 18) → night
 *   h ∈ [18, 24) → dawn
 */
export function hoursToPhase(
  hours: number,
): "day" | "dusk" | "night" | "dawn" {
  const h = ((hours % 24) + 24) % 24;
  if (h < PHASE_HOURS) return "day";
  if (h < PHASE_HOURS * 2) return "dusk";
  if (h < PHASE_HOURS * 3) return "night";
  return "dawn";
}

// ── Action catalogue ──────────────────────────────────────────────────────────

/**
 * Every action available in the game loop.
 * Actions not yet implemented by the reducer (e.g. HUNT, TRADE) are still
 * modelled here so availability can be surfaced to the UI.
 */
export type ActionType =
  // Night-preferred (available night/dusk/dawn, restricted in daylight)
  | "TRAVEL"
  | "SCOUT"
  | "FORAGE"
  | "SALVAGE"
  | "HUNT"
  | "SNEAK"
  // Day-preferred (available day/dusk/dawn, restricted at night)
  | "REST"
  | "TREAT"
  | "REPAIR"
  | "COOK"
  | "TRADE"
  | "PURIFY"
  | "STUDY_MAP"
  // Available in all phases
  | "SCAVENGE"
  | "WAIT";

/** Turn duration in in-world hours for each action type. */
export const ACTION_TURN_HOURS: Record<ActionType, number> = {
  TRAVEL: 4,
  SCOUT: 3,
  FORAGE: 3,
  SALVAGE: 3,
  HUNT: 4,
  SNEAK: 2,
  REST: 6,
  TREAT: 2,
  REPAIR: 4,
  COOK: 2,
  TRADE: 3,
  PURIFY: 2,
  STUDY_MAP: 2,
  SCAVENGE: 3,
  WAIT: 2,
};

/** Restriction severity for phase-gated actions. */
export type ActionRestriction = "none" | "preferred" | "discouraged" | "banned";

/**
 * Machine-readable reason explaining why an action is unavailable.
 * An empty string means the action is available.
 */
export type ActionAvailability = {
  available: boolean;
  restriction: ActionRestriction;
  /** Human-readable explanation; empty string when available === true. */
  reason: string;
};

// ── Phase rules ───────────────────────────────────────────────────────────────

/** Phases where travel/stealth actions are available or preferred. */
const NIGHT_PREFERRED_PHASES = new Set<string>(["night", "dusk", "dawn"]);

/** Phases where recovery/daytime actions are available or preferred. */
const DAY_PREFERRED_PHASES = new Set<string>(["day", "dusk", "dawn"]);

/** Actions that are restricted (discouraged, not banned) during daylight. */
const NIGHT_PREFERRED_ACTIONS = new Set<ActionType>([
  "TRAVEL",
  "SCOUT",
  "FORAGE",
  "SALVAGE",
  "HUNT",
  "SNEAK",
]);

/** Actions that are restricted (discouraged, not banned) at night. */
const DAY_PREFERRED_ACTIONS = new Set<ActionType>([
  "REST",
  "TREAT",
  "REPAIR",
  "COOK",
  "TRADE",
  "PURIFY",
  "STUDY_MAP",
]);

/** TRADE is fully unavailable at night (no traders active). */
const BANNED_AT_NIGHT = new Set<ActionType>(["TRADE"]);

/**
 * Compute availability for a single action given the current phase and state.
 *
 * Rules:
 *   - Actions in BANNED_AT_NIGHT are fully unavailable during night/dusk/dawn.
 *   - Night-preferred actions are preferred at night, discouraged during day.
 *   - Day-preferred actions are preferred during day, discouraged at night.
 *   - SCAVENGE and WAIT are available in all phases.
 *   - A run that is not active makes every action unavailable.
 */
export function getActionAvailability(
  state: GameState,
  action: ActionType,
): ActionAvailability {
  if (state.runStatus !== "active") {
    return {
      available: false,
      restriction: "banned",
      reason: "The run has ended.",
    };
  }

  const phase = state.world.phase;

  // Hard ban: TRADE is unavailable during night (no traders active)
  if (BANNED_AT_NIGHT.has(action) && NIGHT_PREFERRED_PHASES.has(phase)) {
    return {
      available: false,
      restriction: "banned",
      reason: `${formatAction(action)} is not available at ${phase} — traders are not active.`,
    };
  }

  // Night-preferred actions get a discouragement label during day
  if (NIGHT_PREFERRED_ACTIONS.has(action)) {
    if (NIGHT_PREFERRED_PHASES.has(phase)) {
      return { available: true, restriction: "preferred", reason: "" };
    }
    // Daytime: discouraged but not banned
    return {
      available: true,
      restriction: "discouraged",
      reason: `${formatAction(action)} is safer at night — moving in daylight increases visibility.`,
    };
  }

  // Day-preferred actions get a discouragement label at night
  if (DAY_PREFERRED_ACTIONS.has(action)) {
    if (DAY_PREFERRED_PHASES.has(phase)) {
      return { available: true, restriction: "preferred", reason: "" };
    }
    // Night: discouraged but not banned (except TRADE handled above)
    return {
      available: true,
      restriction: "discouraged",
      reason: `${formatAction(action)} is easier during daylight hours.`,
    };
  }

  // All-phases actions (SCAVENGE, WAIT)
  return { available: true, restriction: "none", reason: "" };
}

/** Format action type for human-readable messages. */
function formatAction(action: ActionType): string {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Per-turn meter upkeep ─────────────────────────────────────────────────────

/**
 * Upkeep deltas applied to player meters for each elapsed hour, before
 * action-specific adjustments. Values are per-hour and may be negative
 * (recovery) or positive (degradation).
 *
 * Positive = meter worsens. Negative = meter improves.
 * All results are clamped to [0, 100] by the reducer before storing.
 */
export type MeterUpkeepPerHour = {
  hunger: number;
  thirst: number;
  fatigue: number;
  sleepDebt: number;
};

/** Upkeep rates during active movement (TRAVEL, SCOUT, SNEAK, FORAGE, HUNT). */
export const UPKEEP_MOVING: MeterUpkeepPerHour = {
  hunger: 2, // per hour while moving
  thirst: 3,
  fatigue: 4,
  sleepDebt: 1,
};

/** Upkeep rates during stationary active tasks (SALVAGE, REPAIR, COOK, TRADE, PURIFY, STUDY_MAP, SCAVENGE). */
export const UPKEEP_ACTIVE: MeterUpkeepPerHour = {
  hunger: 1,
  thirst: 2,
  fatigue: 2,
  sleepDebt: 1,
};

/** Upkeep rates during rest/treatment (REST, TREAT, WAIT). */
export const UPKEEP_RESTING: MeterUpkeepPerHour = {
  hunger: 1,
  thirst: 1,
  fatigue: -4, // fatigue decreases while resting
  sleepDebt: -3,
};

/** Which upkeep category applies to each action. */
export const ACTION_UPKEEP_CATEGORY: Record<
  ActionType,
  "moving" | "active" | "resting"
> = {
  TRAVEL: "moving",
  SCOUT: "moving",
  FORAGE: "moving",
  SALVAGE: "active",
  HUNT: "moving",
  SNEAK: "moving",
  REST: "resting",
  TREAT: "resting",
  REPAIR: "active",
  COOK: "active",
  TRADE: "active",
  PURIFY: "active",
  STUDY_MAP: "active",
  SCAVENGE: "active",
  WAIT: "resting",
};

/**
 * Compute total meter upkeep for a given action over its canonical duration.
 * Returns deltas (positive = worsens, negative = improves).
 */
export function computeUpkeep(
  action: ActionType,
): MeterUpkeepPerHour & { hours: number } {
  const hours = ACTION_TURN_HOURS[action];
  const category = ACTION_UPKEEP_CATEGORY[action];
  const rates =
    category === "moving"
      ? UPKEEP_MOVING
      : category === "active"
        ? UPKEEP_ACTIVE
        : UPKEEP_RESTING;

  return {
    hunger: rates.hunger * hours,
    thirst: rates.thirst * hours,
    fatigue: rates.fatigue * hours,
    sleepDebt: rates.sleepDebt * hours,
    hours,
  };
}

// ── Farm clock ────────────────────────────────────────────────────────────────

/**
 * Compute the new farm clock turns after one accepted turn.
 * Farm clock advances by 1 per accepted turn (not per hour).
 */
export function tickFarmClock(currentTurns: number): number {
  return currentTurns + 1;
}

// ── Resolution summary ────────────────────────────────────────────────────────

/** A single annotated change in the resolution summary. */
export type ResolutionChange = {
  /** e.g. "fatigue", "hunger", "farm.clockTurns" */
  field: string;
  before: number;
  after: number;
  delta: number;
};

/** Summary of a completed turn, emitted as a TURN_RESOLVED domain event. */
export type TurnSummary = {
  action: ActionType;
  phase: "day" | "dusk" | "night" | "dawn";
  hoursElapsed: number;
  changes: ResolutionChange[];
};
