/**
 * Faction reputation and relationship schemas.
 */

import { z } from "zod";
import { FactionIdSchema } from "./ids";

/** Reputation score: -100 (hostile) to +100 (allied). */
const ReputationScoreSchema = z.number().int().min(-100).max(100);

export const FactionRelationshipSchema = z.object({
  factionId: FactionIdSchema,
  reputation: ReputationScoreSchema,
  /** Outstanding promises (free-text slugs). */
  promises: z.array(z.string()),
  /** Outstanding debts in trade-good units. */
  debts: z.number().int().min(0),
  /** Active disguise ID if party is disguised within this faction. */
  disguiseId: z.string().optional(),
  /** Whether the party has territorial access. */
  hasAccess: z.boolean(),
});

export type FactionRelationship = z.infer<typeof FactionRelationshipSchema>;

export const FactionsStateSchema = z.object({
  relationships: z.array(FactionRelationshipSchema),
});

export type FactionsState = z.infer<typeof FactionsStateSchema>;
