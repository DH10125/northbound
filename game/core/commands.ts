/**
 * Command schemas — validated player intent.
 *
 * Commands express what the player wants to do.  They are validated at the
 * boundary (before entering the reducer) using Zod.  An invalid command must
 * never mutate state.
 *
 * Commands are serializable (plain JSON), deterministic, and carry no
 * wall-clock time, random values, or React/browser imports.
 */

import { z } from "zod";

import { EdgeIdSchema } from "../schemas/ids";

// ── Individual commands ───────────────────────────────────────────────────────

/**
 * Choose a route (edge) to travel along from the current node.
 */
export const ChooseRouteCommandSchema = z
  .object({
    type: z.literal("CHOOSE_ROUTE"),
    edgeId: EdgeIdSchema,
  })
  .strict();

/**
 * Advance the party along the route by one travel segment.
 * `turnsToTravel` defaults to 1 if omitted; must be 1–8.
 */
export const TravelCommandSchema = z
  .object({
    type: z.literal("TRAVEL"),
    turnsToTravel: z.number().int().min(1).max(8).default(1),
  })
  .strict();

/**
 * Rest in place for a number of hours (2–6).
 * Matches the canonical turn-clock contract: every turn is 2–6 hours.
 */
export const RestCommandSchema = z
  .object({
    type: z.literal("REST"),
    hours: z.number().int().min(2).max(6),
  })
  .strict();

/**
 * Choose an option in an active event.
 */
export const ChooseEventOptionCommandSchema = z
  .object({
    type: z.literal("CHOOSE_EVENT_OPTION"),
    eventId: z.string().min(1),
    optionId: z.string().min(1),
  })
  .strict();

/**
 * Consume an item from inventory.
 * `quantity` defaults to 1 if omitted.
 */
export const UseItemCommandSchema = z
  .object({
    type: z.literal("USE_ITEM"),
    instanceId: z.string().min(1),
    quantity: z.number().int().min(1).default(1),
  })
  .strict();

/**
 * Scavenge the current location for resources.
 */
export const ScavengeCommandSchema = z
  .object({
    type: z.literal("SCAVENGE"),
  })
  .strict();

/**
 * Transfer items between storage locations.
 */
export const TransferItemCommandSchema = z
  .object({
    type: z.literal("TRANSFER_ITEM"),
    instanceId: z.string().min(1),
    fromLocation: z.enum([
      "body",
      "backpack",
      "vehicle",
      "cache",
      "settlement",
    ]),
    toLocation: z.enum(["body", "backpack", "vehicle", "cache", "settlement"]),
    quantity: z.number().int().min(1).default(1),
  })
  .strict();

/**
 * Consume a consumable item (food, water, medicine) and apply effects.
 */
export const ConsumeItemCommandSchema = z
  .object({
    type: z.literal("CONSUME_ITEM"),
    instanceId: z.string().min(1),
  })
  .strict();

// ── Discriminated union ───────────────────────────────────────────────────────

export const CommandSchema = z.discriminatedUnion("type", [
  ChooseRouteCommandSchema,
  TravelCommandSchema,
  RestCommandSchema,
  ChooseEventOptionCommandSchema,
  UseItemCommandSchema,
  ScavengeCommandSchema,
  TransferItemCommandSchema,
  ConsumeItemCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;
export type ChooseRouteCommand = z.infer<typeof ChooseRouteCommandSchema>;
export type TravelCommand = z.infer<typeof TravelCommandSchema>;
export type RestCommand = z.infer<typeof RestCommandSchema>;
export type ChooseEventOptionCommand = z.infer<
  typeof ChooseEventOptionCommandSchema
>;
export type UseItemCommand = z.infer<typeof UseItemCommandSchema>;
export type ScavengeCommand = z.infer<typeof ScavengeCommandSchema>;
export type TransferItemCommand = z.infer<typeof TransferItemCommandSchema>;
export type ConsumeItemCommand = z.infer<typeof ConsumeItemCommandSchema>;

// ── Validation helper ─────────────────────────────────────────────────────────

/**
 * Parse and validate a command value.  Returns `{ ok: true, command }` on
 * success or `{ ok: false, error }` on failure — never throws.
 */
export function parseCommand(
  raw: unknown,
): { ok: true; command: Command } | { ok: false; error: string } {
  const result = CommandSchema.safeParse(raw);
  if (result.success) return { ok: true, command: result.data };
  return { ok: false, error: result.error.message };
}
