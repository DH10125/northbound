/**
 * Stable ID convention
 * --------------------
 * All authored content IDs use lowercase dot-separated segments:
 *   <domain>.<region-or-category>.<slug>
 *
 * Examples:
 *   event.lower-mississippi.derelict-barge
 *   item.medical.bandage
 *   node.pensacola.marina
 *   faction.river.cooperative
 *   companion.marisol
 *   transport.water.canoe
 *
 * Rules:
 *   - Segments are kebab-case: [a-z0-9-]+
 *   - At least two segments (domain.slug)
 *   - IDs are never reused after removal
 *   - IDs do not encode display copy
 *   - Top-level domains: event, item, node, faction, companion,
 *     transport, occupation, illness, farm-task, edge
 */

import { z } from "zod";

const segmentRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const segment = z.string().regex(segmentRe, "ID segment must be kebab-case [a-z0-9-]+");

export const StableIdSchema = z
  .string()
  .refine(
    (v) => {
      const parts = v.split(".");
      return parts.length >= 2 && parts.every((p) => segmentRe.test(p));
    },
    {
      message:
        "Stable ID must be at least two dot-separated kebab-case segments, e.g. item.medical.bandage",
    }
  );

/** Branded ID helpers – one per domain for type-safety at call sites. */
export const EventIdSchema = StableIdSchema.brand("EventId");
export const ItemIdSchema = StableIdSchema.brand("ItemId");
export const NodeIdSchema = StableIdSchema.brand("NodeId");
export const EdgeIdSchema = StableIdSchema.brand("EdgeId");
export const FactionIdSchema = StableIdSchema.brand("FactionId");
export const CompanionIdSchema = StableIdSchema.brand("CompanionId");
export const TransportIdSchema = StableIdSchema.brand("TransportId");
export const OccupationIdSchema = StableIdSchema.brand("OccupationId");
export const IllnessIdSchema = StableIdSchema.brand("IllnessId");
export const FlagIdSchema = segment.brand("FlagId");

export type StableId = z.infer<typeof StableIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
export type ItemId = z.infer<typeof ItemIdSchema>;
export type NodeId = z.infer<typeof NodeIdSchema>;
export type EdgeId = z.infer<typeof EdgeIdSchema>;
export type FactionId = z.infer<typeof FactionIdSchema>;
export type CompanionId = z.infer<typeof CompanionIdSchema>;
export type TransportId = z.infer<typeof TransportIdSchema>;
export type OccupationId = z.infer<typeof OccupationIdSchema>;
export type IllnessId = z.infer<typeof IllnessIdSchema>;
export type FlagId = z.infer<typeof FlagIdSchema>;
