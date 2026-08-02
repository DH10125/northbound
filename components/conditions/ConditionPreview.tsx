/**
 * ConditionPreview — live interactive preview of the condition system.
 *
 * Uses a demo GameState with sample conditions so a real player can
 * inspect conditions, permanent effects, see uncertainty/warnings/costs/
 * disabled reasons, and try treating a condition via TREAT_CONDITION.
 */

"use client";

import React, { useCallback, useState } from "react";
import { ConditionPanelContainer } from "@/components/conditions/ConditionPanelContainer";
import type { GameState } from "@/game/schemas/game-state";
import { applyCommand } from "@/game/core/reducer";
import { seedToState } from "@/game/core/rng";
import type { RngState } from "@/game/core/rng";
import { GAME_STATE_SCHEMA_VERSION } from "@/game/schemas/game-state";
import type {
  ItemInstanceId,
  ItemId,
  NodeId,
  OccupationId,
} from "@/game/schemas/ids";

/** Demo state with two conditions and one treatable via inventory. */
function buildDemoState(): { state: GameState; rng: RngState } {
  const state: GameState = {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    seed: "condition-preview",
    runStartedAt: "2026-08-01T00:00:00.000Z",
    savedAt: "2026-08-01T00:00:00.000Z",
    runStatus: "active",
    world: {
      day: 1,
      elapsedHours: 8,
      phase: "night",
      weather: "clear",
      moonPhase: 0,
      activeHazards: [],
      noiseLevel: 0,
      visibilityExposure: 0,
    },
    party: {
      player: {
        name: "Scout",
        pronouns: "they/them",
        ageRange: "adult",
        portraitIndex: 0,
        occupationId: "occ.medic" as OccupationId,
        motivation: "Reach the farm",
        weakness: "Bad knee",
        attributes: {
          strength: 5,
          endurance: 5,
          agility: 5,
          awareness: 5,
          intelligence: 5,
          technical: 5,
          medical: 4,
          survival: 5,
          social: 5,
          resolve: 5,
        },
        meters: {
          health: 70,
          hunger: 30,
          thirst: 40,
          fatigue: 50,
          temperature: 50,
          stress: 20,
          morale: 60,
          infection: 10,
          radiation: 0,
          toxicExposure: 0,
          cleanliness: 80,
          pain: 15,
          sleepDebt: 20,
        },
        equippedItemIds: [],
        conditions: [
          {
            conditionId: "condition.dehydration",
            stageIndex: 1,
            turnsAtStage: 2,
            totalTurns: 8,
            treated: false,
            treatmentTurns: 0,
          },
          {
            conditionId: "condition.wound-infection",
            stageIndex: 2,
            turnsAtStage: 1,
            totalTurns: 12,
            treated: false,
            treatmentTurns: 0,
          },
        ],
        permanentModifiers: [
          {
            sourceConditionId: "condition.fracture",
            target: "agility",
            delta: -1,
            label: "Stiff limb (badly healed break)",
          },
        ],
      },
      companions: [],
      activeTransportId: null,
    },
    location: {
      currentNodeId: "node.start" as NodeId,
      lastEdgeId: null,
      chapter: "pensacola-escape",
      terrain: "urban",
      distanceRemaining: 1000,
      visitedNodeIds: [],
    },
    inventory: {
      storages: [
        {
          location: "backpack",
          items: [
            {
              instanceId: "preview-water-001" as ItemInstanceId,
              definitionId: "item.water.bottle-clean" as ItemId,
              quantity: 3,
              condition: 100,
            },
          ],
        },
      ],
    },
    transports: [],
    eventHistory: {
      entries: [],
      activeFlags: [],
      cooldowns: {},
      activeEventId: null,
      pendingFollowUp: null,
    },
    farm: {
      clockTurns: 0,
      deadlineTurns: 100,
      well: "good",
      livestock: "good",
      crops: "good",
      structures: "good",
      seeds: "good",
      occupied: false,
      fire: false,
      familyPresent: [],
      familyAbsent: [],
      resolvedFlags: [],
    },
    factions: [],
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

  return { state, rng: seedToState("condition-preview") };
}

export function ConditionPreview() {
  const [{ state }, setGame] = useState(buildDemoState);

  const handleCommand = useCallback(
    (command: { type: "TREAT_CONDITION"; conditionId: string }) => {
      setGame((prev) => {
        const result = applyCommand(prev.state, command, prev.rng);
        return { state: result.state, rng: result.rng };
      });
    },
    [],
  );

  return (
    <div data-testid="condition-preview">
      <ConditionPanelContainer state={state} onCommand={handleCommand} />
      {state.party.player.conditions.length === 0 &&
        state.party.player.permanentModifiers.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            All conditions cleared.
          </p>
        )}
    </div>
  );
}
