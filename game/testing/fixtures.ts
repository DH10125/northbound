/**
 * Minimal valid GameState fixture for tests and deterministic builders.
 * All values are the simplest possible valid inputs — not a realistic run.
 */

import type { GameState } from "../schemas/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "../schemas/game-state";

export const minimalGameState: GameState = {
  schemaVersion: GAME_STATE_SCHEMA_VERSION,
  seed: "test-seed-001",
  runStartedAt: "2026-08-01T00:00:00.000Z",
  savedAt: "2026-08-01T00:00:00.000Z",
  runStatus: "active",

  party: {
    player: {
      name: "Alex",
      pronouns: "they/them",
      ageRange: "adult",
      portraitIndex: 0,
      occupationId: "occupation.farmer" as import("../schemas/ids").OccupationId,
      motivation: "Reach the family farm.",
      weakness: "Slow healer.",
      attributes: {
        strength: 5,
        endurance: 5,
        agility: 5,
        awareness: 5,
        intelligence: 5,
        technical: 5,
        medical: 5,
        survival: 5,
        social: 5,
        resolve: 5,
      },
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
    currentNodeId: "node.pensacola.hotel" as import("../schemas/ids").NodeId,
    lastEdgeId: null,
    chapter: "pensacola-escape",
    terrain: "urban",
    distanceRemaining: 1500,
    visitedNodeIds: ["node.pensacola.hotel" as import("../schemas/ids").NodeId],
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
    difficulty: "normal",
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
