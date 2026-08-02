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
      "Insufficient water intake. Progresses rapidly in heat. Rest and clean water reverse it.",
    category: "exposure",
    stages: {
      mild: {
        symptomsBasic: ["Dry mouth", "Mild headache"],
        symptomsDetailed: ["Decreased skin turgor", "Concentrated urine"],
        medicalSkillThreshold: 3,
        perTurnEffects: { fatigue: 2, thirst: 3 },
        turnsToProgress: 6,
        treatmentTurnsRequired: 2,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Dizziness", "Rapid heartbeat"],
        symptomsDetailed: ["Orthostatic changes", "Reduced output"],
        medicalSkillThreshold: 4,
        perTurnEffects: { fatigue: 4, health: -2, thirst: 5 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 3,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["Confusion", "Weakness", "Dark urine"],
        symptomsDetailed: ["Tachycardia", "Hypotension signs"],
        medicalSkillThreshold: 5,
        perTurnEffects: { fatigue: 6, health: -5, pain: 3 },
        turnsToProgress: 3,
        treatmentTurnsRequired: 5,
        severeRisk: true,
        severeRiskWarning: "Without water soon, permanent damage seems likely.",
      },
      critical: {
        symptomsBasic: ["Unconsciousness", "Organ failure signs"],
        symptomsDetailed: ["Multi-system failure indicators"],
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
      label: "Kidney strain (past dehydration crisis)",
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
        symptomsDetailed: ["Elevated core temperature", "Salt depletion signs"],
        medicalSkillThreshold: 3,
        perTurnEffects: { fatigue: 3, thirst: 4 },
        turnsToProgress: 5,
        treatmentTurnsRequired: 2,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Nausea", "Intense headache", "Weakness"],
        symptomsDetailed: ["Core temp rising", "Pale clammy skin"],
        medicalSkillThreshold: 4,
        perTurnEffects: { fatigue: 5, health: -3, stress: 3 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 3,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["Stopped sweating", "Confusion", "Hot dry skin"],
        symptomsDetailed: ["Dangerously elevated temperature"],
        medicalSkillThreshold: 5,
        perTurnEffects: { health: -7, pain: 4, fatigue: 5 },
        turnsToProgress: 2,
        treatmentTurnsRequired: 5,
        severeRisk: true,
        severeRiskWarning:
          "Heatstroke is setting in. Permanent damage or death likely without cooling.",
      },
      critical: {
        symptomsBasic: ["Seizures", "Loss of consciousness"],
        symptomsDetailed: ["Organ damage indicators"],
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
      label: "Heat sensitivity (past heatstroke)",
    },
  },
  {
    id: "condition.dysentery",
    name: "Dysentery",
    description:
      "Severe intestinal infection from contaminated water or food. Causes rapid dehydration.",
    category: "illness",
    stages: {
      mild: {
        symptomsBasic: ["Stomach cramps", "Frequent bowel movements"],
        symptomsDetailed: ["Mild fever", "Mucus in stool"],
        medicalSkillThreshold: 3,
        perTurnEffects: { thirst: 4, hunger: 2, fatigue: 2 },
        turnsToProgress: 5,
        treatmentTurnsRequired: 3,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Bloody stool", "Fever", "Severe cramps"],
        symptomsDetailed: ["Signs of dehydration", "Abdominal tenderness"],
        medicalSkillThreshold: 4,
        perTurnEffects: { health: -3, thirst: 6, fatigue: 4, pain: 3 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 4,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["Constant pain", "Cannot keep fluids down", "Weakness"],
        symptomsDetailed: ["Severe dehydration markers", "High fever"],
        medicalSkillThreshold: 5,
        perTurnEffects: { health: -6, thirst: 8, pain: 5, fatigue: 5 },
        turnsToProgress: 3,
        treatmentTurnsRequired: 6,
        severeRisk: true,
        severeRiskWarning:
          "Dehydration from dysentery may become fatal without antibiotics and fluids.",
      },
      critical: {
        symptomsBasic: ["Shock symptoms", "Minimal consciousness"],
        symptomsDetailed: ["Septic indicators", "Organ stress"],
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
      label: "Weakened gut (past severe dysentery)",
    },
  },
  {
    id: "condition.wound-infection",
    name: "Wound Infection",
    description:
      "An untreated wound has become infected. Requires cleaning and antibiotics.",
    category: "injury",
    stages: {
      mild: {
        symptomsBasic: ["Redness around wound", "Warmth", "Mild swelling"],
        symptomsDetailed: [
          "Purulent drainage beginning",
          "Local lymph response",
        ],
        medicalSkillThreshold: 2,
        perTurnEffects: { pain: 2, infection: 3 },
        turnsToProgress: 6,
        treatmentTurnsRequired: 2,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Spreading redness", "Pus", "Fever"],
        symptomsDetailed: ["Cellulitis pattern", "Lymphangitis streaks"],
        medicalSkillThreshold: 4,
        perTurnEffects: { pain: 4, infection: 5, health: -2 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 4,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["High fever", "Wound smells foul", "Red streaks"],
        symptomsDetailed: ["Systemic infection signs", "Tissue necrosis risk"],
        medicalSkillThreshold: 5,
        perTurnEffects: { health: -6, pain: 5, infection: 7 },
        turnsToProgress: 3,
        treatmentTurnsRequired: 6,
        severeRisk: true,
        severeRiskWarning:
          "This infection may become septic. Immediate treatment critical.",
      },
      critical: {
        symptomsBasic: ["Sepsis signs", "Delirium", "Rapid deterioration"],
        symptomsDetailed: ["Multi-organ involvement"],
        medicalSkillThreshold: 6,
        perTurnEffects: { health: -12, pain: 7, infection: 10 },
        turnsToProgress: 0,
        treatmentTurnsRequired: 10,
        severeRisk: true,
        severeRiskWarning: "Sepsis is likely fatal without intensive care.",
      },
    },
    treatmentItemId: "item.medicine.antibiotics",
    treatmentItemCost: 1,
    restSlowsProgression: false,
    permanentModifier: {
      target: "strength",
      delta: -1,
      label: "Tissue scarring (past severe infection)",
    },
  },
  {
    id: "condition.fracture",
    name: "Fracture",
    description:
      "A broken bone requiring immobilization. Travel worsens it significantly.",
    category: "injury",
    stages: {
      mild: {
        symptomsBasic: ["Sharp pain on movement", "Swelling"],
        symptomsDetailed: ["Possible hairline fracture", "Point tenderness"],
        medicalSkillThreshold: 4,
        perTurnEffects: { pain: 4, fatigue: 2 },
        turnsToProgress: 8,
        treatmentTurnsRequired: 3,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: ["Cannot bear weight", "Visible deformity", "Bruising"],
        symptomsDetailed: ["Displaced fracture likely", "Crepitus"],
        medicalSkillThreshold: 5,
        perTurnEffects: { pain: 6, fatigue: 3, health: -2 },
        turnsToProgress: 6,
        treatmentTurnsRequired: 5,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: ["Bone visible", "Extreme pain", "Cannot function"],
        symptomsDetailed: ["Open fracture", "Vascular compromise risk"],
        medicalSkillThreshold: 6,
        perTurnEffects: { health: -5, pain: 8, fatigue: 4 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 8,
        severeRisk: true,
        severeRiskWarning:
          "Open fracture risks infection and permanent disability.",
      },
      critical: {
        symptomsBasic: ["Limb non-functional", "Shock", "Pale and cold"],
        symptomsDetailed: ["Compartment syndrome signs"],
        medicalSkillThreshold: 7,
        perTurnEffects: { health: -8, pain: 10 },
        turnsToProgress: 0,
        treatmentTurnsRequired: 12,
        severeRisk: true,
        severeRiskWarning: "Limb loss or death without surgery.",
      },
    },
    treatmentItemId: "item.medicine.bandage",
    treatmentItemCost: 2,
    restSlowsProgression: true,
    permanentModifier: {
      target: "agility",
      delta: -1,
      label: "Impaired mobility (poorly healed fracture)",
    },
  },
  {
    id: "condition.smoke-exposure",
    name: "Smoke Exposure",
    description:
      "Lung irritation from prolonged smoke inhalation. Rest in clean air needed.",
    category: "exposure",
    stages: {
      mild: {
        symptomsBasic: ["Coughing", "Burning eyes", "Scratchy throat"],
        symptomsDetailed: ["Bronchial irritation", "Mild hypoxia signs"],
        medicalSkillThreshold: 3,
        perTurnEffects: { fatigue: 3, pain: 1, toxicExposure: 2 },
        turnsToProgress: 6,
        treatmentTurnsRequired: 2,
        severeRisk: false,
      },
      moderate: {
        symptomsBasic: [
          "Persistent cough",
          "Shortness of breath",
          "Chest pain",
        ],
        symptomsDetailed: ["Wheezing", "Decreased oxygen indicators"],
        medicalSkillThreshold: 4,
        perTurnEffects: { fatigue: 5, health: -2, pain: 3, toxicExposure: 4 },
        turnsToProgress: 4,
        treatmentTurnsRequired: 4,
        severeRisk: false,
      },
      severe: {
        symptomsBasic: [
          "Cannot breathe deeply",
          "Blue-tinged lips",
          "Constant cough",
        ],
        symptomsDetailed: ["Severe bronchospasm", "Chemical pneumonitis risk"],
        medicalSkillThreshold: 5,
        perTurnEffects: { health: -6, pain: 5, fatigue: 6, toxicExposure: 6 },
        turnsToProgress: 3,
        treatmentTurnsRequired: 6,
        severeRisk: true,
        severeRiskWarning:
          "Lung damage may become permanent without clean air and rest.",
      },
      critical: {
        symptomsBasic: ["Cannot breathe", "Loss of consciousness"],
        symptomsDetailed: ["Respiratory failure"],
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
      label: "Scarred lungs (past severe smoke exposure)",
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
