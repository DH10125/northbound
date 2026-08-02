/**
 * Event/choice UI component — accessible, keyboard/touch usable.
 *
 * Displays an active event with its options, showing availability status
 * and requirement explanations for disabled options. Resolution is announced
 * via live region. Does not rely on color alone for state indication.
 */

"use client";

import React, { useCallback, useRef } from "react";
import type { EventDefinition } from "@/game/content/event-definitions";
import type { OptionAvailability } from "@/game/core/event-engine";
import type { SkillCheckTier } from "@/game/content/event-definitions";

export type EventUIProps = {
  /** The active event to display. */
  event: EventDefinition;
  /** Availability status for each option. */
  optionAvailability: OptionAvailability[];
  /** Called when the player selects an available option. */
  onChoose: (optionId: string) => void;
  /** Resolution result text after choice is made. */
  resolutionText?: string;
  /** Skill check tier result (if applicable). */
  resolutionTier?: SkillCheckTier;
  /** Whether the event is currently being resolved. */
  isResolving?: boolean;
};

export function EventPanel({
  event,
  optionAvailability,
  onChoose,
  resolutionText,
  resolutionTier,
  isResolving,
}: EventUIProps) {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const handleChoose = useCallback(
    (optionId: string) => {
      if (isResolving) return;
      onChoose(optionId);
    },
    [onChoose, isResolving],
  );

  const handleKeyDown = useCallback(
    (optionId: string, e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleChoose(optionId);
      }
    },
    [handleChoose],
  );

  return (
    <section
      aria-labelledby="event-title"
      className="event-panel"
      role="region"
    >
      <h2 id="event-title">{event.title}</h2>
      <p className="event-text">{event.text}</p>

      {!resolutionText && (
        <fieldset
          aria-label="Choose an action"
          disabled={isResolving}
        >
          <legend className="sr-only">Available choices</legend>
          <ul role="list" className="event-options">
            {event.options.map((option) => {
              const availability = optionAvailability.find(
                (a) => a.optionId === option.id,
              );
              const isAvailable = availability?.available ?? true;
              const reason = availability?.reason;

              return (
                <li key={option.id} className="event-option-item">
                  <button
                    type="button"
                    onClick={() => handleChoose(option.id)}
                    onKeyDown={(e) => handleKeyDown(option.id, e)}
                    disabled={!isAvailable || isResolving}
                    aria-disabled={!isAvailable}
                    aria-describedby={
                      !isAvailable ? `req-${option.id}` : undefined
                    }
                    className={`event-option-button ${!isAvailable ? "event-option-unavailable" : ""}`}
                  >
                    <span className="event-option-label">{option.label}</span>
                    {!isAvailable && (
                      <span className="event-option-lock" aria-hidden="true">
                        {" "}
                        [Locked]
                      </span>
                    )}
                  </button>
                  {!isAvailable && reason && (
                    <p
                      id={`req-${option.id}`}
                      className="event-option-reason"
                      role="note"
                    >
                      {reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {/* Resolution result - announced via live region */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="event-resolution"
      >
        {resolutionText && (
          <div className="event-resolution-content">
            {resolutionTier && (
              <p className="event-tier">
                <span aria-label={`Check result: ${resolutionTier.replace("-", " ")}`}>
                  {tierToSymbol(resolutionTier)} {tierToLabel(resolutionTier)}
                </span>
              </p>
            )}
            <p className="event-outcome-text">{resolutionText}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function tierToSymbol(tier: SkillCheckTier): string {
  switch (tier) {
    case "critical-success":
      return "★★";
    case "success":
      return "★";
    case "failure":
      return "✗";
    case "critical-failure":
      return "✗✗";
  }
}

function tierToLabel(tier: SkillCheckTier): string {
  switch (tier) {
    case "critical-success":
      return "Critical Success";
    case "success":
      return "Success";
    case "failure":
      return "Failure";
    case "critical-failure":
      return "Critical Failure";
  }
}
