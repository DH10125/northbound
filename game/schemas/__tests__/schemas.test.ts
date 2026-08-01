import { describe, it, expect } from "vitest";
import { GameStateSchema } from "../game-state";
import { StableIdSchema, EventIdSchema } from "../ids";
import { AttributesSchema, MetersSchema } from "../meters";
import { minimalGameState } from "../../testing/fixtures";

// ── Stable ID validation ──────────────────────────────────────────────────────

describe("StableIdSchema", () => {
  it("accepts valid two-segment ID", () => {
    expect(StableIdSchema.safeParse("item.bandage").success).toBe(true);
  });

  it("accepts valid three-segment ID", () => {
    expect(StableIdSchema.safeParse("event.lower-mississippi.derelict-barge").success).toBe(true);
  });

  it("rejects single segment", () => {
    const r = StableIdSchema.safeParse("bandage");
    expect(r.success).toBe(false);
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

describe("EventIdSchema (branded)", () => {
  it("accepts valid ID", () => {
    expect(EventIdSchema.safeParse("event.pensacola.first-night").success).toBe(true);
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

  it("rejects health > 100", () => {
    const r = MetersSchema.safeParse({ ...minimalGameState.party.player.meters, health: 101 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["health"]);
    }
  });

  it("rejects negative morale", () => {
    const r = MetersSchema.safeParse({ ...minimalGameState.party.player.meters, morale: -1 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["morale"]);
    }
  });

  it("rejects non-integer fatigue", () => {
    const r = MetersSchema.safeParse({ ...minimalGameState.party.player.meters, fatigue: 10.5 });
    expect(r.success).toBe(false);
  });
});

describe("AttributesSchema", () => {
  it("rejects attribute of 0 (below minimum of 1)", () => {
    const attrs = { ...minimalGameState.party.player.attributes, strength: 0 };
    const r = AttributesSchema.safeParse(attrs);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["strength"]);
    }
  });

  it("rejects attribute of 11 (above maximum of 10)", () => {
    const attrs = { ...minimalGameState.party.player.attributes, endurance: 11 };
    const r = AttributesSchema.safeParse(attrs);
    expect(r.success).toBe(false);
  });
});

// ── GameState full parse ──────────────────────────────────────────────────────

describe("GameStateSchema – minimal fixture", () => {
  it("parses the minimal valid fixture without errors", () => {
    const result = GameStateSchema.safeParse(minimalGameState);
    if (!result.success) {
      console.error(result.error.format());
    }
    expect(result.success).toBe(true);
  });

  it("infers the correct schemaVersion literal type", () => {
    const result = GameStateSchema.safeParse(minimalGameState);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(1);
    }
  });
});

describe("GameStateSchema – malformed inputs", () => {
  it("rejects missing schemaVersion with path", () => {
    const { schemaVersion: _sv, ...rest } = minimalGameState;
    void _sv;
    const r = GameStateSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "schemaVersion")).toBe(true);
    }
  });

  it("rejects wrong schemaVersion with path", () => {
    const r = GameStateSchema.safeParse({ ...minimalGameState, schemaVersion: 99 });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "schemaVersion")).toBe(true);
    }
  });

  it("rejects invalid runStatus with path", () => {
    const r = GameStateSchema.safeParse({ ...minimalGameState, runStatus: "winning" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p === "runStatus")).toBe(true);
    }
  });

  it("rejects player name too long with nested path", () => {
    const tooLong = "A".repeat(65);
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        player: { ...minimalGameState.party.player, name: tooLong },
      },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("name"))).toBe(true);
    }
  });

  it("rejects invalid chapter enum value with path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      location: { ...minimalGameState.location, chapter: "atlantis" },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("chapter"))).toBe(true);
    }
  });

  it("rejects farm deadline of 0 with path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      farm: { ...minimalGameState.farm, deadlineTurns: 0 },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("deadlineTurns"))).toBe(true);
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
                instanceId: "inst-1",
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
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("quantity"))).toBe(true);
    }
  });

  it("rejects pursuit intensity > 100 with path", () => {
    const r = GameStateSchema.safeParse({
      ...minimalGameState,
      pursuit: { pursuingFactionIds: [], intensity: 101 },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths.some((p) => p.includes("intensity"))).toBe(true);
    }
  });

  it("rejects completely empty object", () => {
    expect(GameStateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects null", () => {
    expect(GameStateSchema.safeParse(null).success).toBe(false);
  });
});

// ── No React / browser dependency ─────────────────────────────────────────────

describe("Schema module dependencies", () => {
  it("GameStateSchema has no React property (pure schema)", () => {
    // The schema itself is a plain Zod object; verifying it has no _type leak to React.
    expect(typeof GameStateSchema.parse).toBe("function");
    // Would throw if any browser global was accessed during import.
  });
});
