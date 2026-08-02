/**
 * Character creation initializer — pure, deterministic, no React/browser deps.
 *
 * Given a validated CharacterDraft, produces a valid initial GameState.
 * The caller is responsible for providing a seed string and wall-clock timestamp.
 */

import { z } from "zod";
import type { GameState } from "../schemas/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "../schemas/game-state";
import { PronounsSchema, AgeRangeSchema } from "../schemas/party";
import { OccupationIdSchema } from "../schemas/ids";
import type { OccupationId, NodeId } from "../schemas/ids";
import {
  applyAttributeDeltas,
  getOccupation,
  OCCUPATION_IDS,
} from "../content/occupations";

// ── CharacterDraft schema ──────────────────────────────────────────────────────

/**
 * Trim-then-min(1) helper: transforms whitespace first, then validates length.
 * This ensures whitespace-only strings are rejected rather than silently emptied.
 */
const trimmedNonEmpty = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(max));

export const CharacterDraftSchema = z
  .object({
    name: trimmedNonEmpty(64),
    pronouns: PronounsSchema,
    /** Required when pronouns === "custom". Max 32 chars. */
    customPronouns: z.string().max(32).optional(),
    ageRange: AgeRangeSchema,
    /** Index into the allow-listed portrait/silhouette set. */
    portraitIndex: z.number().int().min(0).max(7),
    /**
     * Must be one of the eight authored occupation IDs.
     * Validated against the runtime set so unknown IDs are rejected at schema
     * parse time rather than deferred to buildInitialGameState.
     */
    occupationId: OccupationIdSchema.refine(
      (id) => (OCCUPATION_IDS as readonly string[]).includes(id),
      { message: "occupationId must be one of the eight authored occupations" },
    ),
    /** Player-authored motivation text (free field, 1–256 chars). */
    motivation: trimmedNonEmpty(256),
    /** Player-authored weakness text (free field, 1–256 chars). */
    weakness: trimmedNonEmpty(256),
    /** Difficulty preset for the run. */
    difficulty: z.enum(["story", "normal", "hard"]),
    /** Deterministic RNG seed for the run. */
    seed: z.string().min(1),
    /** ISO-8601 wall-clock timestamp when the run was started. */
    runStartedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((draft, ctx) => {
    if (draft.pronouns === "custom" && !draft.customPronouns?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customPronouns is required when pronouns is 'custom'",
        path: ["customPronouns"],
      });
    }
  });

export type CharacterDraft = z.infer<typeof CharacterDraftSchema>;

// ── Initializer ────────────────────────────────────────────────────────────────

/**
 * Build a valid initial GameState from a validated CharacterDraft.
 *
 * Throws if the occupationId references an unknown occupation.
 * Never throws for schema reasons — call CharacterDraftSchema.parse() first.
 */
export function buildInitialGameState(draft: CharacterDraft): GameState {
  const occupation = getOccupation(draft.occupationId as OccupationId);
  if (!occupation) {
    throw new Error(`Unknown occupation: ${draft.occupationId}`);
  }

  const attributes = applyAttributeDeltas(occupation.attributeDeltas);

  const state: GameState = {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    seed: draft.seed,
    runStartedAt: draft.runStartedAt,
    savedAt: draft.runStartedAt,
    runStatus: "active",

    party: {
      player: {
        name: draft.name,
        pronouns: draft.pronouns,
        ...(draft.customPronouns
          ? { customPronouns: draft.customPronouns }
          : {}),
        ageRange: draft.ageRange,
        portraitIndex: draft.portraitIndex,
        occupationId: draft.occupationId as OccupationId,
        motivation: draft.motivation,
        weakness: draft.weakness,
        attributes,
        meters: {
          health: 100,
          hunger: 0,
          thirst: 0,
          fatigue: 0,
          temperature: 50,
          stress: 0,
          morale: 80,
          infection: 0,
          radiation: 0,
          toxicExposure: 0,
          cleanliness: 100,
          pain: 0,
          sleepDebt: 0,
        },
        equippedItemIds: [],
        conditions: [],
      },
      companions: [],
      activeTransportId: null,
    },

    inventory: {
      storages: [
        {
          location: "backpack",
          items: [],
        },
      ],
    },

    transports: [],

    location: {
      currentNodeId: "node.pensacola.hotel" as NodeId,
      lastEdgeId: null,
      chapter: "pensacola-escape",
      terrain: "urban",
      distanceRemaining: 1500,
      visitedNodeIds: ["node.pensacola.hotel" as NodeId],
    },

    world: {
      elapsedHours: 0,
      day: 1,
      phase: "night",
      weather: "clear",
      moonPhase: 3,
      activeHazards: [],
      noiseLevel: 10,
      visibilityExposure: 5,
    },

    factions: [],

    eventHistory: {
      entries: [],
      activeFlags: [],
      cooldowns: {},
      pendingFollowUp: null,
    },

    farm: {
      clockTurns: 0,
      deadlineTurns: 120,
      well: "good",
      livestock: "good",
      crops: "good",
      structures: "good",
      seeds: "good",
      occupied: false,
      fire: false,
      familyPresent: ["mom", "dad"],
      familyAbsent: [],
      resolvedFlags: [],
    },

    settings: {
      difficulty: draft.difficulty,
      showNumbers: false,
      reducedMotion: false,
      highContrast: false,
      largeText: false,
      sensitivityFilters: {},
      contentWarnings: true,
      screenReaderMode: false,
    },

    pursuit: {
      pursuingFactionIds: [],
      intensity: 0,
    },
  };

  return state;
}
