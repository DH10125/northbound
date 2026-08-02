/**
 * Inventory engine — capacity, transfers, spoilage, and selectors.
 *
 * Pure, deterministic, no React/browser dependencies.
 */

import type { GameState } from "../schemas/game-state";
import type { ItemInstance } from "../schemas/inventory";
import type { Storage } from "../schemas/inventory";
import type { ItemId, ItemInstanceId } from "../schemas/ids";
import { getItemDefinition } from "../content/items";

import type { StorageLocation } from "./inventory-types";

export type { StorageLocation };

// ── Capacity limits per storage location ─────────────────────────────────────

/** Weight capacity in kg per storage location. */
export const WEIGHT_CAPACITY: Record<StorageLocation, number> = {
  body: 10,
  backpack: 25,
  vehicle: 200,
  cache: 500,
  settlement: 1000,
};

/** Volume capacity in liters per storage location. */
export const VOLUME_CAPACITY: Record<StorageLocation, number> = {
  body: 5,
  backpack: 40,
  vehicle: 300,
  cache: 500,
  settlement: 2000,
};

// ── Selectors ────────────────────────────────────────────────────────────────

/** Total weight in a single storage. */
export function storageWeight(storage: Storage): number {
  return storage.items.reduce((sum, item) => {
    const def = getItemDefinition(item.definitionId as ItemId);
    return sum + (def ? def.weight * item.quantity : 0);
  }, 0);
}

/** Total volume in a single storage. */
export function storageVolume(storage: Storage): number {
  return storage.items.reduce((sum, item) => {
    const def = getItemDefinition(item.definitionId as ItemId);
    return sum + (def ? def.volume * item.quantity : 0);
  }, 0);
}

/** Total weight across all carried storages (body + backpack). */
export function carriedWeight(state: GameState): number {
  return state.inventory.storages
    .filter((s) => s.location === "body" || s.location === "backpack")
    .reduce((sum, s) => sum + storageWeight(s), 0);
}

/** Total noise contribution from all carried items. */
export function carriedNoise(state: GameState): number {
  return state.inventory.storages
    .filter((s) => s.location === "body" || s.location === "backpack")
    .reduce((sum, storage) => {
      return (
        sum +
        storage.items.reduce((acc, item) => {
          const def = getItemDefinition(item.definitionId as ItemId);
          return acc + (def ? def.noise * item.quantity : 0);
        }, 0)
      );
    }, 0);
}

/** Whether a storage location is over weight capacity. */
export function isOverWeight(storage: Storage): boolean {
  const cap = WEIGHT_CAPACITY[storage.location as StorageLocation];
  return cap !== undefined && storageWeight(storage) > cap;
}

/** Whether a storage location is over volume capacity. */
export function isOverVolume(storage: Storage): boolean {
  const cap = VOLUME_CAPACITY[storage.location as StorageLocation];
  return cap !== undefined && storageVolume(storage) > cap;
}

/** Check if transferring quantity of item would exceed destination capacity. */
export function canFitInStorage(
  destination: Storage,
  definitionId: ItemId,
  quantity: number,
): { fits: boolean; reason: string } {
  const def = getItemDefinition(definitionId);
  if (!def) return { fits: false, reason: "Unknown item definition." };

  const currentWeight = storageWeight(destination);
  const currentVolume = storageVolume(destination);
  const cap = WEIGHT_CAPACITY[destination.location as StorageLocation];
  const volCap = VOLUME_CAPACITY[destination.location as StorageLocation];

  if (cap !== undefined && currentWeight + def.weight * quantity > cap) {
    return { fits: false, reason: "Exceeds weight capacity." };
  }
  if (volCap !== undefined && currentVolume + def.volume * quantity > volCap) {
    return { fits: false, reason: "Exceeds volume capacity." };
  }
  return { fits: true, reason: "" };
}

// ── Atomic transfer ──────────────────────────────────────────────────────────

export type TransferResult =
  | { ok: true; inventory: GameState["inventory"] }
  | { ok: false; reason: string };

/**
 * Atomically transfer quantity of an item instance from one storage to another.
 * Returns a new inventory on success, or an error reason on failure.
 * Never mutates input. Prevents duplication and negative quantities.
 */
export function transferItem(
  inventory: GameState["inventory"],
  instanceId: ItemInstanceId,
  fromLocation: StorageLocation,
  toLocation: StorageLocation,
  quantity: number,
): TransferResult {
  if (quantity <= 0) {
    return { ok: false, reason: "Transfer quantity must be positive." };
  }
  if (fromLocation === toLocation) {
    return { ok: false, reason: "Source and destination are the same." };
  }

  // Find source storage and item
  const fromIdx = inventory.storages.findIndex(
    (s) => s.location === fromLocation,
  );
  if (fromIdx === -1) {
    return { ok: false, reason: `Source storage "${fromLocation}" not found.` };
  }
  const fromStorage = inventory.storages[fromIdx]!;
  const itemIdx = fromStorage.items.findIndex(
    (i) => i.instanceId === instanceId,
  );
  if (itemIdx === -1) {
    return { ok: false, reason: `Item "${instanceId}" not in source storage.` };
  }
  const sourceItem = fromStorage.items[itemIdx]!;

  if (sourceItem.quantity < quantity) {
    return { ok: false, reason: "Insufficient quantity in source." };
  }

  // Find or create destination storage
  const toIdx = inventory.storages.findIndex((s) => s.location === toLocation);

  // Check capacity at destination
  const destStorage: Storage =
    toIdx !== -1
      ? inventory.storages[toIdx]!
      : { location: toLocation, items: [] };

  const fitCheck = canFitInStorage(
    destStorage,
    sourceItem.definitionId as ItemId,
    quantity,
  );
  if (!fitCheck.fits) {
    return { ok: false, reason: fitCheck.reason };
  }

  // Check stack size limit
  const def = getItemDefinition(sourceItem.definitionId as ItemId);
  if (def) {
    const existingInDest = destStorage.items.find(
      (i) => i.instanceId === instanceId,
    );
    const destQty = existingInDest ? existingInDest.quantity : 0;
    if (destQty + quantity > def.stackSize) {
      return { ok: false, reason: "Exceeds stack size at destination." };
    }
  }

  // Determine whether this is a whole-instance or partial (split) transfer.
  const isWholeTransfer = sourceItem.quantity === quantity;

  // For partial transfers, generate a deterministic split ID so that
  // no two instances across any storage share the same instanceId.
  const destInstanceId: ItemInstanceId = isWholeTransfer
    ? instanceId
    : (`${instanceId}:split` as ItemInstanceId);

  // Verify the split ID doesn't already exist anywhere (invariant guard)
  if (!isWholeTransfer) {
    const idExists = inventory.storages.some((s) =>
      s.items.some((i) => i.instanceId === destInstanceId),
    );
    if (idExists) {
      return { ok: false, reason: "Split instance ID collision." };
    }
  }

  // Build new storages (atomic: all-or-nothing)
  const newStorages = inventory.storages.map((s, idx) => {
    if (idx === fromIdx) {
      const newItems = s.items
        .map((item) => {
          if (item.instanceId !== instanceId) return item;
          return { ...item, quantity: item.quantity - quantity };
        })
        .filter((item) => item.quantity > 0);
      return { ...s, items: newItems };
    }
    if (s.location === toLocation) {
      // For whole transfers, merge into existing compatible stack or add new entry
      if (isWholeTransfer) {
        const existing = s.items.find((i) => i.instanceId === instanceId);
        if (existing) {
          return {
            ...s,
            items: s.items.map((i) =>
              i.instanceId === instanceId
                ? { ...i, quantity: i.quantity + quantity }
                : i,
            ),
          };
        }
      }
      // New item in destination with the appropriate instanceId
      return {
        ...s,
        items: [
          ...s.items,
          { ...sourceItem, instanceId: destInstanceId, quantity },
        ],
      };
    }
    return s;
  });

  // If destination didn't exist, append it
  if (toIdx === -1) {
    newStorages.push({
      location: toLocation,
      items: [{ ...sourceItem, instanceId: destInstanceId, quantity }],
    });
  }

  return { ok: true, inventory: { storages: newStorages } };
}

// ── Spoilage ─────────────────────────────────────────────────────────────────

/**
 * Advance spoilage for all perishable items by one turn.
 * Deterministic: reduces condition by the item's spoilageRate.
 * Items reaching condition 0 are retained (marked spoiled) — never silently deleted.
 * Returns the updated inventory and list of spoiled items (instanceId + definitionId).
 */
export function advanceSpoilage(inventory: GameState["inventory"]): {
  inventory: GameState["inventory"];
  spoiledItems: Array<{ instanceId: string; definitionId: string }>;
} {
  const spoiledItems: Array<{ instanceId: string; definitionId: string }> = [];

  const newStorages = inventory.storages.map((storage) => ({
    ...storage,
    items: storage.items.map((item) => {
      const def = getItemDefinition(item.definitionId as ItemId);
      if (!def || def.spoilageRate === 0) return item;

      const newCondition = Math.max(0, item.condition - def.spoilageRate);
      if (newCondition === 0 && item.condition > 0) {
        spoiledItems.push({
          instanceId: item.instanceId,
          definitionId: item.definitionId,
        });
      }
      return { ...item, condition: newCondition };
    }),
  }));

  return { inventory: { storages: newStorages }, spoiledItems };
}

// ── Consumption ──────────────────────────────────────────────────────────────

export type ConsumeResult =
  | {
      ok: true;
      inventory: GameState["inventory"];
      effects: Record<string, number>;
      definitionId: string;
    }
  | { ok: false; reason: string };

/**
 * Consume one unit of a consumable item. Returns updated inventory and effects.
 */
export function consumeItem(
  inventory: GameState["inventory"],
  instanceId: ItemInstanceId,
): ConsumeResult {
  // Find the item
  let found: ItemInstance | undefined;
  let storageIdx = -1;

  for (let i = 0; i < inventory.storages.length; i++) {
    const item = inventory.storages[i]!.items.find(
      (it) => it.instanceId === instanceId,
    );
    if (item) {
      found = item;
      storageIdx = i;
      break;
    }
  }

  if (!found || storageIdx === -1) {
    return { ok: false, reason: `Item "${instanceId}" not found.` };
  }

  const def = getItemDefinition(found.definitionId as ItemId);
  if (!def) {
    return { ok: false, reason: "Unknown item definition." };
  }
  if (!def.consumable) {
    return { ok: false, reason: `"${def.name}" is not consumable.` };
  }

  // Remove one unit
  const newStorages = inventory.storages.map((s, idx) => {
    if (idx !== storageIdx) return s;
    return {
      ...s,
      items: s.items
        .map((item) => {
          if (item.instanceId !== instanceId) return item;
          return { ...item, quantity: item.quantity - 1 };
        })
        .filter((item) => item.quantity > 0),
    };
  });

  const effects: Record<string, number> = {};
  if (def.consumeEffects) {
    for (const [key, val] of Object.entries(def.consumeEffects)) {
      if (val !== undefined) effects[key] = val;
    }
  }

  return {
    ok: true,
    inventory: { storages: newStorages },
    effects,
    definitionId: found.definitionId,
  };
}
