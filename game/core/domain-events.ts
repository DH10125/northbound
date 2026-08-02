/**
 * Domain events emitted by the reducer.
 *
 * Domain events are pure data records that describe what happened during a
 * turn — they are never commands (player intent) and never mutate state
 * directly. They power the journey summary, debug tooling, and the replay
 * harness.
 *
 * Naming: SCREAMING_SNAKE_CASE type discriminants, matching the architecture
 * doc examples.
 */

import { z } from "zod";

// ── Individual event schemas ───────────────────────────────────────────────────

export const TimeAdvancedEventSchema = z.object({
  type: z.literal("TIME_ADVANCED"),
  /** Hours advanced this turn. */
  hours: z.number().int().min(1),
  /** New elapsed-hours value after advance. */
  newElapsedHours: z.number().int().min(0),
});

export const ItemConsumedEventSchema = z.object({
  type: z.literal("ITEM_CONSUMED"),
  instanceId: z.string().min(1),
  definitionId: z.string().min(1),
  quantity: z.number().int().min(1),
});

export const ConditionProgressEventSchema = z.object({
  type: z.literal("CONDITION_PROGRESS"),
  /** "player" or a companion id string. */
  subjectId: z.string().min(1),
  conditionId: z.string().min(1),
  delta: z.number().int(),
});

export const EncounterStartedEventSchema = z.object({
  type: z.literal("ENCOUNTER_STARTED"),
  eventId: z.string().min(1),
});

export const MeterChangedEventSchema = z.object({
  type: z.literal("METER_CHANGED"),
  /** "player" or a companion id string. */
  subjectId: z.string().min(1),
  meter: z.string().min(1),
  delta: z.number().int(),
  newValue: z.number().int().min(0).max(100),
});

export const TravelAdvancedEventSchema = z.object({
  type: z.literal("TRAVEL_ADVANCED"),
  distanceCovered: z.number().int().min(0),
  newDistanceRemaining: z.number().int().min(0),
});

export const CommandRejectedEventSchema = z.object({
  type: z.literal("COMMAND_REJECTED"),
  reason: z.string().min(1),
});

// ── Discriminated union ───────────────────────────────────────────────────────

export const DomainEventSchema = z.discriminatedUnion("type", [
  TimeAdvancedEventSchema,
  ItemConsumedEventSchema,
  ConditionProgressEventSchema,
  EncounterStartedEventSchema,
  MeterChangedEventSchema,
  TravelAdvancedEventSchema,
  CommandRejectedEventSchema,
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type TimeAdvancedEvent = z.infer<typeof TimeAdvancedEventSchema>;
export type ItemConsumedEvent = z.infer<typeof ItemConsumedEventSchema>;
export type ConditionProgressEvent = z.infer<
  typeof ConditionProgressEventSchema
>;
export type EncounterStartedEvent = z.infer<typeof EncounterStartedEventSchema>;
export type MeterChangedEvent = z.infer<typeof MeterChangedEventSchema>;
export type TravelAdvancedEvent = z.infer<typeof TravelAdvancedEventSchema>;
export type CommandRejectedEvent = z.infer<typeof CommandRejectedEventSchema>;
