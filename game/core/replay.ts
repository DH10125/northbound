/**
 * Replay harness — deterministic run replay and divergence detection.
 *
 * Given an initial state, initial RNG state, and a sequence of commands, replay
 * re-applies each command and returns the final state plus a journal.
 *
 * Each journal entry carries a canonical turn record covering command payload,
 * emitted events, and a state+RNG fingerprint after the turn. `diffReplay`
 * compares the full turn record so divergence is detected even when fingerprints
 * happen to match but commands or events differ, or vice-versa.
 *
 * An initial snapshot (before any commands) is also computed so zero-command
 * divergence (different initial state or RNG) is correctly reported.
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
   * Canonical state+RNG fingerprint immediately after this turn.
   * Deterministic JSON — same state and RNG always produce the same string.
   */
  fingerprint: string;
  /** RNG state after this turn (for direct comparison convenience). */
  rngAfter: RngState;
};

/**
 * Full deterministic turn record used for comparison.
 * Covers command, events, AND fingerprint so any discrepancy is caught.
 */
function turnRecord(snap: TurnSnapshot): string {
  return JSON.stringify({
    command: snap.command,
    events: snap.events,
    fingerprint: snap.fingerprint,
  });
}

// ── Replay ────────────────────────────────────────────────────────────────────

export type ReplayResult = {
  state: GameState;
  rng: RngState;
  /**
   * Canonical fingerprint of the initial state+RNG (before any commands).
   * Used by diffReplay to detect divergence when there are zero turns.
   */
  initialFingerprint: string;
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
  const initialFingerprint = JSON.stringify({ state, rng });
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
      fingerprint: JSON.stringify({ state, rng }),
      rngAfter: rng,
    });
  }

  return { state, rng, initialFingerprint, journal };
}

// ── Divergence detection ──────────────────────────────────────────────────────

export type DivergenceReport =
  | { diverged: false }
  | {
      diverged: true;
      /** 0-based index of the first diverging turn, or -1 for initial state. */
      firstDivergingTurn: number;
      commandType: string;
      /** Full turn record (command+events+fingerprint) from replay A. */
      turnRecordA: string;
      /** Full turn record (command+events+fingerprint) from replay B. */
      turnRecordB: string;
      message: string;
    };

/**
 * Compare two replay results and return the first point at which they diverge.
 *
 * Comparison order:
 *   1. Initial state+RNG (turn index -1) — catches zero-command divergence.
 *   2. Each turn's full record: command payload, emitted events, AND
 *      state+RNG fingerprint. A discrepancy in any field is a divergence.
 *   3. If all shared turns match but lengths differ, report the extra turn.
 *
 * This catches all of:
 *   - Same event signatures but different state/RNG.
 *   - Same fingerprints but different commands or events.
 *   - Different initial states with zero commands.
 */
export function diffReplay(a: ReplayResult, b: ReplayResult): DivergenceReport {
  // ── 1. Check initial state+RNG ──
  if (a.initialFingerprint !== b.initialFingerprint) {
    return {
      diverged: true,
      firstDivergingTurn: -1,
      commandType: "(initial)",
      turnRecordA: a.initialFingerprint,
      turnRecordB: b.initialFingerprint,
      message: "Replay diverged: initial state or RNG differs before any command.",
    };
  }

  // ── 2. Compare each turn's full record ──
  const maxTurns = Math.max(a.journal.length, b.journal.length);

  for (let t = 0; t < maxTurns; t++) {
    const snapA = a.journal[t];
    const snapB = b.journal[t];

    if (snapA === undefined || snapB === undefined) {
      const existing = (snapA ?? snapB)!;
      return {
        diverged: true,
        firstDivergingTurn: t,
        commandType: existing.command.type,
        turnRecordA: snapA ? turnRecord(snapA) : "(missing)",
        turnRecordB: snapB ? turnRecord(snapB) : "(missing)",
        message: `Replay diverged at turn ${t}: replay lengths differ (${a.journal.length} vs ${b.journal.length}). Command: ${existing.command.type}.`,
      };
    }

    const recA = turnRecord(snapA);
    const recB = turnRecord(snapB);
    if (recA !== recB) {
      return {
        diverged: true,
        firstDivergingTurn: t,
        commandType: snapA.command.type,
        turnRecordA: recA,
        turnRecordB: recB,
        message: `Replay diverged at turn ${t} (command: ${snapA.command.type}). Command, events, or state+RNG fingerprint differs.`,
      };
    }
  }

  return { diverged: false };
}
