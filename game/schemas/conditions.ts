/**
 * Condition schemas — staged illness/injury model.
 *
 * Conditions progress through stages (mild → moderate → severe → critical).
 * Each stage has observable symptoms, meter effects, and risk thresholds.
 * Treatment can halt or reverse progression. Some conditions leave
 * permanent modifiers after recovery.
 *
 * This is a fictional game mechanic — not medical advice.
 */

import { z } from "zod";

// ── Condition stage ──────────────────────────────────────────────────────────

export const ConditionStageSchema = z.enum([
  "mild",
  "moderate",
  "severe",
  "critical",
]);

export type ConditionStage = z.infer<typeof ConditionStageSchema>;

export const CONDITION_STAGES: readonly ConditionStage[] = [
  "mild",
  "moderate",
  "severe",
  "critical",
];

// ── Active condition instance (on a character) ───────────────────────────────

export const ActiveConditionSchema = z.object({
  /** The condition definition ID (e.g. "condition.dehydration"). */
  conditionId: z.string().min(1),
  /** Current stage index (0=mild, 1=moderate, 2=severe, 3=critical). */
  stageIndex: z.number().int().min(0).max(3),
  /** Turns elapsed since onset at current stage. */
  turnsAtStage: z.number().int().min(0),
  /** Total turns since condition was acquired. */
  totalTurns: z.number().int().min(0),
  /** Whether the condition is currently being treated (slows/reverses). */
  treated: z.boolean(),
  /** Turns of treatment applied at current stage. */
  treatmentTurns: z.number().int().min(0),
});

export type ActiveCondition = z.infer<typeof ActiveConditionSchema>;

// ── Permanent modifier ───────────────────────────────────────────────────────

export const PermanentModifierSchema = z.object({
  /** Source condition that caused this modifier. */
  sourceConditionId: z.string().min(1),
  /** Which attribute or capacity is affected. */
  target: z.string().min(1),
  /** Numeric adjustment (negative = penalty). */
  delta: z.number().int(),
  /** Human-readable description for UI. */
  label: z.string().min(1),
});

export type PermanentModifier = z.infer<typeof PermanentModifierSchema>;
