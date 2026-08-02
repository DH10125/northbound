/**
 * Turn clock and phase rules.
 *
 * Encodes:
 *   - Phase derivation from elapsed hours (night/dawn/day/dusk).
 *   - Canonical turn durations per action type (2–6 hours each).
 *   - Phase-gated action availability with machine-readable reasons for
 *     disabled actions.
 *   - Per-turn meter upkeep deltas (clamped to [0, 100] before storing).
 *   - Farm-clock advancement (one tick per accepted turn).
 *
 * Pure, deterministic, no React/browser imports.
 */

import type { GameState } from "../schemas/game-state";

// ── Phase boundaries ────────────────────────────────────────────────

/** Hours per phase slot when dividing a 24-hour day into four equal phases. */
const PHASE_HOURS = 6;

/**
 * Derive the narrative phase from total elapsed in-world hours.
 * Wraps mod-24 so any hour count is valid.
 *
 * The game world starts at night (elapsedHours=0 ↔ night).
 * This matches the character-creation initial state where the party departs
 * under cover of darkness.
 *
 *   h ∈ [0,  6) → night   (initial phase; new runs start here)
 *   h ∈ [6, 12) → dawn
 *   h ∈ [12, 18) → day
 *   h ∈ [18, 24) → dusk
 */
export function hoursToPhase(hours: number): "day" | "dusk" | "night" | "dawn" {
  const h = ((hours % 24) + 24) % 24;
  if (h < PHASE_HOURS) return "night";
  if (h < PHASE_HOURS * 2) return "dawn";
  if (h < PHASE_HOURS * 3) return "day";
  return "dusk";
}

// ── Action catalogue ────────────────────────────────────────────────

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

/** Turn duration in in-world hours for each action type. Must be in [2, 6]. */
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
 * Availability descriptor for an action in the current state.
 *
 * When available === true, `reason` is always "".
 * When available === false, `reason` explains why (for disabled-button aria).
 * Advisory text for discouraged-but-available actions is NOT surfaced here;
 * use `actionAvailability().restriction` and `getActionAdvisory()` for that.
 */
export type ActionAvailability = {
  available: boolean;
  restriction: ActionRestriction;
  /**
   * Human-readable explanation for screen readers and disabled tooltips.
   * Always "" when the action is available (including when discouraged).
   */
  reason: string;
};

// ── Phase rules ─────────────────────────────────────────────────────

/** Phases where travel/stealth actions are preferred. */
const NIGHT_PREFERRED_PHASES = new Set<string>(["night", "dusk", "dawn"]);

/** Phases where recovery/daytime actions are preferred. */
const DAY_PREFERRED_PHASES = new Set<string>(["day", "dusk", "dawn"]);

/** Actions that are preferred at night, discouraged (not banned) during day. */
const NIGHT_PREFERRED_ACTIONS = new Set<ActionType>([
  "TRAVEL",
  "SCOUT",
  "FORAGE",
  "SALVAGE",
  "HUNT",
  "SNEAK",
]);

/** Actions that are preferred during day, discouraged (not banned) at night. */
const DAY_PREFERRED_ACTIONS = new Set<ActionType>([
  "REST",
  "TREAT",
  "REPAIR",
  "COOK",
  "TRADE",
  "PURIFY",
  "STUDY_MAP",
]);

/**
 * Actions that are fully unavailable during strict night only.
 * Dusk and dawn are transitional — these actions remain available there.
 */
const BANNED_AT_STRICT_NIGHT = new Set<ActionType>(["TRADE"]);

/**
 * Compute availability for a single action given the current phase and state.
 *
 * Rules:
 *   - Actions in BANNED_AT_STRICT_NIGHT are fully unavailable during night only
 *     (not dusk, not dawn).
 *   - Night-preferred actions are preferred at night/dusk/dawn, discouraged
 *     during day.
 *   - Day-preferred actions are preferred during day/dusk/dawn, discouraged at
 *     night.
 *   - SCAVENGE and WAIT are available in all phases.
 *   - A run that is not active makes every action unavailable.
 *   - `reason` is always "" when available === true (including discouraged).
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

  // Hard ban: some actions are unavailable during strict night only
  if (BANNED_AT_STRICT_NIGHT.has(action) && phase === "night") {
    return {
      available: false,
      restriction: "banned",
      reason: `${formatAction(action)} is not available at night — traders are not active.`,
    };
  }

  // Night-preferred actions
  if (NIGHT_PREFERRED_ACTIONS.has(action)) {
    if (NIGHT_PREFERRED_PHASES.has(phase)) {
      return { available: true, restriction: "preferred", reason: "" };
    }
    // Daytime: discouraged but available; reason is "" per contract
    return { available: true, restriction: "discouraged", reason: "" };
  }

  // Day-preferred actions
  if (DAY_PREFERRED_ACTIONS.has(action)) {
    if (DAY_PREFERRED_PHASES.has(phase)) {
      return { available: true, restriction: "preferred", reason: "" };
    }
    // Night: discouraged but available; reason is "" per contract
    return { available: true, restriction: "discouraged", reason: "" };
  }

  // All-phases actions (SCAVENGE, WAIT)
  return { available: true, restriction: "none", reason: "" };
}

/**
 * Return a short advisory hint for discouraged-but-available actions.
 * Returns "" when the action is preferred or unrestricted.
 * This is distinct from a disabled reason — use for tooltips, not aria.
 */
export function getActionAdvisory(action: ActionType, phase: string): string {
  if (
    NIGHT_PREFERRED_ACTIONS.has(action) &&
    !NIGHT_PREFERRED_PHASES.has(phase)
  ) {
    return `${formatAction(action)} is safer at night — moving in daylight increases visibility.`;
  }
  if (DAY_PREFERRED_ACTIONS.has(action) && !DAY_PREFERRED_PHASES.has(phase)) {
    return `${formatAction(action)} is easier during daylight hours.`;
  }
  return "";
}

/** Format action type for human-readable messages. */
function formatAction(action: ActionType): string {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Per-turn meter upkeep ───────────────────────────────────────────────

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

// ── Farm clock ────────────────────────────────────────────────────────

/**
 * Compute the new farm clock turns after one accepted turn.
 * Farm clock advances by 1 per accepted turn (not per hour).
 */
export function tickFarmClock(currentTurns: number): number {
  return currentTurns + 1;
}

// ── Resolution summary ────────────────────────────────────────────────────

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
