/**
 * Tests for inventory, storage, encumbrance, transfers, spoilage, and item catalog.
 */

import { describe, it, expect } from "vitest";
import {
  ITEMS,
  getItemDefinition,
  ItemDefinitionSchema,
} from "../../content/items";
import type { ItemId, ItemInstanceId } from "../../schemas/ids";
import { transferItem, consumeItem, advanceSpoilage } from "../inventory";
import {
  totalCarriedWeight,
  totalCarriedNoise,
  encumbranceRatio,
  isEncumbered,
  totalItemCount,
} from "../selectors";
import { applyCommand } from "../reducer";
import { replay } from "../replay";
import { seedToState } from "../rng";
import { minimalGameState } from "../../testing/fixtures";
import type { GameState } from "../../schemas/game-state";

// ── Item catalog validation ──────────────────────────────────────────────────

describe("item catalog", () => {
  it("contains exactly 25 items", () => {
    expect(ITEMS).toHaveLength(25);
  });

  it("all items pass schema validation", () => {
    for (const item of ITEMS) {
      expect(() => ItemDefinitionSchema.parse(item)).not.toThrow();
    }
  });

  it("all item IDs are unique", () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(25);
  });

  it("all IDs start with 'item.'", () => {
    for (const item of ITEMS) {
      expect(item.id.startsWith("item.")).toBe(true);
    }
  });

  it("getItemDefinition retrieves existing item", () => {
    const def = getItemDefinition("item.food.ration" as ItemId);
    expect(def).toBeDefined();
    expect(def!.name).toBe("Trail Ration");
  });

  it("getItemDefinition returns undefined for unknown", () => {
    expect(getItemDefinition("item.fake.nothing" as ItemId)).toBeUndefined();
  });

  it("covers documented categories", () => {
    const categories = new Set(ITEMS.map((i) => i.category));
    expect(categories.has("water")).toBe(true);
    expect(categories.has("food")).toBe(true);
    expect(categories.has("medicine")).toBe(true);
    expect(categories.has("tools")).toBe(true);
    expect(categories.has("trade")).toBe(true);
  });

  it("consumable items have consumeEffects", () => {
    for (const item of ITEMS) {
      if (item.consumable) {
        expect(item.consumeEffects).toBeDefined();
      }
    }
  });
});

// ── Weight/volume selectors ──────────────────────────────────────────────────

describe("weight and volume selectors", () => {
  const stateWithItems: GameState = {
    ...minimalGameState,
    inventory: {
      storages: [
        {
          location: "backpack",
          items: [
            {
              instanceId: "item-001" as ItemInstanceId,
              definitionId: "item.food.ration" as ItemId,
              quantity: 10,
              condition: 100,
            },
            {
              instanceId: "item-002" as ItemInstanceId,
              definitionId: "item.fuel.gasoline-can" as ItemId,
              quantity: 2,
              condition: 100,
            },
          ],
        },
      ],
    },
  };

  it("carriedWeight sums correctly", () => {
    // 10 rations * 0.3kg + 2 gas cans * 3.5kg = 3 + 7 = 10
    expect(totalCarriedWeight(stateWithItems)).toBeCloseTo(10.0);
  });

  it("carriedNoise sums correctly", () => {
    // 10 rations * 0 noise + 2 gas cans * 2 noise = 4
    expect(totalCarriedNoise(stateWithItems)).toBe(4);
  });

  it("encumbranceRatio computes correctly", () => {
    // capacity = 25 + 10 = 35; weight = 10; ratio = 10/35
    expect(encumbranceRatio(stateWithItems)).toBeCloseTo(10 / 35);
  });

  it("isEncumbered is false when under capacity", () => {
    expect(isEncumbered(stateWithItems)).toBe(false);
  });

  it("isEncumbered is true when over capacity", () => {
    const heavy: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-heavy" as ItemInstanceId,
                definitionId: "item.fuel.gasoline-can" as ItemId,
                quantity: 10, // 10 * 3.5 = 35 > 25 backpack cap
                condition: 100,
              },
            ],
          },
          {
            location: "body",
            items: [
              {
                instanceId: "item-body" as ItemInstanceId,
                definitionId: "item.fuel.gasoline-can" as ItemId,
                quantity: 3, // 3 * 3.5 = 10.5 > 10 body cap
                condition: 100,
              },
            ],
          },
        ],
      },
    };
    expect(isEncumbered(heavy)).toBe(true);
  });

  it("empty inventory has zero weight", () => {
    expect(totalCarriedWeight(minimalGameState)).toBe(0);
  });
});

// ── Atomic transfers ─────────────────────────────────────────────────────────

describe("transferItem", () => {
  const inventory = {
    storages: [
      {
        location: "backpack" as const,
        items: [
          {
            instanceId: "item-t1" as ItemInstanceId,
            definitionId: "item.food.ration" as ItemId,
            quantity: 5,
            condition: 100,
          },
        ],
      },
      {
        location: "body" as const,
        items: [],
      },
    ],
  };

  it("successful transfer moves items", () => {
    const result = transferItem(
      inventory,
      "item-t1" as ItemInstanceId,
      "backpack",
      "body",
      3,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const backpack = result.inventory.storages.find(
        (s) => s.location === "backpack",
      );
      const body = result.inventory.storages.find((s) => s.location === "body");
      expect(backpack!.items[0]!.quantity).toBe(2);
      expect(body!.items[0]!.quantity).toBe(3);
    }
  });

  it("rejects transfer with insufficient quantity", () => {
    const result = transferItem(
      inventory,
      "item-t1" as ItemInstanceId,
      "backpack",
      "body",
      10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Insufficient");
  });

  it("rejects transfer to same location", () => {
    const result = transferItem(
      inventory,
      "item-t1" as ItemInstanceId,
      "backpack",
      "backpack",
      1,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects zero quantity", () => {
    const result = transferItem(
      inventory,
      "item-t1" as ItemInstanceId,
      "backpack",
      "body",
      0,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-existent item", () => {
    const result = transferItem(
      inventory,
      "item-ghost" as ItemInstanceId,
      "backpack",
      "body",
      1,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects transfer exceeding destination capacity", () => {
    const bigInventory = {
      storages: [
        {
          location: "backpack" as const,
          items: [
            {
              instanceId: "item-fuel" as ItemInstanceId,
              definitionId: "item.fuel.gasoline-can" as ItemId,
              quantity: 5, // 5 * 3.5 = 17.5kg
              condition: 100,
            },
          ],
        },
        {
          location: "body" as const,
          items: [
            {
              instanceId: "item-existing" as ItemInstanceId,
              definitionId: "item.fuel.gasoline-can" as ItemId,
              quantity: 2, // 2 * 3.5 = 7kg already in body (cap 10)
              condition: 100,
            },
          ],
        },
      ],
    };
    // Transfer 3 gas cans (10.5kg) to body which has 7kg already = 17.5 > 10
    const result = transferItem(
      bigInventory,
      "item-fuel" as ItemInstanceId,
      "backpack",
      "body",
      3,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("weight");
  });

  it("removes item from source when entire quantity transferred", () => {
    const result = transferItem(
      inventory,
      "item-t1" as ItemInstanceId,
      "backpack",
      "body",
      5,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const backpack = result.inventory.storages.find(
        (s) => s.location === "backpack",
      );
      expect(backpack!.items).toHaveLength(0);
    }
  });
});

// ── TRANSFER_ITEM command in reducer ─────────────────────────────────────────

describe("applyCommand – TRANSFER_ITEM", () => {
  const stateWithItems: GameState = {
    ...minimalGameState,
    inventory: {
      storages: [
        {
          location: "backpack",
          items: [
            {
              instanceId: "item-r1" as ItemInstanceId,
              definitionId: "item.food.ration" as ItemId,
              quantity: 5,
              condition: 100,
            },
          ],
        },
        {
          location: "body",
          items: [],
        },
      ],
    },
  };

  it("successful transfer emits ITEM_TRANSFERRED event", () => {
    const rng = seedToState("transfer-test");
    const { events } = applyCommand(
      stateWithItems,
      {
        type: "TRANSFER_ITEM",
        instanceId: "item-r1",
        fromLocation: "backpack",
        toLocation: "body",
        quantity: 2,
      },
      rng,
    );
    expect(events.some((e) => e.type === "ITEM_TRANSFERRED")).toBe(true);
  });

  it("failed transfer emits COMMAND_REJECTED", () => {
    const rng = seedToState("transfer-fail");
    const { events } = applyCommand(
      stateWithItems,
      {
        type: "TRANSFER_ITEM",
        instanceId: "item-ghost",
        fromLocation: "backpack",
        toLocation: "body",
        quantity: 1,
      },
      rng,
    );
    expect(events[0]!.type).toBe("COMMAND_REJECTED");
  });
});

// ── Consumption ──────────────────────────────────────────────────────────────

describe("consumeItem", () => {
  const inventory = {
    storages: [
      {
        location: "backpack" as const,
        items: [
          {
            instanceId: "item-c1" as ItemInstanceId,
            definitionId: "item.food.ration" as ItemId,
            quantity: 3,
            condition: 100,
          },
          {
            instanceId: "item-c2" as ItemInstanceId,
            definitionId: "item.tools.knife" as ItemId,
            quantity: 1,
            condition: 100,
          },
        ],
      },
    ],
  };

  it("consuming reduces quantity by 1", () => {
    const result = consumeItem(inventory, "item-c1" as ItemInstanceId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const item = result.inventory.storages[0]!.items.find(
        (i) => i.instanceId === "item-c1",
      );
      expect(item!.quantity).toBe(2);
    }
  });

  it("returns meter effects", () => {
    const result = consumeItem(inventory, "item-c1" as ItemInstanceId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.effects.hunger).toBe(-25);
    }
  });

  it("rejects non-consumable items", () => {
    const result = consumeItem(inventory, "item-c2" as ItemInstanceId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not consumable");
  });

  it("rejects non-existent item", () => {
    const result = consumeItem(inventory, "item-ghost" as ItemInstanceId);
    expect(result.ok).toBe(false);
  });
});

// ── CONSUME_ITEM command in reducer ──────────────────────────────────────────

describe("applyCommand – CONSUME_ITEM", () => {
  const hungryState: GameState = {
    ...minimalGameState,
    party: {
      ...minimalGameState.party,
      player: {
        ...minimalGameState.party.player,
        meters: { ...minimalGameState.party.player.meters, hunger: 50 },
      },
    },
    inventory: {
      storages: [
        {
          location: "backpack",
          items: [
            {
              instanceId: "item-eat" as ItemInstanceId,
              definitionId: "item.food.ration" as ItemId,
              quantity: 2,
              condition: 100,
            },
          ],
        },
      ],
    },
  };

  it("consuming food reduces hunger", () => {
    const rng = seedToState("consume-test");
    const { state } = applyCommand(
      hungryState,
      { type: "CONSUME_ITEM", instanceId: "item-eat" },
      rng,
    );
    expect(state.party.player.meters.hunger).toBe(25); // 50 + (-25) = 25
  });

  it("emits ITEM_CONSUMED event", () => {
    const rng = seedToState("consume-evt");
    const { events } = applyCommand(
      hungryState,
      { type: "CONSUME_ITEM", instanceId: "item-eat" },
      rng,
    );
    expect(events.some((e) => e.type === "ITEM_CONSUMED")).toBe(true);
  });
});

// ── Spoilage ─────────────────────────────────────────────────────────────────

describe("advanceSpoilage", () => {
  it("reduces condition of perishable items", () => {
    const inventory = {
      storages: [
        {
          location: "backpack" as const,
          items: [
            {
              instanceId: "item-fish" as ItemInstanceId,
              definitionId: "item.food.fresh-fish" as ItemId,
              quantity: 2,
              condition: 20,
            },
          ],
        },
      ],
    };
    const { inventory: newInv, spoiledItems } = advanceSpoilage(inventory);
    const fish = newInv.storages[0]!.items.find(
      (i) => i.instanceId === "item-fish",
    );
    expect(fish!.condition).toBe(15);
    expect(spoiledItems).toHaveLength(0);
  });

  it("retains items at condition 0 (marked spoiled, not deleted)", () => {
    const inventory = {
      storages: [
        {
          location: "backpack" as const,
          items: [
            {
              instanceId: "item-fish" as ItemInstanceId,
              definitionId: "item.food.fresh-fish" as ItemId,
              quantity: 1,
              condition: 3, // spoilageRate = 5, 3 - 5 clamped to 0
            },
          ],
        },
      ],
    };
    const { inventory: newInv, spoiledItems } = advanceSpoilage(inventory);
    // Item retained at condition 0
    expect(newInv.storages[0]!.items).toHaveLength(1);
    expect(newInv.storages[0]!.items[0]!.condition).toBe(0);
    expect(spoiledItems).toHaveLength(1);
    expect(spoiledItems[0]!.instanceId).toBe("item-fish");
    expect(spoiledItems[0]!.definitionId).toBe("item.food.fresh-fish");
  });

  it("non-perishable items are unaffected", () => {
    const inventory = {
      storages: [
        {
          location: "backpack" as const,
          items: [
            {
              instanceId: "item-knife" as ItemInstanceId,
              definitionId: "item.tools.knife" as ItemId,
              quantity: 1,
              condition: 100,
            },
          ],
        },
      ],
    };
    const { inventory: newInv } = advanceSpoilage(inventory);
    expect(newInv.storages[0]!.items[0]!.condition).toBe(100);
  });
});

// ── Spoilage integration with turn clock ─────────────────────────────────────

describe("spoilage advances with TRAVEL command", () => {
  it("perishable items spoil after travel", () => {
    const stateWithFish: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-fish" as ItemInstanceId,
                definitionId: "item.food.fresh-fish" as ItemId,
                quantity: 1,
                condition: 50,
              },
            ],
          },
        ],
      },
    };
    const rng = seedToState("spoil-travel");
    const { state } = applyCommand(
      stateWithFish,
      { type: "TRAVEL", turnsToTravel: 1 },
      rng,
    );
    const fish = state.inventory.storages[0]!.items.find(
      (i) => i.instanceId === "item-fish",
    );
    expect(fish!.condition).toBe(45); // 50 - 5
  });

  it("spoilage is deterministic across replays", () => {
    const stateWithFish: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-fish" as ItemInstanceId,
                definitionId: "item.food.fresh-fish" as ItemId,
                quantity: 1,
                condition: 30,
              },
            ],
          },
        ],
      },
    };
    const rng = seedToState("spoil-replay");
    const commands = [
      { type: "TRAVEL" as const, turnsToTravel: 1 },
      { type: "TRAVEL" as const, turnsToTravel: 1 },
    ];
    const r1 = replay(stateWithFish, rng, commands);
    const r2 = replay(stateWithFish, rng, commands);
    expect(JSON.stringify(r1.state.inventory)).toBe(
      JSON.stringify(r2.state.inventory),
    );
  });
});

// ── Invariant protections ────────────────────────────────────────────────────

describe("invariant protections", () => {
  it("no duplication: total item count preserved across transfer", () => {
    const stateWithItems: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-inv" as ItemInstanceId,
                definitionId: "item.food.ration" as ItemId,
                quantity: 5,
                condition: 100,
              },
            ],
          },
          { location: "body", items: [] },
        ],
      },
    };
    const rng = seedToState("invariant-dup");
    const { state } = applyCommand(
      stateWithItems,
      {
        type: "TRANSFER_ITEM",
        instanceId: "item-inv",
        fromLocation: "backpack",
        toLocation: "body",
        quantity: 3,
      },
      rng,
    );
    expect(totalItemCount(state)).toBe(5); // no duplication
  });

  it("no negative quantities after consumption", () => {
    const stateWithOne: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-last" as ItemInstanceId,
                definitionId: "item.food.ration" as ItemId,
                quantity: 1,
                condition: 100,
              },
            ],
          },
        ],
      },
    };
    const rng = seedToState("invariant-neg");
    const { state } = applyCommand(
      stateWithOne,
      { type: "CONSUME_ITEM", instanceId: "item-last" },
      rng,
    );
    // Item should be removed entirely, not have negative quantity
    expect(totalItemCount(state)).toBe(0);
    expect(state.inventory.storages[0]!.items).toHaveLength(0);
  });

  it("failed transfer does not modify state", () => {
    const stateWithItems: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-safe" as ItemInstanceId,
                definitionId: "item.food.ration" as ItemId,
                quantity: 5,
                condition: 100,
              },
            ],
          },
        ],
      },
    };
    const rng = seedToState("invariant-safe");
    const { state } = applyCommand(
      stateWithItems,
      {
        type: "TRANSFER_ITEM",
        instanceId: "item-safe",
        fromLocation: "backpack",
        toLocation: "body",
        quantity: 100, // exceeds quantity
      },
      rng,
    );
    // State unchanged
    expect(totalItemCount(state)).toBe(5);
  });
});

// ── Defect corrections ───────────────────────────────────────────────────────

describe("partial transfer produces unique split ID (fix #1)", () => {
  const inventory = {
    storages: [
      {
        location: "backpack" as const,
        items: [
          {
            instanceId: "item-p1" as ItemInstanceId,
            definitionId: "item.food.ration" as ItemId,
            quantity: 5,
            condition: 100,
          },
        ],
      },
      { location: "body" as const, items: [] },
    ],
  };

  it("partial transfer assigns deterministic split instanceId", () => {
    const result = transferItem(
      inventory,
      "item-p1" as ItemInstanceId,
      "backpack",
      "body",
      2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const allIds = result.inventory.storages.flatMap((s) =>
        s.items.map((i) => i.instanceId),
      );
      // Source retains original ID with reduced qty
      expect(allIds).toContain("item-p1");
      // Destination gets split ID
      expect(allIds).toContain("item-p1:split");
      // No duplicate IDs
      expect(new Set(allIds).size).toBe(allIds.length);
    }
  });

  it("whole transfer preserves original instanceId", () => {
    const result = transferItem(
      inventory,
      "item-p1" as ItemInstanceId,
      "backpack",
      "body",
      5,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const allIds = result.inventory.storages.flatMap((s) =>
        s.items.map((i) => i.instanceId),
      );
      expect(allIds).toContain("item-p1");
      expect(allIds).not.toContain("item-p1:split");
    }
  });

  it("quantity is conserved across partial transfer", () => {
    const result = transferItem(
      inventory,
      "item-p1" as ItemInstanceId,
      "backpack",
      "body",
      2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const total = result.inventory.storages
        .flatMap((s) => s.items)
        .reduce((sum, i) => sum + i.quantity, 0);
      expect(total).toBe(5);
    }
  });
});

describe("rejected commands preserve state byte-for-byte (fix #2)", () => {
  const stateWithFish: GameState = {
    ...minimalGameState,
    runStatus: "ended-success",
    inventory: {
      storages: [
        {
          location: "backpack",
          items: [
            {
              instanceId: "item-fish" as ItemInstanceId,
              definitionId: "item.food.fresh-fish" as ItemId,
              quantity: 1,
              condition: 10,
            },
          ],
        },
      ],
    },
  };

  it("rejected TRAVEL does not trigger spoilage", () => {
    const rng = seedToState("reject-travel");
    const { state, rng: rngAfter } = applyCommand(
      stateWithFish,
      { type: "TRAVEL", turnsToTravel: 1 },
      rng,
    );
    expect(JSON.stringify(state)).toBe(JSON.stringify(stateWithFish));
    expect(rngAfter).toEqual(rng);
  });

  it("rejected REST does not trigger spoilage", () => {
    const rng = seedToState("reject-rest");
    const { state, rng: rngAfter } = applyCommand(
      stateWithFish,
      { type: "REST", hours: 4 },
      rng,
    );
    expect(JSON.stringify(state)).toBe(JSON.stringify(stateWithFish));
    expect(rngAfter).toEqual(rng);
  });

  it("rejected SCAVENGE does not trigger spoilage", () => {
    const rng = seedToState("reject-scav");
    const { state, rng: rngAfter } = applyCommand(
      stateWithFish,
      { type: "SCAVENGE" },
      rng,
    );
    expect(JSON.stringify(state)).toBe(JSON.stringify(stateWithFish));
    expect(rngAfter).toEqual(rng);
  });
});

describe("multi-turn TRAVEL spoils once per turn (fix #3)", () => {
  it("3-turn travel applies 3 spoilage ticks", () => {
    const stateWithFish: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-fish" as ItemInstanceId,
                definitionId: "item.food.fresh-fish" as ItemId,
                quantity: 1,
                condition: 50,
              },
            ],
          },
        ],
      },
    };
    const rng = seedToState("multi-spoil");
    const { state } = applyCommand(
      stateWithFish,
      { type: "TRAVEL", turnsToTravel: 3 },
      rng,
    );
    const fish = state.inventory.storages[0]!.items.find(
      (i) => i.instanceId === "item-fish",
    );
    // 50 - 5*3 = 35
    expect(fish!.condition).toBe(35);
  });

  it("early destination stop still applies spoilage for each completed turn", () => {
    const stateNearEnd: GameState = {
      ...minimalGameState,
      location: { ...minimalGameState.location, distanceRemaining: 10 },
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-fish" as ItemInstanceId,
                definitionId: "item.food.fresh-fish" as ItemId,
                quantity: 1,
                condition: 50,
              },
            ],
          },
        ],
      },
    };
    const rng = seedToState("early-stop");
    const { state } = applyCommand(
      stateNearEnd,
      { type: "TRAVEL", turnsToTravel: 5 },
      rng,
    );
    // Reached destination after 1 turn, so 1 spoilage tick
    expect(state.runStatus).toBe("ended-success");
    const fish = state.inventory.storages[0]!.items.find(
      (i) => i.instanceId === "item-fish",
    );
    expect(fish!.condition).toBe(45); // 50 - 5*1
  });

  it("multi-turn spoilage is replay-deterministic", () => {
    const stateWithFish: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-fish" as ItemInstanceId,
                definitionId: "item.food.fresh-fish" as ItemId,
                quantity: 1,
                condition: 40,
              },
            ],
          },
        ],
      },
    };
    const rng = seedToState("multi-replay");
    const commands = [{ type: "TRAVEL" as const, turnsToTravel: 3 }];
    const r1 = replay(stateWithFish, rng, commands);
    const r2 = replay(stateWithFish, rng, commands);
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
    expect(JSON.stringify(r1.rng)).toBe(JSON.stringify(r2.rng));
  });
});

describe("ITEM_SPOILED event always has real definitionId (fix #4)", () => {
  it("spoilage event carries definitionId from item, never 'unknown'", () => {
    const stateWithFish: GameState = {
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-fish" as ItemInstanceId,
                definitionId: "item.food.fresh-fish" as ItemId,
                quantity: 1,
                condition: 3, // will reach 0 after 1 tick (spoilageRate=5)
              },
            ],
          },
        ],
      },
    };
    const rng = seedToState("spoil-defid");
    const { events } = applyCommand(
      stateWithFish,
      { type: "TRAVEL", turnsToTravel: 1 },
      rng,
    );
    const spoiledEvent = events.find((e) => e.type === "ITEM_SPOILED");
    expect(spoiledEvent).toBeDefined();
    expect(spoiledEvent!.definitionId).toBe("item.food.fresh-fish");
    expect(spoiledEvent!.definitionId).not.toBe("unknown");
  });
});
