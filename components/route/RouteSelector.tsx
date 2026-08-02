"use client";

import { useMemo } from "react";
import type { GameState } from "@/game/schemas/game-state";
import type { RouteEdge } from "@/game/content/route-graph";
import {
  getAvailableEdges,
  getNode,
  pensacolaGraph,
} from "@/game/content/route-graph";
import { getGraphForChapter } from "@/game/core/route-resolution";
import { type NodeId } from "@/game/schemas/ids";
import { StatusBadge, type StatusValue } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

// ── Risk → StatusBadge mapping ────────────────────────────────────────────────

const riskToStatus: Record<string, StatusValue> = {
  low: "ok",
  moderate: "warn",
  high: "danger",
  extreme: "danger",
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RouteSelectorProps {
  state: GameState;
  onChooseRoute: (edgeId: string) => void;
  disabled?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTransportMode(state: GameState): string {
  if (!state.party.activeTransportId) return "foot";
  const transport = state.transports.find(
    (t) => t.instanceId === state.party.activeTransportId,
  );
  return transport?.mode ?? "foot";
}

function getUnavailableReason(edge: RouteEdge, mode: string): string | null {
  if (!edge.allowedModes.includes(mode as never)) {
    return `Requires: ${edge.allowedModes.join(", ")}. Current: ${mode}.`;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * RouteSelector — accessible route-choice UI.
 *
 * Displays the current location, available edges from that location,
 * distance/terrain/risk/transport constraints, and allows selection.
 *
 * Keyboard: Tab between route options, Enter/Space to select.
 * Screen reader: each route button has aria-label with full context.
 * Disabled routes show the reason via aria-describedby.
 */
export function RouteSelector({
  state,
  onChooseRoute,
  disabled = false,
}: RouteSelectorProps) {
  const graph = getGraphForChapter(state.location.chapter) ?? pensacolaGraph;
  const currentNode = getNode(graph, state.location.currentNodeId as NodeId);
  const mode = getTransportMode(state);

  const allEdges = useMemo(
    () => getAvailableEdges(graph, state.location.currentNodeId as NodeId),
    [graph, state.location.currentNodeId],
  );

  if (!currentNode) return null;

  return (
    <section aria-labelledby="route-selector-heading" className="space-y-4">
      {/* Current location */}
      <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--interactive-secondary-border)]">
        <h2
          id="route-selector-heading"
          className="text-[length:var(--text-lg)] font-semibold text-[var(--text-primary)]"
        >
          {currentNode.name}
        </h2>
        <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)] mt-1">
          {currentNode.description}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <StatusBadge
            status={riskToStatus[currentNode.riskLevel] ?? "neutral"}
            label="Risk"
            value={currentNode.riskLevel}
          />
          <span className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
            <span className="font-semibold">Terrain:</span>{" "}
            {currentNode.terrain}
          </span>
          <span className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
            <span className="font-semibold">Transport:</span> {mode}
          </span>
        </div>
        <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)] mt-1 italic">
          {currentNode.riskDescription}
        </p>
      </div>

      {/* Available routes */}
      <div>
        <h3 className="text-[length:var(--text-base)] font-semibold text-[var(--text-primary)] mb-2">
          Available Routes
        </h3>
        {allEdges.length === 0 ? (
          <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
            No routes available from this location.
          </p>
        ) : (
          <ul className="space-y-2" role="list" aria-label="Route choices">
            {allEdges.map((edge) => {
              const reason = getUnavailableReason(edge, mode);
              const isUnavailable = reason !== null;
              const destNode = getNode(graph, edge.toNodeId);
              const riskStatus = riskToStatus[edge.riskLevel] ?? "neutral";

              return (
                <li key={edge.id}>
                  <div
                    className={[
                      "p-3 rounded-[var(--radius-md)] border",
                      isUnavailable
                        ? "border-[var(--status-neutral-color)] opacity-60"
                        : "border-[var(--interactive-secondary-border)]",
                      "bg-[var(--surface-primary)]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[length:var(--text-base)] font-medium text-[var(--text-primary)]">
                          {edge.label}
                        </p>
                        {destNode && (
                          <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
                            To: {destNode.name}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
                            <span className="font-semibold">Distance:</span>{" "}
                            {edge.distance}
                          </span>
                          <span className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
                            <span className="font-semibold">Terrain:</span>{" "}
                            {edge.terrain}
                          </span>
                          <StatusBadge
                            status={riskStatus}
                            label="Risk"
                            value={edge.riskLevel}
                          />
                        </div>
                        <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)] mt-1 italic">
                          {edge.riskDescription}
                        </p>
                        {edge.uncertaintyWeight > 0.2 && (
                          <p className="text-[length:var(--text-sm)] text-[var(--status-warn-color)] mt-1">
                            ⚠ Navigation uncertain — risk of detour
                          </p>
                        )}
                        {isUnavailable && (
                          <p
                            className="text-[length:var(--text-sm)] text-[var(--status-danger-color)] mt-1 font-medium"
                            id={`route-unavail-${edge.id}`}
                          >
                            Unavailable: {reason}
                          </p>
                        )}
                      </div>
                      <Button
                        variant={isUnavailable ? "ghost" : "primary"}
                        size="sm"
                        disabled={disabled || isUnavailable}
                        onClick={() => onChooseRoute(edge.id)}
                        aria-label={`Travel: ${edge.label}. Distance ${edge.distance}, terrain ${edge.terrain}, risk ${edge.riskLevel}. ${edge.riskDescription}`}
                        aria-describedby={
                          isUnavailable ? `route-unavail-${edge.id}` : undefined
                        }
                      >
                        Travel
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Route progress summary */}
      <div className="p-2 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] text-[length:var(--text-sm)] text-[var(--text-secondary)]">
        <span className="font-semibold">Distance remaining:</span>{" "}
        {state.location.distanceRemaining} |{" "}
        <span className="font-semibold">Day:</span> {state.world.day} |{" "}
        <span className="font-semibold">Phase:</span> {state.world.phase}
      </div>
    </section>
  );
}
