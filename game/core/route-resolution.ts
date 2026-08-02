/**
 * Route resolution logic.
 *
 * Handles CHOOSE_ROUTE command: validates edge, resolves navigation uncertainty,
 * then advances the party through the turn flow (time, upkeep, farm clock,
 * spoilage, wear, turn summary) atomically.
 *
 * Pure, deterministic, no React/browser imports.
 */

import type { GameState } from "../schemas/game-state";
import type { RngState } from "./rng";
import { nextFloat } from "./rng";
import type { DomainEvent } from "./domain-events";
import type { ReducerResult } from "./reducer";
import type { RouteGraph } from "../content/route-graph";
import { getEdge, getNode } from "../content/route-graph";
import { pensacolaGraph } from "../content/route-graph";
import { z } from "zod";
import type { EdgeId, NodeId } from "../schemas/ids";
import { ChapterSchema } from "../schemas/route";
import {
  hoursToPhase,
  computeUpkeep,
  tickFarmClock,
  ACTION_TURN_HOURS,
} from "./turn-clock";
import type { ResolutionChange } from "./turn-clock";
import { advanceSpoilage } from "./inventory";

type Chapter = z.infer<typeof ChapterSchema>;

// ── Graph registry ────────────────────────────────────────────────────────────

/** Map chapter → graph. For now only pensacola-escape. */
const CHAPTER_GRAPHS: Record<string, RouteGraph> = {
  "pensacola-escape": pensacolaGraph,
};

export function getGraphForChapter(chapter: string): RouteGraph | undefined {
  return CHAPTER_GRAPHS[chapter];
}

// ── Transport mode resolution ─────────────────────────────────────────────────

/** Determine current transport mode from state. */
function currentTransportMode(state: GameState): string {
  if (!state.party.activeTransportId) return "foot";
  const transport = state.transports.find(
    (t) => t.instanceId === state.party.activeTransportId,
  );
  return transport?.mode ?? "foot";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ── CHOOSE_ROUTE handler ──────────────────────────────────────────────────────

/**
 * Apply the CHOOSE_ROUTE command. Validates edge availability, transport mode
 * constraints, resolves navigation uncertainty, then advances one TRAVEL turn
 * through the standard turn flow (time, upkeep, farm clock, spoilage, wear,
 * turn summary).
 */
export function applyChooseRoute(
  state: GameState,
  rng: RngState,
  edgeId: string,
): ReducerResult {
  if (state.runStatus !== "active") {
    return {
      state,
      rng,
      events: [{ type: "COMMAND_REJECTED", reason: "Run is not active." }],
    };
  }

  const graph = getGraphForChapter(state.location.chapter);
  if (!graph) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `No route graph for chapter "${state.location.chapter}".`,
        },
      ],
    };
  }

  const edge = getEdge(graph, edgeId as EdgeId);
  if (!edge) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Edge "${edgeId}" not found in route graph.`,
        },
      ],
    };
  }

  // Edge must originate from current node
  if (edge.fromNodeId !== state.location.currentNodeId) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Edge "${edgeId}" does not originate from current node "${state.location.currentNodeId}".`,
        },
      ],
    };
  }

  // Transport mode constraint
  const mode = currentTransportMode(state);
  if (!edge.allowedModes.includes(mode as never)) {
    return {
      state,
      rng,
      events: [
        {
          type: "COMMAND_REJECTED",
          reason: `Transport mode "${mode}" cannot traverse edge "${edgeId}". Allowed: ${edge.allowedModes.join(", ")}.`,
        },
      ],
    };
  }

  // ── Resolve navigation uncertainty ──────────────────────────────────────────
  let r = rng;
  const events: DomainEvent[] = [];
  let totalDistance = edge.distance;

  if (edge.uncertaintyWeight > 0) {
    let roll: number;
    [r, roll] = nextFloat(r);
    if (roll < edge.uncertaintyWeight) {
      let extraRoll: number;
      [r, extraRoll] = nextFloat(r);
      const extraDistance = Math.max(
        1,
        Math.round(edge.distance * (0.2 + extraRoll * 0.3)),
      );
      totalDistance += extraDistance;
      events.push({
        type: "NAVIGATION_UNCERTAINTY",
        extraDistance,
        reason: "Unfamiliar terrain caused a detour.",
      });
    }
  }

  // ── Advance one TRAVEL turn (time, upkeep, farm clock) ──────────────────────
  const phaseAtStart = state.world.phase;
  const hoursThisTurn = ACTION_TURN_HOURS["TRAVEL"];
  const newElapsedHours = state.world.elapsedHours + hoursThisTurn;
  const newDay = Math.floor(newElapsedHours / 24) + 1;
  const newPhase = hoursToPhase(newElapsedHours);

  // Meter upkeep (TRAVEL category)
  const upkeep = computeUpkeep("TRAVEL");
  const m = state.party.player.meters;
  const newHunger = clamp(m.hunger + upkeep.hunger, 0, 100);
  const newThirst = clamp(m.thirst + upkeep.thirst, 0, 100);
  const newFatigue = clamp(m.fatigue + upkeep.fatigue, 0, 100);
  const newSleepDebt = clamp(m.sleepDebt + upkeep.sleepDebt, 0, 100);

  // Farm clock tick
  const newFarmClockTurns = tickFarmClock(state.farm.clockTurns);

  // Build resolution changes
  const changes: ResolutionChange[] = [];
  if (newHunger !== m.hunger)
    changes.push({
      field: "hunger",
      before: m.hunger,
      after: newHunger,
      delta: newHunger - m.hunger,
    });
  if (newThirst !== m.thirst)
    changes.push({
      field: "thirst",
      before: m.thirst,
      after: newThirst,
      delta: newThirst - m.thirst,
    });
  if (newFatigue !== m.fatigue)
    changes.push({
      field: "fatigue",
      before: m.fatigue,
      after: newFatigue,
      delta: newFatigue - m.fatigue,
    });
  if (newSleepDebt !== m.sleepDebt)
    changes.push({
      field: "sleepDebt",
      before: m.sleepDebt,
      after: newSleepDebt,
      delta: newSleepDebt - m.sleepDebt,
    });
  if (newFarmClockTurns !== state.farm.clockTurns)
    changes.push({
      field: "farm.clockTurns",
      before: state.farm.clockTurns,
      after: newFarmClockTurns,
      delta: newFarmClockTurns - state.farm.clockTurns,
    });

  // ── Apply transport wear ────────────────────────────────────────────────────
  let nextTransports = state.transports;
  if (state.party.activeTransportId && edge.wearPerTraversal > 0) {
    nextTransports = state.transports.map((t) => {
      if (t.instanceId !== state.party.activeTransportId) return t;
      return {
        ...t,
        condition: Math.max(0, t.condition - edge.wearPerTraversal),
      };
    });
  }

  // ── Location update ─────────────────────────────────────────────────────────
  const destNode = getNode(graph, edge.toNodeId);
  const newTerrain = destNode?.terrain ?? edge.terrain;

  let newChapter = state.location.chapter as string;
  if (edge.transitionsToChapter) {
    const oldChapter = state.location.chapter;
    newChapter = edge.transitionsToChapter;
    events.push({
      type: "CHAPTER_TRANSITIONED",
      fromChapter: oldChapter,
      toChapter: newChapter,
      atNodeId: edge.toNodeId,
    });
  }

  const newVisited = state.location.visitedNodeIds.includes(edge.toNodeId)
    ? state.location.visitedNodeIds
    : [...state.location.visitedNodeIds, edge.toNodeId];

  const newDistanceRemaining = Math.max(
    0,
    state.location.distanceRemaining - totalDistance,
  );

  // ── Build next state ────────────────────────────────────────────────────────
  let nextState: GameState = {
    ...state,
    party: {
      ...state.party,
      player: {
        ...state.party.player,
        meters: {
          ...m,
          hunger: newHunger,
          thirst: newThirst,
          fatigue: newFatigue,
          sleepDebt: newSleepDebt,
        },
      },
    },
    location: {
      ...state.location,
      currentNodeId: edge.toNodeId,
      lastEdgeId: edge.id,
      chapter: newChapter as Chapter,
      terrain: newTerrain,
      distanceRemaining: newDistanceRemaining,
      visitedNodeIds: newVisited as NodeId[],
    },
    world: {
      ...state.world,
      elapsedHours: newElapsedHours,
      day: newDay,
      phase: newPhase,
    },
    farm: {
      ...state.farm,
      clockTurns: newFarmClockTurns,
    },
    transports: nextTransports,
  };

  // ── Spoilage ────────────────────────────────────────────────────────────────
  const spoilageResult = advanceSpoilage(nextState.inventory);
  nextState = { ...nextState, inventory: spoilageResult.inventory };
  for (const spoiled of spoilageResult.spoiledItems) {
    events.push({
      type: "ITEM_SPOILED",
      instanceId: spoiled.instanceId,
      definitionId: spoiled.definitionId,
    });
  }

  // ── Emit domain events in order ─────────────────────────────────────────────
  const orderedEvents: DomainEvent[] = [
    {
      type: "ROUTE_CHOSEN",
      edgeId: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      distance: totalDistance,
    },
    { type: "TIME_ADVANCED", hours: hoursThisTurn, newElapsedHours },
    {
      type: "TRAVEL_ADVANCED",
      distanceCovered: totalDistance,
      newDistanceRemaining,
    },
    {
      type: "FARM_CLOCK_TICKED",
      newClockTurns: newFarmClockTurns,
      deadlineTurns: state.farm.deadlineTurns,
    },
    {
      type: "TURN_RESOLVED",
      action: "TRAVEL",
      phase: phaseAtStart,
      hoursElapsed: hoursThisTurn,
      changes,
    },
    ...events,
  ];

  return { state: nextState, rng: r, events: orderedEvents };
}
