/**
 * Replay harness — deterministic run replay and divergence detection.
 *
 * Given an initial state, initial RNG state, and a sequence of commands, replay
 * re-applies each command and returns the final state plus a journal.
 *
 * Each journal entry carries a canonical fingerprint of the state **and** RNG
 * state after the turn, plus the full validated command payload. This lets
 * `diffReplay` detect divergence even when two runs produce identical event
 * signatures but land in different states (e.g. due to different initial RNG).
 */

import type { GameState } from "../schemas/game-state";
import type { RngState } from "./rng";
import type { Command } from "./commands";
import { applyCommand } from "./reducer";
import type { DomainEvent } from "./domain-events";

// ── Journal entry ─────────────────────────────────────────────────────────────

export type TurnSnapshot = {
  /** 0-based turn index. */
  turn: number;
  /** The full validated command that was applied. */
  command: Command;
  /** Domain events emitted by the reducer for this turn. */
  events: DomainEvent[];
  /**
   * Canonical fingerprint: deterministic JSON of the GameState **and** RNG
   * state immediately after applying this turn's command. Used by diffReplay
   * to detect divergence even when event signatures happen to match.
   */
  fingerprint: string;
  /** RNG state after this turn (serialized for comparison convenience). */
  rngAfter: RngState;
};

// ── Replay ────────────────────────────────────────────────────────────────────

export type ReplayResult = {
  state: GameState;
  rng: RngState;
  journal: TurnSnapshot[];
};

/**
 * Replay a sequence of commands against initialState / initialRng.
 * Pure and deterministic — same inputs always yield same outputs.
 */
export function replay(
  initialState: GameState,
  initialRng: RngState,
  commands: Command[],
): ReplayResult {
  let state = initialState;
  let rng = initialRng;
  const journal: TurnSnapshot[] = [];

  for (let turn = 0; turn < commands.length; turn++) {
    const command = commands[turn]!;
    const result = applyCommand(state, command, rng);
    state = result.state;
    rng = result.rng;

    journal.push({
      turn,
      command,
      events: result.events,
      // Fingerprint covers both state and RNG so any downstream divergence is
      // visible even when events look identical.
      fingerprint: JSON.stringify({ state, rng }),
      rngAfter: rng,
    });
  }

  return { state, rng, journal };
}

// ── Divergence detection ──────────────────────────────────────────────────────

export type DivergenceReport =
  | { diverged: false }
  | {
      diverged: true;
      firstDivergingTurn: number;
      commandType: string;
      /** Fingerprint from replay A at the first diverging turn. */
      fingerprintA: string;
      /** Fingerprint from replay B at the first diverging turn. */
      fingerprintB: string;
      message: string;
    };

/**
 * Compare two replay results turn-by-turn using canonical state+RNG
 * fingerprints and return the first turn at which they diverge.
 *
 * This reliably catches divergence that would be invisible when only event
 * signatures are compared (e.g. two runs where distance-variance numbers
 * differ but both emit the same event types).
 */
export function diffReplay(a: ReplayResult, b: ReplayResult): DivergenceReport {
  const maxTurns = Math.max(a.journal.length, b.journal.length);

  for (let t = 0; t < maxTurns; t++) {
    const snapA = a.journal[t];
    const snapB = b.journal[t];

    // A turn that exists in one replay but not the other is a divergence.
    if (snapA === undefined || snapB === undefined) {
      const existingSnap = (snapA ?? snapB)!;
      return {
        diverged: true,
        firstDivergingTurn: t,
        commandType: existingSnap.command.type,
        fingerprintA: snapA?.fingerprint ?? "(missing)",
        fingerprintB: snapB?.fingerprint ?? "(missing)",
        message: `Replay diverged at turn ${t}: one replay has no entry (lengths ${a.journal.length} vs ${b.journal.length}).`,
      };
    }

    if (snapA.fingerprint !== snapB.fingerprint) {
      return {
        diverged: true,
        firstDivergingTurn: t,
        commandType: snapA.command.type,
        fingerprintA: snapA.fingerprint,
        fingerprintB: snapB.fingerprint,
        message: `Replay diverged at turn ${t} (command: ${snapA.command.type}). State+RNG fingerprints differ.`,
      };
    }
  }

  return { diverged: false };
}
