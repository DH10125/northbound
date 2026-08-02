/**
 * Tests for route graph, validators, route resolution, and travel integration.
 */

import { describe, it, expect } from "vitest";
import {
  pensacolaGraph,
  validateRouteGraph,
  computeReachable,
  getAvailableEdges,
  RouteGraphSchema,
} from "../../content/route-graph";
import { applyChooseRoute } from "../route-resolution";
import { applyCommand } from "../reducer";
import { seedToState } from "../rng";
import { minimalGameState } from "../../testing/fixtures";
import type { GameState } from "../../schemas/game-state";
import type { EdgeId, NodeId } from "../../schemas/ids";

// ── Pensacola graph content tests ─────────────────────────────────────────────

describe("Pensacola route graph content", () => {
  it("has at least 8 nodes", () => {
    expect(pensacolaGraph.nodes.length).toBeGreaterThanOrEqual(8);
  });

  it("has meaningful branches (multiple edges from at least 2 nodes)", () => {
    const fromCounts = new Map<string, number>();
    for (const edge of pensacolaGraph.edges) {
      fromCounts.set(
        edge.fromNodeId,
        (fromCounts.get(edge.fromNodeId) ?? 0) + 1,
      );
    }
    const branchingNodes = [...fromCounts.values()].filter((c) => c >= 2);
    expect(branchingNodes.length).toBeGreaterThanOrEqual(2);
  });

  it("validates with Zod schema successfully", () => {
    const result = RouteGraphSchema.safeParse(pensacolaGraph);
    expect(result.success).toBe(true);
  });

  it("passes structural validation with no errors", () => {
    const errors = validateRouteGraph(pensacolaGraph);
    expect(errors).toEqual([]);
  });

  it("all nodes are reachable from start", () => {
    const reachable = computeReachable(pensacolaGraph);
    for (const node of pensacolaGraph.nodes) {
      expect(reachable.has(node.id)).toBe(true);
    }
  });

  it("required nodes exist and are reachable", () => {
    const requiredNodes = pensacolaGraph.nodes.filter((n) => n.required);
    expect(requiredNodes.length).toBeGreaterThan(0);
    const reachable = computeReachable(pensacolaGraph);
    for (const node of requiredNodes) {
      expect(reachable.has(node.id)).toBe(true);
    }
  });

  it("has a chapter transition edge", () => {
    const transitionEdges = pensacolaGraph.edges.filter(
      (e) => e.transitionsToChapter !== null,
    );
    expect(transitionEdges.length).toBeGreaterThan(0);
  });
});

// ── Graph validator tests ─────────────────────────────────────────────────────

describe("validateRouteGraph", () => {
  const makeNode = (id: string, required = false) => ({
    id: id as NodeId,
    name: id,
    description: `Node ${id}`,
    chapter: "pensacola-escape" as const,
    terrain: "urban" as const,
    required,
    riskLevel: "low" as const,
    riskDescription: "Safe.",
    chapterStart: false,
    canRest: true,
    canScavenge: true,
  });

  const makeEdge = (id: string, from: string, to: string) => ({
    id: id as EdgeId,
    fromNodeId: from as NodeId,
    toNodeId: to as NodeId,
    distance: 10,
    terrain: "urban" as const,
    allowedModes: ["foot" as const],
    riskLevel: "low" as const,
    riskDescription: "N/A",
    label: id,
    transitionsToChapter: null,
    uncertaintyWeight: 0,
    wearPerTraversal: 0,
  });

  it("catches invalid edge source reference", () => {
    const errors = validateRouteGraph({
      startNodeId: "node.a" as NodeId,
      nodes: [makeNode("node.a")],
      edges: [makeEdge("edge.bad", "node.nonexistent", "node.a")],
    });
    expect(errors.some((e) => e.code === "INVALID_EDGE_SOURCE")).toBe(true);
  });

  it("catches unreachable required node", () => {
    const errors = validateRouteGraph({
      startNodeId: "node.a" as NodeId,
      nodes: [makeNode("node.a"), makeNode("node.b", true)],
      edges: [makeEdge("edge.self", "node.a", "node.a")],
    });
    expect(errors.some((e) => e.code === "UNREACHABLE_REQUIRED_NODE")).toBe(
      true,
    );
  });

  it("catches self-loop edges", () => {
    const errors = validateRouteGraph({
      startNodeId: "node.a" as NodeId,
      nodes: [makeNode("node.a")],
      edges: [makeEdge("edge.self", "node.a", "node.a")],
    });
    expect(errors.some((e) => e.code === "SELF_LOOP")).toBe(true);
  });

  it("catches duplicate edge IDs", () => {
    const errors = validateRouteGraph({
      startNodeId: "node.a" as NodeId,
      nodes: [makeNode("node.a"), makeNode("node.b")],
      edges: [
        makeEdge("edge.dup", "node.a", "node.b"),
        makeEdge("edge.dup", "node.a", "node.b"),
      ],
    });
    expect(errors.some((e) => e.code === "DUPLICATE_EDGE_ID")).toBe(true);
  });

  it("catches invalid edge target reference", () => {
    const errors = validateRouteGraph({
      startNodeId: "node.a" as NodeId,
      nodes: [makeNode("node.a")],
      edges: [makeEdge("edge.bad", "node.a", "node.nonexistent")],
    });
    expect(errors.some((e) => e.code === "INVALID_EDGE_TARGET")).toBe(true);
  });
});

// ── Route resolution tests ────────────────────────────────────────────────────

describe("applyChooseRoute", () => {
  const rng = seedToState("route-test");

  it("successfully chooses a valid route and advances turn", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.hotel-to-neighborhood",
    );
    expect(result.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(
      false,
    );
    expect(result.events.some((e) => e.type === "ROUTE_CHOSEN")).toBe(true);
    expect(result.events.some((e) => e.type === "TIME_ADVANCED")).toBe(true);
    expect(result.events.some((e) => e.type === "TRAVEL_ADVANCED")).toBe(true);
    expect(result.events.some((e) => e.type === "FARM_CLOCK_TICKED")).toBe(
      true,
    );
    expect(result.events.some((e) => e.type === "TURN_RESOLVED")).toBe(true);
    expect(result.state.location.currentNodeId).toBe(
      "node.pensacola.neighborhood-west",
    );
  });

  it("advances elapsed time by TRAVEL turn hours", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.hotel-to-neighborhood",
    );
    expect(result.state.world.elapsedHours).toBe(4); // ACTION_TURN_HOURS.TRAVEL = 4
  });

  it("applies travel upkeep to meters", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.hotel-to-neighborhood",
    );
    // TRAVEL upkeep: hunger +2*4=8, thirst +3*4=12, fatigue +4*4=16, sleepDebt +1*4=4
    expect(result.state.party.player.meters.hunger).toBe(8);
    expect(result.state.party.player.meters.thirst).toBe(12);
    expect(result.state.party.player.meters.fatigue).toBe(16);
    expect(result.state.party.player.meters.sleepDebt).toBe(4);
  });

  it("ticks farm clock", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.hotel-to-neighborhood",
    );
    expect(result.state.farm.clockTurns).toBe(1);
  });

  it("rejects edge not originating from current node", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.rail-to-bayou",
    );
    expect(result.events[0]!.type).toBe("COMMAND_REJECTED");
    expect(result.state).toBe(minimalGameState);
  });

  it("rejects non-existent edge", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.nonexistent",
    );
    expect(result.events[0]!.type).toBe("COMMAND_REJECTED");
  });

  it("rejects invalid transport mode", () => {
    const state: GameState = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        activeTransportId:
          "transport-inst-001" as import("../../schemas/ids").TransportInstanceId,
      },
      transports: [
        {
          instanceId:
            "transport-inst-001" as import("../../schemas/ids").TransportInstanceId,
          definitionId:
            "transport.land.motorcycle" as import("../../schemas/ids").TransportId,
          mode: "motorcycle",
          condition: 80,
          fuel: 50,
          cargoItemIds: [],
        },
      ],
    };
    // hotel-to-marina only allows foot/bicycle
    const result = applyChooseRoute(
      state,
      rng,
      "edge.pensacola.hotel-to-marina",
    );
    expect(result.events[0]!.type).toBe("COMMAND_REJECTED");
    expect((result.events[0] as { reason: string }).reason).toContain(
      "motorcycle",
    );
  });

  it("rejects when run is not active", () => {
    const state: GameState = {
      ...minimalGameState,
      runStatus: "ended-success",
    };
    const result = applyChooseRoute(
      state,
      rng,
      "edge.pensacola.hotel-to-marina",
    );
    expect(result.events[0]!.type).toBe("COMMAND_REJECTED");
  });

  it("applies transport wear on traversal", () => {
    const state: GameState = {
      ...minimalGameState,
      party: {
        ...minimalGameState.party,
        activeTransportId:
          "transport-inst-001" as import("../../schemas/ids").TransportInstanceId,
      },
      transports: [
        {
          instanceId:
            "transport-inst-001" as import("../../schemas/ids").TransportInstanceId,
          definitionId:
            "transport.land.bicycle" as import("../../schemas/ids").TransportId,
          mode: "bicycle",
          condition: 80,
          fuel: 0,
          cargoItemIds: [],
        },
      ],
    };
    const result = applyChooseRoute(
      state,
      rng,
      "edge.pensacola.hotel-to-marina",
    );
    const transport = result.state.transports.find(
      (t) => t.instanceId === "transport-inst-001",
    );
    expect(transport!.condition).toBe(79); // wearPerTraversal: 1
  });

  it("handles chapter transition", () => {
    const state: GameState = {
      ...minimalGameState,
      location: {
        ...minimalGameState.location,
        currentNodeId: "node.pensacola.north-bridge" as NodeId,
        visitedNodeIds: ["node.pensacola.north-bridge" as NodeId],
      },
    };
    const result = applyChooseRoute(
      state,
      rng,
      "edge.pensacola.bridge-to-exit",
    );
    expect(result.state.location.chapter).toBe("gulf-coast");
    expect(result.events.some((e) => e.type === "CHAPTER_TRANSITIONED")).toBe(
      true,
    );
  });

  it("reduces distance remaining", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.hotel-to-neighborhood",
    );
    expect(result.state.location.distanceRemaining).toBeLessThan(1500);
  });
});

// ── Navigation uncertainty determinism ────────────────────────────────────────

describe("navigation uncertainty", () => {
  it("produces deterministic results with same seed", () => {
    const state: GameState = {
      ...minimalGameState,
      location: {
        ...minimalGameState.location,
        currentNodeId: "node.pensacola.rail-corridor" as NodeId,
        visitedNodeIds: ["node.pensacola.rail-corridor" as NodeId],
      },
    };
    const rng = seedToState("uncertainty-test");

    const result1 = applyChooseRoute(
      state,
      rng,
      "edge.pensacola.rail-to-bayou",
    );
    const result2 = applyChooseRoute(
      state,
      rng,
      "edge.pensacola.rail-to-bayou",
    );

    // Same seed → same outcome
    expect(result1.state.location.distanceRemaining).toBe(
      result2.state.location.distanceRemaining,
    );
    expect(result1.events).toEqual(result2.events);
  });

  it("different seeds can produce different uncertainty outcomes", () => {
    const state: GameState = {
      ...minimalGameState,
      location: {
        ...minimalGameState.location,
        currentNodeId: "node.pensacola.rail-corridor" as NodeId,
        visitedNodeIds: ["node.pensacola.rail-corridor" as NodeId],
      },
    };

    let gotUncertainty = false;
    let gotNoUncertainty = false;
    for (let i = 0; i < 50; i++) {
      const rng = seedToState(`nav-seed-${i}`);
      const result = applyChooseRoute(
        state,
        rng,
        "edge.pensacola.rail-to-bayou",
      );
      if (result.events.some((e) => e.type === "NAVIGATION_UNCERTAINTY")) {
        gotUncertainty = true;
      } else {
        gotNoUncertainty = true;
      }
      if (gotUncertainty && gotNoUncertainty) break;
    }
    expect(gotUncertainty).toBe(true);
    expect(gotNoUncertainty).toBe(true);
  });
});

// ── Integration with reducer/command ──────────────────────────────────────────

describe("CHOOSE_ROUTE via applyCommand", () => {
  it("processes CHOOSE_ROUTE command through the main reducer", () => {
    const rng = seedToState("cmd-test");
    const result = applyCommand(
      minimalGameState,
      {
        type: "CHOOSE_ROUTE",
        edgeId: "edge.pensacola.hotel-to-marina" as EdgeId,
      },
      rng,
    );
    expect(result.events.some((e) => e.type === "ROUTE_CHOSEN")).toBe(true);
    expect(result.state.location.currentNodeId).toBe("node.pensacola.marina");
  });

  it("atomically rejects invalid CHOOSE_ROUTE (state unchanged)", () => {
    const rng = seedToState("reject-test");
    const result = applyCommand(
      minimalGameState,
      {
        type: "CHOOSE_ROUTE",
        edgeId: "edge.pensacola.nonexistent" as EdgeId,
      },
      rng,
    );
    expect(result.events[0]!.type).toBe("COMMAND_REJECTED");
    expect(result.state).toBe(minimalGameState);
  });
});

// ── Replay equivalence ────────────────────────────────────────────────────────

describe("replay equivalence", () => {
  it("same command sequence produces identical state", () => {
    const rng = seedToState("replay-test");

    const r1 = applyCommand(
      minimalGameState,
      {
        type: "CHOOSE_ROUTE",
        edgeId: "edge.pensacola.hotel-to-neighborhood" as EdgeId,
      },
      rng,
    );

    const r2 = applyCommand(
      minimalGameState,
      {
        type: "CHOOSE_ROUTE",
        edgeId: "edge.pensacola.hotel-to-neighborhood" as EdgeId,
      },
      rng,
    );

    expect(r1.state).toEqual(r2.state);
    expect(r1.events).toEqual(r2.events);
  });
});

// ── getAvailableEdges ─────────────────────────────────────────────────────────

describe("getAvailableEdges", () => {
  it("returns edges from the hotel node", () => {
    const edges = getAvailableEdges(
      pensacolaGraph,
      "node.pensacola.hotel" as NodeId,
    );
    expect(edges.length).toBe(2);
  });

  it("filters by transport mode", () => {
    const edges = getAvailableEdges(
      pensacolaGraph,
      "node.pensacola.hotel" as NodeId,
      "car",
    );
    expect(edges.length).toBe(1);
    expect(edges[0]!.id).toBe("edge.pensacola.hotel-to-neighborhood");
  });
});
