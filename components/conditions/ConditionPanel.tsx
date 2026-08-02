/**
 * ConditionPanel — accessible condition/treatment UI.
 *
 * Shows active conditions with symptoms, severity warnings, treatment
 * costs, and a treat button. Also shows permanent modifiers from past
 * conditions. Keyboard/touch/screen-reader usable. Never color-only.
 *
 * This is a fictional game mechanic — not medical advice.
 */

"use client";

import React, { useCallback, useId } from "react";
import type { SymptomVisibility } from "@/game/core/condition-engine";
import type { PermanentModifier } from "@/game/schemas/conditions";

export type ConditionUIEntry = {
  /** Symptom visibility data for this condition. */
  visibility: SymptomVisibility;
  /** Whether the treat button is available. */
  canTreat: boolean;
  /** Why treatment is unavailable (for aria-describedby). */
  disabledReason?: string;
  /** Treatment cost display string (e.g. "1x Clean Water"). */
  treatmentCostLabel: string;
  /** Whether currently being treated. */
  isTreated: boolean;
};

export type ConditionPanelProps = {
  /** Active conditions with visibility and treatment info. */
  conditions: ConditionUIEntry[];
  /** Permanent modifiers from past conditions. */
  permanentModifiers: PermanentModifier[];
  /** Called when the player treats a condition. */
  onTreat: (conditionId: string) => void;
};

const stageLabel: Record<string, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  critical: "Critical",
};

const stageIndicator: Record<string, string> = {
  mild: "\u25CB", // ○
  moderate: "\u25D1", // ◑
  severe: "\u25C9", // ◉
  critical: "\u2B24", // ⬤
};

export function ConditionPanel({
  conditions,
  permanentModifiers,
  onTreat,
}: ConditionPanelProps) {
  const baseId = useId();

  const handleTreat = useCallback(
    (conditionId: string) => {
      onTreat(conditionId);
    },
    [onTreat],
  );

  if (conditions.length === 0 && permanentModifiers.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="condition-panel"
      role="region"
      data-testid="condition-panel"
    >
      <h2 id={`${baseId}-title`}>Conditions</h2>

      {conditions.length > 0 && (
        <ul role="list" className="condition-list" data-testid="condition-list">
          {conditions.map((entry) => (
            <ConditionEntry
              key={entry.visibility.conditionId}
              entry={entry}
              baseId={baseId}
              onTreat={handleTreat}
            />
          ))}
        </ul>
      )}

      {permanentModifiers.length > 0 && (
        <div data-testid="permanent-modifiers">
          <h3>Lasting Effects</h3>
          <ul role="list">
            {permanentModifiers.map((mod, idx) => (
              <li key={`${mod.sourceConditionId}-${idx}`}>
                <span
                  aria-label={`${mod.label}: ${mod.delta > 0 ? "+" : ""}${mod.delta} ${mod.target}`}
                >
                  {mod.label}{" "}
                  <span aria-hidden="true">
                    ({mod.delta > 0 ? "+" : ""}
                    {mod.delta} {mod.target})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ConditionEntry({
  entry,
  baseId,
  onTreat,
}: {
  entry: ConditionUIEntry;
  baseId: string;
  onTreat: (conditionId: string) => void;
}) {
  const {
    visibility,
    canTreat,
    disabledReason,
    treatmentCostLabel,
    isTreated,
  } = entry;
  const condId = visibility.conditionId;
  const reasonId = `${baseId}-reason-${condId}`;

  return (
    <li className="condition-entry" data-testid={`condition-${condId}`}>
      <div className="condition-header">
        <span
          aria-label={`${visibility.name}: ${stageLabel[visibility.stage] ?? visibility.stage}`}
        >
          <span aria-hidden="true">
            {stageIndicator[visibility.stage] ?? "?"}{" "}
          </span>
          {visibility.name}
          <span className="ml-1 font-bold" aria-hidden="true">
            [{stageLabel[visibility.stage] ?? visibility.stage}]
          </span>
        </span>
      </div>

      <ul role="list" className="condition-symptoms">
        {visibility.symptoms.map((symptom, idx) => (
          <li key={idx}>{symptom}</li>
        ))}
      </ul>

      <p className="condition-uncertainty" role="note">
        {visibility.uncertaintyNote}
      </p>

      {visibility.severeRisk && visibility.severeRiskWarning && (
        <p
          className="condition-warning"
          role="alert"
          data-testid={`warning-${condId}`}
        >
          {visibility.severeRiskWarning}
        </p>
      )}

      <div className="condition-treatment">
        {isTreated ? (
          <p role="status" data-testid={`treated-${condId}`}>
            Currently being treated
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onTreat(condId)}
              disabled={!canTreat}
              aria-disabled={!canTreat}
              aria-describedby={!canTreat ? reasonId : undefined}
              data-testid={`treat-btn-${condId}`}
            >
              Treat ({treatmentCostLabel})
            </button>
            {!canTreat && disabledReason && (
              <p
                id={reasonId}
                className="condition-disabled-reason"
                role="note"
              >
                {disabledReason}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
