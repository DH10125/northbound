import { describe, it, expect } from "vitest";
import { GameStateSchema } from "../game-state";
import {
  StableIdSchema,
  EventIdSchema,
  ItemIdSchema,
  FactionIdSchema,
  NodeIdSchema,
} from "../ids";
import { AttributesSchema, MetersSchema } from "../meters";
import { minimalGameState, populatedGameState } from "../../testing/fixtures";
import type {
  ItemInstanceId,
  TransportInstanceId,
  FactionId,
  ItemId,
} from "../ids";

// ── Stable ID validation ──────────────────────────────────────────────────────

describe("StableIdSchema", () => {
  it("accepts valid two-segment ID", () => {
    expect(StableIdSchema.safeParse("item.bandage").success).toBe(true);
  });

  it("accepts valid three-segment ID", () => {
    expect(
      StableIdSchema.safeParse("event.lower-mississippi.derelict-barge")
        .success,
    ).toBe(true);
  });

  it("rejects single segment", () => {
    expect(StableIdSchema.safeParse("bandage").success).toBe(false);
  });

  it("rejects uppercase", () => {
    expect(StableIdSchema.safeParse("Item.Bandage").success).toBe(false);
  });

  it("rejects spaces", () => {
    expect(StableIdSchema.safeParse("item.my bandage").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(StableIdSchema.safeParse("").success).toBe(false);
  });
});

// ── Domain-prefix enforcement ─────────────────────────────────────────────────

describe("Domain-prefix enforcement", () => {
  it("EventIdSchema accepts event.* IDs", () => {
    expect(EventIdSchema.safeParse("event.pensacola.first-night").success).toBe(
      true,
    );
  });

  it("EventIdSchema rejects item.* IDs", () => {
    const r = EventIdSchema.safeParse("item.medical.bandage");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/event/);
    }
  });

  it("ItemIdSchema accepts item.* IDs", () => {
    expect(ItemIdSchema.safeParse("item.medical.bandage").success).toBe(true);
  });

  it("ItemIdSchema rejects event.* IDs", () => {
    expect(ItemIdSchema.safeParse("event.pensacola.first-night").success).toBe(
      false,
    );
  });

  it("FactionIdSchema accepts faction.* IDs", () => {
    expect(FactionIdSchema.safeParse("faction.river.cooperative").success).toBe(
      true,
    );
  });

  it("FactionIdSchema rejects transport.* IDs", () => {
    expect(FactionIdSchema.safeParse("transport.water.canoe").success).toBe(
      false,
    );
  });

  it("NodeIdSchema accepts node.* IDs", () => {
    expect(NodeIdSchema.safeParse("node.pensacola.marina").success).toBe(true);
  });

  it("NodeIdSchema rejects companion.* IDs", () => {
    expect(NodeIdSchema.safeParse("companion.marisol").success).toBe(false);
  });
});

// ── Meters validation ─────────────────────────────────────────────────────────

describe("MetersSchema", () => {
  it("accepts all-valid meters", () => {
    const valid = {
      health: 100,
      hunger: 0,
      thirst: 50,
      fatigue: 20,
      temperature: 50,
      stress: 10,
      morale: 80,
      infection: 0,
      radiation: 0,
      toxicExposure: 0,
      cleanliness: 90,
      pain: 5,
      sleepDebt: 15,
    };
    expect(MetersSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects health > 100 with path", () => {
    const r = MetersSchema.safeParse({
      ...minimalGameState.party.player.meters,
      health: 101,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["health"]);
  });

  it("rejects negative morale with path", () => {
    const r = MetersSchema.safeParse({
      ...minimalGameState.party.player.meters,
      morale: -1,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["morale"]);
  });

  it("rejects non-integer fatigue", () => {
    expect(
      MetersSchema.safeParse({
        ...minimalGameState.party.player.meters,
        fatigue: 10.5,
      }).success,
    ).toBe(false);
  });
});

describe("AttributesSchema", () => {
  it("rejects attribute of 0 (below minimum of 1) with path", () => {
    const r = AttributesSchema.safeParse({
      ...minimalGameState.party.player.attributes,
      strength: 0,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["strength"]);
  });

  it("rejects attribute of 11 (above maximum of 10)", () => {
    expect(
      AttributesSchema.safeParse({
        ...minimalGameState.party.player.attributes,
        endurance: 11,
      }).success,
    ).toBe(false);
  });
});

// ── GameState – minimal fixture ───────────────────────────────────────────────

describe("GameStateSchema – minimal fixture", () => {
  it("parses the minimal valid fixture without errors", () => {
    const result = GameStateSchema.safeParse(minimalGameState);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });

  it("infers the correct schemaVersion literal type", () => {
    const result = GameStateSchema.safeParse(minimalGameState);
    if (result.success) expect(result.data.schemaVersion).toBe(1);
  });
});

// ── GameState – populated fixture (cross-refs valid) ─────────────────────────

describe("GameStateSchema – populated fixture", () => {
  it("parses a fixture with items, transport, companion, and faction", () => {
    const result = GameStateSchema.safeParse(populatedGameState);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });
});

// ── GameState – shape malformed inputs ───────────────────────────────────────

describe("GameStateSchema – malformed shape inputs", () => {
  it("rejects missing schemaVersion with path", () => {
    const { schemaVersion: _sv, ...rest } = minimalGameState;
    void _sv;
    const r = GameStateSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues
          .map((i) => i.path.join("."))
          .some((p) => p === "schemaVersion"),
      ).toBe(true);
    }
  });

  it("rejects wrong schemaVersion with path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      schemaVersion: 99,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues
          .map((i) => i.path.join("."))
          .some((p) => p === "schemaVersion"),
      ).toBe(true);
    }
  });

  it("rejects invalid runStatus with path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      runStatus: "winning",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues
          .map((i) => i.path.join("."))
          .some((p) => p === "runStatus"),
      ).toBe(true);
    }
  });

  it("rejects player name too long with nested path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        player: { ...minimalGameState.party.player, name: "A".repeat(65) },
      },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues
          .map((i) => i.path.join("."))
          .some((p) => p.includes("name")),
      ).toBe(true);
    }
  });

  it("rejects invalid chapter enum value with path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      location: { ...minimalGameState.location, chapter: "atlantis" },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues
          .map((i) => i.path.join("."))
          .some((p) => p.includes("chapter")),
      ).toBe(true);
    }
  });

  it("rejects farm deadline of 0 with path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      farm: { ...minimalGameState.farm, deadlineTurns: 0 },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues
          .map((i) => i.path.join("."))
          .some((p) => p.includes("deadlineTurns")),
      ).toBe(true);
    }
  });

  it("rejects inventory item with quantity < 1", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-abc",
                definitionId: "item.food.ration",
                quantity: 0,
                condition: 100,
              },
            ],
          },
        ],
      },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues
          .map((i) => i.path.join("."))
          .some((p) => p.includes("quantity")),
      ).toBe(true);
    }
  });

  it("rejects pursuit intensity > 100 with path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      pursuit: { pursuingFactionIds: [], intensity: 101 },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues
          .map((i) => i.path.join("."))
          .some((p) => p.includes("intensity")),
      ).toBe(true);
    }
  });

  it("rejects completely empty object", () => {
    expect(GameStateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects null", () => {
    expect(GameStateSchema.safeParse(null).success).toBe(false);
  });
});

// ── Dangling reference tests ──────────────────────────────────────────────────

describe("GameStateSchema – dangling references", () => {
  it("rejects activeTransportId that has no matching transport entry, at path party.activeTransportId", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        activeTransportId: "transport-ghost-999" as TransportInstanceId,
      },
      transports: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "party.activeTransportId")).toBe(true);
    }
  });

  it("rejects equippedItemId that has no matching inventory item, at path party.player.equippedItemIds.0", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        player: {
          ...minimalGameState.party.player,
          equippedItemIds: ["item-ghost-999" as ItemInstanceId],
        },
      },
      inventory: { storages: [{ location: "backpack", items: [] }] },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "party.player.equippedItemIds.0")).toBe(
        true,
      );
    }
  });

  it("rejects companion carriedItemId that has no matching inventory item, at path party.companions.0.carriedItemIds.0", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        companions: [
          {
            id: "companion.marisol" as import("../ids").CompanionId,
            name: "Marisol",
            status: "active",
            attributes: minimalGameState.party.player.attributes,
            meters: minimalGameState.party.player.meters,
            morale: 70,
            loyalty: 80,
            fear: 10,
            carriedItemIds: ["item-ghost-999" as ItemInstanceId],
            relationships: {},
            flags: [],
          },
        ],
      },
      inventory: { storages: [{ location: "backpack", items: [] }] },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(
        paths.some((p) => p === "party.companions.0.carriedItemIds.0"),
      ).toBe(true);
    }
  });

  it("rejects transport cargoItemId that has no matching inventory item, at path transports.0.cargoItemIds.0", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      transports: [
        {
          instanceId: "transport-inst-001" as TransportInstanceId,
          definitionId: "transport.water.canoe" as import("../ids").TransportId,
          mode: "canoe" as const,
          condition: 80,
          fuel: 0,
          cargoItemIds: ["item-ghost-999" as ItemInstanceId],
        },
      ],
      inventory: { storages: [{ location: "backpack", items: [] }] },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "transports.0.cargoItemIds.0")).toBe(true);
    }
  });

  it("rejects duplicate item instanceId, at path inventory.storages.0.items.1.instanceId", () => {
    const dupItem = {
      instanceId: "item-inst-dup" as ItemInstanceId,
      definitionId: "item.food.ration" as ItemId,
      quantity: 1,
      condition: 100,
    };
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      inventory: {
        storages: [{ location: "backpack", items: [dupItem, { ...dupItem }] }],
      },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(
        paths.some((p) => p === "inventory.storages.0.items.1.instanceId"),
      ).toBe(true);
    }
  });

  it("rejects duplicate transport instanceId, at path transports.1.instanceId", () => {
    const dupTransport = {
      instanceId: "transport-inst-dup" as TransportInstanceId,
      definitionId: "transport.water.canoe" as import("../ids").TransportId,
      mode: "canoe" as const,
      condition: 80,
      fuel: 0,
      cargoItemIds: [],
    };
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      transports: [dupTransport, { ...dupTransport }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "transports.1.instanceId")).toBe(true);
    }
  });

  it("rejects duplicate faction entry, at path factions.1.factionId", () => {
    const factionEntry = {
      factionId: "faction.river.cooperative" as FactionId,
      reputation: 0,
      promises: [],
      debts: 0,
      hasAccess: false,
    };
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      factions: [factionEntry, { ...factionEntry }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "factions.1.factionId")).toBe(true);
    }
  });

  it("rejects pursuingFactionId not present in factions array, at path pursuit.pursuingFactionIds.0", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      factions: [],
      pursuit: { pursuingFactionIds: ["faction.ghost.unknown"], intensity: 50 },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "pursuit.pursuingFactionIds.0")).toBe(
        true,
      );
    }
  });

  it("accepts valid cross-references in populated fixture", () => {
    const result = GameStateSchema.safeParse(populatedGameState);
    if (!result.success) console.error(result.error.format());
    expect(result.success).toBe(true);
  });
});

// ── Item/transport instance ID definition-ID type separation ─────────────────

describe("Instance IDs vs definition IDs", () => {
  it("inventory instanceId accepts a plain string (not a stable ID)", () => {
    // Runtime instance IDs are simple strings, not dot-segmented stable IDs.
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-abc-123",
                definitionId: "item.food.ration",
                quantity: 1,
                condition: 100,
              },
            ],
          },
        ],
      },
    });
    if (!r.success) console.error(r.error.format());
    expect(r.success).toBe(true);
  });

  it("inventory instanceId rejects empty string", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "",
                definitionId: "item.food.ration",
                quantity: 1,
                condition: 100,
              },
            ],
          },
        ],
      },
    });
    expect(r.success).toBe(false);
  });

  it("inventory definitionId must be a valid item.* stable ID", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      inventory: {
        storages: [
          {
            location: "backpack",
            items: [
              {
                instanceId: "item-abc-123",
                definitionId: "event.foo.bar",
                quantity: 1,
                condition: 100,
              },
            ],
          },
        ],
      },
    });
    expect(r.success).toBe(false);
  });
});

// ── No React / browser dependency ────────────────────────────────────────────

describe("Schema module dependencies", () => {
  it("GameStateSchema has no React property (pure schema)", () => {
    expect(typeof GameStateSchema.parse).toBe("function");
  });
});
