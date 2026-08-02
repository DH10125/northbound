/**
 * ConditionPanelContainer — connects ConditionPanel to real GameState.
 *
 * Derives ConditionUIEntry[] from GameState using the condition engine
 * selectors, resolves player-facing item labels, and dispatches
 * TREAT_CONDITION through the provided command handler.
 */

"use client";

import React, { useCallback, useMemo } from "react";
import { ConditionPanel } from "./ConditionPanel";
import type { ConditionUIEntry } from "./ConditionPanel";
import type { GameState } from "@/game/schemas/game-state";
import { getSymptomVisibility } from "@/game/core/condition-engine";
import { getConditionDefinition } from "@/game/content/conditions";
import { getItemDefinition } from "@/game/content/items";
import { treatmentDisabledReason } from "@/game/core/selectors";
import type { ItemId } from "@/game/schemas/ids";

export type ConditionPanelContainerProps = {
  state: GameState;
  onCommand: (command: {
    type: "TREAT_CONDITION";
    conditionId: string;
  }) => void;
};

export function ConditionPanelContainer({
  state,
  onCommand,
}: ConditionPanelContainerProps) {
  const player = state.party.player;
  const medicalSkill = player.attributes.medical;

  const entries: ConditionUIEntry[] = useMemo(() => {
    return player.conditions.map((cond) => {
      const visibility = getSymptomVisibility(cond, medicalSkill);
      const def = getConditionDefinition(cond.conditionId);
      const reason = treatmentDisabledReason(state, cond.conditionId);

      // Resolve player-facing item label
      let treatmentCostLabel = "";
      if (def) {
        const itemDef = getItemDefinition(def.treatmentItemId as ItemId);
        const itemName = itemDef?.name ?? def.treatmentItemId;
        treatmentCostLabel = `${def.treatmentItemCost}x ${itemName}`;
      }

      return {
        visibility: visibility ?? {
          conditionId: cond.conditionId,
          name: cond.conditionId,
          stage: "mild",
          symptoms: [],
          severeRisk: false,
          uncertaintyNote: "Unknown condition.",
        },
        canTreat: reason === "",
        disabledReason: reason || undefined,
        treatmentCostLabel,
        isTreated: cond.treated,
      };
    });
  }, [player.conditions, medicalSkill, state]);

  const handleTreat = useCallback(
    (conditionId: string) => {
      onCommand({ type: "TREAT_CONDITION", conditionId });
    },
    [onCommand],
  );

  return (
    <ConditionPanel
      conditions={entries}
      permanentModifiers={player.permanentModifiers}
      onTreat={handleTreat}
    />
  );
}
