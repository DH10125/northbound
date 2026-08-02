/**
 * Player and party schemas.
 *
 * equippedItemIds and companion carriedItemIds hold runtime ItemInstanceIds
 * referencing items present in inventory, NOT authored definition IDs.
 * activeTransportId holds a runtime TransportInstanceId referencing a
 * transport in the transports array, NOT a definition ID.
 */

import { z } from "zod";
import { AttributesSchema, MetersSchema } from "./meters";
import {
  CompanionIdSchema,
  ItemInstanceIdSchema,
  OccupationIdSchema,
  TransportInstanceIdSchema,
} from "./ids";
import { ActiveConditionSchema, PermanentModifierSchema } from "./conditions";

// ── Player character ──────────────────────────────────────────────────────────

export const PronounsSchema = z.enum([
  "they/them",
  "she/her",
  "he/him",
  "custom",
]);

export const AgeRangeSchema = z.enum([
  "teen",
  "young-adult",
  "adult",
  "middle-age",
  "older",
]);

export const PlayerSchema = z.object({
  name: z.string().min(1).max(64),
  pronouns: PronounsSchema,
  customPronouns: z.string().max(32).optional(),
  ageRange: AgeRangeSchema,
  /** Index into an allow-listed portrait/silhouette set; does not encode identity. */
  portraitIndex: z.number().int().min(0),
  occupationId: OccupationIdSchema,
  motivation: z.string().max(256),
  weakness: z.string().max(256),
  attributes: AttributesSchema,
  meters: MetersSchema,
  /** Runtime instance IDs of items currently worn/equipped (subset of inventory). */
  equippedItemIds: z.array(ItemInstanceIdSchema),
  /** Active conditions (illness/injury in progress). */
  conditions: z.array(ActiveConditionSchema),
  /** Permanent modifiers from past conditions. */
  permanentModifiers: z.array(PermanentModifierSchema),
});

export type Player = z.infer<typeof PlayerSchema>;

// ── Companion ─────────────────────────────────────────────────────────────────

export const CompanionStatusSchema = z.enum([
  "active",
  "separated",
  "dead",
  "left",
]);

export const CompanionStateSchema = z.object({
  id: CompanionIdSchema,
  name: z.string().min(1).max(64),
  status: CompanionStatusSchema,
  attributes: AttributesSchema,
  meters: MetersSchema,
  morale: z.number().int().min(0).max(100),
  loyalty: z.number().int().min(0).max(100),
  fear: z.number().int().min(0).max(100),
  /** Runtime instance IDs of items this companion carries (subset of inventory). */
  carriedItemIds: z.array(ItemInstanceIdSchema),
  /** Pairwise relationship scores keyed by other companion id. */
  relationships: z.record(z.string(), z.number().int().min(-100).max(100)),
  /** Flags for hidden traits or story state. */
  flags: z.array(z.string()),
});

export type CompanionState = z.infer<typeof CompanionStateSchema>;

// ── Party ─────────────────────────────────────────────────────────────────────

export const PartySchema = z.object({
  player: PlayerSchema,
  companions: z.array(CompanionStateSchema),
  /** Runtime instance ID of the active transport, or null if on foot. */
  activeTransportId: TransportInstanceIdSchema.nullable(),
});

export type Party = z.infer<typeof PartySchema>;
