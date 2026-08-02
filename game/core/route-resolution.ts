/**
 * Route resolution logic.
 *
 * Handles CHOOSE_ROUTE command: validates edge, resolves navigation uncertainty,
 * applies distance/wear, handles chapter transitions, and updates location state.
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

// ── CHOOSE_ROUTE handler ──────────────────────────────────────────────────────

/**
 * Apply the CHOOSE_ROUTE command. Validates edge availability, transport mode
 * constraints, resolves navigation uncertainty, applies wear, and updates
 * location/chapter.
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

  // Resolve navigation uncertainty
  let r = rng;
  const events: DomainEvent[] = [];
  let totalDistance = edge.distance;

  if (edge.uncertaintyWeight > 0) {
    let roll: number;
    [r, roll] = nextFloat(r);
    if (roll < edge.uncertaintyWeight) {
      // Got lost: add 20-50% extra distance
      let extraRoll: number;
      [r, extraRoll] = nextFloat(r);
      const extraDistance = Math.max(1, Math.round(edge.distance * (0.2 + extraRoll * 0.3)));
      totalDistance += extraDistance;
      events.push({
        type: "NAVIGATION_UNCERTAINTY",
        extraDistance,
        reason: "Unfamiliar terrain caused a detour.",
      });
    }
  }

  // Apply transport wear
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

  // Determine destination node
  const destNode = getNode(graph, edge.toNodeId);
  const newTerrain = destNode?.terrain ?? edge.terrain;

  // Chapter transition
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

  // Update location
  const newVisited = state.location.visitedNodeIds.includes(edge.toNodeId)
    ? state.location.visitedNodeIds
    : [...state.location.visitedNodeIds, edge.toNodeId];

  events.unshift({
    type: "ROUTE_CHOSEN",
    edgeId: edge.id,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    distance: totalDistance,
  });

  const nextState: GameState = {
    ...state,
    location: {
      ...state.location,
      currentNodeId: edge.toNodeId,
      lastEdgeId: edge.id,
      chapter: newChapter as Chapter,
      terrain: newTerrain,
      distanceRemaining: Math.max(
        0,
        state.location.distanceRemaining - totalDistance,
      ),
      visitedNodeIds: newVisited as NodeId[],
    },
    transports: nextTransports,
  };

  return { state: nextState, rng: r, events };
}
