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

export const NoEventEventSchema = z.object({
  type: z.literal("NO_EVENT"),
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

export const FarmClockTickedEventSchema = z.object({
  type: z.literal("FARM_CLOCK_TICKED"),
  /** Farm clock turns after this tick. */
  newClockTurns: z.number().int().min(0),
  /** Farm deadline turns (unchanged). */
  deadlineTurns: z.number().int().min(1),
});

export const TurnResolvedEventSchema = z.object({
  type: z.literal("TURN_RESOLVED"),
  /** Action that completed. */
  action: z.string().min(1),
  /** Phase at turn start. */
  phase: z.enum(["day", "dusk", "night", "dawn"]),
  /** Hours elapsed this turn. */
  hoursElapsed: z.number().int().min(1),
  /** Annotated meter/state changes for the resolution summary. */
  changes: z.array(
    z.object({
      field: z.string().min(1),
      before: z.number(),
      after: z.number(),
      delta: z.number(),
    }),
  ),
});

export const ItemTransferredEventSchema = z.object({
  type: z.literal("ITEM_TRANSFERRED"),
  instanceId: z.string().min(1),
  definitionId: z.string().min(1),
  quantity: z.number().int().min(1),
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
});

export const ItemSpoiledEventSchema = z.object({
  type: z.literal("ITEM_SPOILED"),
  instanceId: z.string().min(1),
  definitionId: z.string().min(1),
});

export const RouteChosenEventSchema = z.object({
  type: z.literal("ROUTE_CHOSEN"),
  edgeId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  distance: z.number().int().min(1),
});

export const ChapterTransitionedEventSchema = z.object({
  type: z.literal("CHAPTER_TRANSITIONED"),
  fromChapter: z.string().min(1),
  toChapter: z.string().min(1),
  atNodeId: z.string().min(1),
});

export const NavigationUncertaintyEventSchema = z.object({
  type: z.literal("NAVIGATION_UNCERTAINTY"),
  extraDistance: z.number().int().min(0),
  reason: z.string().min(1),
});

export const EncounterResolvedEventSchema = z.object({
  type: z.literal("ENCOUNTER_RESOLVED"),
  eventId: z.string().min(1),
  optionId: z.string().min(1),
  outcomeText: z.string(),
  tier: z.string().optional(),
});

export const RunEndedEventSchema = z.object({
  type: z.literal("RUN_ENDED"),
  reason: z.enum(["health-zero", "success", "abandoned"]),
  newRunStatus: z.string().min(1),
});

// ── Discriminated union ───────────────────────────────────────────────────────

export const DomainEventSchema = z.discriminatedUnion("type", [
  TimeAdvancedEventSchema,
  ItemConsumedEventSchema,
  ConditionProgressEventSchema,
  EncounterStartedEventSchema,
  NoEventEventSchema,
  MeterChangedEventSchema,
  TravelAdvancedEventSchema,
  CommandRejectedEventSchema,
  FarmClockTickedEventSchema,
  TurnResolvedEventSchema,
  ItemTransferredEventSchema,
  ItemSpoiledEventSchema,
  RouteChosenEventSchema,
  ChapterTransitionedEventSchema,
  NavigationUncertaintyEventSchema,
  EncounterResolvedEventSchema,
  RunEndedEventSchema,
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
export type FarmClockTickedEvent = z.infer<typeof FarmClockTickedEventSchema>;
export type TurnResolvedEvent = z.infer<typeof TurnResolvedEventSchema>;
export type ItemTransferredEvent = z.infer<typeof ItemTransferredEventSchema>;
export type ItemSpoiledEvent = z.infer<typeof ItemSpoiledEventSchema>;
export type RouteChosenEvent = z.infer<typeof RouteChosenEventSchema>;
export type ChapterTransitionedEvent = z.infer<
  typeof ChapterTransitionedEventSchema
>;
export type NavigationUncertaintyEvent = z.infer<
  typeof NavigationUncertaintyEventSchema
>;
export type EncounterResolvedEvent = z.infer<
  typeof EncounterResolvedEventSchema
>;
export type RunEndedEvent = z.infer<typeof RunEndedEventSchema>;
