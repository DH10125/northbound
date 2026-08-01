/**
 * Meter and attribute schemas – pure numeric clamps, no React/browser deps.
 */

import { z } from "zod";

/** Integer in [0, 100]. */
export const Meter0to100Schema = z.number().int().min(0).max(100);

/** Integer in [1, 10]. */
export const Attribute1to10Schema = z.number().int().min(1).max(10);

/** Non-negative integer. */
export const NonNegIntSchema = z.number().int().min(0);

// ── Primary attributes ────────────────────────────────────────────────────────

export const AttributesSchema = z.object({
  strength: Attribute1to10Schema,
  endurance: Attribute1to10Schema,
  agility: Attribute1to10Schema,
  awareness: Attribute1to10Schema,
  intelligence: Attribute1to10Schema,
  technical: Attribute1to10Schema,
  medical: Attribute1to10Schema,
  survival: Attribute1to10Schema,
  social: Attribute1to10Schema,
  resolve: Attribute1to10Schema,
});

export type Attributes = z.infer<typeof AttributesSchema>;

// ── Condition meters ─────────────────────────────────────────────────────────

export const MetersSchema = z.object({
  health: Meter0to100Schema,
  hunger: Meter0to100Schema,
  thirst: Meter0to100Schema,
  fatigue: Meter0to100Schema,
  /** Celsius-like comfort scale: 0 = hypothermia risk, 100 = heat-stroke risk, ~50 = comfortable. */
  temperature: Meter0to100Schema,
  stress: Meter0to100Schema,
  morale: Meter0to100Schema,
  infection: Meter0to100Schema,
  radiation: Meter0to100Schema,
  toxicExposure: Meter0to100Schema,
  cleanliness: Meter0to100Schema,
  pain: Meter0to100Schema,
  sleepDebt: Meter0to100Schema,
});

export type Meters = z.infer<typeof MetersSchema>;
