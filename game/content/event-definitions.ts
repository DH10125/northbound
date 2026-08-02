/**
 * Event definition types and schemas for authored event content.
 *
 * These types represent the contract between content authors and the event engine.
 * Event definitions are data — they never execute code or contain unsafe markup.
 */

import { z } from "zod";

// ── Condition tree ───────────────────────────────────────────────────────────

/**
 * Composable condition tree: all/any/not nodes + leaf predicates.
 * Validators reject unknown keys and impossible ranges.
 */
export const ConditionLeafSchema = z.object({
  /** The state path to check, e.g. "chapter", "flag", "meter.hunger", "inventory.tag" */
  field: z.string().min(1),
  /** Comparison operator */
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "has", "not-has"]),
  /** Value to compare against */
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export type ConditionLeaf = z.infer<typeof ConditionLeafSchema>;

export type ConditionTree =
  | { all: ConditionTree[] }
  | { any: ConditionTree[] }
  | { not: ConditionTree }
  | ConditionLeaf;

export const ConditionTreeSchema: z.ZodType<ConditionTree> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionTreeSchema) }),
    z.object({ any: z.array(ConditionTreeSchema) }),
    z.object({ not: ConditionTreeSchema }),
    ConditionLeafSchema,
  ]),
);

// ── Skill check ──────────────────────────────────────────────────────────────

export const SkillCheckSchema = z.object({
  /** Attribute or derived skill to test. */
  attribute: z.string().min(1),
  /** Difficulty threshold (1–20). */
  difficulty: z.number().int().min(1).max(20),
  /** Flat modifier applied before comparison. */
  modifier: z.number().int().default(0),
});

export type SkillCheck = z.infer<typeof SkillCheckSchema>;

/** Result tier of a skill check roll. */
export type SkillCheckTier =
  | "critical-failure"
  | "failure"
  | "success"
  | "critical-success";

// ── Effects ──────────────────────────────────────────────────────────────────

/**
 * An atomic effect applied to game state. Uses an allow-listed vocabulary.
 */
export const EffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meter"), meter: z.string().min(1), delta: z.number().int() }),
  z.object({ type: z.literal("flag-set"), flag: z.string().min(1) }),
  z.object({ type: z.literal("flag-clear"), flag: z.string().min(1) }),
  z.object({ type: z.literal("item-add"), itemId: z.string().min(1), quantity: z.number().int().min(1).default(1) }),
  z.object({ type: z.literal("item-remove"), itemId: z.string().min(1), quantity: z.number().int().min(1).default(1) }),
  z.object({ type: z.literal("time"), hours: z.number().int().min(1) }),
  z.object({ type: z.literal("reputation"), factionId: z.string().min(1), delta: z.number().int() }),
  z.object({ type: z.literal("follow-up"), eventId: z.string().min(1) }),
]);

export type Effect = z.infer<typeof EffectSchema>;

// ── Weighted outcome ─────────────────────────────────────────────────────────

export const WeightedOutcomeSchema = z.object({
  /** Weight for selection (non-negative, need not sum to 1). */
  weight: z.number().min(0),
  /** Which skill check tier(s) this outcome applies to. If omitted, applies to all. */
  tier: z.enum(["critical-failure", "failure", "success", "critical-success"]).optional(),
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

export const EventDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  tags: z.array(z.string()),
  /** Condition tree that must be satisfied for this event to be a candidate. */
  trigger: ConditionTreeSchema,
  /** Selection weight (higher = more likely when multiple events are candidates). */
  weight: z.number().min(0),
  /** Turns before this event can trigger again. */
  cooldownTurns: z.number().int().min(0).optional(),
  /** If true, this event fires at most once per run. */
  once: z.boolean().optional(),
  /** 2–6 options. */
  options: z.array(EventOptionSchema).min(2).max(6),
});

export type EventDefinition = z.infer<typeof EventDefinitionSchema>;
