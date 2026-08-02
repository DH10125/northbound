/**
 * Minimal valid GameState fixture for tests and deterministic builders.
 * All values are the simplest possible valid inputs — not a realistic run.
 */

import type { GameState } from "../schemas/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "../schemas/game-state";
import type {
  ItemInstanceId,
  NodeId,
  OccupationId,
  TransportInstanceId,
} from "../schemas/ids";

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
      occupationId: "occupation.farmer" as OccupationId,
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
    activeEventId: null,
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

/**
 * Fixture with one inventory item, one transport, a companion, and the player
 * equipped with an item — for referential-integrity tests.
 */
export const populatedGameState: GameState = {
  ...minimalGameState,

  party: {
    player: {
      ...minimalGameState.party.player,
      equippedItemIds: ["item-inst-001" as ItemInstanceId],
    },
    companions: [
      {
        id: "companion.marisol" as import("../schemas/ids").CompanionId,
        name: "Marisol",
        status: "active",
        attributes: minimalGameState.party.player.attributes,
        meters: minimalGameState.party.player.meters,
        morale: 70,
        loyalty: 80,
        fear: 10,
        carriedItemIds: ["item-inst-002" as ItemInstanceId],
        relationships: {},
        flags: [],
      },
    ],
    activeTransportId: "transport-inst-001" as TransportInstanceId,
  },

  inventory: {
    storages: [
      {
        location: "backpack",
        items: [
          {
            instanceId: "item-inst-001" as ItemInstanceId,
            definitionId:
              "item.medical.bandage" as import("../schemas/ids").ItemId,
            quantity: 3,
            condition: 100,
          },
          {
            instanceId: "item-inst-002" as ItemInstanceId,
            definitionId: "item.food.ration" as import("../schemas/ids").ItemId,
            quantity: 2,
            condition: 90,
          },
          {
            instanceId: "item-inst-003" as ItemInstanceId,
            definitionId: "item.gear.rope" as import("../schemas/ids").ItemId,
            quantity: 1,
            condition: 100,
          },
        ],
      },
    ],
  },

  transports: [
    {
      instanceId: "transport-inst-001" as TransportInstanceId,
      definitionId:
        "transport.water.canoe" as import("../schemas/ids").TransportId,
      mode: "canoe",
      condition: 85,
      fuel: 0,
      cargoItemIds: ["item-inst-003" as ItemInstanceId],
    },
  ],

  factions: [
    {
      factionId:
        "faction.river.cooperative" as import("../schemas/ids").FactionId,
      reputation: 20,
      promises: [],
      debts: 0,
      hasAccess: true,
    },
  ],
};
