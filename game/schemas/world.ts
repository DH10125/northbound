/**
 * World and environment state schema.
 */

import { z } from "zod";
import { PhaseSchema, WeatherSchema } from "./route";

export const WorldStateSchema = z.object({
  /** In-world elapsed hours since run start. */
  elapsedHours: z.number().min(0),
  /** Current day count (1-based). */
  day: z.number().int().min(1),
  phase: PhaseSchema,
  weather: WeatherSchema,
  /** Moon phase 0–7 (0 = new moon). */
  moonPhase: z.number().int().min(0).max(7),
  /** Environmental hazards active in current location. */
  activeHazards: z.array(z.string()),
  /** Noise level the party is currently generating (0–100). */
  noiseLevel: z.number().int().min(0).max(100),
  /** Party's current visibility exposure (0–100). */
  visibilityExposure: z.number().int().min(0).max(100),
});

export type WorldState = z.infer<typeof WorldStateSchema>;
