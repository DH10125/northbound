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
  type RouteGraph,
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
  it("catches invalid edge source reference", () => {
    const badGraph: RouteGraph = {
      startNodeId: "node.test.a" as NodeId,
      nodes: [
        {
          id: "node.test.a" as NodeId,
          name: "A",
          description: "Node A",
          chapter: "pensacola-escape",
          terrain: "urban",
          required: false,
          riskLevel: "low",
          riskDescription: "Safe.",
          chapterStart: true,
          canRest: true,
          canScavenge: true,
        },
      ],
      edges: [
        {
          id: "edge.test.bad" as EdgeId,
          fromNodeId: "node.test.nonexistent" as NodeId,
          toNodeId: "node.test.a" as NodeId,
          distance: 10,
          terrain: "urban",
          allowedModes: ["foot"],
          riskLevel: "low",
          riskDescription: "N/A",
          label: "Bad edge",
          transitionsToChapter: null,
          uncertaintyWeight: 0,
          wearPerTraversal: 0,
        },
      ],
    };
    const errors = validateRouteGraph(badGraph);
    expect(errors.some((e) => e.code === "INVALID_EDGE_SOURCE")).toBe(true);
  });

  it("catches unreachable required node", () => {
    const badGraph: RouteGraph = {
      startNodeId: "node.test.a" as NodeId,
      nodes: [
        {
          id: "node.test.a" as NodeId,
          name: "A",
          description: "Node A",
          chapter: "pensacola-escape",
          terrain: "urban",
          required: false,
          riskLevel: "low",
          riskDescription: "Safe.",
          chapterStart: true,
          canRest: true,
          canScavenge: true,
        },
        {
          id: "node.test.b" as NodeId,
          name: "B",
          description: "Node B (isolated)",
          chapter: "pensacola-escape",
          terrain: "urban",
          required: true,
          riskLevel: "low",
          riskDescription: "Safe.",
          chapterStart: false,
          canRest: true,
          canScavenge: true,
        },
      ],
      edges: [
        {
          id: "edge.test.a-loop" as EdgeId,
          fromNodeId: "node.test.a" as NodeId,
          toNodeId: "node.test.a" as NodeId,
          distance: 10,
          terrain: "urban",
          allowedModes: ["foot"],
          riskLevel: "low",
          riskDescription: "N/A",
          label: "Loop",
          transitionsToChapter: null,
          uncertaintyWeight: 0,
          wearPerTraversal: 0,
        },
      ],
    };
    const errors = validateRouteGraph(badGraph);
    expect(errors.some((e) => e.code === "UNREACHABLE_REQUIRED_NODE")).toBe(
      true,
    );
  });

  it("catches self-loop edges", () => {
    const badGraph: RouteGraph = {
      startNodeId: "node.test.a" as NodeId,
      nodes: [
        {
          id: "node.test.a" as NodeId,
          name: "A",
          description: "Node A",
          chapter: "pensacola-escape",
          terrain: "urban",
          required: false,
          riskLevel: "low",
          riskDescription: "Safe.",
          chapterStart: true,
          canRest: true,
          canScavenge: true,
        },
      ],
      edges: [
        {
          id: "edge.test.self" as EdgeId,
          fromNodeId: "node.test.a" as NodeId,
          toNodeId: "node.test.a" as NodeId,
          distance: 10,
          terrain: "urban",
          allowedModes: ["foot"],
          riskLevel: "low",
          riskDescription: "N/A",
          label: "Self",
          transitionsToChapter: null,
          uncertaintyWeight: 0,
          wearPerTraversal: 0,
        },
      ],
    };
    const errors = validateRouteGraph(badGraph);
    expect(errors.some((e) => e.code === "SELF_LOOP")).toBe(true);
  });

  it("catches duplicate edge IDs", () => {
    const badGraph: RouteGraph = {
      startNodeId: "node.test.a" as NodeId,
      nodes: [
        {
          id: "node.test.a" as NodeId,
          name: "A",
          description: "Node A",
          chapter: "pensacola-escape",
          terrain: "urban",
          required: false,
          riskLevel: "low",
          riskDescription: "Safe.",
          chapterStart: true,
          canRest: true,
          canScavenge: true,
        },
        {
          id: "node.test.b" as NodeId,
          name: "B",
          description: "Node B",
          chapter: "pensacola-escape",
          terrain: "urban",
          required: false,
          riskLevel: "low",
          riskDescription: "Safe.",
          chapterStart: false,
          canRest: true,
          canScavenge: true,
        },
      ],
      edges: [
        {
          id: "edge.test.dup" as EdgeId,
          fromNodeId: "node.test.a" as NodeId,
          toNodeId: "node.test.b" as NodeId,
          distance: 10,
          terrain: "urban",
          allowedModes: ["foot"],
          riskLevel: "low",
          riskDescription: "N/A",
          label: "First",
          transitionsToChapter: null,
          uncertaintyWeight: 0,
          wearPerTraversal: 0,
        },
        {
          id: "edge.test.dup" as EdgeId,
          fromNodeId: "node.test.a" as NodeId,
          toNodeId: "node.test.b" as NodeId,
          distance: 20,
          terrain: "urban",
          allowedModes: ["foot"],
          riskLevel: "low",
          riskDescription: "N/A",
          label: "Second",
          transitionsToChapter: null,
          uncertaintyWeight: 0,
          wearPerTraversal: 0,
        },
      ],
    };
    const errors = validateRouteGraph(badGraph);
    expect(errors.some((e) => e.code === "DUPLICATE_EDGE_ID")).toBe(true);
  });
});

// ── Route resolution tests ────────────────────────────────────────────────────

describe("applyChooseRoute", () => {
  const rng = seedToState("route-test");

  it("successfully chooses a valid route", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.hotel-to-neighborhood",
    );
    expect(
      result.events.some((e) => e.type === "COMMAND_REJECTED"),
    ).toBe(false);
    expect(
      result.events.some((e) => e.type === "ROUTE_CHOSEN"),
    ).toBe(true);
    expect(result.state.location.currentNodeId).toBe(
      "node.pensacola.neighborhood-west",
    );
    expect(
      result.state.location.visitedNodeIds.includes(
        "node.pensacola.neighborhood-west" as NodeId,
      ),
    ).toBe(true);
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
    // State with active transport that has motorcycle mode
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
    const state: GameState = { ...minimalGameState, runStatus: "ended-success" };
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
    // Marina edge has wearPerTraversal: 1
    const transport = result.state.transports.find(
      (t) => t.instanceId === "transport-inst-001",
    );
    expect(transport!.condition).toBe(79);
  });

  it("handles chapter transition", () => {
    // Move to north-bridge, then take bridge-to-exit which transitions to gulf-coast
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
    expect(
      result.events.some((e) => e.type === "CHAPTER_TRANSITIONED"),
    ).toBe(true);
  });

  it("reduces distance remaining", () => {
    const result = applyChooseRoute(
      minimalGameState,
      rng,
      "edge.pensacola.hotel-to-neighborhood",
    );
    // Edge distance is 30; distanceRemaining was 1500
    expect(result.state.location.distanceRemaining).toBeLessThan(1500);
  });
});

// ── Navigation uncertainty determinism ────────────────────────────────────────

describe("navigation uncertainty", () => {
  it("produces deterministic results with same seed", () => {
    // Use the bayou trail which has high uncertainty
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

    // Run many seeds and check at least some get NAVIGATION_UNCERTAINTY
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
    // With uncertainty weight 0.35, we should see both outcomes
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
      { type: "CHOOSE_ROUTE", edgeId: "edge.pensacola.hotel-to-marina" as EdgeId },
      rng,
    );
    expect(result.events.some((e) => e.type === "ROUTE_CHOSEN")).toBe(true);
    expect(result.state.location.currentNodeId).toBe("node.pensacola.marina");
  });

  it("atomically rejects invalid CHOOSE_ROUTE (state unchanged)", () => {
    const rng = seedToState("reject-test");
    const result = applyCommand(
      minimalGameState,
      { type: "CHOOSE_ROUTE", edgeId: "edge.pensacola.nonexistent" as EdgeId },
      rng,
    );
    expect(result.events[0]!.type).toBe("COMMAND_REJECTED");
    // State should be identical
    expect(result.state).toBe(minimalGameState);
  });
});

// ── Replay equivalence ────────────────────────────────────────────────────────

describe("replay equivalence", () => {
  it("same command sequence produces identical state", () => {
    const rng = seedToState("replay-test");

    // Run 1
    const r1 = applyCommand(
      minimalGameState,
      { type: "CHOOSE_ROUTE", edgeId: "edge.pensacola.hotel-to-neighborhood" as EdgeId },
      rng,
    );
    const r1b = applyCommand(
      r1.state,
      { type: "TRAVEL", turnsToTravel: 1 },
      r1.rng,
    );

    // Run 2 (same sequence)
    const r2 = applyCommand(
      minimalGameState,
      { type: "CHOOSE_ROUTE", edgeId: "edge.pensacola.hotel-to-neighborhood" as EdgeId },
      rng,
    );
    const r2b = applyCommand(
      r2.state,
      { type: "TRAVEL", turnsToTravel: 1 },
      r2.rng,
    );

    expect(r1b.state).toEqual(r2b.state);
    expect(r1b.events).toEqual(r2b.events);
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
    // Only hotel-to-neighborhood allows car
    expect(edges.length).toBe(1);
    expect(edges[0]!.id).toBe("edge.pensacola.hotel-to-neighborhood");
  });
});
