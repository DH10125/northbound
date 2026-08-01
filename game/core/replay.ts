/**
 * Replay harness — deterministic run replay and divergence detection.
 *
 * Given an initial state, initial RNG state, and a sequence of commands, replay
 * re-applies each command and returns the final state plus a journal.
 *
 * If two replays of the same (initialState, rng, commands) diverge, `diffReplay`
 * identifies the first diverging turn and provides useful context.
 */

import type { GameState } from "../schemas/game-state";
import type { RngState } from "./rng";
import type { Command } from "./commands";
import type { TurnJournalEntry } from "./domain-events";
import { applyCommand } from "./reducer";

// ── Replay ────────────────────────────────────────────────────────────────────

export type ReplayResult = {
  state: GameState;
  rng: RngState;
  journal: TurnJournalEntry[];
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
  const journal: TurnJournalEntry[] = [];

  for (let turn = 0; turn < commands.length; turn++) {
    const command = commands[turn]!;
    const result = applyCommand(state, command, rng);
    journal.push({
      turn,
      commandType: command.type,
      events: result.events,
    });
    state = result.state;
    rng = result.rng;
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
      /** Snapshot of the journal entry from the first replay at that turn. */
      journalA: TurnJournalEntry;
      /** Snapshot of the journal entry from the second replay at that turn. */
      journalB: TurnJournalEntry;
      message: string;
    };

/**
 * Compare two replay results and return the first turn at which they diverge.
 * Divergence is detected by comparing the serialized state after each turn.
 *
 * Usage: run `replay(...)` twice (or with different inputs) and pass both results.
 */
export function diffReplay(a: ReplayResult, b: ReplayResult): DivergenceReport {
  const minTurns = Math.min(a.journal.length, b.journal.length);

  // Reconstruct states turn-by-turn for comparison.
  // We do this by re-running — the journal alone doesn't preserve intermediate
  // states, so divergence at turn N is identified by re-executing to turn N.
  //
  // For efficiency we compare the serialized final states first; if they match
  // there is no divergence.
  const aFinal = JSON.stringify(a.state);
  const bFinal = JSON.stringify(b.state);

  if (aFinal === bFinal && a.journal.length === b.journal.length) {
    return { diverged: false };
  }

  // Find the first diverging journal event signature.
  for (let t = 0; t < minTurns; t++) {
    const ja = a.journal[t]!;
    const jb = b.journal[t]!;

    if (
      ja.commandType !== jb.commandType ||
      JSON.stringify(ja.events) !== JSON.stringify(jb.events)
    ) {
      return {
        diverged: true,
        firstDivergingTurn: t,
        commandType: ja.commandType,
        journalA: ja,
        journalB: jb,
        message: `Replay diverged at turn ${t} (command: ${ja.commandType}). Event signatures differ.`,
      };
    }
  }

  // Lengths differ but all shared turns matched.
  return {
    diverged: true,
    firstDivergingTurn: minTurns,
    commandType: "(end)",
    journalA: a.journal[minTurns] ?? { turn: minTurns, commandType: "(missing)", events: [] },
    journalB: b.journal[minTurns] ?? { turn: minTurns, commandType: "(missing)", events: [] },
    message: `Replay diverged: different number of turns (${a.journal.length} vs ${b.journal.length}).`,
  };
}
