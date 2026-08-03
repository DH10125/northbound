/**
 * Save/resume helpers — versioned, validated persistence.
 *
 * Provides safe read/write of game save data with:
 *   - Schema validation on load (rejects corrupt/incomplete data)
 *   - Version tracking for future migrations
 *   - Typed results (no unguarded raw access)
 *   - Graceful handling of missing/corrupt/quota-exceeded saves
 *
 * Pure logic is separated from storage I/O so the validation can be tested
 * without a browser environment.
 */

import { z } from "zod";
import { GameStateSchema } from "../schemas/game-state";
import type { GameState } from "../schemas/game-state";
import type { RngState } from "./rng";

// RNG state is a 4-element tuple of uint32 values
const RngStateSchema = z.tuple([
  z.number().int().min(0),
  z.number().int().min(0),
  z.number().int().min(0),
  z.number().int().min(0),
]);

// ── Save envelope schema ──────────────────────────────────────────────────────

export const SAVE_VERSION = 1;

export const SaveEnvelopeSchema = z.object({
  version: z.literal(SAVE_VERSION),
  state: GameStateSchema,
  rng: RngStateSchema,
  savedAt: z.string().min(1),
});

export type SaveEnvelope = z.infer<typeof SaveEnvelopeSchema>;

// ── Serialize ────────────────────────────────────────────────────────────────

export function serializeSave(state: GameState, rng: RngState): string {
  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    state,
    rng,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(envelope);
}

// ── Deserialize & validate ───────────────────────────────────────────────────

export type LoadResult =
  | { ok: true; state: GameState; rng: RngState; savedAt: string }
  | { ok: false; reason: string };

export function deserializeSave(raw: string | null | undefined): LoadResult {
  if (!raw) {
    return { ok: false, reason: "No save data found" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Save data is not valid JSON" };
  }

  // Handle legacy saves (no version field) for backwards compatibility
  if (
    parsed &&
    typeof parsed === "object" &&
    !("version" in parsed) &&
    "state" in parsed &&
    "rng" in parsed
  ) {
    const legacyResult = z
      .object({ state: GameStateSchema, rng: RngStateSchema })
      .safeParse(parsed);
    if (legacyResult.success) {
      return {
        ok: true,
        state: legacyResult.data.state,
        rng: legacyResult.data.rng,
        savedAt: "unknown",
      };
    }
    return {
      ok: false,
      reason: `Legacy save validation failed: ${legacyResult.error.issues[0]?.message ?? "unknown"}`,
    };
  }

  const result = SaveEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      reason: `Save validation failed: ${result.error.issues[0]?.message ?? "unknown"}`,
    };
  }

  return {
    ok: true,
    state: result.data.state,
    rng: result.data.rng,
    savedAt: result.data.savedAt,
  };
}

// ── Storage key ──────────────────────────────────────────────────────────────

export const SAVE_KEY = "northbound-save";

// ── Browser storage helpers (thin wrappers) ──────────────────────────────────

export function writeSave(
  storage: Pick<Storage, "setItem">,
  state: GameState,
  rng: RngState,
): { ok: true } | { ok: false; reason: string } {
  try {
    storage.setItem(SAVE_KEY, serializeSave(state, rng));
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Storage write failed",
    };
  }
}

export function readSave(storage: Pick<Storage, "getItem">): LoadResult {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return deserializeSave(raw);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Storage read failed",
    };
  }
}

export function clearSave(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(SAVE_KEY);
}
