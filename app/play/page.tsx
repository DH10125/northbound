"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import type { GameState } from "@/game/schemas/game-state";
import { GameStateSchema } from "@/game/schemas/game-state";
import type { RngState } from "@/game/core/rng";
import { applyCommand, setEventRegistry } from "@/game/core/reducer";
import { PENSACOLA_EVENTS } from "@/game/content/pensacola-events";
import { EventPanel } from "@/components/EventPanel";
import {
  getAvailableEdges,
  getNode,
  pensacolaGraph,
} from "@/game/content/route-graph";
import {
  filterCandidates,
  getOptionAvailability,
} from "@/game/core/event-engine";
import type { EventDefinition } from "@/game/content/event-definitions";
import type { NodeId, EdgeId } from "@/game/schemas/ids";
import type { DomainEvent } from "@/game/core/domain-events";

// ── Storage key ──────────────────────────────────────────────────────────────

const SAVE_KEY = "northbound-save";

// ── Types ────────────────────────────────────────────────────────────────────

type PlayState = {
  game: GameState;
  rng: RngState;
  log: string[];
  activeEvent: EventDefinition | null;
  resolutionText: string | null;
  chapterComplete: boolean;
};

type PlayAction =
  | { type: "LOAD"; game: GameState; rng: RngState }
  | {
      type: "APPLY";
      game: GameState;
      rng: RngState;
      events: DomainEvent[];
      resolutionText?: string;
    }
  | { type: "SET_EVENT"; event: EventDefinition | null }
  | { type: "CLEAR_RESOLUTION" }
  | { type: "LOG"; message: string };

function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        game: action.game,
        rng: action.rng,
        activeEvent: null,
        resolutionText: null,
        chapterComplete: false,
      };
    case "APPLY": {
      const log = [...state.log];
      for (const ev of action.events) {
        if (ev.type === "CHAPTER_TRANSITIONED") {
          log.push(`Chapter transition: ${ev.fromChapter} → ${ev.toChapter}`);
        } else if (ev.type === "ROUTE_CHOSEN") {
          log.push(`Traveled: ${ev.fromNodeId} → ${ev.toNodeId}`);
        } else if (ev.type === "METER_CHANGED") {
          log.push(`${ev.meter}: ${ev.delta > 0 ? "+" : ""}${ev.delta}`);
        } else if (ev.type === "COMMAND_REJECTED") {
          log.push(`Rejected: ${ev.reason}`);
        }
      }
      const chapterComplete =
        action.events.some((e) => e.type === "CHAPTER_TRANSITIONED") ||
        action.game.location.chapter !== "pensacola-escape";
      // Auto-save
      try {
        sessionStorage.setItem(
          SAVE_KEY,
          JSON.stringify({ state: action.game, rng: action.rng }),
        );
      } catch {
        /* quota exceeded — ignore */
      }
      return {
        ...state,
        game: action.game,
        rng: action.rng,
        log,
        resolutionText: action.resolutionText ?? null,
        chapterComplete: state.chapterComplete || chapterComplete,
      };
    }
    case "SET_EVENT":
      return { ...state, activeEvent: action.event, resolutionText: null };
    case "CLEAR_RESOLUTION":
      return { ...state, resolutionText: null, activeEvent: null };
    case "LOG":
      return { ...state, log: [...state.log, action.message] };
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlayPage() {
  const [loaded, setLoaded] = useState(false);
  const [state, dispatch] = useReducer(playReducer, {
    game: null as unknown as GameState,
    rng: null as unknown as RngState,
    log: [],
    activeEvent: null,
    resolutionText: null,
    chapterComplete: false,
  });
  const liveRef = useRef<HTMLDivElement>(null);

  // Register events and load save on mount
  useEffect(() => {
    setEventRegistry(PENSACOLA_EVENTS);
    const raw = sessionStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { state: GameState; rng: RngState };
      const parsed = GameStateSchema.safeParse(data.state);
      if (!parsed.success) return;
      dispatch({ type: "LOAD", game: data.state, rng: data.rng });
      setLoaded(true);
    } catch {
      /* corrupt save — ignore */
    }
  }, []);

  // ── Event activation ────────────────────────────────────────────────────────

  const activateEvent = useCallback(() => {
    if (!state.game) return;
    const result = applyCommand(state.game, { type: "ACTIVATE_EVENT" }, state.rng);
    const started = result.events.find((e) => e.type === "ENCOUNTER_STARTED");
    if (started && "eventId" in started) {
      const evt = PENSACOLA_EVENTS.find(
        (e) => e.id === (started as { eventId: string }).eventId,
      );
      dispatch({
        type: "APPLY",
        game: result.state,
        rng: result.rng,
        events: result.events,
      });
      dispatch({ type: "SET_EVENT", event: evt ?? null });
    } else {
      dispatch({
        type: "APPLY",
        game: result.state,
        rng: result.rng,
        events: result.events,
      });
      dispatch({ type: "LOG", message: "Nothing eventful happens." });
    }
  }, [state.game, state.rng]);

  // ── Event option choice ─────────────────────────────────────────────────────

  const chooseOption = useCallback(
    (optionId: string) => {
      if (!state.game || !state.activeEvent) return;
      const result = applyCommand(
        state.game,
        {
          type: "CHOOSE_EVENT_OPTION",
          eventId: state.activeEvent.id,
          optionId,
        },
        state.rng,
      );
      // Find the outcome text from the event definition
      const option = state.activeEvent.options.find(
        (o: { id: string }) => o.id === optionId,
      );
      const text = option?.outcomes[0]?.text ?? "You proceed.";
      dispatch({
        type: "APPLY",
        game: result.state,
        rng: result.rng,
        events: result.events,
        resolutionText: text,
      });
    },
    [state.game, state.rng, state.activeEvent],
  );

  // ── Route traversal ─────────────────────────────────────────────────────────

  const chooseRoute = useCallback(
    (edgeId: string) => {
      if (!state.game) return;
      const result = applyCommand(
        state.game,
        { type: "CHOOSE_ROUTE", edgeId },
        state.rng,
      );
      dispatch({
        type: "APPLY",
        game: result.state,
        rng: result.rng,
        events: result.events,
      });
    },
    [state.game, state.rng],
  );

  // ── Dismiss resolution ──────────────────────────────────────────────────────

  const dismissResolution = useCallback(() => {
    dispatch({ type: "CLEAR_RESOLUTION" });
  }, []);

  // ── No save found ───────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-4 py-16"
      >
        <h1
          className="text-2xl font-bold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          No save found
        </h1>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
          Create a character to begin your journey.
        </p>
        <Link
          href="/create"
          className="underline"
          style={{ color: "var(--text-link)" }}
        >
          Create a character
        </Link>
      </main>
    );
  }

  const game = state.game;
  const currentNode = getNode(pensacolaGraph, game.location.currentNodeId);
  const edges = getAvailableEdges(
    pensacolaGraph,
    game.location.currentNodeId,
    game.party.activeTransportId
      ? (game.transports.find(
          (t) => t.instanceId === game.party.activeTransportId,
        )?.mode ?? "foot")
      : "foot",
  );

  // Check for pending events
  const candidates = filterCandidates(
    PENSACOLA_EVENTS,
    game,
    game.eventHistory.entries.length,
  );
  const hasEvents = candidates.length > 0;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col px-4 py-8 sm:px-6"
    >
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-baseline justify-between">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {game.party.player.name}&apos;s Journey
          </h1>
          <span
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Day {game.world.day} · {game.world.phase}
          </span>
        </header>

        {/* Chapter complete */}
        {state.chapterComplete && (
          <section
            role="status"
            aria-live="polite"
            className="p-4 rounded border"
            style={{
              borderColor: "var(--accent)",
              backgroundColor: "var(--surface-secondary)",
            }}
          >
            <h2
              className="text-xl font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Chapter Complete
            </h2>
            <p style={{ color: "var(--text-secondary)" }}>
              You have escaped Pensacola. The road north stretches ahead.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block underline"
              style={{ color: "var(--text-link)" }}
            >
              Return to home
            </Link>
          </section>
        )}

        {/* Location */}
        {!state.chapterComplete && (
          <section
            aria-label="Current location"
            className="p-4 rounded"
            style={{ backgroundColor: "var(--surface-secondary)" }}
          >
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {currentNode?.name ?? game.location.currentNodeId}
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {currentNode?.description ?? ""}
            </p>
            <div
              className="mt-2 text-xs space-x-4"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span>Terrain: {game.location.terrain}</span>
              <span>Risk: {currentNode?.riskLevel ?? "unknown"}</span>
              <span>Distance remaining: {game.location.distanceRemaining}</span>
            </div>
          </section>
        )}

        {/* Meters */}
        {!state.chapterComplete && (
          <section aria-label="Player status" className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-sm">
            {(
              [
                ["Health", game.party.player.meters.health],
                ["Hunger", game.party.player.meters.hunger],
                ["Thirst", game.party.player.meters.thirst],
                ["Fatigue", game.party.player.meters.fatigue],
                ["Stress", game.party.player.meters.stress],
                ["Morale", game.party.player.meters.morale],
              ] as const
            ).map(([label, val]) => (
              <div
                key={label}
                className="p-2 rounded text-center"
                style={{ backgroundColor: "var(--surface-secondary)" }}
              >
                <div
                  className="text-xs"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {label}
                </div>
                <div
                  className="font-mono font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {val}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Active event */}
        {state.activeEvent && !state.chapterComplete && (
          <div>
            {state.resolutionText ? (
              <section
                aria-label="Event outcome"
                className="p-4 rounded space-y-3"
                style={{ backgroundColor: "var(--surface-secondary)" }}
              >
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {state.activeEvent.title}
                </h2>
                <div
                  ref={liveRef}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p style={{ color: "var(--text-secondary)" }}>
                    {state.resolutionText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissResolution}
                  className="mt-2 px-4 py-2 rounded text-sm font-medium"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--text-on-accent)",
                  }}
                >
                  Continue
                </button>
              </section>
            ) : (
              <EventPanel
                event={state.activeEvent}
                optionAvailability={getOptionAvailability(
                  state.activeEvent.options,
                  game,
                )}
                onChoose={chooseOption}
              />
            )}
          </div>
        )}

        {/* Actions (when no event active) */}
        {!state.activeEvent && !state.chapterComplete && (
          <section aria-label="Available actions" className="space-y-3">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              What do you do?
            </h2>

            {hasEvents && (
              <button
                type="button"
                onClick={activateEvent}
                className="block w-full text-left px-4 py-3 rounded"
                style={{
                  backgroundColor: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                }}
              >
                Look around (trigger event)
              </button>
            )}

            {edges.length > 0 && (
              <div className="space-y-2">
                <h3
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Travel routes:
                </h3>
                {edges.map((edge) => {
                  const dest = getNode(
                    pensacolaGraph,
                    edge.toNodeId as NodeId,
                  );
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => chooseRoute(edge.id)}
                      className="block w-full text-left px-4 py-3 rounded"
                      style={{
                        backgroundColor: "var(--surface-secondary)",
                        color: "var(--text-primary)",
                      }}
                      aria-describedby={`route-desc-${edge.id}`}
                    >
                      <span className="font-medium">{edge.label}</span>
                      <span
                        id={`route-desc-${edge.id}`}
                        className="block text-xs mt-1"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        → {dest?.name ?? edge.toNodeId} · Distance:{" "}
                        {edge.distance} · Risk: {edge.riskLevel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Journey log */}
        {state.log.length > 0 && (
          <details className="text-sm">
            <summary
              className="cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
            >
              Journey log ({state.log.length} entries)
            </summary>
            <ul
              className="mt-2 space-y-1 max-h-48 overflow-y-auto"
              style={{ color: "var(--text-tertiary)" }}
            >
              {state.log.map((entry, i) => (
                <li key={i} className="font-mono text-xs">
                  {entry}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </main>
  );
}
