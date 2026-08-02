/**
 * Pure selectors over GameState.
 *
 * Selectors never mutate state.  They accept GameState (and optionally a
 * second argument) and return derived values.  No RNG, no side effects.
 */

import type { GameState } from "../schemas/game-state";
import { getActionAvailability, getActionAdvisory } from "./turn-clock";
import type { ActionType, ActionAvailability } from "./turn-clock";
import { carriedWeight, carriedNoise, WEIGHT_CAPACITY } from "./inventory";

// ── Party ─────────────────────────────────────────────────────────────────────

/** True if the run is still in progress. */
export function isRunActive(state: GameState): boolean {
  return state.runStatus === "active";
}

/** Player health (0–100). */
export function playerHealth(state: GameState): number {
  return state.party.player.meters.health;
}

/** True if the player is dead (health === 0). */
export function isPlayerDead(state: GameState): boolean {
  return state.party.player.meters.health === 0;
}

/** Total number of active companions. */
export function activeCompanionCount(state: GameState): number {
  return state.party.companions.filter((c) => c.status === "active").length;
}

// ── Inventory ─────────────────────────────────────────────────────────────────

/** Total item count across all storages (sum of quantities). */
export function totalItemCount(state: GameState): number {
  return state.inventory.storages
    .flatMap((s) => s.items)
    .reduce((acc, item) => acc + item.quantity, 0);
}

/** Find a specific item instance by instanceId, or undefined. */
export function findItemInstance(
  state: GameState,
  instanceId: string,
):
  | {
      instanceId: string;
      definitionId: string;
      quantity: number;
      condition: number;
    }
  | undefined {
  return state.inventory.storages
    .flatMap((s) => s.items)
    .find((i) => i.instanceId === instanceId);
}

/** Total carried weight (body + backpack) in kg. */
export function totalCarriedWeight(state: GameState): number {
  return carriedWeight(state);
}

/** Weight capacity ratio (0–1+). Over 1.0 means encumbered. */
export function encumbranceRatio(state: GameState): number {
  const cap = WEIGHT_CAPACITY["backpack"] + WEIGHT_CAPACITY["body"];
  return carriedWeight(state) / cap;
}

/** Whether the party is over carried weight capacity. */
export function isEncumbered(state: GameState): boolean {
  return encumbranceRatio(state) > 1.0;
}

/** Total noise from carried items. Used by stealth/detection systems. */
export function totalCarriedNoise(state: GameState): number {
  return carriedNoise(state);
}

// ── World ─────────────────────────────────────────────────────────────────────

/** Elapsed days (1-based). */
export function currentDay(state: GameState): number {
  return state.world.day;
}

/** Whether it is currently night. */
export function isNight(state: GameState): boolean {
  return state.world.phase === "night";
}

// ── Route ─────────────────────────────────────────────────────────────────────

/** Fraction of journey completed in [0, 1]. */
export function journeyProgress(state: GameState): number {
  // We need the original distance — derive it from elapsed hours as a proxy.
  // For now, we use a fixed max distance from the fixture (1500 units).
  // In a real implementation this would come from authored route data.
  const MAX_DISTANCE = 1500;
  return Math.min(
    1,
    (MAX_DISTANCE - state.location.distanceRemaining) / MAX_DISTANCE,
  );
}

/** True if the party has reached the destination. */
export function hasReachedDestination(state: GameState): boolean {
  return state.location.distanceRemaining === 0;
}

// ── Meters helpers ────────────────────────────────────────────────────────────

/** True if any meter for the player is at 100 (critical). */
export function hasAnyCriticalMeter(state: GameState): boolean {
  const m = state.party.player.meters;
  return (
    m.hunger === 100 ||
    m.thirst === 100 ||
    m.fatigue === 100 ||
    m.stress === 100 ||
    m.infection === 100
  );
}

/** Clamp helper exposed for use by other core modules (not exported from barrel). */
export function clampMeter(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ── Action availability ───────────────────────────────────────────────────────

/**
 * Return availability information for a given action in the current state.
 * Delegates to the turn-clock module — kept here so callers only need to
 * import from selectors.
 */
export function actionAvailability(
  state: GameState,
  action: ActionType,
): ActionAvailability {
  return getActionAvailability(state, action);
}

/**
 * Return true if the given action can be taken right now.
 * Shorthand for `actionAvailability(state, action).available`.
 */
export function isActionAvailable(
  state: GameState,
  action: ActionType,
): boolean {
  return getActionAvailability(state, action).available;
}

/**
 * If the action is unavailable, return the human-readable reason; otherwise "".
 * Suitable for aria-describedby on a disabled button.
 * Always returns "" for discouraged-but-available actions.
 */
export function disabledReason(state: GameState, action: ActionType): string {
  return getActionAvailability(state, action).reason;
}

/**
 * Return an advisory hint for a discouraged-but-available action.
 * Returns "" when the action is preferred or unrestricted.
 * Use for tooltips, not aria-describedby (the action is still available).
 */
export function actionAdvisory(state: GameState, action: ActionType): string {
  return getActionAdvisory(action, state.world.phase);
}

/** Re-export ActionType so consumers can import from selectors. */
export type { ActionType, ActionAvailability };
