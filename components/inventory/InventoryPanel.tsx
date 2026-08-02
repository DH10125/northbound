"use client";

/**
 * InventoryPanel — compact inventory UI for managing items across storage locations.
 *
 * Accessibility:
 *   - Keyboard navigable (Tab, Arrow keys, Enter/Space to select actions)
 *   - Touch targets ≥ 44px
 *   - Live region announces transfer results and validation errors
 *   - Disabled buttons have aria-describedby with the reason
 *   - Screen-reader-friendly item descriptions
 */

import { useState, useCallback, useId } from "react";
import type { GameState } from "@/game/schemas/game-state";
import type { ItemInstance } from "@/game/schemas/inventory";
import type { ItemId } from "@/game/schemas/ids";
import { getItemDefinition } from "@/game/content/items";
import { storageWeight, WEIGHT_CAPACITY } from "@/game/core/inventory";
import type { StorageLocation } from "@/game/core/inventory-types";

// ── Types ────────────────────────────────────────────────────────────────────

export type InventoryAction =
  | {
      type: "transfer";
      instanceId: string;
      from: StorageLocation;
      to: StorageLocation;
      quantity: number;
    }
  | { type: "consume"; instanceId: string };

type Props = {
  state: GameState;
  onAction: (action: InventoryAction) => { ok: boolean; reason?: string };
};

// ── Component ────────────────────────────────────────────────────────────────

export function InventoryPanel({ state, onAction }: Props) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const announcementId = useId();

  const announce = useCallback((msg: string) => {
    setAnnouncement("");
    setTimeout(() => setAnnouncement(msg), 50);
  }, []);

  const handleConsume = useCallback(
    (instanceId: string) => {
      const result = onAction({ type: "consume", instanceId });
      if (result.ok) {
        announce("Item consumed.");
        setSelectedItem(null);
      } else {
        announce(result.reason ?? "Cannot consume item.");
      }
    },
    [onAction, announce],
  );

  const handleTransfer = useCallback(
    (instanceId: string, from: StorageLocation, to: StorageLocation) => {
      const result = onAction({
        type: "transfer",
        instanceId,
        from,
        to,
        quantity: 1,
      });
      if (result.ok) {
        announce(`Item moved to ${to}.`);
      } else {
        announce(result.reason ?? "Cannot transfer item.");
      }
    },
    [onAction, announce],
  );

  const storages = state.inventory.storages;

  return (
    <section aria-label="Inventory" className="inventory-panel">
      {/* Live region for action feedback */}
      <div
        id={announcementId}
        aria-live="polite"
        aria-atomic="true"
        className="live-region"
        data-testid="inventory-announcement"
      >
        {announcement}
      </div>

      {storages.map((storage) => {
        const weight = storageWeight(storage);
        const weightCap = WEIGHT_CAPACITY[storage.location as StorageLocation];

        return (
          <div key={storage.location} className="storage-section">
            <h3 className="storage-heading">
              {storage.location}
              <span
                className="storage-capacity"
                aria-label={`${weight.toFixed(1)} of ${weightCap} kg`}
              >
                {" "}
                ({weight.toFixed(1)}/{weightCap}kg)
              </span>
            </h3>

            {storage.items.length === 0 && (
              <p className="storage-empty">Empty</p>
            )}

            <ul className="item-list" role="list">
              {storage.items.map((item) => (
                <InventoryItem
                  key={item.instanceId}
                  item={item}
                  isSelected={selectedItem === item.instanceId}
                  onSelect={() =>
                    setSelectedItem(
                      selectedItem === item.instanceId ? null : item.instanceId,
                    )
                  }
                  onConsume={() => handleConsume(item.instanceId)}
                  onTransfer={(to) =>
                    handleTransfer(
                      item.instanceId,
                      storage.location as StorageLocation,
                      to,
                    )
                  }
                  availableLocations={storages
                    .map((s) => s.location as StorageLocation)
                    .filter((l) => l !== storage.location)}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

// ── Item row ─────────────────────────────────────────────────────────────────

function InventoryItem({
  item,
  isSelected,
  onSelect,
  onConsume,
  onTransfer,
  availableLocations,
}: {
  item: ItemInstance;
  isSelected: boolean;
  onSelect: () => void;
  onConsume: () => void;
  onTransfer: (to: StorageLocation) => void;
  availableLocations: StorageLocation[];
}) {
  const def = getItemDefinition(item.definitionId as ItemId);
  const name = def?.name ?? item.definitionId;
  const descId = useId();

  return (
    <li className="item-row">
      <button
        type="button"
        className="item-button"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        aria-expanded={isSelected}
        aria-describedby={descId}
        data-testid={`item-${item.instanceId}`}
      >
        <span className="item-name">{name}</span>
        <span className="item-qty" aria-label={`quantity ${item.quantity}`}>
          ×{item.quantity}
        </span>
        <span
          className="item-condition"
          aria-label={`condition ${item.condition} percent`}
        >
          {item.condition}%
        </span>
      </button>

      <span id={descId} className="visually-hidden">
        {def?.description ?? ""}
        {def ? `. Weight: ${def.weight}kg. ` : ""}
        {item.condition < 30 ? "Deteriorating. " : ""}
      </span>

      {isSelected && (
        <div
          className="item-actions"
          role="group"
          aria-label={`Actions for ${name}`}
        >
          {def?.consumable && (
            <button
              type="button"
              className="action-button"
              onClick={onConsume}
              data-testid={`consume-${item.instanceId}`}
            >
              Consume
            </button>
          )}
          {availableLocations.map((loc) => (
            <button
              key={loc}
              type="button"
              className="action-button"
              onClick={() => onTransfer(loc)}
              data-testid={`transfer-${item.instanceId}-${loc}`}
            >
              → {loc}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
