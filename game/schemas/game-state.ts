/**
 * Versioned GameState – the top-level save envelope payload.
 *
 * Schema version is bumped on every breaking change and drives migrations
 * in game/persistence/. The version field must be the first key validated
 * so parse errors carry a precise path.
 *
 * Cross-record integrity
 * ----------------------
 * After shape validation, a superRefine pass checks referential integrity:
 *   - Transport instance IDs are globally unique.
 *   - Item instance IDs are globally unique across all storages.
 *   - party.activeTransportId must be null or reference an existing transport.
 *   - equippedItemIds / carriedItemIds must reference existing item instances.
 *   - transport cargoItemIds must reference existing item instances.
 *   - pursuit.pursuingFactionIds must reference factions present in state.
 *   - factions array must not have duplicate factionId entries.
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
  /** Runtime instance IDs of factions actively pursuing the party. */
  pursuingFactionIds: z.array(z.string()),
  /** Pursuit intensity 0–100. */
  intensity: z.number().int().min(0).max(100),
});

const RawGameStateSchema = z.object({
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

export const GameStateSchema = RawGameStateSchema.superRefine((state, ctx) => {
  // ── Collect known instance IDs ────────────────────────────────────────────

  /** All item instanceIds across all inventory storages. */
  const itemInstanceIds = new Set<string>();
  /** Duplicate item instanceIds. */
  const seenItemInstanceIds = new Set<string>();

  state.inventory.storages.forEach((storage, si) => {
    storage.items.forEach((item, ii) => {
      if (itemInstanceIds.has(item.instanceId)) {
        seenItemInstanceIds.add(item.instanceId);
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate item instanceId "${item.instanceId}"`,
          path: ["inventory", "storages", si, "items", ii, "instanceId"],
        });
      }
      itemInstanceIds.add(item.instanceId);
    });
  });

  /** All transport instanceIds. */
  const transportInstanceIds = new Set<string>();

  state.transports.forEach((transport, ti) => {
    if (transportInstanceIds.has(transport.instanceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate transport instanceId "${transport.instanceId}"`,
        path: ["transports", ti, "instanceId"],
      });
    }
    transportInstanceIds.add(transport.instanceId);
  });

  // ── Faction uniqueness ────────────────────────────────────────────────────

  const factionIds = new Set<string>();

  state.factions.forEach((faction, fi) => {
    if (factionIds.has(faction.factionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate faction entry for "${faction.factionId}"`,
        path: ["factions", fi, "factionId"],
      });
    }
    factionIds.add(faction.factionId);
  });

  // ── party.activeTransportId referential integrity ─────────────────────────

  if (
    state.party.activeTransportId !== null &&
    !transportInstanceIds.has(state.party.activeTransportId)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `party.activeTransportId "${state.party.activeTransportId}" does not reference any transport in state.transports`,
      path: ["party", "activeTransportId"],
    });
  }

  // ── equippedItemIds referential integrity ─────────────────────────────────

  state.party.player.equippedItemIds.forEach((iid, idx) => {
    if (!itemInstanceIds.has(iid)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `party.player.equippedItemIds[${idx}] "${iid}" does not reference any item instance in inventory`,
        path: ["party", "player", "equippedItemIds", idx],
      });
    }
  });

  // ── companion carriedItemIds referential integrity ────────────────────────

  state.party.companions.forEach((companion, ci) => {
    companion.carriedItemIds.forEach((iid, idx) => {
      if (!itemInstanceIds.has(iid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `party.companions[${ci}].carriedItemIds[${idx}] "${iid}" does not reference any item instance in inventory`,
          path: ["party", "companions", ci, "carriedItemIds", idx],
        });
      }
    });
  });

  // ── transport cargoItemIds referential integrity ──────────────────────────

  state.transports.forEach((transport, ti) => {
    transport.cargoItemIds.forEach((iid, idx) => {
      if (!itemInstanceIds.has(iid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `transports[${ti}].cargoItemIds[${idx}] "${iid}" does not reference any item instance in inventory`,
          path: ["transports", ti, "cargoItemIds", idx],
        });
      }
    });
  });

  // ── pursuit.pursuingFactionIds referential integrity ──────────────────────

  state.pursuit.pursuingFactionIds.forEach((fid, idx) => {
    if (!factionIds.has(fid)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `pursuit.pursuingFactionIds[${idx}] "${fid}" does not reference any faction in state.factions`,
        path: ["pursuit", "pursuingFactionIds", idx],
      });
    }
  });
});

export type GameState = z.infer<typeof GameStateSchema>;
export type PursuitState = z.infer<typeof PursuitStateSchema>;
