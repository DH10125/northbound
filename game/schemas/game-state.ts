/**
 * Versioned GameState – the top-level save envelope payload.
 *
 * Schema version is bumped on every breaking change and drives migrations
 * in game/persistence/. The version field must be the first key validated
 * so parse errors carry a precise path.
 */

import { z } from "zod";
import { EventHistorySchema } from "./events";
import { FactionRelationshipSchema } from "./factions";
import { FarmStateSchema } from "./farm";
import { InventorySchema } from "./inventory";
import { PartySchema } from "./party";
import { RouteLocationSchema } from "./route";
import { SettingsSchema } from "./settings";
import { TransportStateSchema } from "./transport";
import { WorldStateSchema } from "./world";

export const GAME_STATE_SCHEMA_VERSION = 1 as const;

/** Pursuit tracking (stealth/detection). */
const PursuitStateSchema = z.object({
  /** Factions actively pursuing the party. */
  pursuingFactionIds: z.array(z.string()),
  /** Pursuit intensity 0–100. */
  intensity: z.number().int().min(0).max(100),
});

export const GameStateSchema = z.object({
  /** Schema version; increment on breaking changes. Must be validated first. */
  schemaVersion: z.literal(GAME_STATE_SCHEMA_VERSION),
  /** Deterministic RNG seed for this run. */
  seed: z.string().min(1),
  /** ISO-8601 wall-clock timestamp when the run was started. */
  runStartedAt: z.string().datetime(),
  /** ISO-8601 wall-clock timestamp of the last save. */
  savedAt: z.string().datetime(),

  party: PartySchema,
  inventory: InventorySchema,
  transports: z.array(TransportStateSchema),
  location: RouteLocationSchema,
  world: WorldStateSchema,
  factions: z.array(FactionRelationshipSchema),
  eventHistory: EventHistorySchema,
  farm: FarmStateSchema,
  settings: SettingsSchema,
  pursuit: PursuitStateSchema,

  /** Run completion status. */
  runStatus: z.enum(["active", "ended-success", "ended-failure", "ended-evacuation"]),
});

export type GameState = z.infer<typeof GameStateSchema>;
export type PursuitState = z.infer<typeof PursuitStateSchema>;
