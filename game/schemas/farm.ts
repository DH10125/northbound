/**
 * Farm state schema.
 */

import { z } from "zod";

export const FarmSystemStatusSchema = z.enum([
  "good",
  "degraded",
  "critical",
  "failed",
]);

export const FarmStateSchema = z.object({
  /** Turns elapsed on the farm-deterioration clock. 0 = run start. */
  clockTurns: z.number().int().min(0),
  /** Deadline in turns; arrival after this means farm is unsalvageable. */
  deadlineTurns: z.number().int().min(1),
  well: FarmSystemStatusSchema,
  livestock: FarmSystemStatusSchema,
  crops: FarmSystemStatusSchema,
  structures: FarmSystemStatusSchema,
  seeds: FarmSystemStatusSchema,
  /** Whether the farm is currently under occupation. */
  occupied: z.boolean(),
  /** Whether an active fire is burning. */
  fire: z.boolean(),
  /** Family members still present (companion IDs or custom string IDs). */
  familyPresent: z.array(z.string()),
  /** Family members who have left or are unknown. */
  familyAbsent: z.array(z.string()),
  /** Flags for resolved finale sub-scenarios. */
  resolvedFlags: z.array(z.string()),
});

export type FarmState = z.infer<typeof FarmStateSchema>;
