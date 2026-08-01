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
 *   - Each branded schema enforces its domain prefix at runtime,
 *     so EventIdSchema rejects "item.*" values, not merely brands them.
 *
 * Runtime instance IDs
 * --------------------
 * ItemInstanceId and TransportInstanceId are runtime-only identifiers that
 * distinguish individual in-game objects from one another. They are NOT
 * authored stable IDs and must NOT be confused with definition IDs.
 * Convention: "<domain>-<uuid-v4>",
 *   e.g. "item-550e8400-e29b-41d4-a716-446655440000"
 *        "transport-6ba7b810-9dad-11d1-80b4-00c04fd430c8"
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

/**
 * Build a domain-prefixed StableId schema that enforces the first segment
 * equals `domain` at runtime. This means EventIdSchema rejects "item.*" values.
 */
function prefixedStableId(domain: string) {
  return StableIdSchema.refine((v) => v.split(".")[0] === domain, {
    message: `Stable ID must start with domain "${domain}.", e.g. ${domain}.region.slug`,
  });
}

/** Branded authored-content ID helpers – one per domain. */
export const EventIdSchema = prefixedStableId("event").brand("EventId");
export const ItemIdSchema = prefixedStableId("item").brand("ItemId");
export const NodeIdSchema = prefixedStableId("node").brand("NodeId");
export const EdgeIdSchema = prefixedStableId("edge").brand("EdgeId");
export const FactionIdSchema = prefixedStableId("faction").brand("FactionId");
export const CompanionIdSchema = prefixedStableId("companion").brand("CompanionId");
export const TransportIdSchema = prefixedStableId("transport").brand("TransportId");
export const OccupationIdSchema = prefixedStableId("occupation").brand("OccupationId");
export const IllnessIdSchema = prefixedStableId("illness").brand("IllnessId");
export const FlagIdSchema = segment.brand("FlagId");

/**
 * Runtime instance IDs — distinct from authored definition IDs.
 * They are non-empty strings; convention: "<domain>-<uuid-v4>".
 */
export const ItemInstanceIdSchema = z.string().min(1).brand("ItemInstanceId");
export const TransportInstanceIdSchema = z.string().min(1).brand("TransportInstanceId");

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
export type ItemInstanceId = z.infer<typeof ItemInstanceIdSchema>;
export type TransportInstanceId = z.infer<typeof TransportInstanceIdSchema>;
