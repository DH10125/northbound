/**
 * Route graph definition types and Pensacola subgraph content.
 *
 * A route graph is a directed graph of nodes (locations) connected by edges
 * (travel segments). Each edge has distance, terrain, allowed transport modes,
 * risks, and optional chapter transitions.
 */

import { z } from "zod";
import {
  NodeIdSchema,
  EdgeIdSchema,
  type NodeId,
  type EdgeId,
} from "../schemas/ids";
import { TerrainSchema, ChapterSchema } from "../schemas/route";
import { TransportModeSchema } from "../schemas/transport";

// ── Route node schema ─────────────────────────────────────────────────────────

export const RiskLevelSchema = z.enum(["low", "moderate", "high", "extreme"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RouteNodeSchema = z.object({
  id: NodeIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  chapter: ChapterSchema,
  terrain: TerrainSchema,
  /** Whether this node is required to pass through (for reachability validation). */
  required: z.boolean().default(false),
  /** Risk level when at this node (for display). */
  riskLevel: RiskLevelSchema,
  /** Short risk description readable without GPS. */
  riskDescription: z.string().min(1),
  /** Whether this is a chapter-start node. */
  chapterStart: z.boolean().default(false),
  /** Whether the player can rest here. */
  canRest: z.boolean().default(true),
  /** Whether the player can scavenge here. */
  canScavenge: z.boolean().default(true),
});

export type RouteNode = z.infer<typeof RouteNodeSchema>;

// ── Route edge schema ─────────────────────────────────────────────────────────

export const RouteEdgeSchema = z.object({
  id: EdgeIdSchema,
  fromNodeId: NodeIdSchema,
  toNodeId: NodeIdSchema,
  /** Distance in abstract units (determines travel turns). */
  distance: z.number().int().min(1),
  terrain: TerrainSchema,
  /** Transport modes that can traverse this edge. */
  allowedModes: z.array(TransportModeSchema).min(1),
  /** Risk level for display/decision making. */
  riskLevel: RiskLevelSchema,
  /** Short description of risks on this path. */
  riskDescription: z.string().min(1),
  /** Descriptive label for UI. */
  label: z.string().min(1),
  /** If traversal transitions to a new chapter. */
  transitionsToChapter: ChapterSchema.nullable().default(null),
  /** Navigation uncertainty weight (higher = more likely to get lost). */
  uncertaintyWeight: z.number().min(0).max(1).default(0),
  /** Wear applied to transport per traversal (0-20). */
  wearPerTraversal: z.number().int().min(0).max(20).default(0),
});

export type RouteEdge = z.infer<typeof RouteEdgeSchema>;

// ── Route graph schema ────────────────────────────────────────────────────────

export const RouteGraphSchema = z.object({
  nodes: z.array(RouteNodeSchema).min(1),
  edges: z.array(RouteEdgeSchema).min(1),
  startNodeId: NodeIdSchema,
});

export type RouteGraph = z.infer<typeof RouteGraphSchema>;

// ── Graph validators ──────────────────────────────────────────────────────────

export type ValidationError = {
  code: string;
  message: string;
  path?: string;
};

/**
 * Validate a route graph for structural integrity.
 * Returns an array of validation errors (empty = valid).
 */
export function validateRouteGraph(graph: RouteGraph): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  // Start node must exist
  if (!nodeIds.has(graph.startNodeId)) {
    errors.push({
      code: "INVALID_START_NODE",
      message: `Start node "${graph.startNodeId}" does not exist in graph nodes.`,
    });
  }

  // Edge references must be valid
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push({
        code: "INVALID_EDGE_SOURCE",
        message: `Edge "${edge.id}" references non-existent source node "${edge.fromNodeId}".`,
        path: edge.id,
      });
    }
    if (!nodeIds.has(edge.toNodeId)) {
      errors.push({
        code: "INVALID_EDGE_TARGET",
        message: `Edge "${edge.id}" references non-existent target node "${edge.toNodeId}".`,
        path: edge.id,
      });
    }
  }

  // Check for duplicate edge IDs
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push({
        code: "DUPLICATE_EDGE_ID",
        message: `Duplicate edge ID "${edge.id}".`,
        path: edge.id,
      });
    }
    edgeIds.add(edge.id);
  }

  // Check for duplicate node IDs
  const seenNodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (seenNodeIds.has(node.id)) {
      errors.push({
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node ID "${node.id}".`,
        path: node.id,
      });
    }
    seenNodeIds.add(node.id);
  }

  // Required nodes must be reachable from start
  const reachable = computeReachable(graph);
  for (const node of graph.nodes) {
    if (node.required && !reachable.has(node.id)) {
      errors.push({
        code: "UNREACHABLE_REQUIRED_NODE",
        message: `Required node "${node.id}" is not reachable from start node "${graph.startNodeId}".`,
        path: node.id,
      });
    }
  }

  // Self-loops are invalid
  for (const edge of graph.edges) {
    if (edge.fromNodeId === edge.toNodeId) {
      errors.push({
        code: "SELF_LOOP",
        message: `Edge "${edge.id}" is a self-loop on "${edge.fromNodeId}".`,
        path: edge.id,
      });
    }
  }

  return errors;
}

/**
 * Compute the set of node IDs reachable from the start node via BFS.
 */
export function computeReachable(graph: RouteGraph): Set<NodeId> {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.fromNodeId) ?? [];
    list.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, list);
  }

  const visited = new Set<NodeId>();
  const queue: NodeId[] = [graph.startNodeId];
  visited.add(graph.startNodeId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];
    for (const n of neighbors) {
      const nid = n as NodeId;
      if (!visited.has(nid)) {
        visited.add(nid);
        queue.push(nid);
      }
    }
  }

  return visited;
}

/**
 * Get available edges from a node, optionally filtered by transport mode.
 */
export function getAvailableEdges(
  graph: RouteGraph,
  fromNodeId: NodeId,
  transportMode?: string,
): RouteEdge[] {
  return graph.edges.filter((e) => {
    if (e.fromNodeId !== fromNodeId) return false;
    if (transportMode && !e.allowedModes.includes(transportMode as never)) {
      return false;
    }
    return true;
  });
}

/**
 * Find a node by ID.
 */
export function getNode(
  graph: RouteGraph,
  nodeId: NodeId,
): RouteNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

/**
 * Find an edge by ID.
 */
export function getEdge(
  graph: RouteGraph,
  edgeId: EdgeId,
): RouteEdge | undefined {
  return graph.edges.find((e) => e.id === edgeId);
}

// ── Pensacola subgraph ────────────────────────────────────────────────────────

export const pensacolaGraph: RouteGraph = {
  startNodeId: "node.pensacola.hotel" as NodeId,
  nodes: [
    {
      id: "node.pensacola.hotel" as NodeId,
      name: "Beachside Hotel",
      description:
        "A mid-range hotel near the waterfront. Power is out, elevators dead. Guests are panicking.",
      chapter: "pensacola-escape",
      terrain: "urban",
      required: false,
      riskLevel: "moderate",
      riskDescription: "Crowds, confusion, potential looting nearby.",
      chapterStart: true,
      canRest: true,
      canScavenge: true,
    },
    {
      id: "node.pensacola.marina" as NodeId,
      name: "Downtown Marina",
      description:
        "Small-craft marina with docked boats. Some are damaged, a few look seaworthy.",
      chapter: "pensacola-escape",
      terrain: "coast",
      required: false,
      riskLevel: "high",
      riskDescription:
        "Exposed waterfront, armed boat owners, unstable docks.",
      chapterStart: false,
      canRest: false,
      canScavenge: true,
    },
    {
      id: "node.pensacola.neighborhood-west" as NodeId,
      name: "West Residential District",
      description:
        "Quiet suburban streets. Many residents have already fled. Some houses are open.",
      chapter: "pensacola-escape",
      terrain: "suburban",
      required: false,
      riskLevel: "low",
      riskDescription: "Low traffic but occasional patrol vehicles.",
      chapterStart: false,
      canRest: true,
      canScavenge: true,
    },
    {
      id: "node.pensacola.rail-corridor" as NodeId,
      name: "Rail Corridor",
      description:
        "Abandoned freight rail line running north. Offers concealment but is exposed at crossings.",
      chapter: "pensacola-escape",
      terrain: "industrial",
      required: false,
      riskLevel: "moderate",
      riskDescription:
        "Open sightlines at crossings, debris, unstable structures.",
      chapterStart: false,
      canRest: true,
      canScavenge: true,
    },
    {
      id: "node.pensacola.gas-station" as NodeId,
      name: "Highway Gas Station",
      description:
        "A looted gas station at the interstate on-ramp. Fuel pumps are dead but storage tanks may have dregs.",
      chapter: "pensacola-escape",
      terrain: "suburban",
      required: false,
      riskLevel: "moderate",
      riskDescription: "Scavenger competition, broken glass, fumes.",
      chapterStart: false,
      canRest: false,
      canScavenge: true,
    },
    {
      id: "node.pensacola.checkpoint" as NodeId,
      name: "Interstate Checkpoint",
      description:
        "A hastily erected National Guard checkpoint blocks the main highway north. Long lines, tense soldiers.",
      chapter: "pensacola-escape",
      terrain: "urban",
      required: false,
      riskLevel: "extreme",
      riskDescription:
        "Armed guards, ID checks, confiscation risk, no turning back if caught.",
      chapterStart: false,
      canRest: false,
      canScavenge: false,
    },
    {
      id: "node.pensacola.bayou-trail" as NodeId,
      name: "Bayou Trail",
      description:
        "A footpath along a brackish waterway leading north through wetlands. Difficult terrain but nearly invisible.",
      chapter: "pensacola-escape",
      terrain: "swamp",
      required: false,
      riskLevel: "moderate",
      riskDescription:
        "Snakes, unstable footing, contaminated water, disorientation.",
      chapterStart: false,
      canRest: true,
      canScavenge: true,
    },
    {
      id: "node.pensacola.industrial-park" as NodeId,
      name: "Industrial Park",
      description:
        "Abandoned warehouses and loading docks. Good for scavenging supplies but patrols check periodically.",
      chapter: "pensacola-escape",
      terrain: "industrial",
      required: false,
      riskLevel: "moderate",
      riskDescription: "Security patrols, chemical hazards, structural damage.",
      chapterStart: false,
      canRest: true,
      canScavenge: true,
    },
    {
      id: "node.pensacola.north-bridge" as NodeId,
      name: "North Bridge Crossing",
      description:
        "The bridge over the bay inlet. A chokepoint that connects to the roads heading north out of the city.",
      chapter: "pensacola-escape",
      terrain: "urban",
      required: true,
      riskLevel: "high",
      riskDescription:
        "Bottleneck, potential tolls or blockades, high exposure.",
      chapterStart: false,
      canRest: false,
      canScavenge: false,
    },
    {
      id: "node.pensacola.exit-north" as NodeId,
      name: "Northern Outskirts",
      description:
        "Past the bridge, the suburbs thin out. Pine forest and rural roads beckon north.",
      chapter: "pensacola-escape",
      terrain: "suburban",
      required: true,
      riskLevel: "low",
      riskDescription: "Open road, diminishing crowds, occasional vehicles.",
      chapterStart: false,
      canRest: true,
      canScavenge: true,
    },
  ],
  edges: [
    // From hotel
    {
      id: "edge.pensacola.hotel-to-marina" as EdgeId,
      fromNodeId: "node.pensacola.hotel" as NodeId,
      toNodeId: "node.pensacola.marina" as NodeId,
      distance: 20,
      terrain: "urban",
      allowedModes: ["foot", "bicycle"],
      riskLevel: "moderate",
      riskDescription: "Crowded streets, panicked civilians.",
      label: "Head to the marina (short, exposed)",
      transitionsToChapter: null,
      uncertaintyWeight: 0.1,
      wearPerTraversal: 1,
    },
    {
      id: "edge.pensacola.hotel-to-neighborhood" as EdgeId,
      fromNodeId: "node.pensacola.hotel" as NodeId,
      toNodeId: "node.pensacola.neighborhood-west" as NodeId,
      distance: 30,
      terrain: "suburban",
      allowedModes: ["foot", "bicycle", "car", "pickup"],
      riskLevel: "low",
      riskDescription: "Quiet residential area, minimal threats.",
      label: "Cut through west neighborhoods (safer, longer)",
      transitionsToChapter: null,
      uncertaintyWeight: 0.05,
      wearPerTraversal: 1,
    },
    // From marina
    {
      id: "edge.pensacola.marina-to-industrial" as EdgeId,
      fromNodeId: "node.pensacola.marina" as NodeId,
      toNodeId: "node.pensacola.industrial-park" as NodeId,
      distance: 25,
      terrain: "coast",
      allowedModes: ["foot", "bicycle", "canoe", "kayak"],
      riskLevel: "moderate",
      riskDescription: "Waterfront exposure, dock workers.",
      label: "Follow the waterfront to industrial area",
      transitionsToChapter: null,
      uncertaintyWeight: 0.15,
      wearPerTraversal: 2,
    },
    // From neighborhood
    {
      id: "edge.pensacola.neighborhood-to-rail" as EdgeId,
      fromNodeId: "node.pensacola.neighborhood-west" as NodeId,
      toNodeId: "node.pensacola.rail-corridor" as NodeId,
      distance: 25,
      terrain: "suburban",
      allowedModes: ["foot", "bicycle"],
      riskLevel: "low",
      riskDescription: "Residential streets ending at rail yard fence.",
      label: "Find the old rail corridor",
      transitionsToChapter: null,
      uncertaintyWeight: 0.1,
      wearPerTraversal: 1,
    },
    {
      id: "edge.pensacola.neighborhood-to-gas" as EdgeId,
      fromNodeId: "node.pensacola.neighborhood-west" as NodeId,
      toNodeId: "node.pensacola.gas-station" as NodeId,
      distance: 20,
      terrain: "suburban",
      allowedModes: ["foot", "bicycle", "car", "pickup", "motorcycle"],
      riskLevel: "moderate",
      riskDescription: "Approaching the highway, more traffic.",
      label: "Head toward the highway",
      transitionsToChapter: null,
      uncertaintyWeight: 0.05,
      wearPerTraversal: 1,
    },
    // From rail corridor
    {
      id: "edge.pensacola.rail-to-industrial" as EdgeId,
      fromNodeId: "node.pensacola.rail-corridor" as NodeId,
      toNodeId: "node.pensacola.industrial-park" as NodeId,
      distance: 15,
      terrain: "industrial",
      allowedModes: ["foot", "bicycle"],
      riskLevel: "moderate",
      riskDescription: "Rail-yard hazards, patrol overlap.",
      label: "Follow tracks to the warehouses",
      transitionsToChapter: null,
      uncertaintyWeight: 0.1,
      wearPerTraversal: 2,
    },
    {
      id: "edge.pensacola.rail-to-bayou" as EdgeId,
      fromNodeId: "node.pensacola.rail-corridor" as NodeId,
      toNodeId: "node.pensacola.bayou-trail" as NodeId,
      distance: 35,
      terrain: "swamp",
      allowedModes: ["foot"],
      riskLevel: "moderate",
      riskDescription: "Wet terrain, navigation difficulty, wildlife.",
      label: "Slip into the bayou trail (hidden, slow)",
      transitionsToChapter: null,
      uncertaintyWeight: 0.35,
      wearPerTraversal: 3,
    },
    // From gas station
    {
      id: "edge.pensacola.gas-to-checkpoint" as EdgeId,
      fromNodeId: "node.pensacola.gas-station" as NodeId,
      toNodeId: "node.pensacola.checkpoint" as NodeId,
      distance: 15,
      terrain: "urban",
      allowedModes: ["foot", "bicycle", "car", "pickup", "motorcycle", "van"],
      riskLevel: "extreme",
      riskDescription: "Approaching military checkpoint on main road.",
      label: "Continue on the highway to the checkpoint (risky)",
      transitionsToChapter: null,
      uncertaintyWeight: 0,
      wearPerTraversal: 0,
    },
    // From checkpoint
    {
      id: "edge.pensacola.checkpoint-to-bridge" as EdgeId,
      fromNodeId: "node.pensacola.checkpoint" as NodeId,
      toNodeId: "node.pensacola.north-bridge" as NodeId,
      distance: 10,
      terrain: "urban",
      allowedModes: ["foot", "bicycle", "car", "pickup", "motorcycle", "van"],
      riskLevel: "high",
      riskDescription: "Past the checkpoint but still under surveillance.",
      label: "Cross north after checkpoint clearance",
      transitionsToChapter: null,
      uncertaintyWeight: 0,
      wearPerTraversal: 0,
    },
    // From industrial park
    {
      id: "edge.pensacola.industrial-to-bridge" as EdgeId,
      fromNodeId: "node.pensacola.industrial-park" as NodeId,
      toNodeId: "node.pensacola.north-bridge" as NodeId,
      distance: 20,
      terrain: "industrial",
      allowedModes: ["foot", "bicycle"],
      riskLevel: "moderate",
      riskDescription: "Navigating industrial backroads to the bridge.",
      label: "Work around to the bridge via back roads",
      transitionsToChapter: null,
      uncertaintyWeight: 0.15,
      wearPerTraversal: 2,
    },
    // From bayou
    {
      id: "edge.pensacola.bayou-to-bridge" as EdgeId,
      fromNodeId: "node.pensacola.bayou-trail" as NodeId,
      toNodeId: "node.pensacola.north-bridge" as NodeId,
      distance: 40,
      terrain: "swamp",
      allowedModes: ["foot", "canoe"],
      riskLevel: "moderate",
      riskDescription:
        "Long slog through wetlands, risk of getting lost.",
      label: "Follow the bayou north to the bridge (long, hidden)",
      transitionsToChapter: null,
      uncertaintyWeight: 0.4,
      wearPerTraversal: 4,
    },
    // From bridge to exit
    {
      id: "edge.pensacola.bridge-to-exit" as EdgeId,
      fromNodeId: "node.pensacola.north-bridge" as NodeId,
      toNodeId: "node.pensacola.exit-north" as NodeId,
      distance: 15,
      terrain: "suburban",
      allowedModes: ["foot", "bicycle", "car", "pickup", "motorcycle", "van"],
      riskLevel: "low",
      riskDescription: "Thinning suburbs, open road ahead.",
      label: "Cross the bridge and head north",
      transitionsToChapter: "gulf-coast",
      uncertaintyWeight: 0.05,
      wearPerTraversal: 1,
    },
  ],
};
