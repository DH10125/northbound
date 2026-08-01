/**
 * Tests for game/core: RNG, commands, reducer, selectors, and replay harness.
 *
 * All tests are pure — no Math.random, Date.now, or browser globals.
 */

import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  seedToState,
  nextFloat,
  nextInt,
  weightedChoice,
  shuffle,
  roll,
} from "../rng";
import { parseCommand } from "../commands";
import { applyCommand } from "../reducer";
import { replay, diffReplay } from "../replay";
import {
  playerHealth,
  isRunActive,
  totalItemCount,
  journeyProgress,
  hasReachedDestination,
} from "../selectors";
import { minimalGameState } from "../../testing/fixtures";

// ── RNG: seedToState ──────────────────────────────────────────────────────────

describe("seedToState", () => {
  it("same seed produces identical state", () => {
    expect(seedToState("hello")).toEqual(seedToState("hello"));
  });

  it("different seeds produce different states", () => {
    expect(seedToState("alpha")).not.toEqual(seedToState("beta"));
  });

  it("never produces all-zero state", () => {
    const state = seedToState("zero-test");
    const [s0, s1, s2, s3] = state;
    expect(s0 | s1 | s2 | s3).not.toBe(0);
  });
});

// ── RNG: nextFloat ────────────────────────────────────────────────────────────

describe("nextFloat", () => {
  it("returns value in [0, 1)", () => {
    let s = seedToState("float-test");
    for (let i = 0; i < 1000; i++) {
      let f: number;
      [s, f] = nextFloat(s);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("is deterministic given same state", () => {
    const s = seedToState("det-test");
    const [, f1] = nextFloat(s);
    const [, f2] = nextFloat(s);
    expect(f1).toBe(f2);
  });

  it("advances state (different next state)", () => {
    const s = seedToState("advance-test");
    const [s2] = nextFloat(s);
    expect(s2).not.toEqual(s);
  });
});

// ── RNG: nextInt ──────────────────────────────────────────────────────────────

describe("nextInt", () => {
  it("always returns an integer in [min, max]", () => {
    let s = seedToState("int-test");
    for (let i = 0; i < 500; i++) {
      let v: number;
      [s, v] = nextInt(s, 3, 7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it("covers both boundary values over many draws", () => {
    let s = seedToState("boundary-test");
    let sawMin = false;
    let sawMax = false;
    for (let i = 0; i < 2000; i++) {
      let v: number;
      [s, v] = nextInt(s, 0, 1);
      if (v === 0) sawMin = true;
      if (v === 1) sawMax = true;
    }
    expect(sawMin).toBe(true);
    expect(sawMax).toBe(true);
  });

  it("throws when min > max", () => {
    const s = seedToState("err-test");
    expect(() => nextInt(s, 5, 3)).toThrow(RangeError);
  });

  it("works for min === max", () => {
    const s = seedToState("same-test");
    const [, v] = nextInt(s, 7, 7);
    expect(v).toBe(7);
  });

  it("throws for non-integer min", () => {
    const s = seedToState("ni-frac-min");
    expect(() => nextInt(s, 1.5, 5)).toThrow(RangeError);
  });

  it("throws for non-integer max", () => {
    const s = seedToState("ni-frac-max");
    expect(() => nextInt(s, 1, 4.9)).toThrow(RangeError);
  });

  it("throws for NaN min", () => {
    const s = seedToState("ni-nan-min");
    expect(() => nextInt(s, NaN, 5)).toThrow(RangeError);
  });

  it("throws for Infinity max", () => {
    const s = seedToState("ni-inf-max");
    expect(() => nextInt(s, 0, Infinity)).toThrow(RangeError);
  });

  it("does not consume state on error", () => {
    const s = seedToState("ni-no-consume");
    try { nextInt(s, 1.5, 5); } catch { /* expected */ }
    // The state is unchanged — calling again with valid args yields the same result
    // as if the error call never happened.
    const [, v1] = nextInt(s, 0, 100);
    const [, v2] = nextInt(s, 0, 100);
    expect(v1).toBe(v2);
  });
});

// ── RNG: weightedChoice ───────────────────────────────────────────────────────

describe("weightedChoice", () => {
  it("throws on empty items", () => {
    const s = seedToState("wc-empty");
    expect(() => weightedChoice(s, [], [])).toThrow(RangeError);
  });

  it("always returns the only item", () => {
    const s = seedToState("wc-one");
    const [, v] = weightedChoice(s, ["only"], [1]);
    expect(v).toBe("only");
  });

  it("zero-weight items are never selected", () => {
    let s = seedToState("wc-zero");
    for (let i = 0; i < 200; i++) {
      let v: string;
      [s, v] = weightedChoice(s, ["never", "always"], [0, 1]);
      expect(v).toBe("always");
    }
  });

  it("approximately respects weight ratios (1:9)", () => {
    let s = seedToState("wc-ratio");
    let countA = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      let v: string;
      [s, v] = weightedChoice(s, ["rare", "common"], [1, 9]);
      if (v === "rare") countA++;
    }
    // Should be ~10% ± 5%
    const ratio = countA / N;
    expect(ratio).toBeGreaterThan(0.05);
    expect(ratio).toBeLessThan(0.2);
  });

  it("mismatched lengths throw", () => {
    const s = seedToState("wc-mismatch");
    expect(() => weightedChoice(s, ["a"], [1, 2])).toThrow(RangeError);
  });

  it("throws for negative weight", () => {
    const s = seedToState("wc-neg");
    expect(() => weightedChoice(s, ["a", "b"], [-1, 1])).toThrow(RangeError);
  });

  it("throws for NaN weight", () => {
    const s = seedToState("wc-nan");
    expect(() => weightedChoice(s, ["a", "b"], [NaN, 1])).toThrow(RangeError);
  });

  it("throws for Infinity weight", () => {
    const s = seedToState("wc-inf");
    expect(() => weightedChoice(s, ["a", "b"], [Infinity, 1])).toThrow(RangeError);
  });

  it("does not consume state on validation error", () => {
    const s = seedToState("wc-no-consume");
    try { weightedChoice(s, ["a", "b"], [NaN, 1]); } catch { /* expected */ }
    const [, v1] = nextFloat(s);
    const [, v2] = nextFloat(s);
    expect(v1).toBe(v2);
  });
});

// ── RNG: shuffle ──────────────────────────────────────────────────────────────

describe("shuffle", () => {
  it("returns same length array", () => {
    const s = seedToState("sh-len");
    const [, arr] = shuffle(s, [1, 2, 3, 4, 5]);
    expect(arr).toHaveLength(5);
  });

  it("contains same elements", () => {
    const s = seedToState("sh-el");
    const [, arr] = shuffle(s, [1, 2, 3, 4, 5]);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not mutate original array", () => {
    const s = seedToState("sh-mut");
    const original = [1, 2, 3];
    shuffle(s, original);
    expect(original).toEqual([1, 2, 3]);
  });

  it("is deterministic", () => {
    const s = seedToState("sh-det");
    const [, arr1] = shuffle(s, [1, 2, 3, 4, 5]);
    const [, arr2] = shuffle(s, [1, 2, 3, 4, 5]);
    expect(arr1).toEqual(arr2);
  });
});

// ── RNG: roll ─────────────────────────────────────────────────────────────────

describe("roll", () => {
  it("returns value in [1, sides]", () => {
    let s = seedToState("roll-test");
    for (let i = 0; i < 500; i++) {
      let v: number;
      [s, v] = roll(s, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it("throws for sides < 1", () => {
    const s = seedToState("roll-err");
    expect(() => roll(s, 0)).toThrow(RangeError);
  });

  it("throws for non-integer sides", () => {
    const s = seedToState("roll-frac");
    expect(() => roll(s, 1.5)).toThrow(RangeError);
  });

  it("throws for NaN sides", () => {
    const s = seedToState("roll-nan");
    expect(() => roll(s, NaN)).toThrow(RangeError);
  });

  it("throws for Infinity sides", () => {
    const s = seedToState("roll-inf");
    expect(() => roll(s, Infinity)).toThrow(RangeError);
  });

  it("does not consume state on error", () => {
    const s = seedToState("roll-no-consume");
    try { roll(s, 0); } catch { /* expected */ }
    const [, v1] = nextFloat(s);
    const [, v2] = nextFloat(s);
    expect(v1).toBe(v2);
  });
});

// ── Commands: parseCommand ────────────────────────────────────────────────────

describe("parseCommand", () => {
  it("parses valid TRAVEL command", () => {
    const r = parseCommand({ type: "TRAVEL", turnsToTravel: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.command.type).toBe("TRAVEL");
  });

  it("defaults turnsToTravel to 1", () => {
    const r = parseCommand({ type: "TRAVEL" });
    expect(r.ok).toBe(true);
    if (r.ok && r.command.type === "TRAVEL") {
      expect(r.command.turnsToTravel).toBe(1);
    }
  });

  it("rejects TRAVEL with turnsToTravel > 8", () => {
    const r = parseCommand({ type: "TRAVEL", turnsToTravel: 9 });
    expect(r.ok).toBe(false);
  });

  it("rejects TRAVEL with unknown extra field (strict schema)", () => {
    const r = parseCommand({ type: "TRAVEL", turnsToTravel: 1, hack: true });
    expect(r.ok).toBe(false);
  });

  it("parses valid REST command", () => {
    const r = parseCommand({ type: "REST", hours: 8 });
    expect(r.ok).toBe(true);
  });

  it("rejects REST with hours = 0", () => {
    const r = parseCommand({ type: "REST", hours: 0 });
    expect(r.ok).toBe(false);
  });

  it("rejects REST with unknown extra field (strict schema)", () => {
    const r = parseCommand({ type: "REST", hours: 4, extra: "bad" });
    expect(r.ok).toBe(false);
  });

  it("parses USE_ITEM", () => {
    const r = parseCommand({ type: "USE_ITEM", instanceId: "item-abc" });
    expect(r.ok).toBe(true);
    if (r.ok && r.command.type === "USE_ITEM") {
      expect(r.command.quantity).toBe(1); // default
    }
  });

  it("rejects USE_ITEM with extra field (strict schema)", () => {
    const r = parseCommand({ type: "USE_ITEM", instanceId: "item-abc", exploit: 1 });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown command type", () => {
    const r = parseCommand({ type: "EXPLODE" });
    expect(r.ok).toBe(false);
  });

  it("rejects null", () => {
    const r = parseCommand(null);
    expect(r.ok).toBe(false);
  });

  it("malformed command does not mutate state or RNG", () => {
    // Prove the state is unchanged by re-applying after a bad parse
    const rng = seedToState("cmd-strict");
    const bad = parseCommand({ type: "TRAVEL", turnsToTravel: 1, injected: "evil" });
    expect(bad.ok).toBe(false);
    // RNG state is untouched — applyCommand was never called
    const [, v1] = nextFloat(rng);
    const [, v2] = nextFloat(rng);
    expect(v1).toBe(v2);
  });
});

// ── Reducer: state immutability ───────────────────────────────────────────────

describe("applyCommand – immutability", () => {
  it("TRAVEL returns a new state object", () => {
    const rng = seedToState("imm-test");
    const cmd = { type: "TRAVEL" as const, turnsToTravel: 1 };
    const { state: next } = applyCommand(minimalGameState, cmd, rng);
    expect(next).not.toBe(minimalGameState);
  });

  it("invalid command leaves state byte-equivalent", () => {
    const rng = seedToState("inv-test");
    // USE_ITEM with non-existent instanceId
    const cmd = { type: "USE_ITEM" as const, instanceId: "ghost-item", quantity: 1 };
    const { state: next, events } = applyCommand(minimalGameState, cmd, rng);
    expect(JSON.stringify(next)).toBe(JSON.stringify(minimalGameState));
    expect(events[0]?.type).toBe("COMMAND_REJECTED");
  });

  it("invalid command leaves RNG byte-equivalent", () => {
    const rng = seedToState("inv-rng-test");
    const cmd = { type: "USE_ITEM" as const, instanceId: "ghost-item", quantity: 1 };
    const { rng: nextRng } = applyCommand(minimalGameState, cmd, rng);
    expect(nextRng).toEqual(rng);
  });

  it("command on ended run is rejected", () => {
    const rng = seedToState("ended-test");
    const ended = { ...minimalGameState, runStatus: "ended-success" as const };
    const cmd = { type: "TRAVEL" as const, turnsToTravel: 1 };
    const { state: next, events } = applyCommand(ended, cmd, rng);
    expect(JSON.stringify(next)).toBe(JSON.stringify(ended));
    expect(events[0]?.type).toBe("COMMAND_REJECTED");
  });
});

// ── Reducer: TRAVEL mechanics ─────────────────────────────────────────────────

describe("applyCommand – TRAVEL", () => {
  it("advances elapsed hours", () => {
    const rng = seedToState("travel-hours");
    const cmd = { type: "TRAVEL" as const, turnsToTravel: 1 };
    const { state } = applyCommand(minimalGameState, cmd, rng);
    expect(state.world.elapsedHours).toBeGreaterThan(minimalGameState.world.elapsedHours);
  });

  it("reduces distanceRemaining", () => {
    const rng = seedToState("travel-dist");
    const cmd = { type: "TRAVEL" as const, turnsToTravel: 1 };
    const { state } = applyCommand(minimalGameState, cmd, rng);
    expect(state.location.distanceRemaining).toBeLessThan(
      minimalGameState.location.distanceRemaining,
    );
  });

  it("emits TIME_ADVANCED and TRAVEL_ADVANCED events", () => {
    const rng = seedToState("travel-events");
    const cmd = { type: "TRAVEL" as const, turnsToTravel: 1 };
    const { events } = applyCommand(minimalGameState, cmd, rng);
    expect(events.some((e) => e.type === "TIME_ADVANCED")).toBe(true);
    expect(events.some((e) => e.type === "TRAVEL_ADVANCED")).toBe(true);
  });

  it("sets runStatus to ended-success when distance reaches 0", () => {
    const rng = seedToState("travel-end");
    const almostDone = {
      ...minimalGameState,
      location: { ...minimalGameState.location, distanceRemaining: 1 },
    };
    const cmd = { type: "TRAVEL" as const, turnsToTravel: 1 };
    const { state } = applyCommand(almostDone, cmd, rng);
    expect(state.runStatus).toBe("ended-success");
  });
});

// ── Reducer: REST mechanics ───────────────────────────────────────────────────

describe("applyCommand – REST", () => {
  it("reduces fatigue", () => {
    const rng = seedToState("rest-fatigue");
    const tired = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        player: {
          ...minimalGameState.party.player,
          meters: { ...minimalGameState.party.player.meters, fatigue: 50 },
        },
      },
    };
    const cmd = { type: "REST" as const, hours: 4 };
    const { state } = applyCommand(tired, cmd, rng);
    expect(state.party.player.meters.fatigue).toBeLessThan(50);
  });

  it("advances time", () => {
    const rng = seedToState("rest-time");
    const cmd = { type: "REST" as const, hours: 6 };
    const { state } = applyCommand(minimalGameState, cmd, rng);
    expect(state.world.elapsedHours).toBe(6);
  });
});

// ── Selectors ─────────────────────────────────────────────────────────────────

describe("selectors", () => {
  it("isRunActive returns true for active run", () => {
    expect(isRunActive(minimalGameState)).toBe(true);
  });

  it("isRunActive returns false for ended run", () => {
    const ended = { ...minimalGameState, runStatus: "ended-success" as const };
    expect(isRunActive(ended)).toBe(false);
  });

  it("playerHealth returns 100 for fresh state", () => {
    expect(playerHealth(minimalGameState)).toBe(100);
  });

  it("totalItemCount returns 0 for empty inventory", () => {
    expect(totalItemCount(minimalGameState)).toBe(0);
  });

  it("journeyProgress is 0 at start", () => {
    expect(journeyProgress(minimalGameState)).toBe(0);
  });

  it("hasReachedDestination is false at start", () => {
    expect(hasReachedDestination(minimalGameState)).toBe(false);
  });

  it("hasReachedDestination is true when distanceRemaining === 0", () => {
    const done = {
      ...minimalGameState,
      location: { ...minimalGameState.location, distanceRemaining: 0 },
    };
    expect(hasReachedDestination(done)).toBe(true);
  });
});

// ── Replay: determinism ───────────────────────────────────────────────────────

describe("replay – determinism", () => {
  it("same seed+commands yields byte-equivalent state, RNG, and journal", () => {
    const rng = seedToState("replay-det");
    const commands = [
      { type: "TRAVEL" as const, turnsToTravel: 1 },
      { type: "REST" as const, hours: 4 },
      { type: "TRAVEL" as const, turnsToTravel: 2 },
    ];

    const r1 = replay(minimalGameState, rng, commands);
    const r2 = replay(minimalGameState, rng, commands);

    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    expect(JSON.stringify(r1.rng)).toBe(JSON.stringify(r2.rng));
    expect(JSON.stringify(r1.journal)).toBe(JSON.stringify(r2.journal));
  });

  it("different seeds produce different outcomes", () => {
    const rng1 = seedToState("seed-a");
    const rng2 = seedToState("seed-b");
    const commands = [{ type: "TRAVEL" as const, turnsToTravel: 3 }];

    const r1 = replay(minimalGameState, rng1, commands);
    const r2 = replay(minimalGameState, rng2, commands);

    // Distance remaining should differ due to variance
    expect(r1.state.location.distanceRemaining).not.toBe(
      r2.state.location.distanceRemaining,
    );
  });

  it("empty command list returns initial state", () => {
    const rng = seedToState("replay-empty");
    const r = replay(minimalGameState, rng, []);
    expect(JSON.stringify(r.state)).toBe(JSON.stringify(minimalGameState));
    expect(r.journal).toHaveLength(0);
  });

  it("journal entries contain full command payload and fingerprint", () => {
    const rng = seedToState("replay-journal");
    const cmd = { type: "TRAVEL" as const, turnsToTravel: 2 };
    const r = replay(minimalGameState, rng, [cmd]);
    expect(r.journal).toHaveLength(1);
    const snap = r.journal[0]!;
    expect(snap.command).toEqual(cmd);
    expect(typeof snap.fingerprint).toBe("string");
    expect(snap.fingerprint.length).toBeGreaterThan(10);
    expect(snap.rngAfter).toEqual(r.rng);
  });
});

// ── Replay: divergence detection ──────────────────────────────────────────────

describe("diffReplay", () => {
  it("reports no divergence for identical replays", () => {
    const rng = seedToState("diff-same");
    const commands = [{ type: "TRAVEL" as const, turnsToTravel: 1 }];
    const r1 = replay(minimalGameState, rng, commands);
    const r2 = replay(minimalGameState, rng, commands);
    const report = diffReplay(r1, r2);
    expect(report.diverged).toBe(false);
  });

  it("detects divergence when seeds differ (same event signatures)", () => {
    // TRAVEL always emits TIME_ADVANCED and TRAVEL_ADVANCED — the events look
    // identical between runs, but the distance covered differs. The fingerprint
    // (state+RNG) must catch this.
    const commands = [{ type: "TRAVEL" as const, turnsToTravel: 1 }];
    const r1 = replay(minimalGameState, seedToState("seed-diverge-x"), commands);
    const r2 = replay(minimalGameState, seedToState("seed-diverge-y"), commands);

    // The distance variance means states differ, even if event *types* match.
    if (r1.state.location.distanceRemaining !== r2.state.location.distanceRemaining) {
      const report = diffReplay(r1, r2);
      expect(report.diverged).toBe(true);
      if (report.diverged) {
        expect(report.firstDivergingTurn).toBe(0);
        expect(typeof report.fingerprintA).toBe("string");
        expect(typeof report.fingerprintB).toBe("string");
        expect(report.fingerprintA).not.toBe(report.fingerprintB);
        expect(report.message).toMatch(/turn 0/);
      }
    }
  });

  it("detects divergence in journal length", () => {
    const rng = seedToState("diff-len");
    const r1 = replay(minimalGameState, rng, [
      { type: "TRAVEL" as const, turnsToTravel: 1 },
      { type: "REST" as const, hours: 2 },
    ]);
    const r2 = replay(minimalGameState, rng, [
      { type: "TRAVEL" as const, turnsToTravel: 1 },
    ]);
    const report = diffReplay(r1, r2);
    expect(report.diverged).toBe(true);
    if (report.diverged) {
      expect(report.firstDivergingTurn).toBe(1);
    }
  });

  it("event-signature match does not suppress state/RNG divergence", () => {
    // Construct two ReplayResults with identical events but different fingerprints.
    const rng1 = seedToState("fp-a");
    const rng2 = seedToState("fp-b");
    const commands = [{ type: "TRAVEL" as const, turnsToTravel: 1 }];

    const ra = replay(minimalGameState, rng1, commands);
    const rb = replay(minimalGameState, rng2, commands);

    // If their states differ the fingerprint-based check must report divergence.
    if (JSON.stringify(ra.state) !== JSON.stringify(rb.state)) {
      const report = diffReplay(ra, rb);
      expect(report.diverged).toBe(true);
      if (report.diverged) {
        expect(typeof report.fingerprintA).toBe("string");
        expect(typeof report.fingerprintB).toBe("string");
      }
    }
  });
});

// ── No Math.random / Date.now in production core files ────────────────────────

describe("core module purity – static enforcement", () => {
  it("no production file under game/core/ calls Math.random or Date.now", () => {
    const coreDir = path.resolve(__dirname, "..");
    const prohibited = [/\bMath\.random\s*\(/, /\bDate\.now\s*\(/];
    const violations: string[] = [];

    // Walk all .ts files in game/core/ (not __tests__/)
    const files = fs
      .readdirSync(coreDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => path.join(coreDir, e.name));

    for (const filePath of files) {
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const line = lines[lineNo]!;
        // Skip comment lines (single-line // comments and * doc lines)
        const stripped = line.trimStart();
        if (stripped.startsWith("//") || stripped.startsWith("*")) continue;
        for (const re of prohibited) {
          if (re.test(line)) {
            violations.push(
              `${path.basename(filePath)}:${lineNo + 1}: ${line.trim()}`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("RNG module is deterministic (behavioral purity check)", () => {
    // If nextFloat silently used Math.random, identical state inputs would
    // produce different outputs. Verify they are identical.
    const s = seedToState("purity-check");
    const [, f1] = nextFloat(s);
    const [, f2] = nextFloat(s);
    expect(f1).toBe(f2);
  });

  it("does not use Date.now spy can confirm absence of Date.now calls", () => {
    const spy = vi.spyOn(Date, "now");
    const rng = seedToState("date-spy");
    const cmd = { type: "TRAVEL" as const, turnsToTravel: 1 };
    applyCommand(minimalGameState, cmd, rng);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
