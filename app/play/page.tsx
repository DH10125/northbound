"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import type { GameState } from "@/game/schemas/game-state";
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
import { writeSave, readSave } from "@/game/core/save-helpers";
import "./play.css";

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
      // Auto-save using validated helper
      writeSave(sessionStorage, action.game, action.rng);
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a scene banner CSS class from event tags. */
function getSceneBannerClass(event: EventDefinition | null): string {
  if (!event) return "scene-banner--default";
  const tags = event.tags;
  if (tags.includes("opening") || tags.includes("tutorial"))
    return "scene-banner--opening";
  if (tags.includes("stealth")) return "scene-banner--stealth";
  if (tags.includes("route") || tags.includes("exit"))
    return "scene-banner--route";
  if (tags.includes("supply") || tags.includes("transport"))
    return "scene-banner--supply";
  if (tags.includes("story") || tags.includes("family"))
    return "scene-banner--story";
  if (tags.includes("health") || tags.includes("failure"))
    return "scene-banner--health";
  if (tags.includes("flavor")) return "scene-banner--flavor";
  return "scene-banner--default";
}

/** Determine meter bar CSS class based on value and whether higher is worse. */
function getMeterBarClass(
  label: string,
  value: number,
): string {
  // "Inverse" meters: higher = worse
  const inverseMeter = ["Hunger", "Thirst", "Fatigue", "Stress"].includes(
    label,
  );
  if (inverseMeter) {
    if (value >= 70) return "meter-item__bar-fill--inverse-danger";
    if (value >= 40) return "meter-item__bar-fill--inverse-warn";
    return "meter-item__bar-fill--inverse-ok";
  }
  // Normal meters: lower = worse
  if (value <= 30) return "meter-item__bar-fill--danger";
  if (value <= 60) return "meter-item__bar-fill--warn";
  return "meter-item__bar-fill--ok";
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
    const loadResult = readSave(sessionStorage);
    if (!loadResult.ok) return;
    dispatch({ type: "LOAD", game: loadResult.state, rng: loadResult.rng });
    setLoaded(true);
  }, []);

  // ── Event activation ────────────────────────────────────────────────────────

  const activateEvent = useCallback(() => {
    if (!state.game) return;
    const result = applyCommand(
      state.game,
      { type: "ACTIVATE_EVENT" },
      state.rng,
    );
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
      // Find the actual resolved outcome text from domain events
      const resolvedEvent = result.events.find(
        (e) => e.type === "ENCOUNTER_RESOLVED",
      );
      const text =
        resolvedEvent && "outcomeText" in resolvedEvent
          ? (resolvedEvent.outcomeText as string)
          : "You proceed.";
      const tier =
        resolvedEvent && "tier" in resolvedEvent
          ? (resolvedEvent.tier as string | undefined)
          : undefined;
      dispatch({
        type: "APPLY",
        game: result.state,
        rng: result.rng,
        events: result.events,
        resolutionText: tier ? `[${tier}] ${text}` : text,
      });
    },
    [state.game, state.rng, state.activeEvent],
  );

  // ── Route traversal ─────────────────────────────────────────────────────────

  const chooseRoute = useCallback(
    (edgeId: EdgeId) => {
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
        <h1 className="play-header__title" style={{ marginBottom: "var(--space-4)" }}>
          No save found
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
          Create a character to begin your journey.
        </p>
        <Link
          href="/create"
          className="chapter-complete__link"
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

  const phaseClass =
    game.world.phase === "night"
      ? "play-header__phase-dot--night"
      : "play-header__phase-dot--day";

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col px-4 py-8 sm:px-6"
    >
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <header className="play-header">
          <h1 className="play-header__title">
            {game.party.player.name}&apos;s Journey
          </h1>
          <span className="play-header__meta">
            <span
              className={`play-header__phase-dot ${phaseClass}`}
              aria-hidden="true"
            />
            Day {game.world.day} · {game.world.phase}
          </span>
        </header>

        {/* Chapter complete */}
        {state.chapterComplete && (
          <section
            role="status"
            aria-live="polite"
            className="chapter-complete fade-in"
          >
            <h2 className="chapter-complete__heading">
              Chapter Complete
            </h2>
            <p className="chapter-complete__text">
              You have escaped Pensacola. The road north stretches ahead.
            </p>
            <Link href="/" className="chapter-complete__link">
              Return to home
            </Link>
          </section>
        )}

        {/* Scene banner + Location */}
        {!state.chapterComplete && (
          <>
            {/* Scene banner */}
            <div
              className={`scene-banner ${getSceneBannerClass(state.activeEvent)} fade-in`}
              aria-hidden="true"
            >
              {state.activeEvent && (
                <span className="scene-banner__title">
                  {state.activeEvent.title}
                </span>
              )}
              {!state.activeEvent && currentNode && (
                <span className="scene-banner__title">{currentNode.name}</span>
              )}
            </div>

            {/* Location card */}
            <section aria-label="Current location" className="location-card">
              <h2 className="location-card__name">
                {currentNode?.name ?? game.location.currentNodeId}
              </h2>
              <p className="location-card__description">
                {currentNode?.description ?? ""}
              </p>
              <div className="location-card__meta">
                <span>Terrain: {game.location.terrain}</span>
                <span>Risk: {currentNode?.riskLevel ?? "unknown"}</span>
                <span>
                  Distance remaining: {game.location.distanceRemaining}
                </span>
              </div>
            </section>
          </>
        )}

        {/* Meters */}
        {!state.chapterComplete && (
          <section aria-label="Player status" className="meter-grid">
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
              <div key={label} className="meter-item">
                <div className="meter-item__label">{label}</div>
                <div className="meter-item__bar-track">
                  <div
                    className={`meter-item__bar-fill ${getMeterBarClass(label, val)}`}
                    style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                    role="meter"
                    aria-label={label}
                    aria-valuenow={val}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <div className="meter-item__value">{val}</div>
              </div>
            ))}
          </section>
        )}

        {/* Active event */}
        {state.activeEvent && !state.chapterComplete && (
          <div className="fade-in">
            {state.resolutionText ? (
              <section
                aria-label="Event outcome"
                className="resolution-card fade-in"
              >
                <h2 className="resolution-card__title">
                  {state.activeEvent.title}
                </h2>
                <div ref={liveRef} aria-live="polite" aria-atomic="true">
                  <p className="resolution-card__text">
                    {state.resolutionText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissResolution}
                  className="resolution-card__button"
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
          <section aria-label="Available actions" className="action-section fade-in">
            <h2 className="action-section__heading">What do you do?</h2>

            {hasEvents && (
              <button
                type="button"
                onClick={activateEvent}
                className="action-button action-button--event"
              >
                <span className="action-button__label">
                  Look around (trigger event)
                </span>
              </button>
            )}

            {edges.length > 0 && (
              <div className="space-y-2" style={{ marginTop: hasEvents ? "var(--space-4)" : undefined }}>
                <h3 className="route-heading">Travel routes:</h3>
                {edges.map((edge) => {
                  const dest = getNode(pensacolaGraph, edge.toNodeId as NodeId);
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => chooseRoute(edge.id)}
                      className="action-button"
                      aria-describedby={`route-desc-${edge.id}`}
                    >
                      <span className="action-button__label">{edge.label}</span>
                      <span
                        id={`route-desc-${edge.id}`}
                        className="action-button__meta"
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
          <details className="journey-log">
            <summary>
              Journey log ({state.log.length} entries)
            </summary>
            <ul className="journey-log__list">
              {state.log.map((entry, i) => (
                <li key={i} className="journey-log__entry">
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
