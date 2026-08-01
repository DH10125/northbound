/**
 * Transport state schema.
 *
 * instanceId is a runtime TransportInstanceId (non-empty string),
 * NOT an authored definition ID. definitionId references the authored TransportId.
 * cargoItemIds reference runtime ItemInstanceIds in the inventory.
 */

import { z } from "zod";
import { ItemInstanceIdSchema, TransportIdSchema, TransportInstanceIdSchema } from "./ids";

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
  /** Unique runtime instance ID (e.g. "transport-<uuid>"). Distinct from definitionId. */
  instanceId: TransportInstanceIdSchema,
  /** Reference to the authored transport definition ID, e.g. "transport.water.canoe". */
  definitionId: TransportIdSchema,
  mode: TransportModeSchema,
  /** 0–100. */
  condition: z.number().int().min(0).max(100),
  /** Fuel in arbitrary engine units; 0 for human/animal-powered. */
  fuel: z.number().min(0),
  /** Runtime instance IDs of items stored in/on this transport. */
  cargoItemIds: z.array(ItemInstanceIdSchema),
});

export type TransportState = z.infer<typeof TransportStateSchema>;
