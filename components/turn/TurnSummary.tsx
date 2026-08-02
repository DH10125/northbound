"use client";

import { useEffect, useRef } from "react";
import { useLiveRegion } from "../ui/LiveRegion";
import { VisuallyHidden } from "../ui/VisuallyHidden";
import type { TurnResolvedEvent } from "../../game/core/domain-events";

export interface TurnSummaryProps {
  /** The most-recently resolved turn event, or null if no turn has been taken. */
  event: TurnResolvedEvent | null;
}

const FIELD_LABELS: Record<string, string> = {
  hunger: "Hunger",
  thirst: "Thirst",
  fatigue: "Fatigue",
  sleepDebt: "Sleep debt",
  "farm.clockTurns": "Farm clock",
};

/** Format a meter delta as a signed string, e.g. "+8" or "-12". */
function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/** Build the accessible announcement string for a resolved turn. */
export function buildTurnAnnouncement(event: TurnResolvedEvent): string {
  const changes = event.changes
    .filter((c) => c.field !== "farm.clockTurns")
    .map((c) => {
      const label = FIELD_LABELS[c.field] ?? c.field;
      return `${label} ${formatDelta(c.delta)}`;
    });

  const phaseLabel = event.phase.charAt(0).toUpperCase() + event.phase.slice(1);
  const base = `${event.action} complete. ${event.hoursElapsed} hours elapsed during ${phaseLabel}.`;
  return changes.length > 0 ? `${base} ${changes.join(", ")}.` : base;
}

/**
 * TurnSummary — renders the result of the most-recently resolved turn and
 * announces it via a polite live region.
 *
 * Keyboard/screen-reader notes:
 *   - The summary panel is labelled with role="region" and an accessible name.
 *   - Each change row has a visually-hidden description for full context.
 *   - On each new event the announcement is pushed to the global live region.
 */
export function TurnSummary({ event }: TurnSummaryProps) {
  const { announce } = useLiveRegion();
  const prevFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (!event) return;
    const fingerprint = `${event.action}-${event.phase}-${event.hoursElapsed}-${event.changes.length}`;
    if (fingerprint === prevFingerprintRef.current) return;
    prevFingerprintRef.current = fingerprint;
    announce(buildTurnAnnouncement(event));
  }, [event, announce]);

  if (!event) {
    return (
      <section
        aria-label="Turn summary"
        data-testid="turn-summary"
        className="turn-summary turn-summary--empty"
      >
        <VisuallyHidden>No turns taken yet.</VisuallyHidden>
        <p aria-hidden="true" className="turn-summary__empty-label">
          No actions taken yet.
        </p>
      </section>
    );
  }

  const meterChanges = event.changes.filter(
    (c) => c.field !== "farm.clockTurns",
  );
  const farmChange = event.changes.find((c) => c.field === "farm.clockTurns");

  return (
    <section
      aria-label="Turn summary"
      data-testid="turn-summary"
      className="turn-summary"
    >
      <h2 className="turn-summary__heading">
        {event.action
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())}
        <span className="turn-summary__phase"> — {event.phase}</span>
      </h2>

      <p className="turn-summary__elapsed">
        {event.hoursElapsed} hour{event.hoursElapsed !== 1 ? "s" : ""} elapsed
      </p>

      {meterChanges.length > 0 && (
        <ul
          className="turn-summary__changes"
          aria-label="Meter changes"
          data-testid="turn-summary-changes"
        >
          {meterChanges.map((change) => {
            const label = FIELD_LABELS[change.field] ?? change.field;
            const sign = change.delta > 0 ? "increased" : "decreased";
            return (
              <li key={change.field} className="turn-summary__change-row">
                <span className="turn-summary__change-label">{label}</span>
                <span
                  className={`turn-summary__change-delta ${change.delta > 0 ? "turn-summary__change-delta--worse" : "turn-summary__change-delta--better"}`}
                  aria-label={`${label} ${sign} by ${Math.abs(change.delta)}, now ${change.after}`}
                >
                  {formatDelta(change.delta)}
                </span>
                <VisuallyHidden>
                  {label} {sign} by {Math.abs(change.delta)}, now {change.after}
                </VisuallyHidden>
              </li>
            );
          })}
        </ul>
      )}

      {farmChange && (
        <p
          className="turn-summary__farm-clock"
          data-testid="turn-summary-farm-clock"
        >
          <VisuallyHidden>
            Farm clock advanced to turn {farmChange.after}.
          </VisuallyHidden>
          <span aria-hidden="true">Farm clock: {farmChange.after}</span>
        </p>
      )}
    </section>
  );
}
