/**
 * Inventory and storage schemas.
 *
 * instanceId fields are runtime ItemInstanceId values (non-empty strings),
 * NOT authored definition IDs. definitionId references the authored ItemId.
 */

import { z } from "zod";
import { ItemInstanceIdSchema, ItemIdSchema, NodeIdSchema } from "./ids";

// ── Item instance ─────────────────────────────────────────────────────────────

export const ItemInstanceSchema = z.object({
  /** Unique runtime instance ID (e.g. "item-<uuid>"). Distinct from definitionId. */
  instanceId: ItemInstanceIdSchema,
  /** Reference to the authored item definition ID, e.g. "item.medical.bandage". */
  definitionId: ItemIdSchema,
  /** Quantity in stack. */
  quantity: z.number().int().min(1),
  /** 0–100; 100 = pristine. */
  condition: z.number().int().min(0).max(100),
  /** ISO-8601 string if perishable, else undefined. */
  expiresAt: z.string().datetime().optional(),
  /** Contamination level for water/food. */
  contamination: z.number().int().min(0).max(100).optional(),
});

export type ItemInstance = z.infer<typeof ItemInstanceSchema>;

// ── Storage locations ─────────────────────────────────────────────────────────

export const StorageLocationSchema = z.enum([
  "body",
  "backpack",
  "vehicle",
  "cache",
  "settlement",
]);

export const StorageSchema = z.object({
  location: StorageLocationSchema,
  /** Node where this cache/settlement storage lives, if applicable. */
  nodeId: NodeIdSchema.optional(),
  items: z.array(ItemInstanceSchema),
});

export type Storage = z.infer<typeof StorageSchema>;

export const InventorySchema = z.object({
  storages: z.array(StorageSchema),
});

export type Inventory = z.infer<typeof InventorySchema>;
