/**
 * Condition definitions — 6 representative conditions for the vertical slice.
 *
 * Each definition describes staged progression, symptoms at each stage,
 * treatment requirements, and potential permanent modifiers.
 *
 * This is a fictional game mechanic — not medical advice.
 * Progression rates and treatment costs are deterministic game values.
 *
 * Pure data — no React/browser dependencies.
 */

import { z } from "zod";
import type { ConditionStage } from "../schemas/conditions";

// ── Condition definition schema ──────────────────────────────────────────────

export const ConditionStageDefinitionSchema = z.object({
  /** Symptoms visible without medical skill. */
  symptomsBasic: z.array(z.string().min(1)),
  /** Additional symptoms visible with medical skill >= threshold. */
  symptomsDetailed: z.array(z.string().min(1)),
  /** Medical skill threshold to see detailed symptoms. */
  medicalSkillThreshold: z.number().int().min(1).max(10),
  /** Meter effects applied per turn at this stage. */
  perTurnEffects: z.record(z.string(), z.number().int()),
  /** Turns until progression to next stage (0 = does not progress further). */
  turnsToProgress: z.number().int().min(0),
  /** Turns of treatment needed to begin recovery at this stage. */
  treatmentTurnsRequired: z.number().int().min(1),
  /** Whether this stage carries severe risk (telegraphed to player). */
  severeRisk: z.boolean(),
  /** Warning text shown when severe risk applies. */
  severeRiskWarning: z.string().optional(),
});

export type ConditionStageDefinition = z.infer<
  typeof ConditionStageDefinitionSchema
>;

export const ConditionDefinitionSchema = z.object({
  id: z.string().min(1),
  /** Display name. */
  name: z.string().min(1).max(64),
  /** Short fictional description. */
  description: z.string().min(1).max(300),
  /** Category for UI grouping. */
  category: z.enum(["illness", "injury", "exposure"]),
  /** Stage definitions indexed by ConditionStage. */
  stages: z.object({
    mild: ConditionStageDefinitionSchema,
    moderate: ConditionStageDefinitionSchema,
    severe: ConditionStageDefinitionSchema,
    critical: ConditionStageDefinitionSchema,
  }),
  /** Item definition ID required for treatment. */
  treatmentItemId: z.string().min(1),
  /** Number of treatment items consumed per treatment action. */
  treatmentItemCost: z.number().int().min(1),
  /** Whether rest alone can slow progression (without treatment items). */
  restSlowsProgression: z.boolean(),
  /** Permanent modifier applied if condition reaches critical untreated. */
  permanentModifier: z
    .object({
      target: z.string().min(1),
      delta: z.number().int(),
      label: z.string().min(1),
    })
    .nullable(),
});

export type ConditionDefinition = z.infer<typeof ConditionDefinitionSchema>;

// ── 6 representative conditions ──────────────────────────────────────────────

const RAW_CONDITIONS = [
  {
    id: "condition.dehydration",
    name: "Dehydration",
    description:
      "Your body is running low on water. Worsens fast in the heat. Clean water is the only fix.",
    category: "exposure",
    stages: {
      mild: {
        symptomsBasic: ["Dry mouth", "Mild headache"],
        symptomsDetailed: ["Skin looks pinched", "Darker than usual output"],
        medicalSkillThreshold: 3,
        perTurnEffects: { fatigue: 2, thirst: 3 },
        turnsToProgress: 6,
        treatmentTurnsRequired: 2,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Dizziness", "Rapid heartbeat"],
        symptomsDetailed: ["Stumbles when standing", "Body slowing down"],
        medicalSkillThreshold: 4,
        perTurnEffects: { fatigue: 4, health: -2, thirst: 5 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 3,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["Confusion", "Weakness", "Dark urine"],
        symptomsDetailed: ["Heart racing", "Looks faint and unsteady"],
        medicalSkillThreshold: 5,
        perTurnEffects: { fatigue: 6, health: -5, pain: 3 },
        turnsToProgress: 3,
        treatmentTurnsRequired: 5,
        severeRisk: true,
        severeRiskWarning: "Without water soon, permanent damage seems likely.",
      },
      critical: {
        symptomsBasic: ["Unconscious", "Body shutting down"],
        symptomsDetailed: ["Multiple systems failing"],
        medicalSkillThreshold: 6,
        perTurnEffects: { health: -10, pain: 5 },
        turnsToProgress: 0,
        treatmentTurnsRequired: 8,
        severeRisk: true,
        severeRiskWarning: "Death is imminent without intervention.",
      },
    },
    treatmentItemId: "item.water.bottle-clean",
    treatmentItemCost: 1,
    restSlowsProgression: false,
    permanentModifier: {
      target: "endurance",
      delta: -1,
      label: "Worn out (past dehydration crisis)",
    },
  },
  {
    id: "condition.heat-illness",
    name: "Heat Illness",
    description:
      "Overheating from exertion in high temperatures. Shade, rest, and water are essential.",
    category: "exposure",
    stages: {
      mild: {
        symptomsBasic: ["Heavy sweating", "Muscle cramps"],
        symptomsDetailed: ["Running hot", "Salt-starved muscles"],
        medicalSkillThreshold: 3,
        perTurnEffects: { fatigue: 3, thirst: 4 },
        turnsToProgress: 5,
        treatmentTurnsRequired: 2,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Nausea", "Intense headache", "Weakness"],
        symptomsDetailed: ["Getting hotter", "Pale and clammy"],
        medicalSkillThreshold: 4,
        perTurnEffects: { fatigue: 5, health: -3, stress: 3 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 3,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["Stopped sweating", "Confusion", "Hot dry skin"],
        symptomsDetailed: ["Dangerously overheated"],
        medicalSkillThreshold: 5,
        perTurnEffects: { health: -7, pain: 4, fatigue: 5 },
        turnsToProgress: 2,
        treatmentTurnsRequired: 5,
        severeRisk: true,
        severeRiskWarning:
          "The heat is taking over. Permanent damage or death likely without cooling.",
      },
      critical: {
        symptomsBasic: ["Seizures", "Blacking out"],
        symptomsDetailed: ["Body breaking down from heat"],
        medicalSkillThreshold: 6,
        perTurnEffects: { health: -12, pain: 6 },
        turnsToProgress: 0,
        treatmentTurnsRequired: 8,
        severeRisk: true,
        severeRiskWarning: "Fatal without immediate cooling and water.",
      },
    },
    treatmentItemId: "item.water.bottle-clean",
    treatmentItemCost: 2,
    restSlowsProgression: true,
    permanentModifier: {
      target: "endurance",
      delta: -1,
      label: "Heat sensitivity (never fully recovered)",
    },
  },
  {
    id: "condition.dysentery",
    name: "Gut Sickness",
    description:
      "Something bad in the water or food. Drains fluids fast. Needs medicine and rest.",
    category: "illness",
    stages: {
      mild: {
        symptomsBasic: ["Stomach cramps", "Frequent trips to the bushes"],
        symptomsDetailed: ["Low fever", "Looks rough around the edges"],
        medicalSkillThreshold: 3,
        perTurnEffects: { thirst: 4, hunger: 2, fatigue: 2 },
        turnsToProgress: 5,
        treatmentTurnsRequired: 3,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Blood in stool", "Fever", "Bad cramps"],
        symptomsDetailed: ["Drying out fast", "Belly tender to touch"],
        medicalSkillThreshold: 4,
        perTurnEffects: { health: -3, thirst: 6, fatigue: 4, pain: 3 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 4,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["Constant pain", "Can't keep fluids down", "Weakness"],
        symptomsDetailed: ["Severely dried out", "Burning up"],
        medicalSkillThreshold: 5,
        perTurnEffects: { health: -6, thirst: 8, pain: 5, fatigue: 5 },
        turnsToProgress: 3,
        treatmentTurnsRequired: 6,
        severeRisk: true,
        severeRiskWarning:
          "The sickness is draining them dry. Needs medicine and fluids now.",
      },
      critical: {
        symptomsBasic: ["Going into shock", "Barely conscious"],
        symptomsDetailed: ["Poison spreading", "Body under extreme strain"],
        medicalSkillThreshold: 6,
        perTurnEffects: { health: -10, pain: 6 },
        turnsToProgress: 0,
        treatmentTurnsRequired: 8,
        severeRisk: true,
        severeRiskWarning: "Fatal without sustained treatment.",
      },
    },
    treatmentItemId: "item.medicine.antibiotics",
    treatmentItemCost: 1,
    restSlowsProgression: true,
    permanentModifier: {
      target: "endurance",
      delta: -1,
      label: "Weakened gut (never fully healed)",
    },
  },
  {
    id: "condition.wound-infection",
    name: "Wound Infection",
    description:
      "An untreated wound has gone bad. Needs cleaning and medicine before it spreads.",
    category: "injury",
    stages: {
      mild: {
        symptomsBasic: ["Redness around wound", "Warmth", "Mild swelling"],
        symptomsDetailed: ["Oozing from the wound", "Glands swelling nearby"],
        medicalSkillThreshold: 2,
        perTurnEffects: { pain: 2, infection: 3 },
        turnsToProgress: 6,
        treatmentTurnsRequired: 2,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Spreading redness", "Pus", "Fever"],
        symptomsDetailed: [
          "Infection creeping outward",
          "Red lines near wound",
        ],
        medicalSkillThreshold: 4,
        perTurnEffects: { pain: 4, infection: 5, health: -2 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 4,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["High fever", "Wound smells foul", "Red streaks"],
        symptomsDetailed: [
          "Infection spreading through body",
          "Flesh going dark",
        ],
        medicalSkillThreshold: 5,
        perTurnEffects: { health: -6, pain: 5, infection: 7 },
        turnsToProgress: 3,
        treatmentTurnsRequired: 6,
        severeRisk: true,
        severeRiskWarning:
          "The infection is spreading fast. Needs treatment immediately.",
      },
      critical: {
        symptomsBasic: ["Delirious", "Rapid decline", "Burning up"],
        symptomsDetailed: ["Poison throughout the body"],
        medicalSkillThreshold: 6,
        perTurnEffects: { health: -12, pain: 7, infection: 10 },
        turnsToProgress: 0,
        treatmentTurnsRequired: 10,
        severeRisk: true,
        severeRiskWarning:
          "Blood poisoning will be fatal without intensive care.",
      },
    },
    treatmentItemId: "item.medicine.antibiotics",
    treatmentItemCost: 1,
    restSlowsProgression: false,
    permanentModifier: {
      target: "strength",
      delta: -1,
      label: "Deep scarring (badly healed wound)",
    },
  },
  {
    id: "condition.fracture",
    name: "Broken Bone",
    description:
      "A bad break that needs to be set and splinted. Moving makes it worse.",
    category: "injury",
    stages: {
      mild: {
        symptomsBasic: ["Sharp pain on movement", "Swelling"],
        symptomsDetailed: ["Might be cracked", "Very tender to touch"],
        medicalSkillThreshold: 4,
        perTurnEffects: { pain: 4, fatigue: 2 },
        turnsToProgress: 8,
        treatmentTurnsRequired: 3,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Can't bear weight", "Visible bend", "Deep bruising"],
        symptomsDetailed: ["Bone shifted out of place", "Grinding sensation"],
        medicalSkillThreshold: 5,
        perTurnEffects: { pain: 6, fatigue: 3, health: -2 },
        turnsToProgress: 6,
        treatmentTurnsRequired: 5,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["Bone showing", "Extreme pain", "Can't function"],
        symptomsDetailed: ["Open break", "Limb turning pale below the injury"],
        medicalSkillThreshold: 6,
        perTurnEffects: { health: -5, pain: 8, fatigue: 4 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 8,
        severeRisk: true,
        severeRiskWarning:
          "The break is open and exposed. Risks going bad fast.",
      },
      critical: {
        symptomsBasic: ["Limb useless", "In shock", "Pale and cold"],
        symptomsDetailed: ["Limb swelling dangerously tight"],
        medicalSkillThreshold: 7,
        perTurnEffects: { health: -8, pain: 10 },
        turnsToProgress: 0,
        treatmentTurnsRequired: 12,
        severeRisk: true,
        severeRiskWarning: "May lose the limb — or worse — without help.",
      },
    },
    treatmentItemId: "item.medicine.bandage",
    treatmentItemCost: 2,
    restSlowsProgression: true,
    permanentModifier: {
      target: "agility",
      delta: -1,
      label: "Stiff limb (badly healed break)",
    },
  },
  {
    id: "condition.smoke-exposure",
    name: "Smoke Lungs",
    description:
      "Breathing too much smoke. Needs clean air and rest to clear up.",
    category: "exposure",
    stages: {
      mild: {
        symptomsBasic: ["Coughing", "Burning eyes", "Scratchy throat"],
        symptomsDetailed: ["Airways irritated", "Slightly winded"],
        medicalSkillThreshold: 3,
        perTurnEffects: { fatigue: 3, pain: 1, toxicExposure: 2 },
        turnsToProgress: 6,
        treatmentTurnsRequired: 2,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Persistent cough", "Short of breath", "Chest hurts"],
        symptomsDetailed: ["Wheezing on exhale", "Struggling for air"],
        medicalSkillThreshold: 4,
        perTurnEffects: { fatigue: 5, health: -2, pain: 3, toxicExposure: 4 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 4,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: [
          "Can't take a deep breath",
          "Lips turning blue",
          "Constant cough",
        ],
        symptomsDetailed: ["Lungs seizing up", "Smoke damage setting in deep"],
        medicalSkillThreshold: 5,
        perTurnEffects: { health: -6, pain: 5, fatigue: 6, toxicExposure: 6 },
        turnsToProgress: 3,
        treatmentTurnsRequired: 6,
        severeRisk: true,
        severeRiskWarning:
          "Lung damage may become permanent without clean air and rest.",
      },
      critical: {
        symptomsBasic: ["Can't breathe", "Blacking out"],
        symptomsDetailed: ["Lungs failing"],
        medicalSkillThreshold: 6,
        perTurnEffects: { health: -10, pain: 6 },
        turnsToProgress: 0,
        treatmentTurnsRequired: 10,
        severeRisk: true,
        severeRiskWarning: "Suffocation imminent.",
      },
    },
    treatmentItemId: "item.medicine.bandage",
    treatmentItemCost: 1,
    restSlowsProgression: true,
    permanentModifier: {
      target: "endurance",
      delta: -1,
      label: "Scarred lungs (never fully cleared)",
    },
  },
] as const;

// Validate all definitions at module load time.
export const CONDITIONS: ReadonlyArray<ConditionDefinition> =
  RAW_CONDITIONS.map((raw) => ConditionDefinitionSchema.parse(raw));

/** Look up a condition definition by ID. */
export function getConditionDefinition(
  id: string,
): ConditionDefinition | undefined {
  return CONDITIONS.find((c) => c.id === id);
}

/** All valid condition IDs. */
export const CONDITION_IDS: ReadonlyArray<string> = CONDITIONS.map((c) => c.id);
