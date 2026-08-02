/**
 * Event definition types and schemas for authored event content.
 *
 * These types represent the contract between content authors and the event engine.
 * Event definitions are data — they never execute code or contain unsafe markup.
 */

import { z } from "zod";
import type { Meters, Attributes } from "../schemas/meters";

// ── Known vocabulary ─────────────────────────────────────────────────────────

/** All valid meter names (keys of MetersSchema). */
const KNOWN_METERS: ReadonlyArray<keyof Meters> = [
  "health",
  "hunger",
  "thirst",
  "fatigue",
  "temperature",
  "stress",
  "morale",
  "infection",
  "radiation",
  "toxicExposure",
  "cleanliness",
  "pain",
  "sleepDebt",
];

/** All valid attribute names (keys of AttributesSchema). */
const KNOWN_ATTRIBUTES: ReadonlyArray<keyof Attributes> = [
  "strength",
  "endurance",
  "agility",
  "awareness",
  "intelligence",
  "technical",
  "medical",
  "survival",
  "social",
  "resolve",
];

/** All valid condition fields for leaf predicates. */
const KNOWN_FIELDS = [
  "chapter",
  "terrain",
  "phase",
  "weather",
  "day",
  "elapsedHours",
  "noiseLevel",
  "runStatus",
  "flag",
  "inventory",
  "inventory.tag",
  "companion",
  "visitedNode",
  "hazard",
  "pursuit.intensity",
  ...KNOWN_METERS.map((m) => `meter.${m}`),
  ...KNOWN_ATTRIBUTES.map((a) => `attribute.${a}`),
] as const;

const KnownFieldSchema = z
  .string()
  .refine((v) => (KNOWN_FIELDS as readonly string[]).includes(v), {
    message: `Condition field must be one of the known vocabulary`,
  });

const KnownMeterSchema = z
  .string()
  .refine((v) => (KNOWN_METERS as readonly string[]).includes(v), {
    message: `Meter must be one of: ${KNOWN_METERS.join(", ")}`,
  });

const KnownAttributeSchema = z
  .string()
  .refine((v) => (KNOWN_ATTRIBUTES as readonly string[]).includes(v), {
    message: `Attribute must be one of: ${KNOWN_ATTRIBUTES.join(", ")}`,
  });

// ── Condition tree ───────────────────────────────────────────────────────────

/**
 * Composable condition tree: all/any/not nodes + leaf predicates.
 * Validates known fields and operator/value type compatibility.
 */
export const ConditionLeafSchema = z
  .object({
    /** The state path to check. Must be a known field. */
    field: KnownFieldSchema,
    /** Comparison operator */
    op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "has", "not-has"]),
    /** Value to compare against */
    value: z.union([z.string(), z.number(), z.boolean()]),
  })
  .superRefine((leaf, ctx) => {
    // has/not-has require string value
    if (leaf.op === "has" || leaf.op === "not-has") {
      if (typeof leaf.value !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Operator/value type mismatch: has/not-has require string value",
        });
      }
    }
    // gt/gte/lt/lte require numeric value
    if (["gt", "gte", "lt", "lte"].includes(leaf.op)) {
      if (typeof leaf.value !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Operator/value type mismatch: gt/gte/lt/lte require number value",
        });
      }
    }

    // Field-specific operator constraints
    const setFields = [
      "flag",
      "inventory",
      "inventory.tag",
      "companion",
      "visitedNode",
      "hazard",
    ];
    const numericFields = [
      "day",
      "elapsedHours",
      "noiseLevel",
      "pursuit.intensity",
      ...KNOWN_METERS.map((m) => `meter.${m}`),
      ...KNOWN_ATTRIBUTES.map((a) => `attribute.${a}`),
    ];
    const enumFields = ["chapter", "terrain", "phase", "weather", "runStatus"];

    if (setFields.includes(leaf.field)) {
      if (leaf.op !== "has" && leaf.op !== "not-has") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field "${leaf.field}" requires operator has/not-has`,
        });
      }
    } else if (numericFields.includes(leaf.field)) {
      if (leaf.op === "has" || leaf.op === "not-has") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Numeric field "${leaf.field}" cannot use has/not-has operator`,
        });
      }
      if (typeof leaf.value !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Numeric field "${leaf.field}" requires a number value`,
        });
      }
    } else if (enumFields.includes(leaf.field)) {
      if (leaf.op !== "eq" && leaf.op !== "neq") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Enum field "${leaf.field}" requires operator eq/neq`,
        });
      }
      if (typeof leaf.value !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Enum field "${leaf.field}" requires a string value`,
        });
      }
    }
  });

export type ConditionLeaf = z.infer<typeof ConditionLeafSchema>;

export type ConditionTree =
  | { all: ConditionTree[] }
  | { any: ConditionTree[] }
  | { not: ConditionTree }
  | ConditionLeaf;

export const ConditionTreeSchema: z.ZodType<ConditionTree> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionTreeSchema).min(1) }),
    z.object({ any: z.array(ConditionTreeSchema).min(1) }),
    z.object({ not: ConditionTreeSchema }),
    ConditionLeafSchema,
  ]),
);

// ── Skill check ──────────────────────────────────────────────────────────────

export const SkillCheckSchema = z.object({
  /** Attribute to test. Must be a known attribute. */
  attribute: KnownAttributeSchema,
  /** Difficulty threshold (1–20). */
  difficulty: z.number().int().min(1).max(20),
  /** Flat modifier applied before comparison. */
  modifier: z.number().int().default(0),
});

export type SkillCheck = z.infer<typeof SkillCheckSchema>;

/** Result tier of a skill check roll. */
export type SkillCheckTier =
  "critical-failure" | "failure" | "success" | "critical-success";

// ── Effects ──────────────────────────────────────────────────────────────────

/**
 * An atomic effect applied to game state. Uses an allow-listed vocabulary.
 * All declared effect types are fully implemented in the event engine.
 */
export const EffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meter"),
    meter: KnownMeterSchema,
    delta: z.number().int(),
  }),
  z.object({ type: z.literal("flag-set"), flag: z.string().min(1) }),
  z.object({ type: z.literal("flag-clear"), flag: z.string().min(1) }),
  z.object({
    type: z.literal("time"),
    hours: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("follow-up"),
    eventId: z.string().min(1),
  }),
]);

export type Effect = z.infer<typeof EffectSchema>;

// ── Weighted outcome ─────────────────────────────────────────────────────────

export const WeightedOutcomeSchema = z.object({
  /** Weight for selection (must be positive). */
  weight: z
    .number()
    .min(0)
    .refine((w) => w > 0, {
      message: "Outcome weight must be positive (> 0)",
    }),
  /** Which skill check tier(s) this outcome applies to. If omitted, applies to all. */
  tier: z
    .enum(["critical-failure", "failure", "success", "critical-success"])
    .optional(),
  /** Narrative text shown to the player. */
  text: z.string().min(1),
  /** Effects applied atomically if this outcome is chosen. */
  effects: z.array(EffectSchema).default([]),
});

export type WeightedOutcome = z.infer<typeof WeightedOutcomeSchema>;

// ── Event option ─────────────────────────────────────────────────────────────

export const EventOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Requirements to make this option available. If unmet, option shows but is disabled. */
  requirements: ConditionTreeSchema.optional(),
  /** Optional skill check for this option. */
  check: SkillCheckSchema.optional(),
  /** Weighted outcomes (at least one required). */
  outcomes: z.array(WeightedOutcomeSchema).min(1),
});

export type EventOption = z.infer<typeof EventOptionSchema>;

// ── Event definition ─────────────────────────────────────────────────────────

export const EventDefinitionSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().min(1),
    title: z.string().min(1),
    text: z.string().min(1),
    tags: z.array(z.string()),
    /** Condition tree that must be satisfied for this event to be a candidate. */
    trigger: ConditionTreeSchema,
    /** Selection weight (must be positive). */
    weight: z
      .number()
      .min(0)
      .refine((w) => w > 0, {
        message: "Event weight must be positive (> 0)",
      }),
    /** Turns before this event can trigger again. */
    cooldownTurns: z.number().int().min(0).optional(),
    /** If true, this event fires at most once per run. */
    once: z.boolean().optional(),
    /** 2–6 options. */
    options: z.array(EventOptionSchema).min(2).max(6),
  })
  .superRefine((event, ctx) => {
    // Enforce unique option IDs within an event
    const optionIds = new Set<string>();
    event.options.forEach((opt, idx) => {
      if (optionIds.has(opt.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate option ID "${opt.id}" in event "${event.id}"`,
          path: ["options", idx, "id"],
        });
      }
      optionIds.add(opt.id);
    });
  });

export type EventDefinition = z.infer<typeof EventDefinitionSchema>;

// ── Registry validation ──────────────────────────────────────────────────────

/**
 * Validate an array of event definitions for structural and reference integrity.
 * Checks: duplicate event IDs, follow-up references exist in registry.
 */
export function validateEventRegistry(events: ReadonlyArray<EventDefinition>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const eventIds = new Set<string>();

  // Check duplicate event IDs
  for (const event of events) {
    if (eventIds.has(event.id)) {
      errors.push(`Duplicate event ID: "${event.id}"`);
    }
    eventIds.add(event.id);
  }

  // Check follow-up references, self-refs, multiple follow-ups per outcome
  for (const event of events) {
    for (const option of event.options) {
      for (const outcome of option.outcomes) {
        const followUps = outcome.effects.filter((e) => e.type === "follow-up");
        if (followUps.length > 1) {
          errors.push(
            `Event "${event.id}" option "${option.id}" has multiple follow-up effects in one outcome`,
          );
        }
        for (const effect of followUps) {
          if (effect.type === "follow-up") {
            if (effect.eventId === event.id) {
              errors.push(
                `Event "${event.id}" has a self-referencing follow-up`,
              );
            } else if (!eventIds.has(effect.eventId)) {
              errors.push(
                `Event "${event.id}" references unknown follow-up "${effect.eventId}"`,
              );
            }
          }
        }
      }
    }
  }

  // Check for immediate cycles (A→B→A)
  const followUpGraph = new Map<string, Set<string>>();
  for (const event of events) {
    const targets = new Set<string>();
    for (const option of event.options) {
      for (const outcome of option.outcomes) {
        for (const effect of outcome.effects) {
          if (effect.type === "follow-up") {
            targets.add(effect.eventId);
          }
        }
      }
    }
    if (targets.size > 0) {
      followUpGraph.set(event.id, targets);
    }
  }

  // Detect cycles via DFS
  function hasCycle(start: string): boolean {
    const visited = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === start && visited.size > 0) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = followUpGraph.get(current);
      if (neighbors) {
        for (const n of neighbors) stack.push(n);
      }
    }
    return false;
  }

  for (const eventId of followUpGraph.keys()) {
    if (hasCycle(eventId)) {
      errors.push(`Follow-up cycle detected involving "${eventId}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}
