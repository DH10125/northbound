/**
 * Player and party schemas.
 */

import { z } from "zod";
import { AttributesSchema, MetersSchema } from "./meters";
import { CompanionIdSchema, ItemIdSchema, OccupationIdSchema, TransportIdSchema } from "./ids";

// ── Player character ──────────────────────────────────────────────────────────

export const PronounsSchema = z.enum(["they/them", "she/her", "he/him", "custom"]);

export const AgeRangeSchema = z.enum(["teen", "young-adult", "adult", "middle-age", "older"]);

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
  /** IDs of items currently worn/equipped on body (subset of inventory). */
  equippedItemIds: z.array(ItemIdSchema),
  /** Long-term consequences from the condition model. */
  conditions: z.array(z.string()),
});

export type Player = z.infer<typeof PlayerSchema>;

// ── Companion ─────────────────────────────────────────────────────────────────

export const CompanionStatusSchema = z.enum(["active", "separated", "dead", "left"]);

export const CompanionStateSchema = z.object({
  id: CompanionIdSchema,
  name: z.string().min(1).max(64),
  status: CompanionStatusSchema,
  attributes: AttributesSchema,
  meters: MetersSchema,
  morale: z.number().int().min(0).max(100),
  loyalty: z.number().int().min(0).max(100),
  fear: z.number().int().min(0).max(100),
  /** IDs of items this companion carries. */
  carriedItemIds: z.array(ItemIdSchema),
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
  /** Active transport the party is using, if any. */
  activeTransportId: TransportIdSchema.nullable(),
});

export type Party = z.infer<typeof PartySchema>;
