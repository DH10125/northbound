/**
 * Transport state schema.
 */

import { z } from "zod";
import { ItemIdSchema, TransportIdSchema } from "./ids";

export const TransportModeSchema = z.enum([
  "foot",
  "bicycle",
  "motorcycle",
  "car",
  "pickup",
  "van",
  "horse",
  "canoe",
  "kayak",
  "jon-boat",
  "fishing-boat",
  "raft",
]);

export const TransportStateSchema = z.object({
  instanceId: z.string().min(1),
  definitionId: TransportIdSchema,
  mode: TransportModeSchema,
  /** 0–100. */
  condition: z.number().int().min(0).max(100),
  /** Fuel in arbitrary engine units; 0 for human/animal-powered. */
  fuel: z.number().min(0),
  /** Items stored in/on this transport. */
  cargoItemIds: z.array(ItemIdSchema),
});

export type TransportState = z.infer<typeof TransportStateSchema>;
