/**
 * Player settings and accessibility options schema.
 */

import { z } from "zod";

export const DifficultyPresetSchema = z.enum(["story", "normal", "hard"]);

export const SettingsSchema = z.object({
  difficulty: DifficultyPresetSchema,
  /** Show exact numeric values for meters and checks. */
  showNumbers: z.boolean(),
  /** Reduce or eliminate non-essential animations. */
  reducedMotion: z.boolean(),
  /** High-contrast colour palette. */
  highContrast: z.boolean(),
  /** Larger base font size. */
  largeText: z.boolean(),
  /** Enable/disable sensitivity content by tag. */
  sensitivityFilters: z.record(z.string(), z.boolean()),
  /** Show content warnings before sensitive events. */
  contentWarnings: z.boolean(),
  /** Screen-reader optimised turn-result presentation. */
  screenReaderMode: z.boolean(),
});

export type Settings = z.infer<typeof SettingsSchema>;
