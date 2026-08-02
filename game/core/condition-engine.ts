/**
 * Condition engine — pure, deterministic condition progression and treatment.
 *
 * Responsibilities:
 *   1. Tick conditions each turn (progression or recovery).
 *   2. Apply per-turn meter effects from active conditions.
 *   3. Handle treatment actions (consume items, advance treatment).
 *   4. Apply permanent modifiers when conditions reach critical untreated.
 *   5. Provide symptom visibility based on medical skill.
 *
 * This is a fictional game mechanic — not medical advice.
 */

import type { ActiveCondition, PermanentModifier } from "../schemas/conditions";
import { CONDITION_STAGES } from "../schemas/conditions";
import { getConditionDefinition } from "../content/conditions";
import type { DomainEvent } from "./domain-events";
import type { Meters } from "../schemas/meters";

// ── Types ────────────────────────────────────────────────────────────────────

export type ConditionTickResult = {
  conditions: ActiveCondition[];
  permanentModifiers: PermanentModifier[];
  meterDeltas: Partial<Record<keyof Meters, number>>;
  events: DomainEvent[];
  /** Conditions that were removed (recovered). */
  recovered: string[];
};

export type TreatmentResult =
  | { ok: true; condition: ActiveCondition; events: DomainEvent[] }
  | { ok: false; reason: string };

export type SymptomVisibility = {
  conditionId: string;
  name: string;
  stage: string;
  symptoms: string[];
  severeRisk: boolean;
  severeRiskWarning?: string;
  uncertaintyNote: string;
};

// ── Condition tick (called once per turn) ────────────────────────────────────

/**
 * Advance all active conditions by one turn.
 * - Untreated conditions progress toward next stage.
 * - Treated conditions accumulate treatment turns; when enough, they recover one stage.
 * - Rest slows progression for conditions that support it (treated as half-speed).
 * - Critical untreated conditions apply permanent modifiers.
 */
export function tickConditions(
  conditions: ReadonlyArray<ActiveCondition>,
  permanentModifiers: ReadonlyArray<PermanentModifier>,
  isResting: boolean,
): ConditionTickResult {
  const nextConditions: ActiveCondition[] = [];
  const nextModifiers: PermanentModifier[] = [...permanentModifiers];
  const meterDeltas: Partial<Record<keyof Meters, number>> = {};
  const events: DomainEvent[] = [];
  const recovered: string[] = [];

  for (const cond of conditions) {
    const def = getConditionDefinition(cond.conditionId);
    if (!def) {
      // Unknown condition — preserve it without ticking
      nextConditions.push(cond);
      continue;
    }

    const stage = CONDITION_STAGES[cond.stageIndex]!;
    const stageDef = def.stages[stage];

    // Apply per-turn meter effects
    for (const [meter, delta] of Object.entries(stageDef.perTurnEffects)) {
      const key = meter as keyof Meters;
      meterDeltas[key] = (meterDeltas[key] ?? 0) + delta;
    }

    // Treatment path: accumulate treatment turns
    if (cond.treated) {
      const newTreatmentTurns = cond.treatmentTurns + 1;

      if (newTreatmentTurns >= stageDef.treatmentTurnsRequired) {
        // Recovery: drop one stage
        if (cond.stageIndex === 0) {
          // Fully recovered
          recovered.push(cond.conditionId);
          events.push({
            type: "CONDITION_PROGRESS",
            subjectId: "player",
            conditionId: cond.conditionId,
            delta: -1,
          });
          continue;
        } else {
          // Drop one stage
          nextConditions.push({
            ...cond,
            stageIndex: cond.stageIndex - 1,
            turnsAtStage: 0,
            totalTurns: cond.totalTurns + 1,
            treatmentTurns: 0,
            treated: false, // Must re-apply treatment
          });
          events.push({
            type: "CONDITION_PROGRESS",
            subjectId: "player",
            conditionId: cond.conditionId,
            delta: -1,
          });
          continue;
        }
      } else {
        nextConditions.push({
          ...cond,
          turnsAtStage: cond.turnsAtStage + 1,
          totalTurns: cond.totalTurns + 1,
          treatmentTurns: newTreatmentTurns,
        });
        continue;
      }
    }

    // Untreated path: progression
    const turnsToProgress = stageDef.turnsToProgress;

    if (turnsToProgress === 0) {
      // Already at terminal stage — just persist
      nextConditions.push({
        ...cond,
        turnsAtStage: cond.turnsAtStage + 1,
        totalTurns: cond.totalTurns + 1,
      });
      continue;
    }

    // Rest can slow progression for some conditions
    const effectiveTurns = cond.turnsAtStage + 1;
    const threshold =
      isResting && def.restSlowsProgression
        ? turnsToProgress * 2
        : turnsToProgress;

    if (effectiveTurns >= threshold) {
      // Progress to next stage
      const newStageIndex = Math.min(cond.stageIndex + 1, 3);

      // If reaching critical untreated, apply permanent modifier
      if (
        newStageIndex === 3 &&
        cond.stageIndex < 3 &&
        def.permanentModifier &&
        !nextModifiers.some(
          (m) => m.sourceConditionId === cond.conditionId,
        )
      ) {
        nextModifiers.push({
          sourceConditionId: cond.conditionId,
          ...def.permanentModifier,
        });
      }

      nextConditions.push({
        ...cond,
        stageIndex: newStageIndex,
        turnsAtStage: 0,
        totalTurns: cond.totalTurns + 1,
        treatmentTurns: 0,
      });
      events.push({
        type: "CONDITION_PROGRESS",
        subjectId: "player",
        conditionId: cond.conditionId,
        delta: 1,
      });
    } else {
      nextConditions.push({
        ...cond,
        turnsAtStage: cond.turnsAtStage + 1,
        totalTurns: cond.totalTurns + 1,
      });
    }
  }

  return {
    conditions: nextConditions,
    permanentModifiers: nextModifiers,
    meterDeltas,
    events,
    recovered,
  };
}

// ── Treatment ────────────────────────────────────────────────────────────────

/**
 * Apply treatment to a specific condition. Marks it as treated.
 * Does NOT consume items — caller must handle inventory separately.
 */
export function applyTreatment(
  conditions: ReadonlyArray<ActiveCondition>,
  conditionId: string,
): TreatmentResult {
  const idx = conditions.findIndex((c) => c.conditionId === conditionId);
  if (idx === -1) {
    return { ok: false, reason: `Condition "${conditionId}" not active.` };
  }

  const cond = conditions[idx]!;
  if (cond.treated) {
    return {
      ok: false,
      reason: `Condition "${conditionId}" is already being treated.`,
    };
  }

  const updated: ActiveCondition = { ...cond, treated: true, treatmentTurns: 0 };
  return {
    ok: true,
    condition: updated,
    events: [
      {
        type: "CONDITION_PROGRESS",
        subjectId: "player",
        conditionId,
        delta: 0,
      },
    ],
  };
}

// ── Symptom visibility ───────────────────────────────────────────────────────

/**
 * Get visible symptoms for a condition based on observer's medical skill.
 * Lower medical skill sees only basic symptoms and more uncertainty.
 */
export function getSymptomVisibility(
  condition: ActiveCondition,
  medicalSkill: number,
): SymptomVisibility | null {
  const def = getConditionDefinition(condition.conditionId);
  if (!def) return null;

  const stage = CONDITION_STAGES[condition.stageIndex]!;
  const stageDef = def.stages[stage];

  const symptoms = [...stageDef.symptomsBasic];
  if (medicalSkill >= stageDef.medicalSkillThreshold) {
    symptoms.push(...stageDef.symptomsDetailed);
  }

  // Uncertainty is higher with lower medical skill
  let uncertaintyNote: string;
  if (medicalSkill >= stageDef.medicalSkillThreshold + 2) {
    uncertaintyNote = `Likely ${def.name.toLowerCase()}.`;
  } else if (medicalSkill >= stageDef.medicalSkillThreshold) {
    uncertaintyNote = `Consistent with ${def.name.toLowerCase()}, but uncertain.`;
  } else {
    uncertaintyNote = "Cause unclear — could be several things.";
  }

  return {
    conditionId: condition.conditionId,
    name: def.name,
    stage,
    symptoms,
    severeRisk: stageDef.severeRisk,
    severeRiskWarning: stageDef.severeRiskWarning,
    uncertaintyNote,
  };
}
