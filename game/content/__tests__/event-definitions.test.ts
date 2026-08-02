/**
 * Tests for event-definitions content validation:
 * - Field-specific operator/value compat
 * - Follow-up safety (self-ref, cycles, multiple follow-ups)
 */

import { describe, it, expect } from "vitest";
import {
  ConditionLeafSchema,
  validateEventRegistry,
} from "../event-definitions";
import type { EventDefinition } from "../event-definitions";

// ── ConditionLeaf field-op-value compat ──────────────────────────────────────

describe("ConditionLeafSchema field-specific validation", () => {
  it("rejects flag field with eq operator", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "flag",
      op: "eq",
      value: "some-flag",
    });
    expect(result.success).toBe(false);
  });

  it("accepts flag field with has operator", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "flag",
      op: "has",
      value: "some-flag",
    });
    expect(result.success).toBe(true);
  });

  it("rejects inventory field with gt operator", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "inventory",
      op: "gt",
      value: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts companion field with not-has", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "companion",
      op: "not-has",
      value: "companion.marisol",
    });
    expect(result.success).toBe(true);
  });

  it("rejects meter.health with has operator", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "meter.health",
      op: "has",
      value: "something",
    });
    expect(result.success).toBe(false);
  });

  it("accepts meter.health with gte and number", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "meter.health",
      op: "gte",
      value: 50,
    });
    expect(result.success).toBe(true);
  });

  it("rejects meter.fatigue with string value", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "meter.fatigue",
      op: "lt",
      value: "low",
    });
    expect(result.success).toBe(false);
  });

  it("rejects attribute.strength with has", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "attribute.strength",
      op: "has",
      value: "high",
    });
    expect(result.success).toBe(false);
  });

  it("accepts attribute.agility with gte and number", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "attribute.agility",
      op: "gte",
      value: 7,
    });
    expect(result.success).toBe(true);
  });

  it("rejects chapter field with gt operator", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "chapter",
      op: "gt",
      value: 2,
    });
    expect(result.success).toBe(false);
  });

  it("accepts chapter field with eq and string", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "chapter",
      op: "eq",
      value: "pensacola-escape",
    });
    expect(result.success).toBe(true);
  });

  it("rejects weather with numeric value", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "weather",
      op: "eq",
      value: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts pursuit.intensity with lt and number", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "pursuit.intensity",
      op: "lt",
      value: 50,
    });
    expect(result.success).toBe(true);
  });

  it("rejects visitedNode with eq", () => {
    const result = ConditionLeafSchema.safeParse({
      field: "visitedNode",
      op: "eq",
      value: "node.x",
    });
    expect(result.success).toBe(false);
  });
});

// ── Follow-up validation ─────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<EventDefinition> & { id: string },
): EventDefinition {
  const { id, ...rest } = overrides;
  return {
    id,
    version: 1,
    title: "Test",
    text: "Test text",
    tags: [],
    trigger: { field: "chapter", op: "eq" as const, value: "test" },
    weight: 1,
    once: false,
    options: [
      {
        id: "a",
        label: "A",
        outcomes: [{ weight: 1, text: "Ok", effects: [] }],
      },
      {
        id: "b",
        label: "B",
        outcomes: [{ weight: 1, text: "Ok", effects: [] }],
      },
    ],
    ...rest,
  };
}

describe("validateEventRegistry follow-up safety", () => {
  it("rejects self-referencing follow-up", () => {
    const events = [
      makeEvent({
        id: "event.self",
        options: [
          {
            id: "a",
            label: "A",
            outcomes: [
              {
                weight: 1,
                text: "Ok",
                effects: [{ type: "follow-up", eventId: "event.self" }],
              },
            ],
          },
          {
            id: "b",
            label: "B",
            outcomes: [{ weight: 1, text: "Ok", effects: [] }],
          },
        ],
      }),
    ];
    const result = validateEventRegistry(events);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("self-referencing"))).toBe(
      true,
    );
  });

  it("rejects cyclic follow-up chain (A→B→A)", () => {
    const events = [
      makeEvent({
        id: "event.a",
        options: [
          {
            id: "a",
            label: "A",
            outcomes: [
              {
                weight: 1,
                text: "Ok",
                effects: [{ type: "follow-up", eventId: "event.b" }],
              },
            ],
          },
          {
            id: "b",
            label: "B",
            outcomes: [{ weight: 1, text: "Ok", effects: [] }],
          },
        ],
      }),
      makeEvent({
        id: "event.b",
        options: [
          {
            id: "a",
            label: "A",
            outcomes: [
              {
                weight: 1,
                text: "Ok",
                effects: [{ type: "follow-up", eventId: "event.a" }],
              },
            ],
          },
          {
            id: "b",
            label: "B",
            outcomes: [{ weight: 1, text: "Ok", effects: [] }],
          },
        ],
      }),
    ];
    const result = validateEventRegistry(events);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("cycle"))).toBe(true);
  });

  it("rejects multiple follow-up effects in one outcome", () => {
    const events = [
      makeEvent({
        id: "event.multi",
        options: [
          {
            id: "a",
            label: "A",
            outcomes: [
              {
                weight: 1,
                text: "Ok",
                effects: [
                  { type: "follow-up", eventId: "event.x" },
                  { type: "follow-up", eventId: "event.y" },
                ],
              },
            ],
          },
          {
            id: "b",
            label: "B",
            outcomes: [{ weight: 1, text: "Ok", effects: [] }],
          },
        ],
      }),
      makeEvent({ id: "event.x" }),
      makeEvent({ id: "event.y" }),
    ];
    const result = validateEventRegistry(events);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("multiple follow-up"))).toBe(
      true,
    );
  });

  it("rejects unknown follow-up target", () => {
    const events = [
      makeEvent({
        id: "event.a",
        options: [
          {
            id: "a",
            label: "A",
            outcomes: [
              {
                weight: 1,
                text: "Ok",
                effects: [{ type: "follow-up", eventId: "event.missing" }],
              },
            ],
          },
          {
            id: "b",
            label: "B",
            outcomes: [{ weight: 1, text: "Ok", effects: [] }],
          },
        ],
      }),
    ];
    const result = validateEventRegistry(events);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unknown follow-up"))).toBe(
      true,
    );
  });

  it("accepts valid linear follow-up chain (A→B→C)", () => {
    const events = [
      makeEvent({
        id: "event.a",
        options: [
          {
            id: "a",
            label: "A",
            outcomes: [
              {
                weight: 1,
                text: "Ok",
                effects: [{ type: "follow-up", eventId: "event.b" }],
              },
            ],
          },
          {
            id: "b",
            label: "B",
            outcomes: [{ weight: 1, text: "Ok", effects: [] }],
          },
        ],
      }),
      makeEvent({
        id: "event.b",
        options: [
          {
            id: "a",
            label: "A",
            outcomes: [
              {
                weight: 1,
                text: "Ok",
                effects: [{ type: "follow-up", eventId: "event.c" }],
              },
            ],
          },
          {
            id: "b",
            label: "B",
            outcomes: [{ weight: 1, text: "Ok", effects: [] }],
          },
        ],
      }),
      makeEvent({ id: "event.c" }),
    ];
    const result = validateEventRegistry(events);
    expect(result.valid).toBe(true);
  });
});
