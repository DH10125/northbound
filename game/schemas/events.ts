/**
 * Event history schemas (runtime tracking, not event definitions).
 * Event definitions live in game/content/.
 */

import { z } from "zod";
import { EventIdSchema } from "./ids";

export const EventHistoryEntrySchema = z.object({
  eventId: EventIdSchema,
  /** Which option the player chose. */
  chosenOptionId: z.string().min(1),
  /** In-world hour when this occurred. */
  resolvedAtHour: z.number().min(0),
  /** Whether a skill check occurred and its result. */
  skillCheckResult: z
    .enum(["critical-failure", "failure", "success", "critical-success"])
    .optional(),
  /** Flags set by this event. */
  flagsSet: z.array(z.string()),
});

export type EventHistoryEntry = z.infer<typeof EventHistoryEntrySchema>;

export const EventHistorySchema = z.object({
  entries: z.array(EventHistoryEntrySchema),
  /** Flags that are currently active (set and not cleared). */
  activeFlags: z.array(z.string()),
  /** eventId → turn it was last resolved (for cooldown checks). */
  cooldowns: z.record(z.string(), z.number().int().min(0)),
  /** Event ID queued by a follow-up effect; null if none pending. */
  pendingFollowUp: z.string().nullable().default(null),
});

export type EventHistory = z.infer<typeof EventHistorySchema>;
